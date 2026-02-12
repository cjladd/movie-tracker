const { Router } = require('express');
const { pool, withTransaction } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateParamId, requireFields, sanitizeBody } = require('../middleware/validate');
const { verifyMembership, parsePagination, paginatedResponse, apiResponse, apiError, isPositiveInt } = require('../utils/helpers');
const { MOVIE_NIGHT_STATUS } = require('../utils/constants');
const { buildMovieNightIcs, toIcsFilename } = require('../utils/ics');
const logger = require('../utils/logger');

const router = Router();
const MOVIE_NIGHT_STATUS_VALUES = new Set(Object.values(MOVIE_NIGHT_STATUS));

function requireMembership(paramName = 'groupId') {
  return async (req, _res, next) => {
    const groupId = req.params[paramName];
    if (!(await verifyMembership(groupId, req.session.userId))) {
      return next(apiError('Not a member of this group', 403));
    }
    next();
  };
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function parseScheduledDateInput(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?$/);
  if (match) {
    const [, datePart, timePart, secondPart] = match;
    const sqlDateTime = `${datePart} ${timePart}:${secondPart || '00'}`;
    const date = new Date(`${datePart}T${timePart}:${secondPart || '00'}`);
    return Number.isNaN(date.getTime()) ? null : { sqlDateTime, date };
  }

  const parsedDate = new Date(trimmed);
  if (Number.isNaN(parsedDate.getTime())) return null;

  const sqlDateTime = [
    `${parsedDate.getFullYear()}-${pad2(parsedDate.getMonth() + 1)}-${pad2(parsedDate.getDate())}`,
    `${pad2(parsedDate.getHours())}:${pad2(parsedDate.getMinutes())}:${pad2(parsedDate.getSeconds())}`,
  ].join(' ');

  return { sqlDateTime, date: parsedDate };
}

function parseChosenMovieId(value) {
  if (value === undefined || value === null || value === '') return { movieId: null };
  if (!isPositiveInt(value)) return { error: 'Invalid chosenMovieId' };
  return { movieId: Number(value) };
}

async function ensureMovieInWatchlist(groupId, movieId) {
  const [rows] = await pool.query(
    'SELECT 1 FROM Group_Watchlist WHERE group_id = ? AND movie_id = ?',
    [groupId, movieId]
  );
  return rows.length > 0;
}

async function getMovieNightForGroup(groupId, nightId) {
  const [rows] = await pool.query(
    `SELECT mn.night_id, mn.group_id, mn.scheduled_date, mn.status, mn.created_at,
            mg.group_name, m.title AS movie_title
     FROM Movie_Nights mn
     JOIN Movie_Groups mg ON mn.group_id = mg.group_id
     LEFT JOIN Movies m ON mn.chosen_movie_id = m.movie_id
     WHERE mn.group_id = ? AND mn.night_id = ?`,
    [groupId, nightId]
  );
  return rows[0] || null;
}

// Create group (with transaction)
router.post(
  '/',
  requireAuth,
  sanitizeBody('groupName'),
  requireFields('groupName'),
  async (req, res, next) => {
    const { groupName } = req.body;
    const userId = req.session.userId;

    try {
      const group = await withTransaction(async (conn) => {
        const [result] = await conn.query(
          'INSERT INTO Movie_Groups (group_name, created_by, created_at) VALUES (?, ?, NOW())',
          [groupName, userId]
        );
        const groupId = result.insertId;

        await conn.query(
          'INSERT INTO Group_Members (group_id, user_id, joined_at) VALUES (?, ?, NOW())',
          [groupId, userId]
        );

        return { group_id: groupId, group_name: groupName, created_by: userId };
      });

      logger.info(`Group created: ${group.group_id} by user ${userId}`);
      res.status(201).json(apiResponse(group, 'Group created successfully'));
    } catch (err) {
      next(err);
    }
  }
);

// Get user's groups (paginated)
router.get('/', requireAuth, async (req, res, next) => {
  const { page, limit, offset } = parsePagination(req.query);

  try {
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM Group_Members gm JOIN Movie_Groups mg ON gm.group_id = mg.group_id WHERE gm.user_id = ? AND mg.deleted_at IS NULL',
      [req.session.userId]
    );

    const [rows] = await pool.query(
      `SELECT g.*, u.name as creator_name
       FROM Movie_Groups g
       JOIN Group_Members gm ON g.group_id = gm.group_id
       JOIN Users u ON g.created_by = u.user_id
       WHERE gm.user_id = ? AND g.deleted_at IS NULL
       ORDER BY g.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.session.userId, limit, offset]
    );

    res.json(paginatedResponse(rows, total, page, limit));
  } catch (err) {
    next(err);
  }
});

// Delete group (soft delete, owner only)
router.delete(
  '/:groupId',
  requireAuth,
  validateParamId('groupId'),
  async (req, res, next) => {
    const { groupId } = req.params;

    try {
      const [group] = await pool.query(
        'SELECT created_by FROM Movie_Groups WHERE group_id = ? AND deleted_at IS NULL',
        [groupId]
      );
      if (group.length === 0) return next(apiError('Group not found', 404));
      if (group[0].created_by !== req.session.userId) {
        return next(apiError('Only the group creator can delete this group', 403));
      }

      await pool.query('UPDATE Movie_Groups SET deleted_at = NOW() WHERE group_id = ?', [groupId]);
      logger.info(`Group deleted: ${groupId}`);
      res.json(apiResponse(null, 'Group deleted'));
    } catch (err) {
      next(err);
    }
  }
);

// Get group members
router.get(
  '/:groupId/members',
  requireAuth,
  validateParamId('groupId'),
  requireMembership(),
  async (req, res, next) => {
    try {
      const [rows] = await pool.query(
        `SELECT u.user_id, u.name, u.email, gm.joined_at
         FROM Users u
         JOIN Group_Members gm ON u.user_id = gm.user_id
         WHERE gm.group_id = ? AND u.deleted_at IS NULL
         ORDER BY gm.joined_at ASC`,
        [req.params.groupId]
      );
      res.json(apiResponse(rows));
    } catch (err) {
      next(err);
    }
  }
);

// Add member by email
router.post(
  '/:groupId/members',
  requireAuth,
  validateParamId('groupId'),
  requireMembership(),
  sanitizeBody('email'),
  requireFields('email'),
  async (req, res, next) => {
    const { groupId } = req.params;
    const { email } = req.body;

    try {
      const [users] = await pool.query('SELECT user_id, name, email FROM Users WHERE email = ? AND deleted_at IS NULL', [email]);
      if (users.length === 0) return next(apiError('User not found', 404));

      const newMember = users[0];

      // Use INSERT IGNORE to handle race condition
      const [result] = await pool.query(
        'INSERT IGNORE INTO Group_Members (group_id, user_id, joined_at) VALUES (?, ?, NOW())',
        [groupId, newMember.user_id]
      );

      if (result.affectedRows === 0) {
        return next(apiError('User is already a member', 400));
      }

      res.json(apiResponse(
        { user_id: newMember.user_id, name: newMember.name, email: newMember.email },
        'Member added successfully'
      ));
    } catch (err) {
      next(err);
    }
  }
);

// Create movie night
router.post(
  '/:groupId/movie-nights',
  requireAuth,
  validateParamId('groupId'),
  requireMembership(),
  requireFields('scheduledDate'),
  async (req, res, next) => {
    const { groupId } = req.params;
    const { scheduledDate, chosenMovieId } = req.body;

    try {
      const parsedScheduledDate = parseScheduledDateInput(scheduledDate);
      if (!parsedScheduledDate) return next(apiError('Invalid scheduledDate', 400));
      if (parsedScheduledDate.date.getTime() < Date.now() - 60000) {
        return next(apiError('scheduledDate must be in the future', 400));
      }

      const parsedMovieId = parseChosenMovieId(chosenMovieId);
      if (parsedMovieId.error) return next(apiError(parsedMovieId.error, 400));
      if (
        parsedMovieId.movieId !== null
        && !(await ensureMovieInWatchlist(groupId, parsedMovieId.movieId))
      ) {
        return next(apiError('Selected movie must already exist in the group watchlist', 400));
      }

      const [result] = await pool.query(
        'INSERT INTO Movie_Nights (group_id, scheduled_date, chosen_movie_id, status) VALUES (?, ?, ?, ?)',
        [groupId, parsedScheduledDate.sqlDateTime, parsedMovieId.movieId ?? null, MOVIE_NIGHT_STATUS.PLANNED]
      );

      res.status(201).json(apiResponse({
        night_id: result.insertId,
        group_id: parseInt(groupId, 10),
        scheduled_date: parsedScheduledDate.sqlDateTime,
        chosen_movie_id: parsedMovieId.movieId ?? null,
        status: MOVIE_NIGHT_STATUS.PLANNED,
      }, 'Movie night created successfully'));
    } catch (err) {
      next(err);
    }
  }
);

// Update movie night
router.put(
  '/:groupId/movie-nights/:nightId',
  requireAuth,
  validateParamId('groupId', 'nightId'),
  requireMembership(),
  async (req, res, next) => {
    const { groupId, nightId } = req.params;
    const { scheduledDate, chosenMovieId, status } = req.body;

    try {
      const movieNight = await getMovieNightForGroup(groupId, nightId);
      if (!movieNight) return next(apiError('Movie night not found', 404));

      const updates = [];
      const values = [];

      if (scheduledDate !== undefined) {
        const parsedScheduledDate = parseScheduledDateInput(scheduledDate);
        if (!parsedScheduledDate) return next(apiError('Invalid scheduledDate', 400));
        if (parsedScheduledDate.date.getTime() < Date.now() - 60000) {
          return next(apiError('scheduledDate must be in the future', 400));
        }
        updates.push('scheduled_date = ?');
        values.push(parsedScheduledDate.sqlDateTime);
      }

      if (chosenMovieId !== undefined) {
        const parsedMovieId = parseChosenMovieId(chosenMovieId);
        if (parsedMovieId.error) return next(apiError(parsedMovieId.error, 400));

        if (
          parsedMovieId.movieId !== null
          && !(await ensureMovieInWatchlist(groupId, parsedMovieId.movieId))
        ) {
          return next(apiError('Selected movie must already exist in the group watchlist', 400));
        }

        updates.push('chosen_movie_id = ?');
        values.push(parsedMovieId.movieId ?? null);
      }

      if (status !== undefined) {
        if (!MOVIE_NIGHT_STATUS_VALUES.has(status)) {
          return next(apiError('Invalid status value', 400));
        }
        updates.push('status = ?');
        values.push(status);
      }

      if (updates.length === 0) return next(apiError('No fields to update', 400));

      values.push(nightId, groupId);
      await pool.query(`UPDATE Movie_Nights SET ${updates.join(', ')} WHERE night_id = ? AND group_id = ?`, values);
      res.json(apiResponse(null, 'Movie night updated'));
    } catch (err) {
      next(err);
    }
  }
);

// Get group movie nights (paginated)
router.get(
  '/:groupId/movie-nights',
  requireAuth,
  validateParamId('groupId'),
  requireMembership(),
  async (req, res, next) => {
    const { page, limit, offset } = parsePagination(req.query);

    try {
      const [[{ total }]] = await pool.query(
        'SELECT COUNT(*) as total FROM Movie_Nights WHERE group_id = ?',
        [req.params.groupId]
      );

      const [rows] = await pool.query(
        `SELECT mn.*, m.title as movie_title, m.poster_url, m.rating
         FROM Movie_Nights mn
         LEFT JOIN Movies m ON mn.chosen_movie_id = m.movie_id
         WHERE mn.group_id = ?
         ORDER BY mn.scheduled_date ASC
         LIMIT ? OFFSET ?`,
        [req.params.groupId, limit, offset]
      );

      res.json(paginatedResponse(rows, total, page, limit));
    } catch (err) {
      next(err);
    }
  }
);

// Export a movie night event as an ICS file
router.get(
  '/:groupId/movie-nights/:nightId/ics',
  requireAuth,
  validateParamId('groupId', 'nightId'),
  requireMembership(),
  async (req, res, next) => {
    const { groupId, nightId } = req.params;

    try {
      const movieNight = await getMovieNightForGroup(groupId, nightId);
      if (!movieNight) return next(apiError('Movie night not found', 404));

      const scheduledDate = new Date(movieNight.scheduled_date);
      if (Number.isNaN(scheduledDate.getTime())) {
        return next(apiError('Movie night has an invalid schedule date', 500));
      }

      const eventTitle = movieNight.movie_title
        ? `${movieNight.group_name}: ${movieNight.movie_title}`
        : `${movieNight.group_name}: Movie Night`;
      const description = movieNight.movie_title
        ? `Stream Team: ${movieNight.group_name}\nMovie: ${movieNight.movie_title}`
        : `Stream Team: ${movieNight.group_name}\nMovie: To be decided`;

      const icsContent = buildMovieNightIcs({
        uid: `movie-night-${movieNight.night_id}@movienightplanner.local`,
        createdAt: movieNight.created_at || new Date(),
        startAt: scheduledDate,
        summary: eventTitle,
        description,
        calendarName: `${movieNight.group_name} Movie Nights`,
      });

      const filename = toIcsFilename(movieNight.group_name, scheduledDate, movieNight.night_id);
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(icsContent);
    } catch (err) {
      next(err);
    }
  }
);

// Set availability for movie night
router.post(
  '/:groupId/movie-nights/:nightId/availability',
  requireAuth,
  validateParamId('groupId', 'nightId'),
  requireMembership(),
  async (req, res, next) => {
    const { nightId } = req.params;
    const { isAvailable } = req.body;

    if (isAvailable === undefined) return next(apiError('isAvailable is required', 400));

    try {
      await pool.query(
        `INSERT INTO Availability (night_id, user_id, is_available, responded_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE is_available = ?, responded_at = NOW()`,
        [nightId, req.session.userId, isAvailable ? 1 : 0, isAvailable ? 1 : 0]
      );
      res.json(apiResponse(null, 'Availability updated'));
    } catch (err) {
      next(err);
    }
  }
);

// Get availability for movie night
router.get(
  '/:groupId/movie-nights/:nightId/availability',
  requireAuth,
  validateParamId('groupId', 'nightId'),
  requireMembership(),
  async (req, res, next) => {
    try {
      const [rows] = await pool.query(
        `SELECT a.*, u.name, u.email
         FROM Availability a
         JOIN Users u ON a.user_id = u.user_id
         WHERE a.night_id = ?`,
        [req.params.nightId]
      );
      res.json(apiResponse(rows));
    } catch (err) {
      next(err);
    }
  }
);

// Add movie to group watchlist
router.post(
  '/:groupId/watchlist',
  requireAuth,
  validateParamId('groupId'),
  requireMembership(),
  requireFields('movieId'),
  async (req, res, next) => {
    const { groupId } = req.params;
    const { movieId } = req.body;

    if (!isPositiveInt(movieId)) return next(apiError('Invalid movieId', 400));

    try {
      const [result] = await pool.query(
        'INSERT IGNORE INTO Group_Watchlist (group_id, movie_id, added_by, added_at) VALUES (?, ?, ?, NOW())',
        [groupId, movieId, req.session.userId]
      );

      if (result.affectedRows === 0) {
        return next(apiError('Movie already in watchlist', 400));
      }

      res.json(apiResponse(null, 'Movie added to watchlist successfully'));
    } catch (err) {
      next(err);
    }
  }
);

// Remove movie from watchlist
router.delete(
  '/:groupId/watchlist/:movieId',
  requireAuth,
  validateParamId('groupId', 'movieId'),
  requireMembership(),
  async (req, res, next) => {
    const { groupId, movieId } = req.params;

    try {
      const [result] = await pool.query(
        'DELETE FROM Group_Watchlist WHERE group_id = ? AND movie_id = ?',
        [groupId, movieId]
      );
      if (result.affectedRows === 0) return next(apiError('Movie not in watchlist', 404));
      res.json(apiResponse(null, 'Movie removed from watchlist'));
    } catch (err) {
      next(err);
    }
  }
);

// Get group watchlist (paginated, sortable)
router.get(
  '/:groupId/watchlist',
  requireAuth,
  validateParamId('groupId'),
  requireMembership(),
  async (req, res, next) => {
    const { page, limit, offset } = parsePagination(req.query);
    const sort = req.query.sort === 'rating' ? 'm.rating DESC' : 'gw.added_at DESC';

    try {
      const [[{ total }]] = await pool.query(
        'SELECT COUNT(*) as total FROM Group_Watchlist WHERE group_id = ?',
        [req.params.groupId]
      );

      const [rows] = await pool.query(
        `SELECT gw.*, m.title, m.poster_url, m.rating, m.release_year, m.genre, u.name as added_by_name
         FROM Group_Watchlist gw
         JOIN Movies m ON gw.movie_id = m.movie_id
         LEFT JOIN Users u ON gw.added_by = u.user_id
         WHERE gw.group_id = ?
         ORDER BY ${sort}
         LIMIT ? OFFSET ?`,
        [req.params.groupId, limit, offset]
      );

      res.json(paginatedResponse(rows, total, page, limit));
    } catch (err) {
      next(err);
    }
  }
);

// Get votes for a movie in a group
router.get(
  '/:groupId/movies/:movieId/votes',
  requireAuth,
  validateParamId('groupId', 'movieId'),
  requireMembership(),
  async (req, res, next) => {
    try {
      const [rows] = await pool.query(
        `SELECT mv.*, u.name as voter_name
         FROM Movie_Votes mv
         JOIN Users u ON mv.user_id = u.user_id
         WHERE mv.group_id = ? AND mv.movie_id = ?
         ORDER BY mv.voted_at DESC`,
        [req.params.groupId, req.params.movieId]
      );
      res.json(apiResponse(rows));
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
