const { contextBridge, ipcRenderer } = require('electron');
const log = require('electron-log');

/**
 * Preload script - Runs in isolated context before renderer process loads
 * This provides secure IPC bridge between main and renderer processes
 */

// Validate that we're in preload context
if (process.contextIsolated) {
  log.info('Preload script: Context isolation enabled - SECURE');
} else {
  log.error('Preload script: Context isolation NOT enabled - INSECURE');
}

// Define secure API for renderer process
const secureApi = {
  /**
   * Authentication APIs
   */
  auth: {
    login: (credentials) => {
      // Support both old format and new format with device_name
      if (typeof credentials === 'string') {
        // Old format: login(email, password)
        const email = credentials;
        const password = arguments[1];
        return ipcRenderer.invoke('auth:login', { email, password });
      }
      // New format: login({email, password, device_name})
      return ipcRenderer.invoke('auth:login', credentials);
    },
    logout: () => ipcRenderer.invoke('auth:logout'),
    getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
    refreshToken: () => ipcRenderer.invoke('auth:refreshToken'),
    saveToken: (token) => ipcRenderer.invoke('auth:saveToken', token),
    getTokenInfo: () => ipcRenderer.invoke('auth:getTokenInfo'),
    isTokenExpired: () => ipcRenderer.invoke('auth:isTokenExpired'),
    clearTokens: () => ipcRenderer.invoke('auth:clearTokens')
  },

  /**
   * Health Check APIs
   */
  health: {
    check: () => ipcRenderer.invoke('health:check'),
    getDetailed: () => ipcRenderer.invoke('health:getDetailed'),
    getLive: () => ipcRenderer.invoke('health:getLive'),
    getReady: () => ipcRenderer.invoke('health:getReady')
  },

  /**
   * Version APIs
   */
  version: {
    getCurrent: () => ipcRenderer.invoke('version:getCurrent'),
    getDetailed: () => ipcRenderer.invoke('version:getDetailed'),
    checkCompatibility: (clientVersion) =>
      ipcRenderer.invoke('version:checkCompatibility', clientVersion),
    getChangelog: (limit) => ipcRenderer.invoke('version:getChangelog', limit)
  },

  /**
   * Product APIs
   */
  products: {
    getAll: (params) => ipcRenderer.invoke('products:getAll', params),
    getById: (id) => ipcRenderer.invoke('products:getById', id),
    create: (data) => ipcRenderer.invoke('products:create', data),
    update: (id, data) => ipcRenderer.invoke('products:update', { id, data }),
    delete: (id) => ipcRenderer.invoke('products:delete', id)
  },

  /**
   * Order APIs
   */
  orders: {
    getAll: (params) => ipcRenderer.invoke('orders:getAll', params),
    getById: (id) => ipcRenderer.invoke('orders:getById', id),
    create: (data) => ipcRenderer.invoke('orders:create', data),
    update: (id, data) => ipcRenderer.invoke('orders:update', { id, data }),
    cancel: (id) => ipcRenderer.invoke('orders:cancel', id),
    checkout: (data) => ipcRenderer.invoke('orders:checkout', data)
  },

  /**
   * Payment APIs
   */
  payments: {
    process: (data) => ipcRenderer.invoke('payments:process', data),
    getHistory: (params) => ipcRenderer.invoke('payments:getHistory', params),
    refund: (id) => ipcRenderer.invoke('payments:refund', id)
  },

  /**
   * Reports APIs
   */
  reports: {
    sales: (params) => ipcRenderer.invoke('reports:sales', params),
    inventory: (params) => ipcRenderer.invoke('reports:inventory', params),
    topProducts: (params) => ipcRenderer.invoke('reports:topProducts', params),
    cashFlow: (params) => ipcRenderer.invoke('reports:cashFlow', params)
  },

  /**
   * Storage APIs (secure local storage)
   */
  storage: {
    get: (key) => ipcRenderer.invoke('storage:get', key),
    set: (key, value) => ipcRenderer.invoke('storage:set', { key, value }),
    remove: (key) => ipcRenderer.invoke('storage:remove', key),
    clear: () => ipcRenderer.invoke('storage:clear')
  },

  /**
   * Dialog APIs
   */
  dialog: {
    showError: (title, message) => ipcRenderer.invoke('dialog:showError', { title, message }),
    showInfo: (title, message) => ipcRenderer.invoke('dialog:showInfo', { title, message }),
    showQuestion: (title, message) => ipcRenderer.invoke('dialog:showQuestion', { title, message })
  },

  /**
   * App APIs
   */
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPath: (name) => ipcRenderer.invoke('app:getPath', name),
    quit: () => ipcRenderer.invoke('app:quit'),
    minimize: () => ipcRenderer.invoke('app:minimize'),
    maximize: () => ipcRenderer.invoke('app:maximize'),
    close: () => ipcRenderer.invoke('app:close')
  },

  /**
   * Event listeners
   */
  on: (channel, callback) => {
    // Whitelist allowed channels for security
    const allowedChannels = [
      'auth:loggedIn',
      'auth:loggedOut',
      'sync:complete',
      'error:occurred',
      'update:available'
    ];

    if (allowedChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    } else {
      log.warn(`Attempt to listen on unauthorized channel: ${channel}`);
    }
  },

  /**
   * Remove event listener
   */
  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  }
};

// Expose secure API via context bridge
contextBridge.exposeInMainWorld('pos', secureApi);

// Log when preload is ready
log.info('Preload script loaded and API exposed to renderer process');
