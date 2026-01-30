import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * React Hook for Version Checking
 * 
 * Communicates with main process via IPC for version status
 * No direct service dependency - all calls go through window.electronAPI.invoke()
 */
export function useVersionCheck(versionService = null) {
  const [versionStatus, setVersionStatus] = useState({
    isCompatible: true,
    requiresUpdate: false,
    isCritical: false,
    message: null,
    currentVersion: null,
    backendVersion: null,
    lastCheckTime: null,
    changelog: []
  });

  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState(null);
  const hasInitialized = useRef(false);

  /**
   * Fetch current version status from main process via IPC
   */
  const fetchVersionStatus = useCallback(async () => {
    try {
      if (!window.electronAPI?.invoke) {
        // Not running in Electron, skip version checking
        return;
      }
      
      const status = await window.electronAPI.invoke('version:getStatus');
      if (status) {
        setVersionStatus({
          ...status,
          lastCheckTime: status.lastCheckTime || new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Failed to fetch version status:', error);
      // Silently fail - version checking is not critical
    }
  }, []);

  /**
   * Initialize IPC listeners for version updates from main process
   */
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Fetch initial status
    fetchVersionStatus();

    // Listen for critical version issues from main process
    if (window.electronAPI?.on) {
      const unsubscribeCritical = window.electronAPI.on('version:critical', (status) => {
        setVersionStatus(prev => ({
          ...prev,
          ...status,
          isCritical: true
        }));
      });

      return () => {
        unsubscribeCritical?.();
      };
    }
  }, [fetchVersionStatus]);

  /**
   * Manually check version via IPC
   */
  const checkVersion = useCallback(async () => {
    if (!window.electronAPI?.invoke) {
      setCheckError('Electron API not available');
      return;
    }

    setIsChecking(true);
    try {
      const status = await window.electronAPI.invoke('version:checkVersion');
      setVersionStatus({
        ...status,
        lastCheckTime: new Date().toISOString()
      });
      setCheckError(null);
    } catch (error) {
      setCheckError(error.message || 'Version check failed');
    } finally {
      setIsChecking(false);
    }
  }, []);

  /**
   * Force refresh version check
   */
  const refreshVersion = useCallback(async () => {
    if (!window.electronAPI?.invoke) {
      setCheckError('Electron API not available');
      return;
    }

    setIsChecking(true);
    try {
      const status = await window.electronAPI.invoke('version:forceCheck');
      setVersionStatus({
        ...status,
        lastCheckTime: new Date().toISOString()
      });
      setCheckError(null);
    } catch (error) {
      setCheckError(error.message || 'Version check failed');
    } finally {
      setIsChecking(false);
    }
  }, []);

  /**
   * Get formatted message for user
   */
  const getUpdateMessage = useCallback(() => {
    return versionStatus.message || 'Version update available';
  }, [versionStatus.message]);

  return {
    // Status
    versionStatus,
    isChecking,
    checkError,

    // Derived state
    hasUpdate: versionStatus.requiresUpdate,
    isCritical: versionStatus.isCritical,
    isCompatible: versionStatus.isCompatible,
    shouldBlock: versionStatus.isCritical && !versionStatus.isCompatible,

    // Methods
    checkVersion,
    refreshVersion,
    getUpdateMessage,

    // Convenience properties
    currentVersion: versionStatus.currentVersion,
    backendVersion: versionStatus.backendVersion,
    message: versionStatus.message,
    changelog: versionStatus.changelog
  };
}

export default useVersionCheck;
