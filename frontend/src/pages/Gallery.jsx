import { useState, useEffect } from 'react';
import api from '../services/api';
import { getImageUrl } from '../utils/imageUtils';
import './Gallery.css';

const Gallery = () => {
  const [trips, setTrips] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      const response = await api.get('/trips', { params: { limit: 50 } });
      setTrips(response.data.trips);
    } catch (error) {
      // the gallery simply stays empty if trips cannot be loaded
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="gallery-loading">Loading gallery...</div>;
  }

  return (
    <div className="gallery">
      <div className="container">
        <h1>Photo Gallery</h1>
        <p className="gallery-subtitle">Photos from our amazing trips</p>
        
        <div className="gallery-grid">
          {trips.map(trip => {
            const imageUrl = getImageUrl(trip.image_url);
            return (
              <div
                key={trip.id}
                className="gallery-item"
                onClick={() => setSelectedImage({ url: imageUrl, name: trip.name })}
              >
                <img src={imageUrl} alt={trip.name} />
                <div className="gallery-overlay">
                  <p>{trip.name}</p>
                </div>
              </div>
            );
          })}
        </div>

        {selectedImage && (
          <div className="lightbox" onClick={() => setSelectedImage(null)}>
            <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
              <button className="lightbox-close" onClick={() => setSelectedImage(null)}>×</button>
              <img src={selectedImage.url} alt={selectedImage.name} />
              <p>{selectedImage.name}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Gallery;

