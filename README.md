# Nodent — VCE Study Platform

A full-stack study platform for VCE (Victorian Certificate of Education) students featuring quizzes, practice sessions, study tracking, collaborative chat, Dojo battles, competitive leaderboards, Friends & assignments, and an admin panel for custom question management.

**Live:** [https://nodent.pages.dev](https://nodent.pages.dev)

---

## Architecture Overview

Everything lives in a **single Cloudflare Pages project** — the frontend and API are deployed together with no separate servers to manage.

```
Nodent.web/
├── functions/
│   └── api/
│       └── [[path]].ts      # Hono backend as a Pages Function (catch-all route)
├── frontend/                 # React 19 SPA (Vite + Tailwind CSS v4 + ShadCN UI)
│   ├── src/
│   │   ├── pages/           # 10+ page components
│   │   ├── components/      # Layout, quiz, study, UI components
│   │   ├── lib/             # API client, subjects, utilities, question data
│   │   └── context/         # Auth state management
│   └── public/              # Static assets (logo, _redirects)
├── assets/                  # Built frontend output (deployed to Cloudflare)
├── index.html               # Root HTML entry (also built output)
├── wrangler.toml            # Cloudflare Pages deployment config
└── package.json             # Root scripts (build, deploy, dev)
```

**Key principle:** The API runs as a [Cloudflare Pages Function](https://developers.cloudflare.com/pages/functions/) — a serverless function bundled alongside the static frontend on the same domain. No separate Workers deployment, no CORS headaches. Frontend makes same-origin `fetch("/api/...")` requests.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19, TypeScript, Vite | Modern UI framework with fast builds |
| **UI** | Tailwind CSS v4, ShadCN UI | Utility-first CSS + accessible pre-built components |
| **Backend** | Hono (Cloudflare Pages Functions) | Lightweight edge API — like Express, zero servers |
| **Database** | PostgreSQL (Neon Serverless) | Industry-standard relational DB, auto-scaling |
| **ORM** | Drizzle ORM | Type-safe SQL queries with auto-generated migrations |
| **Hosting** | Cloudflare Pages | Free tier: 100k requests/day, global CDN, single domain |
| **Fonts** | DM Serif Display + DM Sans | Scholarly serif headings + clean sans-serif body |

---

## Features

### For Students
- **27 VCE Subjects** — embedded quiz questions (MCQ, short answer, written response)
- **Practice Mode** — answer questions with instant feedback, progress tracking, auto-save
- **Study Mode** — timed sessions with Pomodoro timer, question navigation, daily goals
- **English Practice** — AI-scored written responses with stimulus passages and ratings
- **Maths Methods** — VCAA study design topic overviews with KaTeX rendering
- **Dojo Battles** — head-to-head competition on subjects
- **Friends & Assignments** — add friends, assign questions, track marks
- **Competition Stats** — percentile rankings, leaderboards, per-topic performance
- **Subject Chat** — real-time discussion boards per subject
- **Question Comments** — threaded discussion on individual quiz questions
- **Study Tracker** — daily Pomodoro timer with goal setting, heatmap, and progress visualization

### For Admins
- **Custom Question Management** — add/delete MCQ, short answer, and long-form questions per subject
- **Admin Key Authentication** — separate admin access via secret key header
- **Google Sheets Sync** — sync question banks from Google Sheets
- **Topic Retagging** — reassign questions to correct VCAA topics

### Technical Highlights
- **Auto-creating database** — all 17 tables created on first API request, no manual setup
- **"Remember Me"** — 30-day session with checkbox, 1-day without
- **PBKDF2 password hashing** — 100K iterations, per-user salt, timing-safe comparison
- **Session health monitoring** — `GET /api/health` returns live DB status

---

## Getting Started

### Prerequisites
- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **npm** — comes with Node.js

### Local Development

1. **Clone the repo**
   ```bash
   git clone git@github.com:Umar99026/Nodent.web.git
   cd Nodent.web
   ```

2. **Install dependencies**
   ```bash
   # Root (Pages Function deps)
   npm install
   # Frontend
   cd frontend && npm install && cd ..
   ```

3. **Set up environment variables**
   
   Create `frontend/.env.local`:
   ```
   VITE_API_URL=/api
   ```
   
   For database access locally, create a `.dev.vars` file in the project root with your Neon connection string:
   ```
   DATABASE_URL=postgresql://neondb_owner:***@ep-empty-cherry-a7czm05z-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require
   FRONTEND_URL=http://localhost:5173
   ```
   
   Optional — send password reset emails via [Resend](https://resend.com):
   ```
   RESEND_API_KEY=re_...
   EMAIL_FROM=Nodent <onboarding@resend.dev>
   ```
   Without `RESEND_API_KEY`, local dev logs the reset link in the Wrangler terminal instead.

4. **Run both frontend + API**
   ```bash
   # Terminal 1: Start the API (Cloudflare Pages Function locally)
   npx wrangler pages dev . --port 8787
   
   # Terminal 2: Start the frontend
   cd frontend && npx vite
   ```

   The frontend runs on `http://localhost:5173` and proxies `/api` requests to the Wrangler dev server.

---

## API Endpoints Reference

All endpoints under `/api/`. Authentication via Bearer token in `Authorization` header. Admin endpoints require `x-admin-key` header.

### Authentication
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | None | Create account. Body: `{ username, email, password }` |
| POST | `/api/auth/login` | None | Login. Body: `{ email, password, rememberMe? }`. Returns `{ token, user }` |
| POST | `/api/auth/forgot-password` | None | Request reset email. Body: `{ email }` |
| POST | `/api/auth/reset-password` | None | Set new password. Body: `{ token, password }` |
| POST | `/api/auth/logout` | Bearer | Destroy session |

### Bootstrap
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/bootstrap` | Bearer | Validate token, returns `{ user, customQuestions }` |

### Quiz & Practice
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/quiz/submit` | Bearer | Record quiz score. Body: `{ subjectId, score, totalQuestions }` |
| GET | `/api/practice/:subjectId/questions` | Bearer | Get practice questions |
| POST | `/api/practice/:subjectId/answer` | Bearer | Record practice answer |

### Leaderboard
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/leaderboard/:subjectId` | None | Top 10 scorers |

### Competition
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/competition/answer` | Bearer | Record answer. Body: `{ subjectId, questionKey, topic, isCorrect }` |
| GET | `/api/competition/:subjectId/stats` | Bearer | Returns `{ rank, percentile, leaderboard, topicStats }` |

### English Practice
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/english/:subjectId/prompts` | Bearer | Get English essay prompts |
| POST | `/api/english/:subjectId/respond` | Bearer | Submit English response |
| GET | `/api/english/:subjectId/responses` | Bearer | View your English responses |

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

### Friends & Assignments
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/friends` | Bearer | List your friends |
| POST | `/api/friends/request` | Bearer | Send friend request |
| GET | `/api/assignments` | Bearer | Get your assignments |
| POST | `/api/assignments` | Bearer | Assign questions to a friend |

### Dojo Battles
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dojo/battles` | Bearer | List your battles |
| POST | `/api/dojo/battle` | Bearer | Start/join a battle |

### Admin (requires `x-admin-key` header)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/questions` | Admin Key | Get all custom questions grouped by subject |
| POST | `/api/admin/questions` | Admin Key | Create question. Body: `{ subjectId, type, question, options?, answer?, topic? }` |
| DELETE | `/api/admin/questions/:id` | Admin Key | Delete a custom question |
| POST | `/api/admin/questions/sync-from-sheet` | Admin Key | Sync questions from Google Sheets |

### Study Tracking
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/study/today` | Bearer | Get today's study stats |
| POST | `/api/study/sync` | Bearer | Sync study session. Body: `{ subjectId, seconds, bySubject }` |
| GET | `/api/study/history` | Bearer | Get historical study data |

### Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | None | Returns `{ ok, users, sessions }` |

---

## Database Schema

Hosted on [Neon Serverless PostgreSQL](https://neon.tech). 17 tables defined in the Pages Function (auto-created on first request). Core tables:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **users** | User accounts | id, username, email, password_hash, password_salt |
| **sessions** | Login sessions | token (PK), user_id (FK), expires_at |
| **quiz_attempts** | Quiz scores | user_id, subject_id, score, percent |
| **question_attempts** | Per-question competition results | user_id, subject_id, question_key, is_correct |
| **written_responses** | Long-form written answers | user_id, subject_id, question_key, response_text |
| **quiz_comments** | Threaded comments on questions | user_id, subject_id, question_key, parent_comment_id |
| **custom_questions** | Admin-created questions | subject_id, type, question, options, answer, topic |
| **chat_messages** | Subject chat history | subject_id, user_id, username, text |
| **friends** | User friendships | user_id, friend_id, status |
| **friend_assignments** | Peer-to-peer question assignments | user_id, friend_id, subject_id, question_key, marks |
| **dojo_battles** | Head-to-head battles | user_id, opponent_id, subject_id, score, result |
| **practice_questions** | Practice mode questions | subject_id, question_key, stimulus_group_id |
| **english_prompts** | English essay prompts | subject_id, prompt_id, title, passage |
| **english_responses** | English practice responses | user_id, prompt_id, response_text, rating |
| **study_days** | Daily study tracking | user_id, date, daily_seconds, daily_seconds_by_subject |

All tables reference `users.id` with `ON DELETE CASCADE`.

---

## Deployment

### Deploy to Cloudflare Pages

```bash
# 1. Build the frontend
cd frontend && npm run build && cd ..

# 2. Deploy everything (frontend + API) to Cloudflare Pages
export CLOUDFLARE_API_TOKEN="your-api-token"
npx wrangler pages deploy . --branch main --project-name nodent
```

### Environment Variables (set in Cloudflare Dashboard)

After first deploy, go to **Workers & Pages → nodent → Settings → Environment variables** and add for Production:

| Variable | Description | Secret? |
|----------|-------------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string | ✅ Yes |
| `ADMIN_KEY` | Admin panel secret key | ✅ Yes |
| `FRONTEND_URL` | e.g. `https://nodent.pages.dev` | No |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | For Google Sheets question sync | No |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google service account key | ✅ Yes |

---

## Design System

**"Midnight Scholar"** — scholarly dark sidebar + warm cream reading surface:

| Element | Value | Purpose |
|---------|-------|---------|
| **Sidebar** | `#0f172a` (deep navy) | Navigation panel |
| **Background** | `#faf8f5` (warm cream) | Reading surface |
| **Primary** | `#10b981` (emerald) | Buttons, active states |
| **Secondary** | `#f59e0b` (gold) | Highlights, badges |
| **Display Font** | DM Serif Display | Headings (scholarly feel) |
| **Body Font** | DM Sans | Body text (clean readability) |

---

## Key Commands

```bash
# Local development
cd frontend && npx vite         # Frontend on :5173
npx wrangler pages dev . --port 8787  # API on :8787

# Build frontend
cd frontend && npm run build

# Deploy everything
npx wrangler pages deploy . --branch main
```

---

## Security

| Feature | Implementation |
|---------|---------------|
| Password hashing | PBKDF2 (100K iterations, SHA-256, per-user 512-bit salt) |
| Session tokens | 32 random bytes from `crypto.getRandomValues()` |
| Session expiry | 30 days (with "remember me"), 1 day (without) |
| CORS | Restricted to frontend URL |
| Admin auth | Separate `x-admin-key` header |
| XSS protection | React's built-in JSX escaping |
| Input sanitization | Null-byte stripping + length limits |

---

## Changelog Highlights

- **Latest:** Single Cloudflare Pages Function backend — removed 29K lines of legacy code (old Express/SQLite server, separate Worker backend, pages-deploy bundle). Now one `wrangler.toml`, one deploy command.
- English practice with AI ratings and prompt response workflow
- Maths Methods VCAA topic overviews with KaTeX rendering
- Practice mode with stimulus groups, images, and competition tracking
- Dojo battles, Friends, and peer Assignments
- Google Sheets sync for question banks
- Auto-creating database tables on first request
- Study heatmap, scorecards, and daily goals

---

## License

ISC
