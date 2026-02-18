# WatchPartyHQ (movie-tracker)

Collaborative movie night app: create groups, build a watchlist, vote on movies, and pull fresh data from TMDB.

## ✨ Features
- User accounts with **bcrypt password hashing** (no plaintext passwords)
- Session-based authentication (Express sessions)
- Groups and membership management
- Group watchlists + voting
- TMDB integration for seeding/displaying featured movies (hero card + grid)
- Static frontend served by the backend

## 🧱 Tech Stack
- **Backend:** Node.js, Express, mysql2, express-session, dotenv, cors
- **Frontend:** Static HTML/CSS/JS (served from `frontend/public`)
- **DB:** MySQL / MariaDB
- **Security:** bcrypt for password hashing

---

## 📦 Prerequisites
- Node.js 18+
- MySQL/MariaDB
- TMDB API Read Access Token (v4) or API Key

---

## 🔧 Local Setup

```bash
git clone https://github.com/cjladd/movie-tracker.git
cd movie-tracker
```

### 1) Environment variables

Create `backend/.env`:

```
DB_HOST=localhost
DB_USER=<your_db_user>
DB_PASSWORD=<your_db_password>
DB_NAME=movie_night_planner
PORT=4000
SESSION_SECRET=<random_long_string>

# TMDB
TMDB_BASE_URL=https://api.themoviedb.org/3
TMDB_IMAGE_BASE=https://image.tmdb.org/t/p
TMDB_READ_TOKEN=<your_tmdb_v4_read_token_or_bearer>
```

> **Important:** Never commit `.env`. Add it to `.gitignore`.

### 2) Install & Run

```bash
cd backend
npm install
npm start
```

Open: `http://localhost:4000/` → serves `frontend/public/website.html`.

---

## 🔐 Authentication (bcrypt hashing)

- On **register** (`POST /api/users/register`), passwords are hashed with **bcrypt** before storing.
- On **login** (`POST /api/users/login`), submitted passwords are checked with `bcrypt.compare(...)`.
- Sessions: `express-session` stores a server-side session; routes that require auth check `req.session.userId`.

---

## 🎬 TMDB Integration

- Seeding route populates `Movies` with popular titles (includes `tmdb_id`, `poster_url`, and rating).
- Homepage auto-seeds (first run) and displays a **hero** movie + **Top 8** featured movies.
- Configure tokens in `.env` (see above).

---

## 🔌 API (selected routes)

- `POST /api/users/register` – name, email, password
- `POST /api/users/login` – email, password
- `POST /api/users/logout`
- `GET  /api/users/me` – current session user
- `GET  /api/groups?myGroups=true`
- `POST /api/groups` – create group (auth)
- `POST /api/groups/:groupId/join` – join (auth)
- `POST /api/groups/:groupId/watchlist` – add movie (auth)
- `GET  /movies/featured` – 8 movies for homepage
- `GET  /movies/hero` – highest-rated movie
- `POST /tmdb/seed` – populate DB from TMDB (dev)

---
