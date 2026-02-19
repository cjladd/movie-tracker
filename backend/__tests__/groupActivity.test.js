const { GROUP_ACTIVITY_EVENT, parseActivityMetadata } = require('../utils/groupActivity');

describe('GROUP_ACTIVITY_EVENT', () => {
  test('exposes expected timeline events', () => {
    expect(GROUP_ACTIVITY_EVENT).toMatchObject({
      GROUP_CREATED: 'group_created',
      MEMBER_ADDED: 'member_added',
      MEMBER_REMOVED: 'member_removed',
      ROLE_CHANGED: 'role_changed',
      MOVIE_NIGHT_CREATED: 'movie_night_created',
      MOVIE_NIGHT_UPDATED: 'movie_night_updated',
      VOTE_CAST: 'vote_cast',
    });
  });
});

describe('parseActivityMetadata', () => {
  test('returns object values as-is', () => {
    const metadata = { foo: 'bar' };
    expect(parseActivityMetadata(metadata)).toEqual(metadata);
  });

  test('parses valid JSON strings', () => {
    expect(parseActivityMetadata('{"foo":"bar"}')).toEqual({ foo: 'bar' });
  });

  test('returns null for invalid JSON', () => {
    expect(parseActivityMetadata('{bad')).toBeNull();
  });
});
