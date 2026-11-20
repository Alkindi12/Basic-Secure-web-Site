'use strict';
const validate = require('../validators');
const { HttpError } = require('../utils/httpError');
const { checkPasswordPolicy, hashPassword, verifyPassword } = require('../security/password');
const { toPublicUser, toBooking } = require('../views');
const { startSession } = require('./authController');

module.exports = function userController({ db, audit }) {
  const q = {
    byId: db.prepare('SELECT * FROM users WHERE id = ?'),
    emailTaken: db.prepare('SELECT id FROM users WHERE email = ? AND id != ?'),
    setRequest: db.prepare('UPDATE users SET manager_request_status = ? WHERE id = ?'),
    bookings: db.prepare(`
      SELECT b.*, t.name AS trip_name, t.location, t.entry_fee, t.date_available,
             t.image_name, t.status AS trip_status
      FROM bookings b JOIN trips t ON t.id = b.trip_id
      WHERE b.user_id = ? ORDER BY b.created_at DESC, b.id DESC`),
  };

  function getBookings(req, res) {
    res.json({ bookings: q.bookings.all(req.user.id).map(toBooking) });
  }

  function getProfile(req, res) {
    res.json({ user: toPublicUser(q.byId.get(req.user.id)) });
  }

  function requestManager(req, res) {
    if (req.user.role !== 'user') throw new HttpError(400, 'You are already a manager or admin');
    if (req.user.manager_request_status === 'pending') throw new HttpError(400, 'Your request is already pending');
    q.setRequest.run('pending', req.user.id);
    audit(req, 'manager_requested', { target: `user:${req.user.id}` });
    res.json({ message: 'Manager request submitted' });
  }

  function cancelManagerRequest(req, res) {
    if (req.user.manager_request_status !== 'pending') throw new HttpError(400, 'No pending manager request to cancel');
    q.setRequest.run(null, req.user.id);
    audit(req, 'manager_request_cancelled', { target: `user:${req.user.id}` });
    res.json({ message: 'Manager request cancelled' });
  }

  /**
   * Name: can change freely.
   * Email or password: needs the current password (re-authentication, finding S-10).
   * Password change: bumps auth_version, so every OTHER session is logged out at once;
   * this browser gets a fresh session and stays logged in.
   */
  async function updateProfile(req, res) {
    const input = validate.profile(req.body || {});
    const user = q.byId.get(req.user.id);
    const sets = [];
    const params = [];
    const events = [];

    const emailChanging = input.email !== undefined && input.email !== user.email;
    const passwordChanging = input.newPassword !== undefined;

    if (emailChanging || passwordChanging) {
      if (!input.currentPassword) {
        throw new HttpError(400, 'Enter your current password to change your email or password',
          { currentPassword: 'Current password is required' });
      }
      if (!(await verifyPassword(input.currentPassword, user.password))) {
        audit(req, 'reauth_failed', { target: `user:${user.id}` });
        throw new HttpError(400, 'Current password is incorrect', { currentPassword: 'Current password is incorrect' });
      }
    }

    if (input.name !== undefined && input.name !== user.name) { sets.push('name = ?'); params.push(input.name); }

    if (emailChanging) {
      if (q.emailTaken.get(input.email, user.id)) throw new HttpError(409, 'This email is already in use', { email: 'This email is already in use' });
      sets.push('email = ?'); params.push(input.email);
      events.push(['email_changed', { from: user.email, to: input.email }]);
    }

    if (passwordChanging) {
      const policy = checkPasswordPolicy(input.newPassword, { email: input.email || user.email });
      if (policy) throw new HttpError(400, policy, { newPassword: policy });
      if (await verifyPassword(input.newPassword, user.password)) {
        throw new HttpError(400, 'The new password must be different', { newPassword: 'The new password must be different' });
      }
      sets.push('password = ?', 'auth_version = auth_version + 1'); params.push(await hashPassword(input.newPassword));
      events.push(['password_changed', null]);
    }

    if (!sets.length) throw new HttpError(400, 'Nothing to update');

    // Column names come only from the fixed strings above; values are parameters.
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params, user.id);
    const updated = q.byId.get(user.id);
    for (const [action, details] of events) audit(req, action, { target: `user:${user.id}`, details });

    let csrfToken;
    if (passwordChanging) csrfToken = await startSession(req, updated);
    res.json({ message: 'Profile updated', user: toPublicUser(updated), ...(csrfToken ? { csrfToken } : {}) });
  }

  return { getBookings, getProfile, requestManager, cancelManagerRequest, updateProfile };
};
