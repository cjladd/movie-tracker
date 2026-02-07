# Changes Summary — Production Readiness Refactor

## What Was Done

### 1. Security Fixes (Critical)
- **Removed hardcoded TMDB API token** from `server.js` — moved to `.env` as `TMDB_READ_TOKEN`
- **Removed session secret fallback** — now requires `SESSION_SECRET` in `.env` (server won't start without it)
- **Added environment validation** (`config/env.js`) — server exits immediately if required env vars are missing
- **Added rate limiting** — 200 req/15min general, 20 req/15min on login/register to prevent brute-force
- **Added helmet** — security headers (X-Frame-Options, HSTS, etc.)
- **Added `trust proxy`** — required for rate limiting and secure cookies behind Railway/reverse proxy

### 2. Backend Architecture Refactor
- **Split monolithic `server.js`** (~1235 lines) into modular route files:
  - `routes/auth.js` — register, login, logout, profile, preferences
  - `routes/groups.js` — groups CRUD, members, movie nights, watchlist, votes
  - `routes/movies.js` — featured/hero endpoints
  - `routes/tmdb.js` — TMDB search, popular, trending, seed, add-to-group
  - `routes/friends.js` — friend requests, accept, remove
  - `routes/votes.js` — voting
  - `routes/notifications.js` — placeholder (returns empty array instead of fake mock data)
- **Extracted configuration** into `config/` directory:
  - `config/env.js` — centralized env var validation and config
  - `config/database.js` — MySQL connection pool (replaces per-request connection creation)
  - `config/tmdb.js` — TMDB API client with axios
- **Extracted middleware** into `middleware/` directory:
  - `middleware/auth.js` — `requireAuth` session check
  - `middleware/errorHandler.js` — central error handler (routes use `next(err)` instead of inline error responses)

### 3. Database Connection Pooling
- **Replaced per-request `getConnection()`/`conn.end()` pattern** with a connection pool
- Pool configured with `connectionLimit: 10`, keep-alive enabled
- Routes now use `pool.query()` directly — no manual connection lifecycle management
- Old `db.js` is now superseded by `config/database.js`

### 4. Production Middleware
- **helmet** — security headers
- **compression** — gzip response compression
- **morgan** — request logging (`dev` format locally, `combined` in production)
- **express-rate-limit** — API rate limiting with stricter limits on auth endpoints

### 5. Graceful Shutdown
- Server handles `SIGTERM` and `SIGINT` signals
- Closes HTTP server cleanly, with a 10-second force-exit timeout

### 6. Health Check Endpoint
- `GET /health` — returns `{ status: "ok", uptime: ... }` or 503 if database is unreachable
- Used by Railway for deployment health monitoring

### 7. Frontend Fix
- **Changed `API_URL` from `http://localhost:4000/api` to `/api`** (relative path)
- Frontend now works on any domain without code changes

### 8. Deployment Configuration
- **`Dockerfile`** — Node 20 Alpine, production-optimized (`npm ci --omit=dev`)
- **`railway.json`** — Railway deployment config with health check
- **`Procfile`** — Heroku/DigitalOcean compatible
- **`.dockerignore`** — excludes node_modules, .env, .git, etc.

### 9. Project Hygiene
- **Root `.gitignore`** created (covers both backend and frontend)
- **Updated `backend/.env.example`** with all required variables documented
- **Updated `CLAUDE.md`** to reflect new architecture
- **Notifications endpoint** now returns empty array instead of hardcoded fake data

### 10. Session Configuration for Production
- `secure: true` cookies in production (requires HTTPS)
- `sameSite: 'none'` in production (for cross-origin if needed)
- `proxy: true` in production (for Railway/reverse proxy)

---

## Files Created
- `backend/config/env.js`
- `backend/config/database.js`
- `backend/config/tmdb.js`
- `backend/middleware/auth.js`
- `backend/middleware/errorHandler.js`
- `backend/routes/auth.js`
- `backend/routes/groups.js`
- `backend/routes/movies.js`
- `backend/routes/tmdb.js`
- `backend/routes/friends.js`
- `backend/routes/votes.js`
- `backend/routes/notifications.js`
- `Dockerfile`
- `.dockerignore`
- `Procfile`
- `railway.json`
- `.gitignore` (root level)
- `CHANGES_SUMMARY.md` (this file)

## Files Modified
- `backend/server.js` — complete rewrite (1235 → 168 lines)
- `backend/.env` — added SESSION_SECRET and TMDB_READ_TOKEN
- `backend/.env.example` — updated with all variables
- `frontend/public/app.js` — changed API_URL to relative path
- `CLAUDE.md` — updated to reflect new architecture

## Files Superseded (can be deleted)
- `backend/db.js` — replaced by `backend/config/database.js`

---

## Questions / Decisions That Need Your Input

1. **TMDB API Token**: The token that was hardcoded in server.js has been moved to `.env`. That token is still committed in git history. If this is a real API key you want to protect, you should regenerate it at https://www.themoviedb.org/settings/api and only store the new one in `.env`.

2. **Database hosting**: Railway offers MySQL as a plugin/service. When you deploy, you'll need to:
   - Add a MySQL service in Railway
   - Set the `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` env vars from Railway's provided connection string
   - Run `database/schema.sql` against the Railway MySQL instance to create tables

3. **Session storage**: Currently using in-memory session storage (default express-session). For production with multiple instances, consider adding `connect-redis` or `express-mysql-session` for persistent sessions. For a single Railway instance this is fine.

4. **CORS origins**: In production, set `CORS_ORIGINS` env var to your deployed domain (e.g., `https://your-app.up.railway.app`). Currently defaults to localhost origins in development.

5. **The `backend/db.js` file**: It's still in the repo but no longer used. I left it in case other code references it. You can safely delete it.

6. **SSL/HTTPS**: Railway provides HTTPS automatically. The session cookie is configured with `secure: true` in production, which requires HTTPS. This should work out of the box on Railway.

7. **Frontend React app** (`frontend/src/`, `frontend/package.json`): There's an unused Create React App scaffolding in `frontend/src/`. The actual frontend is the static files in `frontend/public/`. You may want to remove the React scaffolding (`frontend/src/`, `frontend/package.json`) if you're not planning to use it.

8. **bcrypt vs bcryptjs**: The app uses `bcrypt` (native C++ addon) which requires `python3`, `make`, and `g++` to compile in Alpine/Docker. If you hit build failures during deployment, switch to `bcryptjs` (pure JS, drop-in replacement) — just `npm uninstall bcrypt && npm install bcryptjs` and change the `require('bcrypt')` in `routes/auth.js` to `require('bcryptjs')`. The API is identical.
