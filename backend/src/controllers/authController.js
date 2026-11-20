'use strict';
const validate = require('../validators');
const { HttpError } = require('../utils/httpError');
const { checkPasswordPolicy, hashPassword, verifyPassword, needsRehash } = require('../security/password');
const { ensureToken } = require('../security/csrf');
const { toPublicUser } = require('../views');

const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;

/**
 * Starts a fresh, authenticated session.
 * regenerate() throws the old session ID away, so an ID planted before login
 * is useless afterwards (session fixation, finding S-06).
 */
function startSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = user.id;
      req.session.authVersion = user.auth_version;
      req.session.createdAt = Date.now();
      const csrfToken = ensureToken(req.session); // new session, new CSRF token
      req.session.save((err2) => (err2 ? reject(err2) : resolve(csrfToken)));
    });
  });
}

module.exports = function authController({ db, audit, config }) {
  const q = {
    byEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    byId: db.prepare('SELECT * FROM users WHERE id = ?'),
    insert: db.prepare("INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, 'user')"),
    failed: db.prepare('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?'),
    success: db.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?'),
    rehash: db.prepare('UPDATE users SET password = ? WHERE id = ?'),
  };

  async function register(req, res) {
    const { name, email, password } = validate.register(req.body || {});
    const policy = checkPasswordPolicy(password, { email });
    if (policy) throw new HttpError(400, policy, { password: policy });

    // Accepted trade-off (finding S-14): without email verification, sign-up has to say
    // that an email is taken. Rate limiting keeps this from being used to scan emails.
    if (q.byEmail.get(email)) {
      throw new HttpError(409, 'An account with this email already exists', { email: 'An account with this email already exists' });
    }
    const hash = await hashPassword(password);
    const { lastInsertRowid } = q.insert.run(email, hash, name);
    const user = q.byId.get(Number(lastInsertRowid));
    const csrfToken = await startSession(req, user);
    audit(req, 'register', { userId: user.id, target: `user:${user.id}` });
    res.status(201).json({ message: 'Account created', user: toPublicUser(user), csrfToken });
  }

  async function login(req, res) {
    const { email, password } = validate.login(req.body || {});
    const user = q.byEmail.get(email);
    const now = Date.now();

    // Always run bcrypt, even for unknown emails, so timing reveals nothing (S-14).
    const match = await verifyPassword(password, user ? user.password : null);

    if (user && user.locked_until && user.locked_until > now) {
      audit(req, 'login_blocked_locked', { userId: user.id, target: `user:${user.id}` });
      const minutes = Math.ceil((user.locked_until - now) / 60000);
      throw new HttpError(429, `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
    }

    if (!user || !match) {
      if (user) {
        const fails = user.failed_logins + 1;
        const lock = fails >= MAX_FAILED ? now + LOCK_MS : null;
        q.failed.run(lock ? 0 : fails, lock, user.id);
        audit(req, lock ? 'account_locked' : 'login_failed', { userId: user.id, target: `user:${user.id}` });
      } else {
        audit(req, 'login_failed', { userId: null, details: { reason: 'unknown_email' } });
      }
      throw new HttpError(401, 'Invalid email or password');
    }

    q.success.run(user.id);
    if (needsRehash(user.password)) q.rehash.run(await hashPassword(password), user.id); // upgrade old cost-10 hashes
    const csrfToken = await startSession(req, user);
    audit(req, 'login_success', { userId: user.id, target: `user:${user.id}` });
    res.json({ message: 'Login successful', user: toPublicUser(user), csrfToken });
  }

  function logout(req, res, next) {
    const userId = req.session && req.session.userId;
    if (userId) audit(req, 'logout', { userId, target: `user:${userId}` });
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie(config.COOKIE_NAME, { path: '/' });
      res.json({ message: 'Logged out' });
    });
  }

  /** Anonymous visitors get { user: null } instead of a 401, which keeps the console clean. */
  function me(req, res) {
    const s = req.session;
    if (!s || !s.userId) return res.json({ user: null });
    const user = q.byId.get(s.userId);
    const absoluteMs = config.SESSION_ABSOLUTE_HOURS * 3600 * 1000;
    if (!user || user.auth_version !== s.authVersion || !s.createdAt || Date.now() - s.createdAt > absoluteMs) {
      return req.session.destroy(() => res.json({ user: null }));
    }
    res.json({ user: toPublicUser(user) });
  }

  return { register, login, logout, me };
};

module.exports.startSession = startSession;
