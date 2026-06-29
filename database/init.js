/**
 * Initialize OSWMS database (run when MySQL is available).
 * Usage: node database/init.js
 */
const fs = require('fs');
const path = require('path');
const mysql = require(path.join(__dirname, '../backend/node_modules/mysql2/promise'));
const dotenv = require(path.join(__dirname, '../backend/node_modules/dotenv'));

dotenv.config({ path: path.join(__dirname, '../backend/.env') });
dotenv.config({ path: path.join(__dirname, '.env') });

function normalizePassword(password) {
  if (password === '""' || password === "''" || password == null) return '';
  return password;
}

function getSchemaSql() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  return schemaSql
    .replace(/DROP DATABASE IF EXISTS [^;]+;\s*/i, '')
    .replace(/CREATE DATABASE [^;]+;\s*/i, '')
    .replace(/USE [^;]+;\s*/i, '');
}

async function init() {
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = Number(process.env.DB_PORT) || 3306;
  const dbUser = process.env.DB_USER || 'root';
  const dbPassword = normalizePassword(process.env.DB_PASSWORD);
  const dbName = process.env.DB_NAME || 'oswms_db';

  const connection = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    multipleStatements: true
  });

  console.log(`Connected to MySQL at ${dbHost}:${dbPort} as ${dbUser}`);

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`USE \`${dbName}\``);
  console.log(`Applying schema to database ${dbName}...`);
  await connection.query(getSchemaSql());
  console.log(`Database schema applied.`);
  await connection.end();

  const { seed } = require('./seed');
  await seed();
  console.log('Database seed complete. Initialization finished successfully.');
}

init().catch((err) => {
  console.error('Database init failed:', err.message || err);
  process.exit(1);
});
