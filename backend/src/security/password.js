'use strict';
/**
 * Password policy and hashing (findings S-13, S-14).
 *
 * Policy follows NIST SP 800-63B:
 *  - at least 8 characters, at most 64
 *  - not on a list of commonly used passwords, not the same as the email
 *  - no forced "one symbol, one digit" rules (they produce predictable passwords)
 * The 64-character cap also keeps us under bcrypt's 72-byte limit, beyond which
 * bcrypt silently ignores the rest of the password.
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const COMMON = new Set(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'common-passwords.txt'), 'utf8')
    .split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith('#'))
);

const MIN = 8;
const MAX = 64;

/** Returns an error message, or null when the password is acceptable. */
function checkPasswordPolicy(password, { email } = {}) {
  if (typeof password !== 'string') return 'Password is required';
  if (password.length < MIN) return `Password must be at least ${MIN} characters`;
  if (password.length > MAX) return `Password must be at most ${MAX} characters`;
  if (Buffer.byteLength(password, 'utf8') > 72) return 'Password is too long';
  if (COMMON.has(password.toLowerCase())) return 'This password is too common. Please choose another one';
  if (email && password.toLowerCase() === String(email).toLowerCase()) return 'Password must not be your email';
  if (/^(.)\1+$/.test(password)) return 'Password must not be a single repeated character';
  return null;
}

let cost = 12;
const setCost = (c) => { cost = c; };
const hashPassword = (pw) => bcrypt.hash(pw, cost);

// A real bcrypt hash of a random value. Comparing against it when the email does not
// exist makes "unknown email" take as long as "wrong password" (finding S-14).
const DUMMY_HASH = bcrypt.hashSync(require('crypto').randomBytes(16).toString('hex'), 10);

async function verifyPassword(pw, hash) {
  return bcrypt.compare(String(pw || ''), hash || DUMMY_HASH);
}

/** True when a stored hash uses a lower cost than today's setting (re-hash on next login). */
const needsRehash = (hash) => bcrypt.getRounds(hash) < cost;

module.exports = { checkPasswordPolicy, hashPassword, verifyPassword, needsRehash, setCost, DUMMY_HASH };
