import React, { useState, useEffect } from 'react';
import log from '../utils/logger';
import '../styles/OfflineModeBanner.css';

/**
 * Offline Mode Banner Component
 * Displays a prominent warning when backend is unreachable
 * Alerts users that POS operations may be blocked or limited
 */
function OfflineModeBanner({ healthCheckService }) {
  const [isOffline, setIsOffline] = useState(false);
  const [showRetryButton, setShowRetryButton] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (!healthCheckService) return;

    // Check initial status
    const initialStatus = healthCheckService.getStatus();
    setIsOffline(!initialStatus.isHealthy);

    // Subscribe to status changes
    const unsubscribe = healthCheckService.onStatusChange((isHealthy) => {
      setIsOffline(!isHealthy);
      
      // Show retry button after a few seconds of offline
      if (!isHealthy) {
        setTimeout(() => {
          setShowRetryButton(true);
        }, 3000);
      } else {
        setShowRetryButton(false);
        setIsRetrying(false);
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [healthCheckService]);

  if (!isOffline) {
    return null;
  }

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await healthCheckService.checkNow();
      log.info('Manual retry triggered');
    } catch (err) {
      log.error('Manual retry failed:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="offline-mode-banner">
      <div className="banner-content">
        <div className="banner-icon">⚠️</div>
        
        <div className="banner-text">
          <h3>Backend Offline</h3>
          <p>
            The server is currently unreachable. 
            Some operations may be limited or blocked. 
            Please check your connection.
          </p>
        </div>

        <div className="banner-actions">
          {showRetryButton && (
            <button
              className="retry-btn"
              onClick={handleRetry}
              disabled={isRetrying}
              title="Manually check connection to server"
            >
              {isRetrying ? 'Retrying...' : 'Retry'}
            </button>
          )}
          
          <a 
            href="help:offline" 
            className="help-link"
            title="Get help with offline issues"
          >
            Help
          </a>
        </div>
      </div>
    </div>
  );
}

export default OfflineModeBanner;
