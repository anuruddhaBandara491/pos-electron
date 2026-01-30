import log from 'electron-log';
import RoleManager from '../utils/RoleManager';

/**
 * Authentication Service
 * Handles login, token management, and user authentication
 * Communicates with backend API via IPC handlers
 * 
 * Manages:
 * - User authentication via IPC
 * - Token storage and retrieval
 * - User roles and permissions
 * - Session restoration on app reload
 */
class AuthService {
  constructor() {
    this.isInitialized = false;
    this.currentUser = null;
    this.userRoles = [];
    this.userPermissions = [];
  }

  /**
   * Initialize the auth service
   * Called once when app starts
   */
  async initialize() {
    try {
      // Check if user is already logged in
      const tokenInfo = await window.pos.auth.getTokenInfo?.();
      if (tokenInfo?.hasToken) {
        log.info('User has valid token from previous session');
        this.isInitialized = true;
        return true;
      }
    } catch (err) {
      log.warn('Could not restore previous session:', err.message);
    }
    this.isInitialized = true;
    return false;
  }

  /**
   * Login user with email, password, and device name
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} deviceName - Name of the device
   * @returns {Promise<Object>} User data with roles
   */
  async login(email, password, deviceName) {
    try {
      log.debug(`Attempting login for ${email} on device: ${deviceName}`);

      // Call backend login API via IPC
      const response = await window.pos.auth.login({
        email,
        password,
        device_name: deviceName
      });

      if (!response) {
        throw new Error('No response from login endpoint');
      }

      // Extract user data from response
      const userData = response.user || response;
      
      // Store user data with role normalization
      this._storeUserData(userData);

      log.info(`Login successful for user: ${email}`);
      
      // Token is automatically stored by IpcHandler via TokenManager
      return response;
    } catch (err) {
      // Extract meaningful error message from backend response
      const errorMessage = this._extractErrorMessage(err);
      log.error(`Login failed for ${email}:`, errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Get current user information
   * Retrieves and caches user data with roles
   * @returns {Promise<Object>} Current user data with roles
   */
  async getCurrentUser() {
    try {
      const user = await window.pos.auth.getCurrentUser();
      
      // Cache user data with role normalization
      if (user) {
        this._storeUserData(user);
      }
      
      return user;
    } catch (err) {
      log.error('Failed to get current user:', err);
      throw err;
    }
  }

  /**
   * Get safe token information (metadata only, not the actual token)
   * @returns {Promise<Object>} Token info: { hasToken, expiresAt, secondsRemaining, storageBackend }
   */
  async getTokenInfo() {
    try {
      const tokenInfo = await window.pos.auth.getTokenInfo?.();
      return tokenInfo;
    } catch (err) {
      log.error('Failed to get token info:', err);
      return { hasToken: false };
    }
  }

  /**
   * Check if token is expired
   * @returns {Promise<boolean>} True if token is expired
   */
  async isTokenExpired() {
    try {
      const result = await window.pos.auth.isTokenExpired?.();
      return result?.isExpired || true;
    } catch (err) {
      log.error('Failed to check token expiry:', err);
      return true;
    }
  }

  /**
   * Refresh authentication token
   * @returns {Promise<Object>} Refresh result
   */
  async refreshToken() {
    try {
      log.debug('Refreshing authentication token');
      const result = await window.pos.auth.refreshToken();
      log.info('Token refreshed successfully');
      return result;
    } catch (err) {
      log.error('Token refresh failed:', err);
      throw err;
    }
  }

  /**
   * Logout user and clear tokens
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      log.debug('Logging out user');
      await window.pos.auth.logout();
      
      // Clear tokens from secure storage
      await window.pos.auth.clearTokens?.();
      
      // Clear cached user data and roles
      this._clearUserData();
      
      log.info('User logged out successfully');
    } catch (err) {
      log.error('Logout failed:', err);
      throw err;
    }
  }

  /**
   * Extract meaningful error message from various error formats
   * Handles backend API errors, validation errors, and network errors
   * @private
   * @param {Error} err - Error object
   * @returns {string} User-friendly error message
   */
  _extractErrorMessage(err) {
    // Handle API error responses with validation messages
    if (err.response?.data?.message) {
      return err.response.data.message;
    }

    // Handle validation errors
    if (err.response?.data?.errors) {
      const errors = err.response.data.errors;
      if (typeof errors === 'object') {
        // Convert error object to message
        const messages = Object.entries(errors)
          .map(([field, message]) => {
            // Handle array of messages
            if (Array.isArray(message)) {
              return message[0];
            }
            return message;
          })
          .filter(Boolean);
        
        if (messages.length > 0) {
          return messages.join('; ');
        }
      } else if (Array.isArray(errors) && errors.length > 0) {
        return errors[0];
      }
    }

    // Handle field-specific errors
    if (err.response?.data?.error) {
      return err.response.data.error;
    }

    // Handle standard error message
    if (err.message) {
      // Filter out internal error messages
      const message = err.message.toLowerCase();
      
      if (message.includes('invalid credentials')) {
        return 'Invalid email or password';
      }
      if (message.includes('not found')) {
        return 'User account not found';
      }
      if (message.includes('unauthorized')) {
        return 'Unauthorized: Please check your credentials';
      }
      if (message.includes('network') || message.includes('econnrefused')) {
        return 'Network error: Cannot connect to server. Please check your connection.';
      }
      if (message.includes('timeout')) {
        return 'Request timeout: Server is not responding. Please try again.';
      }
      
      return err.message;
    }

    // Fallback error message
    return 'Login failed. Please try again or contact support.';
  }

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    try {
      const user = await this.getCurrentUser();
      return !!user;
    } catch (err) {
      return false;
    }
  }

  /**
   * Get user's roles
   * Extracts and normalizes roles from current user
   * @returns {Array} Array of user roles
   */
  getUserRoles() {
    if (!this.currentUser) {
      return [];
    }

    // Handle both 'roles' (array) and 'role' (string) formats
    if (Array.isArray(this.currentUser.roles)) {
      return this.currentUser.roles.map(r => r.toLowerCase());
    } else if (this.currentUser.role) {
      return [this.currentUser.role.toLowerCase()];
    } else if (this.currentUser.roles) {
      return [this.currentUser.roles.toLowerCase()];
    }

    return [];
  }

  /**
   * Check if user has a specific role
   * @param {string|Array} requiredRoles - Role(s) to check
   * @returns {boolean} Whether user has the role
   */
  hasRole(requiredRoles) {
    const userRoles = this.getUserRoles();
    const rolesArray = Array.isArray(requiredRoles)
      ? requiredRoles.map(r => r.toLowerCase())
      : [requiredRoles.toLowerCase()];

    return rolesArray.some(role => userRoles.includes(role));
  }

  /**
   * Check if user is a manager or admin
   * @returns {boolean} True if user is manager or admin
   */
  isManager() {
    return this.hasRole(['admin', 'manager']);
  }

  /**
   * Check if user is an admin
   * @returns {boolean} True if user is admin
   */
  isAdmin() {
    return this.hasRole('admin');
  }

  /**
   * Check if user has a specific permission
   * @param {string} permission - Permission to check
   * @returns {boolean} Whether user has permission
   */
  hasPermission(permission) {
    return RoleManager.hasPermission(this.currentUser, permission);
  }

  /**
   * Check if user has any of the specified permissions
   * @param {Array} permissions - Array of permissions
   * @returns {boolean} True if user has at least one
   */
  hasAnyPermission(permissions) {
    return RoleManager.hasAnyPermission(this.currentUser, permissions);
  }

  /**
   * Check if user has all specified permissions
   * @param {Array} permissions - Array of permissions
   * @returns {boolean} True if user has all
   */
  hasAllPermissions(permissions) {
    return RoleManager.hasAllPermissions(this.currentUser, permissions);
  }

  /**
   * Get user's permissions
   * @returns {Array} Array of permission strings
   */
  getUserPermissions() {
    return RoleManager.getUserPermissions(this.currentUser);
  }

  // Permission-specific helper methods matching RoleManager
  canViewOrders() { return RoleManager.canViewOrders(this.currentUser); }
  canCreateOrder() { return RoleManager.canCreateOrder(this.currentUser); }
  canEditOrder() { return RoleManager.canEditOrder(this.currentUser); }
  canDeleteOrder() { return RoleManager.canDeleteOrder(this.currentUser); }
  canCompleteOrder() { return RoleManager.canCompleteOrder(this.currentUser); }
  
  canRecordPayment() { return RoleManager.canRecordPayment(this.currentUser); }
  canRefundPayment() { return RoleManager.canRefundPayment(this.currentUser); }
  canViewPayments() { return RoleManager.canViewPayments(this.currentUser); }
  
  canViewProducts() { return RoleManager.canViewProducts(this.currentUser); }
  canCreateProduct() { return RoleManager.canCreateProduct(this.currentUser); }
  canEditProduct() { return RoleManager.canEditProduct(this.currentUser); }
  canDeleteProduct() { return RoleManager.canDeleteProduct(this.currentUser); }
  canManageStock() { return RoleManager.canManageStock(this.currentUser); }
  canViewStock() { return RoleManager.canViewStock(this.currentUser); }
  
  canViewUsers() { return RoleManager.canViewUsers(this.currentUser); }
  canCreateUser() { return RoleManager.canCreateUser(this.currentUser); }
  canEditUser() { return RoleManager.canEditUser(this.currentUser); }
  canDeleteUser() { return RoleManager.canDeleteUser(this.currentUser); }
  canAssignRole() { return RoleManager.canAssignRole(this.currentUser); }
  
  canViewReports() { return RoleManager.canViewReports(this.currentUser); }
  canExportReports() { return RoleManager.canExportReports(this.currentUser); }
  
  canManageSettings() { return RoleManager.canManageSettings(this.currentUser); }
  canViewLogs() { return RoleManager.canViewLogs(this.currentUser); }

  /**
   * Get user's default home route based on role
   * @returns {string} Route path (/dashboard for managers, /pos for cashiers)
   */
  getDefaultRoute() {
    const userRoles = this.getUserRoles();
    
    // Admin/Manager get dashboard
    if (userRoles.includes('admin') || userRoles.includes('manager')) {
      return '/dashboard';
    }

    // Cashier/Operator get POS screen
    return '/pos';
  }

  /**
   * Get routes available to current user
   * @returns {Array} List of accessible route paths
   */
  getAvailableRoutes() {
    if (!this.currentUser) {
      return [];
    }

    return RoleManager.getAvailableRoutes(this.currentUser);
  }

  /**
   * Store user data with role and permission normalization
   * Called after successful login
   * @param {Object} userData - User object from backend
   */
  _storeUserData(userData) {
    if (!userData) return;

    // Normalize roles to consistent format
    const normalized = RoleManager.normalizeRoles(userData);
    this.currentUser = normalized;
    this.userRoles = this.getUserRoles();
    this.userPermissions = this.getUserPermissions();

    log.info(
      `User ${userData.email} authenticated with roles: ${this.userRoles.join(', ')} and ${this.userPermissions.length} permissions`
    );
  }

  /**
   * Clear all user data
   * Called on logout
   */
  _clearUserData() {
    this.currentUser = null;
    this.userRoles = [];
    this.userPermissions = [];
  }
}

// Create singleton instance
const authService = new AuthService();

export default authService;

