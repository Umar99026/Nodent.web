# Production launch checklist

## Cloudflare Pages env (Production)

| Variable | Secret? | Notes |
|----------|---------|--------|
| `DATABASE_URL` | Yes | Neon **pooler** URL (`-pooler` host) |
| `ADMIN_KEY` | Yes | Long random string; never commit |
| `FRONTEND_URL` | No | e.g. `https://nodent.pages.dev` |
| `RESEND_API_KEY` | Yes | Password reset emails |
| `EMAIL_FROM` | No | Verified sender in Resend |

## Before students use it

1. `npm run deploy`
2. `node scripts/smoke-test.mjs https://YOUR-SITE.pages.dev`
3. Sign up on live site → quiz → logout → login
4. Add a test question in **Admin** → confirm it appears under **Practice → Questions**
5. Soft launch with 5–10 users; watch Cloudflare **Functions** logs

## Security (implemented in app)

- Password minimum **8** characters
- Rate limits on signup / login / forgot-password (per IP, per edge)
- CORS restricted to localhost, `*.pages.dev`, and `FRONTEND_URL`
- `.dev.vars` gitignored — rotate secrets if ever committed

## Recommended (Cloudflare dashboard)

- Enable **Bot Fight Mode** or WAF rate limiting on `/api/auth/*`
- Uptime monitor on `GET /api/health`
- Neon paid tier if you exceed free connection/compute limits

## Adding content at scale

See [docs/QUESTIONS_PIPELINE.md](docs/QUESTIONS_PIPELINE.md).
