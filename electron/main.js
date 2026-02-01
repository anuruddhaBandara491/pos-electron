const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.disableHardwareAcceleration(); // 🔥 FIX GPU crash

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }
}

/**
 * ================================
 * IPC HANDLERS
 * ================================
 */

// Example: get current logged-in user
ipcMain.handle('auth:getCurrentUser', async () => {
  try {
    // 🔹 Replace this with real logic later
    // e.g. read from session, token, file, DB, etc.
    return {
      id: 1,
      name: 'Admin',
      role: 'cashier',
    };
  } catch (error) {
    console.error('Failed to get current user:', error);
    throw error;
  }
});

/**
 * ================================
 * APP LIFECYCLE
 * ================================
 */

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
