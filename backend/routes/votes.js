const { Router } = require('express');
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { requireFields } = require('../middleware/validate');
const { verifyMembership, apiResponse, apiError, isPositiveInt } = require('../utils/helpers');
const { VOTE_MIN, VOTE_MAX } = require('../utils/constants');

const router = Router();

router.post(
  '/',
  requireAuth,
  requireFields('groupId', 'movieId', 'voteValue'),
  async (req, res, next) => {
    const { groupId, movieId, voteValue } = req.body;
    const userId = req.session.userId;

    if (!isPositiveInt(groupId) || !isPositiveInt(movieId)) {
      return next(apiError('Invalid groupId or movieId', 400));
    }

    const vote = parseInt(voteValue, 10);
    if (!Number.isInteger(vote) || vote < VOTE_MIN || vote > VOTE_MAX) {
      return next(apiError(`Vote value must be between ${VOTE_MIN} and ${VOTE_MAX}`, 400));
    }

    try {
      if (!(await verifyMembership(groupId, userId))) {
        return next(apiError('Not a member of this group', 403));
      }

      await pool.query(
        `INSERT INTO Movie_Votes (user_id, group_id, movie_id, vote_value, voted_at)
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE vote_value = ?, voted_at = NOW()`,
        [userId, groupId, movieId, vote, vote]
      );

      res.json(apiResponse(null, 'Vote recorded successfully'));
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
