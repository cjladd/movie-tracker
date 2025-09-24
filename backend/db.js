const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Establish a connection to the configured database.  Note that this function
 * returns a promise.  You should call getConnection() inside your route
 * handlers when you need to execute queries.
 *
 * @returns {Promise<mysql.Connection>} a promise that resolves to a MySQL connection
 */
async function getConnection() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  return connection;
}

module.exports = { getConnection };
