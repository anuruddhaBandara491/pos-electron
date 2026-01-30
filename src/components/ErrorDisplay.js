import React from 'react';
import ErrorHandler from '../services/ErrorHandler';
import '../styles/ErrorDisplay.css';

/**
 * Error Modal Component
 * 
 * Displays error information to user with dismiss/retry options
 */
export function ErrorModal({ error, displayError, onDismiss, onRetry }) {
  if (!error || !displayError) {
    return null;
  }

  const isNetworkError = error.category === ErrorHandler.CATEGORIES.NETWORK;
  const isAuthError = error.category === ErrorHandler.CATEGORIES.AUTHENTICATION;

  return (
    <div className="error-modal-overlay">
      <div className={`error-modal error-modal-${displayError.severity}`}>
        <button
          className="error-modal-close"
          onClick={onDismiss}
          title="Close"
        >
          ✕
        </button>

        <div className="error-modal-header">
          <span className="error-modal-icon">{displayError.title.split(' ')[0]}</span>
          <h2 className="error-modal-title">{displayError.title}</h2>
        </div>

        <div className="error-modal-body">
          <p className="error-modal-message">{displayError.message}</p>

          {error.code && (
            <p className="error-modal-code">Error Code: {error.code}</p>
          )}

          {error.statusCode && (
            <p className="error-modal-status">HTTP Status: {error.statusCode}</p>
          )}

          {displayError.severity === ErrorHandler.SEVERITY.CRITICAL && (
            <div className="error-modal-critical">
              <strong>Critical Error:</strong> This error has been reported to our support team.
            </div>
          )}
        </div>

        <div className="error-modal-footer">
          <button
            className="error-modal-btn error-modal-btn-primary"
            onClick={onDismiss}
          >
            Dismiss
          </button>

          {isNetworkError && (
            <button
              className="error-modal-btn error-modal-btn-secondary"
              onClick={onRetry}
              title="Try the operation again"
            >
              Retry
            </button>
          )}

          {isAuthError && (
            <button
              className="error-modal-btn error-modal-btn-secondary"
              onClick={() => window.location.href = '/login'}
              title="Return to login"
            >
              Login Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Error Toast/Notification Component
 * 
 * Displays error as temporary toast notification
 */
export function ErrorToast({ error, displayError, onDismiss, duration = 5000 }) {
  const [show, setShow] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      onDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  if (!error || !displayError || !show) {
    return null;
  }

  return (
    <div className={`error-toast error-toast-${displayError.severity}`}>
      <span className="error-toast-icon">⚠</span>
      <span className="error-toast-message">{displayError.message}</span>
      <button
        className="error-toast-close"
        onClick={() => {
          setShow(false);
          onDismiss();
        }}
      >
        ✕
      </button>
    </div>
  );
}

/**
 * Error Banner Component
 * 
 * Displays error as banner at top of page
 */
export function ErrorBanner({ error, displayError, onDismiss, onRetry }) {
  if (!error || !displayError) {
    return null;
  }

  const isRecoverable = error.isRecoverable !== false;

  return (
    <div className={`error-banner error-banner-${displayError.severity}`}>
      <div className="error-banner-content">
        <div className="error-banner-icon">⚠</div>
        <div className="error-banner-text">
          <strong>{displayError.title}</strong>
          <p>{displayError.message}</p>
        </div>
        <div className="error-banner-actions">
          {isRecoverable && onRetry && (
            <button
              className="error-banner-btn error-banner-btn-retry"
              onClick={onRetry}
            >
              Retry
            </button>
          )}
          <button
            className="error-banner-btn error-banner-btn-close"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline Error Component
 * 
 * Displays error inline in a form or section
 */
export function ErrorInline({ error, displayError, compact = false }) {
  if (!error || !displayError) {
    return null;
  }

  if (compact) {
    return (
      <div className="error-inline error-inline-compact">
        <span className="error-inline-icon">⚠</span>
        <span className="error-inline-message">{displayError.message}</span>
      </div>
    );
  }

  return (
    <div className="error-inline error-inline-full">
      <div className="error-inline-title">{displayError.title}</div>
      <div className="error-inline-message">{displayError.message}</div>
      {error.code && (
        <div className="error-inline-code">Code: {error.code}</div>
      )}
    </div>
  );
}

/**
 * Validation Error Component
 * 
 * Displays field validation errors
 */
export function ValidationErrors({ errors = {} }) {
  const errorCount = Object.keys(errors).length;

  if (errorCount === 0) {
    return null;
  }

  return (
    <div className="validation-errors">
      <div className="validation-errors-header">
        ⚠ Please fix {errorCount} error{errorCount !== 1 ? 's' : ''}:
      </div>
      <ul className="validation-errors-list">
        {Object.entries(errors).map(([field, message]) => (
          <li key={field} className="validation-error-item">
            <strong>{field}:</strong> {message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ErrorModal;
