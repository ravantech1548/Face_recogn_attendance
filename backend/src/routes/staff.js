const express = require('express');
const multer = require('multer');
const path = require('path');
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
      'SELECT staff_id, full_name, email, designation, department, is_active, created_at FROM staff ORDER BY created_at DESC'
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

module.exports = router;


