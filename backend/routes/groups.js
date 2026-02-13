const { Router } = require('express');
const { pool, withTransaction } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateParamId, requireFields, sanitizeBody } = require('../middleware/validate');
const { parsePagination, paginatedResponse, apiResponse, apiError, isPositiveInt } = require('../utils/helpers');
const { MOVIE_NIGHT_STATUS, GROUP_MEMBER_ROLE } = require('../utils/constants');
const { buildMovieNightIcs, toIcsFilename } = require('../utils/ics');
const logger = require('../utils/logger');

const router = Router();
const MOVIE_NIGHT_STATUS_VALUES = new Set(Object.values(MOVIE_NIGHT_STATUS));
const GROUP_ROLE_RANK = {
  [GROUP_MEMBER_ROLE.MEMBER]: 1,
  [GROUP_MEMBER_ROLE.MODERATOR]: 2,
  [GROUP_MEMBER_ROLE.OWNER]: 3,
};

function isMissingColumnError(err) {
  return err && err.code === 'ER_BAD_FIELD_ERROR';
}

function normalizeGroupRole(role, isCreator = false) {
  if (role === GROUP_MEMBER_ROLE.OWNER || role === GROUP_MEMBER_ROLE.MODERATOR || role === GROUP_MEMBER_ROLE.MEMBER) {
    return role;
  }
  return isCreator ? GROUP_MEMBER_ROLE.OWNER : GROUP_MEMBER_ROLE.MEMBER;
}

function hasMinimumRole(role, minimumRole) {
  return (GROUP_ROLE_RANK[role] || 0) >= (GROUP_ROLE_RANK[minimumRole] || 0);
}

async function getGroupMemberContext(groupId, userId, conn = pool) {
  try {
    const [rows] = await conn.query(
      `SELECT gm.group_id, gm.user_id, gm.role, mg.created_by
       FROM Group_Members gm
       JOIN Movie_Groups mg ON gm.group_id = mg.group_id
       WHERE gm.group_id = ? AND gm.user_id = ? AND mg.deleted_at IS NULL`,
      [groupId, userId]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      group_id: Number(row.group_id),
      user_id: Number(row.user_id),
      role: normalizeGroupRole(row.role, Number(row.created_by) === Number(userId)),
      created_by: Number(row.created_by),
    };
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    const [rows] = await conn.query(
      `SELECT gm.group_id, gm.user_id, mg.created_by
       FROM Group_Members gm
       JOIN Movie_Groups mg ON gm.group_id = mg.group_id
       WHERE gm.group_id = ? AND gm.user_id = ? AND mg.deleted_at IS NULL`,
      [groupId, userId]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    const isCreator = Number(row.created_by) === Number(userId);
    return {
      group_id: Number(row.group_id),
      user_id: Number(row.user_id),
      role: isCreator ? GROUP_MEMBER_ROLE.OWNER : GROUP_MEMBER_ROLE.MEMBER,
      created_by: Number(row.created_by),
    };
  }
}

async function ensureGroupContext(req, paramName = 'groupId', conn = pool) {
  const groupId = Number(req.params[paramName]);
  if (
    req.groupContext
    && req.groupContext.group_id === groupId
    && req.groupContext.user_id === Number(req.session.userId)
  ) {
    return req.groupContext;
  }

  const context = await getGroupMemberContext(groupId, req.session.userId, conn);
  if (context) req.groupContext = context;
  return context;
}

async function insertGroupMember(conn, groupId, userId, role = GROUP_MEMBER_ROLE.MEMBER, ignore = false) {
  try {
    const sql = ignore
      ? 'INSERT IGNORE INTO Group_Members (group_id, user_id, role, joined_at) VALUES (?, ?, ?, NOW())'
      : 'INSERT INTO Group_Members (group_id, user_id, role, joined_at) VALUES (?, ?, ?, NOW())';
    const [result] = await conn.query(sql, [groupId, userId, role]);
    return result;
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    const sql = ignore
      ? 'INSERT IGNORE INTO Group_Members (group_id, user_id, joined_at) VALUES (?, ?, NOW())'
      : 'INSERT INTO Group_Members (group_id, user_id, joined_at) VALUES (?, ?, NOW())';
    const [result] = await conn.query(sql, [groupId, userId]);
    return result;
  }
}

function requireMembership(paramName = 'groupId') {
  return async (req, _res, next) => {
    const context = await ensureGroupContext(req, paramName);
    if (!context) {
      return next(apiError('Not a member of this group', 403));
    }
    next();
  };
}

function requireRole(minimumRole, paramName = 'groupId') {
  return async (req, _res, next) => {
    const context = await ensureGroupContext(req, paramName);
    if (!context) {
      return next(apiError('Not a member of this group', 403));
    }
    if (!hasMinimumRole(context.role, minimumRole)) {
      return next(apiError(`Requires ${minimumRole} role or higher`, 403));
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
  try {
    const [rows] = await pool.query(
      `SELECT mn.night_id, mn.group_id, mn.scheduled_date, mn.status, mn.is_locked, mn.created_at,
              mg.group_name, m.title AS movie_title
       FROM Movie_Nights mn
       JOIN Movie_Groups mg ON mn.group_id = mg.group_id
       LEFT JOIN Movies m ON mn.chosen_movie_id = m.movie_id
       WHERE mn.group_id = ? AND mn.night_id = ?`,
      [groupId, nightId]
    );
    return rows[0] || null;
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    const [rows] = await pool.query(
      `SELECT mn.night_id, mn.group_id, mn.scheduled_date, mn.status, mn.created_at,
              mg.group_name, m.title AS movie_title
       FROM Movie_Nights mn
       JOIN Movie_Groups mg ON mn.group_id = mg.group_id
       LEFT JOIN Movies m ON mn.chosen_movie_id = m.movie_id
       WHERE mn.group_id = ? AND mn.night_id = ?`,
      [groupId, nightId]
    );
    if (rows.length === 0) return null;
    return { ...rows[0], is_locked: 0 };
  }
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

        await insertGroupMember(conn, groupId, userId, GROUP_MEMBER_ROLE.OWNER);

        return { group_id: groupId, group_name: groupName, created_by: userId, user_role: GROUP_MEMBER_ROLE.OWNER };
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

    let rows;
    try {
      [rows] = await pool.query(
        `SELECT g.*, u.name as creator_name, gm.role AS user_role
         FROM Movie_Groups g
         JOIN Group_Members gm ON g.group_id = gm.group_id
         JOIN Users u ON g.created_by = u.user_id
         WHERE gm.user_id = ? AND g.deleted_at IS NULL
         ORDER BY g.created_at DESC
         LIMIT ? OFFSET ?`,
        [req.session.userId, limit, offset]
      );
    } catch (err) {
      if (!isMissingColumnError(err)) throw err;
      const [legacyRows] = await pool.query(
        `SELECT g.*, u.name as creator_name
         FROM Movie_Groups g
         JOIN Group_Members gm ON g.group_id = gm.group_id
         JOIN Users u ON g.created_by = u.user_id
         WHERE gm.user_id = ? AND g.deleted_at IS NULL
         ORDER BY g.created_at DESC
         LIMIT ? OFFSET ?`,
        [req.session.userId, limit, offset]
      );
      rows = legacyRows.map((group) => ({
        ...group,
        user_role: Number(group.created_by) === Number(req.session.userId)
          ? GROUP_MEMBER_ROLE.OWNER
          : GROUP_MEMBER_ROLE.MEMBER,
      }));
    }

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
  requireMembership(),
  async (req, res, next) => {
    const { groupId } = req.params;

    try {
      if (!req.groupContext || req.groupContext.role !== GROUP_MEMBER_ROLE.OWNER) {
        return next(apiError('Only the group owner can delete this group', 403));
      }

      const [result] = await pool.query(
        'UPDATE Movie_Groups SET deleted_at = NOW() WHERE group_id = ? AND deleted_at IS NULL',
        [groupId]
      );
      if (result.affectedRows === 0) return next(apiError('Group not found', 404));
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
      let rows;
      try {
        [rows] = await pool.query(
          `SELECT u.user_id, u.name, u.email, gm.joined_at, gm.role
           FROM Users u
           JOIN Group_Members gm ON u.user_id = gm.user_id
           WHERE gm.group_id = ? AND u.deleted_at IS NULL
           ORDER BY gm.joined_at ASC`,
          [req.params.groupId]
        );
      } catch (err) {
        if (!isMissingColumnError(err)) throw err;
        const [legacyRows] = await pool.query(
          `SELECT u.user_id, u.name, u.email, gm.joined_at
           FROM Users u
           JOIN Group_Members gm ON u.user_id = gm.user_id
           JOIN Movie_Groups mg ON gm.group_id = mg.group_id
           WHERE gm.group_id = ? AND u.deleted_at IS NULL
           ORDER BY gm.joined_at ASC`,
          [req.params.groupId]
        );
        rows = legacyRows.map((member) => ({
          ...member,
          role: Number(member.user_id) === Number(req.groupContext.created_by)
            ? GROUP_MEMBER_ROLE.OWNER
            : GROUP_MEMBER_ROLE.MEMBER,
        }));
      }
      rows = rows.map((member) => ({
        ...member,
        role: normalizeGroupRole(member.role, Number(member.user_id) === Number(req.groupContext.created_by)),
      }));
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
  requireRole(GROUP_MEMBER_ROLE.MODERATOR),
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
      const result = await insertGroupMember(pool, groupId, newMember.user_id, GROUP_MEMBER_ROLE.MEMBER, true);

      if (result.affectedRows === 0) {
        return next(apiError('User is already a member', 400));
      }

      res.json(apiResponse(
        { user_id: newMember.user_id, name: newMember.name, email: newMember.email, role: GROUP_MEMBER_ROLE.MEMBER },
        'Member added successfully'
      ));
    } catch (err) {
      next(err);
    }
  }
);

// Update member role (owner only)
router.patch(
  '/:groupId/members/:memberId/role',
  requireAuth,
  validateParamId('groupId', 'memberId'),
  requireRole(GROUP_MEMBER_ROLE.OWNER),
  sanitizeBody('role'),
  requireFields('role'),
  async (req, res, next) => {
    const { groupId, memberId } = req.params;
    const requestedRole = String(req.body.role || '').toLowerCase();

    if (
      requestedRole !== GROUP_MEMBER_ROLE.OWNER
      && requestedRole !== GROUP_MEMBER_ROLE.MODERATOR
      && requestedRole !== GROUP_MEMBER_ROLE.MEMBER
    ) {
      return next(apiError('Invalid role. Expected owner, moderator, or member', 400));
    }

    try {
      const result = await withTransaction(async (conn) => {
        const actorContext = await getGroupMemberContext(groupId, req.session.userId, conn);
        if (!actorContext || actorContext.role !== GROUP_MEMBER_ROLE.OWNER) {
          throw apiError('Only the group owner can manage member roles', 403);
        }

        const targetContext = await getGroupMemberContext(groupId, memberId, conn);
        if (!targetContext) throw apiError('Member not found in this group', 404);

        if (
          Number(targetContext.user_id) === Number(req.session.userId)
          && requestedRole !== GROUP_MEMBER_ROLE.OWNER
        ) {
          throw apiError('Owner role cannot be removed from yourself', 400);
        }

        if (requestedRole === GROUP_MEMBER_ROLE.OWNER) {
          if (targetContext.role === GROUP_MEMBER_ROLE.OWNER) {
            return { transferred: false, role: GROUP_MEMBER_ROLE.OWNER };
          }

          try {
            await conn.query(
              'UPDATE Group_Members SET role = ? WHERE group_id = ? AND user_id = ?',
              [GROUP_MEMBER_ROLE.MODERATOR, groupId, req.session.userId]
            );
            await conn.query(
              'UPDATE Group_Members SET role = ? WHERE group_id = ? AND user_id = ?',
              [GROUP_MEMBER_ROLE.OWNER, groupId, memberId]
            );
          } catch (err) {
            if (!isMissingColumnError(err)) throw err;
            throw apiError('Group roles require the latest database migration', 500);
          }

          return { transferred: true, role: GROUP_MEMBER_ROLE.OWNER };
        }

        if (targetContext.role === GROUP_MEMBER_ROLE.OWNER) {
          throw apiError('Transfer ownership to another member before changing owner role', 400);
        }

        try {
          await conn.query(
            'UPDATE Group_Members SET role = ? WHERE group_id = ? AND user_id = ?',
            [requestedRole, groupId, memberId]
          );
        } catch (err) {
          if (!isMissingColumnError(err)) throw err;
          throw apiError('Group roles require the latest database migration', 500);
        }

        return { transferred: false, role: requestedRole };
      });

      const message = result.transferred
        ? 'Ownership transferred successfully'
        : 'Member role updated successfully';
      res.json(apiResponse({ role: result.role }, message));
    } catch (err) {
      next(err);
    }
  }
);

// Remove a member (moderator or owner)
router.delete(
  '/:groupId/members/:memberId',
  requireAuth,
  validateParamId('groupId', 'memberId'),
  requireRole(GROUP_MEMBER_ROLE.MODERATOR),
  async (req, res, next) => {
    const { groupId, memberId } = req.params;
    const actorId = Number(req.session.userId);
    const targetId = Number(memberId);

    if (actorId === targetId) {
      return next(apiError('Use a dedicated leave-group flow to remove yourself', 400));
    }

    try {
      await withTransaction(async (conn) => {
        const actorContext = await getGroupMemberContext(groupId, actorId, conn);
        if (!actorContext) throw apiError('Not a member of this group', 403);

        const targetContext = await getGroupMemberContext(groupId, targetId, conn);
        if (!targetContext) throw apiError('Member not found in this group', 404);

        if (targetContext.role === GROUP_MEMBER_ROLE.OWNER) {
          throw apiError('Transfer ownership before removing the owner', 400);
        }

        if (
          actorContext.role === GROUP_MEMBER_ROLE.MODERATOR
          && targetContext.role !== GROUP_MEMBER_ROLE.MEMBER
        ) {
          throw apiError('Moderators can only remove members', 403);
        }

        const [result] = await conn.query(
          'DELETE FROM Group_Members WHERE group_id = ? AND user_id = ?',
          [groupId, targetId]
        );
        if (result.affectedRows === 0) throw apiError('Member not found in this group', 404);
      });

      res.json(apiResponse(null, 'Member removed successfully'));
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
        is_locked: false,
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
      if (movieNight.is_locked && !hasMinimumRole(req.groupContext.role, GROUP_MEMBER_ROLE.MODERATOR)) {
        return next(apiError('This movie night is locked. Ask a moderator or owner to update it.', 403));
      }

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

// Lock or unlock a movie night schedule (moderator/owner)
router.patch(
  '/:groupId/movie-nights/:nightId/lock',
  requireAuth,
  validateParamId('groupId', 'nightId'),
  requireRole(GROUP_MEMBER_ROLE.MODERATOR),
  requireFields('locked'),
  async (req, res, next) => {
    const { groupId, nightId } = req.params;
    const { locked } = req.body;

    if (typeof locked !== 'boolean') {
      return next(apiError('locked must be a boolean value', 400));
    }

    try {
      const movieNight = await getMovieNightForGroup(groupId, nightId);
      if (!movieNight) return next(apiError('Movie night not found', 404));

      try {
        await pool.query(
          'UPDATE Movie_Nights SET is_locked = ? WHERE night_id = ? AND group_id = ?',
          [locked ? 1 : 0, nightId, groupId]
        );
      } catch (err) {
        if (!isMissingColumnError(err)) throw err;
        return next(apiError('Movie-night locking requires the latest database migration', 500));
      }

      res.json(apiResponse({ night_id: Number(nightId), is_locked: locked }, locked ? 'Movie night locked' : 'Movie night unlocked'));
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
    const { groupId, nightId } = req.params;
    const { isAvailable } = req.body;

    if (isAvailable === undefined) return next(apiError('isAvailable is required', 400));

    try {
      const movieNight = await getMovieNightForGroup(groupId, nightId);
      if (!movieNight) return next(apiError('Movie night not found', 404));

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
    const { groupId, nightId } = req.params;

    try {
      const movieNight = await getMovieNightForGroup(groupId, nightId);
      if (!movieNight) return next(apiError('Movie night not found', 404));

      const [rows] = await pool.query(
        `SELECT a.*, u.name, u.email
         FROM Availability a
         JOIN Users u ON a.user_id = u.user_id
         WHERE a.night_id = ?`,
        [nightId]
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
