'use strict';
// Authentication, sessions, CSRF, CORS and headers.
// Each test names the finding from the security review that it proves fixed.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');
const { loadConfig } = require('../src/config/env');

let s;
before(async () => { s = await startServer(); });
after(async () => { await s.close(); });
beforeEach(() => s.resetLimits());

test('S-01: the server refuses to start without a strong SESSION_SECRET', () => {
  assert.throws(() => loadConfig({ SESSION_SECRET: '' }), /SESSION_SECRET is missing/);
  assert.throws(() => loadConfig({ SESSION_SECRET: 'short' }), /at least 32/);
  assert.throws(() => loadConfig({ SESSION_SECRET: 'your-secret-key-change-in-production-xxxxxxxx' }), /placeholder/);
});

test('S-18: DEMO_MODE is refused in production', () => {
  assert.throws(() => loadConfig({ SESSION_SECRET: 'a'.repeat(20) + 'b'.repeat(20), DEMO_MODE: 'true', NODE_ENV: 'production' }),
    /DEMO_MODE=true is not allowed/);
});

test('S-11: every response carries security headers and no X-Powered-By', async () => {
  const r = await s.client().get('/health');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(r.headers.get('x-powered-by'), null);
  assert.ok(r.headers.get('x-request-id'));
});

test('S-07: state-changing requests without a CSRF token are rejected', async () => {
  const c = s.client();
  const r = await c.post('/auth/login', { email: 'a@b.co', password: 'x' }, { csrf: false });
  assert.equal(r.status, 403);
  assert.equal(r.json.code, 'CSRF');
  const wrong = await c.raw('POST', '/auth/logout', { csrf: false, headers: { 'X-CSRF-Token': 'f'.repeat(64) } });
  assert.equal(wrong.status, 403);
});

test('S-07: CORS only answers allow-listed origins', async () => {
  const good = await fetch(`${s.base}/health`, { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(good.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const evil = await fetch(`${s.base}/health`, { headers: { Origin: 'http://localhost:3000' } });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
});

test('S-06 + S-12: login issues a NEW session ID with HttpOnly + SameSite=Strict', async () => {
  const u = await s.createUser({ email: 'fixation@test.io' });
  const c = s.client();
  await c.fetchCsrf();                     // creates an anonymous session
  const before = c.sessionId;
  assert.ok(before, 'anonymous session exists');
  const r = await c.login(u.email, u.password);
  assert.notEqual(c.sessionId, before, 'session ID must change at login');
  const cookie = r.headers.getSetCookie().find((h) => h.startsWith('tourly.sid='));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  // The old (pre-login) session ID is not logged in.
  const attacker = s.client(); attacker.cookies.set('tourly.sid', before);
  assert.equal((await attacker.get('/users/profile')).status, 401);
});

test('S-14: unknown email and wrong password give the same answer', async () => {
  const u = await s.createUser({ email: 'enum@test.io' });
  const c = s.client();
  const a = await c.post('/auth/login', { email: 'nobody@test.io', password: 'Whatever-123' });
  const b = await c.post('/auth/login', { email: u.email, password: 'Wrong-Password-1' });
  assert.equal(a.status, 401); assert.equal(b.status, 401);
  assert.equal(a.json.error, b.json.error);
});

test('S-04: account locks after 5 wrong passwords, even for the right password', async () => {
  const u = await s.createUser({ email: 'lock@test.io' });
  const c = s.client();
  for (let i = 0; i < 5; i++) assert.equal((await c.post('/auth/login', { email: u.email, password: 'nope-nope-1' })).status, 401);
  const r = await c.post('/auth/login', { email: u.email, password: u.password });
  assert.equal(r.status, 429);
  assert.match(r.json.error, /Try again in/);
});

test('S-04: one IP + email pair is rate-limited after 10 attempts', async () => {
  const c = s.client();
  let last;
  for (let i = 0; i < 11; i++) last = await c.post('/auth/login', { email: 'ghost@test.io', password: 'nope-nope-1' });
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get('retry-after')) > 0);
});

test('S-13: password policy rejects common, short and over-long passwords', async () => {
  const c = s.client();
  for (const [pw, re] of [['password123', /too common/], ['short1', /at least 8/], ['x'.repeat(65), /at most 64/],
    ['policy@test.io', /must not be your email/]]) {
    const r = await c.post('/auth/register', { name: 'Pol Icy', email: 'policy@test.io', password: pw });
    assert.equal(r.status, 400, pw);
    assert.match(r.json.error, re);
  }
  const ok = await c.post('/auth/register', { name: 'Pol Icy', email: 'policy@test.io', password: 'Sand-Dunes-Muscat-7' });
  assert.equal(ok.status, 201);
  assert.equal(ok.json.user.password, undefined, 'hash never returned');
});

test('S-10: email change needs the current password', async () => {
  const u = await s.createUser({ email: 'reauth@test.io' });
  const c = s.client(); await c.login(u.email, u.password);
  const noPw = await c.put('/users/profile', { email: 'stolen@test.io' });
  assert.equal(noPw.status, 400);
  const badPw = await c.put('/users/profile', { email: 'stolen@test.io', currentPassword: 'guess-guess-1' });
  assert.equal(badPw.status, 400);
  const ok = await c.put('/users/profile', { email: 'new-reauth@test.io', currentPassword: u.password });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.user.email, 'new-reauth@test.io');
});

test('S-10: changing the password logs out every other session', async () => {
  const u = await s.createUser({ email: 'revoke@test.io' });
  const laptop = s.client(); await laptop.login(u.email, u.password);
  const thief = s.client(); await thief.login(u.email, u.password);
  const r = await laptop.put('/users/profile', { currentPassword: u.password, newPassword: 'Brand-New-Secret-42' });
  assert.equal(r.status, 200);
  assert.equal((await thief.get('/users/profile')).status, 401, 'other session revoked');
  assert.equal((await laptop.get('/users/profile')).status, 200, 'this browser stays logged in');
});

test('S-12: sessions have an absolute lifetime', async () => {
  const short = await startServer({ SESSION_ABSOLUTE_HOURS: String(1.5 / 3600) }); // 1.5 seconds
  try {
    const u = await short.createUser({ email: 'abs@test.io' });
    const c = short.client(); await c.login(u.email, u.password);
    assert.equal((await c.get('/users/profile')).status, 200);
    await new Promise((r) => setTimeout(r, 1700));
    const r = await c.get('/users/profile');
    assert.equal(r.status, 401);
    assert.equal(r.json.code, 'SESSION_EXPIRED');
  } finally { await short.close(); }
});

test('S-15: errors are generic; malformed JSON gives a clean 400', async () => {
  const c = s.client();
  const r = await c.raw('POST', '/auth/login', { body: '{"email": broken' });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, 'Malformed JSON body');
  assert.equal((await c.get('/does-not-exist')).status, 404);
});

test('S-17: security events are audited and only admins can read them', async () => {
  const admin = await s.createUser({ email: 'audit-admin@test.io', role: 'admin' });
  const user = await s.createUser({ email: 'audit-user@test.io' });
  const u = s.client(); await u.login(user.email, user.password);
  assert.equal((await u.get('/admin/audit-log')).status, 403);
  const a = s.client(); await a.login(admin.email, admin.password);
  const r = await a.get('/admin/audit-log?limit=200');
  assert.equal(r.status, 200);
  const actions = r.json.events.map((e) => e.action);
  assert.ok(actions.includes('login_success'));
  assert.ok(actions.includes('login_failed'));
  assert.ok(actions.includes('account_locked'));
  assert.ok(!JSON.stringify(r.json).includes('Correct-Horse-9'), 'no passwords in the log');
});
