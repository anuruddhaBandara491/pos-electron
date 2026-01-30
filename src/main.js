const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const log = require('electron-log');
const Store = require('electron-store');
const SecurityManager = require('./security/SecurityManager');
const IpcHandler = require('./ipc/IpcHandler');
const ApiManager = require('./api/ApiManager');
const VersionService = require('./services/VersionService');

// Check if in development mode
// isDev = true only if ELECTRON_DEV env var is explicitly set to 'true' or NODE_ENV is 'development'
const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === 'true';

log.info(`[MAIN] App starting in ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);

// Create persistent storage
const store = new Store({
  schema: {
    windowBounds: {
      type: 'object',
      properties: {
        width: { type: 'number' },
        height: { type: 'number' },
        x: { type: 'number' },
        y: { type: 'number' }
      },
      default: {
        width: 1200,
        height: 800
      }
    },
    authToken: {
      type: 'string',
      default: ''
    },
    apiUrl: {
      type: 'string',
      default: ''
    },
    theme: {
      type: 'string',
      default: 'light'
    }
  }
});

// Initialize managers
const securityManager = new SecurityManager(log);
const ipcHandler = new IpcHandler(log, store);
const apiManager = new ApiManager(log, store);
const versionService = new VersionService(apiManager, log);

let mainWindow;
let appMenu;

/**
 * Setup Global Error Handlers
 * 
 * Prevent app crashes and log all errors for debugging
 */
function setupGlobalErrorHandlers() {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    log.error('[CRITICAL] Uncaught Exception:', error);
    
    // Try to show error dialog
    if (mainWindow) {
      dialog.showErrorBox(
        'Application Error',
        'An unexpected error occurred. The error has been logged.'
      );
    }

    // Don't exit - keep app running unless it's a critical error
    if (error.message && error.message.includes('FATAL')) {
      process.exit(1);
    }
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    log.error('[WARNING] Unhandled Promise Rejection:', {
      reason: reason?.message || String(reason),
      stack: reason?.stack,
      promise: String(promise)
    });

    // Try to recover from promise rejection
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('error:unhandledRejection', {
        message: reason?.message || String(reason),
        code: reason?.code || 'UNHANDLED_REJECTION'
      });
    }
  });

  // Handle renderer process crashes
  if (mainWindow) {
    mainWindow.webContents.on('crashed', () => {
      log.error('[CRITICAL] Renderer process crashed');
      
      dialog.showErrorBox(
        'Renderer Error',
        'The application encountered an error. Please restart.'
      );

      // Restart the renderer
      if (mainWindow) {
        mainWindow.reload();
      }
    });

    mainWindow.webContents.on('unresponsive', () => {
      log.warn('[WARNING] Renderer process unresponsive');
      
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Application Not Responding',
        message: 'The application is not responding. Would you like to force close it?',
        buttons: ['Wait', 'Close'],
        defaultId: 0,
        cancelId: 1
      }).then(result => {
        if (result.response === 1) {
          mainWindow.destroy();
        }
      });
    });

    mainWindow.webContents.on('responsive', () => {
      log.info('[INFO] Renderer process responsive again');
    });
  }

  log.info('[INFO] Global error handlers configured');
}

/**
 * Create the main application window
 */
async function createWindow() {
  // Setup global error handlers before creating window
  setupGlobalErrorHandlers();

  try {
    const windowBounds = store.get('windowBounds');

    mainWindow = new BrowserWindow({
      width: windowBounds.width || 1200,
      height: windowBounds.height || 800,
      x: windowBounds.x,
      y: windowBounds.y,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        // Security: Disable nodeIntegration
        nodeIntegration: false,
        // Security: Enable contextIsolation
        contextIsolation: true,
        // Security: Use preload script for IPC
        preload: path.join(__dirname, 'preload.js'),
        // Security: Disable experimental features
        experimentalFeatures: false,
        enableRemoteModule: false,
        // Sandbox enabled for security
        sandbox: true
      },
      icon: path.join(__dirname, '..', 'public', 'icon.png')
    });

    // Load the app URL
    const startUrl = isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '..', 'build', 'index.html')}`;

    log.info(`[MAIN] Loading URL: ${startUrl}`);
    await mainWindow.loadURL(startUrl);
    log.info('[MAIN] URL loaded successfully');

    // Initialize version checking (important: do after window creation but before showing)
    try {
      const packageJson = require('../package.json');
      await versionService.initialize(packageJson.version);
      
      // Set up listener for critical version incompatibility
      versionService.on('incompatibleVersion', (status) => {
        if (status.isCritical) {
          log.warn('[VERSION] Critical version incompatibility detected:', status);
          
          // Notify renderer process about critical version issue
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('version:critical', status);
          }
        }
      });

      // Set up listener for general version check errors
      versionService.on('versionCheckError', (error) => {
        log.error('[VERSION] Version check error:', error);
      });

      log.info('[VERSION] Version service initialized successfully');
    } catch (versionError) {
      log.warn('[VERSION] Failed to initialize version service:', versionError);
      // Don't fail app startup if version check fails - it's not critical
    }

    // Save window bounds on resize/move
    mainWindow.on('resized', () => {
      const bounds = mainWindow.getBounds();
      store.set('windowBounds', bounds);
    });

    mainWindow.on('moved', () => {
      const bounds = mainWindow.getBounds();
      store.set('windowBounds', bounds);
    });

    // Handle window closed
    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    // Handle page load failures
    mainWindow.webContents.on('crashed', () => {
      log.error('[MAIN] Renderer process crashed');
      dialog.showErrorBox('Error', 'Renderer process crashed');
    });

    mainWindow.webContents.on('render-process-gone', () => {
      log.error('[MAIN] Render process gone');
      dialog.showErrorBox('Error', 'Render process gone');
    });

    // Log any console messages from the renderer
    mainWindow.webContents.on('console-message', (level, message, line, sourceId) => {
      log.info(`[RENDERER Console] Level ${level}: ${message} (${sourceId}:${line})`);
    });

    // Open DevTools for debugging (disable if not needed)
    setTimeout(() => {
      mainWindow.webContents.openDevTools();
    }, 1000);

    // Verify security settings
    securityManager.verifySecuritySettings(mainWindow);

    log.info('Main window created successfully');
  } catch (error) {
    log.error('Error creating window:', error);
    dialog.showErrorBox('Error', 'Failed to create application window');
  }
}

/**
 * Create application menu
 */
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About POS System',
              message: 'POS System Desktop Application',
              detail: `Version: ${app.getVersion()}\nPlatform: ${process.platform}`
            });
          }
        }
      ]
    }
  ];

  appMenu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(appMenu);
}

/**
 * Handle app ready event
 */
app.on('ready', async () => {
  try {
    // Initialize IPC handlers
    ipcHandler.registerHandlers(mainWindow, apiManager);

    // Register version service IPC handlers
    ipcMain.handle('version:checkVersion', async () => {
      try {
        await versionService.checkVersion();
        return versionService.getCompatibilityStatus();
      } catch (error) {
        log.error('Error checking version via IPC:', error);
        throw error;
      }
    });

    ipcMain.handle('version:forceCheck', async () => {
      try {
        await versionService.forceCheckVersion();
        return versionService.getCompatibilityStatus();
      } catch (error) {
        log.error('Error forcing version check via IPC:', error);
        throw error;
      }
    });

    ipcMain.handle('version:getStatus', () => {
      return versionService.getCompatibilityStatus();
    });

    ipcMain.handle('version:getVersionInfo', () => {
      return versionService.getVersionInfo();
    });

    // Create window and menu
    await createWindow();
    createMenu();

    // Setup API manager with stored token
    const storedToken = store.get('authToken');
    if (storedToken) {
      apiManager.setAuthToken(storedToken);
    }

    log.info('Application ready');
  } catch (error) {
    log.error('Error during app ready:', error);
    app.quit();
  }
});

/**
 * Handle app quit
 */
app.on('window-all-closed', () => {
  // On macOS, applications typically stay active until user quits
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Handle app activation (macOS)
 */
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

/**
 * Handle any uncaught exceptions
 */
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
  dialog.showErrorBox('Error', 'An unexpected error occurred');
});

/**
 * Handle before-quit event
 */
app.on('before-quit', () => {
  log.info('Application closing');
});

// Export for testing
module.exports = { app, createWindow, mainWindow };
