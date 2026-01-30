/**
 * Security Configuration
 * Production-ready security settings for Electron application
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const securityConfig = {
  // Content Security Policy
  contentSecurityPolicy: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-eval'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'", 'http://localhost:8000', 'https://api.possystem.com'],
    'frame-src': ["'none'"],
    'object-src': ["'none'"],
    'media-src': ["'self'"],
    'worker-src': ["'self'"]
  },

  // HTTP Headers
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': [
      'geolocation=()',
      'microphone=()',
      'camera=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()'
    ].join(', ')
  },

  // Preload Script Options
  preloadScript: {
    // Path to preload script (relative to src/)
    path: 'preload.js',
    // Context isolation must be enabled
    contextIsolation: true,
    // Node integration must be disabled
    nodeIntegration: false,
    // Sandbox must be enabled
    sandbox: true,
    // Remote module must be disabled
    enableRemoteModule: false
  },

  // IPC Channel Whitelist
  ipcChannels: {
    // Authentication
    auth: [
      'auth:login',
      'auth:logout',
      'auth:getCurrentUser',
      'auth:refreshToken',
      'auth:saveToken'
    ],
    // Health
    health: [
      'health:check',
      'health:getDetailed',
      'health:getLive',
      'health:getReady'
    ],
    // Version
    version: [
      'version:getCurrent',
      'version:getDetailed',
      'version:checkCompatibility',
      'version:getChangelog'
    ],
    // Products
    products: [
      'products:getAll',
      'products:getById',
      'products:create',
      'products:update',
      'products:delete'
    ],
    // Orders
    orders: [
      'orders:getAll',
      'orders:getById',
      'orders:create',
      'orders:update',
      'orders:cancel',
      'orders:checkout'
    ],
    // Payments
    payments: [
      'payments:process',
      'payments:getHistory',
      'payments:refund'
    ],
    // Reports
    reports: [
      'reports:sales',
      'reports:inventory',
      'reports:topProducts',
      'reports:cashFlow'
    ],
    // Storage
    storage: [
      'storage:get',
      'storage:set',
      'storage:remove',
      'storage:clear'
    ],
    // Dialog
    dialog: [
      'dialog:showError',
      'dialog:showInfo',
      'dialog:showQuestion'
    ],
    // App
    app: [
      'app:getVersion',
      'app:getPath',
      'app:quit',
      'app:minimize',
      'app:maximize',
      'app:close'
    ]
  },

  // API Configuration
  api: {
    // Only allow HTTPS in production
    httpsOnly: IS_PRODUCTION,
    // Certificate pinning (add your server certificate hash)
    certificatePins: [],
    // Allowed origins
    allowedOrigins: IS_PRODUCTION
      ? ['https://api.possystem.com']
      : ['http://localhost:8000', 'http://127.0.0.1:8000'],
    // Timeout in ms
    timeout: 30000,
    // Max retries
    maxRetries: 3
  },

  // File System Access
  fileSystem: {
    // Only allow specific directories
    allowedPaths: [
      // User documents
      'documents',
      // User desktop
      'desktop',
      // User temp
      'temp'
    ],
    // Blocked paths (never allow)
    blockedPaths: [
      'appData',
      'userData',
      'cache',
      'logs',
      'executable'
    ]
  },

  // DevTools
  devTools: {
    // Enable in development only
    enabled: !IS_PRODUCTION,
    // Don't allow enabling from within app
    allowEnableFromApp: false
  },

  // Rate Limiting
  rateLimit: {
    // Max login attempts
    loginAttempts: 5,
    // Login attempt window (ms)
    loginWindow: 15 * 60 * 1000, // 15 minutes
    // API request rate limit (requests per minute)
    apiRequestLimit: 100
  },

  // Token Security
  token: {
    // Token refresh before expiry (ms)
    refreshBefore: 5 * 60 * 1000, // 5 minutes before expiry
    // Secure cookie options
    cookieOptions: {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
  },

  // Logging
  logging: {
    // Log level (debug, info, warn, error)
    level: IS_PRODUCTION ? 'warn' : 'debug',
    // Max log file size (MB)
    maxSize: 10,
    // Max log files to keep
    maxFiles: 5
  }
};

module.exports = securityConfig;
