const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  const errorId = uuidv4().slice(0, 8);
  const status = err.status || 500;

  if (status === 500) {
    logger.error(`[${errorId}] ${req.method} ${req.originalUrl}`, {
      error: err.message,
      stack: err.stack,
      requestId: req.id,
    });
  }

  res.status(status).json({
    success: false,
    error: status === 500 ? 'Internal server error' : err.message,
    errorId: status === 500 ? errorId : undefined,
  });
}

module.exports = { errorHandler };
