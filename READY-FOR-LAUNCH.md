# Nodent — What I Fixed + What You Need to Do

Yo! Ice had me go through your project and fix everything that could make it crash or lose user data. Here's the full breakdown.

---

## 🐛 Bugs I Fixed (Already Pushed)

### 1. User info kept resetting when you logged in

**The problem:** Every time `apiFetch()` got a 401 response (even from a slow network), it would immediately delete the stored token from localStorage and redirect you to `/login`. So if `/api/bootstrap` timed out for a second, boom — logged out, user data gone.

**What I did:** Changed `apiFetch()` to throw a proper error instead of auto-destroying your session. The `AuthContext` already handles session expiry gracefully — it shows "Session expired" if the token is actually invalid, but now it won't nuke everything on a hiccup.

→ **File:** `frontend/src/lib/api.ts`

---

### 2. "Remember me" checkbox did nothing

**The problem:** The checkbox was there on the login page, saved to localStorage, but the backend always created 30-day sessions regardless. Unchecking it changed nothing.

**What I did:**
- Backend (`server.js` + Cloudflare Function) now reads `rememberMe` from the request body
- 30 days when checked, 1 day when unchecked
- Frontend `AuthContext` reads the value from localStorage before sending

Now: ✅ Checked → stays logged in for a month. Unchecked → session expires in 1 day.

→ **Files:** `server.js`, `frontend/src/context/AuthContext.tsx`, `pages-deploy/functions/api/[[path]].ts`

---

### 3. Study tracking wouldn't work if backend was changed

**The problem:** The dev backend (`server.js`) called the study table `user_study_daily` with columns like `total_seconds` and `by_subject_json`. The production backend (Cloudflare/Neon) called it `study_days` with `daily_seconds` and `daily_seconds_by_subject`. If you switched from one backend to the other, study tracking would silently break.

**What I did:** Standardized everything to `study_days` with the column names from the Neon schema. All the SQL queries and helper functions now use the same names across both backends.

→ **File:** `server.js` (7 query locations updated)

---

### 4. Missing column in friend_assignments (SQLite)

**The problem:** The Neon/Cloudflare schema had `marks INTEGER DEFAULT 1` on `friend_assignments`, but the SQLite backend never added that column. Any friend assignment in local dev would error.

**What I did:** Added auto-migration to add `marks` and `is_correct` columns to the SQLite `friend_assignments` table.

→ **File:** `server.js`

---

### 5. No health check on the production backend

**The problem:** `server.js` had `GET /api/health` (returns user count, session count, etc.), but the Cloudflare Pages Function didn't. No way to monitor if production was alive.

**What I did:** Added `GET /api/health` to the Cloudflare backend. Returns `{"ok": true, "users": N}` on success, or `{"ok": false, "error": "..."}` if the DB is down.

→ **File:** `pages-deploy/functions/api/[[path]].ts`

---

## ✅ What I Tested (Everything Passed)

| Test | Result |
|---|---|
| Signup → session created | ✅ |
| Bootstrap → user data returned | ✅ |
| Logout → session deleted | ✅ |
| Re-login → same user id preserved | ✅ |
| "Remember me" false → shorter expiry | ✅ |
| Study tracking sync (study_days) | ✅ |
| Study tracking history query | ✅ |
| TypeScript compiles | ✅ |
| Backend stays up through all tests | ✅ |

---

## 📋 What You Still Need to Do (UPDATED)

### Before launching to students:

1. **Deploy to Cloudflare Pages** ⚠️ Requires your Cloudflare API token
   ```bash
   # Set your API token (get it from https://dash.cloudflare.com/profile/api-tokens)
   export CLOUDFLARE_API_TOKEN="your-token-here"

   npm run deploy
   ```
   Or manually:
   ```bash
   npm run build
   npx wrangler pages deploy . --branch main --project-name nodent
   ```
   If you haven't created the Pages project yet:
   ```bash
   npx wrangler pages project create nodent --production-branch main
   ```
   Then set these environment variables in the Cloudflare Dashboard (Pages → nodent → Settings → Environment variables):
   - `DATABASE_URL` — your Neon connection string (mark as **Secret**)
   - `ADMIN_KEY` — admin key for the admin panel (mark as **Secret**)
   - `FRONTEND_URL` — your Pages URL, e.g. `https://nodent.pages.dev`
   - `GOOGLE_SHEETS_SPREADSHEET_ID` — (optional, for sheet sync)
   - `GOOGLE_SERVICE_ACCOUNT_JSON` — (optional, mark as **Secret**)

2. **Done automatically now:** ✅ All 17 database tables are auto-created on the first API request. No manual Neon SQL editor needed.

3. **Test the live site end-to-end**
   Once deployed, do this before students touch it:
   - Sign up as a new user
   - Log out, close browser, log back in (check "remember me" works)
   - Try a quiz, check the forum, try friends
   - Check `/api/health` returns `{"ok": true, "users": N}`

4. **Seed real questions**
   Empty subjects = students leave instantly. Use the Google Sheets sync pipeline (`/api/admin/questions/sync-from-sheet`) to load at least 50 questions per subject.

5. **Soft launch with 5-10 friends first**
   Don't blast it to a whole year level on day one. Watch the Cloudflare Functions logs for errors for a couple of days, then scale.

6. **Rotate the admin password (when you're ready)**
   It's in the repo currently. Set `ADMIN_PASSWORD` as a Cloudflare Pages environment variable (secret) instead.

---

## 🔧 Quick Tech Notes

- **One backend:** Cloudflare Pages Functions (`functions/api/[[path]].ts`) with Hono + Drizzle ORM + Neon PostgreSQL. No more dual-backend drift.
- **Auth flow:** PBKDF2 hashing with per-user random salt. Session tokens are 32-byte hex. 30-day expiry with "remember me", 1-day without.
- **Health check:** `GET /api/health` 
- **Local dev:** `npm run dev:all` (Vite on :5173 + Wrangler on :8787). Point Vite proxy at :8787 for API calls.

Any questions, ask Ice to ask me. Good luck with the launch! 🚀
