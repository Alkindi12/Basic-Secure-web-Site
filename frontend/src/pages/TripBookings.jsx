import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api, { readError } from '../services/api';
import { useToast } from '../components/Toast';
import './TripBookings.css';
import { formatDate } from '../utils/dateUtils';

const TripBookings = () => {
  const { tripId } = useParams();
  const [bookings, setBookings] = useState([]);
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    fetchData();
  }, [tripId]);

  const fetchData = async () => {
    try {
      const [bookingsRes, tripRes] = await Promise.all([
        api.get(`/bookings/trip/${tripId}`),
        api.get(`/trips/${tripId}`)
      ]);
      setBookings(bookingsRes.data.bookings);
      setTrip(tripRes.data.trip);
    } catch (error) {
      toast.error(readError(error, 'Could not load bookings').message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="trip-bookings-loading">Loading bookings...</div>;
  }

  return (
    <div className="trip-bookings">
      <div className="container">
        <h1>Bookings for {trip?.name}</h1>
        
        <div className="trip-summary">
          <p><strong>Location:</strong> {trip?.location}</p>
          <p><strong>Date:</strong> {trip && formatDate(trip.date_available)}</p>
          <p><strong>Confirmed Bookings:</strong> {bookings.filter((b) => b.status === 'confirmed').length}</p>
          <p><strong>Confirmed People:</strong> {bookings.filter((b) => b.status === 'confirmed').reduce((sum, b) => sum + b.number_of_people, 0)}</p>
        </div>

        {bookings.length === 0 ? (
          <div className="no-bookings">No bookings for this trip yet.</div>
        ) : (
          <div className="bookings-table">
            <table>
              <thead>
                <tr>
                  <th>Booking Name</th>
                  <th>User Email</th>
                  <th>Number of People</th>
                  <th>Booking Date</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(booking => (
                  <tr key={booking.id}>
                    <td>{booking.booking_name}</td>
                    <td>{booking.user_email}</td>
                    <td>{booking.number_of_people}</td>
                    <td>{formatDate(booking.booking_date)}</td>
                    <td>{(trip?.entry_fee * booking.number_of_people).toFixed(2)} RO</td>
                    <td>
                      <span className={booking.status === 'confirmed' ? 'booking-status confirmed' : 'booking-status cancelled'}>
                        {booking.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripBookings;




