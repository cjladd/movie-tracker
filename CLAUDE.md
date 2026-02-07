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
```

Server runs on `http://localhost:4000` (configurable via `PORT` in `.env`).

### Database Setup
```bash
mysql -u root -p < database/schema.sql
```

### Environment Configuration
Copy `backend/.env.example` to `backend/.env` and fill in values. Required variables:
`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SESSION_SECRET`, `TMDB_READ_TOKEN`

The server will refuse to start if any required env var is missing (validated in `config/env.js`).

## Architecture

### Backend (`backend/`)
```
server.js                  # Express app setup, middleware, route mounting, graceful shutdown
config/
  env.js                   # Environment validation and config export
  database.js              # MySQL connection pool (mysql2/promise)
  tmdb.js                  # TMDB API client (axios), helper functions
middleware/
  auth.js                  # requireAuth session middleware
  errorHandler.js          # Central error handler
routes/
  auth.js                  # /api/users — register, login, logout, profile, preferences
  groups.js                # /api/groups — CRUD, members, movie nights, watchlist, votes
  movies.js                # /api/movies — featured, hero
  tmdb.js                  # /api/tmdb — search, popular, trending, seed, add-to-group
  friends.js               # /api/friends — requests, accept, remove
  votes.js                 # /api/votes — cast votes
  notifications.js         # /api/notifications — placeholder (not yet DB-backed)
```

**Database:** Uses a connection pool (`config/database.js`). Routes use `pool.query()` directly — no manual connection management needed. Errors are forwarded to the central error handler via `next(err)`.

**Security middleware:** helmet, compression, morgan logging, rate limiting (stricter on auth endpoints), CORS with production/dev split.

### Frontend (`frontend/public/`)
Static HTML pages with vanilla JS:
- `website.html` — landing page (served at `/`)
- `app.js` — shared API helper (`apiCall()`) and page initialization
- `Stream_team.html` — groups, `Binge_Bank.html` — movie search/watchlist
- `Friends.html`, `Setting.html`, `Log_In.html`, `Sign_Up.html`, `heads_up.html`

Frontend uses relative API paths (`/api/...`) so it works on any domain.

### Database Schema (`database/schema.sql`)
Tables: Users, Movie_Groups, Group_Members, Movies, Group_Watchlist, Movie_Votes, Movie_Nights, Availability, Friend_Requests, Friendships. Most foreign keys use `ON DELETE CASCADE`.

## Deployment

Configured for Railway (preferred) or DigitalOcean:
- `Dockerfile` — Node 20 Alpine, installs backend deps, copies frontend static files
- `railway.json` — Railway-specific config with health check at `/health`
- `Procfile` — Heroku/DigitalOcean compatible

Set `NODE_ENV=production` and all required env vars on the deployment platform. Railway can provision a MySQL database as a service.

## Key Patterns

- All routes use `async (req, res, next)` with `try/catch` forwarding to `next(err)`
- Group operations verify membership via `verifyMembership()` helper in `routes/groups.js`
- TMDB movies are de-duplicated by `tmdb_id` when added to the local database
- Auth state on frontend tracked via `localStorage` + session cookies (`credentials: 'include'`)
- Health check endpoint at `GET /health` tests database connectivity
