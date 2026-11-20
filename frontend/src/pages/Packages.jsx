import { useState, useEffect } from 'react';
import api, { readError } from '../services/api';
import { useToast } from '../components/Toast';

const PAGE_SIZE = 12;
import TripCard from '../components/TripCard';
import './Packages.css';

const Packages = () => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [locations, setLocations] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const toast = useToast();

  useEffect(() => {
    // small delay so we do not call the API on every keystroke
    const t = setTimeout(() => fetchTrips(1), 250);
    return () => clearTimeout(t);
  }, [search, locationFilter, minPrice, maxPrice]);

  const fetchTrips = async (pageToLoad = 1) => {
    try {
      if (pageToLoad === 1) setLoading(true); else setLoadingMore(true);
      const params = { page: pageToLoad, limit: PAGE_SIZE };
      if (search) params.search = search;
      if (locationFilter) params.location = locationFilter;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;

      const response = await api.get('/trips', { params });
      setTrips((prev) => (pageToLoad === 1 ? response.data.trips : [...prev, ...response.data.trips]));
      setLocations(response.data.locations || []);
      setTotal(response.data.total || 0);
      setPage(pageToLoad);
    } catch (error) {
      toast.error(readError(error, 'Could not load trips').message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const uniqueLocations = locations;

  return (
    <div className="packages">
      <div className="container">
        <h1>Our Packages</h1>
        
        <div className="filters">
          <input
            type="text"
            placeholder="Search trips..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Locations</option>
            {uniqueLocations.map(location => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Min Price"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="price-input"
          />
          <input
            type="number"
            placeholder="Max Price"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="price-input"
          />
        </div>

        {loading ? (
          <div className="loading">Loading trips...</div>
        ) : trips.length === 0 ? (
          <div className="no-trips">No trips found</div>
        ) : (
          <div className="trips-grid">
            {trips.map(trip => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        )}
        {!loading && trips.length < total && (
          <div className="load-more-row">
            <button className="load-more-btn" onClick={() => fetchTrips(page + 1)} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : `Show more trips (${total - trips.length} left)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Packages;




