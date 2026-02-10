const { pool } = require('../config/database');
const { PAGINATION } = require('./constants');

async function getUserByEmail(email) {
  try {
    const [rows] = await pool.query(
      'SELECT user_id, name, email, password, failed_login_attempts, locked_until FROM Users WHERE email = ? AND deleted_at IS NULL',
      [email]
    );
    return rows[0] || null;
  } catch (err) {
    // Backward-compatibility for older schemas that do not include lockout/soft-delete columns.
    if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
    const [rows] = await pool.query(
      'SELECT user_id, name, email, password FROM Users WHERE email = ?',
      [email]
    );
    if (!rows[0]) return null;
    return {
      ...rows[0],
      failed_login_attempts: 0,
      locked_until: null,
    };
  }
}

async function getUserById(userId) {
  const [rows] = await pool.query(
    'SELECT user_id, name, email FROM Users WHERE user_id = ? AND deleted_at IS NULL',
    [userId]
  );
  return rows[0] || null;
}

async function verifyMembership(groupId, userId) {
  const [rows] = await pool.query(
    'SELECT 1 FROM Group_Members gm JOIN Movie_Groups mg ON gm.group_id = mg.group_id WHERE gm.group_id = ? AND gm.user_id = ? AND mg.deleted_at IS NULL',
    [groupId, userId]
  );
  return rows.length > 0;
}

function parsePagination(query) {
  let page = parseInt(query.page, 10) || PAGINATION.DEFAULT_PAGE;
  let limit = parseInt(query.limit, 10) || PAGINATION.DEFAULT_LIMIT;
  if (page < 1) page = 1;
  if (limit < 1) limit = PAGINATION.DEFAULT_LIMIT;
  if (limit > PAGINATION.MAX_LIMIT) limit = PAGINATION.MAX_LIMIT;
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function paginatedResponse(rows, total, page, limit) {
  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

function apiResponse(data, message) {
  const res = { success: true };
  if (message) res.message = message;
  if (data !== undefined) res.data = data;
  return res;
}

function apiError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0;
}

module.exports = {
  getUserByEmail,
  getUserById,
  verifyMembership,
  parsePagination,
  paginatedResponse,
  apiResponse,
  apiError,
  isValidEmail,
  isPositiveInt,
};
