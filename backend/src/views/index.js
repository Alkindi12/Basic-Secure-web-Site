'use strict';
/**
 * Response "views": explicit allow-lists of the fields each response may contain.
 * Database rows are never spread into a response, so internal columns
 * (password hash, image file paths, lockout counters …) cannot leak (finding S-08).
 */
const imageUrl = (name) => (name ? `/api/images/${name}` : null);

const toPublicUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  manager_request_status: u.manager_request_status ?? null,
  created_at: u.created_at,
});

const toPublicTrip = (t) => ({
  id: t.id,
  name: t.name,
  location: t.location,
  date_available: t.date_available,
  entry_fee: t.entry_fee,
  max_people: t.max_people,
  current_available: t.current_available,
  status: t.status,
  image_url: imageUrl(t.image_name),
});

/** Managers additionally see how many seats are booked. */
const toManagerTrip = (t) => ({ ...toPublicTrip(t), booked: t.max_people - t.current_available });

const toBooking = (b) => ({
  id: b.id,
  trip_id: b.trip_id,
  booking_name: b.booking_name,
  number_of_people: b.number_of_people,
  status: b.status,
  created_at: b.created_at,
  cancelled_at: b.cancelled_at ?? null,
  // The booking date is always the trip date (users no longer type it in).
  booking_date: b.date_available,
  trip_name: b.trip_name,
  location: b.location,
  entry_fee: b.entry_fee,
  date_available: b.date_available,
  trip_status: b.trip_status,
  trip_image_url: imageUrl(b.image_name),
  total_amount: Math.round(b.entry_fee * b.number_of_people * 100) / 100,
});

/** What a manager sees about the people who booked their trip. */
const toTripBooking = (b) => ({
  id: b.id,
  booking_name: b.booking_name,
  number_of_people: b.number_of_people,
  status: b.status,
  booking_date: b.date_available,
  created_at: b.created_at,
  user_name: b.user_name,
  user_email: b.user_email,
});

module.exports = { toPublicUser, toPublicTrip, toManagerTrip, toBooking, toTripBooking, imageUrl };
