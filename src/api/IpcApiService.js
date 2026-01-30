/**
 * Secure IPC API Service
 * Wrapper for making API calls through IPC with security features
 * 
 * This module provides a secure interface to the main process's API manager
 * via IPC, handling:
 * - Secure token storage and management
 * - Automatic error handling
 * - Request/response validation
 * - User-friendly error messages
 */

const { ipcRenderer } = require('electron');

class IpcApiService {
  constructor() {
    this.isInitialized = false;
    this.listeners = new Map();
    this.retryConfig = {
      maxRetries: 3,
      initialDelay: 1000,
      backoffMultiplier: 2
    };
  }

  /**
   * Initialize the IPC API service
   */
  async initialize() {
    try {
      // Test IPC connection
      const health = await ipcRenderer.invoke('health:check');
      this.isInitialized = true;
      console.log('IPC API Service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize IPC API Service:', error);
      return false;
    }
  }

  /**
   * Make secure IPC API call with error handling
   */
  async call(channel, data = null, options = {}) {
    if (!this.isInitialized) {
      throw new Error('IPC API Service not initialized');
    }

    const {
      retry = true,
      timeout = 30000,
      validateResponse = true
    } = options;

    return this._executeWithRetry(
      () => this._makeCall(channel, data, timeout),
      retry ? this.retryConfig : { maxRetries: 0 }
    );
  }

  /**
   * Execute IPC call with internal error handling
   */
  async _makeCall(channel, data, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`IPC call to ${channel} timed out after ${timeout}ms`));
      }, timeout);

      try {
        ipcRenderer.invoke(channel, data)
          .then(result => {
            clearTimeout(timeoutId);
            resolve(result);
          })
          .catch(error => {
            clearTimeout(timeoutId);
            reject(this._normalizeError(error, channel));
          });
      } catch (error) {
        clearTimeout(timeoutId);
        reject(this._normalizeError(error, channel));
      }
    });
  }

  /**
   * Execute request with exponential backoff retry
   */
  async _executeWithRetry(requestFn, retryConfig) {
    let lastError;
    let delay = retryConfig.initialDelay;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;

        // Don't retry auth errors
        if (error.isAuthError) {
          throw error;
        }

        // Don't retry if this is the last attempt
        if (attempt === retryConfig.maxRetries) {
          throw error;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= retryConfig.backoffMultiplier;
      }
    }

    throw lastError;
  }

  /**
   * Normalize IPC errors
   */
  _normalizeError(error, channel) {
    const normalizedError = new Error(error.message || `Error calling ${channel}`);
    normalizedError.originalError = error;
    normalizedError.channel = channel;
    normalizedError.isAuthError = error.message?.includes('401') || error.message?.includes('403');
    return normalizedError;
  }

  /**
   * Listen to auth-related IPC events
   */
  onAuthStateChange(listener) {
    const key = 'auth-change';
    this.listeners.set(key, listener);
    
    ipcRenderer.on('auth:stateChanged', (event, data) => {
      listener(data);
    });

    return () => {
      this.listeners.delete(key);
      ipcRenderer.removeAllListeners('auth:stateChanged');
    };
  }

  /**
   * Listen to token refresh events
   */
  onTokenRefreshed(listener) {
    const key = 'token-refresh';
    this.listeners.set(key, listener);
    
    ipcRenderer.on('auth:tokenRefreshed', (event, token) => {
      listener(token);
    });

    return () => {
      this.listeners.delete(key);
      ipcRenderer.removeAllListeners('auth:tokenRefreshed');
    };
  }

  // ========== AUTHENTICATION API ==========

  async login(email, password) {
    return this.call('auth:login', { email, password });
  }

  async logout() {
    return this.call('auth:logout');
  }

  async getCurrentUser() {
    return this.call('auth:getCurrentUser');
  }

  async refreshToken() {
    return this.call('auth:refreshToken');
  }

  async saveToken(token) {
    return this.call('auth:saveToken', token);
  }

  // ========== PRODUCTS API ==========

  async getProducts(params = {}) {
    return this.call('products:getAll', params);
  }

  async getProduct(id) {
    return this.call('products:getById', id);
  }

  async createProduct(data) {
    return this.call('products:create', data);
  }

  async updateProduct(id, data) {
    return this.call('products:update', { id, data });
  }

  async deleteProduct(id) {
    return this.call('products:delete', id);
  }

  // ========== ORDERS API ==========

  async getOrders(params = {}) {
    return this.call('orders:getAll', params);
  }

  async getOrder(id) {
    return this.call('orders:getById', id);
  }

  async createOrder(data) {
    return this.call('orders:create', data);
  }

  async updateOrder(id, data) {
    return this.call('orders:update', { id, data });
  }

  async cancelOrder(id) {
    return this.call('orders:cancel', id);
  }

  async checkoutOrder(data) {
    return this.call('orders:checkout', data);
  }

  // ========== PAYMENTS API ==========

  async processPayment(data) {
    return this.call('payments:process', data);
  }

  async getPaymentHistory(params = {}) {
    return this.call('payments:history', params);
  }

  async refundPayment(paymentId) {
    return this.call('payments:refund', paymentId);
  }

  // ========== REPORTS API ==========

  async getSalesReport(params = {}) {
    return this.call('reports:sales', params);
  }

  async getInventoryReport(params = {}) {
    return this.call('reports:inventory', params);
  }

  async getTopProductsReport(params = {}) {
    return this.call('reports:topProducts', params);
  }

  async getCashFlowReport(params = {}) {
    return this.call('reports:cashFlow', params);
  }

  // ========== HEALTH & VERSION ==========

  async healthCheck() {
    return this.call('health:check');
  }

  async getDetailedHealth() {
    return this.call('health:getDetailed');
  }

  async getCurrentVersion() {
    return this.call('version:getCurrent');
  }

  async checkCompatibility(clientVersion) {
    return this.call('version:checkCompatibility', clientVersion);
  }

  // ========== STORAGE API ==========

  async getStorageValue(key) {
    return this.call('storage:get', key);
  }

  async setStorageValue(key, value) {
    return this.call('storage:set', { key, value });
  }

  async removeStorageValue(key) {
    return this.call('storage:remove', key);
  }

  async clearStorage() {
    return this.call('storage:clear');
  }

  // ========== UTILITY METHODS ==========

  /**
   * Batch multiple IPC calls
   */
  async batch(calls) {
    const results = await Promise.allSettled(
      calls.map(({ channel, data }) => this.call(channel, data))
    );

    return {
      successful: results
        .map((r, i) => r.status === 'fulfilled' ? results[i].value : null)
        .filter(r => r !== null),
      failed: results
        .map((r, i) => r.status === 'rejected' ? { index: i, error: r.reason } : null)
        .filter(r => r !== null),
      allSuccessful: results.every(r => r.status === 'fulfilled')
    };
  }

  /**
   * Clear all listeners
   */
  clearAllListeners() {
    this.listeners.forEach((_, key) => {
      ipcRenderer.removeAllListeners(key);
    });
    this.listeners.clear();
  }
}

// Create singleton instance
const ipcApiService = new IpcApiService();

module.exports = ipcApiService;
