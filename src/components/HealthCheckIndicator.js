import React, { useState, useEffect } from 'react';
import log from 'electron-log';
import '../styles/HealthCheckIndicator.css';

/**
 * Health Check Indicator Component
 * Displays backend connectivity status
 * Shows online/offline/checking states
 * 
 * Visual Indicators:
 * - Green dot + "Online" = Backend is reachable
 * - Red dot + "Offline" = Backend is unreachable
 * - Yellow dot + "Checking..." = Health check in progress
 */
function HealthCheckIndicator({ healthCheckService }) {
  const [status, setStatus] = useState('checking');
  const [lastChecked, setLastChecked] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!healthCheckService) {
      log.warn('HealthCheckIndicator: healthCheckService not provided');
      return;
    }

    // Set initial status
    const initialStatus = healthCheckService.getStatusString();
    setStatus(initialStatus);
    setLastChecked(healthCheckService.getStatus().lastCheckTime);

    // Subscribe to status changes
    const unsubscribe = healthCheckService.onStatusChange((isHealthy) => {
      setStatus(isHealthy ? 'online' : 'offline');
      setLastChecked(new Date());
      
      // Log status changes for debugging
      log.info(`Backend status: ${isHealthy ? 'ONLINE' : 'OFFLINE'}`);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [healthCheckService]);

  if (!healthCheckService) {
    return null;
  }

  const getStatusClass = () => {
    switch (status) {
      case 'online':
        return 'health-online';
      case 'offline':
        return 'health-offline';
      case 'checking':
        return 'health-checking';
      default:
        return 'health-unknown';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'offline':
        return 'Offline';
      case 'checking':
        return 'Checking...';
      default:
        return 'Unknown';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'online':
        return '●';
      case 'offline':
        return '●';
      case 'checking':
        return '◐';
      default:
        return '○';
    }
  };

  const formatLastChecked = () => {
    if (!lastChecked) {
      return 'Never';
    }

    const now = new Date();
    const diffSeconds = Math.floor((now - lastChecked) / 1000);

    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`;
    } else if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      return `${minutes}m ago`;
    } else {
      const hours = Math.floor(diffSeconds / 3600);
      return `${hours}h ago`;
    }
  };

  const handleManualCheck = async () => {
    setStatus('checking');
    await healthCheckService.checkNow();
  };

  const handleToggleDetails = () => {
    setShowDetails(!showDetails);
  };

  const diagnostics = healthCheckService.getDiagnostics();

  return (
    <div className="health-check-indicator">
      {/* Status Display */}
      <div 
        className={`health-status ${getStatusClass()}`}
        title={`Backend is ${status}`}
      >
        <span className="health-icon">{getStatusIcon()}</span>
        <span className="health-text">{getStatusText()}</span>
      </div>

      {/* Details Toggle */}
      <button
        className="health-details-btn"
        onClick={handleToggleDetails}
        title="Show health check details"
        aria-label="Toggle health details"
      >
        ⋮
      </button>

      {/* Details Panel */}
      {showDetails && (
        <div className="health-details-panel">
          <div className="details-header">
            <h4>Backend Status</h4>
            <button 
              className="close-btn"
              onClick={handleToggleDetails}
              aria-label="Close details"
            >
              ✕
            </button>
          </div>

          <div className="details-content">
            <div className="detail-row">
              <span className="detail-label">Status:</span>
              <span className={`detail-value ${getStatusClass()}`}>
                {getStatusText()}
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">Last Check:</span>
              <span className="detail-value">{formatLastChecked()}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">Check Interval:</span>
              <span className="detail-value">{diagnostics.checkInterval}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">Timeout:</span>
              <span className="detail-value">{diagnostics.timeout}</span>
            </div>

            {diagnostics.failureCount > 0 && (
              <div className="detail-row">
                <span className="detail-label">Failures:</span>
                <span className="detail-value detail-warning">
                  {diagnostics.failureCount}/{diagnostics.maxRetries}
                </span>
              </div>
            )}

            <div className="details-actions">
              <button
                className="check-now-btn"
                onClick={handleManualCheck}
                disabled={status === 'checking'}
              >
                {status === 'checking' ? 'Checking...' : 'Check Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HealthCheckIndicator;
