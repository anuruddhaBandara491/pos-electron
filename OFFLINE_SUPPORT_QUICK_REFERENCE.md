# Offline Support - Quick Reference

## What is Offline Support?

Automatically queue orders and payments when internet is down, then sync when connection returns.

## For Users

### Normal Operation (Online)
- Orders and payments process immediately
- No visible indication needed

### When Internet Goes Down
1. **Red banner appears** at top of screen
2. Orders still work - queued locally
3. Payments still work - queued locally
4. No data lost

### When Internet Returns
1. **Banner turns yellow** (syncing)
2. Progress bar shows sync status
3. Queue automatically syncs
4. Banner disappears when done

### If Something Fails
1. **Red banner with warning** appears
2. Click "Retry" button to try again
3. Or click "Clear" to remove failed items

## For Developers

### Quick Start

```javascript
// 1. Import
import OfflineService from '../services/OfflineService';
import { useOfflineSync } from '../hooks/useOfflineSync';

// 2. Initialize
const offlineServiceRef = useRef(null);
if (!offlineServiceRef.current && apiClient) {
  offlineServiceRef.current = new OfflineService(apiClient);
}
const offlineSync = useOfflineSync(offlineServiceRef.current);

// 3. Queue action
await offlineSync.queueAction({
  type: 'order',      // 'order', 'payment', 'return', etc.
  data: { /* your data */ }
});

// 4. Check status
const status = await offlineSync.getActionStatus(actionId);
console.log(status.status); // 'queued', 'syncing', 'synced', 'failed'
```

### Hook API

```javascript
// State
offlineSync.isOnline          // boolean
offlineSync.isSyncing         // boolean
offlineSync.queueSize         // number of queued actions
offlineSync.pendingCount      // number waiting to sync
offlineSync.failedCount       // number that failed
offlineSync.syncProgress      // 0-100 percentage
offlineSync.lastSyncTime      // Date or null
offlineSync.syncError         // error message or null

// Indicator (UI-friendly)
offlineSync.indicator.status  // 'online', 'offline', 'syncing', 'error'
offlineSync.indicator.message // User-friendly message
offlineSync.indicator.icon    // Unicode icon
offlineSync.indicator.progress // 0-100

// Methods
await offlineSync.queueAction(action, metadata)
await offlineSync.getActionStatus(actionId)
await offlineSync.retryAction(actionId)
await offlineSync.clearFailedQueue()
await offlineSync.getStats()
await offlineSync.waitForSync(actionId, timeoutMs)
```

### Service API

```javascript
const service = new OfflineService(apiClient);

// Listen to events
service.on('onlineStateChange', (isOnline) => {})
service.on('syncStart', () => {})
service.on('syncComplete', () => {})
service.on('syncError', (error) => {})
service.on('actionQueued', (action) => {})
service.on('actionSynced', (actionId) => {})

// Manual operations
service.queueAction(action, metadata)
service.getActionStatus(actionId)
service.getQueueStats()
service.getOfflineIndicator()
```

## Implementation Checklist

### For New Features

- [ ] Queue action with `offlineSync.queueAction()`
- [ ] Include metadata for debugging
- [ ] Check action status on response
- [ ] Handle errors gracefully
- [ ] Show queue status in UI

### For Integration

- [ ] Import OfflineService and useOfflineSync
- [ ] Initialize service with apiClient
- [ ] Use hook to get state and methods
- [ ] Queue all backend calls
- [ ] Display offline banner
- [ ] Test offline scenario

## Common Patterns

### Queue Order
```javascript
await offlineSync.queueAction({
  type: 'order',
  data: {
    items: order.items,
    total: order.total
  }
});
```

### Queue Payment
```javascript
await offlineSync.queueAction({
  type: 'payment',
  data: {
    orderId: currentOrderId,
    amount: paymentAmount,
    method: paymentMethod
  }
});
```

### Wait for Sync
```javascript
const actionId = await offlineSync.queueAction({...});
try {
  await offlineSync.waitForSync(actionId, 30000); // 30s timeout
  console.log('Action synced!');
} catch (err) {
  console.log('Sync failed or timed out');
}
```

### Check Status
```javascript
const status = await offlineSync.getActionStatus(actionId);
if (status.status === 'synced') {
  console.log('Action completed on server:', status.data);
}
```

## Offline Banner States

| State | Color | Icon | Meaning |
|-------|-------|------|---------|
| Online | Green | ✓ | Connected, no queue |
| Offline | Red | ⊘ | No internet, queuing locally |
| Syncing | Yellow | ⟳ | Uploading queue to server |
| Error | Red | ⚠ | Some actions failed |

## File Locations

| File | Purpose |
|------|---------|
| `src/services/OfflineService.js` | Core offline logic |
| `src/hooks/useOfflineSync.js` | React hook for offline state |
| `src/styles/OfflineModeBanner.css` | Offline banner styling |
| `src/pages/OrdersPage.js` | Already integrated |
| `OFFLINE_SUPPORT_IMPLEMENTATION.md` | Full documentation |

## Configuration

Edit `OfflineService.js` constructor for tuning:

```javascript
{
  maxRetries: 5,              // How many times to retry
  retryDelay: 1000,           // Start delay (ms)
  maxRetryDelay: 30000,       // Max delay (ms)
  maxQueueSize: 1000,         // Max actions to queue
  syncInterval: 5000,         // Check interval (ms)
  batchSize: 50              // Actions per request
}
```

## Backend Requirements

Server must implement:

```
POST /sync/actions

Request:
{
  "actions": [
    {
      "id": "action_id",
      "type": "order|payment|return",
      "data": { /* user data */ },
      "queuedAt": "2024-01-20T10:30:00Z",
      "clientId": "pos_client_1"
    }
  ]
}

Response:
{
  "success": true,
  "results": [
    {
      "id": "action_id",
      "success": true|false,
      "error": null|"error message",
      "data": { /* response data */ }
    }
  ]
}
```

Key requirements:
- Process each action independently
- Return success/error for each action
- Use action.id for deduplication
- Support types: order, payment, return
- Handle missing/invalid data gracefully

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Banner not showing | Check `navigator.onLine` in console |
| Queue not syncing | Verify `/sync/actions` endpoint exists |
| Data lost | Check file permissions and localStorage |
| High memory | Reduce `maxQueueSize` in config |
| Slow sync | Reduce `batchSize` or check backend |

## Testing Offline

### Chrome DevTools
1. Open DevTools (F12)
2. Go to Network tab
3. Check "Offline" checkbox
4. Submit order - should queue
5. Uncheck "Offline" - should auto-sync

### Network Link Simulator
1. Open DevTools
2. Go to Network tab
3. Set throttling to "Offline"
4. Test offline flow

## Next Steps

1. Implement `/sync/actions` endpoint on backend
2. Test offline order submission
3. Test offline payment submission
4. Verify auto-sync on reconnect
5. Test persistent queue (close/reopen app)

## Support

For issues:
1. Check console logs (`electron-log` and browser console)
2. Verify backend `/sync/actions` working
3. Review OFFLINE_SUPPORT_IMPLEMENTATION.md
4. Check network connectivity manually
