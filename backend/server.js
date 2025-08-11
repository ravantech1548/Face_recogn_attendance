const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./src/routes/auth');
const staffRoutes = require('./src/routes/staff');
const attendanceRoutes = require('./src/routes/attendance');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/attendance', attendanceRoutes);

// Health
app.get('/api/health', (req, res) => {
  res.json({ message: 'Face Recognition API is running!' });
});

// Initialize DB schema at startup (best-effort)
const initDb = require('./src/setup/initDb');
initDb().finally(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});


