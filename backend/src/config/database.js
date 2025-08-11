const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'face_recognition_attendance',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
});

module.exports = pool;


