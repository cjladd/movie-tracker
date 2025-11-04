const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const axios = require('axios');
const { getConnection } = require('./db');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

// TMDB API Configuration
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const TMDB_HEADERS = {
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3N2NlNjJiMjY5ZmVlZmMxMzBlZWJkM2MyOTg2M2MwYSIsIm5iZiI6MTc2MDk5MjM2OC42NzYsInN1YiI6IjY4ZjY5YzcwNWM0YWJjNjNjMTY5MTcyOSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.Nd22pOpxDRpIhSVEDqc8DZ8rA0tNhA8IYRz-sWRWDts',
  'accept': 'application/json'
};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:4000', 'http://127.0.0.1:5500'],
  credentials: true
}));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'movie-night-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24
  }
}));

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Test database connection
(async () => {
  try {
    const conn = await getConnection();
    console.log('✅ Successfully connected to MySQL database');
    await conn.end();
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  }
})();

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// TMDB Helper Functions
async function fetchFromTMDB(endpoint) {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}${endpoint}`, { headers: TMDB_HEADERS });
    return response.data;
  } catch (error) {
    console.error('TMDB API Error:', error.message);
    throw error;
  }
}

function mapTMDBMovieToDatabase(tmdbMovie) {
  return {
    title: tmdbMovie.title,
    runtime_minutes: tmdbMovie.runtime || null,
    genre: tmdbMovie.genres ? tmdbMovie.genres.map(g => g.name).join(', ') : null,
    release_year: tmdbMovie.release_date ? new Date(tmdbMovie.release_date).getFullYear() : null,
    rating: tmdbMovie.vote_average || null,
    poster_url: tmdbMovie.poster_path ? `${TMDB_IMAGE_BASE_URL}${tmdbMovie.poster_path}` : null,
    tmdb_id: tmdbMovie.id
  };
}

// API ROUTES
app.get('/api', (req, res) => {
  res.json({
    status: 'Movie Tracker API is running',
    authenticated: !!req.session.userId
  });
});

app.post('/api/tmdb/seed', async (req, res) => {
  try {
    console.log('🎬 Seeding database with TMDB movies...');
    const popularMovies = await fetchFromTMDB('/movie/popular');
    const conn = await getConnection();

    let insertedCount = 0;

    try {
      await conn.query('ALTER TABLE Movies ADD COLUMN tmdb_id INT UNIQUE');
      console.log('✅ Added tmdb_id column to Movies table');
    } catch (e) {
      // Column already exists
    }

    for (const tmdbMovie of popularMovies.results) {
      const movieData = mapTMDBMovieToDatabase(tmdbMovie);

      const [existing] = await conn.query(
        'SELECT * FROM Movies WHERE title = ? OR (tmdb_id IS NOT NULL AND tmdb_id = ?)',
        [movieData.title, movieData.tmdb_id]
      );

      if (existing.length === 0) {
        await conn.query(
          'INSERT INTO Movies (title, runtime_minutes, genre, release_year, rating, poster_url, tmdb_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [movieData.title, movieData.runtime_minutes, movieData.genre, movieData.release_year, movieData.rating, movieData.poster_url, movieData.tmdb_id]
        );
        insertedCount++;
      }
    }

    await conn.end();
    console.log(`✅ Seeded ${insertedCount} new movies`);
    res.json({ message: `Successfully seeded ${insertedCount} movies from TMDB` });
  } catch (error) {
    console.error('❌ Error seeding movies:', error);
    res.status(500).json({ error: 'Failed to seed movies from TMDB' });
  }
});

app.get('/api/movies/featured', async (req, res) => {
  try {
    const conn = await getConnection();
    const [rows] = await conn.query('SELECT * FROM Movies ORDER BY rating DESC LIMIT 8');
    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching featured movies:', err);
    res.status(500).json({ error: 'Failed to fetch featured movies' });
  }
});

app.get('/api/movies/hero', async (req, res) => {
  try {
    const conn = await getConnection();
    const [rows] = await conn.query('SELECT * FROM Movies ORDER BY rating DESC LIMIT 1');
    await conn.end();

    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).json({ error: 'No movies found' });
    }
  } catch (err) {
    console.error('Error fetching hero movie:', err);
    res.status(500).json({ error: 'Failed to fetch hero movie' });
  }
});

// User registration and login routes (keeping your existing ones)
app.post('/api/users/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields required' });
  }

  try {
    const conn = await getConnection();
    const [existing] = await conn.query('SELECT * FROM Users WHERE email = ?', [email]);

    if (existing.length > 0) {
      await conn.end();
      return res.status(400).json({ error: 'Email already exists' });
    }

    const [result] = await conn.query(
      'INSERT INTO Users (name, email, password, created_at) VALUES (?, ?, ?, NOW())',
      [name, email, password]
    );

    await conn.end();
    res.status(201).json({
      message: 'User registered successfully',
      userId: result.insertId
    });
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/users/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const conn = await getConnection();
    const [rows] = await conn.query('SELECT * FROM Users WHERE email = ?', [email]);

    if (rows.length === 0) {
      await conn.end();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];

    if (user.password !== password) {
      await conn.end();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.user_id;
    req.session.user = {
      id: user.user_id,
      name: user.name,
      email: user.email
    };

    await conn.end();

    res.json({
      message: 'Login successful',
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ROOT ROUTE - THIS IS THE FIX!
app.get('/', (req, res) => {
  console.log('📍 Root route accessed');
  const indexPath = path.join(__dirname, '../frontend/public/website.html');
  console.log(`📁 Trying to serve: ${indexPath}`);

  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('❌ Error serving website.html:', err);
      res.status(404).send('website.html not found. Check file path.');
    } else {
      console.log('✅ Successfully served website.html');
    }
  });
});

// Catch-all route for other HTML files
app.get('*', (req, res) => {
  console.log(`📍 Catch-all route for: ${req.path}`);
  const filePath = path.join(__dirname, '../frontend/public/website.html');
  res.sendFile(filePath);
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Movie Tracker API running on http://localhost:${port}`);
  console.log(`📁 Serving files from: ${path.join(__dirname, '../frontend/public')}`);
  console.log(`💡 Root URL should serve http://localhost:4000/website.html`);
});