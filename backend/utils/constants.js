module.exports = {
  SALT_ROUNDS: 10,

  VOTE_MIN: 1,
  VOTE_MAX: 5,

  PASSWORD_MIN_LENGTH: 8,

  FRIEND_REQUEST_STATUS: {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
  },

  MOVIE_NIGHT_STATUS: {
    PLANNED: 'planned',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },

  NOTIFICATION_TYPES: {
    GROUP_INVITE: 'group_invite',
    MOVIE_NIGHT: 'movie_night',
    VOTE_REMINDER: 'vote_reminder',
    FRIEND_REQUEST: 'friend_request',
    FRIEND_ACCEPTED: 'friend_accepted',
    WATCHLIST_ADD: 'watchlist_add',
  },

  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },

  ACCOUNT_LOCKOUT: {
    MAX_ATTEMPTS: 5,
    LOCKOUT_MINUTES: 15,
  },

  PASSWORD_RESET_EXPIRY_HOURS: 1,
};
