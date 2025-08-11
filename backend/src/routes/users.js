const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

// Admin creates or updates a user password/role
router.post(
  '/',
  [
    auth,
    requireAdmin,
    body('username').isLength({ min: 3 }),
    body('password').isLength({ min: 6 }),
    body('role').optional().isIn(['admin', 'user']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { username, password, role = 'user' } = req.body;
    try {
      const existing = await pool.query('SELECT user_id FROM users WHERE username = $1', [username]);
      const hashed = await bcrypt.hash(password, 10);
      if (existing.rows.length > 0) {
        const result = await pool.query(
          'UPDATE users SET password = $1, role = $2 WHERE username = $3 RETURNING user_id, username, role',
          [hashed, role, username]
        );
        return res.json({ message: 'User updated', user: result.rows[0] });
      } else {
        const result = await pool.query(
          'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING user_id, username, role',
          [username, hashed, role]
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


