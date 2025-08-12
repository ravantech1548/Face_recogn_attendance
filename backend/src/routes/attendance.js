const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

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
      conditions.push(`a.date >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`a.date <= $${params.length}`);
    }
    if (staffId) {
      params.push(staffId);
      conditions.push(`a.staff_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT a.attendance_id, a.staff_id, a.check_in_time, a.check_out_time, a.date, a.status,
              a.created_at, s.full_name, s.department
       FROM attendance a
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

// Face event: auto check-in/out with 5-minute rule
router.post('/face-event', [auth, requireAdmin, body('staffId').notEmpty()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { staffId } = req.body;
    const dateStr = new Date().toISOString().slice(0, 10);

    // Fetch today's attendance (latest)
    const existingRes = await pool.query(
      'SELECT * FROM attendance WHERE staff_id = $1 AND date = $2 ORDER BY attendance_id DESC LIMIT 1',
      [staffId, dateStr]
    );

    if (existingRes.rows.length === 0) {
      const insertRes = await pool.query(
        `INSERT INTO attendance (staff_id, check_in_time, date, status)
         VALUES ($1, NOW(), $2, 'present') RETURNING *`,
        [staffId, dateStr]
      );
      return res.status(201).json({ action: 'checked_in', attendance: insertRes.rows[0] });
    }

    const att = existingRes.rows[0];
    const nowUpdateRes = await pool.query('SELECT NOW() AS now');
    const now = new Date(nowUpdateRes.rows[0].now);
    const checkInTime = att.check_in_time ? new Date(att.check_in_time) : null;
    const checkOutTime = att.check_out_time ? new Date(att.check_out_time) : null;

    const fiveMinutesMs = 5 * 60 * 1000;

    if (!checkOutTime) {
      if (checkInTime && now.getTime() - checkInTime.getTime() >= fiveMinutesMs) {
        const upd = await pool.query(
          'UPDATE attendance SET check_out_time = NOW() WHERE attendance_id = $1 RETURNING *',
          [att.attendance_id]
        );
        return res.json({ action: 'checked_out', attendance: upd.rows[0] });
      }
      // Too soon, ignore
      return res.status(200).json({ action: 'ignored', reason: 'min_interval_not_elapsed', attendance: att });
    }

    // Already have checkout; update to latest capture
    const upd = await pool.query(
      'UPDATE attendance SET check_out_time = NOW() WHERE attendance_id = $1 RETURNING *',
      [att.attendance_id]
    );
    return res.json({ action: 'checked_out', attendance: upd.rows[0] });
  } catch (error) {
    console.error('Face event error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});


