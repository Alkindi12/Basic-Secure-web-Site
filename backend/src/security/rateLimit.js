'use strict';
/**
 * Fixed-window rate limiter, written from scratch (finding S-04).
 * Library alternative: express-rate-limit.
 *
 * Limitation (documented in SECURITY.md): counters live in this process's memory,
 * so they reset on restart and are not shared between several server instances.
 */
function rateLimit({ windowMs, max, key = (req) => req.ip, message = 'Too many attempts. Please try again later.' }) {
  const hits = new Map();

  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, Math.min(windowMs, 60_000));
  sweeper.unref(); // never keep the process alive just for this

  const middleware = (req, res, next) => {
    const k = key(req);
    const now = Date.now();
    let entry = hits.get(k);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(k, entry);
    }
    entry.count += 1;
    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.reset - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message, retryAfter });
    }
    next();
  };
  middleware.reset = () => hits.clear();
  return middleware;
}

module.exports = { rateLimit };
