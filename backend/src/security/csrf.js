'use strict';
/**
 * CSRF protection with the synchronizer-token pattern, written from scratch (finding S-07).
 *
 * 1. The client asks GET /api/auth/csrf and receives a random token tied to its session.
 * 2. Every state-changing request (POST/PUT/PATCH/DELETE) must echo it in X-CSRF-Token.
 * 3. A malicious site can make the browser send the cookie, but it cannot read the token.
 *
 * The SameSite=Strict cookie and the CORS allow-list are two more layers on top.
 */
const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function ensureToken(session) {
  if (!session.csrf) session.csrf = crypto.randomBytes(32).toString('hex');
  return session.csrf;
}

function issue(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ csrfToken: ensureToken(req.session) });
}

function guard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const sent = Buffer.from(String(req.get('X-CSRF-Token') || ''));
  const real = Buffer.from(String((req.session && req.session.csrf) || ''));
  // timingSafeEqual: comparison time does not reveal how many characters matched.
  const ok = real.length > 0 && sent.length === real.length && crypto.timingSafeEqual(sent, real);
  if (!ok) return res.status(403).json({ error: 'Invalid or missing CSRF token', code: 'CSRF' });
  next();
}

module.exports = { issue, guard, ensureToken };
