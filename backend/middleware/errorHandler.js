function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const message =
    status === 500 ? 'Internal server error' : err.message || 'Something went wrong';

  if (status === 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
