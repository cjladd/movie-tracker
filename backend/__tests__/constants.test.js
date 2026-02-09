const constants = require('../utils/constants');

describe('constants', () => {
  test('SALT_ROUNDS is a positive integer', () => {
    expect(constants.SALT_ROUNDS).toBeGreaterThan(0);
    expect(Number.isInteger(constants.SALT_ROUNDS)).toBe(true);
  });

  test('VOTE_MIN < VOTE_MAX', () => {
    expect(constants.VOTE_MIN).toBeLessThan(constants.VOTE_MAX);
  });

  test('PASSWORD_MIN_LENGTH is reasonable', () => {
    expect(constants.PASSWORD_MIN_LENGTH).toBeGreaterThanOrEqual(8);
  });

  test('FRIEND_REQUEST_STATUS has expected values', () => {
    expect(constants.FRIEND_REQUEST_STATUS).toEqual({
      PENDING: 'pending',
      ACCEPTED: 'accepted',
      DECLINED: 'declined',
    });
  });

  test('MOVIE_NIGHT_STATUS has expected values', () => {
    expect(constants.MOVIE_NIGHT_STATUS).toEqual({
      PLANNED: 'planned',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled',
    });
  });

  test('PAGINATION defaults are sensible', () => {
    expect(constants.PAGINATION.DEFAULT_PAGE).toBe(1);
    expect(constants.PAGINATION.DEFAULT_LIMIT).toBeGreaterThan(0);
    expect(constants.PAGINATION.MAX_LIMIT).toBeGreaterThan(constants.PAGINATION.DEFAULT_LIMIT);
  });

  test('ACCOUNT_LOCKOUT is configured', () => {
    expect(constants.ACCOUNT_LOCKOUT.MAX_ATTEMPTS).toBeGreaterThan(0);
    expect(constants.ACCOUNT_LOCKOUT.LOCKOUT_MINUTES).toBeGreaterThan(0);
  });
});
