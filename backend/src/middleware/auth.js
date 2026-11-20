'use strict';
/**
 * Authentication and authorization.
 *
 * - The role is read from the database on every request (kept from v1: a demoted
 *   user loses access immediately).
 * - auth_version must match the value stored at login. Changing the password bumps it,
 *   which instantly invalidates every other session of that user (finding S-10).
 * - Sessions also have an absolute lifetime, not only an idle timeout (finding S-12).
 */
function createAuth(db, config) {
  const findUser = db.prepare('SELECT id, email, name, role, manager_request_status, auth_version, created_at FROM users WHERE id = ?');
  const absoluteMs = config.SESSION_ABSOLUTE_HOURS * 60 * 60 * 1000;

  function endSession(req, res, message) {
    req.session.destroy(() => {
      res.clearCookie(config.COOKIE_NAME, { path: '/' });
      res.status(401).json({ error: message, code: 'SESSION_EXPIRED' });
    });
  }

  function requireAuth(req, res, next) {
    const s = req.session;
    if (!s || !s.userId) return res.status(401).json({ error: 'Please log in to continue', code: 'AUTH_REQUIRED' });
    if (!s.createdAt || Date.now() - s.createdAt > absoluteMs) {
      return endSession(req, res, 'Your session has expired. Please log in again');
    }
    const user = findUser.get(s.userId);
    if (!user || user.auth_version !== s.authVersion) {
      return endSession(req, res, 'Your session is no longer valid. Please log in again');
    }
    req.user = user;
    next();
  }

  const requireRole = (...roles) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Please log in to continue', code: 'AUTH_REQUIRED' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission to do this' });
    next();
  };

  return { requireAuth, requireRole };
}

/** One place that decides who may manage a trip (finding S-19). */
const canManageTrip = (user, trip) => !!user && !!trip && (user.role === 'admin' || trip.manager_id === user.id);

module.exports = { createAuth, canManageTrip };
