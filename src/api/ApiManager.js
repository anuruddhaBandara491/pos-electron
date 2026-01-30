const axios = require('axios');
const log = require('../utils/logger');
const TokenManager = require('../security/TokenManager');

/**
 * Custom API Error Class
 * Provides detailed error information for API failures
 */
class ApiError extends Error {
  constructor(message, status, data, originalError) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Check if error is authentication-related
   */
  isAuthError() {
    return this.status === 401 || this.status === 403;
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable() {
    return !this.isAuthError() && this.status >= 500;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage() {
    const messages = {
      400: 'Invalid request. Please check your input.',
      401: 'Your session has expired. Please log in again.',
      403: 'You do not have permission to access this resource.',
      404: 'The requested resource was not found.',
      429: 'Too many requests. Please try again later.',
      500: 'Server error. Please try again later.',
      503: 'Service unavailable. Please try again later.'
    };
    
    return messages[this.status] || this.message || 'An unexpected error occurred.';
  }
}

/**
 * API Manager
 * Handles all API communication with backend with security features:
 * - Bearer token authentication via TokenManager
 * - Automatic token refresh on 401
 * - Global error handling with 401/403 logout
 * - Request/response interceptors
 * - Centralized error management
 * - No direct token access (uses TokenManager)
 */
class ApiManager {
  constructor(logger, store, tokenManager = null, options = {}) {
    this.log = logger;
    this.store = store;
    this.options = options;
    
    // Use provided TokenManager or create new one
    this.tokenManager = tokenManager || new TokenManager(logger, store, options);
    
    // API configuration
    this.apiUrl = store.get('apiUrl') || process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
    this.refreshEndpoint = options.refreshEndpoint || '/auth/refresh';
    this.logoutEndpoint = options.logoutEndpoint || '/auth/logout';
    
    // Token refresh state
    this.isRefreshing = false;
    this.refreshSubscribers = [];
    
    // Error handling callbacks
    this.onAuthError = options.onAuthError || null;
    this.onTokenRefresh = options.onTokenRefresh || null;
    
    // Safe logger that sanitizes tokens
    this.safeLog = this.tokenManager.createSafeLogger();
    
    this.client = this.createAxiosClient();
  }

  /**
   * Subscribe to token refresh completion
   */
  subscribeToTokenRefresh(callback) {
    this.refreshSubscribers.push(callback);
  }

  /**
   * Notify all subscribers that token was refreshed
   */
  notifyTokenRefreshed(token) {
    this.refreshSubscribers.forEach(callback => callback(token));
    this.refreshSubscribers = [];
  }

  /**
   * Create Axios client with proper configuration and interceptors
   */
  createAxiosClient() {
    const client = axios.create({
      baseURL: this.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    /**
     * Request interceptor: Attach bearer token and log requests
     */
    client.interceptors.request.use(
      async (config) => {
        // Get token from TokenManager (async)
        const token = await this.tokenManager.getAuthToken();
        
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Add request metadata
        config.metadata = { startTime: Date.now() };
        
        this.safeLog.debug(`API Request: ${config.method.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.safeLog.error('Request interceptor error:', error.message);
        return Promise.reject(this.normalizeError(error));
      }
    );

    /**
     * Response interceptor: Handle 401/403, token refresh, and centralize errors
     */
    client.interceptors.response.use(
      (response) => {
        // Log response timing
        const duration = Date.now() - response.config.metadata.startTime;
        this.safeLog.debug(`API Response: ${response.status} ${response.statusText} (${duration}ms)`);
        return response.data;
      },
      (error) => {
        return this.handleResponseError(error);
      }
    );

    return client;
  }

  /**
   * Handle response errors with 401/403 support and token refresh
   */
  async handleResponseError(error) {
    const normalizedError = this.normalizeError(error);
    
    // If 401 (Unauthorized) - attempt token refresh
    if (normalizedError.status === 401) {
      return this.handle401Error(error);
    }
    
    // If 403 (Forbidden) - force logout
    if (normalizedError.status === 403) {
      return this.handle403Error(normalizedError);
    }
    
    // Log and reject other errors
    this.log.error(`API Error [${normalizedError.status}]: ${normalizedError.message}`);
    return Promise.reject(normalizedError);
  }

  /**
   * Handle 401 Unauthorized - Attempt token refresh
   */
  async handle401Error(error) {
    const config = error.config;
    
    // Prevent infinite refresh loops
    if (config.url.includes(this.refreshEndpoint)) {
      this.log.warn('Token refresh failed - logging out');
      return this.forceLogout();
    }

    // If already refreshing, queue the request
    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.subscribeToTokenRefresh((token) => {
          config.headers.Authorization = `Bearer ${token}`;
          resolve(this.client(config));
        });
      }).catch(() => this.forceLogout());
    }

    // Start token refresh
    this.isRefreshing = true;
    this.log.info('Attempting token refresh...');

    try {
      const refreshToken = await this.tokenManager.getRefreshToken();
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await this.client.post(this.refreshEndpoint, {
        refreshToken: refreshToken
      });

      const newToken = response.data?.token || response.data?.accessToken;
      if (!newToken) {
        throw new Error('No token in refresh response');
      }

      // Update token via TokenManager
      await this.tokenManager.setAuthToken(newToken, response.data?.expiresIn);
      this.isRefreshing = false;

      // Notify subscribers and retry original request
      this.notifyTokenRefreshed(newToken);
      config.headers.Authorization = `Bearer ${newToken}`;

      // Call refresh callback if provided
      if (this.onTokenRefresh) {
        this.onTokenRefresh(newToken);
      }

      this.log.info('Token refreshed successfully');
      return this.client(config);
    } catch (refreshError) {
      this.isRefreshing = false;
      this.log.error('Token refresh failed:', refreshError.message);
      return this.forceLogout();
    }
  }

  /**
   * Handle 403 Forbidden - Force logout
   */
  async handle403Error(error) {
    this.log.warn('Access forbidden (403) - forcing logout');
    return this.forceLogout();
  }

  /**
   * Force logout and clear auth
   */
  async forceLogout() {
    this.log.warn('Forcing logout due to authentication failure');
    await this.tokenManager.clearAllTokens();
    
    // Call auth error callback if provided
    if (this.onAuthError) {
      this.onAuthError('Authentication failed. Please log in again.');
    }
    
    const error = new ApiError(
      'Authentication failed',
      401,
      { message: 'Your session has expired. Please log in again.' },
      null
    );
    return Promise.reject(error);
  }

  /**
   * Normalize errors into consistent ApiError format
   */
  normalizeError(error) {
    if (error instanceof ApiError) {
      return error;
    }

    const status = error.response?.status || 0;
    const data = error.response?.data || {};
    const message = data.message || error.message || 'Unknown error';

    return new ApiError(message, status, data, error);
  }

  /**
   * Check if token is expired
   */
  isTokenExpired() {
    return this.tokenManager.isTokenExpired();
  }

  /**
   * Get token expiration time remaining (in seconds)
   */
  getTokenTimeRemaining() {
    return this.tokenManager.getTokenTimeRemaining();
  }

  /**
   * Get token info for debugging (no actual token)
   */
  getTokenInfo() {
    return this.tokenManager.getTokenInfo();
  }

  /**
   * Set authentication token with optional expiration
   */
  async setAuthToken(token, expiresIn = 3600) {
    if (token) {
      await this.tokenManager.setAuthToken(token, expiresIn);
      this.log.info('Auth token set with expiration');
    }
  }

  /**
   * Set refresh token (for token rotation)
   */
  async setRefreshToken(token) {
    if (token) {
      await this.tokenManager.setRefreshToken(token);
      this.log.info('Refresh token set');
    }
  }

  /**
   * Clear authentication and all tokens
   */
  async clearAuth() {
    await this.tokenManager.clearAllTokens();
    this.isRefreshing = false;
    this.refreshSubscribers = [];
    this.log.info('Authentication cleared');
  }

  /**
   * Set API URL
   */
  setApiUrl(url) {
    this.apiUrl = url;
    this.store.set('apiUrl', url);
    this.client = this.createAxiosClient();
    this.log.info(`API URL set to: ${url}`);
  }

  // ========== AUTHENTICATION ENDPOINTS ==========

  async login(email, password, device_name) {
    try {
      // Send login request with device_name to backend
      const response = await this.client.post('/auth/login', { 
        email, 
        password,
        device_name: device_name || 'electron-pos'
      });
      
      const token = response.data?.token || response.token;
      const refreshToken = response.data?.refreshToken || response.refreshToken;
      const expiresIn = response.data?.expiresIn || 3600;

      if (token) {
        this.setAuthToken(token, expiresIn);
      }
      if (refreshToken) {
        this.setRefreshToken(refreshToken);
      }

      return response.data || response;
    } catch (error) {
      const apiError = this.normalizeError(error);
      this.log.error('Login failed:', apiError.getUserMessage());
      throw apiError;
    }
  }

  async logout() {
    try {
      await this.client.post(this.logoutEndpoint);
    } catch (error) {
      this.log.warn('Logout API call failed, clearing local auth anyway');
    } finally {
      this.clearAuth();
    }
  }

  async getCurrentUser() {
    const response = await this.client.get('/auth/me');
    return response.data?.data;
  }

  async refreshToken() {
    try {
      const response = await this.client.post(this.refreshEndpoint, {
        refreshToken: this.refreshToken
      });
      const token = response.data?.token || response.token;
      const expiresIn = response.data?.expiresIn || 3600;

      if (token) {
        this.setAuthToken(token, expiresIn);
        if (this.onTokenRefresh) {
          this.onTokenRefresh(token);
        }
      }

      return response.data || response;
    } catch (error) {
      const apiError = this.normalizeError(error);
      this.log.error('Token refresh failed:', apiError.getUserMessage());
      throw apiError;
    }
  }

  // ========== HEALTH ENDPOINTS ==========

  async healthCheck() {
    return this.client.get('/health');
  }

  async getDetailedHealth() {
    return this.client.get('/health/detailed');
  }

  async getLiveProbe() {
    return this.client.get('/health/live');
  }

  async getReadyProbe() {
    return this.client.get('/health/ready');
  }

  // ========== VERSION ENDPOINTS ==========

  async getCurrentVersion() {
    return this.client.get('/version');
  }

  async getDetailedVersion() {
    return this.client.get('/version/detailed');
  }

  async checkCompatibility(clientType, clientVersion) {
    return this.client.get('/version/check', {
      params: { client: clientType, version: clientVersion }
    });
  }

  async getChangelog(limit = 10) {
    return this.client.get('/version/changelog', {
      params: { limit }
    });
  }

  // ========== PRODUCTS ENDPOINTS ==========

  async getProducts(params = {}) {
    return this.client.get('/products', { params });
  }

  async getProduct(id) {
    return this.client.get(`/products/${id}`);
  }

  async createProduct(data) {
    return this.client.post('/products', data);
  }

  async updateProduct(id, data) {
    return this.client.put(`/products/${id}`, data);
  }

  async deleteProduct(id) {
    return this.client.delete(`/products/${id}`);
  }

  // ========== ORDERS ENDPOINTS ==========

  async getOrders(params = {}) {
    return this.client.get('/orders', { params });
  }

  async getOrder(id) {
    return this.client.get(`/orders/${id}`);
  }

  async createOrder(data) {
    return this.client.post('/orders', data);
  }

  async updateOrder(id, data) {
    return this.client.put(`/orders/${id}`, data);
  }

  async cancelOrder(id) {
    return this.client.post(`/orders/${id}/cancel`);
  }

  async checkoutOrder(data) {
    return this.client.post('/orders/checkout', data);
  }

  // ========== PAYMENTS ENDPOINTS ==========

  async processPayment(data) {
    return this.client.post('/payments', data);
  }

  async getPaymentHistory(params = {}) {
    return this.client.get('/payments/history', { params });
  }

  async refundPayment(paymentId) {
    return this.client.post(`/payments/${paymentId}/refund`);
  }

  // ========== REPORTS ENDPOINTS ==========

  async getSalesReport(params = {}) {
    return this.client.get('/reports/sales', { params });
  }

  async getInventoryReport(params = {}) {
    return this.client.get('/reports/inventory', { params });
  }

  async getTopProductsReport(params = {}) {
    return this.client.get('/reports/top-products', { params });
  }

  async getCashFlowReport(params = {}) {
    return this.client.get('/reports/cash-flow', { params });
  }
}

module.exports = ApiManager;
module.exports.ApiError = ApiError;
