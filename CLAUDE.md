# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WatchPartyHQ — collaborative movie night app. Users create groups, build watchlists, vote on movies, and schedule movie nights. Movie data comes from the TMDB API.

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
Static HTML pages with vanilla JS. All pages share `app.js` and `style.css`.

**HTML Pages (8):**
- `website.html` — landing page (served at `/`), hero + featured + trending sections
- `Binge_Bank.html` — movie search/watchlist (inline `<script>` for page logic)
- `Stream_team.html` — groups management
- `Friends.html` — friends list and requests
- `heads_up.html` — notifications
- `Setting.html` — user settings/profile
- `Log_In.html`, `Sign_Up.html` — auth pages

**Shared JS:** `app.js` — API helper (`apiCall()`), auth functions, homepage rendering, utilities. All page-specific JS is inline in each HTML file's `<script>` tag.

**CSS Architecture:**
`style.css` is the master file that `@import`s shared stylesheets in order:
```
style.css (imports only)
  ├── css/tokens.css         — design tokens (colors, spacing, typography vars)
  ├── css/reset.css          — global resets, font loading, base styles
  ├── css/animations.css     — keyframes (fadeIn, slideIn, shimmer, etc.)
  ├── css/components.css     — buttons, cards, inputs, modals, toasts, movie-card-overlay
  ├── css/nav.css            — AUTHORITATIVE header/nav/auth-button styling (overrides style.css)
  └── css/utilities.css      — responsive containers, spacing helpers
```

Each HTML page also loads one page-specific CSS file:
```
  css/pages/website.css      — homepage hero, featured row, trending grid, movie modal
  css/pages/binge-bank.css   — search grid, movie cards, pagination, Binge Bank modal
  css/pages/stream-team.css  — group cards, member lists
  css/pages/friends.css      — friend cards, request cards
  css/pages/heads-up.css     — notification cards
  css/pages/settings.css     — settings form, profile section
  css/pages/auth.css         — login/signup forms (shared by Log_In + Sign_Up)
```

**Header/Nav:** All 8 HTML pages have **identical header markup** (logo → main-nav → nav-auth). Styling is in `css/nav.css`.

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

## Production Standards

- **No hardcoded values:** Colors, radii, spacing use CSS custom properties from `tokens.css`
- **No duplicate styles:** Shared patterns live in `components.css`; page files only add page-specific rules
- **Token consistency:** Use `var(--radius-full)` not `999px`, `var(--star-rating)` not `#facc15`, etc.
- **Dead code removal:** Legacy/overridden CSS must be deleted, not left commented out
- **Focus accessibility:** All interactive elements (buttons, chips, tabs, pagination) must have `:focus-visible` styles
- **Single source of truth:** `style.css` is imports only; `nav.css` owns all nav styling; `components.css` owns shared component patterns

# Github Behavior

- commit after each feature, summarized message
- before pushing changes be sure every feature works correctly

# validation
- test changes afterwords
