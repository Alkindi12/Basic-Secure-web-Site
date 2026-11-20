'use strict';
/**
 * Test helpers: a fresh app + database per test file, and a tiny HTTP client
 * that keeps cookies and the CSRF token like a browser would.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { loadConfig } = require('../src/config/env');
const { createApp } = require('../src/app');
const { hashPassword } = require('../src/security/password');

async function startServer(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tourly-test-'));
  const config = loadConfig({
    NODE_ENV: 'test',
    SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
    DB_PATH: path.join(dir, 'test.sqlite'),
    STORAGE_DIR: path.join(dir, 'storage'),
    CORS_ORIGINS: 'http://localhost:5173',
    BCRYPT_COST: '10',
    DEMO_MODE: 'false',
    ...overrides,
  });
  const app = createApp(config);
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const { db } = app.locals.ctx;

  return {
    app, db, base, dir, config,
    client: () => new Client(base),
    resetLimits: () => Object.values(app.locals.ctx.limiters).forEach((l) => l.reset()),
    async createUser({ email, password = 'Correct-Horse-9', name = 'Test User', role = 'user' }) {
      const r = db.prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)')
        .run(email, await hashPassword(password), name, role);
      return { id: Number(r.lastInsertRowid), email, password };
    },
    createTrip({ managerId, max = 10, days = 10, date, name = 'Test Trip' }) {
      const d = date || new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      const r = db.prepare(`INSERT INTO trips (name, image_name, date_available, location, entry_fee, max_people, current_available, manager_id)
                            VALUES (?, ?, ?, 'Muscat', 20, ?, ?, ?)`)
        .run(name, `${crypto.randomUUID()}.webp`, d, max, max, managerId);
      return Number(r.lastInsertRowid);
    },
    async close() {
      await new Promise((r) => server.close(r));
      app.locals.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

class Client {
  constructor(base) { this.base = base; this.cookies = new Map(); this.csrf = null; }

  cookieHeader() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '); }

  get sessionId() { return this.cookies.get('tourly.sid'); }

  async raw(method, url, { body, headers = {}, form, csrf = true } = {}) {
    const h = { ...headers };
    if (this.cookies.size) h.Cookie = this.cookieHeader();
    if (csrf && !['GET', 'HEAD'].includes(method)) {
      if (!this.csrf) await this.fetchCsrf();
      h['X-CSRF-Token'] = this.csrf;
      h.Cookie = this.cookieHeader();
    }
    let payload;
    if (form) payload = form;
    else if (body !== undefined) { payload = typeof body === 'string' ? body : JSON.stringify(body); h['Content-Type'] = h['Content-Type'] || 'application/json'; }
    const res = await fetch(this.base + url, { method, headers: h, body: payload, redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      const k = pair.slice(0, i); const v = pair.slice(i + 1);
      if (/Expires=Thu, 01 Jan 1970/.test(c) || v === '') this.cookies.delete(k); else this.cookies.set(k, v);
    }
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
    if (json && json.csrfToken) this.csrf = json.csrfToken;
    return { status: res.status, headers: res.headers, json, text };
  }

  async fetchCsrf() {
    const r = await this.raw('GET', '/auth/csrf');
    this.csrf = r.json.csrfToken;
    return this.csrf;
  }

  get(url, o) { return this.raw('GET', url, o); }
  post(url, body, o = {}) { return this.raw('POST', url, { ...o, body }); }
  put(url, body, o = {}) { return this.raw('PUT', url, { ...o, body }); }
  del(url, o) { return this.raw('DELETE', url, o); }

  async login(email, password) {
    const r = await this.post('/auth/login', { email, password });
    if (r.status !== 200) throw new Error(`login failed: ${r.status} ${r.text}`);
    return r;
  }
}

module.exports = { startServer };
