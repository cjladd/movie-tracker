const { Router } = require('express');
const { pool } = require('../config/database');

const router = Router();

// Get featured movies (top 8 by rating)
router.get('/featured', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Movies ORDER BY rating DESC LIMIT 8');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Get hero movie (highest rated)
router.get('/hero', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Movies ORDER BY rating DESC LIMIT 1');
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).json({ error: 'No movies found' });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
