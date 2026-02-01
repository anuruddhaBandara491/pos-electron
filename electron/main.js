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

// Health check handler
ipcMain.handle('health:check', async () => {
  try {
    const axios = require('axios');
    const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api/v1';
    
    console.log('[IPC] Health check - calling:', `${apiUrl}/health`);
    
    const response = await axios.get(`${apiUrl}/health`, {
      timeout: 5000,
      validateStatus: (status) => status < 500, // Accept any status < 500
    });
    
    console.log('[IPC] Health check response:', response.status, response.data);
    
    return {
      ok: response.status === 200,
      status: response.status,
      data: response.data,
    };
  } catch (error) {
    console.log('[IPC] Health check failed:', error.message);
    return {
      ok: false,
      status: error.response?.status || 0,
      error: error.message,
    };
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
