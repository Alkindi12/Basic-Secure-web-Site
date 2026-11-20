'use strict';
/**
 * Hand-written input validation (finding S-09). Library alternative: zod.
 *
 * Every validator returns the cleaned value, or throws an HttpError(400) with
 * field-level messages the frontend can show next to each input.
 * Rules are repeated as CHECK constraints in schema.sql (defence in depth).
 */
const { HttpError } = require('../utils/httpError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const todayISO = () => new Date().toISOString().slice(0, 10);

function fail(errors) {
  const first = Object.values(errors)[0];
  throw new HttpError(400, first, errors);
}

function text(v, { min, max }) {
  const s = str(v);
  if (s.length < min || s.length > max) return { error: `Must be between ${min} and ${max} characters` };
  // No control characters (newlines, NUL, …) in short single-line fields.
  if (/[\u0000-\u001F\u007F]/.test(s)) return { error: 'Contains invalid characters' };
  return { value: s };
}

function integer(v, { min, max }) {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && /^\s*-?\d+\s*$/.test(v) ? Number(v) : NaN);
  if (!Number.isInteger(n) || n < min || n > max) return { error: `Must be a whole number from ${min} to ${max}` };
  return { value: n };
}

function money(v, { min, max }) {
  const s = typeof v === 'number' ? String(v) : str(v);
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return { error: 'Must be a number with at most 2 decimals' };
  const n = Number(s);
  if (n < min || n > max) return { error: `Must be between ${min} and ${max}` };
  return { value: n };
}

function isoDate(v, { notPast = false } = {}) {
  const s = str(v);
  if (!DATE_RE.test(s) || Number.isNaN(Date.parse(s + 'T00:00:00Z')) ||
      new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) !== s) {
    return { error: 'Must be a valid date (YYYY-MM-DD)' };
  }
  if (notPast && s < todayISO()) return { error: 'Date cannot be in the past' };
  return { value: s };
}

function email(v) {
  const s = str(v).toLowerCase();
  if (!s || s.length > 254 || !EMAIL_RE.test(s)) return { error: 'Please enter a valid email address' };
  return { value: s };
}

/** Runs a map of { field: () => result } and collects every error at once. */
function collect(checks) {
  const out = {};
  const errors = {};
  for (const [field, check] of Object.entries(checks)) {
    const r = check();
    if (r === undefined) continue; // optional field not supplied
    if (r.error) errors[field] = r.error; else out[field] = r.value;
  }
  if (Object.keys(errors).length) fail(errors);
  return out;
}

const present = (v) => v !== undefined && v !== null && v !== '';

// ---------- per-route validators ----------

exports.register = (b) => collect({
  name: () => text(b.name, { min: 2, max: 60 }),
  email: () => email(b.email),
  password: () => (typeof b.password === 'string' && b.password ? { value: b.password } : { error: 'Password is required' }),
});

exports.login = (b) => collect({
  email: () => email(b.email),
  password: () => (typeof b.password === 'string' && b.password && b.password.length <= 200
    ? { value: b.password } : { error: 'Password is required' }),
});

exports.booking = (b) => collect({
  trip_id: () => integer(b.trip_id, { min: 1, max: 2 ** 31 - 1 }),
  booking_name: () => text(b.booking_name, { min: 2, max: 80 }),
  number_of_people: () => integer(b.number_of_people, { min: 1, max: 50 }),
});

/** partial=true for updates: only supplied fields are validated. */
exports.trip = (b, { partial = false, currentDate } = {}) => collect({
  name: () => (partial && !present(b.name) ? undefined : text(b.name, { min: 2, max: 100 })),
  location: () => (partial && !present(b.location) ? undefined : text(b.location, { min: 2, max: 100 })),
  // A date that is unchanged on edit may be in the past; a new date may not.
  date_available: () => (partial && !present(b.date_available) ? undefined
    : isoDate(b.date_available, { notPast: !(partial && str(b.date_available) === currentDate) })),
  entry_fee: () => (partial && !present(b.entry_fee) ? undefined : money(b.entry_fee, { min: 0, max: 10000 })),
  max_people: () => (partial && !present(b.max_people) ? undefined : integer(b.max_people, { min: 1, max: 500 })),
});

exports.profile = (b) => collect({
  name: () => (present(b.name) ? text(b.name, { min: 2, max: 60 }) : undefined),
  email: () => (present(b.email) ? email(b.email) : undefined),
  currentPassword: () => (present(b.currentPassword) ? { value: String(b.currentPassword) } : undefined),
  newPassword: () => (present(b.newPassword) ? { value: String(b.newPassword) } : undefined),
});

exports.role = (b) => collect({
  role: () => (['user', 'manager', 'admin'].includes(b.role) ? { value: b.role } : { error: 'Role must be user, manager or admin' }),
});

exports.idParam = (v, name = 'id') => {
  const r = integer(v, { min: 1, max: 2 ** 31 - 1 });
  if (r.error) throw new HttpError(404, 'Not found');
  return r.value;
};

exports.tripQuery = (q) => {
  const out = { page: 1, limit: 12 };
  const p = integer(q.page, { min: 1, max: 10000 }); if (!p.error) out.page = p.value;
  const l = integer(q.limit, { min: 1, max: 50 }); if (!l.error) out.limit = l.value;
  const s = str(q.search).slice(0, 100); if (s) out.search = s;
  const loc = str(q.location).slice(0, 100); if (loc) out.location = loc;
  const min = money(q.minPrice, { min: 0, max: 10000 }); if (!min.error) out.minPrice = min.value;
  const max = money(q.maxPrice, { min: 0, max: 10000 }); if (!max.error) out.maxPrice = max.value;
  const d = isoDate(q.date); if (!d.error) out.date = d.value;
  return out;
};

exports.todayISO = todayISO;
