import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

// Pages
import Home from './pages/Home';
import Packages from './pages/Packages';
import Gallery from './pages/Gallery';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Booking from './pages/Booking';
import BookingConfirmation from './pages/BookingConfirmation';
import EditProfile from './pages/EditProfile';
import ManagerDashboard from './pages/ManagerDashboard';
import CreateTrip from './pages/CreateTrip';
import EditTrip from './pages/EditTrip';
import TripBookings from './pages/TripBookings';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <ToastProvider>
    <AuthProvider>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<Navigate to="/" replace />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/book/:tripId"
            element={
              <ProtectedRoute>
                <Booking />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/booking/confirmation"
            element={
              <ProtectedRoute>
                <BookingConfirmation />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/profile/edit"
            element={
              <ProtectedRoute>
                <EditProfile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/manager/dashboard"
            element={
              <ProtectedRoute requireRole="manager">
                <ManagerDashboard />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/manager/trips/create"
            element={
              <ProtectedRoute requireRole="manager">
                <CreateTrip />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/manager/trips/:id/edit"
            element={
              <ProtectedRoute requireRole="manager">
                <EditTrip />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/manager/trips/:tripId/bookings"
            element={
              <ProtectedRoute requireRole="manager">
                <TripBookings />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute requireRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
    </ToastProvider>
  );
}

export default App;

