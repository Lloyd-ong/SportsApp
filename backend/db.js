const mysql = require('mysql2/promise');

const port = Number.parseInt(process.env.DB_PORT, 10) || 3306;

const config = {
  host: process.env.DB_HOST,
  port,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
};

if (process.env.DB_SOCKET) {
  config.socketPath = process.env.DB_SOCKET;
}

const pool = mysql.createPool(config);

module.exports = pool;
