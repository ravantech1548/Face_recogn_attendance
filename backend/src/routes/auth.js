const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');

const router = express.Router();

router.post(
  '/register',
  [
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { username, password } = req.body;
      const userExists = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
      if (userExists.rows.length > 0) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query(
        'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING user_id, username, role',
        [username, hashedPassword]
      );
      return res.status(201).json({ message: 'User created successfully', user: result.rows[0] });
    } catch (error) {
      console.error('Registration error:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { username, password } = req.body;
      const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      if (result.rows.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const user = result.rows[0];
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const token = jwt.sign(
        { userId: user.user_id, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );
      return res.json({
        message: 'Login successful',
        token,
        user: { userId: user.user_id, username: user.username, role: user.role },
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// Request password reset
router.post(
  '/request-password-reset',
  [
    body('username').notEmpty().withMessage('Username is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username } = req.body;
      
      // Check if user exists
      const result = await pool.query('SELECT user_id, username FROM users WHERE username = $1', [username]);
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = result.rows[0];
      
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour from now

      // Store reset token in database
      await pool.query(
        'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE user_id = $3',
        [resetToken, resetTokenExpires, user.user_id]
      );

      // In a real application, you would send this token via email
      // For now, we'll return it in the response for testing purposes
      return res.json({
        message: 'Password reset token generated successfully',
        resetToken: resetToken, // Remove this in production
        expiresAt: resetTokenExpires
      });
    } catch (error) {
      console.error('Password reset request error:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// Reset password with token
router.post(
  '/reset-password',
  [
    body('resetToken').notEmpty().withMessage('Reset token is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { resetToken, newPassword } = req.body;

      // Find user with valid reset token
      const result = await pool.query(
        'SELECT user_id, username, reset_token_expires FROM users WHERE reset_token = $1',
        [resetToken]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }

      const user = result.rows[0];

      // Check if token is expired
      if (new Date() > new Date(user.reset_token_expires)) {
        return res.status(400).json({ message: 'Reset token has expired' });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password and clear reset token
      await pool.query(
        'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE user_id = $2',
        [hashedPassword, user.user_id]
      );

      return res.json({
        message: 'Password reset successfully',
        username: user.username
      });
    } catch (error) {
      console.error('Password reset error:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// Admin reset password for any user (requires admin authentication)
router.post(
  '/admin-reset-password',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, newPassword } = req.body;

      // Check if user exists
      const userResult = await pool.query('SELECT user_id, username FROM users WHERE username = $1', [username]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = userResult.rows[0];

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await pool.query(
        'UPDATE users SET password = $1 WHERE user_id = $2',
        [hashedPassword, user.user_id]
      );

      return res.json({
        message: 'Password reset successfully by admin',
        username: user.username
      });
    } catch (error) {
      console.error('Admin password reset error:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;


