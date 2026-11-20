'use strict';
// Business logic, authorization, validation and the image upload pipeline.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { startServer } = require('./helpers');

let s, manager, manager2, admin, user, M, M2, A, U;
before(async () => {
  s = await startServer();
  manager = await s.createUser({ email: 'm1@test.io', role: 'manager' });
  manager2 = await s.createUser({ email: 'm2@test.io', role: 'manager' });
  admin = await s.createUser({ email: 'admin@test.io', role: 'admin' });
  user = await s.createUser({ email: 'u1@test.io' });
  M = s.client(); await M.login(manager.email, manager.password);
  M2 = s.client(); await M2.login(manager2.email, manager2.password);
  A = s.client(); await A.login(admin.email, admin.password);
  U = s.client(); await U.login(user.email, user.password);
});
after(async () => { await s.close(); });
beforeEach(() => s.resetLimits());

const jpegWithExif = () => sharp({ create: { width: 64, height: 48, channels: 3, background: '#2a78d6' } })
  .jpeg().withExif({ IFD0: { Copyright: 'private-owner', Artist: 'GPS 23.58N 58.38E' } }).toBuffer();

function tripForm(fields, file) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, String(v));
  if (file) fd.append('image', new Blob([file.buffer], { type: file.type }), file.name);
  return fd;
}
const future = (d = 20) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const validTrip = { name: 'Daymaniyat Snorkel', location: 'Seeb', date_available: future(), entry_fee: '35.5', max_people: '8' };

test('S-03: a disguised HTML file is rejected and nothing is written to disk', async () => {
  const html = Buffer.from('<html><script>alert(document.cookie)</script></html>');
  const before = fs.readdirSync(s.config.STORAGE_DIR).length;
  for (const [name, type] of [['photo.png', 'image/png'], ['shell.phpjpg', 'image/jpeg'], ['page.pngx', 'text/html;png']]) {
    const r = await M.raw('POST', '/trips', { form: tripForm(validTrip, { buffer: html, type, name }) });
    assert.equal(r.status, 400, name);
    assert.match(r.json.error, /Only JPEG, PNG or WebP/);
  }
  assert.equal(fs.readdirSync(s.config.STORAGE_DIR).length, before);
});

test('S-03: a real JPEG is re-encoded to WebP, renamed by the server, EXIF removed', async () => {
  const jpg = await jpegWithExif();
  assert.ok((await sharp(jpg).metadata()).exif, 'input has EXIF');
  const r = await M.raw('POST', '/trips', { form: tripForm(validTrip, { buffer: jpg, type: 'image/jpeg', name: '../../evil name.jpg' }) });
  assert.equal(r.status, 201, r.text);
  const url = r.json.trip.image_url;
  assert.match(url, /^\/api\/images\/[0-9a-f-]{36}\.webp$/);
  const file = path.join(s.config.STORAGE_DIR, path.basename(url));
  const meta = await sharp(fs.readFileSync(file)).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.exif, undefined, 'EXIF stripped');

  const img = await fetch(s.base.replace(/\/api$/, '') + url);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/webp');
  assert.equal(img.headers.get('x-content-type-options'), 'nosniff');
  assert.match(img.headers.get('content-security-policy'), /sandbox/);
});

test('S-03: the image route only serves generated names (no path traversal)', async () => {
  for (const bad of ['..%2F..%2F.env', '..%2Fdata%2Ftest.sqlite', 'not-a-uuid.webp', 'x.png']) {
    const r = await fetch(`${s.base}/images/${bad}`);
    assert.equal(r.status, 404, bad);
  }
});

test('S-03: uploads over 5 MB are rejected with 413', async () => {
  const big = Buffer.alloc(5 * 1024 * 1024 + 10, 0xff);
  const r = await M.raw('POST', '/trips', { form: tripForm(validTrip, { buffer: big, type: 'image/jpeg', name: 'big.jpg' }) });
  assert.equal(r.status, 413);
});

test('S-08: public trip data has no internal fields or server paths', async () => {
  const r = await U.get('/trips');
  assert.equal(r.status, 200);
  assert.ok(r.json.trips.length > 0);
  const json = JSON.stringify(r.json);
  for (const leak of ['image_path', 'image_name', 'manager_id', 'storage', s.dir]) assert.ok(!json.includes(leak), leak);
});

test('S-09: invalid trip input gets field-level errors', async () => {
  const jpg = await jpegWithExif();
  const bad = { name: 'X', location: '', date_available: '2020-01-01', entry_fee: '-5', max_people: '1.5' };
  const r = await M.raw('POST', '/trips', { form: tripForm(bad, { buffer: jpg, type: 'image/jpeg', name: 'a.jpg' }) });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.json.details).sort(), ['date_available', 'entry_fee', 'location', 'max_people', 'name']);
});

test('Authorization: users cannot create trips; managers cannot touch other managers\' trips', async () => {
  const jpg = await jpegWithExif();
  assert.equal((await U.raw('POST', '/trips', { form: tripForm(validTrip, { buffer: jpg, type: 'image/jpeg', name: 'a.jpg' }) })).status, 403);
  const tripId = s.createTrip({ managerId: manager.id });
  assert.equal((await M2.put(`/trips/${tripId}`, { name: 'Hijacked' })).status, 404);
  assert.equal((await M2.del(`/trips/${tripId}`)).status, 404);
  assert.equal((await M2.get(`/bookings/trip/${tripId}`)).status, 404);
});

test('S-19: admins can manage any trip', async () => {
  const tripId = s.createTrip({ managerId: manager.id, name: 'Admin Editable' });
  const r = await A.put(`/trips/${tripId}`, { name: 'Edited By Admin' });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.trip.name, 'Edited By Admin');
  assert.ok((await A.get('/trips/my-trips')).json.trips.some((t) => t.id === tripId));
});

test('S-09: booking input must be a whole number from 1 to 50', async () => {
  const tripId = s.createTrip({ managerId: manager.id, max: 100 });
  for (const n of ['abc', 1.5, 0, -1, 999, '2; DROP TABLE trips']) {
    const r = await U.post('/bookings', { trip_id: tripId, booking_name: 'Valid Name', number_of_people: n });
    assert.equal(r.status, 400, String(n));
  }
});

test('S-02: 10 parallel bookings for the last 3 seats → exactly one succeeds', async () => {
  const tripId = s.createTrip({ managerId: manager.id, max: 3 });
  const clients = [];
  for (let i = 0; i < 10; i++) {
    const u = await s.createUser({ email: `race${i}@test.io` });
    const c = s.client(); await c.login(u.email, u.password); await c.fetchCsrf();
    clients.push(c);
  }
  const results = await Promise.all(clients.map((c) =>
    c.post('/bookings', { trip_id: tripId, booking_name: 'Racer Name', number_of_people: 3 })));
  const codes = results.map((r) => r.status).sort();
  assert.deepEqual(codes, [201, 409, 409, 409, 409, 409, 409, 409, 409, 409]);
  const trip = s.db.prepare('SELECT current_available FROM trips WHERE id = ?').get(tripId);
  assert.equal(trip.current_available, 0);
  const seats = s.db.prepare("SELECT SUM(number_of_people) AS n FROM bookings WHERE trip_id = ? AND status = 'confirmed'").get(tripId).n;
  assert.equal(seats, 3);
});

test('U-04: past trips cannot be booked and are hidden from the public list', async () => {
  const past = s.createTrip({ managerId: manager.id, date: '2024-01-01', name: 'Old Trip' });
  const r = await U.post('/bookings', { trip_id: past, booking_name: 'Too Late', number_of_people: 1 });
  assert.equal(r.status, 400);
  assert.ok(!(await U.get('/trips?limit=50')).json.trips.some((t) => t.id === past));
});

test('U-05: cancelling keeps history and returns the seats; others cannot cancel it', async () => {
  const tripId = s.createTrip({ managerId: manager.id, max: 5 });
  const b = await U.post('/bookings', { trip_id: tripId, booking_name: 'History Keeper', number_of_people: 2 });
  assert.equal(b.status, 201);
  const other = await s.createUser({ email: 'other@test.io' });
  const O = s.client(); await O.login(other.email, other.password);
  assert.equal((await O.del(`/bookings/${b.json.booking.id}`)).status, 404, 'IDOR blocked');
  const c = await U.del(`/bookings/${b.json.booking.id}`);
  assert.equal(c.status, 200);
  assert.equal(c.json.booking.status, 'cancelled');
  assert.equal(s.db.prepare('SELECT current_available FROM trips WHERE id = ?').get(tripId).current_available, 5);
  assert.equal((await U.del(`/bookings/${b.json.booking.id}`)).status, 400, 'cannot cancel twice');
  const mine = (await U.get('/users/bookings')).json.bookings;
  assert.ok(mine.some((x) => x.id === b.json.booking.id && x.status === 'cancelled'));
});

test('S-09: max_people cannot go below seats already booked', async () => {
  const tripId = s.createTrip({ managerId: manager.id, max: 10 });
  await U.post('/bookings', { trip_id: tripId, booking_name: 'Seat Holder', number_of_people: 4 });
  const r = await M.put(`/trips/${tripId}`, { max_people: 3 });
  assert.equal(r.status, 400);
  const ok = await M.put(`/trips/${tripId}`, { max_people: 6 });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.trip.current_available, 2);
});

test('S-16: deleting a trip with bookings cancels it instead, keeping history', async () => {
  const tripId = s.createTrip({ managerId: manager.id, max: 10 });
  await U.post('/bookings', { trip_id: tripId, booking_name: 'Kept Booking', number_of_people: 1 });
  const r = await M.del(`/trips/${tripId}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.deleted, false);
  assert.equal(s.db.prepare('SELECT status FROM trips WHERE id = ?').get(tripId).status, 'cancelled');
  assert.equal(s.db.prepare('SELECT status FROM bookings WHERE trip_id = ?').get(tripId).status, 'cancelled');
  // a trip without bookings is really deleted
  const empty = s.createTrip({ managerId: manager.id });
  assert.equal((await M.del(`/trips/${empty}`)).json.deleted, true);
  assert.equal(s.db.prepare('SELECT id FROM trips WHERE id = ?').get(empty), undefined);
});

test('S-16: the database enforces foreign keys and seat constraints', () => {
  assert.throws(() => s.db.prepare('INSERT INTO bookings (user_id, trip_id, booking_name, number_of_people) VALUES (9999, 9999, \'Ghost\', 1)').run(),
    /FOREIGN KEY/);
  const tripId = s.createTrip({ managerId: manager.id, max: 2 });
  assert.throws(() => s.db.prepare('UPDATE trips SET current_available = -1 WHERE id = ?').run(tripId), /CHECK/);
});

test('Pagination: limit is capped at 50 and totals are returned', async () => {
  const r = await U.get('/trips?limit=1000&page=1');
  assert.equal(r.json.limit, 12, 'invalid limit falls back to default');
  const r2 = await U.get('/trips?limit=2&page=1');
  assert.equal(r2.json.trips.length, 2);
  assert.ok(r2.json.total >= 2);
});
