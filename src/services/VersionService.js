import log from '../utils/logger';
/**
 * Version Service
 * 
 * Handles version checking, compatibility verification, and update notifications
 * Coordinates with backend version endpoints to ensure app/backend compatibility
 */
class VersionService {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.versionEndpoint = '/version';
    this.currentVersion = null;
    this.backendVersion = null;
    this.compatibilityStatus = null;
    this.listeners = {};
    this.checkInterval = 60 * 60 * 1000; // Check every hour
    this.lastCheckTime = null;
    this.isCheckInProgress = false;
  }

  /**
   * Version object structure
   * @typedef {Object} Version
   * @property {string} version - Semantic version (e.g., "1.0.0")
   * @property {number} major - Major version number
   * @property {number} minor - Minor version number
   * @property {number} patch - Patch version number
   * @property {string} build - Build number/hash
   * @property {string} timestamp - Release timestamp
   * @property {boolean} isPrerelease - Whether it's a prerelease
   * @property {string} releaseType - Type of release (stable, beta, alpha)
   */

  /**
   * Initialize version service and check immediately
   * @param {string} appVersion - Current app version (from package.json)
   * @returns {Promise<void>}
   */
  async initialize(appVersion) {
    this.currentVersion = this._parseVersion(appVersion);

    if (!this.currentVersion) {
      log.error('[VersionService] Invalid app version format:', appVersion);
      return;
    }

    log.info('[VersionService] Initialized with app version:', appVersion);

    // Check version immediately
    await this.checkVersion();

    // Set up periodic checks
    this._setupPeriodicChecks();
  }

  /**
   * Check version and compatibility with backend
   * @returns {Promise<Object>} Compatibility status
   */
  async checkVersion() {
    if (this.isCheckInProgress) {
      log.warn('[VersionService] Version check already in progress, skipping');
      return this.compatibilityStatus;
    }

    this.isCheckInProgress = true;

    try {
      const [versionInfo, compatibilityInfo, changelog] = await Promise.all([
        this._fetchBackendVersion(),
        this._checkCompatibility(),
        this._fetchChangelog()
      ]);

      this.lastCheckTime = new Date();

      if (!versionInfo || !compatibilityInfo) {
        log.warn('[VersionService] Failed to fetch version info');
        return this.compatibilityStatus;
      }

      this.backendVersion = versionInfo;
      this.compatibilityStatus = {
        isCompatible: compatibilityInfo.compatible,
        requiresUpdate: compatibilityInfo.updateRequired,
        isCritical: compatibilityInfo.critical,
        minimumVersion: compatibilityInfo.minimumVersion,
        recommendedVersion: compatibilityInfo.recommendedVersion,
        message: compatibilityInfo.message,
        blockingReason: compatibilityInfo.blockingReason,
        currentVersion: this.currentVersion.version,
        backendVersion: versionInfo.version,
        changelog: changelog
      };

      log.info('[VersionService] Version check completed:', {
        compatible: this.compatibilityStatus.isCompatible,
        updateRequired: this.compatibilityStatus.requiresUpdate,
        critical: this.compatibilityStatus.isCritical
      });

      // Notify listeners
      this._notifyListeners('versionCheckComplete', this.compatibilityStatus);

      // Handle blocking cases
      if (!this.compatibilityStatus.isCompatible && this.compatibilityStatus.isCritical) {
        log.error('[VersionService] App version is incompatible and blocked:', this.compatibilityStatus);
        this._notifyListeners('incompatibleVersion', this.compatibilityStatus);
      }

      return this.compatibilityStatus;
    } catch (error) {
      log.error('[VersionService] Version check failed:', error);
      this._notifyListeners('versionCheckError', error);
      return null;
    } finally {
      this.isCheckInProgress = false;
    }
  }

  /**
   * Force version check (bypass cache)
   * @returns {Promise<Object>} Compatibility status
   */
  async forceCheckVersion() {
    this.lastCheckTime = null;
    return this.checkVersion();
  }

  /**
   * Get current compatibility status
   * @returns {Object|null} Compatibility status or null if not checked
   */
  getCompatibilityStatus() {
    return this.compatibilityStatus;
  }

  /**
   * Check if update is required
   * @returns {boolean} True if update is required
   */
  isUpdateRequired() {
    return this.compatibilityStatus?.requiresUpdate || false;
  }

  /**
   * Check if version is critical (app blocked)
   * @returns {boolean} True if version is critical
   */
  isCriticalBlock() {
    return this.compatibilityStatus?.isCritical || false;
  }

  /**
   * Check if app is compatible with backend
   * @returns {boolean} True if compatible
   */
  isCompatible() {
    return this.compatibilityStatus?.isCompatible !== false;
  }

  /**
   * Get update notification message
   * @returns {string|null} Message to display to user
   */
  getUpdateMessage() {
    if (!this.compatibilityStatus) return null;

    if (this.compatibilityStatus.isCritical) {
      return this.compatibilityStatus.blockingReason || 
        `Your app version (${this.compatibilityStatus.currentVersion}) is incompatible with the server. ` +
        `Please update to version ${this.compatibilityStatus.recommendedVersion} or later.`;
    }

    if (this.compatibilityStatus.requiresUpdate) {
      return this.compatibilityStatus.message ||
        `A new version (${this.compatibilityStatus.backendVersion}) is available. ` +
        `Please update to the latest version.`;
    }

    return null;
  }

  /**
   * Register event listener
   * @param {string} event - Event name (versionCheckComplete, incompatibleVersion, versionCheckError)
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Unregister event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  /**
   * Fetch backend version information
   * @private
   */
  async _fetchBackendVersion() {
    if (!this.apiClient) {
      log.warn('[VersionService] No API client available');
      return null;
    }

    try {
      const response = await this.apiClient.get(`${this.versionEndpoint}/`);
      return response.data || response;
    } catch (error) {
      log.error('[VersionService] Failed to fetch backend version:', error.message);
      return null;
    }
  }

  /**
   * Check compatibility with backend
   * @private
   */
  async _checkCompatibility() {
    if (!this.apiClient || !this.currentVersion) {
      log.warn('[VersionService] Cannot check compatibility without API client or app version');
      return null;
    }

    try {
      const response = await this.apiClient.get(
        `${this.versionEndpoint}/compatibility`,
        {
          params: {
            version: this.currentVersion.version,
            build: this.currentVersion.build
          }
        }
      );
      return response.data || response;
    } catch (error) {
      log.error('[VersionService] Failed to check compatibility:', error.message);
      return null;
    }
  }

  /**
   * Fetch changelog/release notes
   * @private
   */
  async _fetchChangelog() {
    if (!this.apiClient) {
      return null;
    }

    try {
      const response = await this.apiClient.get(
        `${this.versionEndpoint}/changelog`,
        {
          params: {
            limit: 5  // Get last 5 releases
          }
        }
      );
      return response.data || response;
    } catch (error) {
      log.warn('[VersionService] Failed to fetch changelog:', error.message);
      return null;
    }
  }

  /**
   * Parse version string into components
   * @private
   */
  _parseVersion(versionString) {
    if (!versionString || typeof versionString !== 'string') {
      return null;
    }

    // Remove 'v' prefix if present
    const cleanVersion = versionString.replace(/^v/, '').trim();

    // Parse semantic version with optional build/prerelease
    // Formats: 1.0.0, 1.0.0-alpha, 1.0.0+build123, 1.0.0-beta+build
    const versionRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([\w.]+))?(?:\+(.+))?$/;
    const match = cleanVersion.match(versionRegex);

    if (!match) {
      log.warn('[VersionService] Invalid version format:', versionString);
      return null;
    }

    const [, major, minor, patch, prerelease, build] = match;

    return {
      version: `${major}.${minor}.${patch}`,
      major: parseInt(major, 10),
      minor: parseInt(minor, 10),
      patch: parseInt(patch, 10),
      prerelease: prerelease || null,
      build: build || null,
      isPrerelease: !!prerelease,
      releaseType: this._getReleaseType(prerelease),
      original: versionString
    };
  }

  /**
   * Get release type from prerelease string
   * @private
   */
  _getReleaseType(prerelease) {
    if (!prerelease) return 'stable';
    if (prerelease.includes('alpha')) return 'alpha';
    if (prerelease.includes('beta')) return 'beta';
    if (prerelease.includes('rc')) return 'rc';
    return 'prerelease';
  }

  /**
   * Compare two version numbers
   * @private
   * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  _compareVersions(v1, v2) {
    const p1 = v1.split('.').map(x => parseInt(x, 10));
    const p2 = v2.split('.').map(x => parseInt(x, 10));

    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const part1 = p1[i] || 0;
      const part2 = p2[i] || 0;

      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }

    return 0;
  }

  /**
   * Setup periodic version checks
   * @private
   */
  _setupPeriodicChecks() {
    setInterval(() => {
      // Only check if not already checking
      if (!this.isCheckInProgress) {
        log.debug('[VersionService] Running periodic version check');
        this.checkVersion().catch(err => {
          log.error('[VersionService] Periodic check error:', err);
        });
      }
    }, this.checkInterval);

    log.info('[VersionService] Periodic version checks enabled (interval: ' + 
      Math.round(this.checkInterval / 60000) + 'min)');
  }

  /**
   * Notify all listeners of an event
   * @private
   */
  _notifyListeners(event, data) {
    if (!this.listeners[event]) return;

    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        log.error('[VersionService] Error in listener callback:', error);
      }
    });
  }

  /**
   * Get detailed version information
   * @returns {Object} Current and backend version info
   */
  getVersionInfo() {
    return {
      current: this.currentVersion,
      backend: this.backendVersion,
      compatibility: this.compatibilityStatus,
      lastCheckTime: this.lastCheckTime,
      isCheckInProgress: this.isCheckInProgress
    };
  }

  /**
   * Clear version service
   */
  destroy() {
    this.listeners = {};
    this.currentVersion = null;
    this.backendVersion = null;
    this.compatibilityStatus = null;
    log.info('[VersionService] Version service destroyed');
  }
}

module.exports = VersionService;
