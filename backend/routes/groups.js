const { Router } = require('express');
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// Helper: verify user is a member of the group
async function verifyMembership(groupId, userId) {
  const [rows] = await pool.query(
    'SELECT 1 FROM Group_Members WHERE group_id = ? AND user_id = ?',
    [groupId, userId]
  );
  return rows.length > 0;
}

// Create group
router.post('/', requireAuth, async (req, res, next) => {
  const { groupName } = req.body;
  const userId = req.session.userId;

  if (!groupName) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO Movie_Groups (group_name, created_by, created_at) VALUES (?, ?, NOW())',
      [groupName, userId]
    );

    const groupId = result.insertId;

    await pool.query(
      'INSERT INTO Group_Members (group_id, user_id, joined_at) VALUES (?, ?, NOW())',
      [groupId, userId]
    );

    res.status(201).json({
      message: 'Group created successfully',
      group: { group_id: groupId, group_name: groupName, created_by: userId },
    });
  } catch (err) {
    next(err);
  }
});

// Get user's groups
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT g.*, u.name as creator_name
       FROM Movie_Groups g
       JOIN Group_Members gm ON g.group_id = gm.group_id
       JOIN Users u ON g.created_by = u.user_id
       WHERE gm.user_id = ?
       ORDER BY g.created_at DESC`,
      [req.session.userId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Get group members
router.get('/:groupId/members', requireAuth, async (req, res, next) => {
  const { groupId } = req.params;

  try {
    if (!(await verifyMembership(groupId, req.session.userId))) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const [rows] = await pool.query(
      `SELECT u.user_id, u.name, u.email, gm.joined_at
       FROM Users u
       JOIN Group_Members gm ON u.user_id = gm.user_id
       WHERE gm.group_id = ?
       ORDER BY gm.joined_at ASC`,
      [groupId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Add member by email
router.post('/:groupId/members', requireAuth, async (req, res, next) => {
  const { groupId } = req.params;
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    if (!(await verifyMembership(groupId, req.session.userId))) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const [users] = await pool.query('SELECT * FROM Users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newMember = users[0];

    const [existingMember] = await pool.query(
      'SELECT 1 FROM Group_Members WHERE group_id = ? AND user_id = ?',
      [groupId, newMember.user_id]
    );
    if (existingMember.length > 0) {
      return res.status(400).json({ error: 'User is already a member' });
    }

    await pool.query(
      'INSERT INTO Group_Members (group_id, user_id, joined_at) VALUES (?, ?, NOW())',
      [groupId, newMember.user_id]
    );

    res.json({
      message: 'Member added successfully',
      member: { user_id: newMember.user_id, name: newMember.name, email: newMember.email },
    });
  } catch (err) {
    next(err);
  }
});

// Create movie night
router.post('/:groupId/movie-nights', requireAuth, async (req, res, next) => {
  const { groupId } = req.params;
  const { scheduledDate, chosenMovieId } = req.body;

  if (!scheduledDate) {
    return res.status(400).json({ error: 'Scheduled date is required' });
  }

  try {
    if (!(await verifyMembership(groupId, req.session.userId))) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const [result] = await pool.query(
      'INSERT INTO Movie_Nights (group_id, scheduled_date, chosen_movie_id, status) VALUES (?, ?, ?, ?)',
      [groupId, scheduledDate, chosenMovieId || null, 'planned']
    );

    res.status(201).json({
      message: 'Movie night created successfully',
      movieNight: {
        night_id: result.insertId,
        group_id: groupId,
        scheduled_date: scheduledDate,
        chosen_movie_id: chosenMovieId,
        status: 'planned',
      },
    });
  } catch (err) {
    next(err);
  }
});

// Get group movie nights
router.get('/:groupId/movie-nights', requireAuth, async (req, res, next) => {
  const { groupId } = req.params;

  try {
    if (!(await verifyMembership(groupId, req.session.userId))) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const [rows] = await pool.query(
      `SELECT mn.*, m.title as movie_title, m.poster_url, m.rating
       FROM Movie_Nights mn
       LEFT JOIN Movies m ON mn.chosen_movie_id = m.movie_id
       WHERE mn.group_id = ?
       ORDER BY mn.scheduled_date DESC`,
      [groupId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Add movie to group watchlist
router.post('/:groupId/watchlist', requireAuth, async (req, res, next) => {
  const { groupId } = req.params;
  const { movieId } = req.body;
  const userId = req.session.userId;

  if (!movieId) {
    return res.status(400).json({ error: 'Movie ID is required' });
  }

  try {
    if (!(await verifyMembership(groupId, userId))) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const [existing] = await pool.query(
      'SELECT 1 FROM Group_Watchlist WHERE group_id = ? AND movie_id = ?',
      [groupId, movieId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Movie already in watchlist' });
    }

    await pool.query(
      'INSERT INTO Group_Watchlist (group_id, movie_id, added_by, added_at) VALUES (?, ?, ?, NOW())',
      [groupId, movieId, userId]
    );

    res.json({ message: 'Movie added to watchlist successfully' });
  } catch (err) {
    next(err);
  }
});

// Get group watchlist
router.get('/:groupId/watchlist', requireAuth, async (req, res, next) => {
  const { groupId } = req.params;

  try {
    if (!(await verifyMembership(groupId, req.session.userId))) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const [rows] = await pool.query(
      `SELECT gw.*, m.title, m.poster_url, m.rating, m.release_year, u.name as added_by_name
       FROM Group_Watchlist gw
       JOIN Movies m ON gw.movie_id = m.movie_id
       JOIN Users u ON gw.added_by = u.user_id
       WHERE gw.group_id = ?
       ORDER BY gw.added_at DESC`,
      [groupId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Get votes for a movie in a group
router.get('/:groupId/movies/:movieId/votes', requireAuth, async (req, res, next) => {
  const { groupId, movieId } = req.params;

  try {
    if (!(await verifyMembership(groupId, req.session.userId))) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const [rows] = await pool.query(
      `SELECT mv.*, u.name as voter_name
       FROM Movie_Votes mv
       JOIN Users u ON mv.user_id = u.user_id
       WHERE mv.group_id = ? AND mv.movie_id = ?
       ORDER BY mv.voted_at DESC`,
      [groupId, movieId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
