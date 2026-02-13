const { pool } = require('../config/database');
const logger = require('./logger');

const GROUP_ACTIVITY_EVENT = {
  GROUP_CREATED: 'group_created',
  MEMBER_ADDED: 'member_added',
  MEMBER_REMOVED: 'member_removed',
  ROLE_CHANGED: 'role_changed',
  MOVIE_NIGHT_CREATED: 'movie_night_created',
  MOVIE_NIGHT_UPDATED: 'movie_night_updated',
  MOVIE_NIGHT_LOCKED: 'movie_night_locked',
  MOVIE_NIGHT_UNLOCKED: 'movie_night_unlocked',
  RSVP_REMINDER_SENT: 'rsvp_reminder_sent',
  AVAILABILITY_UPDATED: 'availability_updated',
  WATCHLIST_ADDED: 'watchlist_added',
  WATCHLIST_REMOVED: 'watchlist_removed',
  VOTE_CAST: 'vote_cast',
};

function isMissingActivitySchemaError(err) {
  return err && (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR');
}

function parseActivityMetadata(rawValue) {
  if (rawValue === null || rawValue === undefined) return null;
  if (typeof rawValue === 'object') return rawValue;
  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

async function recordGroupActivity(activity, conn = pool) {
  if (!activity || !activity.groupId || !activity.eventType) return;

  const metadataJson = activity.metadata ? JSON.stringify(activity.metadata) : null;
  try {
    await conn.query(
      `INSERT INTO Group_Activity
       (group_id, actor_user_id, target_user_id, event_type, reference_id, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        activity.groupId,
        activity.actorUserId || null,
        activity.targetUserId || null,
        activity.eventType,
        activity.referenceId || null,
        metadataJson,
      ]
    );
  } catch (err) {
    if (isMissingActivitySchemaError(err)) {
      logger.warn('Group activity schema unavailable; skipping activity event', {
        groupId: activity.groupId,
        eventType: activity.eventType,
      });
      return;
    }
    throw err;
  }
}

module.exports = {
  GROUP_ACTIVITY_EVENT,
  isMissingActivitySchemaError,
  parseActivityMetadata,
  recordGroupActivity,
};
