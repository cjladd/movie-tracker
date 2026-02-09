# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Movie Night Planner — collaborative movie night app. Users create groups, build watchlists, vote on movies, and schedule movie nights. Movie data comes from the TMDB API.

**Tech Stack:** Node.js + Express backend serving static HTML/CSS/JS frontend, MySQL/MariaDB database, TMDB API integration.

## Development Commands

```bash
cd backend
npm install          # install dependencies
npm run dev          # start with nodemon (auto-reload)
npm start            # start production server
npm test             # run Jest test suite
npm run test:watch   # run tests in watch mode
```

Server runs on `http://localhost:4000` (configurable via `PORT` in `.env`).

### Database Setup
```bash
mysql -u root -p < database/schema.sql       # fresh install
mysql -u root -p < database/migrate.sql      # upgrade existing database
```

### Environment Configuration
Copy `backend/.env.example` to `backend/.env` and fill in values. Required variables:
`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SESSION_SECRET`, `TMDB_READ_TOKEN`

Optional: `DB_POOL_SIZE`, `RATE_LIMIT_GENERAL`, `RATE_LIMIT_AUTH`

The server will refuse to start if any required env var is missing (validated in `config/env.js`).

## Architecture

### Backend (`backend/`)
```
server.js                  # Express app, middleware, route mounting, graceful shutdown
config/
  env.js                   # Environment validation and config export
  database.js              # MySQL connection pool (mysql2/promise), withTransaction()
  tmdb.js                  # TMDB API client with retry logic and exponential backoff
middleware/
  auth.js                  # requireAuth session middleware
  errorHandler.js          # Central error handler with error IDs and structured logging
  requestId.js             # UUID request ID assignment
  validate.js              # validateParamId, requireFields, validateEmail, sanitizeBody
routes/
  auth.js                  # /api/users — register, login, logout, profile, preferences, search, password reset
  groups.js                # /api/groups — CRUD, members, movie nights, availability, watchlist, votes
  movies.js                # /api/movies — featured, hero, by ID
  tmdb.js                  # /api/tmdb — search, popular, trending, seed, add-to-group
  friends.js               # /api/friends — list, requests, accept, decline, remove
  votes.js                 # /api/votes — cast votes (1-5 range)
  notifications.js         # /api/notifications — list, unread count, mark read
utils/
  constants.js             # Centralized magic strings/numbers
  helpers.js               # Shared utilities (apiResponse, apiError, getUserByEmail, parsePagination, etc.)
  logger.js                # Winston structured logger (JSON in prod, colorized in dev)
__tests__/
  helpers.test.js           # Tests for utility functions
  validate.test.js          # Tests for validation middleware
  constants.test.js         # Tests for constants module
```

### API Response Format
All endpoints return standardized responses:
```json
{ "success": true, "data": ..., "message": "..." }
```
Paginated endpoints add:
```json
{ "success": true, "data": [...], "pagination": { "page": 1, "limit": 20, "total": 50, "totalPages": 3 } }
```
Errors:
```json
{ "success": false, "error": "Error message", "errorId": "uuid" }
```

### Frontend (`frontend/public/`)
Static HTML pages with vanilla JS:
- `website.html` — landing page (served at `/`)
- `app.js` — shared API helper (`apiCall()`), auth functions, utilities
- `Stream_team.html` — groups, `Binge_Bank.html` — movie search/watchlist
- `Friends.html`, `Setting.html`, `Log_In.html`, `Sign_Up.html`, `heads_up.html`

The `apiCall()` function automatically unwraps `{ success, data }` responses, returning just the `data` payload.

Frontend uses relative API paths (`/api/...`) so it works on any domain.

### Database Schema (`database/schema.sql`)
Tables: Users, Movie_Groups, Group_Members, Movies, Group_Watchlist, Movie_Votes, Movie_Nights, Availability, Friend_Requests, Friendships, Notifications, Password_Resets, sessions.

Features: indexes on all foreign keys, CHECK constraints, soft deletes (deleted_at), timestamps (created_at/updated_at), `ON DELETE CASCADE`.

## Security

- **Password hashing:** bcryptjs (10 rounds)
- **Account lockout:** 5 failed attempts → 15-minute lock
- **Session management:** MySQL-backed sessions (express-mysql-session), session regeneration on login
- **Rate limiting:** Configurable via env vars, stricter on auth endpoints
- **Input validation:** Custom middleware validates params, body fields, emails
- **Headers:** helmet (CSP, HSTS, etc.), compression, CORS
- **XSS prevention:** escapeHtml() used for all user content in innerHTML

## Deployment

Configured for Railway (preferred) or DigitalOcean:
- `Dockerfile` — Node 20 Alpine
- `railway.json` — Railway config with health check at `/health`
- `Procfile` — Heroku/DigitalOcean compatible
- `.github/workflows/ci.yml` — GitHub Actions CI (tests, lint, security audit)

Set `NODE_ENV=production` and all required env vars on the deployment platform.

## Key Patterns

- All routes use `async (req, res, next)` with `try/catch` forwarding to `next(err)`
- Standardized responses via `apiResponse()` and `paginatedResponse()` helpers
- Database operations use `pool.query()` or `withTransaction()` for atomic operations
- Group operations verify membership via shared `verifyMembership()` helper
- TMDB movies are de-duplicated by `tmdb_id` using `INSERT IGNORE`
- Auth state tracked via `localStorage` + session cookies (`credentials: 'include'`)
- Health check at `GET /health` tests database connectivity
- Graceful shutdown handles SIGTERM/SIGINT with pool cleanup
