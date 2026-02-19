const { Router } = require('express');
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateParamId } = require('../middleware/validate');
const { parsePagination, paginatedResponse, apiResponse, apiError } = require('../utils/helpers');

const router = Router();

// Get user notifications (paginated)
router.get('/', requireAuth, async (req, res, next) => {
  const { page, limit, offset } = parsePagination(req.query);

  try {
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM Notifications WHERE user_id = ?',
      [req.session.userId]
    );

    const [rows] = await pool.query(
      `SELECT * FROM Notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [req.session.userId, limit, offset]
    );

    res.json(paginatedResponse(rows, total, page, limit));
  } catch (err) {
    next(err);
  }
});

// Get unread count
router.get('/unread-count', requireAuth, async (req, res, next) => {
  try {
    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) as count FROM Notifications WHERE user_id = ? AND is_read = FALSE',
      [req.session.userId]
    );
    res.json(apiResponse({ count }));
  } catch (err) {
    next(err);
  }
});

// Mark notification as read
router.post(
  '/:notificationId/read',
  requireAuth,
  validateParamId('notificationId'),
  async (req, res, next) => {
    try {
      const [result] = await pool.query(
        'UPDATE Notifications SET is_read = TRUE WHERE notification_id = ? AND user_id = ?',
        [req.params.notificationId, req.session.userId]
      );
      if (result.affectedRows === 0) return next(apiError('Notification not found', 404));
      res.json(apiResponse(null, 'Notification marked as read'));
    } catch (err) {
      next(err);
    }
  }
);

// Mark all notifications as read
router.post('/read-all', requireAuth, async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE Notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
      [req.session.userId]
    );
    res.json(apiResponse(null, 'All notifications marked as read'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
