const { validateParamId, requireFields, validateEmail, sanitizeBody } = require('../middleware/validate');

// Helper to create mock req/res/next
function createMocks(overrides = {}) {
  const req = {
    params: {},
    body: {},
    query: {},
    ...overrides,
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('validateParamId', () => {
  test('passes for valid numeric param', () => {
    const { req, res, next } = createMocks({ params: { groupId: '5' } });
    validateParamId('groupId')(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  test('rejects non-numeric param', () => {
    const { req, res, next } = createMocks({ params: { groupId: 'abc' } });
    validateParamId('groupId')(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Invalid'),
      status: 400,
    }));
  });

  test('rejects zero', () => {
    const { req, res, next } = createMocks({ params: { id: '0' } });
    validateParamId('id')(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
  });

  test('validates multiple params', () => {
    const { req, res, next } = createMocks({
      params: { groupId: '1', movieId: '2' },
    });
    validateParamId('groupId', 'movieId')(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('requireFields', () => {
  test('passes when all fields present', () => {
    const { req, res, next } = createMocks({
      body: { name: 'John', email: 'j@e.com' },
    });
    requireFields('name', 'email')(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  test('rejects when fields missing', () => {
    const { req, res, next } = createMocks({ body: { name: 'John' } });
    requireFields('name', 'email')(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('email'),
      status: 400,
    }));
  });

  test('rejects empty string', () => {
    const { req, res, next } = createMocks({ body: { name: '' } });
    requireFields('name')(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
  });
});

describe('validateEmail', () => {
  test('passes for valid email', () => {
    const { req, res, next } = createMocks({ body: { email: 'test@test.com' } });
    validateEmail()(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  test('rejects invalid email', () => {
    const { req, res, next } = createMocks({ body: { email: 'notvalid' } });
    validateEmail()(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
  });

  test('passes when email field is absent', () => {
    const { req, res, next } = createMocks({ body: {} });
    validateEmail()(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('sanitizeBody', () => {
  test('trims whitespace from string fields', () => {
    const { req, res, next } = createMocks({
      body: { name: '  John  ', email: ' j@e.com ' },
    });
    sanitizeBody('name', 'email')(req, res, next);
    expect(req.body.name).toBe('John');
    expect(req.body.email).toBe('j@e.com');
    expect(next).toHaveBeenCalledWith();
  });

  test('ignores non-string fields', () => {
    const { req, res, next } = createMocks({ body: { count: 5 } });
    sanitizeBody('count')(req, res, next);
    expect(req.body.count).toBe(5);
    expect(next).toHaveBeenCalledWith();
  });
});
