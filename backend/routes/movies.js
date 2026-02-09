const { Router } = require('express');
const { pool } = require('../config/database');
const { validateParamId } = require('../middleware/validate');
const { apiResponse, apiError, parsePagination, paginatedResponse } = require('../utils/helpers');

const router = Router();

// Get featured movies (top 8 by rating)
router.get('/featured', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Movies ORDER BY rating DESC LIMIT 8');
    res.json(apiResponse(rows));
  } catch (err) {
    next(err);
  }
});

// Get hero movie (highest rated)
router.get('/hero', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Movies ORDER BY rating DESC LIMIT 1');
    if (rows.length === 0) return next(apiError('No movies found', 404));
    res.json(apiResponse(rows[0]));
  } catch (err) {
    next(err);
  }
});

// Get single movie by ID
router.get('/:movieId', validateParamId('movieId'), async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Movies WHERE movie_id = ?', [req.params.movieId]);
    if (rows.length === 0) return next(apiError('Movie not found', 404));
    res.json(apiResponse(rows[0]));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
