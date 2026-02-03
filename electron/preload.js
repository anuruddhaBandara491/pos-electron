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
