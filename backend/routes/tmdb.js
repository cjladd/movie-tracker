const { Router } = require('express');
const { pool } = require('../config/database');
const { fetchFromTMDB, mapTMDBMovie, addImageUrls } = require('../config/tmdb');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// Seed database with popular TMDB movies
router.post('/seed', async (req, res, next) => {
  try {
    const popularMovies = await fetchFromTMDB('/movie/popular');

    let insertedCount = 0;

    // Ensure tmdb_id column exists (safe to call repeatedly)
    try {
      await pool.query('ALTER TABLE Movies ADD COLUMN tmdb_id INT UNIQUE');
    } catch (_e) {
      // Column already exists — ignore
    }

    for (const tmdbMovie of popularMovies.results) {
      const movieData = mapTMDBMovie(tmdbMovie);

      const [existing] = await pool.query(
        'SELECT movie_id FROM Movies WHERE title = ? OR (tmdb_id IS NOT NULL AND tmdb_id = ?)',
        [movieData.title, movieData.tmdb_id]
      );

      if (existing.length === 0) {
        await pool.query(
          'INSERT INTO Movies (title, runtime_minutes, genre, release_year, rating, poster_url, tmdb_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [movieData.title, movieData.runtime_minutes, movieData.genre, movieData.release_year, movieData.rating, movieData.poster_url, movieData.tmdb_id]
        );
        insertedCount++;
      }
    }

    res.json({ message: `Successfully seeded ${insertedCount} movies from TMDB` });
  } catch (err) {
    next(err);
  }
});

// Search movies via TMDB
router.get('/search', async (req, res, next) => {
  const { query, page = 1 } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const searchResults = await fetchFromTMDB(
      `/search/movie?query=${encodeURIComponent(query)}&page=${page}`
    );

    res.json({
      ...searchResults,
      results: searchResults.results.map(addImageUrls),
    });
  } catch (err) {
    next(err);
  }
});

// Get movie details by TMDB ID
router.get('/movie/:tmdbId', async (req, res, next) => {
  const { tmdbId } = req.params;

  try {
    const [movieDetails, credits] = await Promise.all([
      fetchFromTMDB(`/movie/${tmdbId}`),
      fetchFromTMDB(`/movie/${tmdbId}/credits`),
    ]);

    res.json({
      ...addImageUrls(movieDetails),
      cast: credits.cast.slice(0, 10),
      crew: credits.crew.filter((p) =>
        ['Director', 'Producer', 'Writer'].includes(p.job)
      ),
    });
  } catch (err) {
    next(err);
  }
});

// Get popular movies
router.get('/popular', async (req, res, next) => {
  const { page = 1 } = req.query;

  try {
    const popularMovies = await fetchFromTMDB(`/movie/popular?page=${page}`);
    res.json({
      ...popularMovies,
      results: popularMovies.results.map(addImageUrls),
    });
  } catch (err) {
    next(err);
  }
});

// Get trending movies
router.get('/trending', async (req, res, next) => {
  try {
    const trendingMovies = await fetchFromTMDB('/trending/movie/week');
    res.json({
      ...trendingMovies,
      results: trendingMovies.results.map(addImageUrls),
    });
  } catch (err) {
    next(err);
  }
});

// Add TMDB movie to local database and group watchlist
router.post('/add-to-group', requireAuth, async (req, res, next) => {
  const { tmdbMovie, groupId } = req.body;
  const userId = req.session.userId;

  if (!tmdbMovie || !groupId) {
    return res.status(400).json({ error: 'Movie data and group ID are required' });
  }

  try {
    // Check membership
    const [membership] = await pool.query(
      'SELECT 1 FROM Group_Members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );
    if (membership.length === 0) {
      return res.status(403).json({ error: 'Not a member of this group' });
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

    // Check if already in watchlist
    const [existingWatchlist] = await pool.query(
      'SELECT 1 FROM Group_Watchlist WHERE group_id = ? AND movie_id = ?',
      [groupId, movieId]
    );
    if (existingWatchlist.length > 0) {
      return res.status(400).json({ error: 'Movie already in group watchlist' });
    }

    // Add to watchlist
    await pool.query(
      'INSERT INTO Group_Watchlist (group_id, movie_id, added_by, added_at) VALUES (?, ?, ?, NOW())',
      [groupId, movieId, userId]
    );

    res.json({ message: 'Movie added to group watchlist successfully', movieId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
