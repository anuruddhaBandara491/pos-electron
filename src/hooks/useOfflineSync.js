/**
 * useOfflineSync.js
 * React hook for offline synchronization state and operations
 * 
 * Manages:
 * - Online/offline state
 * - Queue status and progress
 * - Sync operations
 * - Error handling and recovery
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export function useOfflineSync(offlineService) {
  const offlineServiceRef = useRef(offlineService);
  const [offlineState, setOfflineState] = useState({
    isOnline: true,
    isSyncing: false,
    queueSize: 0,
    pendingCount: 0,
    failedCount: 0,
    syncProgress: 100,
    lastSyncTime: null,
    syncError: null
  });

  const [indicator, setIndicator] = useState({
    status: 'online',
    message: 'All synced',
    icon: '✓',
    isOnline: true,
    isSyncing: false,
    queueSize: 0,
    failedCount: 0,
    progress: 100
  });

  const [syncHistory, setSyncHistory] = useState([]);
  const maxHistoryItems = 20;

  /**
   * Update offline state from service
   */
  const updateOfflineState = useCallback(() => {
    if (!offlineServiceRef.current) return;

    const stats = offlineServiceRef.current.getQueueStats();
    setOfflineState({
      isOnline: stats.isOnline,
      isSyncing: stats.isSyncing,
      queueSize: stats.queueSize,
      pendingCount: stats.pendingSyncCount,
      failedCount: stats.failedCount,
      syncProgress: stats.syncProgress,
      lastSyncTime: stats.lastSyncTime,
      syncError: stats.syncError
    });

    const newIndicator = offlineServiceRef.current.getOfflineIndicator();
    setIndicator(newIndicator);
  }, []);

  /**
   * Initialize event listeners
   */
  useEffect(() => {
    if (!offlineServiceRef.current) return;

    const service = offlineServiceRef.current;

    // Online/offline state change
    const handleOnlineStateChange = (data) => {
      updateOfflineState();
      setSyncHistory(prev => [
        { type: 'state', time: new Date().toISOString(), data },
        ...prev.slice(0, maxHistoryItems - 1)
      ]);
    };

    // Sync events
    const handleSyncStart = (data) => {
      updateOfflineState();
      setSyncHistory(prev => [
        { type: 'syncStart', time: new Date().toISOString(), data },
        ...prev.slice(0, maxHistoryItems - 1)
      ]);
    };

    const handleSyncComplete = (data) => {
      updateOfflineState();
      setSyncHistory(prev => [
        { type: 'syncComplete', time: new Date().toISOString(), data },
        ...prev.slice(0, maxHistoryItems - 1)
      ]);
    };

    const handleSyncError = (data) => {
      updateOfflineState();
      setSyncHistory(prev => [
        { type: 'syncError', time: new Date().toISOString(), data },
        ...prev.slice(0, maxHistoryItems - 1)
      ]);
    };

    const handleActionQueued = (data) => {
      updateOfflineState();
      setSyncHistory(prev => [
        { type: 'actionQueued', time: new Date().toISOString(), data },
        ...prev.slice(0, maxHistoryItems - 1)
      ]);
    };

    const handleActionSynced = (data) => {
      updateOfflineState();
      setSyncHistory(prev => [
        { type: 'actionSynced', time: new Date().toISOString(), data },
        ...prev.slice(0, maxHistoryItems - 1)
      ]);
    };

    // Register listeners
    service.on('onlineStateChange', handleOnlineStateChange);
    service.on('syncStart', handleSyncStart);
    service.on('syncComplete', handleSyncComplete);
    service.on('syncError', handleSyncError);
    service.on('actionQueued', handleActionQueued);
    service.on('actionSynced', handleActionSynced);

    // Initial update
    updateOfflineState();

    // Cleanup
    return () => {
      service.off('onlineStateChange', handleOnlineStateChange);
      service.off('syncStart', handleSyncStart);
      service.off('syncComplete', handleSyncComplete);
      service.off('syncError', handleSyncError);
      service.off('actionQueued', handleActionQueued);
      service.off('actionSynced', handleActionSynced);
    };
  }, [updateOfflineState]);

  /**
   * Queue an action for offline sync
   */
  const queueAction = useCallback(async (action, metadata = {}) => {
    if (!offlineServiceRef.current) {
      throw new Error('Offline service not initialized');
    }

    const actionId = await offlineServiceRef.current.queueAction(action, metadata);
    updateOfflineState();
    return actionId;
  }, [updateOfflineState]);

  /**
   * Get action status
   */
  const getActionStatus = useCallback((actionId) => {
    if (!offlineServiceRef.current) return null;
    return offlineServiceRef.current.getActionStatus(actionId);
  }, []);

  /**
   * Retry failed action
   */
  const retryAction = useCallback(async (actionId) => {
    if (!offlineServiceRef.current) return false;
    const success = await offlineServiceRef.current.retryAction(actionId);
    updateOfflineState();
    return success;
  }, [updateOfflineState]);

  /**
   * Clear failed queue
   */
  const clearFailedQueue = useCallback(async () => {
    if (!offlineServiceRef.current) return false;
    const success = await offlineServiceRef.current.clearFailedQueue();
    updateOfflineState();
    return success;
  }, [updateOfflineState]);

  /**
   * Get sync stats
   */
  const getStats = useCallback(() => {
    if (!offlineServiceRef.current) return null;
    return offlineServiceRef.current.getQueueStats();
  }, []);

  /**
   * Check if action was queued (not immediately synced)
   */
  const wasQueued = useCallback((actionId) => {
    const status = getActionStatus(actionId);
    return status && status.status !== 'synced';
  }, [getActionStatus]);

  /**
   * Wait for action to sync (with timeout)
   */
  const waitForSync = useCallback((actionId, timeoutMs = 30000) => {
    return new Promise((resolve) => {
      const checkInterval = 500;
      const startTime = Date.now();

      const check = () => {
        const status = getActionStatus(actionId);
        
        if (!status) {
          resolve(false); // Action not found
        } else if (status.status === 'synced') {
          resolve(true); // Synced successfully
        } else if (Date.now() - startTime > timeoutMs) {
          resolve(false); // Timeout
        } else {
          setTimeout(check, checkInterval);
        }
      };

      check();
    });
  }, [getActionStatus]);

  return {
    // State
    isOnline: offlineState.isOnline,
    isSyncing: offlineState.isSyncing,
    queueSize: offlineState.queueSize,
    pendingCount: offlineState.pendingCount,
    failedCount: offlineState.failedCount,
    syncProgress: offlineState.syncProgress,
    lastSyncTime: offlineState.lastSyncTime,
    syncError: offlineState.syncError,

    // Indicator
    indicator,

    // History
    syncHistory,

    // Methods
    queueAction,
    getActionStatus,
    retryAction,
    clearFailedQueue,
    getStats,
    wasQueued,
    waitForSync,
    updateState: updateOfflineState
  };
}
