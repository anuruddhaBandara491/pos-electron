import log from '../utils/logger';

/**
 * Standardized Error Handler
 * 
 * Parses backend errors, maps to user-friendly messages, categorizes errors,
 * and provides error context for logging and display.
 */
class ErrorHandler {
  /**
   * Error Categories
   */
  static CATEGORIES = {
    NETWORK: 'network',           // Network/connectivity errors
    VALIDATION: 'validation',     // Input validation errors
    AUTHENTICATION: 'authentication',  // Auth/session errors
    AUTHORIZATION: 'authorization',    // Permission errors
    NOT_FOUND: 'not_found',       // Resource not found
    CONFLICT: 'conflict',         // Data conflict/duplicate
    SERVER_ERROR: 'server_error', // 5xx server errors
    TIMEOUT: 'timeout',           // Request timeout
    BUSINESS_LOGIC: 'business_logic',  // Business rule violation
    OFFLINE: 'offline',           // Offline mode
    UNKNOWN: 'unknown'            // Unknown error
  };

  /**
   * Error Severity Levels
   */
  static SEVERITY = {
    INFO: 'info',           // Informational, no action needed
    WARNING: 'warning',     // Warning, user should be aware
    ERROR: 'error',         // Error, user action required
    CRITICAL: 'critical'    // Critical, data loss risk, report to backend
  };

  /**
   * Error Messages Dictionary
   */
  static MESSAGES = {
    // Network Errors
    'ERR_NETWORK': 'Network connection failed. Please check your internet connection.',
    'ENOTFOUND': 'Unable to connect to server. Please check your internet connection.',
    'ECONNREFUSED': 'Server is not responding. Please try again later.',
    'ETIMEDOUT': 'Request timed out. Please try again.',
    'ECONNRESET': 'Connection was reset. Please try again.',
    
    // HTTP Status Codes
    '400': 'Invalid request. Please check your input and try again.',
    '401': 'Your session has expired. Please log in again.',
    '403': 'You do not have permission to perform this action.',
    '404': 'The requested resource was not found.',
    '409': 'A conflict occurred. The item may have been modified by another user.',
    '429': 'Too many requests. Please wait a moment and try again.',
    '500': 'Server error. Please try again later.',
    '502': 'Bad gateway. The server is temporarily unavailable.',
    '503': 'Service unavailable. Please try again later.',
    '504': 'Gateway timeout. Please try again later.',
    
    // Validation Errors
    'VALIDATION_ERROR': 'Invalid input. Please check the highlighted fields.',
    'REQUIRED_FIELD': 'This field is required.',
    'INVALID_EMAIL': 'Please enter a valid email address.',
    'INVALID_PHONE': 'Please enter a valid phone number.',
    'INVALID_AMOUNT': 'Please enter a valid amount.',
    'INVALID_DATE': 'Please enter a valid date.',
    'MIN_LENGTH': 'This field must be at least {min} characters.',
    'MAX_LENGTH': 'This field cannot exceed {max} characters.',
    
    // Authentication/Authorization
    'INVALID_CREDENTIALS': 'Invalid username or password.',
    'SESSION_EXPIRED': 'Your session has expired. Please log in again.',
    'UNAUTHORIZED': 'You are not authorized to perform this action.',
    'INSUFFICIENT_PERMISSIONS': 'You do not have the required permissions.',
    'ACCOUNT_LOCKED': 'Your account has been locked. Please contact support.',
    'ACCOUNT_DISABLED': 'Your account is disabled. Please contact support.',
    
    // Business Logic
    'INSUFFICIENT_INVENTORY': 'Insufficient inventory. Only {available} items available.',
    'DUPLICATE_ORDER': 'An order with this ID already exists.',
    'INVALID_ORDER_STATE': 'This order cannot be modified in its current state.',
    'PAYMENT_ALREADY_PROCESSED': 'This payment has already been processed.',
    'INVALID_PAYMENT_AMOUNT': 'Payment amount exceeds the order total.',
    'MINIMUM_ORDER_AMOUNT': 'Order total must be at least {min}.',
    'MAXIMUM_ORDER_AMOUNT': 'Order total cannot exceed {max}.',
    'STORE_CLOSED': 'The store is currently closed.',
    'DISCOUNT_EXPIRED': 'This discount code has expired.',
    'DISCOUNT_INVALID': 'This discount code is not valid.',
    'PRODUCT_DISCONTINUED': 'This product is no longer available.',
    'PRODUCT_OUT_OF_STOCK': 'This product is currently out of stock.',
    
    // Offline
    'OFFLINE_MODE': 'Currently in offline mode. Changes will be synced when online.',
    'SYNC_FAILED': 'Failed to sync changes. Please check your connection.',
    
    // Generic
    'NETWORK_ERROR': 'A network error occurred. Please try again.',
    'SERVER_ERROR': 'A server error occurred. Please try again later.',
    'UNKNOWN_ERROR': 'An unexpected error occurred. Please try again.',
    'OPERATION_CANCELLED': 'Operation was cancelled.',
    'OPERATION_TIMEOUT': 'Operation timed out. Please try again.',
  };

  /**
   * Parse error from various sources (axios, native, etc.)
   * @param {Error|Object} error - Error object
   * @returns {Object} Parsed error object with metadata
   */
  static parse(error) {
    const parsed = {
      code: null,
      message: null,
      userMessage: null,
      category: this.CATEGORIES.UNKNOWN,
      severity: this.SEVERITY.ERROR,
      statusCode: null,
      data: null,
      stack: null,
      timestamp: new Date().toISOString(),
      context: {},
      isRecoverable: true
    };

    if (!error) {
      return {
        ...parsed,
        message: 'Unknown error',
        userMessage: this.MESSAGES.UNKNOWN_ERROR
      };
    }

    // Handle axios/HTTP errors
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data || {};

      parsed.statusCode = status;
      parsed.message = error.message;
      parsed.data = data;
      parsed.code = data.code || `HTTP_${status}`;
      parsed.stack = error.stack;

      // Categorize HTTP errors
      if (status === 400 || status === 422) {
        parsed.category = this.CATEGORIES.VALIDATION;
        parsed.severity = this.SEVERITY.ERROR;
        parsed.isRecoverable = true;
        parsed.userMessage = data.message || this.MESSAGES['400'];
      } else if (status === 401) {
        parsed.category = this.CATEGORIES.AUTHENTICATION;
        parsed.severity = this.SEVERITY.WARNING;
        parsed.isRecoverable = false;
        parsed.userMessage = this.MESSAGES['401'];
      } else if (status === 403) {
        parsed.category = this.CATEGORIES.AUTHORIZATION;
        parsed.severity = this.SEVERITY.ERROR;
        parsed.isRecoverable = false;
        parsed.userMessage = this.MESSAGES['403'];
      } else if (status === 404) {
        parsed.category = this.CATEGORIES.NOT_FOUND;
        parsed.severity = this.SEVERITY.WARNING;
        parsed.isRecoverable = true;
        parsed.userMessage = this.MESSAGES['404'];
      } else if (status === 409) {
        parsed.category = this.CATEGORIES.CONFLICT;
        parsed.severity = this.SEVERITY.ERROR;
        parsed.isRecoverable = true;
        parsed.userMessage = data.message || this.MESSAGES['409'];
      } else if (status === 429) {
        parsed.category = this.CATEGORIES.VALIDATION;
        parsed.severity = this.SEVERITY.WARNING;
        parsed.isRecoverable = true;
        parsed.userMessage = this.MESSAGES['429'];
      } else if (status >= 500) {
        parsed.category = this.CATEGORIES.SERVER_ERROR;
        parsed.severity = this.SEVERITY.CRITICAL;
        parsed.isRecoverable = true;
        parsed.userMessage = this.MESSAGES[String(status)] || this.MESSAGES['500'];
      }

      // Custom backend error handling
      if (data.code) {
        parsed.userMessage = this._getUserMessage(data.code, data.details);
      }
    }
    // Handle network errors
    else if (error.code) {
      parsed.code = error.code;
      parsed.message = error.message;
      parsed.stack = error.stack;

      switch (error.code) {
        case 'ENOTFOUND':
        case 'ERR_DNS_LOOKUP_SERVICE_NOT_AVAILABLE':
          parsed.category = this.CATEGORIES.NETWORK;
          parsed.severity = this.SEVERITY.WARNING;
          parsed.userMessage = this.MESSAGES.ENOTFOUND;
          break;
        case 'ECONNREFUSED':
          parsed.category = this.CATEGORIES.NETWORK;
          parsed.severity = this.SEVERITY.WARNING;
          parsed.userMessage = this.MESSAGES.ECONNREFUSED;
          break;
        case 'ETIMEDOUT':
          parsed.category = this.CATEGORIES.TIMEOUT;
          parsed.severity = this.SEVERITY.WARNING;
          parsed.userMessage = this.MESSAGES.ETIMEDOUT;
          break;
        case 'ECONNRESET':
          parsed.category = this.CATEGORIES.NETWORK;
          parsed.severity = this.SEVERITY.WARNING;
          parsed.userMessage = this.MESSAGES.ECONNRESET;
          break;
        case 'ERR_NETWORK':
          parsed.category = this.CATEGORIES.NETWORK;
          parsed.severity = this.SEVERITY.WARNING;
          parsed.userMessage = this.MESSAGES.ERR_NETWORK;
          break;
        default:
          parsed.category = this.CATEGORIES.NETWORK;
          parsed.severity = this.SEVERITY.WARNING;
          parsed.userMessage = this.MESSAGES.NETWORK_ERROR;
      }
    }
    // Handle standard JavaScript errors
    else if (error instanceof TypeError) {
      parsed.code = 'TYPE_ERROR';
      parsed.message = error.message;
      parsed.stack = error.stack;
      parsed.category = this.CATEGORIES.UNKNOWN;
      parsed.severity = this.SEVERITY.CRITICAL;
      parsed.userMessage = 'An application error occurred. Please restart the app.';
      parsed.isRecoverable = false;
    }
    // Handle string errors
    else if (typeof error === 'string') {
      parsed.message = error;
      parsed.userMessage = this._getUserMessage(error);
    }
    // Handle generic objects
    else if (typeof error === 'object') {
      parsed.message = error.message || JSON.stringify(error);
      parsed.code = error.code;
      parsed.stack = error.stack;
      parsed.data = error;
      parsed.userMessage = error.userMessage || this._getUserMessage(error.code);
    }

    // Default user message if not set
    if (!parsed.userMessage) {
      parsed.userMessage = this.MESSAGES.UNKNOWN_ERROR;
    }

    return parsed;
  }

  /**
   * Get user-friendly message for error code
   * @param {string} code - Error code
   * @param {Object} details - Additional details for message interpolation
   * @returns {string} User-friendly message
   */
  static _getUserMessage(code, details = {}) {
    let message = this.MESSAGES[code] || this.MESSAGES.UNKNOWN_ERROR;

    // Interpolate details into message
    if (details && typeof details === 'object') {
      Object.keys(details).forEach(key => {
        const placeholder = `{${key}}`;
        message = message.replace(placeholder, details[key]);
      });
    }

    return message;
  }

  /**
   * Check if error is recoverable
   * @param {Object} parsedError - Parsed error object
   * @returns {boolean} True if error is recoverable
   */
  static isRecoverable(parsedError) {
    return parsedError.isRecoverable !== false;
  }

  /**
   * Check if error should be reported to backend
   * @param {Object} parsedError - Parsed error object
   * @returns {boolean} True if error should be reported
   */
  static shouldReport(parsedError) {
    return parsedError.severity === this.SEVERITY.CRITICAL ||
           parsedError.statusCode >= 500;
  }

  /**
   * Format error for logging
   * @param {Object} parsedError - Parsed error object
   * @param {string} context - Additional context
   * @returns {Object} Formatted log entry
   */
  static formatForLog(parsedError, context = '') {
    return {
      timestamp: parsedError.timestamp,
      code: parsedError.code,
      category: parsedError.category,
      severity: parsedError.severity,
      statusCode: parsedError.statusCode,
      message: parsedError.message,
      stack: parsedError.stack,
      context: context,
      data: this._sanitizeData(parsedError.data),
      isRecoverable: parsedError.isRecoverable
    };
  }

  /**
   * Format error for user display
   * @param {Object} parsedError - Parsed error object
   * @returns {Object} User-friendly error display object
   */
  static formatForDisplay(parsedError) {
    return {
      title: this._getTitleForCategory(parsedError.category),
      message: parsedError.userMessage,
      severity: parsedError.severity,
      code: parsedError.code,
      isRecoverable: parsedError.isRecoverable,
      timestamp: parsedError.timestamp
    };
  }

  /**
   * Get title for error category
   * @param {string} category - Error category
   * @returns {string} Error title
   */
  static _getTitleForCategory(category) {
    const titles = {
      [this.CATEGORIES.NETWORK]: '⚠ Connection Error',
      [this.CATEGORIES.VALIDATION]: '⚠ Invalid Input',
      [this.CATEGORIES.AUTHENTICATION]: '🔐 Authentication Failed',
      [this.CATEGORIES.AUTHORIZATION]: '🔒 Access Denied',
      [this.CATEGORIES.NOT_FOUND]: '❌ Not Found',
      [this.CATEGORIES.CONFLICT]: '⚠ Conflict',
      [this.CATEGORIES.SERVER_ERROR]: '❌ Server Error',
      [this.CATEGORIES.TIMEOUT]: '⏱ Request Timeout',
      [this.CATEGORIES.BUSINESS_LOGIC]: '⚠ Operation Not Allowed',
      [this.CATEGORIES.OFFLINE]: '📡 Offline Mode',
      [this.CATEGORIES.UNKNOWN]: '❌ Error'
    };
    return titles[category] || titles[this.CATEGORIES.UNKNOWN];
  }

  /**
   * Sanitize error data for logging (remove sensitive info)
   * @param {Object} data - Error data
   * @returns {Object} Sanitized data
   */
  static _sanitizeData(data) {
    if (!data) return null;

    const sanitized = JSON.parse(JSON.stringify(data));
    const sensitiveKeys = ['password', 'token', 'authorization', 'apiKey', 'secret', 'creditCard'];

    const sanitizeObj = (obj) => {
      if (typeof obj !== 'object' || obj === null) return;
      Object.keys(obj).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          sanitizeObj(obj[key]);
        }
      });
    };

    sanitizeObj(sanitized);
    return sanitized;
  }

  /**
   * Format error for backend error report
   * @param {Object} parsedError - Parsed error object
   * @param {Object} context - Additional context (user, app, etc.)
   * @returns {Object} Backend error report payload
   */
  static formatForReport(parsedError, context = {}) {
    return {
      code: parsedError.code,
      message: parsedError.message,
      category: parsedError.category,
      severity: parsedError.severity,
      statusCode: parsedError.statusCode,
      stack: parsedError.stack,
      timestamp: parsedError.timestamp,
      context: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        url: typeof window !== 'undefined' ? window.location.href : null,
        ...context
      },
      data: this._sanitizeData(parsedError.data)
    };
  }
}

export default ErrorHandler;
