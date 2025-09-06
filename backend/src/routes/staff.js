const express = require('express');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

// Ensure upload folder exists
const fs = require('fs');
const uploadDir = path.join(__dirname, '../../uploads/faces');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'face-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  },
});

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.staff_id, s.full_name, s.email, s.designation, s.department, s.is_active, s.created_at,
              u.user_id, u.username, u.role
       FROM staff s
       LEFT JOIN users u ON s.staff_id = u.staff_id
       ORDER BY s.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:staffId', auth, async (req, res) => {
  try {
    const { staffId } = req.params;
    const result = await pool.query(
      'SELECT staff_id, full_name, email, designation, department, face_image_path, is_active FROM staff WHERE staff_id = $1',
      [staffId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Staff not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post(
  '/',
  [auth, requireAdmin, upload.single('faceImage')],
  [
    body('staffId').notEmpty().withMessage('Staff ID is required'),
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('designation').notEmpty().withMessage('Designation is required'),
    body('department').notEmpty().withMessage('Department is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { staffId, fullName, email, designation, department } = req.body;
      const faceImagePath = req.file
        ? path.join('uploads', 'faces', path.basename(req.file.path))
        : null;

      const existingStaff = await pool.query('SELECT 1 FROM staff WHERE staff_id = $1 OR email = $2', [
        staffId,
        email,
      ]);
      if (existingStaff.rows.length > 0) {
        return res.status(400).json({ message: 'Staff ID or email already exists' });
      }

      const result = await pool.query(
        `INSERT INTO staff (staff_id, full_name, email, designation, department, face_image_path)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING staff_id, full_name, email, designation, department, face_image_path, created_at`,
        [staffId, fullName, email, designation, department, faceImagePath]
      );

      res.status(201).json({ message: 'Staff added successfully', staff: result.rows[0] });
    } catch (error) {
      console.error('Add staff error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.put('/:staffId', [auth, requireAdmin, upload.single('faceImage')], async (req, res) => {
  try {
    const { staffId } = req.params;
    const { fullName, email, designation, department } = req.body;
    const faceImagePath = req.file
      ? path.join('uploads', 'faces', path.basename(req.file.path))
      : null;

    const existingStaff = await pool.query('SELECT 1 FROM staff WHERE staff_id = $1', [staffId]);
    if (existingStaff.rows.length === 0) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    let query =
      'UPDATE staff SET full_name = $1, email = $2, designation = $3, department = $4, updated_at = CURRENT_TIMESTAMP';
    const values = [fullName, email, designation, department];
    if (faceImagePath) {
      query += ', face_image_path = $5';
      values.push(faceImagePath);
    }
    query += ` WHERE staff_id = $${values.length + 1} RETURNING *`;
    values.push(staffId);

    const result = await pool.query(query, values);
    res.json({ message: 'Staff updated successfully', staff: result.rows[0] });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:staffId', [auth, requireAdmin], async (req, res) => {
  try {
    const { staffId } = req.params;
    const result = await pool.query('DELETE FROM staff WHERE staff_id = $1 RETURNING *', [staffId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Staff not found' });
    }
    res.json({ message: 'Staff deleted successfully' });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create user account for staff member
router.post('/:staffId/create-user', [auth, requireAdmin], [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['admin', 'user']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { staffId } = req.params;
    const { username, password, role = 'user' } = req.body;

    // Check if staff exists
    const staffResult = await pool.query('SELECT staff_id FROM staff WHERE staff_id = $1', [staffId]);
    if (staffResult.rows.length === 0) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    // Check if user already exists
    const userExists = await pool.query('SELECT 1 FROM users WHERE username = $1 OR staff_id = $2', [username, staffId]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'Username already exists or staff already has a user account' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password, role, staff_id) VALUES ($1, $2, $3, $4) RETURNING user_id, username, role, staff_id',
      [username, hashedPassword, role, staffId]
    );

    res.status(201).json({ message: 'User account created successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Create user account error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset password for staff user account
router.post('/:staffId/reset-password', [auth, requireAdmin], [
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { staffId } = req.params;
    const { newPassword } = req.body;

    // Check if staff has a user account
    const userResult = await pool.query('SELECT user_id, username FROM users WHERE staff_id = $1', [staffId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'No user account found for this staff member' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password = $1 WHERE staff_id = $2',
      [hashedPassword, staffId]
    );

    res.json({
      message: 'Password reset successfully',
      username: userResult.rows[0].username
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user account for staff member
router.delete('/:staffId/user-account', [auth, requireAdmin], async (req, res) => {
  try {
    const { staffId } = req.params;

    const result = await pool.query('DELETE FROM users WHERE staff_id = $1 RETURNING username', [staffId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No user account found for this staff member' });
    }

    res.json({ message: 'User account deleted successfully', username: result.rows[0].username });
  } catch (error) {
    console.error('Delete user account error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


