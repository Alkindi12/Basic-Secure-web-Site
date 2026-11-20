'use strict';
/**
 * Demo data for learners (finding S-18, report section 7).
 *
 *   npm run seed
 *
 * Only runs when DEMO_MODE=true, and loadConfig() refuses DEMO_MODE in production.
 * Creates three demo accounts (one per role), sample trips with generated images,
 * and a sample booking, so every dashboard has something to show on first launch.
 */
const sharp = require('sharp');
const { loadConfig } = require('../config/env');
const { openDatabase } = require('./connection');
const { createImageService } = require('../services/imageService');
const { hashPassword, setCost, checkPasswordPolicy } = require('../security/password');

const DEMO_USERS = [
  { email: 'admin@tourly.demo', name: 'Demo Admin', role: 'admin', password: 'Demo-Admin-2026!' },
  { email: 'manager@tourly.demo', name: 'Demo Manager', role: 'manager', password: 'Demo-Manager-2026!' },
  { email: 'user@tourly.demo', name: 'Demo User', role: 'user', password: 'Demo-User-2026!' },
];

const TRIPS = [
  { name: 'Jebel Shams Sunrise Hike', location: 'Al Hamra', days: 12, fee: 25, max: 12, palette: ['#f6a96b', '#c4573a', '#6b2d3b', '#3a1f33'] },
  { name: 'Wahiba Sands Desert Camp', location: 'Bidiyah', days: 19, fee: 45, max: 20, palette: ['#ffd89b', '#f0a35e', '#d9813f', '#a65a2a'] },
  { name: 'Musandam Fjord Cruise', location: 'Khasab', days: 26, fee: 60, max: 30, palette: ['#bfe6ff', '#5fb3e8', '#2a78d6', '#164a8a'] },
  { name: 'Wadi Shab Adventure', location: 'Tiwi', days: 33, fee: 15, max: 15, palette: ['#d6f5e3', '#7fd1ae', '#2f9e7d', '#1d5f57'] },
  { name: 'Nizwa Fort & Souq Visit', location: 'Nizwa', days: 40, fee: 10, max: 25, palette: ['#fbe7c6', '#e6b87d', '#b9834c', '#7a5230'] },
  { name: 'Salalah Khareef Escape', location: 'Salalah', days: 54, fee: 85, max: 18, palette: ['#e3f4e3', '#9fd39f', '#4fa65a', '#2e6b3a'] },
];

/** A simple original landscape illustration, generated as SVG and converted by sharp. */
function landscapeSvg([sky, far, mid, near], seed) {
  const y = (base, amp, k) => Array.from({ length: 9 }, (_, i) =>
    `${i * 200},${Math.round(base + Math.sin(i * 1.3 + seed * k) * amp)}`).join(' ');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="${sky}"/></linearGradient></defs>
    <rect width="1600" height="1000" fill="url(#g)"/>
    <circle cx="${300 + seed * 170}" cy="260" r="90" fill="#fff6dc" opacity="0.9"/>
    <polygon points="0,1000 ${y(520, 90, 1)} 1600,1000" fill="${far}"/>
    <polygon points="0,1000 ${y(660, 70, 2)} 1600,1000" fill="${mid}"/>
    <polygon points="0,1000 ${y(820, 50, 3)} 1600,1000" fill="${near}"/>
  </svg>`);
}

const isoInDays = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

async function seed() {
  const config = loadConfig();
  if (!config.DEMO_MODE) {
    console.log('DEMO_MODE is off: nothing seeded. Create an admin with:  npm run create-admin');
    return;
  }
  setCost(config.BCRYPT_COST);
  const db = openDatabase(config.DB_PATH);
  const images = createImageService(config.STORAGE_DIR);

  const ids = {};
  for (const u of DEMO_USERS) {
    if (checkPasswordPolicy(u.password, u)) throw new Error(`Demo password for ${u.email} violates the policy`);
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email);
    if (existing) { ids[u.role] = existing.id; continue; }
    const r = db.prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)')
      .run(u.email, await hashPassword(u.password), u.name, u.role);
    ids[u.role] = Number(r.lastInsertRowid);
    console.log(`  created ${u.role.padEnd(7)} ${u.email}`);
  }

  if (db.prepare('SELECT COUNT(*) AS n FROM trips').get().n === 0) {
    for (const [i, t] of TRIPS.entries()) {
      const png = await sharp(landscapeSvg(t.palette, i + 1)).png().toBuffer();
      const imageName = await images.save({ buffer: png });
      db.prepare(`INSERT INTO trips (name, image_name, date_available, location, entry_fee, max_people, current_available, manager_id)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(t.name, imageName, isoInDays(t.days), t.location, t.fee, t.max, t.max, ids.manager);
    }
    console.log(`  created ${TRIPS.length} sample trips`);

    const first = db.prepare('SELECT id FROM trips ORDER BY id LIMIT 1').get();
    db.transaction(() => {
      db.prepare('UPDATE trips SET current_available = current_available - 2 WHERE id = ?').run(first.id);
      db.prepare('INSERT INTO bookings (user_id, trip_id, booking_name, number_of_people) VALUES (?, ?, ?, ?)')
        .run(ids.user, first.id, 'Demo User', 2);
    })();
    console.log('  created 1 sample booking');
  }

  db.close();
  console.log('\n⚠  DEMO MODE: demo accounts are ready (see README). Never deploy with DEMO_MODE=true.');
}

seed().catch((err) => { console.error(`✖ ${err.message}`); process.exit(1); });
