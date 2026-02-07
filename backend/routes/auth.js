const { Router } = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = Router();
const SALT_ROUNDS = 10;

// Register
router.post('/register', async (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields required' });
  }

  try {
    const [existing] = await pool.query('SELECT user_id FROM Users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await pool.query(
      'INSERT INTO Users (name, email, password, created_at) VALUES (?, ?, ?, NOW())',
      [name, email, hashedPassword]
    );

    res.status(201).json({
      message: 'User registered successfully',
      userId: result.insertId,
    });
  } catch (err) {
    next(err);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM Users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.user_id;
    req.session.user = {
      id: user.user_id,
      name: user.name,
      email: user.email,
    };

    res.json({
      message: 'Login successful',
      user: { id: user.user_id, name: user.name, email: user.email },
    });
  } catch (err) {
    next(err);
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.json({ message: 'Logout successful' });
  });
});

// Get current user session
router.get('/me', requireAuth, (req, res) => {
  res.json(req.session.user);
});

// Get profile
router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT user_id, name, email, bio, favorite_genres,
              email_notifications, group_notifications, vote_notifications, public_profile
       FROM Users WHERE user_id = ?`,
      [req.session.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    res.json({
      id: user.user_id,
      name: user.name,
      email: user.email,
      bio: user.bio || '',
      favorite_genres: user.favorite_genres || '',
      email_notifications: !!user.email_notifications,
      group_notifications: !!user.group_notifications,
      vote_notifications: !!user.vote_notifications,
      public_profile: !!user.public_profile,
    });
  } catch (err) {
    next(err);
  }
});

// Update profile
router.put('/profile', requireAuth, async (req, res, next) => {
  const { name, email, bio, favorite_genres } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT user_id FROM Users WHERE email = ? AND user_id != ?',
      [email, req.session.userId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    await pool.query(
      'UPDATE Users SET name = ?, email = ?, bio = ?, favorite_genres = ? WHERE user_id = ?',
      [name, email, bio || null, favorite_genres || null, req.session.userId]
    );

    req.session.user = { id: req.session.userId, name, email };

    res.json({
      message: 'Profile updated successfully',
      user: { id: req.session.userId, name, email },
    });
  } catch (err) {
    next(err);
  }
});

// Update preferences
router.put('/preferences', requireAuth, async (req, res, next) => {
  const { email_notifications, group_notifications, vote_notifications, public_profile } = req.body;

  try {
    await pool.query(
      `UPDATE Users SET email_notifications = ?, group_notifications = ?,
       vote_notifications = ?, public_profile = ? WHERE user_id = ?`,
      [
        email_notifications ? 1 : 0,
        group_notifications ? 1 : 0,
        vote_notifications ? 1 : 0,
        public_profile ? 1 : 0,
        req.session.userId,
      ]
    );

    res.json({ message: 'Preferences updated successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
