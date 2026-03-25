# Nodent — VCE Study Platform

A full-stack study platform for VCE (Victorian Certificate of Education) students featuring quizzes, study tracking, collaborative chat, competition leaderboards, and an admin panel for custom question management.

## Architecture Overview

This project uses a **modern separated architecture** — the frontend and backend are completely independent applications that communicate via REST API:

```
Nodent.web/
├── backend/          # Standalone Hono API (Cloudflare Workers, for local dev)
├── frontend/         # React 19 SPA (Vite + Tailwind CSS v4 + ShadCN UI)
├── pages-deploy/     # Production deployment bundle (frontend + API as Pages Function)
│   └── functions/    # Cloudflare Pages Functions (API routes)
├── server.js         # Legacy Express/SQLite server (deprecated, kept for reference)
└── public/           # Legacy static HTML/CSS/JS files (deprecated)
```

**Why separate frontend and backend?**
- The frontend is a **static site** (HTML/CSS/JS) served by a CDN (Cloudflare Pages) — it loads fast globally
- The backend is a **serverless API** (Cloudflare Workers) — it scales automatically, no server management
- They can be deployed, versioned, and scaled independently
- The frontend makes `fetch()` requests to the backend API — this is the same pattern used by major apps

### Tech Stack

| Layer | Technology | Why We Chose It |
|-------|-----------|-----------------|
| **Frontend** | React 19, TypeScript, Vite | React is the most popular UI library. TypeScript adds type safety. Vite is a fast build tool. |
| **UI** | Tailwind CSS v4, ShadCN UI | Tailwind = utility-first CSS (no writing CSS files). ShadCN = pre-built accessible components. |
| **Backend** | Hono (Cloudflare Pages Functions) | Hono is like Express but runs on the edge (serverless). No servers to manage. |
| **Database** | PostgreSQL (Neon Serverless) | PostgreSQL is the industry standard. Neon provides a free serverless PostgreSQL. |
| **ORM** | Drizzle ORM | Type-safe SQL queries — catches database errors at compile time, not runtime. |
| **Hosting** | Cloudflare Pages (frontend + API) | Free tier: 100k API requests/day + unlimited frontend bandwidth. Single domain. |
| **Fonts** | DM Serif Display + DM Sans | Serif for headings (scholarly feel) + sans-serif for body (readability). |

## Live Deployment

The entire app (frontend + API) is deployed under a single domain on Cloudflare Pages:

| Service | URL |
|---------|-----|
| Frontend | https://nodent.pages.dev |
| Backend API | https://nodent.pages.dev/api/* |

> **How?** The API runs as a [Cloudflare Pages Function](https://developers.cloudflare.com/pages/functions/) — a serverless function bundled alongside the static frontend. The file `pages-deploy/functions/api/[[path]].ts` contains the entire Hono backend as a single catch-all function. This means no separate Workers deployment or SSL provisioning — everything is under one domain.

## Features

### For Students
- **27 VCE Subjects** with embedded quiz questions (MCQ, short answer, written response)
- **Practice Mode** — Answer questions with instant feedback, progress tracking, and auto-save
- **Study Mode** — Timed study sessions with Pomodoro timer and question navigation
- **Competition Stats** — Percentile rankings, leaderboards, per-topic performance breakdown
- **Subject Chat** — Real-time discussion boards per subject
- **Comment Threads** — Nested discussion on individual quiz questions
- **Study Tracker** — Daily Pomodoro timer with goal setting and progress visualization

### For Admins
- **Custom Question Management** — Add/delete MCQ, short answer, and long-form questions per subject
- **Admin Key Authentication** — Separate admin access via secret key header

## Getting Started

### Prerequisites
- **Node.js 18+** — download from [nodejs.org](https://nodejs.org)
- **npm** — comes with Node.js

### Local Development

1. **Clone the repository**
   ```bash
   git clone git@github.com:Umar99026/Nodent.web.git
   cd Nodent.web
   ```

2. **Set up the backend**
   ```bash
   cd backend
   npm install
   ```

   Create a file called `.dev.vars` in the `backend/` folder with your Neon database URL:
   ```
   DATABASE_URL=postgresql://neondb_owner:npg_G9fN4baVTvsw@ep-empty-cherry-a7czm05z-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require
   ```

   > **What is `.dev.vars`?** This is Cloudflare Workers' local environment file (like `.env` for Node.js). It stores secrets that should NOT be committed to git in a real production project. We've included it here for learning purposes.

3. **Run database migrations** (creates all the tables in PostgreSQL)
   ```bash
   DATABASE_URL="postgresql://neondb_owner:npg_G9fN4baVTvsw@ep-empty-cherry-a7czm05z-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require" npm run db:migrate
   ```

   > **What are migrations?** SQL files that create/modify database tables. Drizzle Kit generates them from your TypeScript schema (`backend/src/db/schema.ts`). This ensures your database structure matches your code.

4. **Start the backend dev server**
   ```bash
   npm run dev
   ```
   Backend runs on `http://localhost:8787`. This uses `wrangler dev` which simulates Cloudflare Workers locally.

5. **Set up the frontend** (open a new terminal tab)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Frontend runs on `http://localhost:5173` and automatically proxies all `/api` requests to `http://localhost:8787` (configured in `vite.config.ts`).

6. **Open in browser** — navigate to `http://localhost:5173`

## How the Code Works

### Authentication Flow

```
1. User fills in signup/login form (frontend/src/pages/LoginPage.tsx)
2. Frontend calls POST /api/auth/signup or /api/auth/login
3. Backend validates input, hashes password with PBKDF2, creates user in DB
4. Backend generates a 64-character random token, stores it in sessions table
5. Backend returns { token, user } to frontend
6. Frontend stores token in localStorage (frontend/src/context/AuthContext.tsx)
7. Every subsequent API request includes: Authorization: Bearer <token>
8. Backend middleware (backend/src/middleware/auth.ts) validates token on each request
```

### How API Requests Work

The frontend uses a helper function `apiFetch()` in `frontend/src/lib/api.ts`:

```typescript
// This automatically:
// 1. Prepends the API base URL
// 2. Attaches the Bearer token from localStorage
// 3. Sets Content-Type: application/json for POST/PUT
// 4. Redirects to /login on 401 (expired session)
const data = await apiFetch<{ messages: ChatMessage[] }>("/api/chat/english");
```

### How the Database Connects

```
Frontend (React on nodent.pages.dev)
    → fetch("/api/chat/english")         // Same-origin request
    → Pages Function (Hono in pages-deploy/functions/api/[[path]].ts)
        → createDb(env.DATABASE_URL)     // Creates Neon serverless connection
        → db.select().from(chatMessages) // Drizzle ORM query
        → Neon PostgreSQL (ap-southeast-2, AWS Sydney)
    → Returns JSON response
    → Frontend renders the data
```

### How Routing Works

**Backend routing** (`backend/src/index.ts`):
```typescript
app.route("/api/auth", auth);       // Signup, login, logout
app.route("/api/quiz", quiz);       // Quiz submission
app.route("/api/chat", chat);       // Chat messages
// Each route group is a separate file in backend/src/routes/
```

**Frontend routing** (`frontend/src/App.tsx`):
```typescript
<Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
<Route path="/quiz/:subjectId" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
// ProtectedRoute redirects to /login if not authenticated
// :subjectId is a URL parameter (e.g., /quiz/english, /quiz/chemistry)
```

### How State is Managed

- **Auth state**: React Context (`AuthContext.tsx`) + localStorage for persistence across page reloads
- **Quiz progress**: localStorage per user per subject (so you can resume where you left off)
- **Study timer**: localStorage per user per day (daily stats reset each day)
- **Subject selection**: localStorage per user (your "My Subjects" list)
- **Server data** (messages, comments, stats): fetched fresh from the API on each page load

## API Endpoints Reference

All endpoints are under `/api/`. Authentication uses Bearer token in the `Authorization` header.

### Authentication
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | None | Create account. Body: `{ username, email, password }` |
| POST | `/api/auth/login` | None | Login. Body: `{ email, password }`. Returns `{ token, user }` |
| POST | `/api/auth/logout` | Bearer | Destroy session. Deletes the token from the database. |

### Bootstrap
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/bootstrap` | Bearer | Validate token, returns `{ user, customQuestions }` |

### Quiz
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/quiz/submit` | Bearer | Record quiz score. Body: `{ subjectId, score, totalQuestions }` |

### Leaderboard
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/leaderboard/:subjectId` | None | Top 10 scorers. Returns `{ leaderboard: [...] }` |

### Competition
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/competition/answer` | Bearer | Record answer. Body: `{ subjectId, questionKey, topic, isCorrect }` |
| GET | `/api/competition/:subjectId/stats` | Bearer | Returns `{ rank, percentile, leaderboard, topicStats, questionStats }` |

### Comments
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/comments/:subjectId/:questionKey` | Bearer | Get threaded comments for a question |
| POST | `/api/comments/:subjectId/:questionKey` | Bearer | Post comment. Body: `{ text, parentCommentId? }` |

### Written Responses
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/written/:subjectId/:questionKey` | Bearer | Get your saved response |
| PUT | `/api/written/:subjectId/:questionKey` | Bearer | Save/update. Body: `{ responseText }` |
| GET | `/api/written/:subjectId/:questionKey/all` | Bearer | View all student responses (anonymized) |

### Chat
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/chat/:subjectId` | Bearer | Get last 200 messages |
| POST | `/api/chat/:subjectId` | Bearer | Send message. Body: `{ text }` |

### Admin (requires `x-admin-key` header)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/questions` | Admin Key | Get all custom questions grouped by subject |
| POST | `/api/admin/questions` | Admin Key | Create question. Body: `{ subjectId, type, question, options?, answer?, ... }` |
| DELETE | `/api/admin/questions/:id` | Admin Key | Delete a custom question |

### Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | None | Returns `{ ok, users, sessions, chats, comments }` |

## Database Schema

The PostgreSQL database (hosted on [Neon](https://neon.tech)) has 8 tables. The schema is defined in TypeScript at `backend/src/db/schema.ts` and compiled to SQL migrations in `backend/drizzle/migrations/`.

### Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **users** | User accounts | id, username, email, password_hash, password_salt |
| **sessions** | Login sessions (30-day TTL) | token (PK), user_id (FK), expires_at |
| **quiz_attempts** | Quiz score records | user_id, subject_id, score, percent |
| **question_attempts** | Per-question competition results | user_id, subject_id, question_key, is_correct |
| **written_responses** | Long-form written answers | user_id, subject_id, question_key, response_text |
| **quiz_comments** | Threaded comments on questions | user_id, subject_id, question_key, parent_comment_id |
| **custom_questions** | Admin-created questions | subject_id, type, question, options, answer |
| **chat_messages** | Subject discussion messages | subject_id, user_id, username, text |

### Relationships
- All tables reference `users.id` with `ON DELETE CASCADE` (deleting a user deletes all their data)
- `quiz_comments` has a self-referencing `parent_comment_id` for nested replies
- `question_attempts` has a unique constraint on `(user_id, subject_id, question_key)` — one attempt per question per user (upsert)

## Key Configuration Files

### `backend/wrangler.toml` — Cloudflare Workers Configuration
```toml
name = "nodent-api"                           # Worker name (becomes the URL slug)
main = "src/index.ts"                         # Entry point
compatibility_date = "2024-12-01"             # Cloudflare API version
compatibility_flags = ["nodejs_compat"]       # Enables Node.js APIs (crypto, etc.)
account_id = "d7dc5ee8b666f8267eba35bca09bcfba"  # Your Cloudflare account

[vars]
ADMIN_KEY = "nodent-admin-2025"               # Admin password for question management
FRONTEND_URL = "https://nodent.pages.dev"     # Allowed CORS origin
```

### `backend/.dev.vars` — Local Development Secrets
```
DATABASE_URL=postgresql://neondb_owner:npg_G9fN4baVTvsw@ep-empty-cherry-a7czm05z-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require
```
> This is the Neon PostgreSQL connection string. In production, this is set as a Cloudflare secret (not in the file).

### `backend/drizzle.config.ts` — Database Migration Tool Config
```typescript
export default defineConfig({
  schema: "./src/db/schema.ts",     // Where your table definitions live
  out: "./drizzle/migrations",      // Where SQL migration files are generated
  dialect: "postgresql",            // Database type
  dbCredentials: {
    url: process.env.DATABASE_URL!, // Connection string from environment
  },
});
```

### `frontend/vite.config.ts` — Frontend Build Configuration
```typescript
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },  // @ = src/ folder
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",  // Proxy API calls to backend in dev
        changeOrigin: true,
      },
    },
  },
});
```

### `frontend/components.json` — ShadCN UI Configuration
```json
{
  "style": "base-nova",        // ShadCN component style variant
  "rsc": false,                // Not using React Server Components
  "tsx": true,                 // Using TypeScript + JSX
  "tailwind": {
    "css": "src/index.css",    // Main CSS file
    "baseColor": "neutral",    // Base color palette
    "cssVariables": true       // Use CSS variables for theming
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

### `.mcp.json` — ShadCN MCP Server (for AI-assisted development)
```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    }
  }
}
```

## Deployment Guide

### Cloudflare Account Setup
1. Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com)
2. Go to **Profile > API Tokens > Create Token**
3. Create a custom token with:
   - Cloudflare Workers Scripts: Edit
   - Cloudflare Pages: Edit
   - Account Settings: Read
4. Copy the token and your Account ID (found on Workers & Pages overview)

### Deploy (Single Command — Frontend + API Together)

Both the frontend and API are deployed together via Cloudflare Pages. The API runs as a [Pages Function](https://developers.cloudflare.com/pages/functions/) at `/api/*`:

```bash
# 1. Build the frontend (empty VITE_API_URL = same-origin, API is on same domain)
cd frontend
VITE_API_URL="" npm run build

# 2. Copy build output into pages-deploy
cp -r dist/* ../pages-deploy/
cp public/_redirects ../pages-deploy/

# 3. Install Pages Function dependencies
cd ../pages-deploy
npm install

# 4. Deploy everything to Cloudflare Pages
export CLOUDFLARE_API_TOKEN="your-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
npx wrangler pages deploy . --project-name nodent --branch main --commit-dirty=true
```

### Set Environment Variables (first time only)

After the first deploy, set environment variables in the Cloudflare dashboard:
1. Go to **Workers & Pages > nodent > Settings > Environment variables**
2. Add for **Production**:
   - `DATABASE_URL` = your Neon PostgreSQL connection string (mark as encrypted)
   - `ADMIN_KEY` = `nodent-admin-2025`
   - `FRONTEND_URL` = `https://nodent.pages.dev`
3. Redeploy after setting variables

> **Why `VITE_API_URL=""`?** The API runs as a Pages Function on the same domain (`nodent.pages.dev/api/*`), so the frontend uses same-origin requests — `fetch("/api/health")` just works. No cross-origin issues.

### Alternative: Separate Workers Deployment

The backend can also run as a standalone Cloudflare Worker if you want independent scaling:

```bash
cd backend
export CLOUDFLARE_API_TOKEN="your-token"
npx wrangler deploy
echo "your-neon-url" | npx wrangler secret put DATABASE_URL
```

Then rebuild the frontend pointing to the Worker URL:
```bash
VITE_API_URL="https://nodent-api.your-subdomain.workers.dev" npm run build
```

## Design System

The frontend uses a "Midnight Scholar" design language:

| Element | Value | Purpose |
|---------|-------|---------|
| **Sidebar** | `#0f172a` (deep navy) | Dark navigation panel |
| **Background** | `#faf8f5` (warm cream) | Comfortable reading surface |
| **Primary** | `#10b981` (emerald green) | Buttons, active states, success |
| **Secondary** | `#f59e0b` (gold) | Highlights, warnings, badges |
| **Danger** | `#ef4444` (red) | Errors, incorrect answers |
| **Cards** | `rgba(255,255,255,0.72)` + blur | Glassmorphic with grain texture |
| **Display Font** | DM Serif Display | Headings (scholarly, distinctive) |
| **Body Font** | DM Sans | Body text (clean, readable) |

### CSS Architecture
- Theme variables defined in `frontend/src/index.css` using CSS custom properties
- ShadCN components read these variables (e.g., `--primary`, `--background`)
- Custom classes: `.paper-texture` (glassmorphic cards), `.gradient-bg` (auth page), `.grain-texture` (subtle noise)
- Animations: `.animate-fade-in-up`, `.stagger-children`, `.orb-float-slow`

## Security Notes

| Feature | Implementation | File |
|---------|---------------|------|
| Password hashing | PBKDF2 (100,000 iterations, SHA-256, 512-bit) | `backend/src/lib/password.ts` |
| Timing attack prevention | Constant-time comparison | `backend/src/lib/password.ts` |
| Session tokens | 32 random bytes (crypto.getRandomValues) | `backend/src/lib/token.ts` |
| Session expiry | 30-day TTL, checked on every request | `backend/src/middleware/auth.ts` |
| CORS | Restricted to configured frontend URL | `backend/src/index.ts` |
| Input sanitization | Null-byte stripping + length limits | `backend/src/lib/utils.ts` |
| Admin auth | Separate `x-admin-key` header | `backend/src/middleware/admin.ts` |
| XSS protection | React's built-in JSX escaping | All frontend components |
| Auto-logout | Frontend clears token on 401 response | `frontend/src/lib/api.ts` |

## Project Structure

```
backend/
├── src/
│   ├── index.ts              # Hono app entry, CORS config, route mounting
│   ├── types.ts              # TypeScript types (Bindings, Variables, AuthUser)
│   ├── db/
│   │   ├── client.ts         # Creates Neon database connection from URL
│   │   └── schema.ts         # All 8 table definitions using Drizzle ORM
│   ├── lib/
│   │   ├── password.ts       # PBKDF2 password hashing & verification
│   │   ├── token.ts          # Random session token generation
│   │   └── utils.ts          # cleanText() sanitizer, nowIso() helper
│   ├── middleware/
│   │   ├── auth.ts           # Validates Bearer token, attaches user to context
│   │   └── admin.ts          # Validates x-admin-key header
│   └── routes/
│       ├── auth.ts           # POST signup/login/logout handlers
│       ├── bootstrap.ts      # GET validate token + fetch custom questions
│       ├── quiz.ts           # POST record quiz score
│       ├── leaderboard.ts    # GET top 10 scores per subject
│       ├── competition.ts    # POST answer + GET full competition stats
│       ├── comments.ts       # GET/POST threaded comments
│       ├── written.ts        # GET/PUT written responses + GET all responses
│       ├── chat.ts           # GET/POST chat messages
│       ├── admin.ts          # GET/POST/DELETE custom questions
│       └── health.ts         # GET database health check
├── drizzle/
│   └── migrations/           # Auto-generated SQL migration files
│       └── 0000_*.sql        # Initial schema creation
├── .dev.vars                 # Local secrets (DATABASE_URL)
├── wrangler.toml             # Cloudflare Workers deployment config
├── drizzle.config.ts         # Drizzle Kit migration tool config
├── tsconfig.json             # TypeScript compiler config
└── package.json              # Dependencies and scripts

frontend/
├── src/
│   ├── main.tsx              # React entry point — renders <App> into #root
│   ├── App.tsx               # All routes + ProtectedRoute + GuestRoute guards
│   ├── index.css             # Tailwind theme, custom properties, animations
│   ├── context/
│   │   └── AuthContext.tsx    # React Context for auth state (login/signup/logout)
│   ├── lib/
│   │   ├── api.ts            # apiFetch() wrapper — auto-attaches auth token
│   │   ├── constants.ts      # localStorage keys and API path helpers
│   │   ├── subjects.ts       # 27 VCE subject definitions with quiz questions
│   │   └── utils.ts          # cn(), normalizeAnswer(), formatSeconds(), etc.
│   ├── hooks/
│   │   ├── useApi.ts         # Generic loading/error state for API calls
│   │   ├── useInactivity.ts  # Detects 10 minutes of no mouse/keyboard activity
│   │   ├── useLocalStorage.ts # Type-safe localStorage with cross-tab sync
│   │   ├── useStudyTimer.ts  # Pomodoro timer with persistence
│   │   ├── useSubjects.ts    # Fetches subjects from bootstrap API
│   │   └── use-mobile.ts     # Returns true when viewport < 768px
│   ├── pages/
│   │   ├── LoginPage.tsx     # Sign in / sign up tabs with validation
│   │   ├── DashboardPage.tsx # Stats cards, subject grid, add/remove subjects
│   │   ├── QuizPage.tsx      # Question display, navigation, progress, comments
│   │   ├── SummaryPage.tsx   # Score hero, rank cards, leaderboard, topic breakdown
│   │   ├── StudyModePage.tsx  # Dark study UI with timer + question navigation
│   │   ├── TrackStudyPage.tsx # Pomodoro timer + daily progress stats
│   │   ├── ChatPage.tsx      # Message bubbles, auto-scroll, 8s polling
│   │   └── AdminPage.tsx     # Create/delete custom questions per subject
│   └── components/
│       ├── layout/
│       │   ├── AppShell.tsx   # Sidebar + header + scrollable content wrapper
│       │   ├── Sidebar.tsx    # Dark nav with logo, links, user card, logout
│       │   ├── AuthLayout.tsx # Split layout: brand hero (left) + form (right)
│       │   └── Topbar.tsx     # Page title header with user avatar
│       ├── quiz/
│       │   ├── McqQuestion.tsx     # 4-option multiple choice with A/B/C/D badges
│       │   ├── ShortQuestion.tsx   # Text input with accepted-answer matching
│       │   ├── LongQuestion.tsx    # Textarea + save + view other responses
│       │   ├── QuizProgress.tsx    # Progress bar (X of Y questions)
│       │   └── CommentThread.tsx   # Nested comments with reply functionality
│       ├── study/
│       │   ├── ProgressRing.tsx    # SVG circular progress indicator
│       │   ├── StudyTimer.tsx      # Standalone Pomodoro timer component
│       │   └── DailyStats.tsx      # Time studied, sessions, goal progress card
│       └── ui/                     # 35+ ShadCN UI components (button, card, etc.)
├── public/
│   ├── logo.png              # Nodent logo
│   └── _redirects            # SPA routing rule for Cloudflare Pages
├── index.html                # HTML entry point (loads Google Fonts + React)
├── vite.config.ts            # Vite build config with proxy + Tailwind plugin
├── components.json           # ShadCN UI configuration
├── tsconfig.json             # TypeScript config
└── package.json              # Dependencies and scripts
```

## Useful Commands

```bash
# Backend (local development)
cd backend
npm run dev              # Start local dev server (port 8787)
npm run db:generate      # Generate new migration from schema changes
npm run db:migrate       # Apply pending migrations to database

# Frontend (local development)
cd frontend
npm run dev              # Start local dev server (port 5173, proxies /api to :8787)
npm run build            # TypeScript check + production build
npm run preview          # Preview production build locally

# Production deployment (frontend + API together)
cd frontend && VITE_API_URL="" npm run build
cp -r dist/* ../pages-deploy/ && cp public/_redirects ../pages-deploy/
cd ../pages-deploy && npm install
CLOUDFLARE_API_TOKEN="your-token" CLOUDFLARE_ACCOUNT_ID="your-id" \
  npx wrangler pages deploy . --project-name nodent --branch main --commit-dirty=true
```

## License

ISC
