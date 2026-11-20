import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { readError } from '../services/api';
import { getImageUrl } from '../utils/imageUtils';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import './ManagerDashboard.css';
import { formatDate } from '../utils/dateUtils';

const ManagerDashboard = () => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, trip: null });

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      const response = await api.get('/trips/my-trips');
      setTrips(response.data.trips);
    } catch (error) {
      toast.error(readError(error, 'Could not load trips').message);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    const trip = deleteModal.trip;
    setDeleteModal({ isOpen: false, trip: null });
    if (!trip) return;
    try {
      const res = await api.delete(`/trips/${trip.id}`);
      toast.success(res.data.message);
      fetchTrips();
    } catch (error) {
      toast.error(readError(error, 'Could not delete the trip').message);
    }
  };

  const handleViewBookings = (tripId) => {
    navigate(`/manager/trips/${tripId}/bookings`);
  };

  return (
    <div className="manager-dashboard">
      <div className="container">
        <div className="dashboard-header">
          <h1>{user?.role === 'admin' ? 'All Trips (Admin)' : 'Manager Dashboard'}</h1>
          <Link to="/manager/trips/create" className="create-btn">
            Create New Trip
          </Link>
        </div>

        {loading ? (
          <div className="loading">Loading trips...</div>
        ) : trips.length === 0 ? (
          <div className="no-trips">
            <p>You haven't created any trips yet.</p>
            <Link to="/manager/trips/create" className="create-btn">
              Create Your First Trip
            </Link>
          </div>
        ) : (
          <div className="trips-grid">
            {trips.map(trip => {
              const imageUrl = getImageUrl(trip.image_url);
              return (
                <div key={trip.id} className="trip-card-manager">
                  <img src={imageUrl} alt={trip.name} className="trip-image" />
                  <div className="trip-content">
                    <div className="trip-title-row">
                      <h3>{trip.name}</h3>
                      {trip.status === 'cancelled' && <span className="trip-status-badge">Cancelled</span>}
                    </div>
                    <div className="trip-info">
                      <p><strong>Date:</strong> {formatDate(trip.date_available)}</p>
                      <p><strong>Location:</strong> {trip.location}</p>
                      <p><strong>Entry Fee:</strong> {trip.entry_fee} RO</p>
                      <p><strong>Booked:</strong> {trip.booked} / {trip.max_people} seats</p>
                    </div>
                    <div className="trip-actions">
                      <button
                        onClick={() => handleViewBookings(trip.id)}
                        className="btn btn-primary"
                      >
                        View Bookings
                      </button>
                      {trip.status === 'active' && (
                        <>
                          <Link
                            to={`/manager/trips/${trip.id}/edit`}
                            className="btn btn-secondary"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => setDeleteModal({ isOpen: true, trip })}
                            className="btn btn-danger"
                          >
                            {trip.booked > 0 ? 'Cancel Trip' : 'Delete'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, trip: null })}
        onConfirm={confirmDelete}
        title={deleteModal.trip?.booked > 0 ? 'Cancel Trip' : 'Delete Trip'}
        message={deleteModal.trip?.booked > 0
          ? `"${deleteModal.trip?.name}" has bookings. It will be cancelled (not deleted) and its bookings marked as cancelled, so the history is kept.`
          : `Delete "${deleteModal.trip?.name}"? This trip has no bookings and will be removed permanently.`}
        confirmText={deleteModal.trip?.booked > 0 ? 'Yes, Cancel Trip' : 'Yes, Delete'}
        cancelText="Keep Trip"
        type="danger"
      />
    </div>
  );
};

export default ManagerDashboard;

