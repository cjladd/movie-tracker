const { Router } = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../config/database');
const env = require('../config/env');
const { requireAuth } = require('../middleware/auth');
const { requireFields, validateEmail, sanitizeBody } = require('../middleware/validate');
const { getUserByEmail, apiResponse, apiError } = require('../utils/helpers');
const { SALT_ROUNDS, PASSWORD_MIN_LENGTH, ACCOUNT_LOCKOUT, PASSWORD_RESET_EXPIRY_HOURS } = require('../utils/constants');
const { sendPasswordResetEmail } = require('../utils/email');
const logger = require('../utils/logger');

const router = Router();

function isMissingColumnError(err) {
  return err && err.code === 'ER_BAD_FIELD_ERROR';
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function safeUpdateLoginSecurity(userId, attempts, lockUntil) {
  try {
    await pool.query(
      'UPDATE Users SET failed_login_attempts = ?, locked_until = ? WHERE user_id = ?',
      [attempts, lockUntil, userId]
    );
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    logger.warn('Login security columns missing; skipping failed-attempt tracking');
  }
}

async function createPasswordResetRecord(userId, token, expiresAt) {
  const tokenHash = hashResetToken(token);

  try {
    await pool.query(
      'INSERT INTO Password_Resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [userId, tokenHash, expiresAt]
    );
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    await pool.query(
      'INSERT INTO Password_Resets (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, token, expiresAt]
    );
  }
}

async function findActivePasswordReset(token) {
  const tokenHash = hashResetToken(token);

  try {
    const [rows] = await pool.query(
      'SELECT * FROM Password_Resets WHERE token_hash = ? AND used = FALSE AND expires_at > NOW()',
      [tokenHash]
    );
    return rows[0] || null;
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    const [rows] = await pool.query(
      'SELECT * FROM Password_Resets WHERE token = ? AND used = FALSE AND expires_at > NOW()',
      [token]
    );
    return rows[0] || null;
  }
}

// Register
router.post(
  '/register',
  sanitizeBody('name', 'email'),
  requireFields('name', 'email', 'password'),
  validateEmail(),
  async (req, res, next) => {
    const { name, email, password } = req.body;

    if (password.length < PASSWORD_MIN_LENGTH) {
      return next(apiError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`, 400));
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return next(apiError('Password must contain uppercase, lowercase, and a number', 400));
    }

    try {
      const existing = await getUserByEmail(email);
      if (existing) {
        return next(apiError('Email already exists', 400));
      }

      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      const [result] = await pool.query(
        'INSERT INTO Users (name, email, password, created_at) VALUES (?, ?, ?, NOW())',
        [name, email, hashedPassword]
      );

      logger.info(`User registered: ${result.insertId}`);
      res.status(201).json(apiResponse({ userId: result.insertId }, 'User registered successfully'));
    } catch (err) {
      next(err);
    }
  }
);

// Login
router.post(
  '/login',
  sanitizeBody('email'),
  requireFields('email', 'password'),
  async (req, res, next) => {
    const { email, password } = req.body;

    try {
      const user = await getUserByEmail(email);
      if (!user) {
        return next(apiError('Invalid credentials', 401));
      }

      // Account lockout check
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
        return next(apiError(`Account locked. Try again in ${minutesLeft} minute(s)`, 423));
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        // Increment failed attempts
        const attempts = (user.failed_login_attempts || 0) + 1;
        const lockUntil = attempts >= ACCOUNT_LOCKOUT.MAX_ATTEMPTS
          ? new Date(Date.now() + ACCOUNT_LOCKOUT.LOCKOUT_MINUTES * 60000)
          : null;

        await safeUpdateLoginSecurity(user.user_id, attempts, lockUntil);

        if (lockUntil) {
          return next(apiError(`Too many failed attempts. Account locked for ${ACCOUNT_LOCKOUT.LOCKOUT_MINUTES} minutes`, 423));
        }
        return next(apiError('Invalid credentials', 401));
      }

      // Reset failed attempts on success
      await safeUpdateLoginSecurity(user.user_id, 0, null);

      // Regenerate session to prevent session fixation
      await new Promise((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      req.session.userId = user.user_id;
      logger.info(`User logged in: ${user.user_id}`);

      res.json(apiResponse(
        { id: user.user_id, name: user.name, email: user.email },
        'Login successful'
      ));
    } catch (err) {
      next(err);
    }
  }
);

// Logout
router.post('/logout', (req, res, next) => {
  const userId = req.session.userId;
  req.session.destroy((err) => {
    if (err) return next(err);
    logger.info(`User logged out: ${userId}`);
    res.json(apiResponse(null, 'Logout successful'));
  });
});

// Get current session user
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT user_id, name, email FROM Users WHERE user_id = ? AND deleted_at IS NULL',
      [req.session.userId]
    );
    if (rows.length === 0) return next(apiError('User not found', 404));
    const user = rows[0];
    res.json(apiResponse({ id: user.user_id, name: user.name, email: user.email }));
  } catch (err) {
    next(err);
  }
});

// Get profile
router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT user_id, name, email, bio, favorite_genres,
              email_notifications, group_notifications, vote_notifications, public_profile
       FROM Users WHERE user_id = ? AND deleted_at IS NULL`,
      [req.session.userId]
    );
    if (rows.length === 0) return next(apiError('User not found', 404));

    const u = rows[0];
    res.json(apiResponse({
      id: u.user_id,
      name: u.name,
      email: u.email,
      bio: u.bio || '',
      favorite_genres: u.favorite_genres || '',
      email_notifications: !!u.email_notifications,
      group_notifications: !!u.group_notifications,
      vote_notifications: !!u.vote_notifications,
      public_profile: !!u.public_profile,
    }));
  } catch (err) {
    next(err);
  }
});

// Update profile
router.put(
  '/profile',
  requireAuth,
  sanitizeBody('name', 'email', 'bio', 'favorite_genres'),
  requireFields('name', 'email'),
  validateEmail(),
  async (req, res, next) => {
    const { name, email, bio, favorite_genres } = req.body;

    try {
      const [existing] = await pool.query(
        'SELECT user_id FROM Users WHERE email = ? AND user_id != ? AND deleted_at IS NULL',
        [email, req.session.userId]
      );
      if (existing.length > 0) return next(apiError('Email already exists', 400));

      await pool.query(
        'UPDATE Users SET name = ?, email = ?, bio = ?, favorite_genres = ? WHERE user_id = ?',
        [name, email, bio || null, favorite_genres || null, req.session.userId]
      );

      res.json(apiResponse({ id: req.session.userId, name, email }, 'Profile updated successfully'));
    } catch (err) {
      next(err);
    }
  }
);

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
    res.json(apiResponse(null, 'Preferences updated successfully'));
  } catch (err) {
    next(err);
  }
});

// Delete account (soft delete)
router.delete('/profile', requireAuth, async (req, res, next) => {
  const userId = req.session.userId;
  try {
    await pool.query('UPDATE Users SET deleted_at = NOW() WHERE user_id = ?', [userId]);
    req.session.destroy(() => {
      logger.info(`User deleted account: ${userId}`);
      res.json(apiResponse(null, 'Account deleted'));
    });
  } catch (err) {
    next(err);
  }
});

// Request password reset
router.post(
  '/forgot-password',
  sanitizeBody('email'),
  requireFields('email'),
  validateEmail(),
  async (req, res, next) => {
    try {
      const user = await getUserByEmail(req.body.email);
      // Always return success to prevent email enumeration
      if (!user) {
        return res.json(apiResponse(null, 'If that email exists, a reset link has been generated'));
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 3600000);
      const baseUrl = (env.app.baseUrl || 'http://localhost:4000').replace(/\/+$/, '');
      const resetUrl = `${baseUrl}/Reset_Password.html?token=${encodeURIComponent(token)}`;

      await createPasswordResetRecord(user.user_id, token, expiresAt);

      logger.info(`Password reset requested for user ${user.user_id}`);
      try {
        await sendPasswordResetEmail({
          toEmail: user.email,
          toName: user.name,
          resetUrl,
        });
      } catch (emailErr) {
        logger.error('Failed to send password reset email', {
          userId: user.user_id,
          error: emailErr.message,
        });
      }

      const responseData = env.isProduction ? null : { resetUrl };
      res.json(apiResponse(responseData, 'If that email exists, a reset link has been generated'));
    } catch (err) {
      next(err);
    }
  }
);

// Reset password with token
router.post(
  '/reset-password',
  requireFields('token', 'password'),
  async (req, res, next) => {
    const { token, password } = req.body;

    if (password.length < PASSWORD_MIN_LENGTH) {
      return next(apiError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`, 400));
    }

    try {
      const resetRecord = await findActivePasswordReset(token);
      if (!resetRecord) return next(apiError('Invalid or expired reset token', 400));
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      await pool.query('UPDATE Users SET password = ? WHERE user_id = ?', [hashedPassword, resetRecord.user_id]);
      await pool.query('UPDATE Password_Resets SET used = TRUE WHERE reset_id = ?', [resetRecord.reset_id]);

      logger.info(`Password reset completed for user ${resetRecord.user_id}`);
      res.json(apiResponse(null, 'Password reset successful'));
    } catch (err) {
      next(err);
    }
  }
);

// Search users (for friend discovery)
router.get('/search', requireAuth, async (req, res, next) => {
  const { q } = req.query;
  if (!q || q.length < 2) return next(apiError('Search query must be at least 2 characters', 400));

  try {
    const [rows] = await pool.query(
      `SELECT user_id, name, email FROM Users
       WHERE (name LIKE ? OR email LIKE ?) AND user_id != ? AND deleted_at IS NULL AND public_profile = TRUE
       LIMIT 20`,
      [`%${q}%`, `%${q}%`, req.session.userId]
    );
    res.json(apiResponse(rows));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
