import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Signup.css';

const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordRequirements, setPasswordRequirements] = useState({
    length: false,
    notEmail: false,
    notRepeated: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  // Sanitization function
  const sanitizeInput = (input) => {
    return input.trim().replace(/[<>]/g, '');
  };

  // Validation functions
  const validateName = (value) => {
    const sanitized = sanitizeInput(value);
    if (!sanitized) {
      setNameError('Name is required');
      return false;
    }
    if (sanitized.length < 2) {
      setNameError('Name must be at least 2 characters');
      return false;
    }
    if (sanitized.length > 50) {
      setNameError('Name must be less than 50 characters');
      return false;
    }
    if (!/^[a-zA-Z\s'-]+$/.test(sanitized)) {
      setNameError('Name can only contain letters, spaces, hyphens, and apostrophes');
      return false;
    }
    setNameError('');
    return true;
  };

  const validateEmail = (value) => {
    const sanitized = sanitizeInput(value);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!sanitized) {
      setEmailError('Email is required');
      return false;
    }
    if (!emailRegex.test(sanitized)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    if (sanitized.length > 100) {
      setEmailError('Email must be less than 100 characters');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (value) => {
    // Same rules as the server (NIST SP 800-63B): length matters more than symbols.
    // The server also rejects common passwords such as "password123".
    const requirements = {
      length: value.length >= 8 && value.length <= 64,
      notEmail: !!value && value.toLowerCase() !== email.trim().toLowerCase(),
      notRepeated: !!value && !/^(.)\1+$/.test(value)
    };
    setPasswordRequirements(requirements);
    
    if (!value) {
      setPasswordError('');
      return false;
    }
    
    const allMet = Object.values(requirements).every(req => req === true);
    if (!allMet) {
      setPasswordError('Password does not meet all requirements');
      return false;
    }
    
    setPasswordError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setPasswordError('');
    setLoading(true);

    // Validate all fields
    const isNameValid = validateName(name);
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isNameValid || !isEmailValid || !isPasswordValid) {
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Sanitize inputs before sending
    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = sanitizeInput(email);

    const result = await register(sanitizedName, sanitizedEmail, password);
    
    if (result.success) {
      navigate('/packages');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    setName(value);
    if (value) {
      validateName(value);
    } else {
      setNameError('');
    }
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    if (value) {
      validateEmail(value);
    } else {
      setEmailError('');
    }
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);
    validatePassword(value);
    
    if (confirmPassword && value !== confirmPassword) {
      setPasswordError('Passwords do not match');
    } else if (confirmPassword && value === confirmPassword) {
      setPasswordError('');
    }
  };

  const handleConfirmPasswordChange = (e) => {
    const value = e.target.value;
    setConfirmPassword(value);
    
    if (value && password && value !== password) {
      setPasswordError('Passwords do not match');
    } else if (value && password && value === password) {
      setPasswordError('');
    } else {
      setPasswordError('');
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-container">
        <h2>Create Account</h2>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={handleNameChange}
              onBlur={() => validateName(name)}
              required
              maxLength={50}
              className={nameError ? 'input-error' : ''}
            />
            {nameError && (
              <small className="error-text">{nameError}</small>
            )}
          </div>
          <div className="form-group">
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={handleEmailChange}
              onBlur={() => validateEmail(email)}
              required
              maxLength={100}
              className={emailError ? 'input-error' : ''}
            />
            {emailError && (
              <small className="error-text">{emailError}</small>
            )}
          </div>
          <div className="form-group">
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={handlePasswordChange}
                onBlur={() => validatePassword(password)}
                required
                className={passwordError ? 'input-error' : ''}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
                    <path d="M1 1l22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
                  </svg>
                )}
              </button>
            </div>
            {password && (
              <div className="password-requirements">
                <small className={passwordRequirements.length ? 'requirement-met' : 'requirement-unmet'}>
                  {passwordRequirements.length ? '✓' : '○'} 8 to 64 characters
                </small>
                <small className={passwordRequirements.notEmail ? 'requirement-met' : 'requirement-unmet'}>
                  {passwordRequirements.notEmail ? '✓' : '○'} Not the same as your email
                </small>
                <small className={passwordRequirements.notRepeated ? 'requirement-met' : 'requirement-unmet'}>
                  {passwordRequirements.notRepeated ? '✓' : '○'} Not one repeated character
                </small>
                <small className="requirement-tip">Tip: a short phrase like "camel-sunset-wadi" is long and easy to remember. Common passwords are rejected.</small>
              </div>
            )}
            {passwordError && !password && (
              <small className="error-text">{passwordError}</small>
            )}
          </div>
          <div className="form-group">
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                required
                className={passwordError && confirmPassword ? 'input-error' : ''}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
                    <path d="M1 1l22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
                  </svg>
                )}
              </button>
            </div>
            {passwordError && confirmPassword && (
              <small className="error-text">{passwordError}</small>
            )}
          </div>
          <button type="submit" disabled={loading || passwordError} className="submit-btn">
            {loading ? 'Creating account...' : 'SIGN UP'}
          </button>
        </form>
        <p className="login-link">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;


