function pad2(value) {
  return String(value).padStart(2, '0');
}

function toUtcTimestamp(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date supplied for ICS');
  }

  return [
    date.getUTCFullYear(),
    pad2(date.getUTCMonth() + 1),
    pad2(date.getUTCDate()),
    'T',
    pad2(date.getUTCHours()),
    pad2(date.getUTCMinutes()),
    pad2(date.getUTCSeconds()),
    'Z',
  ].join('');
}

function escapeIcsText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function foldIcsLine(line) {
  const safeLine = String(line || '');
  if (safeLine.length <= 73) return safeLine;

  const chunks = [];
  for (let i = 0; i < safeLine.length; i += 73) {
    const chunk = safeLine.slice(i, i + 73);
    chunks.push(i === 0 ? chunk : ` ${chunk}`);
  }
  return chunks.join('\r\n');
}

function buildMovieNightIcs(event) {
  const startAt = new Date(event.startAt);
  if (Number.isNaN(startAt.getTime())) {
    throw new Error('Movie night start date is invalid');
  }

  const endAt = event.endAt ? new Date(event.endAt) : new Date(startAt.getTime() + 2 * 60 * 60 * 1000);
  if (Number.isNaN(endAt.getTime())) {
    throw new Error('Movie night end date is invalid');
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MovieNightPlanner//Stream Teams//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(event.calendarName || 'Movie Nights')}`,
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(event.uid)}`,
    `DTSTAMP:${toUtcTimestamp(event.createdAt || new Date())}`,
    `DTSTART:${toUtcTimestamp(startAt)}`,
    `DTEND:${toUtcTimestamp(endAt)}`,
    `SUMMARY:${escapeIcsText(event.summary || 'Movie Night')}`,
    `DESCRIPTION:${escapeIcsText(event.description || 'Movie night with your stream team.')}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

function slugifyForFilename(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function toIcsFilename(groupName, startAt, nightId) {
  const safeGroupName = slugifyForFilename(groupName) || 'movie-night';
  const date = new Date(startAt);
  const dateToken = Number.isNaN(date.getTime())
    ? 'event'
    : `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}`;
  const idToken = Number.isInteger(Number(nightId)) ? String(Number(nightId)) : 'event';
  return `${safeGroupName}-${dateToken}-${idToken}.ics`;
}

module.exports = {
  buildMovieNightIcs,
  escapeIcsText,
  toIcsFilename,
  toUtcTimestamp,
};
