/**
 * Dates from the API come in two shapes:
 *   - date only  "2026-12-02"           (trip dates). new Date() would read this
 *     as UTC midnight, which shows as the previous day west of UTC.
 *   - SQLite UTC "2026-12-02 14:05:00"  (created_at, cancelled_at). Without a
 *     zone marker the browser would read it as local time.
 * parseApiDate() turns both into the right Date object.
 */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const SQLITE_UTC = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export function parseApiDate(value) {
  if (typeof value === 'string') {
    const m = DATE_ONLY.exec(value);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (SQLITE_UTC.test(value)) return new Date(value.replace(' ', 'T') + 'Z');
  }
  return new Date(value);
}

export const formatDate = (value, locale, options) =>
  parseApiDate(value).toLocaleDateString(locale, options);

export const formatDateTime = (value, locale, options) =>
  parseApiDate(value).toLocaleString(locale, options);
