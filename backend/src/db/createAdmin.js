'use strict';
/**
 * Creates (or promotes) an administrator interactively. No default credentials (finding S-18).
 *
 *   npm run create-admin
 *
 * The password is typed without being shown and must pass the password policy.
 */
const readline = require('readline');
const { loadConfig } = require('../config/env');
const { openDatabase } = require('./connection');
const validate = require('../validators');
const { hashPassword, setCost, checkPasswordPolicy } = require('../security/password');

// One readline interface + a line iterator (which buffers), so piped input also works.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
const lines = rl[Symbol.asyncIterator]();
let muted = false;
rl._writeToOutput = (s) => { if (!muted) rl.output.write(s); }; // hides typed password characters

async function ask(question, { hidden = false } = {}) {
  process.stdout.write(question);
  muted = hidden;
  const { value = '' } = await lines.next();
  if (hidden) process.stdout.write('\n');
  muted = false;
  return String(value).trim();
}

async function main() {
  const config = loadConfig();
  setCost(config.BCRYPT_COST);
  const db = openDatabase(config.DB_PATH);

  const { email, name } = validate.register({
    email: await ask('Admin email: '),
    name: await ask('Admin name: '),
    password: 'placeholder',
  });
  const password = await ask('Password (hidden): ', { hidden: true });
  const policy = checkPasswordPolicy(password, { email });
  if (policy) throw new Error(policy);
  if (password !== await ask('Repeat password: ', { hidden: true })) throw new Error('Passwords do not match');

  const hash = await hashPassword(password);
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    db.prepare("UPDATE users SET role = 'admin', password = ?, auth_version = auth_version + 1 WHERE id = ?").run(hash, existing.id);
    console.log(`✔ ${email} is now an admin (password updated, old sessions revoked).`);
  } else {
    db.prepare("INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, 'admin')").run(email, hash, name);
    console.log(`✔ Admin ${email} created.`);
  }
  db.close();
}

main()
  .catch((err) => { console.error(`✖ ${err.details ? Object.values(err.details).join(', ') : err.message}`); process.exitCode = 1; })
  .finally(() => rl.close());
