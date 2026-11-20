'use strict';
const validate = require('../validators');
const { HttpError } = require('../utils/httpError');
const { canManageTrip } = require('../middleware/auth');
const { toBooking, toTripBooking } = require('../views');

module.exports = function bookingController({ db, audit }) {
  const q = {
    trip: db.prepare('SELECT * FROM trips WHERE id = ?'),
    // The check and the update are ONE statement: it succeeds completely or changes 0 rows.
    takeSeats: db.prepare(`
      UPDATE trips SET current_available = current_available - ?
      WHERE id = ? AND status = 'active' AND date_available >= date('now') AND current_available >= ?`),
    insert: db.prepare(`INSERT INTO bookings (user_id, trip_id, booking_name, number_of_people)
                        VALUES (?, ?, ?, ?)`),
    full: db.prepare(`
      SELECT b.*, t.name AS trip_name, t.location, t.entry_fee, t.date_available, t.image_name, t.status AS trip_status
      FROM bookings b JOIN trips t ON t.id = b.trip_id WHERE b.id = ?`),
    mine: db.prepare(`
      SELECT b.*, t.name AS trip_name, t.location, t.entry_fee, t.date_available, t.image_name, t.status AS trip_status
      FROM bookings b JOIN trips t ON t.id = b.trip_id WHERE b.user_id = ? ORDER BY b.created_at DESC, b.id DESC`),
    ownBooking: db.prepare(`
      SELECT b.*, t.date_available, t.status AS trip_status
      FROM bookings b JOIN trips t ON t.id = b.trip_id WHERE b.id = ? AND b.user_id = ?`),
    cancel: db.prepare(`UPDATE bookings SET status = 'cancelled', cancelled_at = datetime('now')
                        WHERE id = ? AND status = 'confirmed'`),
    giveBack: db.prepare(`UPDATE trips SET current_available = current_available + ?
                          WHERE id = ? AND status = 'active'`),
    tripBookings: db.prepare(`
      SELECT b.*, t.date_available, u.name AS user_name, u.email AS user_email
      FROM bookings b JOIN users u ON u.id = b.user_id JOIN trips t ON t.id = b.trip_id
      WHERE b.trip_id = ? ORDER BY b.status = 'cancelled', b.created_at DESC`),
  };

  /** Atomic booking (finding S-02): two users can never both get the last seats. */
  const bookTrip = db.transaction((userId, tripId, name, people) => {
    const seat = q.takeSeats.run(people, tripId, people);
    if (seat.changes === 0) {
      const trip = q.trip.get(tripId);
      if (!trip) throw new HttpError(404, 'Trip not found');
      if (trip.status !== 'active') throw new HttpError(400, 'This trip has been cancelled');
      if (trip.date_available < validate.todayISO()) throw new HttpError(400, 'This trip has already taken place');
      const msg = trip.current_available === 0 ? 'This trip is fully booked'
        : `Only ${trip.current_available} seat${trip.current_available === 1 ? '' : 's'} left`;
      throw new HttpError(409, msg, { number_of_people: msg });
    }
    return Number(q.insert.run(userId, tripId, name, people).lastInsertRowid);
  });

  function create(req, res) {
    const b = validate.booking(req.body || {});
    const id = bookTrip(req.user.id, b.trip_id, b.booking_name, b.number_of_people);
    audit(req, 'booking_created', { target: `booking:${id}`, details: { trip: b.trip_id, people: b.number_of_people } });
    res.status(201).json({ message: 'Booking confirmed', booking: toBooking(q.full.get(id)) });
  }

  function mine(req, res) {
    res.json({ bookings: q.mine.all(req.user.id).map(toBooking) });
  }

  /** Cancelling keeps the booking as history (status = cancelled) and gives the seats back. */
  function cancel(req, res) {
    const id = validate.idParam(req.params.id);
    db.transaction(() => {
      const booking = q.ownBooking.get(id, req.user.id);
      if (!booking) throw new HttpError(404, 'Booking not found');
      if (booking.status !== 'confirmed') throw new HttpError(400, 'This booking is already cancelled');
      if (booking.date_available < validate.todayISO()) throw new HttpError(400, 'Past bookings cannot be cancelled');
      q.cancel.run(id);
      q.giveBack.run(booking.number_of_people, booking.trip_id);
    })();
    audit(req, 'booking_cancelled', { target: `booking:${id}` });
    res.json({ message: 'Booking cancelled', booking: toBooking(q.full.get(id)) });
  }

  function forTrip(req, res) {
    const trip = q.trip.get(validate.idParam(req.params.tripId));
    if (!trip || !canManageTrip(req.user, trip)) throw new HttpError(404, 'Trip not found');
    res.json({ bookings: q.tripBookings.all(trip.id).map(toTripBooking) });
  }

  return { create, mine, cancel, forTrip };
};
