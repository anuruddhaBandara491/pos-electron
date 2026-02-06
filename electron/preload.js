const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script
 * Exposes a secure IPC bridge to the renderer
 */

// Security check
if (process.contextIsolated) {
  console.log('[PRELOAD] Context isolation enabled ✅');
} else {
  console.error('[PRELOAD] Context isolation DISABLED ❌');
}

/**
 * Secure API exposed to renderer
 */
const secureApi = {
  /* ==========
     LOGGING API
     ========== */
  logInfo: (message) => {
    console.log('[RENDERER]', message);
  },
  logWarn: (message) => {
    console.warn('[RENDERER]', message);
  },
  logError: (message) => {
    console.error('[RENDERER]', message);
  },

  /* ==========
     AUTH APIs
     ========== */
  auth: {
    login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
  },

  /* ==========
     HEALTH APIs
     ========== */
  health: {
    check: () => ipcRenderer.invoke('health:check'),
  },

  /* ==========
     PRODUCTS APIs
     ========== */
  products: {
    getAll: (params) => ipcRenderer.invoke('products:getAll', params),
    quickSearch: (query) => ipcRenderer.invoke('products:quickSearch', query),
    getById: (id) => ipcRenderer.invoke('products:getById', id),
    create: (product) => ipcRenderer.invoke('products:create', product),
    update: (id, product) => ipcRenderer.invoke('products:update', id, product),
    delete: (id) => ipcRenderer.invoke('products:delete', id),
    toggleStatus: (id) => ipcRenderer.invoke('products:toggleStatus', id),
  },

  /* ==========
     CATEGORIES APIs
     ========== */
  categories: {
    getAll: (params) => ipcRenderer.invoke('categories:getAll', params),
    getById: (id) => ipcRenderer.invoke('categories:getById', id),
    create: (category) => ipcRenderer.invoke('categories:create', category),
    update: (id, category) => ipcRenderer.invoke('categories:update', id, category),
    delete: (id) => ipcRenderer.invoke('categories:delete', id),
  },

  /* ==========
     ORDERS APIs
     ========== */
  orders: {
    create: (order) => ipcRenderer.invoke('orders:create', order),
    getAll: (params) => ipcRenderer.invoke('orders:getAll', params),
    getById: (id) => ipcRenderer.invoke('orders:getById', id),
    complete: (id) => ipcRenderer.invoke('orders:complete', id),
    cancel: (id) => ipcRenderer.invoke('orders:cancel', id),
    addItem: (orderId, item) => ipcRenderer.invoke('orders:addItem', orderId, item),
    removeItem: (orderId, itemId) => ipcRenderer.invoke('orders:removeItem', orderId, itemId),
    quickAddItem: (orderId, item) => ipcRenderer.invoke('orders:quickAddItem', orderId, item),
    quickPay: (orderId, paymentData) => ipcRenderer.invoke('orders:quickPay', orderId, paymentData),
    getSummary: (orderId) => ipcRenderer.invoke('orders:getSummary', orderId),
    getPayments: (orderId) => ipcRenderer.invoke('orders:getPayments', orderId),
    getPaymentsSummary: (orderId) => ipcRenderer.invoke('orders:getPaymentsSummary', orderId),
    refundPayment: (orderId, refundData) => ipcRenderer.invoke('orders:refundPayment', orderId, refundData),
    quickCheckout: (orderData) => ipcRenderer.invoke('orders:quickCheckout', orderData),
  },

  /* ==========
     APP APIs
     ========== */
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    quit: () => ipcRenderer.invoke('app:quit'),
  },

  /* ==========
     EVENT API
     ========== */
  on: (channel, callback) => {
    const allowedChannels = [
      'auth:loggedIn',
      'auth:loggedOut',
      'error:unhandledRejection',
    ];

    if (allowedChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    } else {
      console.warn('[PRELOAD] Blocked channel:', channel);
    }
  },

  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  },
};

// Expose API
contextBridge.exposeInMainWorld('pos', secureApi);

console.log('[PRELOAD] Secure IPC bridge exposed ✅');
