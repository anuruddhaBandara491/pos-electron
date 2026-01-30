import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * Safe logger that wraps Electron IPC bridge
 * Falls back to console if preload is not ready
 */
function createLogger() {
  if (window.pos) {
    return {
      info: window.pos.logInfo,
      error: window.pos.logError,
      warn: (msg) => window.pos.logInfo(`WARN: ${msg}`),
    };
  } else {
    console.warn('⚠️ Secure IPC bridge not available yet');
    return {
      info: console.log,
      error: console.error,
      warn: console.warn,
    };
  }
}

const logger = createLogger();

logger.info('Starting React application...');

// Verify secure context
if (window.pos) {
  logger.info('Secure IPC bridge loaded successfully');
} else {
  logger.warn('CRITICAL: Secure IPC bridge not available - running in fallback mode');
}

// Wait for DOM to load before mounting React app
document.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    logger.error('Root element not found');
    return;
  }

  const root = ReactDOM.createRoot(rootElement);

  try {
    logger.info('Attempting to render App component...');
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    logger.info('React application mounted successfully');
  } catch (error) {
    logger.error('Failed to mount React application:', error);
    document.body.innerHTML = `<h1>Error: ${error.message}</h1><pre>${error.stack}</pre>`;
  }

  logger.info('React application initialization complete');
});
