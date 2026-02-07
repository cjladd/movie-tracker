const { Router } = require('express');
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// Get current user's friends
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.user_id, u.name, u.email
       FROM Friendships f
       JOIN Users u ON u.user_id = f.friend_id
       WHERE f.user_id = ?`,
      [req.session.userId]
    );
    res.json(rows);
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
       WHERE fr.receiver_id = ? AND fr.status = 'pending'`,
      [req.session.userId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Send friend request by email
router.post('/request', requireAuth, async (req, res, next) => {
  const { email } = req.body;
  const senderId = req.session.userId;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const [users] = await pool.query('SELECT user_id FROM Users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const receiverId = users[0].user_id;

    if (receiverId === senderId) {
      return res.status(400).json({ error: 'You cannot send a friend request to yourself' });
    }

    const [existingFriend] = await pool.query(
      'SELECT 1 FROM Friendships WHERE user_id = ? AND friend_id = ?',
      [senderId, receiverId]
    );
    if (existingFriend.length > 0) {
      return res.status(400).json({ error: 'You are already friends' });
    }

    const [existingRequest] = await pool.query(
      `SELECT 1 FROM Friend_Requests
       WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
         AND status = 'pending'`,
      [senderId, receiverId, receiverId, senderId]
    );
    if (existingRequest.length > 0) {
      return res.status(400).json({ error: 'Friend request already pending' });
    }

    await pool.query(
      "INSERT INTO Friend_Requests (sender_id, receiver_id, status, requested_at) VALUES (?, ?, 'pending', NOW())",
      [senderId, receiverId]
    );

    res.json({ message: 'Friend request sent' });
  } catch (err) {
    next(err);
  }
});

// Accept friend request
router.post('/accept', requireAuth, async (req, res, next) => {
  const { requestId } = req.body;
  const receiverId = req.session.userId;

  if (!requestId) {
    return res.status(400).json({ error: 'Request ID is required' });
  }

  try {
    const [requests] = await pool.query(
      "SELECT * FROM Friend_Requests WHERE request_id = ? AND receiver_id = ? AND status = 'pending'",
      [requestId, receiverId]
    );
    if (requests.length === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    const senderId = requests[0].sender_id;

    await pool.query(
      "UPDATE Friend_Requests SET status = 'accepted', responded_at = NOW() WHERE request_id = ?",
      [requestId]
    );

    await pool.query(
      'INSERT INTO Friendships (user_id, friend_id, created_at) VALUES (?, ?, NOW()), (?, ?, NOW())',
      [senderId, receiverId, receiverId, senderId]
    );

    res.json({ message: 'Friend request accepted' });
  } catch (err) {
    next(err);
  }
});

// Remove friend
router.delete('/:friendId', requireAuth, async (req, res, next) => {
  const userId = req.session.userId;
  const { friendId } = req.params;

  try {
    await pool.query(
      'DELETE FROM Friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [userId, friendId, friendId, userId]
    );
    res.json({ message: 'Friend removed' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
