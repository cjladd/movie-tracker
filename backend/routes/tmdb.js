const { Router } = require('express');
const { pool } = require('../config/database');
const { fetchFromTMDB, mapTMDBMovie, addImageUrls, mapProviders } = require('../config/tmdb');
const { requireAuth } = require('../middleware/auth');
const { validateParamId, requireFields } = require('../middleware/validate');
const { verifyMembership, apiResponse, apiError, isPositiveInt } = require('../utils/helpers');
const logger = require('../utils/logger');

const router = Router();

// Seed database with popular TMDB movies
router.post('/seed', async (req, res, next) => {
  try {
    const popularMovies = await fetchFromTMDB('/movie/popular');
    const results = popularMovies.results || [];

    let insertedCount = 0;
    for (const tmdbMovie of results) {
      const movieData = mapTMDBMovie(tmdbMovie);

      const [existing] = await pool.query(
        'SELECT movie_id FROM Movies WHERE tmdb_id = ?',
        [movieData.tmdb_id]
      );

      if (existing.length === 0) {
        await pool.query(
          'INSERT INTO Movies (title, runtime_minutes, genre, release_year, rating, poster_url, tmdb_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [movieData.title, movieData.runtime_minutes, movieData.genre, movieData.release_year, movieData.rating, movieData.poster_url, movieData.tmdb_id]
        );
        insertedCount++;
      }
    }

    logger.info(`Seeded ${insertedCount} movies from TMDB`);
    res.json(apiResponse({ insertedCount }, `Successfully seeded ${insertedCount} movies from TMDB`));
  } catch (err) {
    next(err);
  }
});

// Search movies via TMDB
router.get('/search', async (req, res, next) => {
  const { query, page = 1 } = req.query;
  if (!query) return next(apiError('Search query is required', 400));
  if (query.length > 200) return next(apiError('Search query too long', 400));

  try {
    const searchResults = await fetchFromTMDB(
      `/search/movie?query=${encodeURIComponent(query)}&page=${page}`
    );
    const results = searchResults.results || [];
    res.json(apiResponse({
      ...searchResults,
      results: results.map(addImageUrls),
    }));
  } catch (err) {
    next(err);
  }
});

// Get movie details by TMDB ID
router.get('/movie/:tmdbId', validateParamId('tmdbId'), async (req, res, next) => {
  try {
    const [movieDetails, credits, watchProvidersData] = await Promise.all([
      fetchFromTMDB(`/movie/${req.params.tmdbId}`),
      fetchFromTMDB(`/movie/${req.params.tmdbId}/credits`).catch(() => ({ cast: [], crew: [] })),
      fetchFromTMDB(`/movie/${req.params.tmdbId}/watch/providers`).catch(() => ({ results: {} })),
    ]);

    res.json(apiResponse({
      ...addImageUrls(movieDetails),
      cast: (credits.cast || []).slice(0, 10),
      crew: (credits.crew || []).filter((p) =>
        ['Director', 'Producer', 'Writer'].includes(p.job)
      ),
      watch_providers: mapProviders(watchProvidersData),
    }));
  } catch (err) {
    next(err);
  }
});

// Get popular movies
router.get('/popular', async (req, res, next) => {
  const { page = 1 } = req.query;
  try {
    const data = await fetchFromTMDB(`/movie/popular?page=${page}`);
    const results = data.results || [];
    res.json(apiResponse({ ...data, results: results.map(addImageUrls) }));
  } catch (err) {
    next(err);
  }
});

// Get trending movies
router.get('/trending', async (req, res, next) => {
  try {
    const data = await fetchFromTMDB('/trending/movie/week');
    const results = data.results || [];
    res.json(apiResponse({ ...data, results: results.map(addImageUrls) }));
  } catch (err) {
    next(err);
  }
});

// Add TMDB movie to local database and group watchlist
router.post(
  '/add-to-group',
  requireAuth,
  requireFields('tmdbMovie', 'groupId'),
  async (req, res, next) => {
    const { tmdbMovie, groupId } = req.body;
    const userId = req.session.userId;

    if (!isPositiveInt(groupId)) return next(apiError('Invalid groupId', 400));

    try {
      if (!(await verifyMembership(groupId, userId))) {
        return next(apiError('Not a member of this group', 403));
      }

      // Upsert movie
      let movieId;
      const [existingMovie] = await pool.query(
        'SELECT movie_id FROM Movies WHERE tmdb_id = ?',
        [tmdbMovie.id]
      );

      if (existingMovie.length > 0) {
        movieId = existingMovie[0].movie_id;
      } else {
        const movieData = mapTMDBMovie(tmdbMovie);
        const [result] = await pool.query(
          'INSERT INTO Movies (title, runtime_minutes, genre, release_year, rating, poster_url, tmdb_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [movieData.title, movieData.runtime_minutes, movieData.genre, movieData.release_year, movieData.rating, movieData.poster_url, movieData.tmdb_id]
        );
        movieId = result.insertId;
      }

      // Use INSERT IGNORE for race-condition safety
      const [result] = await pool.query(
        'INSERT IGNORE INTO Group_Watchlist (group_id, movie_id, added_by, added_at) VALUES (?, ?, ?, NOW())',
        [groupId, movieId, userId]
      );

      if (result.affectedRows === 0) {
        return next(apiError('Movie already in group watchlist', 400));
      }

      res.json(apiResponse({ movieId }, 'Movie added to group watchlist successfully'));
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
