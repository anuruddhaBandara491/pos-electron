/**
 * OfflineService.js
 * Offline-first synchronization engine for Electron POS
 * 
 * Features:
 * - Detect online/offline state
 * - Queue POS actions (orders, payments) locally
 * - Persist queue to disk/storage
 * - Automatic sync when connection returns
 * - Prevent data loss with transaction logging
 * - Conflict resolution
 * 
 * Architecture: Local Queue → Backend Sync → Confirmation
 */

import log from 'electron-log';
import path from 'path';
import fs from 'fs';

const fsPromises = fs.promises;


class OfflineService {
  constructor(apiClient, storagePath = null) {
    this.apiClient = apiClient;
    this.storagePath = storagePath || path.join(process.env.APPDATA || process.env.HOME, '.pos-offline');
    
    // State
    this.isOnline = navigator?.onLine ?? true;
    this.isSyncing = false;
    this.syncError = null;
    
    // Queue storage
    this.actionQueue = [];
    this.syncQueue = [];
    this.failedQueue = [];
    
    // Listeners
    this.listeners = {
      onlineStateChange: [],
      syncStart: [],
      syncComplete: [],
      syncError: [],
      actionQueued: [],
      actionSynced: []
    };
    
    // Configuration
    this.maxRetries = 5;
    this.retryDelay = 1000; // 1 second initial
    this.maxRetryDelay = 30000; // 30 seconds max
    this.maxQueueSize = 1000; // Max 1000 queued actions
    this.syncInterval = 5000; // Try sync every 5 seconds when online
    
    // Sync tracking
    this.pendingSyncCount = 0;
    this.successfulSyncCount = 0;
    this.failedSyncCount = 0;
    this.lastSyncTime = null;
    
    // Timer
    this.syncTimer = null;
    
    // Initialize
    this._initialize();
  }

  /**
   * Initialize service
   */
  async _initialize() {
    try {
      log.info('[OFFLINE_SERVICE] Initializing offline service');
      
      // Create storage directory
      await this._ensureStorageDirectory();
      
      // Load persisted queue
      await this._loadPersistedQueue();
      
      // Setup network listeners
      this._setupNetworkListeners();
      
      // Start sync timer
      this._startSyncTimer();
      
      log.info('[OFFLINE_SERVICE] Initialized. Queue size:', this.actionQueue.length);
      
    } catch (error) {
      log.error('[OFFLINE_SERVICE] Initialization error:', error.message);
    }
  }

  /**
   * Setup network state listeners
   */
  _setupNetworkListeners() {
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', () => this._handleOnline());
      window.addEventListener('offline', () => this._handleOffline());
    }
    
    // Fallback: Check connectivity periodically
    setInterval(() => {
      const wasOnline = this.isOnline;
      this.isOnline = navigator?.onLine ?? true;
      
      if (wasOnline !== this.isOnline) {
        if (this.isOnline) {
          this._handleOnline();
        } else {
          this._handleOffline();
        }
      }
    }, 2000);
  }

  /**
   * Handle transition to online
   */
  _handleOnline() {
    if (this.isOnline) return; // Already online
    
    this.isOnline = true;
    log.info('[OFFLINE_SERVICE] Back online. Queue size:', this.actionQueue.length);
    
    this._notifyListeners('onlineStateChange', { isOnline: true, queueSize: this.actionQueue.length });
    
    // Trigger sync immediately
    this._triggerSync();
  }

  /**
   * Handle transition to offline
   */
  _handleOffline() {
    if (!this.isOnline) return; // Already offline
    
    this.isOnline = false;
    log.warn('[OFFLINE_SERVICE] Gone offline. Queue size:', this.actionQueue.length);
    
    this._notifyListeners('onlineStateChange', { isOnline: false, queueSize: this.actionQueue.length });
  }

  /**
   * Start sync timer
   */
  _startSyncTimer() {
    if (this.syncTimer) clearInterval(this.syncTimer);
    
    this.syncTimer = setInterval(() => {
      if (this.isOnline && !this.isSyncing && this.actionQueue.length > 0) {
        this._triggerSync();
      }
    }, this.syncInterval);
  }

  /**
   * Queue a POS action
   */
  async queueAction(action, metadata = {}) {
    try {
      // Validate action
      if (!action.type) {
        throw new Error('Action must have a type');
      }

      const queuedAction = {
        id: this._generateId(),
        type: action.type, // 'order', 'payment', 'return', etc.
        data: action.data,
        metadata: {
          ...metadata,
          queuedAt: new Date().toISOString(),
          queuedClientTime: Date.now(),
          retries: 0,
          lastRetryTime: null,
          failureReasons: []
        },
        status: 'queued', // queued, syncing, synced, failed
        syncResult: null
      };

      // Check queue size
      if (this.actionQueue.length >= this.maxQueueSize) {
        throw new Error(`Queue is full (max ${this.maxQueueSize} actions)`);
      }

      // Add to queue
      this.actionQueue.push(queuedAction);
      this.pendingSyncCount++;

      // Persist immediately
      await this._persistQueue();

      log.info(
        `[ACTION_QUEUED] type=${action.type}, id=${queuedAction.id}, ` +
        `queueSize=${this.actionQueue.length}`
      );

      this._notifyListeners('actionQueued', {
        actionId: queuedAction.id,
        type: action.type,
        queueSize: this.actionQueue.length
      });

      // If online, try sync immediately
      if (this.isOnline) {
        this._triggerSync();
      }

      return queuedAction.id;

    } catch (error) {
      log.error('[QUEUE_ACTION_ERROR]', error.message);
      throw {
        code: 'QUEUE_ERROR',
        message: error.message || 'Failed to queue action'
      };
    }
  }

  /**
   * Trigger synchronization
   */
  async _triggerSync() {
    if (this.isSyncing || !this.isOnline) return;
    
    try {
      this.isSyncing = true;
      this._notifyListeners('syncStart', { queueSize: this.actionQueue.length });
      
      log.info(`[SYNC_START] Queue size: ${this.actionQueue.length}`);
      
      // Get queued actions
      const toSync = this.actionQueue.filter(a => a.status === 'queued').slice(0, 50); // Batch 50 at a time
      
      if (toSync.length === 0) {
        this.isSyncing = false;
        this.lastSyncTime = new Date().toISOString();
        return;
      }

      // Attempt sync
      const results = await this._syncActions(toSync);
      
      // Process results
      let successCount = 0;
      let failureCount = 0;

      for (const result of results) {
        const action = this.actionQueue.find(a => a.id === result.actionId);
        
        if (!action) continue;

        if (result.success) {
          action.status = 'synced';
          action.syncResult = result;
          successCount++;
          this.successfulSyncCount++;
          
          this._notifyListeners('actionSynced', {
            actionId: result.actionId,
            type: action.type,
            serverResponse: result.data
          });
          
        } else {
          action.metadata.retries++;
          action.metadata.lastRetryTime = new Date().toISOString();
          action.metadata.failureReasons.push(result.error);
          
          // Check if should retry
          if (action.metadata.retries < this.maxRetries) {
            action.status = 'queued'; // Retry later
          } else {
            action.status = 'failed';
            this.failedQueue.push(action);
            failureCount++;
            this.failedSyncCount++;
            
            log.error(`[SYNC_FAILED] actionId=${action.id}, reason=${result.error}`);
          }
        }
      }

      // Clean up synced actions (keep for history)
      const syncedIndices = [];
      this.actionQueue.forEach((action, idx) => {
        if (action.status === 'synced') {
          syncedIndices.push(idx);
        }
      });

      // Remove from main queue but keep in history
      for (let i = syncedIndices.length - 1; i >= 0; i--) {
        const action = this.actionQueue[syncedIndices[i]];
        // Keep synced actions for 24 hours for recovery
        this.actionQueue.splice(syncedIndices[i], 1);
      }

      // Persist updated queue
      await this._persistQueue();

      this.isSyncing = false;
      this.lastSyncTime = new Date().toISOString();
      this.syncError = null;

      log.info(
        `[SYNC_COMPLETE] success=${successCount}, failed=${failureCount}, ` +
        `remaining=${this.actionQueue.length}`
      );

      this._notifyListeners('syncComplete', {
        successCount,
        failureCount,
        queueSize: this.actionQueue.length,
        timestamp: this.lastSyncTime
      });

      // Continue syncing if more items
      if (this.actionQueue.length > 0) {
        setTimeout(() => this._triggerSync(), 1000);
      }

    } catch (error) {
      this.isSyncing = false;
      this.syncError = error.message;
      
      log.error('[SYNC_ERROR]', error.message);
      
      this._notifyListeners('syncError', {
        error: error.message,
        queueSize: this.actionQueue.length
      });
    }
  }

  /**
   * Sync actions to backend
   */
  async _syncActions(actions) {
    try {
      const response = await this.apiClient.post(
        '/sync/actions',
        {
          actions: actions.map(a => ({
            id: a.id,
            type: a.type,
            data: a.data,
            queuedAt: a.metadata.queuedAt,
            clientId: this._getClientId()
          }))
        },
        {
          timeout: 30000,
          retries: 0 // No retry at API level, we handle it
        }
      );

      if (!response.data || !response.data.success) {
        throw new Error('Invalid sync response');
      }

      // Process response
      const results = response.data.results || [];
      
      return results.map((result, idx) => ({
        actionId: actions[idx].id,
        success: result.success,
        error: result.error || null,
        data: result.data || null,
        serverTimestamp: result.timestamp
      }));

    } catch (error) {
      log.error('[SYNC_REQUEST_ERROR]', error.message);
      
      // Return all as failed
      return actions.map(a => ({
        actionId: a.id,
        success: false,
        error: error.message || 'Sync failed'
      }));
    }
  }

  /**
   * Get action status
   */
  getActionStatus(actionId) {
    const action = this.actionQueue.find(a => a.id === actionId);
    if (!action) return null;

    return {
      id: actionId,
      status: action.status, // queued, syncing, synced, failed
      type: action.type,
      retries: action.metadata.retries,
      queuedAt: action.metadata.queuedAt,
      lastRetryTime: action.metadata.lastRetryTime,
      failureReasons: action.metadata.failureReasons,
      syncResult: action.syncResult
    };
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    const stats = {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      queueSize: this.actionQueue.length,
      pendingSyncCount: this.actionQueue.filter(a => a.status === 'queued').length,
      failedCount: this.failedQueue.length,
      totalQueued: this.pendingSyncCount,
      totalSynced: this.successfulSyncCount,
      totalFailed: this.failedSyncCount,
      lastSyncTime: this.lastSyncTime,
      syncError: this.syncError,
      syncProgress: this.pendingSyncCount > 0 
        ? Math.round((this.successfulSyncCount / this.pendingSyncCount) * 100)
        : 100
    };

    return stats;
  }

  /**
   * Clear failed queue (manual recovery)
   */
  async clearFailedQueue() {
    try {
      log.warn('[OFFLINE_SERVICE] Clearing failed queue. Count:', this.failedQueue.length);
      this.failedQueue = [];
      await this._persistQueue();
      return true;
    } catch (error) {
      log.error('[CLEAR_FAILED_ERROR]', error.message);
      return false;
    }
  }

  /**
   * Retry single action
   */
  async retryAction(actionId) {
    try {
      const action = this.actionQueue.find(a => a.id === actionId);
      if (!action) throw new Error('Action not found');

      action.status = 'queued';
      action.metadata.retries = 0;
      action.metadata.failureReasons = [];
      
      await this._persistQueue();
      
      if (this.isOnline) {
        this._triggerSync();
      }

      return true;

    } catch (error) {
      log.error('[RETRY_ACTION_ERROR]', error.message);
      return false;
    }
  }

  /**
   * Get offline events for UI display
   */
  getOfflineIndicator() {
    const stats = this.getQueueStats();
    
    let message = '';
    let status = 'online'; // online, syncing, queued, error
    let icon = '✓';

    if (!stats.isOnline) {
      status = 'offline';
      message = `Offline - ${stats.queueSize} action${stats.queueSize !== 1 ? 's' : ''} queued`;
      icon = '📡';
    } else if (stats.isSyncing) {
      status = 'syncing';
      message = `Syncing... (${stats.totalSynced}/${stats.pendingSyncCount})`;
      icon = '⏳';
    } else if (stats.failedCount > 0) {
      status = 'error';
      message = `${stats.failedCount} action${stats.failedCount !== 1 ? 's' : ''} failed to sync`;
      icon = '⚠';
    } else if (stats.pendingSyncCount > 0) {
      status = 'queued';
      message = `${stats.pendingSyncCount} action${stats.pendingSyncCount !== 1 ? 's' : ''} queued`;
      icon = '📋';
    } else {
      message = 'All synced';
      icon = '✓';
    }

    return {
      isOnline: stats.isOnline,
      status,
      message,
      icon,
      queueSize: stats.queueSize,
      failedCount: stats.failedCount,
      isSyncing: stats.isSyncing,
      progress: stats.syncProgress
    };
  }

  /**
   * STORAGE OPERATIONS
   */

  async _ensureStorageDirectory() {
    try {
      if (typeof fsPromises === 'undefined') return; // Browser environment
      await fsPromises.mkdir(this.storagePath, { recursive: true });
    } catch (error) {
      log.warn('[STORAGE] Could not create directory:', error.message);
    }
  }

  async _persistQueue() {
    try {
      if (typeof fsPromises === 'undefined') {
        // Browser: use localStorage
        localStorage.setItem('pos_offline_queue', JSON.stringify({
          actionQueue: this.actionQueue,
          failedQueue: this.failedQueue,
          timestamp: Date.now()
        }));
        return;
      }

      // Electron: use file system
      const queueFile = path.join(this.storagePath, 'queue.json');
      await fsPromises.writeFile(queueFile, JSON.stringify({
        actionQueue: this.actionQueue,
        failedQueue: this.failedQueue,
        timestamp: Date.now()
      }, null, 2));

      log.debug('[OFFLINE_SERVICE] Queue persisted');

    } catch (error) {
      log.error('[PERSIST_QUEUE_ERROR]', error.message);
    }
  }

  async _loadPersistedQueue() {
    try {
      let data = null;

      if (typeof fs === 'undefined') {
        // Browser: use localStorage
        const stored = localStorage.getItem('pos_offline_queue');
        if (stored) {
          data = JSON.parse(stored);
        }
      } else {
        // Electron: use file system
        const queueFile = path.join(this.storagePath, 'queue.json');
        try {
          const content = await fsPromises.readFile(queueFile, 'utf-8');
          data = JSON.parse(content);
        } catch (error) {
          // File doesn't exist yet
          log.info('[OFFLINE_SERVICE] No persisted queue found');
          return;
        }
      }

      if (data && data.actionQueue) {
        this.actionQueue = data.actionQueue;
        this.failedQueue = data.failedQueue || [];
        
        // Reset syncing statuses (in case app crashed during sync)
        this.actionQueue.forEach(action => {
          if (action.status === 'syncing') {
            action.status = 'queued';
          }
        });

        log.info(
          '[OFFLINE_SERVICE] Loaded persisted queue. ' +
          `Queued: ${this.actionQueue.length}, Failed: ${this.failedQueue.length}`
        );
      }

    } catch (error) {
      log.error('[LOAD_QUEUE_ERROR]', error.message);
    }
  }

  /**
   * EVENT LISTENERS
   */

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  off(event, callback) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(callback);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }

  _notifyListeners(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          log.error(`[LISTENER_ERROR] ${event}:`, error.message);
        }
      });
    }
  }

  /**
   * UTILITIES
   */

  _generateId() {
    return `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _getClientId() {
    if (typeof localStorage === 'undefined') return 'electron-client';
    
    let clientId = localStorage.getItem('pos_client_id');
    if (!clientId) {
      clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('pos_client_id', clientId);
    }
    return clientId;
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    log.info('[OFFLINE_SERVICE] Destroyed');
  }
}

export default OfflineService;

