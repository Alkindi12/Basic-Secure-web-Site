'use strict';
const validate = require('../validators');
const { HttpError } = require('../utils/httpError');
const { canManageTrip } = require('../middleware/auth');
const { toPublicTrip, toManagerTrip } = require('../views');

module.exports = function tripController({ db, audit, images }) {
  const q = {
    byId: db.prepare('SELECT * FROM trips WHERE id = ?'),
    insert: db.prepare(`INSERT INTO trips (name, image_name, date_available, location, entry_fee,
                          max_people, current_available, manager_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
    mine: db.prepare("SELECT * FROM trips WHERE manager_id = ? ORDER BY status = 'cancelled', date_available DESC"),
    all: db.prepare("SELECT * FROM trips ORDER BY status = 'cancelled', date_available DESC"),
    bookingCount: db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE trip_id = ?'),
    hardDelete: db.prepare('DELETE FROM trips WHERE id = ?'),
    cancelTrip: db.prepare("UPDATE trips SET status = 'cancelled' WHERE id = ?"),
    cancelBookings: db.prepare(`UPDATE bookings SET status = 'cancelled', cancelled_at = datetime('now')
                                WHERE trip_id = ? AND status = 'confirmed'`),
  };

  /** Public list: only active, upcoming trips. Supports filters and pagination (U-04, U-08). */
  function list(req, res) {
    const f = validate.tripQuery(req.query);
    const where = ["status = 'active'", "date_available >= date('now')"];
    const params = [];
    if (f.search) { where.push('(name LIKE ? OR location LIKE ?)'); params.push(`%${f.search}%`, `%${f.search}%`); }
    if (f.location) { where.push('location LIKE ?'); params.push(`%${f.location}%`); }
    if (f.minPrice !== undefined) { where.push('entry_fee >= ?'); params.push(f.minPrice); }
    if (f.maxPrice !== undefined) { where.push('entry_fee <= ?'); params.push(f.maxPrice); }
    if (f.date) { where.push('date_available = ?'); params.push(f.date); }
    const sqlWhere = where.join(' AND ');
    const { n: total } = db.prepare(`SELECT COUNT(*) AS n FROM trips WHERE ${sqlWhere}`).get(...params);
    const rows = db.prepare(`SELECT * FROM trips WHERE ${sqlWhere} ORDER BY date_available ASC, id ASC LIMIT ? OFFSET ?`)
      .all(...params, f.limit, (f.page - 1) * f.limit);
    const locations = db.prepare(`SELECT DISTINCT location FROM trips
                                  WHERE status = 'active' AND date_available >= date('now') ORDER BY location`)
      .all().map((r) => r.location);
    res.json({ trips: rows.map(toPublicTrip), page: f.page, limit: f.limit, total, locations });
  }

  function getById(req, res) {
    const trip = q.byId.get(validate.idParam(req.params.id));
    if (!trip) throw new HttpError(404, 'Trip not found');
    res.json({ trip: toPublicTrip(trip) });
  }

  /** Managers see their own trips; admins see every trip (finding S-19). */
  function mine(req, res) {
    const rows = req.user.role === 'admin' ? q.all.all() : q.mine.all(req.user.id);
    res.json({ trips: rows.map(toManagerTrip) });
  }

  async function create(req, res) {
    const data = validate.trip(req.body || {});
    const imageName = await images.save(req.file);
    try {
      const { lastInsertRowid } = q.insert.run(data.name, imageName, data.date_available, data.location,
        data.entry_fee, data.max_people, data.max_people, req.user.id);
      const trip = q.byId.get(Number(lastInsertRowid));
      audit(req, 'trip_created', { target: `trip:${trip.id}` });
      res.status(201).json({ message: 'Trip created', trip: toManagerTrip(trip) });
    } catch (err) {
      await images.remove(imageName); // no orphan file if the insert fails
      throw err;
    }
  }

  async function update(req, res) {
    const trip = q.byId.get(validate.idParam(req.params.id));
    if (!trip || !canManageTrip(req.user, trip)) throw new HttpError(404, 'Trip not found');
    if (trip.status === 'cancelled') throw new HttpError(400, 'A cancelled trip cannot be edited');

    const data = validate.trip(req.body || {}, { partial: true, currentDate: trip.date_available });
    const sets = [];
    const params = [];
    for (const field of ['name', 'location', 'date_available', 'entry_fee']) {
      if (data[field] !== undefined && data[field] !== trip[field]) { sets.push(`${field} = ?`); params.push(data[field]); }
    }
    if (data.max_people !== undefined && data.max_people !== trip.max_people) {
      const booked = trip.max_people - trip.current_available;
      if (data.max_people < booked) {
        const msg = `${booked} seats are already booked, so the maximum cannot be lower than ${booked}`;
        throw new HttpError(400, msg, { max_people: msg });
      }
      sets.push('max_people = ?', 'current_available = ?');
      params.push(data.max_people, data.max_people - booked);
    }

    let newImage = null;
    if (req.file) {
      newImage = await images.save(req.file);
      sets.push('image_name = ?'); params.push(newImage);
    }
    if (!sets.length) return res.json({ message: 'Nothing changed', trip: toManagerTrip(trip) });

    try {
      db.prepare(`UPDATE trips SET ${sets.join(', ')} WHERE id = ?`).run(...params, trip.id);
    } catch (err) {
      if (newImage) await images.remove(newImage);
      throw err;
    }
    if (newImage) await images.remove(trip.image_name); // old file is no longer referenced
    audit(req, 'trip_updated', { target: `trip:${trip.id}`, details: { fields: sets.map((s) => s.split(' ')[0]) } });
    res.json({ message: 'Trip updated', trip: toManagerTrip(q.byId.get(trip.id)) });
  }

  /**
   * A trip without bookings is deleted (with its image).
   * A trip with bookings is CANCELLED instead, so booking history is never lost (S-16).
   */
  async function remove(req, res) {
    const trip = q.byId.get(validate.idParam(req.params.id));
    if (!trip || !canManageTrip(req.user, trip)) throw new HttpError(404, 'Trip not found');

    if (q.bookingCount.get(trip.id).n === 0) {
      q.hardDelete.run(trip.id);
      await images.remove(trip.image_name);
      audit(req, 'trip_deleted', { target: `trip:${trip.id}` });
      return res.json({ message: 'Trip deleted', deleted: true });
    }
    if (trip.status === 'cancelled') throw new HttpError(400, 'This trip is already cancelled');
    const cancelled = db.transaction(() => {
      q.cancelTrip.run(trip.id);
      return q.cancelBookings.run(trip.id).changes;
    })();
    audit(req, 'trip_cancelled', { target: `trip:${trip.id}`, details: { bookingsCancelled: Number(cancelled) } });
    res.json({ message: `Trip cancelled. ${cancelled} booking(s) were cancelled and kept in history.`, deleted: false });
  }

  return { list, getById, mine, create, update, remove };
};
