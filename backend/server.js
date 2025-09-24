const express = require('express');
const { getConnection } = require('./db');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

// Middleware to parse JSON bodies
app.use(express.json());

/**
 * Root route.  Returns a simple status message to verify that the API
 * server is running.  You can visit this endpoint in your browser
 * (e.g. http://localhost:4000/) to check the server health.
 */
app.get('/', (req, res) => {
  res.json({ status: 'Movie Tracker API is running' });
});

/**
 * GET /api/movies
 *
 * Fetch all movies from the database.  This route demonstrates how to
 * perform an async query using the connection helper.  The results are
 * returned as JSON.
 */
app.get('/api/movies', async (req, res) => {
  try {
    const conn = await getConnection();
    const [rows] = await conn.query('SELECT * FROM movies');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching movies:', err);
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

/**
 * GET /api/movies/:id
 *
 * Fetch a single movie by its ID.  Returns 404 if no record is found.
 */
app.get('/api/movies/:id', async (req, res) => {
  try {
    const conn = await getConnection();
    const [rows] = await conn.query('SELECT * FROM movies WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching movie:', err);
    res.status(500).json({ error: 'Failed to fetch movie' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Movie Tracker API listening on port ${port}`);
});
