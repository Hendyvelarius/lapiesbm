const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_HOST,
  port: parseInt(process.env.SQL_PORT, 10) || 1433,
  database: process.env.SQL_DATABASE,
  requestTimeout: 120000, // 120 seconds for long-running stored procedures
  options: {
    encrypt: false, 
    trustServerCertificate: true
  }
};

async function connect() {
  try {
    const pool = await sql.connect(config);
    return pool;
  } catch (err) {
    console.error('SQL Server connection error:', err);
    throw err;
  }
}

module.exports = { connect, sql };