import React from 'react';
import { useVersionCheck } from '../hooks/useVersionCheck';
import '../styles/VersionNotifier.css';

/**
 * Version Update Notification
 * 
 * Displays update notification banner when new version is available
 */
export function VersionUpdateNotification() {
  const { hasUpdate, shouldBlock, isCritical, getUpdateMessage, refreshVersion, versionStatus } = useVersionCheck(null);
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed || !hasUpdate) {
    return null;
  }

  return (
    <div className={`version-notification ${isCritical ? 'critical' : 'warning'}`}>
      <div className="version-notification-content">
        <div className="version-notification-icon">
          {isCritical ? '⚠' : 'ℹ'}
        </div>
        <div className="version-notification-text">
          <strong>Version Update Available</strong>
          <p>{getUpdateMessage()}</p>
          {versionStatus.currentVersion && versionStatus.backendVersion && (
            <p className="version-info">
              Current: {versionStatus.currentVersion} → Latest: {versionStatus.backendVersion}
            </p>
          )}
        </div>
        <div className="version-notification-actions">
          <button
            className="version-notification-btn version-notification-btn-primary"
            onClick={refreshVersion}
            title="Check version again"
          >
            Refresh
          </button>
          {!isCritical && (
            <button
              className="version-notification-btn version-notification-btn-secondary"
              onClick={() => setDismissed(true)}
              title="Dismiss notification"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Critical Version Block Modal
 * 
 * Prevents app usage when version is incompatible
 * Forces user to update before continuing
 */
export function CriticalVersionBlock() {
  const { shouldBlock, getUpdateMessage, versionStatus } = useVersionCheck(null);

  if (!shouldBlock) {
    return null;
  }

  return (
    <div className="version-block-overlay">
      <div className="version-block-modal">
        <div className="version-block-icon">🔒</div>
        
        <h2 className="version-block-title">App Update Required</h2>
        
        <div className="version-block-body">
          <p className="version-block-message">
            {getUpdateMessage()}
          </p>

          {versionStatus.blockingReason && (
            <div className="version-block-reason">
              <strong>Reason:</strong> {versionStatus.blockingReason}
            </div>
          )}

          {versionStatus.minimumVersion && (
            <div className="version-block-requirement">
              <p><strong>Minimum Required Version:</strong> {versionStatus.minimumVersion}</p>
              {versionStatus.recommendedVersion && (
                <p><strong>Recommended Version:</strong> {versionStatus.recommendedVersion}</p>
              )}
            </div>
          )}

          {versionStatus.changelog && versionStatus.changelog.length > 0 && (
            <div className="version-block-changelog">
              <h3>What's New</h3>
              <ul>
                {versionStatus.changelog.slice(0, 3).map((entry, idx) => (
                  <li key={idx}>
                    <strong>v{entry.version}</strong> - {entry.title || entry.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="version-block-footer">
          <p className="version-block-warning">
            You must update the app to continue using it. Please contact your administrator if you need assistance.
          </p>
        </div>

        <div className="version-block-actions">
          <button
            className="version-block-btn version-block-btn-primary"
            onClick={() => window.location.reload()}
            title="Retry version check"
          >
            ↻ Retry Connection
          </button>
          <button
            className="version-block-btn version-block-btn-secondary"
            onClick={() => {
              if (window.electronAPI && window.electronAPI.quitApp) {
                window.electronAPI.quitApp();
              } else {
                window.close();
              }
            }}
            title="Close app"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Version Status Indicator
 * 
 * Small badge showing version status in header/toolbar
 */
export function VersionStatusIndicator({ compact = false }) {
  const { isCompatible, isCritical, hasUpdate } = useVersionCheck(null);

  if (isCompatible && !hasUpdate) {
    return null;
  }

  const statusClass = isCritical ? 'critical' : 'warning';
  const icon = isCritical ? '🔒' : '⚠';

  if (compact) {
    return (
      <span className={`version-indicator version-indicator-${statusClass}`} title="Version update available">
        {icon}
      </span>
    );
  }

  return (
    <div className={`version-indicator version-indicator-${statusClass}`}>
      <span className="version-indicator-icon">{icon}</span>
      <span className="version-indicator-text">
        {isCritical ? 'Update Required' : 'Update Available'}
      </span>
    </div>
  );
}

/**
 * Version Information Display
 * 
 * Shows current and backend version information
 * Used in About/Settings pages
 */
export function VersionInfo() {
  const { versionStatus } = useVersionCheck(null);

  const formatTime = (time) => {
    if (!time) return 'Never';
    const date = new Date(time);
    return date.toLocaleString();
  };

  return (
    <div className="version-info-container">
      <div className="version-info-section">
        <h3>App Version</h3>
        {versionStatus.currentVersion ? (
          <div className="version-info-content">
            <p><strong>Version:</strong> {versionStatus.currentVersion}</p>
            <p><strong>Release Type:</strong> stable</p>
          </div>
        ) : (
          <p className="version-info-empty">Not available</p>
        )}
      </div>

      <div className="version-info-section">
        <h3>Backend Version</h3>
        {versionStatus.backendVersion ? (
          <div className="version-info-content">
            <p><strong>Version:</strong> {versionStatus.backendVersion}</p>
          </div>
        ) : (
          <p className="version-info-empty">Not checked</p>
        )}
      </div>

      <div className="version-info-section">
        <h3>Compatibility Status</h3>
        {versionStatus ? (
          <div className="version-info-content">
            <p>
              <strong>Compatible:</strong>{' '}
              <span className={versionStatus.isCompatible ? 'status-ok' : 'status-error'}>
                {versionStatus.isCompatible ? '✓ Yes' : '✗ No'}
              </span>
            </p>
            <p>
              <strong>Update Required:</strong>{' '}
              <span className={versionStatus.requiresUpdate ? 'status-warning' : 'status-ok'}>
                {versionStatus.requiresUpdate ? '⚠ Yes' : '✓ No'}
              </span>
            </p>
            {versionStatus.message && (
              <p><strong>Message:</strong> {versionStatus.message}</p>
            )}
          </div>
        ) : (
          <p className="version-info-empty">Not checked</p>
        )}
      </div>

      <div className="version-info-section">
        <h3>Last Check</h3>
        <p>{formatTime(versionStatus.lastCheckTime)}</p>
      </div>
    </div>
  );
}

export default VersionUpdateNotification;
