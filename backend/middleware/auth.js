const { apiError } = require('../utils/helpers');

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return next(apiError('Authentication required', 401));
  }
  next();
}

module.exports = { requireAuth };
