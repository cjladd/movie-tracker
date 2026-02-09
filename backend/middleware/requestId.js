const { v4: uuidv4 } = require('uuid');

function requestId(req, _res, next) {
  req.id = req.headers['x-request-id'] || uuidv4().slice(0, 12);
  next();
}

module.exports = { requestId };
