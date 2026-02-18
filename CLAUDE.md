# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Trax is a time tracking web application built with Nuxt 4 and PostgreSQL. It allows users to track work hours, breaks, and calculate overtime. The app uses session-based authentication and is designed as a Progressive Web App (PWA).

## Commands

### Development
```bash
yarn dev              # Start development server on http://localhost:3000
yarn build            # Build for production
yarn preview          # Preview production build locally
yarn postinstall      # Prepare Nuxt (runs automatically after install)
```

### Package Manager
- This project uses **Yarn 4** (`yarn@4.12.0`)
- Always use `yarn` instead of npm or pnpm

## Architecture

### Directory Structure

- `app/` - Client-side code (Nuxt app directory)
  - `components/` - Vue components
  - `composables/` - Composable functions (useAuth, useTimer, useSettings)
  - `layouts/` - Layout components
  - `middleware/` - Route middleware (auth.global.ts handles authentication)
  - `pages/` - File-based routing (index.vue, login.vue, stats.vue, week.vue)
  - `utils/` - Client-side utilities (date formatting)
  - `assets/css/` - Global styles and transitions

- `server/` - Server-side code (Nitro)
  - `api/` - API endpoints (follows Nuxt file-based routing)
    - `auth/` - Authentication endpoints (login, logout, register, status)
    - `entries/` - Work entries CRUD
    - `timer/` - Timer control (start, stop, break)
    - `user/` - User settings (name)
  - `utils/` - Server utilities (db, auth, rateLimit, holidays, time)

- `public/` - Static assets

### Database

- **Driver**: PostgreSQL (pg library)
- **Connection**: Connection pooling via `server/utils/db.ts`
- **Timezone**: All date/time operations use `Europe/Berlin` timezone
- **Access Pattern**: All DB queries go through the `pool` export from `server/utils/db.ts`

#### Key Database Tables

- `app_users`: User accounts (id, email, password_hash, name)
- `app_sessions`: Session management (id, user_id, expires_at)
- `work_entries`: Time tracking entries (id, user_id, work_date, start_time, end_time, break_minutes, note, baseline_daily_minutes_at_time, baseline_weekly_minutes_at_time, workdays_per_week_at_time)
- `rate_limits`: Rate limiting (key, window_start, count)
- User settings table (stores baseline work hours and workdays per week)

### Authentication

- **Type**: Session-based with HTTP-only cookies
- **Cookie Configuration**: Controlled via environment variables (AUTH_COOKIE_NAME, AUTH_SESSION_DAYS)
- **Password Hashing**: Argon2 (via argon2 package)
- **Session Management**:
  - Sessions are stored in `app_sessions` table
  - Sessions auto-expire based on `expires_at` field
  - `purgeExpiredSessions()` cleans up expired sessions during login

#### Auth Flow
1. Login validates credentials against `app_users.password_hash`
2. On success, creates session in `app_sessions` and sets HTTP-only cookie
3. Global middleware (`app/middleware/auth.global.ts`) checks auth status on every route
4. Unauthenticated users redirected to `/login?next=<path>`
5. API endpoints use `requireUserId(event)` to enforce authentication

### API Patterns

All API endpoints follow these conventions:

1. **Authentication**: Use `requireUserId(event)` from `server/utils/auth.ts` to get authenticated user ID
2. **Rate Limiting**: Protect sensitive endpoints with `rateLimit(event, action, limit, windowSeconds)`
3. **Database Access**: Use `pool.query()` from `server/utils/db.ts`
4. **Error Handling**: Use `createError({ statusCode, statusMessage })` from h3
5. **File Naming**: Follow Nuxt conventions (e.g., `[id].delete.ts` for dynamic DELETE routes)

Example endpoint structure:
```typescript
import { requireUserId } from "~/server/utils/auth";
import { pool } from "~/server/utils/db";

export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event);
    const body = await readBody(event);

    const result = await pool.query('SELECT ...', [userId, ...]);

    return { ok: true, data: result.rows };
});
```

### Composables

The app uses Vue composables for shared state:

- `useAuth()`: Authentication state and refresh function
- `useTimer()`: Timer status and control functions (start, stop, break)
- `useSettings()`: User settings (baseline work hours, workdays per week)

These composables maintain singleton state and handle API communication with built-in pending request deduplication.

### Date & Time Handling

- **Timezone**: All server operations use `Europe/Berlin`
- **Date Format**: YYYY-MM-DD for work_date fields
- **Time Format**: HH:MM:SS stored in database, HH:MM displayed in UI
- **Utilities**:
  - Client: `app/utils/date.ts` (localYYYYMMDD, formatDisplayDate, nowHHMMSS)
  - Server: `server/utils/time.ts`

### Environment Variables

Required runtime config (set in .env or environment):

- `DATABASE_URL`: PostgreSQL connection string
- `AUTH_COOKIE_NAME`: Name for session cookie
- `AUTH_SESSION_DAYS`: Session expiry duration in days
- `SECRET_PASSWORD`: Secret for authentication
- `ENV`: Environment identifier ("prod" enables secure cookies)
- `NUXT_PUBLIC_APP_NAME`: Public-facing app name

### PWA Configuration

The app uses `@vite-pwa/nuxt` for Progressive Web App functionality. Configuration is in `nuxt.config.ts`.

## Code Style & Conventions

- Use TypeScript for all new code
- Follow Nuxt 4 conventions for file-based routing
- API responses use `{ ok: true, ...data }` format
- Error responses use h3's `createError()` utility
- Vue components use `<script setup>` syntax
- Prefer async/await over promises
- Use `$fetch` for API calls (with `credentials: "include"` for authenticated requests)

## Important Notes

- The app assumes a single timezone (Europe/Berlin) for all date/time operations
- Timer functionality creates/updates entries in real-time in the database
- Baseline work hours and workdays per week are stored with each entry for historical accuracy
- Rate limiting is IP-based using x-forwarded-for or x-real-ip headers
- Session expiry checks are done against Europe/Berlin timezone