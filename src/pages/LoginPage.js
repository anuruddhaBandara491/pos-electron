import React, { useState } from 'react';
import '../styles/LoginPage.css';

/**
 * Login Page Component
 * Handles user authentication with email, password, and device name
 */
export default function LoginPage({ onLogin, error: externalError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(externalError || null);
  const [fieldErrors, setFieldErrors] = useState({});

  const validateForm = () => {
    const errors = {};
    
    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    if (!deviceName.trim()) {
      errors.deviceName = 'Device name is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      await onLogin(email.trim(), password, deviceName.trim());
    } catch (err) {
      // Error is already handled by parent component
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (field) => {
    setFieldErrors(prev => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>POS System</h1>
          <p>Point of Sale Desktop Application</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                handleFieldChange('email');
              }}
              placeholder="Enter your email"
              required
              disabled={isLoading}
              className={fieldErrors.email ? 'input-error' : ''}
            />
            {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                handleFieldChange('password');
              }}
              placeholder="Enter your password"
              required
              disabled={isLoading}
              className={fieldErrors.password ? 'input-error' : ''}
            />
            {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="deviceName">Device Name</label>
            <input
              id="deviceName"
              type="text"
              value={deviceName}
              onChange={(e) => {
                setDeviceName(e.target.value);
                handleFieldChange('deviceName');
              }}
              placeholder="e.g., Terminal 1, Register A"
              required
              disabled={isLoading}
              className={fieldErrors.deviceName ? 'input-error' : ''}
            />
            {fieldErrors.deviceName && <span className="field-error">{fieldErrors.deviceName}</span>}
            <small>This device name will be used to track orders and transactions</small>
          </div>

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          <p>Secure Connection • Production Ready</p>
        </div>
      </div>
    </div>
  );
}
