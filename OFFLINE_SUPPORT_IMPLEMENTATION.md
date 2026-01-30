# Offline Support Implementation Guide

## Overview

The POS system includes comprehensive offline-first synchronization capabilities, allowing seamless operation even when the network connection is unavailable. All orders and payments are automatically queued locally and synced when connectivity is restored.

## Architecture

### Core Components

#### 1. **OfflineService** (`src/services/OfflineService.js`)
Manages the offline queue, persistence, and sync orchestration.

**Key Responsibilities:**
- Detect online/offline state transitions
- Queue orders and payments locally
- Persist queue to disk (Electron fs) or localStorage (browser)
- Trigger automatic sync when online
- Handle retry logic with exponential backoff
- Manage action lifecycle (queued → syncing → synced/failed)

**Configuration:**
```javascript
{
  maxRetries: 5,              // Max retry attempts per action
  retryDelay: 1000,           // Initial retry delay (ms)
  maxRetryDelay: 30000,       // Max retry delay (ms)
  maxQueueSize: 1000,         // Max queued actions
  syncInterval: 5000,         // Check sync status interval
  batchSize: 50              // Actions per sync request
}
```

#### 2. **useOfflineSync Hook** (`src/hooks/useOfflineSync.js`)
React hook providing offline state management and action queuing.

**State Management:**
```javascript
{
  offlineState: {
    isOnline: boolean,
    isSyncing: boolean,
    queueSize: number,
    pendingCount: number,
    failedCount: number,
    syncProgress: number (0-100),
    lastSyncTime: Date | null,
    syncError: string | null
  },
  indicator: {
    status: 'online' | 'offline' | 'syncing' | 'error',
    message: string,
    icon: string,
    isOnline: boolean,
    isSyncing: boolean,
    queueSize: number,
    failedCount: number,
    progress: number
  },
  syncHistory: SyncEvent[]
}
```

#### 3. **OfflineModeBanner Component** (`src/styles/OfflineModeBanner.css`)
User interface for offline status display with progress indication.

**Features:**
- Real-time status indicator (online/offline/syncing/error)
- Progress bar for sync operations
- Queue statistics display
- Retry button for failed actions
- Responsive design (mobile, tablet, desktop)
- Accessibility features (reduced motion, high contrast)
- Dark mode support

### Sync Protocol

#### Queue Action Structure
```javascript
{
  id: string,              // Unique action ID (auto-generated)
  type: 'order' | 'payment' | 'return',
  data: object,            // Action-specific data
  queuedAt: Date,          // When queued
  clientId: string,        // Client identifier
  retries: number,         // Retry count
  lastRetry: Date | null,  // Last retry time
  status: 'queued' | 'syncing' | 'synced' | 'failed',
  error: string | null,    // Error message
  metadata: object         // Additional context
}
```

#### Backend Endpoint
**POST /sync/actions**

**Request:**
```json
{
  "actions": [
    {
      "id": "action_123",
      "type": "order",
      "data": { "items": [...], "total": 100 },
      "queuedAt": "2024-01-20T10:30:00Z",
      "clientId": "pos_desktop_1"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "action_123",
      "success": true,
      "data": { "orderId": "ORD123", "timestamp": "2024-01-20T10:30:01Z" },
      "error": null
    }
  ]
}
```

**Error Response:**
```json
{
  "success": false,
  "results": [
    {
      "id": "action_123",
      "success": false,
      "error": "Invalid order items",
      "data": null
    }
  ]
}
```

## Implementation Details

### Network Detection

The system detects online/offline state through multiple mechanisms:

1. **Primary**: `window` online/offline events
2. **Fallback**: Polling `navigator.onLine` every 2 seconds
3. **Fallback**: Actual HTTP requests to test connectivity

```javascript
// Automatic detection
if (navigator.onLine) {
  // Online - trigger sync
  offlineService._handleOnline();
} else {
  // Offline - queue locally
  offlineService._handleOffline();
}
```

### Queue Management

#### Adding Actions to Queue
```javascript
const actionId = await offlineSync.queueAction(
  {
    type: 'order',
    data: {
      items: [{ productId: '123', qty: 2 }],
      total: 99.99
    }
  },
  { source: 'OrdersPage', userAction: 'submit_order' }
);
```

#### Queue Persistence
- **Electron**: Stored in `~/.pos-electron/offline-queue.json`
- **Browser**: Stored in localStorage with key `pos_offline_queue`
- **Format**: JSON array of action objects
- **Recovery**: Automatically loaded on app startup

#### Sync Process
```
1. Check isOnline
   ├→ YES: Trigger sync immediately
   └→ NO: Keep in queue
   
2. Batch Actions (max 50)
3. POST to /sync/actions
4. Process Results
   ├→ Success: Mark as synced, remove from queue
   └→ Error: Increment retry count, keep in queue
   
5. Retry Failed Actions
   └→ Exponential backoff: 1s, 2s, 4s, 8s, 16s... (max 30s)
   
6. Repeat until queue empty or max retries reached
```

### Retry Logic

**Exponential Backoff Algorithm:**
```javascript
// First retry: 1000ms
// Second retry: 2000ms
// Third retry: 4000ms
// Fourth retry: 8000ms
// Fifth retry: 16000ms
// Cap at 30000ms

const delay = Math.min(
  1000 * Math.pow(2, retryCount),
  30000
);
```

**Max Retries:** 5 attempts per action
**Failed Queue:** Actions that exceed max retries move to failed queue

### Data Loss Prevention

1. **Immediate Persistence**: Actions queued immediately before sync attempt
2. **File System**: Electron uses fs module with atomic writes
3. **Crash Recovery**: Queue loaded on app restart with reset sync flags
4. **Browser Fallback**: localStorage backup if fs unavailable
5. **Idempotent Operations**: Backend handles duplicate action IDs

## Integration Guide

### OrdersPage Integration

```javascript
// 1. Import services
import OfflineService from '../services/OfflineService';
import { useOfflineSync } from '../hooks/useOfflineSync';

// 2. Initialize in component
const offlineServiceRef = useRef(null);
if (!offlineServiceRef.current && apiClient) {
  offlineServiceRef.current = new OfflineService(apiClient);
}
const offlineSync = useOfflineSync(offlineServiceRef.current);

// 3. Queue order submission
const handleSubmitOrder = async () => {
  const result = await submitOrder();
  
  if (result.orderId) {
    const actionId = await offlineSync.queueAction({
      type: 'order',
      data: {
        orderId: result.orderId,
        items: order.items,
        total: order.total,
        timestamp: new Date().toISOString()
      }
    }, { source: 'OrdersPage', userAction: 'submit_order' });
    
    // Show payment panel
    setCurrentOrderId(result.orderId);
    setShowPaymentPanel(true);
  }
};

// 4. Queue payment submission
const handleFullPayment = async () => {
  const result = await paymentFlow.submitFullPayment(paymentMethod);
  
  if (result) {
    const actionId = await offlineSync.queueAction({
      type: 'payment',
      data: {
        orderId: currentOrderId,
        amount: order.total,
        method: paymentMethod,
        type: 'full',
        timestamp: new Date().toISOString()
      }
    }, { source: 'OrdersPage', userAction: 'full_payment' });
  }
};

// 5. Display offline banner
<div 
  className={`offline-mode-banner ${offlineSync.indicator.status}`}
  style={{ display: offlineSync.indicator.status === 'online' ? 'none' : 'flex' }}
>
  <div className="banner-content">
    <div className="banner-icon">{offlineSync.indicator.icon}</div>
    <div className="banner-text">
      <h3>{offlineSync.indicator.message}</h3>
      <p>Queue: {offlineSync.queueSize} | Progress: {offlineSync.syncProgress}%</p>
    </div>
  </div>
</div>
```

### Adding to Other Pages

For any page that submits data:

```javascript
// Initialize
const offlineServiceRef = useRef(null);
if (!offlineServiceRef.current && apiClient) {
  offlineServiceRef.current = new OfflineService(apiClient);
}
const offlineSync = useOfflineSync(offlineServiceRef.current);

// Queue actions
await offlineSync.queueAction({
  type: 'custom_action',
  data: { /* action data */ }
}, { source: 'PageName', userAction: 'description' });

// Check status
const status = await offlineSync.getActionStatus(actionId);
if (status.status === 'synced') {
  // Action successfully synced
}
```

## Event System

The OfflineService emits events that components can listen to:

```javascript
// Listen to sync completion
offlineService.on('syncComplete', () => {
  console.log('All actions synced');
});

// Listen to sync errors
offlineService.on('syncError', (error) => {
  console.log('Sync error:', error);
});

// Listen to online/offline state changes
offlineService.on('onlineStateChange', (isOnline) => {
  console.log('Online state:', isOnline);
});

// Listen to action queued
offlineService.on('actionQueued', (action) => {
  console.log('Action queued:', action.id);
});

// Listen to action synced
offlineService.on('actionSynced', (actionId) => {
  console.log('Action synced:', actionId);
});
```

## Error Handling

### Common Scenarios

#### 1. Network Temporarily Unavailable
- Action queued automatically
- Displayed in offline banner
- Auto-sync triggered when online
- No user action required

#### 2. Backend Rejects Action
- Marked as failed in queue
- Displayed in error banner with retry button
- User can manually retry or clear failed queue

#### 3. Large Queue Accumulation
- System batches sync (50 actions per request)
- Progress bar shows sync status
- Continues until queue empty

#### 4. App Crash During Sync
- Queue persisted to disk
- Loaded automatically on restart
- Sync state reset to allow retry

### Logging

All offline operations are logged:

```javascript
log.info('[OfflineService] Action queued:', actionId);
log.info('[OfflineService] Starting sync of 50 actions');
log.info('[OfflineService] Sync completed: 45 success, 5 failed');
log.error('[OfflineService] Sync error:', error);
```

## Performance Considerations

1. **Batch Size**: 50 actions per sync request (configurable)
2. **Storage**: Up to 1000 queued actions (configurable)
3. **Memory**: Minimal overhead (~100KB for 1000 actions)
4. **Disk I/O**: Async persistence, non-blocking
5. **Network**: Smart retry with exponential backoff

## Backend Requirements

The backend MUST implement:

1. **POST /sync/actions** endpoint
2. **Idempotent processing** using action IDs
3. **Per-action error handling** in response
4. **Atomic operations** for each action
5. **Deduplication logic** to prevent duplicate processing

Example backend handler:
```javascript
app.post('/sync/actions', async (req, res) => {
  const { actions } = req.body;
  const results = [];

  for (const action of actions) {
    try {
      // Check for duplicate
      const existing = await Action.findOne({ id: action.id });
      if (existing) {
        results.push({
          id: action.id,
          success: true,
          data: existing.result
        });
        continue;
      }

      // Process action
      let result;
      switch (action.type) {
        case 'order':
          result = await createOrder(action.data);
          break;
        case 'payment':
          result = await processPayment(action.data);
          break;
      }

      // Save action record
      await Action.create({
        id: action.id,
        type: action.type,
        result: result,
        processedAt: new Date()
      });

      results.push({
        id: action.id,
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      results.push({
        id: action.id,
        success: false,
        error: error.message
      });
    }
  }

  res.json({ success: true, results });
});
```

## Testing

### Manual Testing

1. **Test Offline Queuing:**
   - Disable network (DevTools → Offline)
   - Submit order
   - Verify action queued in offline banner

2. **Test Auto-Sync:**
   - Re-enable network
   - Verify sync starts automatically
   - Check progress bar updates

3. **Test Retry:**
   - Cause backend error (stop server)
   - Submit order
   - Start server
   - Verify auto-retry succeeds

4. **Test Persistence:**
   - Queue action offline
   - Close app
   - Reopen app
   - Verify queue restored and syncing

### Automated Testing

```javascript
// Test offline service
describe('OfflineService', () => {
  it('should queue action when offline', async () => {
    service.isOnline = false;
    const actionId = await service.queueAction({ type: 'order', data: {} });
    expect(service.actionQueue.length).toBe(1);
  });

  it('should sync when online', async () => {
    service.isOnline = true;
    await service._triggerSync();
    expect(service.actionQueue.length).toBe(0);
  });

  it('should persist queue to file', async () => {
    await service.queueAction({ type: 'order', data: {} });
    const saved = await fs.readFile(queueFile, 'utf8');
    expect(JSON.parse(saved).length).toBeGreaterThan(0);
  });
});
```

## Troubleshooting

### Queue Not Syncing
1. Check if online: `navigator.onLine`
2. Check backend /sync/actions endpoint accessible
3. Verify action format matches backend expectations
4. Check browser console for errors

### Data Loss
1. Verify queue persistence enabled
2. Check file permissions (Electron: `~/.pos-electron/`)
3. Check localStorage availability (browser)
4. Review app crash logs

### High Memory Usage
1. Reduce `maxQueueSize` configuration
2. Monitor queue size in offline banner
3. Increase `batchSize` for faster sync
4. Clear old actions from queue regularly

### Slow Sync Performance
1. Reduce `batchSize` if backend struggles
2. Check backend response times
3. Monitor network latency
4. Consider increasing `syncInterval`

## Future Enhancements

1. **Delta Sync**: Only sync changed data
2. **Compression**: Gzip queue for storage efficiency
3. **Selective Retry**: User chooses which actions to retry
4. **Queue Analytics**: Dashboard for queue statistics
5. **Offline Validation**: Local validation before queuing
6. **Conflict Resolution**: Handle backend conflicts gracefully
7. **Action Grouping**: Group related actions for atomic sync
8. **Progress Notifications**: Browser/system notifications for sync

## References

- [OfflineService API](../src/services/OfflineService.js)
- [useOfflineSync Hook](../src/hooks/useOfflineSync.js)
- [OrdersPage Integration](../src/pages/OrdersPage.js)
- [Offline Banner Styles](../src/styles/OfflineModeBanner.css)
