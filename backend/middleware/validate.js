const { isPositiveInt, apiError, isValidEmail } = require('../utils/helpers');

function validateParamId(...params) {
  return (req, _res, next) => {
    for (const param of params) {
      if (!isPositiveInt(req.params[param])) {
        return next(apiError(`Invalid ${param}`, 400));
      }
    }
    next();
  };
}

function requireFields(...fields) {
  return (req, _res, next) => {
    const missing = fields.filter((f) => !req.body[f] && req.body[f] !== 0);
    if (missing.length > 0) {
      return next(apiError(`Missing required fields: ${missing.join(', ')}`, 400));
    }
    next();
  };
}

function validateEmail(field = 'email') {
  return (req, _res, next) => {
    const email = req.body[field];
    if (email && !isValidEmail(email)) {
      return next(apiError('Invalid email format', 400));
    }
    next();
  };
}

function sanitizeBody(...fields) {
  return (req, _res, next) => {
    for (const field of fields) {
      if (typeof req.body[field] === 'string') {
        req.body[field] = req.body[field].trim();
      }
    }
    next();
  };
}

module.exports = { validateParamId, requireFields, validateEmail, sanitizeBody };
