# MatchDay Sports Networking (MVP)

Meetup-inspired sports networking app using React (Vite), Node/Express, and PostgreSQL (Supabase compatible).

## Features
- Google OAuth sign-in
- Email/password registration + login
- Create events + RSVP
- Search by sport/location/title
- Feed of upcoming events

## Project structure
- `backend/` Node/Express REST API
- `frontend/` React + Vite UI
- `backend/sql/schema.postgres.sql` PostgreSQL schema
- `backend/sql/schema.sql` legacy MySQL schema

## Setup

### 1) Database (Supabase/Postgres)
1. Create a Supabase project and get your Postgres connection details.
2. In Supabase SQL Editor, run `backend/sql/schema.postgres.sql`.
3. Configure backend DB env vars:
   - `DB_HOST`
   - `DB_PORT` (usually `5432`)
   - `DB_USER` (usually `postgres`)
   - `DB_PASSWORD`
   - `DB_NAME` (usually `postgres`)
   - `DB_SSL=true`
   - `DB_SSL_REJECT_UNAUTHORIZED=false`

### 2) Backend
```
cd backend
npm install
npm run dev
```

Update `.env` with your DB credentials, Google OAuth values, and secrets:
- `SESSION_SECRET` (required)
- `PASSWORD_PEPPER` (required; do not change after users register)
- `BCRYPT_SALT_ROUNDS` (default 10)

### 3) Frontend
```
cd frontend
npm install
npm run dev
```

## Google OAuth notes
- Create OAuth credentials in Google Cloud Console.
- Authorized redirect URI should match `GOOGLE_CALLBACK_URL` in `backend/.env`.
- Local default: `http://localhost:4000/auth/google/callback`.

If OAuth is not configured, the login button is disabled but the app still runs.

## Roles
- New users default to `user`. Roles supported: `user`, `admin`, `superadmin`.
- If you are migrating from an older schema, ensure these columns exist:

```sql
ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
```

## API overview
- `GET /auth/me` session info
- `GET /auth/google` start OAuth
- `POST /auth/register` email/password registration
- `POST /auth/login` email/password login
- `POST /auth/logout` end session
- `GET /api/feed` upcoming events
- `GET /api/events?q=` search events
- `POST /api/events` create event (auth)
- `POST /api/events/:id/rsvp` RSVP (auth)
- `DELETE /api/events/:id/rsvp` cancel RSVP (auth)
- `GET /api/dashboard/user` user dashboard
- `GET /api/dashboard/admin` admin dashboard
- `GET /api/dashboard/superadmin` superadmin dashboard
- `DELETE /api/admin/events/:id` remove event (admin+)
- `PATCH /api/admin/users/:id/role` update role (superadmin)
