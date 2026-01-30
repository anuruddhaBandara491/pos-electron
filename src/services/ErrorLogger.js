import log from 'electron-log';
import ErrorHandler from './ErrorHandler';

/**
 * Error Logger Service
 * 
 * Handles local logging of errors with rotation, sends critical errors
 * to backend, and tracks error metrics.
 */
class ErrorLogger {
  constructor(apiClient = null) {
    this.apiClient = apiClient;
    this.errorLog = [];
    this.maxLogSize = 500;
    this.errorReportUrl = '/api/errors/report';
    this.errorMetrics = {
      total: 0,
      byCategory: {},
      bySeverity: {},
      critical: []
    };

    // Configure electron-log
    if (typeof log !== 'undefined' && log.transports) {
      log.transports.file.level = 'info';
      log.transports.console.level = 'debug';
      log.transports.ipc = undefined; // Disable IPC transport
    }
  }

  /**
   * Log error with full context
   * @param {Error|Object} error - Error object
   * @param {string} context - Context/location of error
   * @param {Object} metadata - Additional metadata
   */
  error(error, context = '', metadata = {}) {
    const parsedError = ErrorHandler.parse(error);
    const formatted = ErrorHandler.formatForLog(parsedError, context);

    // Update metrics
    this._updateMetrics(parsedError);

    // Create log entry
    const logEntry = {
      ...formatted,
      metadata,
      id: this._generateErrorId(),
      reported: false
    };

    // Store in memory log
    this._addToLog(logEntry);

    // Log locally
    this._logLocally(logEntry);

    // Report critical errors to backend
    if (ErrorHandler.shouldReport(parsedError) && this.apiClient) {
      this._reportToBacked(parsedError, context, metadata);
    }

    return logEntry;
  }

  /**
   * Log warning
   * @param {string} message - Warning message
   * @param {string} context - Context
   * @param {Object} metadata - Additional metadata
   */
  warn(message, context = '', metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      context,
      metadata,
      id: this._generateErrorId()
    };

    this._addToLog(logEntry);
    this._logLocally(logEntry);
  }

  /**
   * Log info
   * @param {string} message - Info message
   * @param {string} context - Context
   * @param {Object} metadata - Additional metadata
   */
  info(message, context = '', metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      context,
      metadata,
      id: this._generateErrorId()
    };

    this._addToLog(logEntry);
    this._logLocally(logEntry);
  }

  /**
   * Log debug info
   * @param {string} message - Debug message
   * @param {string} context - Context
   * @param {Object} metadata - Additional metadata
   */
  debug(message, context = '', metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'debug',
      message,
      context,
      metadata,
      id: this._generateErrorId()
    };

    this._addToLog(logEntry);
    this._logLocally(logEntry);
  }

  /**
   * Get error metrics
   * @returns {Object} Error metrics
   */
  getMetrics() {
    return {
      ...this.errorMetrics,
      logSize: this.errorLog.length
    };
  }

  /**
   * Get recent errors
   * @param {number} count - Number of errors to return
   * @returns {Array} Recent error log entries
   */
  getRecentErrors(count = 10) {
    return this.errorLog.slice(-count).reverse();
  }

  /**
   * Clear error log
   */
  clearLog() {
    this.errorLog = [];
  }

  /**
   * Export error log
   * @returns {Array} Current error log
   */
  exportLog() {
    return JSON.parse(JSON.stringify(this.errorLog));
  }

  /**
   * Add entry to in-memory log with rotation
   * @private
   */
  _addToLog(entry) {
    this.errorLog.push(entry);

    // Rotate log if too large
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }
  }

  /**
   * Log to electron-log and console
   * @private
   */
  _logLocally(logEntry) {
    const prefix = `[${logEntry.context}]`;

    switch (logEntry.level || 'error') {
      case 'error':
        if (logEntry.code) {
          log.error(`${prefix} Error: ${logEntry.code}`, logEntry);
        } else {
          log.error(`${prefix} ${logEntry.message}`, logEntry);
        }
        break;
      case 'warn':
        log.warn(`${prefix} ${logEntry.message}`, logEntry.metadata);
        break;
      case 'info':
        log.info(`${prefix} ${logEntry.message}`, logEntry.metadata);
        break;
      case 'debug':
        log.debug(`${prefix} ${logEntry.message}`, logEntry.metadata);
        break;
    }
  }

  /**
   * Report critical error to backend
   * @private
   */
  async _reportToBacked(parsedError, context, metadata) {
    if (!this.apiClient) return;

    try {
      const report = ErrorHandler.formatForReport(parsedError, {
        context,
        userMetadata: metadata,
        logId: this._generateErrorId()
      });

      // Send to backend with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      await this.apiClient.post(this.errorReportUrl, report, {
        signal: controller.signal
      });

      clearTimeout(timeout);

      // Mark as reported
      const lastError = this.errorLog[this.errorLog.length - 1];
      if (lastError) {
        lastError.reported = true;
      }

      log.info('[ErrorLogger] Critical error reported to backend', report.code);
    } catch (err) {
      // Don't throw - just log locally
      log.warn('[ErrorLogger] Failed to report error to backend', err.message);
    }
  }

  /**
   * Update error metrics
   * @private
   */
  _updateMetrics(parsedError) {
    this.errorMetrics.total++;

    // By category
    const category = parsedError.category || 'unknown';
    this.errorMetrics.byCategory[category] = (this.errorMetrics.byCategory[category] || 0) + 1;

    // By severity
    const severity = parsedError.severity || 'unknown';
    this.errorMetrics.bySeverity[severity] = (this.errorMetrics.bySeverity[severity] || 0) + 1;

    // Track critical errors
    if (parsedError.severity === ErrorHandler.SEVERITY.CRITICAL) {
      this.errorMetrics.critical.push({
        code: parsedError.code,
        timestamp: new Date().toISOString(),
        message: parsedError.message
      });

      // Keep only last 20 critical errors
      if (this.errorMetrics.critical.length > 20) {
        this.errorMetrics.critical = this.errorMetrics.critical.slice(-20);
      }
    }
  }

  /**
   * Generate unique error ID
   * @private
   */
  _generateErrorId() {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default ErrorLogger;
