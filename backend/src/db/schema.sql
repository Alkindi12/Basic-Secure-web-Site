-- Tourly v2 schema
-- Business rules live in the database too (last line of defence, findings S-02, S-09, S-16).

CREATE TABLE IF NOT EXISTS users (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  email                  TEXT    NOT NULL UNIQUE COLLATE NOCASE CHECK (length(email) <= 254),
  password               TEXT    NOT NULL,
  name                   TEXT    NOT NULL CHECK (length(name) BETWEEN 2 AND 60),
  role                   TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'manager', 'admin')),
  manager_request_status TEXT    CHECK (manager_request_status IN ('pending', 'approved', 'rejected')),
  auth_version           INTEGER NOT NULL DEFAULT 1,   -- bump to revoke every session (S-10)
  failed_logins          INTEGER NOT NULL DEFAULT 0,   -- account lockout (S-04)
  locked_until           INTEGER,                      -- epoch ms
  created_at             TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trips (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT    NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
  image_name        TEXT    NOT NULL,                 -- file NAME only, never a path (S-08)
  date_available    TEXT    NOT NULL CHECK (date_available = date(date_available)),
  location          TEXT    NOT NULL CHECK (length(location) BETWEEN 2 AND 100),
  entry_fee         REAL    NOT NULL CHECK (entry_fee >= 0 AND entry_fee <= 10000),
  max_people        INTEGER NOT NULL CHECK (max_people BETWEEN 1 AND 500),
  current_available INTEGER NOT NULL,
  status            TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  manager_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (current_available BETWEEN 0 AND max_people)  -- seats can never go negative (S-02)
);

CREATE TABLE IF NOT EXISTS bookings (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  trip_id          INTEGER NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
  booking_name     TEXT    NOT NULL CHECK (length(booking_name) BETWEEN 2 AND 80),
  number_of_people INTEGER NOT NULL CHECK (number_of_people BETWEEN 1 AND 50),
  status           TEXT    NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  cancelled_at     TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  sid     TEXT    PRIMARY KEY,
  sess    TEXT    NOT NULL,
  expires INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  user_id    INTEGER,
  ip         TEXT,
  action     TEXT    NOT NULL,
  target     TEXT,
  details    TEXT
);

CREATE INDEX IF NOT EXISTS idx_trips_date      ON trips(date_available);
CREATE INDEX IF NOT EXISTS idx_trips_manager   ON trips(manager_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user   ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_trip   ON bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exp    ON sessions(expires);
CREATE INDEX IF NOT EXISTS idx_audit_at        ON audit_log(at);
