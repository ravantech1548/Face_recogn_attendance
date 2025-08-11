const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// Record check-in
router.post(
  '/check-in',
  [auth, body('staffId').notEmpty().withMessage('staffId is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { staffId } = req.body;
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10);

      // Check if already checked-in today
      const existing = await pool.query(
        'SELECT attendance_id FROM attendance WHERE staff_id = $1 AND date = $2',
        [staffId, dateStr]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ message: 'Already checked in today' });
      }

      const result = await pool.query(
        `INSERT INTO attendance (staff_id, check_in_time, date, status)
         VALUES ($1, NOW(), $2, 'present') RETURNING *`,
        [staffId, dateStr]
      );
      res.status(201).json({ message: 'Check-in recorded', attendance: result.rows[0] });
    } catch (error) {
      console.error('Check-in error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Record check-out
router.post(
  '/check-out',
  [auth, body('staffId').notEmpty().withMessage('staffId is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { staffId } = req.body;
      const dateStr = new Date().toISOString().slice(0, 10);

      const existing = await pool.query(
        'SELECT * FROM attendance WHERE staff_id = $1 AND date = $2',
        [staffId, dateStr]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({ message: 'No check-in record found for today' });
      }

      const attId = existing.rows[0].attendance_id;
      const result = await pool.query(
        'UPDATE attendance SET check_out_time = NOW() WHERE attendance_id = $1 RETURNING *',
        [attId]
      );
      res.json({ message: 'Check-out recorded', attendance: result.rows[0] });
    } catch (error) {
      console.error('Check-out error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Get attendance by date range
router.get('/', auth, async (req, res) => {
  try {
    const { startDate, endDate, staffId } = req.query;
    const params = [];
    const conditions = [];
    if (startDate) {
      params.push(startDate);
      conditions.push(`date >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`date <= $${params.length}`);
    }
    if (staffId) {
      params.push(staffId);
      conditions.push(`staff_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT a.*, s.full_name, s.department FROM attendance a
       JOIN staff s ON s.staff_id = a.staff_id
       ${where}
       ORDER BY a.date DESC, a.check_in_time DESC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


