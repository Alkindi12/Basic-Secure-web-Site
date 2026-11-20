'use strict';
/**
 * Database access with Node's built-in SQLite driver (node:sqlite, Node >= 22.13).
 *
 * Why built-in and synchronous?
 *  - No native add-on to compile, so `npm install` works the same on Windows, macOS and Linux.
 *  - Calls are synchronous, so a transaction can never interleave with another request.
 *    That is what makes the booking flow atomic (finding S-02).
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function openDatabase(dbPath) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);

  db.exec('PRAGMA foreign_keys = ON;');   // SQLite ignores FOREIGN KEY clauses without this (S-16)
  db.exec('PRAGMA busy_timeout = 5000;');
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');

  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

  /**
   * Runs fn inside BEGIN IMMEDIATE … COMMIT. Any throw rolls everything back.
   * IMMEDIATE takes the write lock up front, so two processes cannot both
   * read "3 seats left" and then both write.
   */
  db.transaction = (fn) => (...args) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };

  return db;
}

module.exports = { openDatabase };
