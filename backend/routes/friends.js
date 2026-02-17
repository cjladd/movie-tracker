const { Router } = require('express');
const { pool, withTransaction } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateParamId, requireFields, sanitizeBody, validateEmail } = require('../middleware/validate');
const { getUserByEmail, parsePagination, paginatedResponse, apiResponse, apiError } = require('../utils/helpers');
const { FRIEND_REQUEST_STATUS, NOTIFICATION_TYPES } = require('../utils/constants');
const { insertNotifications } = require('../utils/notifications');
const logger = require('../utils/logger');

const router = Router();

// Get current user's friends (paginated)
router.get('/', requireAuth, async (req, res, next) => {
  const { page, limit, offset } = parsePagination(req.query);

  try {
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM Friendships WHERE user_id = ?',
      [req.session.userId]
    );

    const [rows] = await pool.query(
      `SELECT u.user_id, u.name, u.email, f.created_at as friends_since
       FROM Friendships f
       JOIN Users u ON u.user_id = f.friend_id
       WHERE f.user_id = ? AND u.deleted_at IS NULL
       ORDER BY f.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.session.userId, limit, offset]
    );

    res.json(paginatedResponse(rows, total, page, limit));
  } catch (err) {
    next(err);
  }
});

// Get pending friend requests
router.get('/requests', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT fr.request_id, fr.sender_id, u.name AS sender_name, u.email AS sender_email, fr.requested_at
       FROM Friend_Requests fr
       JOIN Users u ON fr.sender_id = u.user_id
       WHERE fr.receiver_id = ? AND fr.status = ?`,
      [req.session.userId, FRIEND_REQUEST_STATUS.PENDING]
    );
    res.json(apiResponse(rows));
  } catch (err) {
    next(err);
  }
});

// Send friend request by email
router.post(
  '/requests',
  requireAuth,
  sanitizeBody('email'),
  requireFields('email'),
  validateEmail(),
  async (req, res, next) => {
    const { email } = req.body;
    const senderId = req.session.userId;

    try {
      const receiver = await getUserByEmail(email);
      if (!receiver) return next(apiError('User not found', 404));
      if (receiver.user_id === senderId) return next(apiError('Cannot send a friend request to yourself', 400));

      const [existingFriend] = await pool.query(
        'SELECT 1 FROM Friendships WHERE user_id = ? AND friend_id = ?',
        [senderId, receiver.user_id]
      );
      if (existingFriend.length > 0) return next(apiError('Already friends', 400));

      const [existingRequest] = await pool.query(
        `SELECT 1 FROM Friend_Requests
         WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
           AND status = ?`,
        [senderId, receiver.user_id, receiver.user_id, senderId, FRIEND_REQUEST_STATUS.PENDING]
      );
      if (existingRequest.length > 0) return next(apiError('Friend request already pending', 400));

      const [requestResult] = await pool.query(
        'INSERT INTO Friend_Requests (sender_id, receiver_id, status, requested_at) VALUES (?, ?, ?, NOW())',
        [senderId, receiver.user_id, FRIEND_REQUEST_STATUS.PENDING]
      );

      try {
        const [senderRows] = await pool.query(
          'SELECT name FROM Users WHERE user_id = ? AND deleted_at IS NULL',
          [senderId]
        );
        const senderName = senderRows[0] ? senderRows[0].name : 'Someone';
        await insertNotifications(pool, [{
          userId: receiver.user_id,
          type: NOTIFICATION_TYPES.FRIEND_REQUEST,
          title: `Friend request from ${senderName}`,
          message: `${senderName} sent you a friend request.`,
          referenceId: requestResult.insertId || null,
        }]);
      } catch (notifyErr) {
        logger.warn('Failed to queue friend request notification', {
          senderId,
          receiverId: receiver.user_id,
          error: notifyErr.message,
        });
      }

      logger.info(`Friend request sent: ${senderId} -> ${receiver.user_id}`);
      res.json(apiResponse(null, 'Friend request sent'));
    } catch (err) {
      next(err);
    }
  }
);

// Accept friend request (with transaction)
router.post(
  '/requests/:requestId/accept',
  requireAuth,
  validateParamId('requestId'),
  async (req, res, next) => {
    const { requestId } = req.params;
    const receiverId = req.session.userId;

    try {
      await withTransaction(async (conn) => {
        const [requests] = await conn.query(
          'SELECT * FROM Friend_Requests WHERE request_id = ? AND receiver_id = ? AND status = ?',
          [requestId, receiverId, FRIEND_REQUEST_STATUS.PENDING]
        );
        if (requests.length === 0) throw apiError('Friend request not found', 404);

        const senderId = requests[0].sender_id;

        await conn.query(
          'UPDATE Friend_Requests SET status = ?, responded_at = NOW() WHERE request_id = ?',
          [FRIEND_REQUEST_STATUS.ACCEPTED, requestId]
        );

        await conn.query(
          'INSERT IGNORE INTO Friendships (user_id, friend_id, created_at) VALUES (?, ?, NOW()), (?, ?, NOW())',
          [senderId, receiverId, receiverId, senderId]
        );

        try {
          const [receiverRows] = await conn.query(
            'SELECT name FROM Users WHERE user_id = ? AND deleted_at IS NULL',
            [receiverId]
          );
          const receiverName = receiverRows[0] ? receiverRows[0].name : 'Your friend';
          await insertNotifications(conn, [{
            userId: senderId,
            type: NOTIFICATION_TYPES.FRIEND_ACCEPTED,
            title: 'Friend request accepted',
            message: `${receiverName} accepted your friend request.`,
            referenceId: Number(requestId),
          }]);
        } catch (notifyErr) {
          logger.warn('Failed to queue friend accepted notification', {
            senderId,
            receiverId,
            requestId: Number(requestId),
            error: notifyErr.message,
          });
        }
      });

      logger.info(`Friend request accepted: ${requestId}`);
      res.json(apiResponse(null, 'Friend request accepted'));
    } catch (err) {
      next(err);
    }
  }
);

// Decline friend request
router.post(
  '/requests/:requestId/decline',
  requireAuth,
  validateParamId('requestId'),
  async (req, res, next) => {
    const { requestId } = req.params;

    try {
      const [result] = await pool.query(
        'UPDATE Friend_Requests SET status = ?, responded_at = NOW() WHERE request_id = ? AND receiver_id = ? AND status = ?',
        [FRIEND_REQUEST_STATUS.DECLINED, requestId, req.session.userId, FRIEND_REQUEST_STATUS.PENDING]
      );
      if (result.affectedRows === 0) return next(apiError('Friend request not found', 404));
      res.json(apiResponse(null, 'Friend request declined'));
    } catch (err) {
      next(err);
    }
  }
);

// Remove friend
router.delete(
  '/:friendId',
  requireAuth,
  validateParamId('friendId'),
  async (req, res, next) => {
    const { friendId } = req.params;

    try {
      await pool.query(
        'DELETE FROM Friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
        [req.session.userId, friendId, friendId, req.session.userId]
      );
      res.json(apiResponse(null, 'Friend removed'));
    } catch (err) {
      next(err);
    }
  }
);

// Keep backwards compatibility: POST /request -> POST /requests
router.post('/request', requireAuth, (req, res, next) => {
  req.url = '/requests';
  router.handle(req, res, next);
});

// Keep backwards compatibility: POST /accept -> POST /requests/:requestId/accept
router.post('/accept', requireAuth, (req, res, next) => {
  const { requestId } = req.body;
  if (!requestId) return next(apiError('Request ID is required', 400));
  req.params.requestId = String(requestId);
  req.url = `/requests/${requestId}/accept`;
  router.handle(req, res, next);
});

module.exports = router;
