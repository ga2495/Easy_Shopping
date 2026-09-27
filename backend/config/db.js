// backend/config/db.js — Production-ready MySQL Connection Pool
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

// Determine connection configuration
// Supports Railway (MYSQL_URL, MYSQLHOST, etc.) and standard .env variables
const isCloudOrSSL = process.env.DB_SSL === 'true' || 
  Boolean(process.env.MYSQL_URL && !process.env.MYSQL_URL.includes('localhost')) ||
  Boolean(process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost'));

const poolConfig = (process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQL_PRIVATE_URL)
  ? (process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQL_PRIVATE_URL)
  : {
      host:     process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
      user:     process.env.DB_USER || process.env.MYSQLUSER || 'root',
      password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
      database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'shopease',
      port:     Number(process.env.DB_PORT || process.env.MYSQLPORT) || 3306,
      ssl:      isCloudOrSSL ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };

const db = mysql.createPool(poolConfig);

// Test database connection on startup
(async () => {
  try {
    const connection = await db.getConnection();
    console.log('✅ Connected to MySQL database successfully.');
    connection.release();
  } catch (err) {
    console.error('❌ MySQL Database Connection Error:', err.message);
    console.error('👉 Please configure your .env file and run `npm run setup-db` if the database has not been initialized.');
  }
})();

module.exports = db;
