const { buildMovieNightIcs, escapeIcsText, toIcsFilename, toUtcTimestamp } = require('../utils/ics');

describe('ICS utilities', () => {
  test('escapeIcsText escapes reserved characters and line breaks', () => {
    const escaped = escapeIcsText('Movie, Night; Plan\\Now\nLine 2');
    expect(escaped).toBe('Movie\\, Night\\; Plan\\\\Now\\nLine 2');
  });

  test('toUtcTimestamp creates RFC5545 UTC datetime values', () => {
    expect(toUtcTimestamp('2026-02-12T20:15:30Z')).toBe('20260212T201530Z');
  });

  test('buildMovieNightIcs returns a valid VCALENDAR payload', () => {
    const payload = buildMovieNightIcs({
      uid: 'movie-night-44@movienightplanner.local',
      createdAt: '2026-02-01T10:00:00Z',
      startAt: '2026-02-20T20:00:00Z',
      summary: 'Friday Movie Night',
      description: 'Watchlist winner',
      calendarName: 'My Group Nights',
    });

    expect(payload.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(payload.includes('BEGIN:VEVENT')).toBe(true);
    expect(payload.includes('UID:movie-night-44@movienightplanner.local')).toBe(true);
    expect(payload.includes('SUMMARY:Friday Movie Night')).toBe(true);
    expect(payload.endsWith('\r\n')).toBe(true);
  });

  test('toIcsFilename returns a safe deterministic filename', () => {
    const filename = toIcsFilename('Friday Crew!!', '2026-02-20T20:00:00Z', 44);
    expect(filename).toBe('friday-crew-20260220-44.ics');
  });
});
