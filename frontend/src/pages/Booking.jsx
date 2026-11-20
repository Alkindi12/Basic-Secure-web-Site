import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { readError } from '../services/api';
import { getImageUrl } from '../utils/imageUtils';
import './Booking.css';
import { formatDate } from '../utils/dateUtils';

const Booking = () => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [bookingName, setBookingName] = useState('');
  const [numberOfPeople, setNumberOfPeople] = useState(1);
  const [numberOfPeopleInput, setNumberOfPeopleInput] = useState('1'); // String for input display
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [numberOfPeopleError, setNumberOfPeopleError] = useState(false);
  
  // Update numberOfPeople when trip loads to ensure it doesn't exceed available
  useEffect(() => {
    if (trip && numberOfPeople > trip.current_available) {
      const validValue = Math.min(numberOfPeople, trip.current_available);
      setNumberOfPeople(validValue);
      setNumberOfPeopleInput(validValue.toString());
    }
  }, [trip]);

  useEffect(() => {
    fetchTrip();
  }, [tripId]);

  const fetchTrip = async () => {
    try {
      const response = await api.get(`/trips/${tripId}`);
      setTrip(response.data.trip);
    } catch (error) {
      setError('Trip not found');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!bookingName.trim()) {
      setError('Booking name is required');
      return;
    }

    // Ensure numberOfPeople is a valid number
    const peopleCount = numberOfPeople || 1;
    if (peopleCount <= 0 || isNaN(peopleCount)) {
      setError('Number of people must be greater than 0');
      setNumberOfPeopleError(true);
      return;
    }

    if (peopleCount > trip.current_available) {
      setNumberOfPeopleError(true);
      setError(`Only ${trip.current_available} spots available`);
      return;
    }
    
    // Clear error state if validation passes
    setNumberOfPeopleError(false);

    try {
      setSubmitting(true);
      const response = await api.post('/bookings', {
        trip_id: tripId,
        booking_name: bookingName,
        number_of_people: peopleCount
      });

      // The server returns the full booking (trip name, date, price, image)
      navigate('/booking/confirmation', { state: { booking: response.data.booking } });
    } catch (error) {
      const { message, fields } = readError(error, 'Error creating booking');
      if (fields.number_of_people) setNumberOfPeopleError(true);
      setError(message);
      fetchTrip(); // seats may have changed in the meantime
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="booking-loading">Loading trip details...</div>;
  }

  if (!trip) {
    return <div className="booking-error">Trip not found</div>;
  }

  const imageUrl = getImageUrl(trip.image_url);
  const today = new Date().toISOString().slice(0, 10);
  const bookable = trip.status === 'active' && trip.date_available >= today && trip.current_available > 0;
  const notBookableReason = trip.status !== 'active' ? 'This trip has been cancelled.'
    : trip.date_available < today ? 'This trip has already taken place.'
    : trip.current_available === 0 ? 'This trip is fully booked.' : '';

  return (
    <div className="booking-page">
      <div className="container">
        <h1>Book Trip</h1>
        
        <div className="booking-content">
          <div className="trip-info">
            <img src={imageUrl} alt={trip.name} className="trip-image-large" />
            <h2>{trip.name}</h2>
            <div className="trip-details">
              <p><strong>Date Available:</strong> {formatDate(trip.date_available)}</p>
              <p><strong>Location:</strong> {trip.location}</p>
              <p><strong>Entry Fee:</strong> {trip.entry_fee} RO per person</p>
              <p><strong>Max People:</strong> {trip.max_people}</p>
              <p><strong>Available Spots:</strong> {trip.current_available}</p>
            </div>
          </div>

          <div className="booking-form-container">
            <form onSubmit={handleSubmit} className="booking-form">
              {error && <div className="error-message">{error}</div>}
              {!bookable && <div className="error-message">{notBookableReason}</div>}
              
              <div className="form-group">
                <label>Booking Name</label>
                <input
                  type="text"
                  value={bookingName}
                  onChange={(e) => setBookingName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Enter your name"
                />
              </div>

              <div className="form-group">
                <label>Number of People</label>
                <input
                  type="number"
                  min="1"
                  max={trip.current_available}
                  value={numberOfPeopleInput}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    // Update the input display value immediately
                    setNumberOfPeopleInput(inputValue);
                    
                    // Allow empty string while typing
                    if (inputValue === '' || inputValue === '-') {
                      setNumberOfPeopleError(false);
                      if (error.includes('spots available') || error.includes('must be greater')) {
                        setError('');
                      }
                      return;
                    }
                    
                    const value = parseInt(inputValue, 10);
                    // Check if it's a valid number
                    if (isNaN(value)) {
                      return; // Don't update if not a valid number
                    }
                    
                    // Update the actual number value
                    setNumberOfPeople(value);
                    
                    // Real-time validation
                    if (value > trip.current_available) {
                      setNumberOfPeopleError(true);
                      setError(`Only ${trip.current_available} spots available`);
                    } else if (value <= 0) {
                      setNumberOfPeopleError(true);
                      setError('Number of people must be greater than 0');
                    } else {
                      setNumberOfPeopleError(false);
                      // Only clear error if it was about spots available
                      if (error.includes('spots available') || error.includes('must be greater')) {
                        setError('');
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const inputValue = e.target.value.trim();
                    // If empty on blur, set to 1
                    if (inputValue === '' || inputValue === '0' || inputValue === '-') {
                      setNumberOfPeople(1);
                      setNumberOfPeopleInput('1');
                      setNumberOfPeopleError(false);
                      if (error.includes('spots available') || error.includes('must be greater')) {
                        setError('');
                      }
                      return;
                    }
                    
                    const value = parseInt(inputValue, 10);
                    if (isNaN(value) || value <= 0) {
                      setNumberOfPeople(1);
                      setNumberOfPeopleInput('1');
                      setNumberOfPeopleError(false);
                      if (error.includes('spots available') || error.includes('must be greater')) {
                        setError('');
                      }
                      return;
                    }
                    
                    // Ensure value doesn't exceed available
                    const finalValue = Math.min(value, trip.current_available);
                    setNumberOfPeople(finalValue);
                    setNumberOfPeopleInput(finalValue.toString());
                    
                    if (value > trip.current_available) {
                      setNumberOfPeopleError(true);
                      setError(`Only ${trip.current_available} spots available`);
                    } else {
                      setNumberOfPeopleError(false);
                      // Only clear error if it was about spots available
                      if (error.includes('spots available') || error.includes('must be greater')) {
                        setError('');
                      }
                    }
                  }}
                  className={numberOfPeopleError ? 'input-error' : ''}
                  required
                />
                <small className={numberOfPeopleError ? 'error-text' : ''}>
                  {numberOfPeopleError 
                    ? `Maximum: ${trip.current_available} available (You entered: ${numberOfPeopleInput})`
                    : `Maximum: ${trip.current_available} available`}
                </small>
              </div>

              <div className="form-group">
                <label>Trip Date</label>
                <p className="trip-date-display">
                  {formatDate(trip.date_available, 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <small>Bookings are always for the trip's scheduled date.</small>
              </div>

              <div className="total-section">
                <p className="total">
                  <strong>Total: {(trip.entry_fee * numberOfPeople).toFixed(2)} RO</strong>
                </p>
              </div>

              <button type="submit" disabled={submitting || !bookable} className="submit-btn">
                {submitting ? 'Booking...' : 'Confirm Booking'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Booking;

