import './SessionWarningModal.css';

const SessionWarningModal = ({ isOpen, onStayLoggedIn, onLogout, timeRemaining }) => {
  if (!isOpen) return null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="session-warning-overlay">
      <div className="session-warning-content">
        <div className="session-warning-header">
          <div className="session-warning-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" fill="rgba(245, 158, 11, 0.1)" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
        <div className="session-warning-body">
          <h3 className="session-warning-title">Session Expiring Soon</h3>
          <p className="session-warning-message">
            Your session will expire in <strong>{timeString}</strong> due to inactivity.
            Would you like to stay logged in?
          </p>
        </div>
        <div className="session-warning-footer">
          <button className="session-warning-btn session-warning-btn-secondary" onClick={onLogout}>
            Logout
          </button>
          <button className="session-warning-btn session-warning-btn-primary" onClick={onStayLoggedIn}>
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionWarningModal;

