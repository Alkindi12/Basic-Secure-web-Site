'use strict';
/**
 * Builds the Express application. Kept separate from server.js so tests can
 * create a fresh app (with its own database) without opening a network port.
 *
 * Every request passes through the layers in this order (defence in depth):
 *   request ID → security headers → CORS allow-list → body limits → session
 *   → CSRF check → routes (rate limit → auth → role → validation → service)
 *   → central error handler
 */
const express = require('express');
const session = require('express-session');
const cors = require('cors');

const { openDatabase } = require('./db/connection');
const securityHeaders = require('./security/headers');
const csrf = require('./security/csrf');
const { SqliteSessionStore } = require('./security/sessionStore');
const { createAudit } = require('./security/audit');
const { setCost } = require('./security/password');
const { createAuth } = require('./middleware/auth');
const { requestId, notFound, errorHandler } = require('./middleware/errorHandler');
const { createImageService } = require('./services/imageService');
const buildRoutes = require('./routes');

function createApp(cfg, { db } = {}) {
  const config = { ...cfg, COOKIE_NAME: 'tourly.sid' };
  db = db || openDatabase(config.DB_PATH);
  setCost(config.BCRYPT_COST);

  const app = express();
  app.disable('x-powered-by');
  if (config.TRUST_PROXY) app.set('trust proxy', config.TRUST_PROXY); // needed for secure cookies behind a proxy

  app.use(requestId);
  app.use(securityHeaders({ isProd: config.isProd }));

  // Only origins listed in CORS_ORIGINS may call the API with cookies (S-07).
  // Unknown origins simply get no CORS headers, so the browser blocks them.
  app.use(cors({
    origin: (origin, cb) => cb(null, !origin ? false : config.CORS_ORIGINS.includes(origin)),
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  }));

  app.use(express.json({ limit: '100kb' }));

  const store = new SqliteSessionStore(db);
  app.use(session({
    name: config.COOKIE_NAME,                 // not the default "connect.sid" (fingerprinting)
    secret: config.SESSION_SECRET,
    store,
    resave: false,
    saveUninitialized: false,                 // no session until there is something to store
    rolling: true,                            // idle timeout restarts on every request
    cookie: {
      httpOnly: true,                         // JavaScript cannot read the cookie
      sameSite: 'strict',                     // not sent on cross-site requests (S-07)
      secure: config.isProd,                  // HTTPS only in production (S-12)
      maxAge: config.SESSION_IDLE_MINUTES * 60 * 1000,
    },
  }));

  app.use('/api', csrf.guard);

  const ctx = {
    db, config,
    audit: createAudit(db),
    auth: createAuth(db, config),
    images: createImageService(config.STORAGE_DIR),
  };
  app.use('/api', buildRoutes(ctx));
  app.use(notFound);
  app.use(errorHandler);

  app.locals.ctx = ctx;
  app.locals.close = () => { store.close(); db.close(); };
  return app;
}

module.exports = { createApp };
