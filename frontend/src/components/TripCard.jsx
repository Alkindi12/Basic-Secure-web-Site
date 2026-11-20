import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getImageUrl } from '../utils/imageUtils';
import './TripCard.css';
import { formatDate } from '../utils/dateUtils';

const TripCard = ({ trip }) => {
  const { user } = useAuth();
  const imageUrl = getImageUrl(trip.image_url);

  return (
    <div className="trip-card">
      <img src={imageUrl} alt={trip.name} className="trip-image" />
      <div className="trip-content">
        <h3 className="trip-name">{trip.name}</h3>
        <div className="trip-details">
          <p><strong>Date:</strong> {formatDate(trip.date_available)}</p>
          <p><strong>Location:</strong> {trip.location}</p>
          <p><strong>Entry Fee:</strong> {trip.entry_fee} RO</p>
          <p><strong>Max People:</strong> {trip.max_people}</p>
          <p><strong>Available:</strong> {trip.current_available} spots</p>
        </div>
        {trip.current_available > 0 ? (
          <Link 
            to={user ? `/book/${trip.id}` : '/login'}
            className="book-btn"
          >
            Book Now
          </Link>
        ) : (
          <button className="book-btn disabled" disabled>
            Fully Booked
          </button>
        )}
      </div>
    </div>
  );
};

export default TripCard;

