import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { readError } from '../services/api';
import { getImageUrl, PLACEHOLDER_IMAGE } from '../utils/imageUtils';
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import './Dashboard.css';
import { formatDate } from '../utils/dateUtils';

const Dashboard = () => {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestingManager, setRequestingManager] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState(false);
  const [cancelModal, setCancelModal] = useState({ isOpen: false, bookingId: null, bookingName: '' });
  const [managerRequestModal, setManagerRequestModal] = useState({ isOpen: false });
  const [cancelRequestModal, setCancelRequestModal] = useState({ isOpen: false });

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await api.get('/users/bookings');
      setBookings(response.data.bookings);
    } catch (error) {
      toast.error(readError(error, 'Could not load your bookings').message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = (bookingId, bookingName) => {
    setCancelModal({
      isOpen: true,
      bookingId,
      bookingName
    });
  };

  const confirmCancelBooking = async () => {
    if (!cancelModal.bookingId) return;

    try {
      await api.delete(`/bookings/${cancelModal.bookingId}`);
      toast.success('Booking cancelled. Your seats were released.');
      fetchBookings();
    } catch (error) {
      toast.error(readError(error, 'Could not cancel the booking').message);
    } finally {
      setCancelModal({ isOpen: false, bookingId: null, bookingName: '' });
    }
  };

  const handleRequestManager = () => {
    setManagerRequestModal({ isOpen: true });
  };

  const confirmRequestManager = async () => {
    try {
      setRequestingManager(true);
      setManagerRequestModal({ isOpen: false });
      await api.post('/users/request-manager');
      await refreshUser();
      toast.success('Manager request sent. An admin will review it.');
    } catch (error) {
      toast.error(readError(error, 'Could not submit the request').message);
    } finally {
      setRequestingManager(false);
    }
  };

  const handleCancelManagerRequest = () => {
    setCancelRequestModal({ isOpen: true });
  };

  const confirmCancelManagerRequest = async () => {
    try {
      setCancellingRequest(true);
      setCancelRequestModal({ isOpen: false });
      await api.post('/users/cancel-manager-request');
      await refreshUser();
      toast.info('Manager request cancelled.');
    } catch (error) {
      toast.error(readError(error, 'Could not cancel the request').message);
    } finally {
      setCancellingRequest(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const statusOf = (b) => {
    if (b.status === 'cancelled') return { key: 'cancelled', label: b.trip_status === 'cancelled' ? 'Trip cancelled' : 'Cancelled' };
    if (b.date_available < today) return { key: 'completed', label: 'Completed' };
    return { key: 'upcoming', label: 'Confirmed' };
  };

  const canRequestManager = user && user.role === 'user' && 
    (!user.manager_request_status || user.manager_request_status === 'rejected');
  
  const hasPendingRequest = user && user.role === 'user' && user.manager_request_status === 'pending';

  return (
    <div className="dashboard">
      <div className="container">
        <h1>My Dashboard</h1>

        {user && (
          <div className="user-info">
            <div className="user-header">
              <h2>Welcome, {user.name}!</h2>
              <Link to="/profile/edit" className="edit-profile-link">
                Edit Profile
              </Link>
            </div>
            <p>Email: {user.email}</p>
            <p>Role: {user.role}</p>
            {user.manager_request_status === 'rejected' && (
              <p className="rejected-status">Manager request was rejected. You can request again.</p>
            )}
          </div>
        )}

        {canRequestManager && (
          <div className="manager-request-section">
            <button 
              onClick={handleRequestManager} 
              disabled={requestingManager}
              className="request-manager-btn"
            >
              {requestingManager ? 'Submitting...' : 'Request to be Manager'}
            </button>
          </div>
        )}

        {hasPendingRequest && (
          <div className="manager-request-section">
            <div className="pending-request-info">
              <p className="pending-status">Manager request pending approval</p>
              <button 
                onClick={handleCancelManagerRequest} 
                disabled={cancellingRequest}
                className="cancel-request-btn"
              >
                {cancellingRequest ? 'Cancelling...' : 'Cancel Request'}
              </button>
            </div>
          </div>
        )}

        <div className="bookings-section">
          <h2>My Bookings</h2>
          {loading ? (
            <div className="loading">Loading bookings...</div>
          ) : bookings.length === 0 ? (
            <div className="no-bookings">You have no bookings yet.</div>
          ) : (
            <div className="bookings-list">
              {bookings.map(booking => (
                <div key={booking.id} className="booking-card">
                  <img 
                    src={getImageUrl(booking.trip_image_url)}
                    alt={booking.trip_name}
                    className="booking-image"
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }}
                  />
                  <div className="booking-details">
                    <div className="booking-title-row">
                      <h3>{booking.trip_name}</h3>
                      <span className={`status-badge status-${statusOf(booking).key}`}>{statusOf(booking).label}</span>
                    </div>
                    <p><strong>Location:</strong> {booking.location}</p>
                    <p><strong>Date:</strong> {formatDate(booking.booking_date)}</p>
                    <p><strong>People:</strong> {booking.number_of_people}</p>
                    <p><strong>Booking Name:</strong> {booking.booking_name}</p>
                    <p><strong>Entry Fee:</strong> {booking.entry_fee} RO per person</p>
                    <p><strong>Total:</strong> {Number(booking.total_amount).toFixed(2)} RO</p>
                    {statusOf(booking).key === 'upcoming' && (
                      <button
                        onClick={() => handleCancelBooking(booking.id, booking.trip_name)}
                        className="cancel-btn"
                      >
                        Cancel Booking
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={cancelModal.isOpen}
        onClose={() => setCancelModal({ isOpen: false, bookingId: null, bookingName: '' })}
        onConfirm={confirmCancelBooking}
        title="Cancel Booking"
        message={`Cancel your booking for "${cancelModal.bookingName}"? Your seats will be released for other travellers. The booking stays in your history as cancelled.`}
        confirmText="Yes, Cancel Booking"
        cancelText="Keep Booking"
        type="danger"
      />

      <ConfirmModal
        isOpen={managerRequestModal.isOpen}
        onClose={() => setManagerRequestModal({ isOpen: false })}
        onConfirm={confirmRequestManager}
        title="Request Manager Access"
        message="Are you sure you want to request manager access? An admin will review your request and notify you of the decision."
        confirmText="Yes, Request Access"
        cancelText="Cancel"
        type="primary"
      />

      <ConfirmModal
        isOpen={cancelRequestModal.isOpen}
        onClose={() => setCancelRequestModal({ isOpen: false })}
        onConfirm={confirmCancelManagerRequest}
        title="Cancel Manager Request"
        message="Are you sure you want to cancel your manager request? You can request again later if needed."
        confirmText="Yes, Cancel Request"
        cancelText="Keep Request"
        type="danger"
      />
    </div>
  );
};

export default Dashboard;

