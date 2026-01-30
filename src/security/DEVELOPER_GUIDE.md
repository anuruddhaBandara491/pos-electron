# Developer Guide: Secure Token Management in Electron POS

## Quick Start

### Setup (Main Process)
```javascript
// In main.js
const { app, BrowserWindow } = require('electron');
const log = require('electron-log');
const Store = require('electron-store');
const TokenManager = require('./security/TokenManager');
const ApiManager = require('./api/ApiManager');
const IpcHandler = require('./ipc/IpcHandler');

// Initialize
const store = new Store({ encryptionKey: 'secure-key-here' });
const tokenManager = new TokenManager();
const apiManager = new ApiManager({ tokenManager });
const ipcHandler = new IpcHandler(log, store, tokenManager);

// Register IPC handlers
ipcHandler.registerHandlers(mainWindow, apiManager, tokenManager);
```

### Usage (Renderer Process)
```javascript
const { ipcRenderer } = window.require('electron');

// Login
const user = await ipcRenderer.invoke('auth:login', { 
  email: 'user@example.com', 
  password: 'password123' 
});

// Make API calls (tokens handled automatically)
const products = await ipcRenderer.invoke('api:get', { endpoint: '/products' });

// Check token status
const tokenInfo = await ipcRenderer.invoke('auth:getTokenInfo');
console.log(`Token valid: ${tokenInfo.hasToken}`);
console.log(`Expires in: ${tokenInfo.secondsRemaining}s`);

// Logout
await ipcRenderer.invoke('auth:logout');
```

## Common Tasks

### 1. Implement Login Form
```javascript
import React, { useState } from 'react';
const { ipcRenderer } = window.require('electron');

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const user = await ipcRenderer.invoke('auth:login', { email, password });
      console.log('Logged in:', user.name);
      // Navigate to dashboard
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

### 2. Implement Logout
```javascript
async function handleLogout() {
  try {
    // Tell main process to logout
    await ipcRenderer.invoke('auth:logout');
    
    // Clear tokens
    await ipcRenderer.invoke('auth:clearTokens');
    
    // Redirect to login
    window.location.href = '/login';
  } catch (error) {
    console.error('Logout failed:', error);
    // Force redirect anyway
    window.location.href = '/login';
  }
}

// In your logout button
<button onClick={handleLogout}>Logout</button>
```

### 3. Check Token Expiry Before API Call
```javascript
async function makeSecureApiCall(endpoint, options) {
  try {
    // Check if token is expiring soon (within 5 minutes)
    const { secondsRemaining } = await ipcRenderer.invoke(
      'auth:getTokenExpirySeconds'
    );

    if (secondsRemaining < 300) {
      // Token expiring soon, refresh it
      console.log('Token expiring soon, refreshing...');
      await ipcRenderer.invoke('auth:refreshToken');
    }

    // Now make the API call
    const response = await ipcRenderer.invoke('api:request', {
      method: options.method || 'GET',
      endpoint,
      data: options.data,
    });

    return response;
  } catch (error) {
    console.error('API call failed:', error);
    
    // If 401, force logout
    if (error.status === 401) {
      await handleLogout();
    }
    
    throw error;
  }
}
```

### 4. Monitor Token Status in Component
```javascript
import { useEffect, useState } from 'react';
const { ipcRenderer } = window.require('electron');

function TokenStatusWidget() {
  const [tokenStatus, setTokenStatus] = useState({
    hasToken: false,
    secondsRemaining: 0,
  });

  useEffect(() => {
    // Check token status on mount and periodically
    async function updateStatus() {
      try {
        const tokenInfo = await ipcRenderer.invoke('auth:getTokenInfo');
        setTokenStatus({
          hasToken: tokenInfo.hasToken,
          secondsRemaining: tokenInfo.secondsRemaining,
        });
      } catch (error) {
        console.error('Failed to get token status:', error);
      }
    }

    updateStatus();
    
    // Update every 30 seconds
    const interval = setInterval(updateStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (!tokenStatus.hasToken) {
    return <span>Not authenticated</span>;
  }

  const minutes = Math.floor(tokenStatus.secondsRemaining / 60);
  const seconds = tokenStatus.secondsRemaining % 60;

  return (
    <span>
      Token expires in {minutes}m {seconds}s
    </span>
  );
}

export default TokenStatusWidget;
```

### 5. Implement Protected Route
```javascript
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
const { ipcRenderer } = window.require('electron');

function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const tokenInfo = await ipcRenderer.invoke('auth:getTokenInfo');
        setIsAuthenticated(tokenInfo.hasToken && tokenInfo.secondsRemaining > 0);
      } catch (error) {
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
```

## API Reference

### Authentication IPC Channels

#### `auth:login`
Login with email and password.
```javascript
const user = await ipcRenderer.invoke('auth:login', {
  email: string,
  password: string
});
// Returns: { id, name, email, role, ... }
```

#### `auth:logout`
Logout current user.
```javascript
await ipcRenderer.invoke('auth:logout');
// Returns: { success: true }
```

#### `auth:refreshToken`
Refresh authentication token.
```javascript
const result = await ipcRenderer.invoke('auth:refreshToken');
// Returns: { success: true, expiresIn: 3600 }
```

#### `auth:getCurrentUser`
Get current authenticated user.
```javascript
const user = await ipcRenderer.invoke('auth:getCurrentUser');
// Returns: { id, name, email, role, ... }
```

### Secure Token IPC Channels

#### `auth:getTokenInfo`
Get safe token metadata (NO actual token exposed).
```javascript
const info = await ipcRenderer.invoke('auth:getTokenInfo');
// Returns: {
//   hasToken: boolean,
//   expiresAt: number (Unix timestamp),
//   secondsRemaining: number,
//   storageBackend: 'keytar' | 'encrypted-store'
// }
```

#### `auth:isTokenExpired`
Check if token is expired.
```javascript
const { isExpired } = await ipcRenderer.invoke('auth:isTokenExpired');
// Returns: { isExpired: boolean }
```

#### `auth:getTokenExpirySeconds`
Get seconds until token expires.
```javascript
const { secondsRemaining } = await ipcRenderer.invoke('auth:getTokenExpirySeconds');
// Returns: { secondsRemaining: number }
```

#### `auth:clearTokens`
Clear all stored tokens.
```javascript
await ipcRenderer.invoke('auth:clearTokens');
// Returns: { success: true }
```

### Data API IPC Channels

#### `api:get`
Make GET request.
```javascript
const data = await ipcRenderer.invoke('api:get', {
  endpoint: string
});
```

#### `api:post`
Make POST request.
```javascript
const data = await ipcRenderer.invoke('api:post', {
  endpoint: string,
  data: object
});
```

#### `api:put`
Make PUT request.
```javascript
const data = await ipcRenderer.invoke('api:put', {
  endpoint: string,
  data: object
});
```

#### `api:delete`
Make DELETE request.
```javascript
const data = await ipcRenderer.invoke('api:delete', {
  endpoint: string
});
```

## Error Handling

### Login Errors
```javascript
try {
  await ipcRenderer.invoke('auth:login', { email, password });
} catch (error) {
  if (error.message.includes('Invalid credentials')) {
    // Show "Email or password incorrect"
  } else if (error.message.includes('User not found')) {
    // Show "Account does not exist"
  } else {
    // Show generic error
    console.error('Login error:', error);
  }
}
```

### API Errors
```javascript
try {
  const data = await ipcRenderer.invoke('api:get', { endpoint: '/products' });
} catch (error) {
  if (error.status === 401) {
    // Token expired or invalid
    await ipcRenderer.invoke('auth:logout');
    window.location.href = '/login';
  } else if (error.status === 403) {
    // Forbidden - insufficient permissions
    console.error('You do not have permission to access this resource');
  } else if (error.status === 500) {
    // Server error
    console.error('Server error:', error.message);
  } else {
    // Network or other error
    console.error('API error:', error);
  }
}
```

## Security Best Practices

### ✅ DO

1. **Always use async/await for token operations**
   ```javascript
   // Good
   const { secondsRemaining } = await ipcRenderer.invoke('auth:getTokenExpirySeconds');
   
   // Bad - missing await
   const info = ipcRenderer.invoke('auth:getTokenInfo');
   ```

2. **Check token expiry before critical operations**
   ```javascript
   // Good
   const { secondsRemaining } = await ipcRenderer.invoke('auth:getTokenExpirySeconds');
   if (secondsRemaining < 300) {
     await ipcRenderer.invoke('auth:refreshToken');
   }
   ```

3. **Validate response status codes**
   ```javascript
   // Good
   try {
     const data = await ipcRenderer.invoke('api:get', { endpoint: '/products' });
     // Process data
   } catch (error) {
     // Handle error
   }
   ```

4. **Clear tokens on logout**
   ```javascript
   // Good
   await ipcRenderer.invoke('auth:logout');
   await ipcRenderer.invoke('auth:clearTokens');
   ```

### ❌ DON'T

1. **Store tokens in localStorage**
   ```javascript
   // BAD - insecure
   localStorage.setItem('token', token);
   ```

2. **Pass tokens between windows/processes**
   ```javascript
   // BAD - tokens should stay in main process
   ipcRenderer.send('set-token', token);
   ```

3. **Log complete error objects**
   ```javascript
   // BAD - may expose tokens
   console.log('Error:', error);
   
   // Good
   console.log('Error:', error.message);
   ```

4. **Use synchronous token operations**
   ```javascript
   // BAD - would block UI
   const token = tokenManager.getAuthTokenSync();
   
   // Good
   const token = await tokenManager.getAuthToken();
   ```

## Debugging

### Check If Token Exists
```javascript
const tokenInfo = await ipcRenderer.invoke('auth:getTokenInfo');
console.log('Has token:', tokenInfo.hasToken);
console.log('Storage backend:', tokenInfo.storageBackend);
```

### Check Token Expiration
```javascript
const { isExpired } = await ipcRenderer.invoke('auth:isTokenExpired');
console.log('Token expired:', isExpired);

const { secondsRemaining } = await ipcRenderer.invoke('auth:getTokenExpirySeconds');
console.log('Seconds remaining:', secondsRemaining);
```

### View Electron Logs
Logs are stored in:
- **Windows**: `%APPDATA%\pos-electron\logs\`
- **macOS**: `~/Library/Application Support/pos-electron/logs/`
- **Linux**: `~/.config/pos-electron/logs/`

Tokens are sanitized in logs, so you'll see `[REDACTED]` instead of actual token values.

### Enable Debug Logging
```javascript
// In main.js
const log = require('electron-log');
log.transports.file.level = 'debug';
```

## Testing

### Mock Login in Development
```javascript
// Development helper
async function mockLogin() {
  const mockUser = {
    id: 'dev-user-1',
    name: 'Developer',
    email: 'dev@example.com',
    role: 'admin'
  };
  
  // In real app, this would be via IPC
  return mockUser;
}
```

### Test Token Expiry
```javascript
// Simulate token about to expire
async function testTokenExpiry() {
  const { secondsRemaining } = await ipcRenderer.invoke('auth:getTokenExpirySeconds');
  console.log(`Token expires in ${secondsRemaining}s`);
  
  if (secondsRemaining < 300) {
    console.log('Triggering refresh...');
    await ipcRenderer.invoke('auth:refreshToken');
  }
}
```

## Troubleshooting

### Issue: "TokenManager not initialized"
**Solution**: Ensure tokenManager is passed to IpcHandler:
```javascript
const ipcHandler = new IpcHandler(log, store, tokenManager);
ipcHandler.registerHandlers(mainWindow, apiManager, tokenManager);
```

### Issue: Tokens not persisting after app restart
**Solution**: Check that electron-store is configured with encryption:
```javascript
const store = new Store({
  encryptionKey: 'your-secure-key'
});
```

### Issue: Token operations timing out
**Solution**: Use longer timeout for IPC invocations:
```javascript
const tokenInfo = await ipcRenderer.invoke('auth:getTokenInfo');
// Add timeout handling
Promise.race([
  ipcRenderer.invoke('auth:getTokenInfo'),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), 5000)
  )
]);
```

### Issue: 401 errors after token refresh
**Solution**: Ensure refresh token is valid:
```javascript
const tokenInfo = await ipcRenderer.invoke('auth:getTokenInfo');
if (!tokenInfo.hasToken) {
  // No token, redirect to login
  window.location.href = '/login';
} else if (tokenInfo.secondsRemaining < 0) {
  // Token expired, try refresh
  await ipcRenderer.invoke('auth:refreshToken');
}
```

## Next Steps

1. Implement login component
2. Set up protected routes
3. Add token status display
4. Implement automatic token refresh
5. Add logout functionality
6. Monitor logs for token leaks
7. Test with production API

For more information, see [TOKEN_STORAGE.md](./TOKEN_STORAGE.md).
