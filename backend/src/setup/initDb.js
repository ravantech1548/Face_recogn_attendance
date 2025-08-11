const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function initDb() {
  const schemaPath = path.join(__dirname, '../../sql/schema.sql');
  try {
    if (!fs.existsSync(schemaPath)) {
      console.warn('[initDb] Schema file not found:', schemaPath);
      return;
    }
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(sql);
    console.log('[initDb] Database schema ensured');
  } catch (error) {
    console.error('[initDb] Failed to apply schema:', error.message);
  }
}

module.exports = initDb;


