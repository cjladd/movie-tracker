const { Router } = require('express');
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { requireFields } = require('../middleware/validate');
const { verifyMembership, apiResponse, apiError, isPositiveInt } = require('../utils/helpers');
const { VOTE_MIN, VOTE_MAX, NOTIFICATION_TYPES } = require('../utils/constants');
const { GROUP_ACTIVITY_EVENT, recordGroupActivity } = require('../utils/groupActivity');
const { insertNotifications } = require('../utils/notifications');
const logger = require('../utils/logger');

const router = Router();

function isMissingColumnError(err) {
  return err && err.code === 'ER_BAD_FIELD_ERROR';
}

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

      await recordGroupActivity({
        groupId: Number(groupId),
        actorUserId: userId,
        eventType: GROUP_ACTIVITY_EVENT.VOTE_CAST,
        referenceId: Number(movieId),
        metadata: { voteValue: vote },
      });

      try {
        const [contextRows] = await pool.query(
          `SELECT mg.group_name, m.title AS movie_title, u.name AS voter_name
           FROM Movie_Groups mg
           LEFT JOIN Movies m ON m.movie_id = ?
           LEFT JOIN Users u ON u.user_id = ?
           WHERE mg.group_id = ? AND mg.deleted_at IS NULL`,
          [movieId, userId, groupId]
        );
        const context = contextRows[0] || {};

        let recipientRows;
        try {
          [recipientRows] = await pool.query(
            `SELECT gm.user_id
             FROM Group_Members gm
             JOIN Users u ON u.user_id = gm.user_id
             LEFT JOIN Movie_Votes mv ON mv.group_id = ? AND mv.movie_id = ? AND mv.user_id = gm.user_id
             WHERE gm.group_id = ?
               AND gm.user_id <> ?
               AND u.deleted_at IS NULL
               AND mv.user_id IS NULL
               AND u.vote_notifications = TRUE
               AND NOT EXISTS (
                 SELECT 1
                 FROM Notifications n
                 WHERE n.user_id = gm.user_id
                   AND n.type = ?
                   AND n.reference_id = ?
                   AND n.created_at > DATE_SUB(NOW(), INTERVAL 6 HOUR)
               )`,
            [groupId, movieId, groupId, userId, NOTIFICATION_TYPES.VOTE_REMINDER, movieId]
          );
        } catch (queryErr) {
          if (!isMissingColumnError(queryErr)) throw queryErr;
          [recipientRows] = await pool.query(
            `SELECT gm.user_id
             FROM Group_Members gm
             JOIN Users u ON u.user_id = gm.user_id
             LEFT JOIN Movie_Votes mv ON mv.group_id = ? AND mv.movie_id = ? AND mv.user_id = gm.user_id
             WHERE gm.group_id = ?
               AND gm.user_id <> ?
               AND u.deleted_at IS NULL
               AND mv.user_id IS NULL
               AND NOT EXISTS (
                 SELECT 1
                 FROM Notifications n
                 WHERE n.user_id = gm.user_id
                   AND n.type = ?
                   AND n.reference_id = ?
                   AND n.created_at > DATE_SUB(NOW(), INTERVAL 6 HOUR)
               )`,
            [groupId, movieId, groupId, userId, NOTIFICATION_TYPES.VOTE_REMINDER, movieId]
          );
        }

        if (recipientRows.length > 0) {
          const groupName = context.group_name || 'your Stream Team';
          const movieTitle = context.movie_title || 'a movie';
          const voterName = context.voter_name || 'A teammate';

          await insertNotifications(
            pool,
            recipientRows.map((row) => ({
              userId: Number(row.user_id),
              type: NOTIFICATION_TYPES.VOTE_REMINDER,
              title: `Vote reminder: ${groupName}`,
              message: `${voterName} voted on "${movieTitle}". Add your vote to help decide the final pick.`,
              referenceId: Number(movieId),
            }))
          );
        }
      } catch (notifyErr) {
        logger.warn('Failed to queue vote reminder notifications', {
          groupId: Number(groupId),
          movieId: Number(movieId),
          actorUserId: Number(userId),
          error: notifyErr.message,
        });
      }

      res.json(apiResponse(null, 'Vote recorded successfully'));
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
