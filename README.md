# Movie Night Planner (movie-tracker)

Collaborative movie night app: create groups, build a watchlist, vote on movies, and pull fresh data from TMDB.

## ✨ Features
- User accounts with **bcrypt password hashing** (no plaintext passwords)
- Session-based authentication (Express sessions)
- Groups and membership management
- Group watchlists + voting
- TMDB integration for seeding/displaying featured movies (hero card + grid)
- Static frontend served by the backend
- Real-time collaborative voting system with star ratings
- Movie night scheduling and availability tracking
- TMDB movie search and discovery
- Group member management and invitations
- Vote aggregation and consensus calculation
- Responsive dark theme UI design


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
- `GET  /api/users/profile` – current user profile (auth)
- `PUT  /api/users/profile` – update user profile (auth)
- `GET  /api/groups` – user's groups (auth)
- `POST /api/groups` – create group (auth)
- `POST /api/groups/:groupId/members` – add member by email (auth)
- `GET  /api/groups/:groupId/members` – get group members (auth)
- `POST /api/groups/:groupId/watchlist` – add movie (auth)
- `GET  /api/groups/:groupId/watchlist` – get group watchlist (auth)
- `POST /api/votes` – vote on movie (auth)
- `GET  /api/groups/:groupId/movies/:movieId/votes` – get movie votes (auth)
- `POST /api/groups/:groupId/movie-nights` – create movie night (auth)
- `GET  /api/groups/:groupId/movie-nights` – get movie nights (auth)
- `GET  /api/tmdb/search` – search movies via TMDB
- `GET  /api/tmdb/popular` – get popular movies
- `GET  /api/tmdb/trending` – get trending movies
- `GET  /api/tmdb/movie/:tmdbId` – get movie details
- `POST /api/tmdb/add-to-group` – add TMDB movie to group (auth)
- `GET  /api/movies/featured` – 8 movies for homepage
- `GET  /api/movies/hero` – highest-rated movie
- `POST /api/tmdb/seed` – populate DB from TMDB

---
