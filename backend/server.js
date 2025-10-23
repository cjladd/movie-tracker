/*
Currently have barebones registration and login functionality working right now.
Works when testing it with Postman.
Haven't implemented any password hashing yet but gonna add that soon.
I also need to work on trying to connect TMBD REST API to fetch movie data and store it in our database.
*/

const express = require('express');
const { getConnection } = require('./db'); 
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

// Middleware to parse JSON bodies
app.use(express.json());

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

/**
 * Root route - Health check
 */
app.get('/', (req, res) => {
  res.json({ status: 'Movie Tracker API is running' });
});

/**
 * GET /api/users
 * Get all users (for testing)
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

  try {
    const conn = await getConnection();

    // Check if email already exists
    const [existing] = await conn.query('SELECT * FROM Users WHERE email = ?', [email]);
    if (existing.length > 0) {
      await conn.end();
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Insert new user
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

    // Simple password check (no hashing for now)
    if (user.password !== password) {
      await conn.end();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

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
 * GET /api/groups
 * Get all groups (for testing)
 */
app.get('/api/groups', async (req, res) => {
  try {
    const conn = await getConnection();
    const [rows] = await conn.query('SELECT * FROM Movie_Groups');
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
app.post('/api/groups', async (req, res) => {
  const { groupName, userId } = req.body;

  if (!groupName || !userId) {
    return res.status(400).json({ error: 'Group name and user ID required' });
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
    const [rows] = await conn.query('SELECT * FROM Movies');
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

// Start the server
app.listen(port, () => {
  console.log(`Movie Tracker API listening on port ${port}`);
  console.log(`Visit http://localhost:${port} to check if it's running`);
});