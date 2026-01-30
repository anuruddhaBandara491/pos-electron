# Backend Health Check - Quick Integration Guide

## What Was Added

Four files implemented:
1. **HealthCheckService.js** - Core service (330+ lines)
2. **HealthCheckIndicator.js** - Status widget
3. **OfflineModeBanner.js** - Offline alert
4. **PosActionGuard.js** - Action blocker

Plus 3 CSS files + updates to App.js, Navigation.css

## 5-Minute Setup

### 1. Already Done in App.js

```javascript
// Imports added
import healthCheckService from './services/HealthCheckService';
import HealthCheckIndicator from './components/HealthCheckIndicator';
import OfflineModeBanner from './components/OfflineModeBanner';

// State added
const [backendHealthy, setBackendHealthy] = useState(true);

// In useEffect - health check initialization
await healthCheckService.initialize();
healthCheckService.onStatusChange((healthy) => {
  setBackendHealthy(healthy);
});

// In render - components added
<OfflineModeBanner healthCheckService={healthCheckService} />
<header className="app-header">
  <Navigation ... />
  <HealthCheckIndicator healthCheckService={healthCheckService} />
</header>

// In context - health data shared
backendHealthy={backendHealthy}
healthCheckService={healthCheckService}
```

### 2. Use in Components

**Simple Check:**
```jsx
const { backendHealthy } = useContext(AuthContext);

if (!backendHealthy) {
  return <OfflineMessage />;
}
```

**With Guard:**
```jsx
<PosActionGuard requiresBackend={true}>
  <CreateOrderForm />
</PosActionGuard>
```

**Manual Retry:**
```jsx
const { healthCheckService } = useContext(AuthContext);
<button onClick={() => healthCheckService.checkNow()}>
  Retry
</button>
```

## What It Does

### On App Start
1. Calls backend `/health` endpoint
2. Starts checking every 30 seconds
3. Displays status (online/offline/checking)
4. Shows offline banner if needed

### When Offline
1. Shows red warning banner
2. Disables POS action buttons
3. Allows manual retry
4. Auto-retries every 30 seconds

### When Recovering
1. Clears warning banner
2. Enables POS actions again
3. Updates status indicator
4. Notifies all listeners

## Visual Indicators

### Header Status Widget
- **● Online** (Green) - Backend responding
- **● Offline** (Red) - Backend unreachable
- **◐ Checking...** (Yellow) - Health check in progress

Click/tap the `⋮` button to see:
- Last check time
- Check interval
- Failure count
- Manual retry button

### Offline Banner
Red banner appears when offline with:
- Warning message
- Retry button (after 3 seconds)
- Help link

## Configuration

Default settings (in HealthCheckService.js):
```javascript
checkInterval: 30000      // Check every 30 seconds
timeoutDuration: 5000     // 5 second timeout
maxRetries: 3             // Offline after 3 failures
```

Change if needed:
```javascript
// In App.js or main initialization
healthCheckService.checkInterval = 15000; // Faster checks
healthCheckService.maxRetries = 1;         // More aggressive
```

## Backend Requirement

Must have a `/health` endpoint that:
- Returns 200 OK when healthy
- Responds in < 5 seconds
- Doesn't require authentication
- Can be called frequently

**Laravel example:**
```php
Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});
```

## Already Wired Up

IPC handlers already exist in IpcHandler.js:
```javascript
ipcMain.handle('health:check', this.handleHealthCheck.bind(this));
ipcMain.handle('health:getDetailed', this.handleGetDetailedHealth.bind(this));
ipcMain.handle('health:getLive', this.handleGetLiveProbe.bind(this));
ipcMain.handle('health:getReady', this.handleGetReadyProbe.bind(this));
```

## Using HealthCheckService

### In Components (Recommended)

```jsx
import AuthContext from '../context/AuthContext';

function MyComponent() {
  const { backendHealthy, healthCheckService } = useContext(AuthContext);
  
  // Check status
  if (!backendHealthy) {
    return <OfflineUI />;
  }
  
  // Manual retry
  const handleRetry = async () => {
    await healthCheckService.checkNow();
  };
  
  // Get diagnostic info
  const diagnostics = healthCheckService.getDiagnostics();
  
  return <NormalUI />;
}
```

### Direct Access

```javascript
// Only if needed (prefer context)
import healthCheckService from '../services/HealthCheckService';

// Get current status
const status = healthCheckService.getStatusString(); // 'online' | 'offline' | 'checking'

// Check synchronously
const isHealthy = healthCheckService.isBackendHealthy();

// Subscribe to changes
const unsubscribe = healthCheckService.onStatusChange((isHealthy) => {
  console.log('Backend status:', isHealthy ? 'online' : 'offline');
});
```

## Blocking POS Actions

### Option 1: Conditional Rendering
```jsx
const { backendHealthy } = useContext(AuthContext);

return backendHealthy ? (
  <CreateOrderForm />
) : (
  <DisabledMessage />
);
```

### Option 2: Using Guard Component
```jsx
<PosActionGuard requiresBackend={true}>
  <button onClick={createOrder}>Create Order</button>
</PosActionGuard>
```

### Option 3: Disabled Button State
```jsx
const { backendHealthy } = useContext(AuthContext);

<button 
  onClick={handleClick}
  disabled={!backendHealthy}
  title={backendHealthy ? 'Create' : 'Backend offline'}
>
  {backendHealthy ? 'Create Order' : 'Offline'}
</button>
```

## Debugging

### Check Status in Browser Console
```javascript
// Current status
healthCheckService.getStatusString()

// Full diagnostic info
healthCheckService.getDiagnostics()

// Last check result
healthCheckService.getStatus()

// Manually trigger check
await healthCheckService.checkNow()
```

### View Logs
```javascript
// Electron logs show:
// "Health check passed in XXms"
// "Health check failed (attempt X/3): ..."
// "Backend status changed: ONLINE → OFFLINE"
```

## Testing Offline Mode

1. **Stop backend server** - App will detect after 10-30 seconds
2. **Watch for red banner** - "Backend Offline" alert appears
3. **Verify buttons disabled** - POS actions are blocked
4. **Click "Check Now"** - Manual retry button
5. **Restart backend** - Status changes to online automatically

## Next Steps

1. **Add `/health` endpoint** to Laravel backend
2. **Test offline scenario** by stopping backend
3. **Customize messages** (edit component strings)
4. **Adjust timing** if needed (checkInterval, timeout)
5. **Add logging** in production (already built-in)

## File Locations

```
src/
├── services/
│   └── HealthCheckService.js (NEW)
├── components/
│   ├── HealthCheckIndicator.js (NEW)
│   ├── OfflineModeBanner.js (NEW)
│   ├── PosActionGuard.js (NEW)
│   └── Navigation.js (MODIFIED)
├── styles/
│   ├── HealthCheckIndicator.css (NEW)
│   ├── OfflineModeBanner.css (NEW)
│   ├── PosActionGuard.css (NEW)
│   ├── Navigation.css (MODIFIED)
│   └── App.css (MODIFIED)
└── App.js (MODIFIED)
```

## Architecture

```
App (main component)
├── HealthCheckService (singleton - initializes on startup)
│   ├── Performs /health checks every 30s
│   ├── Maintains online/offline state
│   └── Notifies listeners of status changes
│
├── OfflineModeBanner (shows red warning)
│   └── Subscribes to healthCheckService
│
├── Navigation
│   └── Normal navigation menu
│
└── HealthCheckIndicator (status widget)
    └── Subscribes to healthCheckService
        └── Shows status + manual retry
```

## Performance

- **Network**: 1 GET request per 30 seconds (negligible)
- **CPU**: Event-driven (only on status changes)
- **Memory**: ~1KB per listener + service data
- **UI Updates**: Only on status changes (efficient)

## What Happens When Offline

```
User tries to create order
    ↓
Component checks backendHealthy (false)
    ↓
Option A: Button is disabled
Option B: Guard component shows overlay
Option C: Component renders offline message
    ↓
User sees "Backend offline" feedback
    ↓
User clicks "Retry" or waits for auto-retry
    ↓
Health check passes
    ↓
Status changes to online
    ↓
Buttons enabled / Guard removed
    ↓
User can proceed with order
```

## Key Methods (Cheat Sheet)

```javascript
// Status checks
healthCheckService.isBackendHealthy()        // boolean
healthCheckService.getStatusString()         // 'online'|'offline'|'checking'
healthCheckService.getStatus()               // { isHealthy, isChecking, ... }

// Control
await healthCheckService.checkNow()          // Manual check
healthCheckService.onStatusChange(callback)  // Subscribe
healthCheckService.getDiagnostics()          // Debug info
healthCheckService.waitForOnline(timeout)    // Wait for recovery

// Cleanup
healthCheckService.stopPeriodicChecks()      // Stop checking
healthCheckService.destroy()                 // Full cleanup
```

## Common Questions

**Q: Does it require changes to backend?**
A: Only need a `/health` endpoint that returns 200 OK

**Q: What if I have multiple backend servers?**
A: Health check calls one server (adjust IPC handler if needed)

**Q: Can I customize the check interval?**
A: Yes: `healthCheckService.checkInterval = 60000;`

**Q: What if user has slow internet?**
A: Increase timeout: `healthCheckService.timeoutDuration = 10000;`

**Q: How do I test offline mode?**
A: Stop backend server, wait 10 seconds, look for red banner

**Q: Does it work with authentication?**
A: Yes, /health endpoint doesn't require auth

**Q: Can I show custom messages?**
A: Yes, edit component strings (search for "Backend offline")

## Success Indicators

✅ App shows green "● Online" in header
✅ No red "Backend Offline" banner on startup
✅ When you stop backend, red banner appears after ~10 seconds
✅ Buttons in POS get disabled/blocked when offline
✅ Banner disappears when backend comes back online
✅ Manual "Check Now" button works
✅ Status updates in real-time

---

**Implementation Status: COMPLETE & READY FOR TESTING**

All code is integrated into App.js and ready to use. Just add the `/health` endpoint to your Laravel backend and test offline scenarios!
