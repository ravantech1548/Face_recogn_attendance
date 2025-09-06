const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const https = require('https');
const fs = require('fs');

dotenv.config();

const authRoutes = require('./src/routes/auth');
const staffRoutes = require('./src/routes/staff');
const attendanceRoutes = require('./src/routes/attendance');
const usersRoutes = require('./src/routes/users');

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
app.use('/api/users', usersRoutes);

// Health
app.get('/api/health', (req, res) => {
  res.json({ message: 'Face Recognition API is running!' });
});

// Initialize DB schema at startup (best-effort)
const initDb = require('./src/setup/initDb');
initDb().finally(() => {
  // Try to load SSL certificates
  try {
    const options = {
      key: fs.readFileSync('../ssl/key.pem'),
      cert: fs.readFileSync('../ssl/cert.pem')
    };
    
    https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
      console.log(`HTTPS Server running on port ${PORT}`);
    });
  } catch (error) {
    console.log('SSL certificates not found, falling back to HTTP');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`HTTP Server running on port ${PORT}`);
    });
  }
});


