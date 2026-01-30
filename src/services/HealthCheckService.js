import log from '../utils/logger';

/**
 * Health Check Service
 * Monitors backend availability and manages connection status
 * 
 * Responsibilities:
 * - Initial health check on app startup
 * - Periodic health checks (default: every 30 seconds)
 * - Exponential backoff retry on failures
 * - Status tracking (online/offline/checking)
 * - Status change notifications
 * - Prevents duplicate health checks
 */
class HealthCheckService {
  constructor() {
    this.isHealthy = false;
    this.isChecking = false;
    this.lastCheckTime = null;
    this.failureCount = 0;
    this.maxRetries = 3;
    this.baseRetryDelay = 2000; // 2 seconds
    this.checkInterval = 30000; // 30 seconds
    this.timeoutDuration = 5000; // 5 second timeout
    this.statusChangeListeners = [];
    this.healthCheckTimer = null;
  }

  /**
   * Initialize health check service
   * Perform initial check and start periodic checks
   * @returns {Promise<boolean>} Whether backend is initially healthy
   */
  async initialize() {
    try {
      log.info('Initializing health check service');
      
      // Perform initial health check
      const isHealthy = await this.performHealthCheck();
      
      // Start periodic health checks
      this.startPeriodicChecks();
      
      log.info(`Health check initialized. Backend status: ${isHealthy ? 'ONLINE' : 'OFFLINE'}`);
      return isHealthy;
    } catch (err) {
      log.error('Health check initialization failed:', err.message);
      this.setHealth(false);
      this.startPeriodicChecks();
      return false;
    }
  }

  /**
   * Perform a health check by calling backend /health endpoint
   * Includes retry logic with exponential backoff
   * @private
   * @returns {Promise<boolean>} Whether backend is healthy
   */
  async performHealthCheck() {
    // Prevent duplicate concurrent checks
    if (this.isChecking) {
      return this.isHealthy;
    }

    try {
      this.isChecking = true;
      const startTime = Date.now();

      log.debug('Performing health check...');

      // Call backend health endpoint
      const response = await this._callHealthEndpoint();
      
      const duration = Date.now() - startTime;
      log.info(`Health check passed in ${duration}ms`);

      // Reset retry counter on success
      this.failureCount = 0;
      this.lastCheckTime = new Date();
      this.setHealth(true);

      return true;
    } catch (err) {
      this.failureCount++;
      this.lastCheckTime = new Date();

      log.warn(
        `Health check failed (attempt ${this.failureCount}/${this.maxRetries}): ${err.message}`
      );

      // After max retries, mark as unhealthy
      if (this.failureCount >= this.maxRetries) {
        this.setHealth(false);
        this.failureCount = this.maxRetries; // Don't exceed max
      }

      return false;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Call the backend /health endpoint
   * @private
   * @returns {Promise<Object>} Health check response
   */
  async _callHealthEndpoint() {
    try {
      // Use IPC to call the backend via main process
      if (window.pos && window.pos.health) {
        const response = await Promise.race([
          window.pos.health.check(),
          this._createTimeout(this.timeoutDuration)
        ]);

        if (!response.ok) {
          throw new Error(`Health check returned status ${response.status || 'unknown'}`);
        }

        return response;
      } else {
        throw new Error('Health check IPC handler not available');
      }
    } catch (err) {
      throw new Error(`Health endpoint call failed: ${err.message}`);
    }
  }

  /**
   * Create a timeout promise
   * @private
   * @param {number} ms - Timeout duration in milliseconds
   * @returns {Promise} Rejects after timeout
   */
  _createTimeout(ms) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Health check timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * Start periodic health checks
   * @private
   */
  startPeriodicChecks() {
    if (this.healthCheckTimer) {
      return; // Already running
    }

    log.info(`Starting periodic health checks every ${this.checkInterval}ms`);

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.checkInterval);

    // Allow timer to be garbage collected when electron app exits
    if (this.healthCheckTimer.unref) {
      this.healthCheckTimer.unref();
    }
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicChecks() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      log.info('Stopped periodic health checks');
    }
  }

  /**
   * Manually trigger a health check (doesn't wait for periodic interval)
   * Useful when resuming from offline mode or after user action
   * @returns {Promise<boolean>} Whether backend is healthy
   */
  async checkNow() {
    log.debug('Manual health check triggered');
    return await this.performHealthCheck();
  }

  /**
   * Set health status and notify listeners
   * @private
   * @param {boolean} healthy - Whether backend is healthy
   */
  setHealth(healthy) {
    const previousStatus = this.isHealthy;
    this.isHealthy = healthy;

    // Only notify if status changed
    if (previousStatus !== healthy) {
      log.info(`Backend status changed: ${previousStatus ? 'ONLINE' : 'OFFLINE'} → ${healthy ? 'ONLINE' : 'OFFLINE'}`);
      this.notifyStatusChange(healthy);
    }
  }

  /**
   * Get current health status
   * @returns {Object} Health status object
   */
  getStatus() {
    return {
      isHealthy: this.isHealthy,
      isChecking: this.isChecking,
      lastCheckTime: this.lastCheckTime,
      failureCount: this.failureCount,
      failureStreak: this.failureCount > 0 ? this.failureCount : 0
    };
  }

  /**
   * Get health status as a string for UI display
   * @returns {string} Status string ('online', 'offline', 'checking')
   */
  getStatusString() {
    if (this.isChecking) return 'checking';
    return this.isHealthy ? 'online' : 'offline';
  }

  /**
   * Check if backend is healthy
   * @returns {boolean} True if backend is accessible
   */
  isBackendHealthy() {
    return this.isHealthy;
  }

  /**
   * Check if we're currently performing a health check
   * @returns {boolean} True if health check is in progress
   */
  isHealthChecking() {
    return this.isChecking;
  }

  /**
   * Register a listener for status changes
   * @param {Function} callback - Called with (isHealthy) when status changes
   * @returns {Function} Unsubscribe function
   */
  onStatusChange(callback) {
    if (typeof callback === 'function') {
      this.statusChangeListeners.push(callback);

      // Return unsubscribe function
      return () => {
        const index = this.statusChangeListeners.indexOf(callback);
        if (index > -1) {
          this.statusChangeListeners.splice(index, 1);
        }
      };
    }
  }

  /**
   * Notify all listeners of status change
   * @private
   * @param {boolean} isHealthy - Current health status
   */
  notifyStatusChange(isHealthy) {
    this.statusChangeListeners.forEach(callback => {
      try {
        callback(isHealthy);
      } catch (err) {
        log.error('Error in status change listener:', err);
      }
    });
  }

  /**
   * Destroy service and cleanup
   */
  destroy() {
    this.stopPeriodicChecks();
    this.statusChangeListeners = [];
    log.info('Health check service destroyed');
  }

  /**
   * Wait for backend to come online
   * Useful when app detects offline status and wants to wait for recovery
   * @param {number} maxWait - Maximum time to wait in milliseconds
   * @returns {Promise<boolean>} True if backend came online, false if timeout
   */
  async waitForOnline(maxWait = 60000) {
    if (this.isHealthy) {
      return true;
    }

    return new Promise((resolve) => {
      let timeoutId;
      let unsubscribe;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (unsubscribe) unsubscribe();
      };

      // Check periodically
      const checkTimer = setInterval(async () => {
        if (this.isHealthy) {
          cleanup();
          clearInterval(checkTimer);
          resolve(true);
        }
      }, 2000);

      // Set maximum wait time
      timeoutId = setTimeout(() => {
        cleanup();
        clearInterval(checkTimer);
        resolve(false);
      }, maxWait);

      // Also listen for status changes
      unsubscribe = this.onStatusChange((healthy) => {
        if (healthy) {
          cleanup();
          clearInterval(checkTimer);
          resolve(true);
        }
      });

      // Trigger immediate check
      this.checkNow();
    });
  }

  /**
   * Get detailed diagnostic info
   * @returns {Object} Diagnostic information
   */
  getDiagnostics() {
    const now = new Date();
    const timeSinceLastCheck = this.lastCheckTime 
      ? Math.round((now - this.lastCheckTime) / 1000)
      : 'never';

    return {
      status: this.getStatusString(),
      isHealthy: this.isHealthy,
      isChecking: this.isChecking,
      lastCheckTime: this.lastCheckTime?.toISOString() || 'never',
      timeSinceLastCheck: `${timeSinceLastCheck}s ago`,
      failureCount: this.failureCount,
      maxRetries: this.maxRetries,
      checkInterval: `${this.checkInterval}ms`,
      timeout: `${this.timeoutDuration}ms`,
      listenersCount: this.statusChangeListeners.length
    };
  }
}

// Create singleton instance
const healthCheckService = new HealthCheckService();

export default healthCheckService;

