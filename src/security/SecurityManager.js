/**
 * Security Manager
 * Handles security verification, validation, and best practices
 */
class SecurityManager {
  constructor(log) {
    this.log = log;
  }

  /**
   * Verify all security settings are properly configured
   */
  verifySecuritySettings(mainWindow) {
    if (!mainWindow || !mainWindow.webPreferences) {
      this.log.warn('Cannot verify security settings: mainWindow or webPreferences missing');
      return;
    }

    const webPreferences = mainWindow.webPreferences;

    const checks = {
      'Node Integration Disabled': webPreferences.nodeIntegration === false,
      'Context Isolation Enabled': webPreferences.contextIsolation === true,
      'Sandbox Enabled': webPreferences.sandbox === true,
      'Remote Module Disabled': webPreferences.enableRemoteModule !== true,
      'Preload Script Configured': !!webPreferences.preload,
      'Experimental Features Disabled': webPreferences.experimentalFeatures !== true
    };

    let allPassed = true;
    Object.entries(checks).forEach(([check, passed]) => {
      const status = passed ? '✓' : '✗';
      const logFn = passed ? this.log.info : this.log.error;
      logFn(`Security Check [${status}]: ${check}`);
      if (!passed) allPassed = false;
    });

    if (!allPassed) {
      this.log.error('CRITICAL: Some security checks failed!');
    } else {
      this.log.info('All security checks passed ✓');
    }

    return allPassed;
  }

  /**
   * Validate token format
   */
  isValidToken(token) {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // Basic JWT format check (three parts separated by dots)
    const parts = token.split('.');
    return parts.length === 3;
  }

  /**
   * Sanitize string to prevent XSS
   */
  sanitizeString(str) {
    if (typeof str !== 'string') return '';

    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Validate IPC channel name
   */
  isValidChannel(channel) {
    // Only allow alphanumeric, colon, and hyphen in channel names
    return /^[a-zA-Z0-9:-]+$/.test(channel);
  }

  /**
   * Check if URL is valid API endpoint
   */
  isValidApiUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Rate limiting for sensitive operations
   */
  createRateLimiter(maxAttempts = 5, windowMs = 60000) {
    const attempts = {};

    return (identifier) => {
      const now = Date.now();
      const key = identifier;

      if (!attempts[key]) {
        attempts[key] = { count: 1, resetTime: now + windowMs };
        return { allowed: true, remaining: maxAttempts - 1 };
      }

      if (now > attempts[key].resetTime) {
        attempts[key] = { count: 1, resetTime: now + windowMs };
        return { allowed: true, remaining: maxAttempts - 1 };
      }

      attempts[key].count++;

      if (attempts[key].count > maxAttempts) {
        return { allowed: false, remaining: 0 };
      }

      return { allowed: true, remaining: maxAttempts - attempts[key].count };
    };
  }
}

module.exports = SecurityManager;
