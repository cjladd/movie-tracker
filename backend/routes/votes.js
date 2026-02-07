const { Router } = require('express');
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// Vote on a movie
router.post('/', requireAuth, async (req, res, next) => {
  const { groupId, movieId, voteValue } = req.body;
  const userId = req.session.userId;

  if (!groupId || !movieId || !voteValue) {
    return res.status(400).json({ error: 'Group ID, movie ID, and vote value are required' });
  }

  if (voteValue < 1 || voteValue > 5) {
    return res.status(400).json({ error: 'Vote value must be between 1 and 5' });
  }

  try {
    const [membership] = await pool.query(
      'SELECT 1 FROM Group_Members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );
    if (membership.length === 0) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    await pool.query(
      `INSERT INTO Movie_Votes (user_id, group_id, movie_id, vote_value, voted_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE vote_value = ?, voted_at = NOW()`,
      [userId, groupId, movieId, voteValue, voteValue]
    );

    res.json({ message: 'Vote recorded successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
