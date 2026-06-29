const mysql = require('mysql2');
require('dotenv').config();

// Extract password string and evaluate if it contains explicit placeholder quotes
let dbPassword = process.env.DB_PASSWORD;
if (dbPassword === '""' || dbPassword === "''") {
    dbPassword = ''; // Convert literal quote strings from .env to an actual empty string for XAMPP
}

// Create a reusable connection pool mapping directly to local environment context
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: dbPassword,
    database: process.env.DB_NAME || 'oswms_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Export the promise-based wrapper for clean async/await queries
module.exports = pool.promise();
