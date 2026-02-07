const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// Get user notifications (placeholder — replace with real DB queries when Notifications table is created)
router.get('/', requireAuth, async (req, res) => {
  // TODO: Create a Notifications table and query it here
  res.json([]);
});

// Mark notification as read
router.post('/:notificationId/read', requireAuth, async (req, res) => {
  res.json({ message: 'Notification marked as read' });
});

// Mark all notifications as read
router.post('/read-all', requireAuth, async (req, res) => {
  res.json({ message: 'All notifications marked as read' });
});

module.exports = router;
