# Question bank pipeline

All **maths practice / quiz** questions use **one bank**: the `custom_questions` table in Neon Postgres. There is no separate “built-in” list at runtime.

Legacy built-in TypeScript banks are only used to **seed** missing rows into the database the first time an admin opens the Admin panel (matched by question stem).

## Flow

```
Admin UI (add / edit / bulk)  —  or  built-in auto-sync on admin load
    → POST/PUT /api/admin/questions[*]
    → Neon `custom_questions`
    → GET /api/bootstrap  (logged-in users)
    → localStorage `nodent_custom_questions`
    → practiceQuestionsForSubject()  (database rows only)
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
