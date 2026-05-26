# Question bank pipeline

All **maths practice / quiz** questions for students come from one global table: `custom_questions` in Neon Postgres.

## Flow

```
Admin UI (or scripts/admin-add-questions.mjs)
    → POST /api/admin/questions  (single)
    → POST /api/admin/questions/bulk  (many)
    → Neon `custom_questions`
    → GET /api/bootstrap  (any logged-in user)
    → localStorage `nodent_custom_questions`
    → practiceQuestionsForSubject()  (built-ins + admin, deduped)
    → Practice setup / Quiz / Study / Dojo
```

**English prompts** use separate tables (`english_books`, `english_prompts`) and the English practice page — not `custom_questions`.

## Adding questions (you or the AI assistant)

1. **Admin panel** — `/admin` → fill form → **Add question** (saves to DB and refreshes the student cache).
2. **Bulk TSV** — Admin → bulk import (uses `/api/admin/questions/bulk`).
3. **Script** (for automation / Cursor):

```bash
ADMIN_KEY=your-secret node scripts/admin-add-questions.mjs my-questions.json https://your-site.pages.dev
```

When you ask the assistant to “create questions”, it should produce JSON in the shape above and import via **admin API**, not only edit frontend built-in files.

## Subject ids

Use canonical ids: `methods`, `general-maths`, `specialist-maths`, `english` (English uses prompts API, not this table).

## Types

| Admin `type`   | Quiz `type` |
|----------------|-------------|
| `mcq`          | `mcq`       |
| `short_answer` | `short`     |
| `long_answer`  | `long`      |
