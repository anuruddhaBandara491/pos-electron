const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');

app.disableHardwareAcceleration(); // 🔥 FIX GPU crash

let mainWindow;
let authToken = null;
let cachedUser = null;

const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api/v1';

const extractAuthPayload = (data) => {
  if (!data) return { user: null, token: null };

  const token = data.token || data.access_token || data.data?.token || data.data?.access_token || null;
  const user = data.user || data.data?.user || data.data?.data?.user || data.data || null;

  return { user, token };
};

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
    // In development, wait a moment for React dev server to start
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
    
    // Retry loading if connection is refused (dev server not ready)
    mainWindow.webContents.on('did-fail-load', () => {
      console.log('[Electron] Dev server not ready, retrying in 2 seconds...');
      setTimeout(() => {
        mainWindow.loadURL('http://localhost:3000');
      }, 2000);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }
}

/**
 * ================================
 * IPC HANDLERS
 * ================================
 */

// Auth: Login
ipcMain.handle('auth:login', async (_event, credentials) => {
  try {
    console.log('[IPC] Login attempt for:', credentials.email || credentials.username);

    const response = await axios.post(`${apiUrl}/auth/login`, credentials, {
      timeout: 10000,
    });

    console.log('[IPC] Login successful');

    const { user, token } = extractAuthPayload(response.data);
    if (!user) {
      throw new Error('Login succeeded but user data is missing');
    }

    if (token) {
      authToken = token;
    }
    cachedUser = user;

    return {
      success: true,
      user,
      token: token || null,
    };
  } catch (error) {
    console.error('[IPC] Login failed:', error.message);
    throw new Error(error.response?.data?.message || 'Login failed');
  }
});

// Auth: Logout
ipcMain.handle('auth:logout', async () => {
  try {
    console.log('[IPC] Logout request');

    if (authToken) {
      await axios.post(`${apiUrl}/auth/logout`, null, {
        timeout: 10000,
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
    }

    authToken = null;
    cachedUser = null;

    console.log('[IPC] Logout successful');

    return {
      success: true,
      message: 'Logged out successfully',
    };
  } catch (error) {
    console.error('[IPC] Logout failed:', error.message);
    authToken = null;
    cachedUser = null;
    return {
      success: false,
      error: error.message,
    };
  }
});

// Auth: Get current user
ipcMain.handle('auth:getCurrentUser', async () => {
  try {
    if (!authToken) {
      return cachedUser;
    }

    const response = await axios.get(`${apiUrl}/auth/me`, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    const { user } = extractAuthPayload(response.data);
    cachedUser = user || null;
    return cachedUser;
  } catch (error) {
    console.error('Failed to get current user:', error.message);
    return null;
  }
});

// Health check handler
ipcMain.handle('health:check', async () => {
  try {
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
