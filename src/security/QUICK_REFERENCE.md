# Secure Token Management - Quick Reference

## IPC Channels Quick List

### Authentication
| Channel | Purpose | Returns |
|---------|---------|---------|
| `auth:login` | Login user | `{ id, name, email, role }` |
| `auth:logout` | Logout user | `{ success: true }` |
| `auth:refreshToken` | Refresh token | `{ success: true, expiresIn }` |
| `auth:getCurrentUser` | Get current user | `{ id, name, email, role }` |

### Token Info (Safe - No Actual Token Exposed)
| Channel | Purpose | Returns |
|---------|---------|---------|
| `auth:getTokenInfo` | Get token metadata | `{ hasToken, expiresAt, secondsRemaining, storageBackend }` |
| `auth:isTokenExpired` | Check if expired | `{ isExpired: boolean }` |
| `auth:getTokenExpirySeconds` | Seconds remaining | `{ secondsRemaining: number }` |
| `auth:clearTokens` | Clear all tokens | `{ success: true }` |

### API Calls
| Channel | Purpose | Usage |
|---------|---------|-------|
| `api:get` | GET request | `{ endpoint, params }` |
| `api:post` | POST request | `{ endpoint, data }` |
| `api:put` | PUT request | `{ endpoint, data }` |
| `api:delete` | DELETE request | `{ endpoint }` |

## Code Snippets

### Login
```javascript
const { ipcRenderer } = window.require('electron');

async function login(email, password) {
  try {
    const user = await ipcRenderer.invoke('auth:login', { email, password });
    console.log('Logged in as:', user.name);
    return user;
  } catch (error) {
    console.error('Login failed:', error.message);
    throw error;
  }
}
```

### Logout
```javascript
async function logout() {
  try {
    await ipcRenderer.invoke('auth:logout');
    await ipcRenderer.invoke('auth:clearTokens');
    window.location.href = '/login';
  } catch (error) {
    console.error('Logout failed:', error);
    window.location.href = '/login';
  }
}
```

### Check Token Status
```javascript
async function checkToken() {
  const tokenInfo = await ipcRenderer.invoke('auth:getTokenInfo');
  
  if (!tokenInfo.hasToken) {
    console.log('Not authenticated');
    return false;
  }
  
  if (tokenInfo.secondsRemaining < 0) {
    console.log('Token expired');
    await ipcRenderer.invoke('auth:logout');
    return false;
  }
  
  console.log(`Token valid for ${tokenInfo.secondsRemaining}s`);
  return true;
}
```

### API Call with Token Check
```javascript
async function apiCall(endpoint) {
  // Check and refresh token if needed
  const { secondsRemaining } = await ipcRenderer.invoke('auth:getTokenExpirySeconds');
  if (secondsRemaining < 300) {
    await ipcRenderer.invoke('auth:refreshToken');
  }
  
  // Make API call
  return await ipcRenderer.invoke('api:get', { endpoint });
}
```

### React Component Hook
```javascript
import { useEffect, useState } from 'react';
const { ipcRenderer } = window.require('electron');

function useAuth() {
  const [user, setUser] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const info = await ipcRenderer.invoke('auth:getTokenInfo');
        const currentUser = await ipcRenderer.invoke('auth:getCurrentUser');
        
        setTokenInfo(info);
        setUser(currentUser);
      } catch (error) {
        setTokenInfo(null);
        setUser(null);
      }
    }

    checkAuth();
    const interval = setInterval(checkAuth, 60000);
    return () => clearInterval(interval);
  }, []);

  return { user, tokenInfo };
}
```

## Security Rules

### ✅ Always
- Use `await` for IPC calls
- Check token expiry before critical ops
- Call logout + clearTokens on logout
- Handle 401 errors with redirect to login
- Use IPC only, never direct token access

### ❌ Never
- Store tokens in localStorage
- Log error objects directly
- Pass tokens between processes
- Access tokens synchronously
- Use hardcoded token strings

## Error Handling

```javascript
try {
  const data = await ipcRenderer.invoke('api:get', { endpoint });
} catch (error) {
  if (error.status === 401) {
    await logout();
  } else if (error.status === 403) {
    console.error('No permission');
  } else if (error.status >= 500) {
    console.error('Server error');
  } else {
    console.error('Network error');
  }
}
```

## Files

| File | Purpose |
|------|---------|
| `src/security/TokenManager.js` | Secure token storage |
| `src/api/ApiManager.js` | API client with token mgmt |
| `src/ipc/IpcHandler.js` | IPC handlers |
| `src/security/TOKEN_STORAGE.md` | Full documentation |
| `src/security/DEVELOPER_GUIDE.md` | Developer guide |

## Setup

```javascript
// In main.js
const TokenManager = require('./security/TokenManager');
const ApiManager = require('./api/ApiManager');
const IpcHandler = require('./ipc/IpcHandler');

const tokenManager = new TokenManager();
const apiManager = new ApiManager({ tokenManager });
const ipcHandler = new IpcHandler(log, store, tokenManager);

ipcHandler.registerHandlers(mainWindow, apiManager, tokenManager);
```

## Debugging

```javascript
// Check token status
const info = await ipcRenderer.invoke('auth:getTokenInfo');
console.log(info);
// Output: {
//   hasToken: true,
//   expiresAt: 1234567890,
//   secondsRemaining: 1234,
//   storageBackend: 'keytar'
// }

// Check if expired
const { isExpired } = await ipcRenderer.invoke('auth:isTokenExpired');
console.log('Expired:', isExpired);

// Get seconds remaining
const { secondsRemaining } = await ipcRenderer.invoke('auth:getTokenExpirySeconds');
console.log('Seconds:', secondsRemaining);
```

## Important Notes

- **Tokens are NEVER accessible to renderer** - They're stored in OS keychain (main process only)
- **Logs are sanitized** - Token strings are replaced with `[REDACTED]`
- **Automatic fallback** - If keytar unavailable, uses encrypted storage
- **Async required** - All token operations require `await`
- **IPC only** - Renderer communicates via IPC channels only

## Common Issues

| Issue | Fix |
|-------|-----|
| "TokenManager not initialized" | Pass tokenManager to registerHandlers() |
| Tokens not persisting | Check electron-store encryptionKey is set |
| 401 after refresh | Check refresh token validity and API response |
| Operations timing out | Increase IPC timeout, check main process |

## More Information

See `TOKEN_STORAGE.md` for architecture details and `DEVELOPER_GUIDE.md` for complete examples.
