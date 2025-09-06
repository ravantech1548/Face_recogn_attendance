const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

// Get current user info
router.get('/me', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, username, role, staff_id FROM users WHERE user_id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users (admin only)
router.get('/', [auth, requireAdmin], async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, username, role, staff_id, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin creates or updates a user password/role
router.post(
  '/',
  [
    auth,
    requireAdmin,
    body('username').isLength({ min: 3 }),
    body('password').isLength({ min: 6 }),
    body('role').optional().isIn(['admin', 'user']),
    body('staffId').optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { username, password, role = 'user', staffId } = req.body;
    try {
      const existing = await pool.query('SELECT user_id FROM users WHERE username = $1', [username]);
      const hashed = await bcrypt.hash(password, 10);
      if (existing.rows.length > 0) {
        const result = await pool.query(
          'UPDATE users SET password = $1, role = $2, staff_id = COALESCE($4, staff_id) WHERE username = $3 RETURNING user_id, username, role, staff_id',
          [hashed, role, username, staffId || null]
        );
        return res.json({ message: 'User updated', user: result.rows[0] });
      } else {
        const result = await pool.query(
          'INSERT INTO users (username, password, role, staff_id) VALUES ($1, $2, $3, $4) RETURNING user_id, username, role, staff_id',
          [username, hashed, role, staffId || null]
        );
        return res.status(201).json({ message: 'User created', user: result.rows[0] });
      }
    } catch (e) {
      console.error('User upsert error:', e);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;


