'use strict';
const validate = require('../validators');
const { HttpError } = require('../utils/httpError');
const { toPublicUser } = require('../views');

module.exports = function adminController({ db, audit }) {
  const q = {
    users: db.prepare('SELECT * FROM users ORDER BY created_at DESC, id DESC'),
    requests: db.prepare("SELECT * FROM users WHERE manager_request_status = 'pending' ORDER BY created_at DESC"),
    byId: db.prepare('SELECT * FROM users WHERE id = ?'),
    approve: db.prepare("UPDATE users SET role = 'manager', manager_request_status = 'approved' WHERE id = ?"),
    reject: db.prepare("UPDATE users SET manager_request_status = 'rejected' WHERE id = ?"),
    setRole: db.prepare('UPDATE users SET role = ?, manager_request_status = CASE WHEN ? = \'user\' THEN NULL ELSE manager_request_status END WHERE id = ?'),
    audit: db.prepare(`SELECT a.id, a.at, a.action, a.target, a.ip, a.details, u.email AS user_email
                       FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
                       ORDER BY a.id DESC LIMIT ?`),
  };

  const users = (req, res) => res.json({ users: q.users.all().map(toPublicUser) });
  const managerRequests = (req, res) => res.json({ requests: q.requests.all().map(toPublicUser) });

  function pendingUser(req) {
    const user = q.byId.get(validate.idParam(req.params.userId));
    if (!user) throw new HttpError(404, 'User not found');
    if (user.manager_request_status !== 'pending') throw new HttpError(400, 'This user has no pending manager request');
    return user;
  }

  function approve(req, res) {
    const user = pendingUser(req);
    q.approve.run(user.id);
    audit(req, 'manager_request_approved', { target: `user:${user.id}` });
    res.json({ message: 'Manager request approved' });
  }

  function reject(req, res) {
    const user = pendingUser(req);
    q.reject.run(user.id);
    audit(req, 'manager_request_rejected', { target: `user:${user.id}` });
    res.json({ message: 'Manager request rejected' });
  }

  function changeRole(req, res) {
    const { role } = validate.role(req.body || {});
    const user = q.byId.get(validate.idParam(req.params.userId));
    if (!user) throw new HttpError(404, 'User not found');
    if (user.id === req.user.id) throw new HttpError(400, 'You cannot change your own role');
    if (user.role === 'admin' && role !== 'admin') throw new HttpError(400, 'An admin cannot be demoted from the dashboard');
    q.setRole.run(role, role, user.id);
    audit(req, 'role_changed', { target: `user:${user.id}`, details: { from: user.role, to: role } });
    res.json({ message: `Role changed to ${role}`, user: toPublicUser(q.byId.get(user.id)) });
  }

  function auditLog(req, res) {
    const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const events = q.audit.all(limit).map((e) => ({ ...e, details: e.details ? JSON.parse(e.details) : null }));
    res.json({ events });
  }

  return { users, managerRequests, approve, reject, changeRole, auditLog };
};
