import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { getImageUrl } from '../utils/imageUtils';
import './BookingConfirmation.css';
import { formatDate } from '../utils/dateUtils';

const BookingConfirmation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [bookingData, setBookingData] = useState(null);

  useEffect(() => {
    // Get booking data from location state
    if (location.state?.booking) {
      setBookingData(location.state.booking);
    } else {
      // If no booking data, redirect to dashboard
      navigate('/dashboard');
    }
  }, [location, navigate]);

  const handlePrint = () => {
    window.print();
  };

  if (!bookingData) {
    return (
      <div className="booking-confirmation-loading">
        <p>Loading confirmation...</p>
      </div>
    );
  }

  const imageUrl = getImageUrl(bookingData.trip_image_url || bookingData.image_url);

  return (
    <div className="booking-confirmation">
      <div className="container">
        <div className="confirmation-header">
          <div className="success-icon">✓</div>
          <h1>Booking Confirmed!</h1>
          <p className="confirmation-message">
            Your booking has been successfully confirmed. You can see it any time in your dashboard.
          </p>
        </div>

        <div className="confirmation-content">
          <div className="booking-details-card">
            <h2>Booking Details</h2>
            
            <div className="detail-row">
              <span className="detail-label">Booking ID:</span>
              <span className="detail-value">#{bookingData.id}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">Booking Name:</span>
              <span className="detail-value">{bookingData.booking_name}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">Number of People:</span>
              <span className="detail-value">{bookingData.number_of_people}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">Booking Date:</span>
              <span className="detail-value">
                {formatDate(bookingData.booking_date, 'en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">Booking Time:</span>
              <span className="detail-value">
                {new Date().toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>

          <div className="trip-details-card">
            <h2>Trip Information</h2>
            
            <div className="trip-image-container">
              <img src={imageUrl} alt={bookingData.trip_name} className="trip-image" />
            </div>

            <div className="trip-info">
              <h3>{bookingData.trip_name}</h3>
              
              <div className="detail-row">
                <span className="detail-label">Location:</span>
                <span className="detail-value">{bookingData.location}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Trip Date:</span>
                <span className="detail-value">
                  {formatDate(bookingData.date_available, 'en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Entry Fee per Person:</span>
                <span className="detail-value">{bookingData.entry_fee} RO</span>
              </div>
            </div>
          </div>

          <div className="payment-summary-card">
            <h2>Payment Summary</h2>
            
            <div className="summary-row">
              <span>Entry Fee (×{bookingData.number_of_people}):</span>
              <span>{(bookingData.entry_fee * bookingData.number_of_people).toFixed(2)} RO</span>
            </div>

            <div className="summary-row total-row">
              <span><strong>Total Amount:</strong></span>
              <span><strong>{(bookingData.total_amount || bookingData.entry_fee * bookingData.number_of_people).toFixed(2)} RO</strong></span>
            </div>
          </div>
        </div>

        <div className="confirmation-actions">
          <button onClick={handlePrint} className="print-btn">
            Print Confirmation
          </button>
          <Link to="/dashboard" className="dashboard-btn">
            Go to Dashboard
          </Link>
          <Link to="/packages" className="packages-btn">
            Browse More Trips
          </Link>
        </div>

        <div className="confirmation-footer">
          <p>Thank you for choosing Tourly!</p>
          <p className="footer-note">
            If you have any questions, please contact us at utas@gmail.com or call +968 777777
          </p>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmation;

