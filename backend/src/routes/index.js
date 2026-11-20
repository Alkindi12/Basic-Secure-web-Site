'use strict';
/**
 * All API routes in one place, so the protection on each route is easy to review.
 * Legend: [auth] logged in, [role] role check, [rl] rate limited, [up] image upload.
 * CSRF protection is applied globally in app.js to every POST/PUT/PATCH/DELETE.
 */
const express = require('express');
const csrf = require('../security/csrf');
const { rateLimit } = require('../security/rateLimit');
const upload = require('../middleware/upload');

module.exports = function buildRoutes(ctx) {
  const { requireAuth, requireRole } = ctx.auth;
  const authC = require('../controllers/authController')(ctx);
  const userC = require('../controllers/userController')(ctx);
  const tripC = require('../controllers/tripController')(ctx);
  const bookC = require('../controllers/bookingController')(ctx);
  const adminC = require('../controllers/adminController')(ctx);

  const L = ctx.limiters = {
    // 10 attempts per 15 min for one email from one IP, plus 50 per IP overall (S-04).
    loginPair: rateLimit({ windowMs: 15 * 60e3, max: 10,
      key: (req) => `${req.ip}|${String((req.body && req.body.email) || '').toLowerCase()}` }),
    loginIp: rateLimit({ windowMs: 15 * 60e3, max: 50 }),
    register: rateLimit({ windowMs: 60 * 60e3, max: 10, message: 'Too many accounts created from this network. Try again later.' }),
    profile: rateLimit({ windowMs: 15 * 60e3, max: 10, key: (req) => `u${req.session.userId}` }),
    upload: rateLimit({ windowMs: 60 * 60e3, max: 30, key: (req) => `u${req.session.userId}` }),
    booking: rateLimit({ windowMs: 60e3, max: 20, key: (req) => `u${req.session.userId}` }),
  };

  const r = express.Router();
  const manager = [requireAuth, requireRole('manager', 'admin')];
  const admin = [requireAuth, requireRole('admin')];

  // ---- auth
  r.get('/auth/csrf', csrf.issue);
  r.post('/auth/register', L.register, authC.register);
  r.post('/auth/login', L.loginIp, L.loginPair, authC.login);
  r.post('/auth/logout', authC.logout);
  r.get('/auth/me', authC.me);

  // ---- current user
  r.get('/users/profile', requireAuth, userC.getProfile);
  r.put('/users/profile', requireAuth, L.profile, userC.updateProfile);
  r.get('/users/bookings', requireAuth, userC.getBookings);
  r.post('/users/request-manager', requireAuth, userC.requestManager);
  r.post('/users/cancel-manager-request', requireAuth, userC.cancelManagerRequest);

  // ---- trips (public read, manager write)
  r.get('/trips', tripC.list);
  r.get('/trips/my-trips', ...manager, tripC.mine);
  r.post('/trips', ...manager, L.upload, upload.single('image'), tripC.create);
  r.put('/trips/:id', ...manager, L.upload, upload.single('image'), tripC.update);
  r.delete('/trips/:id', ...manager, tripC.remove);
  r.get('/trips/:id', tripC.getById);

  // ---- bookings
  r.post('/bookings', requireAuth, L.booking, bookC.create);
  r.get('/bookings/my-bookings', requireAuth, bookC.mine);
  r.delete('/bookings/:id', requireAuth, bookC.cancel);
  r.get('/bookings/trip/:tripId', ...manager, bookC.forTrip);

  // ---- admin
  r.get('/admin/users', ...admin, adminC.users);
  r.get('/admin/manager-requests', ...admin, adminC.managerRequests);
  r.post('/admin/manager-requests/:userId/approve', ...admin, adminC.approve);
  r.post('/admin/manager-requests/:userId/reject', ...admin, adminC.reject);
  r.put('/admin/users/:userId/role', ...admin, adminC.changeRole);
  r.get('/admin/audit-log', ...admin, adminC.auditLog);

  // ---- images: strict name check, safe headers, no directory listing (S-03)
  r.get('/images/:name', (req, res) => {
    const file = ctx.images.pathFor(req.params.name);
    if (!file) return res.status(404).json({ error: 'Not found' });
    res.set({
      'Content-Type': 'image/webp',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    res.sendFile(file, (err) => { if (err && !res.headersSent) res.status(404).json({ error: 'Not found' }); });
  });

  r.get('/health', (req, res) => res.json({ status: 'ok' }));
  return r;
};
