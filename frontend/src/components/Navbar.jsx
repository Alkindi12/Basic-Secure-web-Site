import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleAboutClick = (e) => {
    e.preventDefault();
    if (location.pathname === '/') {
      // If already on home page, scroll to about section
      setTimeout(() => {
        const aboutSection = document.getElementById('about-section');
        if (aboutSection) {
          aboutSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 50);
    } else {
      // Navigate to home and then scroll
      navigate('/');
      setTimeout(() => {
        const aboutSection = document.getElementById('about-section');
        if (aboutSection) {
          aboutSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 300);
    }
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          <svg 
            className="logo-icon" 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" 
              fill="currentColor"
            />
          </svg>
          Tourly
        </Link>
        <ul className="nav-menu">
          <li><Link to="/">Home</Link></li>
          <li><a href="#about-section" onClick={handleAboutClick}>About Us</a></li>
          <li><Link to="/packages">Packages</Link></li>
          <li><Link to="/gallery">Gallery</Link></li>
          {user ? (
            <>
              <li><Link to="/dashboard">Dashboard</Link></li>
              {user.role === 'manager' || user.role === 'admin' ? (
                <li><Link to="/manager/dashboard">Manager</Link></li>
              ) : null}
              {user.role === 'admin' ? (
                <li><Link to="/admin/dashboard">Admin</Link></li>
              ) : null}
              <li>
                <span className="user-name">{user.name}</span>
                <button onClick={handleLogout} className="logout-btn">Logout</button>
              </li>
            </>
          ) : (
            <li><Link to="/login">Login/Signup</Link></li>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;

