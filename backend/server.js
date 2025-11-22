const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const axios = require('axios');
const { getConnection } = require('./db');
const bcrypt = require('bcrypt'); //const for password hashing
const SALT_ROUNDS = 10; //^^
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

// TMDB API Configuration
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w780'; 
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

// User registration and login routes
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

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await conn.query(
      'INSERT INTO Users (name, email, password, created_at) VALUES (?, ?, ?, NOW())',
      [name, email, hashedPassword]
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

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
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

// Logout route
app.post('/api/users/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.json({ message: 'Logout successful' });
  });
});

// GROUP MANAGEMENT ROUTES

// Create a new group
app.post('/api/groups', requireAuth, async (req, res) => {
  const { groupName } = req.body;
  const userId = req.session.userId;

  if (!groupName) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  try {
    const conn = await getConnection();

    // Create the group
    const [result] = await conn.query(
      'INSERT INTO Movie_Groups (group_name, created_by, created_at) VALUES (?, ?, NOW())',
      [groupName, userId]
    );

    const groupId = result.insertId;

    // Add creator as a member
    await conn.query(
      'INSERT INTO Group_Members (group_id, user_id, joined_at) VALUES (?, ?, NOW())',
      [groupId, userId]
    );

    await conn.end();

    res.status(201).json({
      message: 'Group created successfully',
      group: {
        group_id: groupId,
        group_name: groupName,
        created_by: userId
      }
    });
  } catch (err) {
    console.error('Error creating group:', err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Get user's groups
app.get('/api/groups', requireAuth, async (req, res) => {
  const userId = req.session.userId;

  try {
    const conn = await getConnection();
    const [rows] = await conn.query(`
      SELECT g.*, u.name as creator_name
      FROM Movie_Groups g
      JOIN Group_Members gm ON g.group_id = gm.group_id
      JOIN Users u ON g.created_by = u.user_id
      WHERE gm.user_id = ?
      ORDER BY g.created_at DESC
    `, [userId]);

    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching groups:', err);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Get group members
app.get('/api/groups/:groupId/members', requireAuth, async (req, res) => {
  const { groupId } = req.params;
  const userId = req.session.userId;

  try {
    const conn = await getConnection();

    // Check if user is member of this group
    const [membership] = await conn.query(
      'SELECT * FROM Group_Members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    if (membership.length === 0) {
      await conn.end();
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    // Get all members
    const [rows] = await conn.query(`
      SELECT u.user_id, u.name, u.email, gm.joined_at
      FROM Users u
      JOIN Group_Members gm ON u.user_id = gm.user_id
      WHERE gm.group_id = ?
      ORDER BY gm.joined_at ASC
    `, [groupId]);

    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching group members:', err);
    res.status(500).json({ error: 'Failed to fetch group members' });
  }
});

// Add member to group (invite by email)
app.post('/api/groups/:groupId/members', requireAuth, async (req, res) => {
  const { groupId } = req.params;
  const { email } = req.body;
  const userId = req.session.userId;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const conn = await getConnection();

    // Check if current user is member of this group
    const [membership] = await conn.query(
      'SELECT * FROM Group_Members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    if (membership.length === 0) {
      await conn.end();
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    // Find user by email
    const [users] = await conn.query('SELECT * FROM Users WHERE email = ?', [email]);

    if (users.length === 0) {
      await conn.end();
      return res.status(404).json({ error: 'User not found' });
    }

    const newMember = users[0];

    // Check if user is already a member
    const [existingMember] = await conn.query(
      'SELECT * FROM Group_Members WHERE group_id = ? AND user_id = ?',
      [groupId, newMember.user_id]
    );

    if (existingMember.length > 0) {
      await conn.end();
      return res.status(400).json({ error: 'User is already a member' });
    }

    // Add member to group
    await conn.query(
      'INSERT INTO Group_Members (group_id, user_id, joined_at) VALUES (?, ?, NOW())',
      [groupId, newMember.user_id]
    );

    await conn.end();

    res.json({
      message: 'Member added successfully',
      member: {
        user_id: newMember.user_id,
        name: newMember.name,
        email: newMember.email
      }
    });
  } catch (err) {
    console.error('Error adding member:', err);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// MOVIE NIGHT ROUTES

// Create a movie night
app.post('/api/groups/:groupId/movie-nights', requireAuth, async (req, res) => {
  const { groupId } = req.params;
  const { scheduledDate, chosenMovieId } = req.body;
  const userId = req.session.userId;

  if (!scheduledDate) {
    return res.status(400).json({ error: 'Scheduled date is required' });
  }

  try {
    const conn = await getConnection();

    // Check if user is member of this group
    const [membership] = await conn.query(
      'SELECT * FROM Group_Members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    if (membership.length === 0) {
      await conn.end();
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    // Create movie night
    const [result] = await conn.query(
      'INSERT INTO Movie_Nights (group_id, scheduled_date, chosen_movie_id, status) VALUES (?, ?, ?, ?)',
      [groupId, scheduledDate, chosenMovieId || null, 'planned']
    );

    await conn.end();

    res.status(201).json({
      message: 'Movie night created successfully',
      movieNight: {
        night_id: result.insertId,
        group_id: groupId,
        scheduled_date: scheduledDate,
        chosen_movie_id: chosenMovieId,
        status: 'planned'
      }
    });
  } catch (err) {
    console.error('Error creating movie night:', err);
    res.status(500).json({ error: 'Failed to create movie night' });
  }
});

// Get group's movie nights
app.get('/api/groups/:groupId/movie-nights', requireAuth, async (req, res) => {
  const { groupId } = req.params;
  const userId = req.session.userId;

  try {
    const conn = await getConnection();

    // Check if user is member of this group
    const [membership] = await conn.query(
      'SELECT * FROM Group_Members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    if (membership.length === 0) {
      await conn.end();
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    // Get movie nights with movie details
    const [rows] = await conn.query(`
      SELECT mn.*, m.title as movie_title, m.poster_url, m.rating
      FROM Movie_Nights mn
      LEFT JOIN Movies m ON mn.chosen_movie_id = m.movie_id
      WHERE mn.group_id = ?
      ORDER BY mn.scheduled_date DESC
    `, [groupId]);

    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching movie nights:', err);
    res.status(500).json({ error: 'Failed to fetch movie nights' });
  }
});

// WATCHLIST ROUTES

// Add movie to group watchlist
app.post('/api/groups/:groupId/watchlist', requireAuth, async (req, res) => {
  const { groupId } = req.params;
  const { movieId } = req.body;
  const userId = req.session.userId;

  if (!movieId) {
    return res.status(400).json({ error: 'Movie ID is required' });
  }

  try {
    const conn = await getConnection();

    // Check if user is member of this group
    const [membership] = await conn.query(
      'SELECT * FROM Group_Members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    if (membership.length === 0) {
      await conn.end();
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    // Check if movie already in watchlist
    const [existing] = await conn.query(
      'SELECT * FROM Group_Watchlist WHERE group_id = ? AND movie_id = ?',
      [groupId, movieId]
    );

    if (existing.length > 0) {
      await conn.end();
      return res.status(400).json({ error: 'Movie already in watchlist' });
    }

    // Add to watchlist
    await conn.query(
      'INSERT INTO Group_Watchlist (group_id, movie_id, added_by, added_at) VALUES (?, ?, ?, NOW())',
      [groupId, movieId, userId]
    );

    await conn.end();

    res.json({ message: 'Movie added to watchlist successfully' });
  } catch (err) {
    console.error('Error adding to watchlist:', err);
    res.status(500).json({ error: 'Failed to add to watchlist' });
  }
});

// Get group watchlist
app.get('/api/groups/:groupId/watchlist', requireAuth, async (req, res) => {
  const { groupId } = req.params;
  const userId = req.session.userId;

  try {
    const conn = await getConnection();

    // Check if user is member of this group
    const [membership] = await conn.query(
      'SELECT * FROM Group_Members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    if (membership.length === 0) {
      await conn.end();
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    // Get watchlist with movie details
    const [rows] = await conn.query(`
      SELECT gw.*, m.title, m.poster_url, m.rating, m.release_year, u.name as added_by_name
      FROM Group_Watchlist gw
      JOIN Movies m ON gw.movie_id = m.movie_id
      JOIN Users u ON gw.added_by = u.user_id
      WHERE gw.group_id = ?
      ORDER BY gw.added_at DESC
    `, [groupId]);

    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching watchlist:', err);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

// VOTING ROUTES

// Vote on a movie
app.post('/api/votes', requireAuth, async (req, res) => {
  const { groupId, movieId, voteValue } = req.body;
  const userId = req.session.userId;

  if (!groupId || !movieId || !voteValue) {
    return res.status(400).json({ error: 'Group ID, movie ID, and vote value are required' });
  }

  if (voteValue < 1 || voteValue > 5) {
    return res.status(400).json({ error: 'Vote value must be between 1 and 5' });
  }

  try {
    const conn = await getConnection();

    // Check if user is member of this group
    const [membership] = await conn.query(
      'SELECT * FROM Group_Members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    if (membership.length === 0) {
      await conn.end();
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    // Insert or update vote
    await conn.query(`
      INSERT INTO Movie_Votes (user_id, group_id, movie_id, vote_value, voted_at)
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE vote_value = ?, voted_at = NOW()
    `, [userId, groupId, movieId, voteValue, voteValue]);

    await conn.end();

    res.json({ message: 'Vote recorded successfully' });
  } catch (err) {
    console.error('Error recording vote:', err);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

// Get votes for a movie in a group
app.get('/api/groups/:groupId/movies/:movieId/votes', requireAuth, async (req, res) => {
  const { groupId, movieId } = req.params;
  const userId = req.session.userId;

  try {
    const conn = await getConnection();

    // Check if user is member of this group
    const [membership] = await conn.query(
      'SELECT * FROM Group_Members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    if (membership.length === 0) {
      await conn.end();
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    // Get votes
    const [rows] = await conn.query(`
      SELECT mv.*, u.name as voter_name
      FROM Movie_Votes mv
      JOIN Users u ON mv.user_id = u.user_id
      WHERE mv.group_id = ? AND mv.movie_id = ?
      ORDER BY mv.voted_at DESC
    `, [groupId, movieId]);

    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching votes:', err);
    res.status(500).json({ error: 'Failed to fetch votes' });
  }
});

// NOTIFICATION ROUTES

// Get user notifications
app.get('/api/notifications', requireAuth, async (req, res) => {
  const userId = req.session.userId;

  try {
    // For now, return mock data since we don't have a notifications table
    // In a real app, you'd create a notifications table and query it
    const notifications = [
      {
        id: 1,
        type: 'group_invite',
        title: 'New Group Invitation',
        message: 'You have been invited to join "Movie Buffs" group',
        read: false,
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
      },
      {
        id: 2,
        type: 'movie_night',
        title: 'Movie Night Tomorrow',
        message: 'Don\'t forget about movie night with "Weekend Warriors" tomorrow at 8 PM',
        read: false,
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 day ago
      },
      {
        id: 3,
        type: 'vote_reminder',
        title: 'Vote Needed',
        message: 'Your group is voting on the next movie. Cast your vote before it ends!',
        read: true,
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
      }
    ];

    res.json(notifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
app.post('/api/notifications/:notificationId/read', requireAuth, async (req, res) => {
  const { notificationId } = req.params;

  try {
    // In a real app, you'd update the notification in the database
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
  const userId = req.session.userId;

  try {
    // In a real app, you'd update all unread notifications for the user
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// TMDB SEARCH ROUTES

// Search movies via TMDB
app.get('/api/tmdb/search', async (req, res) => {
  const { query, page = 1 } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const searchResults = await fetchFromTMDB(`/search/movie?query=${encodeURIComponent(query)}&page=${page}`);

    // Map the results to include full poster URLs
    const mappedResults = {
      ...searchResults,
      results: searchResults.results.map(movie => ({
        ...movie,
        poster_url: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : null,
        backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null
      }))
    };

    res.json(mappedResults);
  } catch (error) {
    console.error('Error searching movies:', error);
    res.status(500).json({ error: 'Failed to search movies' });
  }
});

// Get movie details by TMDB ID
app.get('/api/tmdb/movie/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;

  try {
    const movieDetails = await fetchFromTMDB(`/movie/${tmdbId}`);
    const credits = await fetchFromTMDB(`/movie/${tmdbId}/credits`);

    // Map the movie details
    const mappedMovie = {
      ...movieDetails,
      poster_url: movieDetails.poster_path ? `${TMDB_IMAGE_BASE_URL}${movieDetails.poster_path}` : null,
      backdrop_url: movieDetails.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movieDetails.backdrop_path}` : null,
      cast: credits.cast.slice(0, 10), // Top 10 cast members
      crew: credits.crew.filter(person => ['Director', 'Producer', 'Writer'].includes(person.job))
    };

    res.json(mappedMovie);
  } catch (error) {
    console.error('Error fetching movie details:', error);
    res.status(500).json({ error: 'Failed to fetch movie details' });
  }
});

// Get popular movies from TMDB
app.get('/api/tmdb/popular', async (req, res) => {
  const { page = 1 } = req.query;

  try {
    const popularMovies = await fetchFromTMDB(`/movie/popular?page=${page}`);

    const mappedResults = {
      ...popularMovies,
      results: popularMovies.results.map(movie => ({
        ...movie,
        poster_url: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : null,
        backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null
      }))
    };

    res.json(mappedResults);
  } catch (error) {
    console.error('Error fetching popular movies:', error);
    res.status(500).json({ error: 'Failed to fetch popular movies' });
  }
});

// Get trending movies
app.get('/api/tmdb/trending', async (req, res) => {
  try {
    const trendingMovies = await fetchFromTMDB('/trending/movie/week');

    const mappedResults = {
      ...trendingMovies,
      results: trendingMovies.results.map(movie => ({
        ...movie,
        poster_url: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : null,
        backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null
      }))
    };

    res.json(mappedResults);
  } catch (error) {
    console.error('Error fetching trending movies:', error);
    res.status(500).json({ error: 'Failed to fetch trending movies' });
  }
});

// Add TMDB movie to local database and group watchlist
app.post('/api/tmdb/add-to-group', requireAuth, async (req, res) => {
  const { tmdbMovie, groupId } = req.body;
  const userId = req.session.userId;

  if (!tmdbMovie || !groupId) {
    return res.status(400).json({ error: 'Movie data and group ID are required' });
  }

  try {
    const conn = await getConnection();

    // Check if user is member of this group
    const [membership] = await conn.query(
      'SELECT * FROM Group_Members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    if (membership.length === 0) {
      await conn.end();
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    // Check if movie already exists in our database
    let movieId;
    const [existingMovie] = await conn.query(
      'SELECT movie_id FROM Movies WHERE tmdb_id = ?',
      [tmdbMovie.id]
    );

    if (existingMovie.length > 0) {
      movieId = existingMovie[0].movie_id;
    } else {
      // Add movie to our database
      const movieData = mapTMDBMovieToDatabase(tmdbMovie);
      const [result] = await conn.query(
        'INSERT INTO Movies (title, runtime_minutes, genre, release_year, rating, poster_url, tmdb_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [movieData.title, movieData.runtime_minutes, movieData.genre, movieData.release_year, movieData.rating, movieData.poster_url, movieData.tmdb_id]
      );
      movieId = result.insertId;
    }

    // Check if movie already in group watchlist
    const [existingWatchlist] = await conn.query(
      'SELECT * FROM Group_Watchlist WHERE group_id = ? AND movie_id = ?',
      [groupId, movieId]
    );

    if (existingWatchlist.length > 0) {
      await conn.end();
      return res.status(400).json({ error: 'Movie already in group watchlist' });
    }

    // Add to group watchlist
    await conn.query(
      'INSERT INTO Group_Watchlist (group_id, movie_id, added_by, added_at) VALUES (?, ?, ?, NOW())',
      [groupId, movieId, userId]
    );

    await conn.end();

    res.json({
      message: 'Movie added to group watchlist successfully',
      movieId: movieId
    });
  } catch (err) {
    console.error('Error adding movie to group:', err);
    res.status(500).json({ error: 'Failed to add movie to group' });
  }
});

// ROOT ROUTE - THIS IS THE FIX!
app.get('/', (req, res) => {
  console.log('🔍 Root route accessed');
  const indexPath = path.join(__dirname, '../frontend/public/website.html');
  console.log(`🔍 Trying to serve: ${indexPath}`);

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
  console.log(`🔍 Catch-all route for: ${req.path}`);
  const filePath = path.join(__dirname, '../frontend/public/website.html');
  res.sendFile(filePath);
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Movie Tracker API running on http://localhost:${port}`);
  console.log(`📁 Serving files from: ${path.join(__dirname, '../frontend/public')}`);
  console.log(`💡 Root URL should serve http://localhost:4000/website.html`);
});