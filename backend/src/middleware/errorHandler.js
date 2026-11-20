'use strict';
/**
 * Request IDs + one central error handler (finding S-15).
 * Clients get a safe message and a request ID; the full error stays in the server log.
 */
const crypto = require('crypto');
const multer = require('multer');

function requestId(req, res, next) {
  req.id = crypto.randomUUID();
  res.set('X-Request-Id', req.id);
  next();
}

function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return;

  if (err instanceof multer.MulterError) {
    const map = {
      LIMIT_FILE_SIZE: [413, 'The image must be 5 MB or smaller'],
      LIMIT_FILE_COUNT: [400, 'Only one image can be uploaded'],
      LIMIT_UNEXPECTED_FILE: [400, 'Unexpected file field'],
    };
    const [status, message] = map[err.code] || [400, 'Invalid upload'];
    return res.status(status).json({ error: message, details: { image: message } });
  }

  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large' });

  if (err.expose && err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
  }

  console.error(`[${req.id}] ${req.method} ${req.originalUrl}\n`, err);
  res.status(500).json({ error: 'Something went wrong. Please try again.', requestId: req.id });
}

module.exports = { requestId, notFound, errorHandler };
