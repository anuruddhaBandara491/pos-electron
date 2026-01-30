const { app, BrowserWindow } = require('electron');
const path = require('path');

app.disableHardwareAcceleration(); // 🔥 FIX GPU crash

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools(); // 👈 DevTools
  } else {
    win.loadFile(path.join(__dirname, '../build/index.html'));
  }
}

app.whenReady().then(createWindow);
