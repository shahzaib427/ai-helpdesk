# Phase 1 - what was built and how to check it

## Files and what each one does

### backend/src/config
- `env.js` - loads `.env`, fails loudly if `JWT_SECRET`, `DB_DATABASE` or
  `DB_USER` is missing, and points at the test database when `NODE_ENV=test`.
- `database.js` - the single Sequelize instance. `underscored: true` means the
  camelCase model fields become snake_case columns.
- `constants.js` - every enum in one place, shared by models, validators and
  (by copy) the frontend. Changing a ticket status is a one-line edit.

### backend/src/models
Twelve models plus `index.js`, which wires the associations. All tables are
created now, even the ones later phases use, so the schema stays stable while
features are added on top.

Two decisions worth noting. `users` holds credentials and role; `customers` and
`agents` hold role-specific fields in their own tables, which keeps the user
table clean and lets an agent profile carry things a customer profile never
needs. And `messages.metadata` is a JSON column, so tool calls and retrieval
sources can be attached in Phase 5 and 6 without a migration.

### backend/src/middleware
- `auth.js` - `requireAuth` verifies the token then reloads the user from the
  database, so deactivating an account takes effect immediately rather than when
  the token expires. `requireRole(...roles)` guards by role.
- `validate.js` - runs a zod schema against body, params or query and replaces
  the raw input with the parsed result.
- `rateLimiter.js` - 20 requests per 15 minutes on auth, 300 elsewhere.
- `errorHandler.js` - turns Sequelize errors and anything unexpected into the
  standard error envelope. Stack traces only in development.

### backend/src/services and controllers
Services hold the logic and are the only thing that talks to models.
Controllers translate HTTP to a service call and back. Registration and
admin-created users both run inside a transaction so a user row can never exist
without its profile row.

Self-registration always produces a CUSTOMER. Role is not read from the request
body, so nobody can register themselves as an admin.

### ai-service
- `app/llm/base.py` - the `LLMProvider` interface: `generate_response()`.
- `app/llm/echo_provider.py` - a deterministic stand-in that needs no key and no
  model download. It says clearly that it is not a real answer, which is the
  point: scaffold output should never look like a real one.
- `app/llm/provider.py` - factory keyed on `LLM_PROVIDER`. Phase 5 adds one
  registry entry and one file.
- `app/api/chat.py` - the request and response contract the Node backend will
  code against. The response already has `intent`, `used_rag`, `tool_used`,
  `handoff_required` and `sources` fields, so later phases fill them in rather
  than changing the shape.

### frontend
- `api/client.js` - axios instance, attaches the token, normalises every error
  into a readable message, and bounces to `/login` on a 401.
- `context/AuthContext.jsx` - exchanges a stored token for the live user on
  boot, so a refresh keeps you signed in.
- `routes/ProtectedRoute.jsx` - guards by session and by role. The backend
  enforces the same rules; this only keeps the UI honest.
- `layouts/AppShell.jsx` - one shell, different navigation per role.
- `pages/admin/Users.jsx` - the one fully working data screen in Phase 1: list,
  filter, paginate, create an agent or admin, deactivate and reactivate.
- Placeholder screens say which phase fills them in, instead of showing a fake
  interface.

## Commands

```bat
cd backend  && npm install && npm run db:sync && npm run db:seed && npm run dev
cd ai-service && python -m venv venv && venv\Scripts\activate && pip install -r requirements.txt && uvicorn main:app --reload --port 5001
cd frontend && npm install && npm run dev
```

## Expected output

Backend start:

```
[info] Connected to PostgreSQL database "helpdesk"
[info] Backend listening on http://localhost:5000 (development)
```

Seed finish:

```
[info] Seed complete.
[info]   Admin     admin@helpdesk.local / Password123
```

AI service start:

```
AI service ready - provider=echo model=echo-1
Uvicorn running on http://127.0.0.1:5001
```

Tests: 9 passed.

## Errors you may hit

**`password authentication failed for user "helpdesk_user"`** - the user or
password in `.env` does not match what you created. Re-run the `CREATE USER` /
`GRANT` block in psql.

**`database "helpdesk" does not exist`** - the database was not created. Run
the `CREATE DATABASE` statements.

**`permission denied for schema public`** - on PostgreSQL 15+, granting
privileges on the database is not enough; the role also needs rights on the
`public` schema inside it. Run the `\c helpdesk` / `GRANT ALL ON SCHEMA public`
lines from the setup section for both `helpdesk` and `helpdesk_test`.

**`ECONNREFUSED 127.0.0.1:5432`** - PostgreSQL is not running. Open Services
(Win key, type "services"), find a service starting with `postgresql-x64-`,
and start it. Set its startup type to Automatic so this doesn't recur.

**`Missing environment variables: JWT_SECRET`** - you copied `.env.example` but
did not fill it in.

**Index or constraint errors after repeated `sync({ alter: true })` runs** -
schema drift after several edits. Fix with `node src/seed/sync.js --force`,
which drops and recreates the tables, then re-seed.

**CORS error in the browser console** - `CORS_ORIGIN` in `backend/.env` must
match the port Vite actually chose. If 5173 was taken, Vite prints the port it
used; put that one in.

**`ModuleNotFoundError: No module named 'app'`** - uvicorn was started from the
wrong directory. Run it from `ai-service/`, not from `ai-service/app/`.

**Frontend shows "Could not reach the server"** - the backend is not running, or
`VITE_API_URL` is wrong. It must end in `/api`.

## Before starting Phase 2

Confirm: both services start clean, the seed ran, all three demo accounts sign
in and land on the right screen, a customer visiting `/admin/users` is bounced,
and `npm test` passes.
