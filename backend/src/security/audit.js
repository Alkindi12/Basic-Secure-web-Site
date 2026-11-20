'use strict';
/**
 * Audit log of security-relevant events (finding S-17).
 * Never log secrets: no passwords, tokens or session IDs end up here.
 */
function createAudit(db) {
  const insert = db.prepare('INSERT INTO audit_log (user_id, ip, action, target, details) VALUES (?, ?, ?, ?, ?)');
  return function audit(req, action, { userId, target, details } = {}) {
    try {
      const uid = userId ?? (req.session && req.session.userId) ?? null;
      insert.run(uid, req.ip || null, action, target == null ? null : String(target),
        details == null ? null : JSON.stringify(details));
    } catch (err) {
      // Auditing must never break the request itself.
      console.error('[audit] failed to write event', action, err.message);
    }
  };
}

module.exports = { createAudit };
