'use strict';
/**
 * A persistent express-session store backed by SQLite, written from scratch (finding S-12).
 * Replaces the default MemoryStore, which leaks memory and loses all sessions on restart.
 * Library alternative: better-sqlite3-session-store / connect-sqlite3.
 */
const session = require('express-session');

class SqliteSessionStore extends session.Store {
  constructor(db, { cleanupIntervalMs = 15 * 60 * 1000 } = {}) {
    super();
    this.db = db;
    this.q = {
      get: db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expires > ?'),
      set: db.prepare(`INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?)
                       ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires`),
      destroy: db.prepare('DELETE FROM sessions WHERE sid = ?'),
      touch: db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?'),
      prune: db.prepare('DELETE FROM sessions WHERE expires <= ?'),
    };
    this.timer = setInterval(() => this.prune(), cleanupIntervalMs);
    this.timer.unref();
  }

  static expiryOf(sess) {
    const exp = sess && sess.cookie && sess.cookie.expires;
    return exp ? new Date(exp).getTime() : Date.now() + 24 * 60 * 60 * 1000;
  }

  get(sid, cb) {
    try {
      const row = this.q.get.get(sid, Date.now());
      cb(null, row ? JSON.parse(row.sess) : null);
    } catch (err) { cb(err); }
  }

  set(sid, sess, cb = () => {}) {
    try {
      this.q.set.run(sid, JSON.stringify(sess), SqliteSessionStore.expiryOf(sess));
      cb(null);
    } catch (err) { cb(err); }
  }

  destroy(sid, cb = () => {}) {
    try { this.q.destroy.run(sid); cb(null); } catch (err) { cb(err); }
  }

  touch(sid, sess, cb = () => {}) {
    try { this.q.touch.run(SqliteSessionStore.expiryOf(sess), sid); cb(null); } catch (err) { cb(err); }
  }

  prune() {
    try { this.q.prune.run(Date.now()); } catch { /* database closed during shutdown */ }
  }

  close() { clearInterval(this.timer); }
}

module.exports = { SqliteSessionStore };
