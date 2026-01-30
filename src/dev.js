/**
 * Electron development entry point
 * This file is only used during development
 */

if (require('electron-squirrel-startup')) {
  process.exit(0);
}

const isDev = require('electron-is-dev');

if (isDev && process.argv.length >= 2) {
  const devtools = require('electron-devtools-installer');
  devtools.default(devtools.REACT_DEVELOPER_TOOLS);
  devtools.default(devtools.REDUX_DEVTOOLS);
}

// Start the app
require('./main.js');
