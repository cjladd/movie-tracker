const { isValidEmail, isPositiveInt, parsePagination, apiResponse, apiError, paginatedResponse } = require('../utils/helpers');

describe('isValidEmail', () => {
  test('accepts valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('a.b@c.co')).toBe(true);
    expect(isValidEmail('user+tag@domain.org')).toBe(true);
  });

  test('rejects invalid emails', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('missing@')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
    expect(isValidEmail('spaces in@email.com')).toBe(false);
  });
});

describe('isPositiveInt', () => {
  test('accepts positive integers', () => {
    expect(isPositiveInt(1)).toBe(true);
    expect(isPositiveInt(999)).toBe(true);
    expect(isPositiveInt('5')).toBe(true);
  });

  test('rejects non-positive or non-integer values', () => {
    expect(isPositiveInt(0)).toBe(false);
    expect(isPositiveInt(-1)).toBe(false);
    expect(isPositiveInt(1.5)).toBe(false);
    expect(isPositiveInt('abc')).toBe(false);
    expect(isPositiveInt(null)).toBe(false);
    expect(isPositiveInt(undefined)).toBe(false);
  });
});

describe('parsePagination', () => {
  test('returns defaults for empty query', () => {
    const result = parsePagination({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  test('parses valid page and limit', () => {
    const result = parsePagination({ page: '3', limit: '10' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(20);
  });

  test('clamps limit to max', () => {
    const result = parsePagination({ limit: '500' });
    expect(result.limit).toBe(100);
  });

  test('handles invalid values gracefully', () => {
    const result = parsePagination({ page: 'abc', limit: '-5' });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });
});

describe('apiResponse', () => {
  test('returns success response with data and message', () => {
    const result = apiResponse({ id: 1 }, 'Created');
    expect(result).toEqual({ success: true, data: { id: 1 }, message: 'Created' });
  });

  test('returns success response with data only', () => {
    const result = apiResponse([1, 2, 3]);
    expect(result).toEqual({ success: true, data: [1, 2, 3] });
  });

  test('returns success response with message only', () => {
    const result = apiResponse(null, 'Done');
    expect(result).toEqual({ success: true, data: null, message: 'Done' });
  });
});

describe('apiError', () => {
  test('creates error with message and default status', () => {
    const err = apiError('Bad input');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Bad input');
    expect(err.status).toBe(400);
  });

  test('creates error with custom status', () => {
    const err = apiError('Not found', 404);
    expect(err.status).toBe(404);
  });
});

describe('paginatedResponse', () => {
  test('returns correct pagination metadata', () => {
    const result = paginatedResponse([{ id: 1 }], 50, 2, 10);
    expect(result.data).toEqual([{ id: 1 }]);
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 50,
      totalPages: 5,
    });
  });

  test('handles empty results', () => {
    const result = paginatedResponse([], 0, 1, 20);
    expect(result.data).toEqual([]);
    expect(result.pagination.totalPages).toBe(0);
  });
});
