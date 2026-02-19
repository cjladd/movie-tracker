const { pool } = require('../config/database');

const NOTIFICATION_PREFERENCE_COLUMNS = new Set([
  'email_notifications',
  'group_notifications',
  'vote_notifications',
]);

function isMissingColumnError(err) {
  return err && err.code === 'ER_BAD_FIELD_ERROR';
}

function toPositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function buildExcludedUsersClause(column, excludedUserIds) {
  const ids = Array.isArray(excludedUserIds)
    ? excludedUserIds.map(toPositiveInt).filter((id) => id !== null)
    : [];
  if (ids.length === 0) return { sql: '', params: [] };
  return {
    sql: ` AND ${column} NOT IN (${ids.map(() => '?').join(', ')})`,
    params: ids,
  };
}

async function userAllowsPreference(userId, preferenceColumn, conn = pool) {
  const normalizedUserId = toPositiveInt(userId);
  if (!normalizedUserId) return false;
  if (!NOTIFICATION_PREFERENCE_COLUMNS.has(preferenceColumn)) return true;

  try {
    const [rows] = await conn.query(
      `SELECT ${preferenceColumn} AS enabled
       FROM Users
       WHERE user_id = ? AND deleted_at IS NULL`,
      [normalizedUserId]
    );
    if (rows.length === 0) return false;
    return !!rows[0].enabled;
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    const [rows] = await conn.query(
      'SELECT user_id FROM Users WHERE user_id = ? AND deleted_at IS NULL',
      [normalizedUserId]
    );
    return rows.length > 0;
  }
}

async function getGroupRecipientUserIds(
  groupId,
  { excludeUserIds = [], preferenceColumn = 'group_notifications' } = {},
  conn = pool
) {
  const normalizedGroupId = toPositiveInt(groupId);
  if (!normalizedGroupId) return [];

  const exclusion = buildExcludedUsersClause('gm.user_id', excludeUserIds);
  const params = [normalizedGroupId, ...exclusion.params];

  try {
    if (!NOTIFICATION_PREFERENCE_COLUMNS.has(preferenceColumn)) {
      throw new Error(`Unsupported preference column: ${preferenceColumn}`);
    }

    const [rows] = await conn.query(
      `SELECT gm.user_id
       FROM Group_Members gm
       JOIN Users u ON u.user_id = gm.user_id
       WHERE gm.group_id = ? AND u.deleted_at IS NULL
         AND u.${preferenceColumn} = TRUE${exclusion.sql}`,
      params
    );
    return rows
      .map((row) => toPositiveInt(row.user_id))
      .filter((id) => id !== null);
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    const [rows] = await conn.query(
      `SELECT gm.user_id
       FROM Group_Members gm
       JOIN Users u ON u.user_id = gm.user_id
       WHERE gm.group_id = ? AND u.deleted_at IS NULL${exclusion.sql}`,
      params
    );
    return rows
      .map((row) => toPositiveInt(row.user_id))
      .filter((id) => id !== null);
  }
}

async function insertNotifications(conn = pool, notifications = []) {
  if (!Array.isArray(notifications) || notifications.length === 0) return 0;

  const normalized = notifications
    .map((notification) => {
      const userId = toPositiveInt(notification.userId);
      const referenceId = notification.referenceId === undefined || notification.referenceId === null
        ? null
        : toPositiveInt(notification.referenceId);
      const type = notification && notification.type ? String(notification.type).trim() : '';
      const title = notification && notification.title ? String(notification.title).trim() : '';
      const message = notification && notification.message ? String(notification.message).trim() : '';

      if (!userId || !type || !title || !message) return null;
      return {
        userId,
        type,
        title,
        message,
        referenceId,
      };
    })
    .filter(Boolean);

  if (normalized.length === 0) return 0;

  const placeholders = normalized.map(() => '(?, ?, ?, ?, ?)').join(', ');
  const values = normalized.flatMap((notification) => [
    notification.userId,
    notification.type,
    notification.title,
    notification.message,
    notification.referenceId,
  ]);

  const [result] = await conn.query(
    `INSERT INTO Notifications (user_id, type, title, message, reference_id)
     VALUES ${placeholders}`,
    values
  );

  return result && Number.isInteger(result.affectedRows)
    ? result.affectedRows
    : normalized.length;
}

async function insertNotificationForUserIfPreferred(
  {
    userId,
    preferenceColumn = 'group_notifications',
    type,
    title,
    message,
    referenceId = null,
  },
  conn = pool
) {
  const allowed = await userAllowsPreference(userId, preferenceColumn, conn);
  if (!allowed) return false;
  await insertNotifications(conn, [{
    userId,
    type,
    title,
    message,
    referenceId,
  }]);
  return true;
}

module.exports = {
  getGroupRecipientUserIds,
  insertNotifications,
  insertNotificationForUserIfPreferred,
  userAllowsPreference,
};
