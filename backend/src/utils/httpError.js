'use strict';
/**
 * An error whose message is safe to show to the client.
 * Anything that is NOT an HttpError is treated as unexpected, and the
 * client only sees a generic message (finding S-15).
 */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details; // e.g. { field: 'message' } for form errors
    this.expose = true;
  }
}

module.exports = { HttpError };
