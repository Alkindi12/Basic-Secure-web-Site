import { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import api, { setCsrfToken, setSessionExpiredHandler } from '../services/api';
import SessionWarningModal from '../components/SessionWarningModal';
import { useToast } from '../components/Toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

/*
 * Inactivity handling (UX only: the SERVER enforces the real idle and absolute timeouts).
 * Must match SESSION_IDLE_MINUTES on the backend (default 30). U-02: v1 shipped with 1 minute.
 */
const IDLE_MINUTES = Number(import.meta.env.VITE_SESSION_IDLE_MINUTES) || 30;
const INACTIVITY_TIMEOUT = IDLE_MINUTES * 60 * 1000;
const WARNING_BEFORE = Math.min(5 * 60 * 1000, INACTIVITY_TIMEOUT * 0.2); // warn 5 min before (or 20%)
const KEEPALIVE_EVERY = Math.min(5 * 60 * 1000, INACTIVITY_TIMEOUT / 3);   // tell the server we are active
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

export const AuthProvider = ({ children }) => {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const timers = useRef({ idle: null, warn: null, countdown: null });
  const warningShown = useRef(false);
  const lastActivity = useRef(0);
  const lastPing = useRef(Date.now());
  const userRef = useRef(null);
  useEffect(() => { userRef.current = user; }, [user]);

  const clearTimers = useCallback(() => {
    const t = timers.current;
    clearTimeout(t.idle); clearTimeout(t.warn); clearInterval(t.countdown);
    timers.current = { idle: null, warn: null, countdown: null };
    warningShown.current = false;
    setShowWarning(false);
    setTimeRemaining(0);
  }, []);

  const endLocalSession = useCallback((message) => {
    clearTimers();
    setCsrfToken(null);
    if (userRef.current && message) toast.info(message);
    setUser(null);
  }, [clearTimers, toast]);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* the local session ends anyway */ }
    endLocalSession();
    return { success: true };
  }, [endLocalSession]);

  const startTimers = useCallback(() => {
    clearTimers();
    timers.current.warn = setTimeout(() => {
      warningShown.current = true;
      setShowWarning(true);
      setTimeRemaining(Math.round(WARNING_BEFORE / 1000));
      timers.current.countdown = setInterval(() => {
        setTimeRemaining((s) => (s <= 1 ? 0 : s - 1));
      }, 1000);
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE);
    timers.current.idle = setTimeout(async () => {
      try { await api.post('/auth/logout'); } catch { /* ignore */ }
      endLocalSession('You were logged out after a period of inactivity.');
    }, INACTIVITY_TIMEOUT);
  }, [clearTimers, endLocalSession]);

  // Session ended by the server (expired, revoked after a password change, …)
  useEffect(() => {
    setSessionExpiredHandler((message) => endLocalSession(message || 'Your session has ended. Please log in again.'));
    return () => setSessionExpiredHandler(null);
  }, [endLocalSession]);

  useEffect(() => {
    api.get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const handleActivity = useCallback(() => {
    if (warningShown.current) return; // keep the countdown visible until the user decides
    const now = Date.now();
    if (now - lastActivity.current < 1000) return;
    lastActivity.current = now;
    startTimers();
    // Activity without API calls would not refresh the server's idle timer, so ping it now and then.
    if (now - lastPing.current > KEEPALIVE_EVERY) {
      lastPing.current = now;
      api.get('/auth/me').catch(() => {});
    }
  }, [startTimers]);

  useEffect(() => {
    if (!user) { clearTimers(); return undefined; }
    lastPing.current = Date.now();
    startTimers();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handleActivity, true));
    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handleActivity, true));
    };
  }, [user, startTimers, clearTimers, handleActivity]);

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      setUser(res.data.user);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Login failed', fields: error.response?.data?.details || {} };
    }
  };

  const register = async (name, email, password) => {
    try {
      const res = await api.post('/auth/register', { name, email, password });
      setUser(res.data.user);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Registration failed', fields: error.response?.data?.details || {} };
    }
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
    } catch {
      setUser(null);
    }
  };

  const handleStayLoggedIn = useCallback(async () => {
    clearTimers();
    lastPing.current = Date.now();
    try { await api.get('/auth/me'); } catch { /* handled by the interceptor */ }
    if (userRef.current) startTimers();
  }, [clearTimers, startTimers]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, setUser }}>
      {children}
      <SessionWarningModal
        isOpen={showWarning}
        onStayLoggedIn={handleStayLoggedIn}
        onLogout={logout}
        timeRemaining={timeRemaining}
      />
    </AuthContext.Provider>
  );
};
