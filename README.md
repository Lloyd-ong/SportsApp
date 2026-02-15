# MatchDay Sports Networking (MVP)

Meetup-inspired sports networking app using React (Vite), Node/Express, and MySQL.

## Features
- Google OAuth sign-in
- Email/password registration + login
- Create events + RSVP
- Search by sport/location/title
- Feed of upcoming events

## Project structure
- `backend/` Node/Express REST API
- `frontend/` React + Vite UI
- `backend/sql/schema.sql` MySQL schema

## Setup

### 1) Database (phpMyAdmin/MySQL)
1. Create a database named `sports_networking` (or update the `.env`).
2. Run the schema in `backend/sql/schema.sql`.

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
- If you already created the schema, add the role column:

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
