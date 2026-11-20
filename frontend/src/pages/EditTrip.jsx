import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { readError } from '../services/api';
import { useToast } from '../components/Toast';

const FIELD_LABELS = { name: 'Trip name', image: 'Image', date_available: 'Date', location: 'Location', entry_fee: 'Entry fee', max_people: 'Max people' };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
import { getImageUrl } from '../utils/imageUtils';
import './EditTrip.css';

const EditTrip = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [fieldErrors, setFieldErrors] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    date_available: '',
    location: '',
    entry_fee: '',
    max_people: ''
  });
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [currentImage, setCurrentImage] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTrip();
  }, [id]);

  const fetchTrip = async () => {
    try {
      const response = await api.get(`/trips/${id}`);
      const trip = response.data.trip;
      setFormData({
        name: trip.name,
        date_available: trip.date_available,
        location: trip.location,
        entry_fee: trip.entry_fee,
        max_people: trip.max_people
      });
      setCurrentImage(getImageUrl(trip.image_url));
    } catch (error) {
      setError('Trip not found');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    // Quick checks for a friendly message. The server re-checks everything (it never trusts the client).
    if (file && !ALLOWED_TYPES.includes(file.type)) {
      setError('Please choose a JPEG, PNG or WebP image');
      e.target.value = '';
      return;
    }
    if (file && file.size > MAX_IMAGE_BYTES) {
      setError('The image must be 5 MB or smaller');
      e.target.value = '';
      return;
    }
    setError('');
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    try {
      setSubmitting(true);
      const data = new FormData();
      data.append('name', formData.name);
      data.append('date_available', formData.date_available);
      data.append('location', formData.location);
      data.append('entry_fee', formData.entry_fee);
      data.append('max_people', formData.max_people);
      if (image) {
        data.append('image', image);
      }

      await api.put(`/trips/${id}`, data, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Trip updated successfully');
      navigate('/manager/dashboard');
    } catch (error) {
      const { message, fields } = readError(error, 'Error updating trip');
      setError(message);
      setFieldErrors(fields);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="edit-trip-loading">Loading trip...</div>;
  }

  return (
    <div className="edit-trip">
      <div className="container">
        <h1>Edit Trip</h1>
        
        <form onSubmit={handleSubmit} className="trip-form">
          {error && (
            <div className="error-message">
              {error}
              {Object.keys(fieldErrors).length > 1 && (
                <ul className="field-error-list">
                  {Object.entries(fieldErrors).map(([f, m]) => <li key={f}><strong>{FIELD_LABELS[f] || f}:</strong> {m}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="form-group">
            <label>Trip Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Image</label>
            {currentImage && !imagePreview && (
              <img src={currentImage} alt="Current" className="current-image" />
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
            />
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Preview"
                className="image-preview"
                onError={() => {
                  // The browser could not decode it, so it is not a real image (the server would reject it too).
                  setImagePreview(null);
                  setImage(null);
                  setError('This file is not a valid image. Please choose a real JPEG, PNG or WebP photo.');
                }}
              />
            )}
            <small>Leave empty to keep current image</small>
          </div>

          <div className="form-group">
            <label>Date Available</label>
            <input
              type="date"
              name="date_available"
              value={formData.date_available}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Entry Fee (RO)</label>
              <input
                type="number"
                name="entry_fee"
                step="0.01"
                min="0"
                value={formData.entry_fee}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Max People</label>
              <input
                type="number"
                name="max_people"
                min="1"
                value={formData.max_people}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={submitting} className="submit-btn">
              {submitting ? 'Updating...' : 'Update Trip'}
            </button>
            <button 
              type="button" 
              onClick={() => navigate('/manager/dashboard')}
              className="cancel-btn"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTrip;

