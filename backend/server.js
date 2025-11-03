/*
Updated server.js with frontend connection support
- Added static file serving
- Added CORS support
- Added session management
- Ready for password hashing implementation
*/

const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const { getConnection } = require('./db');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration for development
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
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Test database connection on startup
(async () => {
  try {
    const conn = await getConnection();
    console.log('Successfully connected to MySQL database');
    await conn.end();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    console.error('Check your .env file and make sure MySQL is running');
  }
})();

// Middleware to check authentication
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/**
 * Root route - Health check
 */
app.get('/api', (req, res) => {
  res.json({
    status: 'Movie Tracker API is running',
    authenticated: !!req.session.userId
  });
});

/**
 * GET /api/users
 * Get all users (for testing - should be protected in production)
 */
app.get('/api/users', async (req, res) => {
  try {
    const conn = await getConnection();
    const [rows] = await conn.query('SELECT user_id, name, email, created_at FROM Users');
    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * POST /api/users/register
 * Register a new user
 */
app.post('/api/users/register', async (req, res) => {
  const { name, email, password } = req.body;

  // Validation
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields required' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Password strength check
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    const conn = await getConnection();

    // Check if email already exists
    const [existing] = await conn.query('SELECT * FROM Users WHERE email = ?', [email]);
    if (existing.length > 0) {
      await conn.end();
      return res.status(400).json({ error: 'Email already exists' });
    }

    // TODO: Hash password before storing
    // const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const [result] = await conn.query(
      'INSERT INTO Users (name, email, password, created_at) VALUES (?, ?, ?, NOW())',
      [name, email, password] // Use hashedPassword in production
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

/**
 * POST /api/users/login
 * User login
 */
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

    // TODO: Use bcrypt to compare hashed passwords
    // const validPassword = await bcrypt.compare(password, user.password);
    // if (!validPassword) {

    // Simple password check (replace with bcrypt in production)
    if (user.password !== password) {
      await conn.end();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create session
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

/**
 * POST /api/users/logout
 * User logout
 */
app.post('/api/users/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

/**
 * GET /api/users/me
 * Get current user info
 */
app.get('/api/users/me', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

/**
 * GET /api/groups
 * Get all groups (optionally filtered by user)
 */
app.get('/api/groups', async (req, res) => {
  try {
    const conn = await getConnection();
    let query = 'SELECT * FROM Movie_Groups';
    let params = [];

    // If user is logged in, optionally filter their groups
    if (req.session.userId && req.query.myGroups === 'true') {
      query = `
        SELECT mg.* 
        FROM Movie_Groups mg
        JOIN Group_Members gm ON mg.group_id = gm.group_id
        WHERE gm.user_id = ?
      `;
      params = [req.session.userId];
    }

    const [rows] = await conn.query(query, params);
    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching groups:', err);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

/**
 * POST /api/groups
 * Create a new group
 */
app.post('/api/groups', requireAuth, async (req, res) => {
  const { groupName } = req.body;
  const userId = req.session.userId;

  if (!groupName) {
    return res.status(400).json({ error: 'Group name required' });
  }

  try {
    const conn = await getConnection();

    // Insert group
    const [result] = await conn.query(
      'INSERT INTO Movie_Groups (group_name, created_by, created_at) VALUES (?, ?, NOW())',
      [groupName, userId]
    );

    const groupId = result.insertId;

    // Add creator as first member
    await conn.query(
      'INSERT INTO Group_Members (group_id, user_id, joined_at) VALUES (?, ?, NOW())',
      [groupId, userId]
    );

    await conn.end();

    res.status(201).json({
      message: 'Group created successfully',
      groupId: groupId
    });
  } catch (err) {
    console.error('Error creating group:', err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

/**
 * POST /api/groups/:groupId/join
 * Join a group
 */
app.post('/api/groups/:groupId/join', requireAuth, async (req, res) => {
  const { groupId } = req.params;
  const userId = req.session.userId;

  try {
    const conn = await getConnection();

    // Check if already a member
    const [existing] = await conn.query(
      'SELECT * FROM Group_Members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    if (existing.length > 0) {
      await conn.end();
      return res.status(400).json({ error: 'Already a member of this group' });
    }

    // Add member
    await conn.query(
      'INSERT INTO Group_Members (group_id, user_id, joined_at) VALUES (?, ?, NOW())',
      [groupId, userId]
    );

    await conn.end();

    res.json({ message: 'Successfully joined group' });
  } catch (err) {
    console.error('Error joining group:', err);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

/**
 * GET /api/groups/:groupId/members
 * Get all members of a group
 */
app.get('/api/groups/:groupId/members', async (req, res) => {
  const { groupId } = req.params;

  try {
    const conn = await getConnection();
    const [rows] = await conn.query(
      `SELECT u.user_id, u.name, u.email, gm.joined_at 
       FROM Group_Members gm 
       JOIN Users u ON gm.user_id = u.user_id 
       WHERE gm.group_id = ?`,
      [groupId]
    );
    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching group members:', err);
    res.status(500).json({ error: 'Failed to fetch group members' });
  }
});

/**
 * GET /api/movies
 * Get all movies from database
 */
app.get('/api/movies', async (req, res) => {
  try {
    const conn = await getConnection();
    const [rows] = await conn.query('SELECT * FROM Movies ORDER BY title');
    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching movies:', err);
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

/**
 * GET /api/movies/:id
 * Get a single movie by ID
 */
app.get('/api/movies/:id', async (req, res) => {
  try {
    const conn = await getConnection();
    const [rows] = await conn.query('SELECT * FROM Movies WHERE movie_id = ?', [req.params.id]);

    if (rows.length === 0) {
      await conn.end();
      return res.status(404).json({ error: 'Movie not found' });
    }

    await conn.end();
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching movie:', err);
    res.status(500).json({ error: 'Failed to fetch movie' });
  }
});

/**
 * POST /api/groups/:groupId/watchlist
 * Add a movie to group watchlist
 */
app.post('/api/groups/:groupId/watchlist', requireAuth, async (req, res) => {
  const { groupId } = req.params;
  const { movieId } = req.body;
  const userId = req.session.userId;

  if (!movieId) {
    return res.status(400).json({ error: 'Movie ID required' });
  }

  try {
    const conn = await getConnection();

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

    res.json({ message: 'Movie added to watchlist' });
  } catch (err) {
    console.error('Error adding movie to watchlist:', err);
    res.status(500).json({ error: 'Failed to add movie to watchlist' });
  }
});

/**
 * GET /api/groups/:groupId/watchlist
 * Get group watchlist
 */
app.get('/api/groups/:groupId/watchlist', async (req, res) => {
  const { groupId } = req.params;

  try {
    const conn = await getConnection();
    const [rows] = await conn.query(
      `SELECT m.*, gw.added_at, u.name as added_by_name
       FROM Group_Watchlist gw
       JOIN Movies m ON gw.movie_id = m.movie_id
       JOIN Users u ON gw.added_by = u.user_id
       WHERE gw.group_id = ?
       ORDER BY gw.added_at DESC`,
      [groupId]
    );
    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching watchlist:', err);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

// Catch-all route to serve the main HTML file for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/website.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Movie Tracker API listening on port ${port}`);
  console.log(`Visit http://localhost:${port} to check if it's running`);
});