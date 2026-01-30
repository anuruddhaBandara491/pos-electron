import { useState, useCallback, useRef, useEffect } from 'react';
import React from 'react';
import ErrorHandler from '../services/ErrorHandler';
import ErrorLogger from '../services/ErrorLogger';

/**
 * React Hook for Error Handling
 * 
 * Provides centralized error management for components including:
 * - Error state management
 * - Error display/dismissal
 * - Error logging
 * - Error recovery
 */
export function useErrorHandler(errorLogger = null) {
  const [error, setError] = useState(null);
  const [displayError, setDisplayError] = useState(null);
  const errorLoggerRef = useRef(errorLogger);
  const errorCountRef = useRef(0);

  /**
   * Handle and display error
   * @param {Error|Object} err - Error object
   * @param {string} context - Context/location
   * @param {Object} metadata - Additional metadata
   */
  const handleError = useCallback((err, context = '', metadata = {}) => {
    const parsedError = ErrorHandler.parse(err);
    const displayObj = ErrorHandler.formatForDisplay(parsedError);

    // Log error
    if (errorLoggerRef.current) {
      errorLoggerRef.current.error(err, context, metadata);
    }

    // Set internal state
    setError(parsedError);
    setDisplayError(displayObj);

    // Track error count
    errorCountRef.current++;

    // Prevent app crash if too many errors
    if (errorCountRef.current > 10) {
      console.error('[useErrorHandler] Too many errors, preventing cascade');
      // Reset counter after 5 seconds
      setTimeout(() => {
        errorCountRef.current = 0;
      }, 5000);
    }

    return parsedError;
  }, []);

  /**
   * Dismiss/clear error
   */
  const clearError = useCallback(() => {
    setError(null);
    setDisplayError(null);
  }, []);

  /**
   * Retry operation with error handling
   * @param {Function} operation - Async operation to retry
   * @param {number} maxRetries - Max retry attempts
   * @param {number} delayMs - Delay between retries
   * @returns {Promise} Operation result
   */
  const retryOperation = useCallback(async (operation, maxRetries = 3, delayMs = 1000) => {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        errorCountRef.current = 0; // Reset on success
        return result;
      } catch (err) {
        lastError = err;

        if (attempt < maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        } else {
          // Last attempt failed
          handleError(err, 'retryOperation', { attempt, maxRetries });
        }
      }
    }

    throw lastError;
  }, [handleError]);

  /**
   * Wrap async function with error handling
   * @param {Function} asyncFn - Async function
   * @param {string} context - Context
   * @returns {Function} Wrapped function
   */
  const wrapAsync = useCallback((asyncFn, context = '') => {
    return async (...args) => {
      try {
        return await asyncFn(...args);
      } catch (err) {
        handleError(err, context || asyncFn.name || 'unknownFunction');
        throw err;
      }
    };
  }, [handleError]);

  /**
   * Check if error is recoverable
   */
  const isRecoverable = useCallback(() => {
    return error ? ErrorHandler.isRecoverable(error) : true;
  }, [error]);

  /**
   * Reset error count
   */
  const resetErrorCount = useCallback(() => {
    errorCountRef.current = 0;
  }, []);

  /**
   * Get error count
   */
  const getErrorCount = useCallback(() => {
    return errorCountRef.current;
  }, []);

  return {
    // State
    error,
    displayError,
    
    // Methods
    handleError,
    clearError,
    retryOperation,
    wrapAsync,
    isRecoverable,
    resetErrorCount,
    getErrorCount,

    // Helpers
    hasError: !!error,
    isCritical: error?.severity === ErrorHandler.SEVERITY.CRITICAL,
    isNetworkError: error?.category === ErrorHandler.CATEGORIES.NETWORK,
    isAuthError: error?.category === ErrorHandler.CATEGORIES.AUTHENTICATION,
    isValidationError: error?.category === ErrorHandler.CATEGORIES.VALIDATION
  };
}

/**
 * Error Boundary Component
 * 
 * Catches React component errors and prevents app crash
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
    this.errorLogger = props.errorLogger || null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const parsedError = ErrorHandler.parse(error);

    this.setState({
      error,
      errorInfo
    });

    // Log to error logger
    if (this.errorLogger) {
      this.errorLogger.error(error, 'ErrorBoundary', {
        componentStack: errorInfo.componentStack
      });
    }

    // Log to console
    console.error('[ErrorBoundary] React component error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Use custom fallback or default
      if (fallback) {
        return fallback(error, this.handleReset);
      }

      const parsedError = ErrorHandler.parse(error);
      const displayObj = ErrorHandler.formatForDisplay(parsedError);

      return (
        <div style={{
          padding: '20px',
          margin: '20px',
          border: '2px solid #e74c3c',
          borderRadius: '4px',
          backgroundColor: '#fadbd8',
          color: '#c0392b'
        }}>
          <h2 style={{ marginTop: 0 }}>{displayObj.title}</h2>
          <p>{displayObj.message}</p>
          <p style={{ fontSize: '12px', color: '#666' }}>
            Error Code: {displayObj.code || 'UNKNOWN'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '8px 16px',
              backgroundColor: '#c0392b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload App
          </button>
        </div>
      );
    }

    return children;
  }
}

// Make ErrorBoundary a proper React component
ErrorBoundary.prototype.isReactComponent = true;

export default useErrorHandler;
