// backend/setup-db.js — Automatic Database Seeder & Schema Initializer
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

async function setupDatabase() {
  const connectionUrl = process.argv[2] || process.env.MYSQL_URL || process.env.DATABASE_URL;
  const dbName = process.env.DB_NAME || process.env.MYSQLDATABASE || 'shopease';

  let connection;

  try {
    if (connectionUrl) {
      console.log('📡 Connecting via database connection URL...');
      connection = await mysql.createConnection({
        uri: connectionUrl,
        multipleStatements: true,
        ssl: { rejectUnauthorized: false }
      });
      console.log('✅ Connected to database host.');
    } else {
      console.log('📡 Connecting to MySQL server...');
      const host = process.env.DB_HOST || 'localhost';
      const port = Number(process.env.DB_PORT) || 3306;
      const user = process.env.DB_USER || 'root';
      const password = process.env.DB_PASSWORD || '';
      const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined;

      // 1. First connect without selecting a database
      connection = await mysql.createConnection({
        host,
        port,
        user,
        password,
        ssl,
        multipleStatements: true
      });
      console.log('✅ Connected to MySQL server.');

      // 2. Create database if it does not exist
      console.log(`⏳ Ensuring database "${dbName}" exists...`);
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      await connection.query(`USE \`${dbName}\`;`);
      console.log(`✅ Using database "${dbName}".`);
    }

    const sqlPath = path.join(__dirname, 'database.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('⏳ Creating tables, constraints, indexes, and demo seed data...');
    await connection.query(sql);

    console.log('🎉 Database setup complete! All tables and seed data created successfully.');
    await connection.end();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Database setup failed:');
    console.error(`   ${err.message}`);
    console.error('\n👉 Troubleshooting checklist:');
    console.error('   1. Ensure your MySQL server is running (e.g., service mysql start / MySQL Workbench).');
    console.error('   2. Verify DB_HOST, DB_PORT, DB_USER, and DB_PASSWORD in your .env file.');
    console.error('   3. If using root without a password, ensure DB_PASSWORD is left empty in .env.\n');
    process.exit(1);
  }
}

setupDatabase();
