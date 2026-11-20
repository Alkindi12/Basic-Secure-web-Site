'use strict';
/**
 * Loads and validates configuration once, at start-up.
 * Fail fast: a missing or weak secret stops the server instead of
 * silently falling back to a value everyone knows (finding S-01).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const bool = (v, def = false) => (v === undefined || v === '' ? def : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));
const int = (v, def) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? def : Number(v));

function loadConfig(overrides = {}) {
  const env = { ...process.env, ...overrides };
  const NODE_ENV = env.NODE_ENV || 'development';
  const isProd = NODE_ENV === 'production';

  const config = {
    NODE_ENV,
    isProd,
    isTest: NODE_ENV === 'test',
    PORT: int(env.PORT, 5000),
    // Loopback by default so the API is not reachable from the network.
    HOST: env.HOST || '127.0.0.1',
    SESSION_SECRET: env.SESSION_SECRET,
    DB_PATH: env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'tourly.sqlite'),
    STORAGE_DIR: env.STORAGE_DIR || path.join(__dirname, '..', '..', 'storage', 'trips'),
    CORS_ORIGINS: String(env.CORS_ORIGINS || 'http://localhost:5173')
      .split(',').map((s) => s.trim()).filter(Boolean),
    TRUST_PROXY: int(env.TRUST_PROXY, 0),
    SESSION_IDLE_MINUTES: int(env.SESSION_IDLE_MINUTES, 30),
    SESSION_ABSOLUTE_HOURS: int(env.SESSION_ABSOLUTE_HOURS, 8),
    BCRYPT_COST: int(env.BCRYPT_COST, 12),
    DEMO_MODE: bool(env.DEMO_MODE, false),
  };

  const problems = [];
  const s = config.SESSION_SECRET;
  if (!s) problems.push('SESSION_SECRET is missing');
  else if (s.length < 32) problems.push('SESSION_SECRET must be at least 32 characters');
  else if (/change|secret-key|example|your-/i.test(s)) problems.push('SESSION_SECRET still looks like a placeholder');
  if (config.DEMO_MODE && isProd) problems.push('DEMO_MODE=true is not allowed when NODE_ENV=production');
  if (config.BCRYPT_COST < 10 || config.BCRYPT_COST > 15) problems.push('BCRYPT_COST must be between 10 and 15');

  if (problems.length) {
    const err = new Error('Invalid configuration:\n  - ' + problems.join('\n  - ') +
      '\nGenerate a secret with:\n  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
    err.code = 'CONFIG_INVALID';
    throw err;
  }
  return Object.freeze(config);
}

module.exports = { loadConfig };
