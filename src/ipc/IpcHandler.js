const { ipcMain, dialog, app } = require('electron');
const log = require('../utils/logger');

/**
 * IPC Handler
 * Manages all inter-process communication between main and renderer
 */
class IpcHandler {
  constructor(logger, store, tokenManager = null) {
    this.log = logger;
    this.store = store;
    this.apiManager = null;
    this.tokenManager = tokenManager;
  }

  /**
   * Register all IPC handlers
   */
  registerHandlers(mainWindow, apiManager, tokenManager = null) {
    this.apiManager = apiManager;
    if (tokenManager) {
      this.tokenManager = tokenManager;
    }

    // ========== AUTHENTICATION HANDLERS ==========
    ipcMain.handle('auth:login', this.handleLogin.bind(this));
    ipcMain.handle('auth:logout', this.handleLogout.bind(this));
    ipcMain.handle('auth:getCurrentUser', this.handleGetCurrentUser.bind(this));
    ipcMain.handle('auth:refreshToken', this.handleRefreshToken.bind(this));
    ipcMain.handle('auth:saveToken', this.handleSaveToken.bind(this));
    
    // ========== SECURE TOKEN HANDLERS ==========
    ipcMain.handle('auth:getTokenInfo', this.handleGetTokenInfo.bind(this));
    ipcMain.handle('auth:isTokenExpired', this.handleIsTokenExpired.bind(this));
    ipcMain.handle('auth:getTokenExpirySeconds', this.handleGetTokenExpirySeconds.bind(this));
    ipcMain.handle('auth:clearTokens', this.handleClearTokens.bind(this));

    // ========== HEALTH HANDLERS ==========
    ipcMain.handle('health:check', this.handleHealthCheck.bind(this));
    ipcMain.handle('health:getDetailed', this.handleGetDetailedHealth.bind(this));
    ipcMain.handle('health:getLive', this.handleGetLiveProbe.bind(this));
    ipcMain.handle('health:getReady', this.handleGetReadyProbe.bind(this));

    // ========== VERSION HANDLERS ==========
    ipcMain.handle('version:getCurrent', this.handleGetCurrentVersion.bind(this));
    ipcMain.handle('version:getDetailed', this.handleGetDetailedVersion.bind(this));
    ipcMain.handle('version:checkCompatibility', this.handleCheckCompatibility.bind(this));
    ipcMain.handle('version:getChangelog', this.handleGetChangelog.bind(this));

    // ========== PRODUCTS HANDLERS ==========
    ipcMain.handle('products:getAll', this.handleGetProducts.bind(this));
    ipcMain.handle('products:getById', this.handleGetProduct.bind(this));
    ipcMain.handle('products:create', this.handleCreateProduct.bind(this));
    ipcMain.handle('products:update', this.handleUpdateProduct.bind(this));
    ipcMain.handle('products:delete', this.handleDeleteProduct.bind(this));

    // ========== ORDERS HANDLERS ==========
    ipcMain.handle('orders:getAll', this.handleGetOrders.bind(this));
    ipcMain.handle('orders:getById', this.handleGetOrder.bind(this));
    ipcMain.handle('orders:create', this.handleCreateOrder.bind(this));
    ipcMain.handle('orders:update', this.handleUpdateOrder.bind(this));
    ipcMain.handle('orders:cancel', this.handleCancelOrder.bind(this));
    ipcMain.handle('orders:checkout', this.handleCheckoutOrder.bind(this));

    // ========== PAYMENTS HANDLERS ==========
    ipcMain.handle('payments:process', this.handleProcessPayment.bind(this));
    ipcMain.handle('payments:getHistory', this.handleGetPaymentHistory.bind(this));
    ipcMain.handle('payments:refund', this.handleRefundPayment.bind(this));

    // ========== REPORTS HANDLERS ==========
    ipcMain.handle('reports:sales', this.handleGetSalesReport.bind(this));
    ipcMain.handle('reports:inventory', this.handleGetInventoryReport.bind(this));
    ipcMain.handle('reports:topProducts', this.handleGetTopProductsReport.bind(this));
    ipcMain.handle('reports:cashFlow', this.handleGetCashFlowReport.bind(this));

    // ========== STORAGE HANDLERS ==========
    ipcMain.handle('storage:get', this.handleStorageGet.bind(this));
    ipcMain.handle('storage:set', this.handleStorageSet.bind(this));
    ipcMain.handle('storage:remove', this.handleStorageRemove.bind(this));
    ipcMain.handle('storage:clear', this.handleStorageClear.bind(this));

    // ========== DIALOG HANDLERS ==========
    ipcMain.handle('dialog:showError', this.handleShowError.bind(this));
    ipcMain.handle('dialog:showInfo', this.handleShowInfo.bind(this));
    ipcMain.handle('dialog:showQuestion', this.handleShowQuestion.bind(this));

    // ========== APP HANDLERS ==========
    ipcMain.handle('app:getVersion', this.handleGetVersion.bind(this));
    ipcMain.handle('app:getPath', this.handleGetPath.bind(this));
    ipcMain.handle('app:quit', this.handleAppQuit.bind(this));
    ipcMain.handle('app:minimize', this.handleMinimize.bind(this));
    ipcMain.handle('app:maximize', this.handleMaximize.bind(this));
    ipcMain.handle('app:close', this.handleClose.bind(this));

    this.log.info('All IPC handlers registered successfully');
  }

  // ========== AUTHENTICATION HANDLERS ==========

  async handleLogin(event, { email, password, device_name }) {
    try {
      const response = await this.apiManager.login(email, password, device_name);
      this.log.info(`User logged in: ${email} on device: ${device_name}`);
      return response;
    } catch (error) {
      this.log.error('Login failed:', error.message);
      throw error;
    }
  }

  async handleLogout(event) {
    try {
      await this.apiManager.logout();
      this.log.info('User logged out');
    } catch (error) {
      this.log.error('Logout failed:', error.message);
      throw error;
    }
  }

  async handleGetCurrentUser(event) {
    try {
      const user = await this.apiManager.getCurrentUser();
      return user;
    } catch (error) {
      this.log.error('Failed to get current user:', error.message);
      return null;
    }
  }

  async handleRefreshToken(event) {
    try {
      const response = await this.apiManager.refreshToken();
      this.log.info('Token refreshed');
      return response;
    } catch (error) {
      this.log.error('Token refresh failed:', error.message);
      throw error;
    }
  }

  async handleSaveToken(event, token) {
    try {
      if (this.tokenManager) {
        // Extract expiration if provided
        const expiresIn = event?.expiresIn || null;
        await this.tokenManager.setAuthToken(token, expiresIn);
      } else {
        // Fallback to apiManager if tokenManager not available
        await this.apiManager.setAuthToken(token);
      }
      return { success: true };
    } catch (error) {
      this.log.error('Failed to save token:', error.message);
      throw error;
    }
  }

  /**
   * Get token info WITHOUT exposing the actual token
   * Returns: { hasToken: boolean, expiresAt: timestamp, secondsRemaining: number, storageBackend: string }
   */
  async handleGetTokenInfo(event) {
    try {
      if (!this.tokenManager) {
        return { hasToken: false, error: 'TokenManager not initialized' };
      }
      
      const tokenInfo = this.tokenManager.getTokenInfo();
      this.log.debug('Token info retrieved (no sensitive data exposed)');
      return tokenInfo;
    } catch (error) {
      this.log.error('Failed to get token info:', error.message);
      throw error;
    }
  }

  /**
   * Check if token is expired
   */
  async handleIsTokenExpired(event) {
    try {
      if (!this.tokenManager) {
        return true; // Treat as expired if no token manager
      }
      
      const isExpired = this.tokenManager.isTokenExpired();
      return { isExpired };
    } catch (error) {
      this.log.error('Failed to check token expiry:', error.message);
      throw error;
    }
  }

  /**
   * Get seconds remaining until token expires
   */
  async handleGetTokenExpirySeconds(event) {
    try {
      if (!this.tokenManager) {
        return { secondsRemaining: 0 };
      }
      
      const secondsRemaining = this.tokenManager.getTokenTimeRemaining();
      return { secondsRemaining };
    } catch (error) {
      this.log.error('Failed to get token expiry seconds:', error.message);
      throw error;
    }
  }

  /**
   * Clear all tokens (called on logout)
   */
  async handleClearTokens(event) {
    try {
      if (this.tokenManager) {
        await this.tokenManager.clearAllTokens();
      }
      return { success: true };
    } catch (error) {
      this.log.error('Failed to clear tokens:', error.message);
      throw error;
    }
  }

  // ========== HEALTH HANDLERS ==========

  async handleHealthCheck(event) {
    try {
      const health = await this.apiManager.healthCheck();
      return health;
    } catch (error) {
      this.log.error('Health check failed:', error.message);
      throw error;
    }
  }

  async handleGetDetailedHealth(event) {
    try {
      const health = await this.apiManager.getDetailedHealth();
      return health;
    } catch (error) {
      this.log.error('Detailed health check failed:', error.message);
      throw error;
    }
  }

  async handleGetLiveProbe(event) {
    try {
      const probe = await this.apiManager.getLiveProbe();
      return probe;
    } catch (error) {
      this.log.error('Live probe failed:', error.message);
      throw error;
    }
  }

  async handleGetReadyProbe(event) {
    try {
      const probe = await this.apiManager.getReadyProbe();
      return probe;
    } catch (error) {
      this.log.error('Ready probe failed:', error.message);
      throw error;
    }
  }

  // ========== VERSION HANDLERS ==========

  async handleGetCurrentVersion(event) {
    try {
      const version = await this.apiManager.getCurrentVersion();
      return version;
    } catch (error) {
      this.log.error('Get current version failed:', error.message);
      throw error;
    }
  }

  async handleGetDetailedVersion(event) {
    try {
      const version = await this.apiManager.getDetailedVersion();
      return version;
    } catch (error) {
      this.log.error('Get detailed version failed:', error.message);
      throw error;
    }
  }

  async handleCheckCompatibility(event, clientVersion) {
    try {
      const compatibility = await this.apiManager.checkCompatibility('electron', clientVersion);
      return compatibility;
    } catch (error) {
      this.log.error('Check compatibility failed:', error.message);
      throw error;
    }
  }

  async handleGetChangelog(event, limit) {
    try {
      const changelog = await this.apiManager.getChangelog(limit);
      return changelog;
    } catch (error) {
      this.log.error('Get changelog failed:', error.message);
      throw error;
    }
  }

  // ========== PRODUCTS HANDLERS ==========

  async handleGetProducts(event, params) {
    try {
      const products = await this.apiManager.getProducts(params);
      return products;
    } catch (error) {
      this.log.error('Get products failed:', error.message);
      throw error;
    }
  }

  async handleGetProduct(event, id) {
    try {
      const product = await this.apiManager.getProduct(id);
      return product;
    } catch (error) {
      this.log.error('Get product failed:', error.message);
      throw error;
    }
  }

  async handleCreateProduct(event, data) {
    try {
      const product = await this.apiManager.createProduct(data);
      return product;
    } catch (error) {
      this.log.error('Create product failed:', error.message);
      throw error;
    }
  }

  async handleUpdateProduct(event, { id, data }) {
    try {
      const product = await this.apiManager.updateProduct(id, data);
      return product;
    } catch (error) {
      this.log.error('Update product failed:', error.message);
      throw error;
    }
  }

  async handleDeleteProduct(event, id) {
    try {
      await this.apiManager.deleteProduct(id);
      return { success: true };
    } catch (error) {
      this.log.error('Delete product failed:', error.message);
      throw error;
    }
  }

  // ========== ORDERS HANDLERS ==========

  async handleGetOrders(event, params) {
    try {
      const orders = await this.apiManager.getOrders(params);
      return orders;
    } catch (error) {
      this.log.error('Get orders failed:', error.message);
      throw error;
    }
  }

  async handleGetOrder(event, id) {
    try {
      const order = await this.apiManager.getOrder(id);
      return order;
    } catch (error) {
      this.log.error('Get order failed:', error.message);
      throw error;
    }
  }

  async handleCreateOrder(event, data) {
    try {
      const order = await this.apiManager.createOrder(data);
      return order;
    } catch (error) {
      this.log.error('Create order failed:', error.message);
      throw error;
    }
  }

  async handleUpdateOrder(event, { id, data }) {
    try {
      const order = await this.apiManager.updateOrder(id, data);
      return order;
    } catch (error) {
      this.log.error('Update order failed:', error.message);
      throw error;
    }
  }

  async handleCancelOrder(event, id) {
    try {
      const result = await this.apiManager.cancelOrder(id);
      return result;
    } catch (error) {
      this.log.error('Cancel order failed:', error.message);
      throw error;
    }
  }

  async handleCheckoutOrder(event, data) {
    try {
      const result = await this.apiManager.checkoutOrder(data);
      return result;
    } catch (error) {
      this.log.error('Checkout order failed:', error.message);
      throw error;
    }
  }

  // ========== PAYMENTS HANDLERS ==========

  async handleProcessPayment(event, data) {
    try {
      const payment = await this.apiManager.processPayment(data);
      return payment;
    } catch (error) {
      this.log.error('Process payment failed:', error.message);
      throw error;
    }
  }

  async handleGetPaymentHistory(event, params) {
    try {
      const history = await this.apiManager.getPaymentHistory(params);
      return history;
    } catch (error) {
      this.log.error('Get payment history failed:', error.message);
      throw error;
    }
  }

  async handleRefundPayment(event, paymentId) {
    try {
      const result = await this.apiManager.refundPayment(paymentId);
      return result;
    } catch (error) {
      this.log.error('Refund payment failed:', error.message);
      throw error;
    }
  }

  // ========== REPORTS HANDLERS ==========

  async handleGetSalesReport(event, params) {
    try {
      const report = await this.apiManager.getSalesReport(params);
      return report;
    } catch (error) {
      this.log.error('Get sales report failed:', error.message);
      throw error;
    }
  }

  async handleGetInventoryReport(event, params) {
    try {
      const report = await this.apiManager.getInventoryReport(params);
      return report;
    } catch (error) {
      this.log.error('Get inventory report failed:', error.message);
      throw error;
    }
  }

  async handleGetTopProductsReport(event, params) {
    try {
      const report = await this.apiManager.getTopProductsReport(params);
      return report;
    } catch (error) {
      this.log.error('Get top products report failed:', error.message);
      throw error;
    }
  }

  async handleGetCashFlowReport(event, params) {
    try {
      const report = await this.apiManager.getCashFlowReport(params);
      return report;
    } catch (error) {
      this.log.error('Get cash flow report failed:', error.message);
      throw error;
    }
  }

  // ========== STORAGE HANDLERS ==========

  async handleStorageGet(event, key) {
    try {
      const value = this.store.get(key);
      return value;
    } catch (error) {
      this.log.error('Storage get failed:', error.message);
      throw error;
    }
  }

  async handleStorageSet(event, { key, value }) {
    try {
      this.store.set(key, value);
      return { success: true };
    } catch (error) {
      this.log.error('Storage set failed:', error.message);
      throw error;
    }
  }

  async handleStorageRemove(event, key) {
    try {
      this.store.delete(key);
      return { success: true };
    } catch (error) {
      this.log.error('Storage remove failed:', error.message);
      throw error;
    }
  }

  async handleStorageClear(event) {
    try {
      this.store.clear();
      return { success: true };
    } catch (error) {
      this.log.error('Storage clear failed:', error.message);
      throw error;
    }
  }

  // ========== DIALOG HANDLERS ==========

  async handleShowError(event, { title, message }) {
    return await dialog.showMessageBox({
      type: 'error',
      title,
      message
    });
  }

  async handleShowInfo(event, { title, message }) {
    return await dialog.showMessageBox({
      type: 'info',
      title,
      message
    });
  }

  async handleShowQuestion(event, { title, message }) {
    return await dialog.showMessageBox({
      type: 'question',
      title,
      message,
      buttons: ['Yes', 'No']
    });
  }

  // ========== APP HANDLERS ==========

  async handleGetVersion(event) {
    return app.getVersion();
  }

  async handleGetPath(event, name) {
    return app.getPath(name);
  }

  async handleAppQuit(event) {
    app.quit();
  }

  async handleMinimize(event) {
    const focusedWindow = require('electron').BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.minimize();
    }
  }

  async handleMaximize(event) {
    const focusedWindow = require('electron').BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.maximize();
    }
  }

  async handleClose(event) {
    const focusedWindow = require('electron').BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.close();
    }
  }
}

module.exports = IpcHandler;
