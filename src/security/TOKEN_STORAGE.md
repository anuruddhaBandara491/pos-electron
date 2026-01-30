# Secure Token Storage Architecture

## Overview

This document describes the secure token storage system implemented for the Electron POS application. The system ensures that authentication tokens are stored securely, inaccessible to the renderer process, and protected from accidental exposure in logs.

## Architecture

### Components

#### 1. **TokenManager** (`src/security/TokenManager.js`)
Central manager for all token operations with:
- OS-level secure storage via **keytar** (Windows Credential Manager, macOS Keychain)
- Fallback encrypted storage via **electron-store**
- In-memory caching for performance
- Automatic token expiration tracking
- Log sanitization to prevent token leaks

#### 2. **ApiManager** (`src/api/ApiManager.js`)
HTTP client that:
- Delegates all token operations to TokenManager
- Uses async request interceptor with secure token retrieval
- Implements Bearer token authentication
- Handles 401/403 responses with secure token refresh

#### 3. **IpcHandler** (`src/ipc/IpcHandler.js`)
Secure IPC bridge that:
- Exposes ONLY safe token metadata via IPC
- Prevents renderer from accessing actual tokens
- Provides token status information without exposure

## Security Guarantees

### What's Protected

✅ **Actual tokens are NEVER**:
- Sent to renderer process
- Stored in localStorage or sessionStorage
- Exposed in logs or error messages
- Available via insecure IPC channels

✅ **Tokens are ALWAYS**:
- Stored in OS keychain (when available)
- Encrypted at rest (in electron-store fallback)
- Handled asynchronously (non-blocking)
- Cleared from memory on logout
- Sanitized from logs and errors

### What's Available to Renderer

The renderer process can access ONLY:
- Token existence status (boolean: has token?)
- Token expiration time (Unix timestamp)
- Seconds remaining until expiration (integer)
- Storage backend in use (string: "keytar" or "encrypted-store")

**The actual token string is NEVER accessible to renderer.**

## Storage Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process                         │
│  (Cannot access tokens directly - IPC only)                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ IPC Events (safe metadata only)
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              Main Process - IpcHandler                       │
│  ✓ Validates requests                                       │
│  ✓ Returns only safe token info                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓ Delegates to
┌─────────────────────────────────────────────────────────────┐
│           Main Process - TokenManager                        │
│  ✓ Manages all token operations (async)                    │
│  ✓ Sanitizes logs to prevent exposure                       │
│  ✓ In-memory cache for performance                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        ↓ Try First                   ↓ Fallback
┌────────────────────┐    ┌─────────────────────────┐
│   OS Keychain      │    │  Encrypted Storage      │
│  (keytar lib)      │    │  (electron-store)       │
│  • Windows: Cred   │    │  • AES-256 encryption   │
│    Manager         │    │  • JSON-serialized      │
│  • macOS: Keychain │    │  • Automatic fallback   │
│  • Linux: Secret   │    │    if keytar missing    │
│    Service         │    │                         │
└────────────────────┘    └─────────────────────────┘
```

## Token Lifecycle

### 1. Login Process
```javascript
// Renderer initiates login via IPC
ipcRenderer.invoke('auth:login', { email, password })
  ↓ Main process ApiManager.login()
  ↓ Receives { token, refreshToken, expiresIn } from API
  ↓ TokenManager.setAuthToken(token, expiresIn)
  ↓ Stores in keytar (or encrypted fallback)
  ↓ Tracks expiration timestamp
  ↓ Returns user data to renderer
```

### 2. API Request Process
```javascript
// ApiManager request interceptor
  ↓ Awaits tokenManager.getAuthToken()
  ↓ TokenManager retrieves from cache or secure storage
  ↓ Attaches "Authorization: Bearer {token}" header
  ↓ Sends request
  ↓ Token NEVER exposed to renderer
```

### 3. Token Refresh Process
```javascript
// On 401 response
  ↓ ApiManager.handle401Error()
  ↓ Calls tokenManager.getRefreshToken()
  ↓ Sends refresh token to API
  ↓ Receives new auth token
  ↓ Calls tokenManager.setAuthToken(newToken)
  ↓ Stores securely
  ↓ Retries original request
```

### 4. Logout Process
```javascript
// Renderer initiates logout via IPC
ipcRenderer.invoke('auth:logout', {})
  ↓ ApiManager.logout()
  ↓ Calls tokenManager.clearAllTokens()
  ↓ Removes from keytar and encrypted storage
  ↓ Clears in-memory cache
  ↓ Renderer redirected to login
```

## IPC Interface

### Safe Token Information
```javascript
// Get token metadata (no actual token exposed)
const tokenInfo = await ipcRenderer.invoke('auth:getTokenInfo');
// Returns: { hasToken: boolean, expiresAt: timestamp, secondsRemaining: number, storageBackend: string }

// Check if token is expired
const { isExpired } = await ipcRenderer.invoke('auth:isTokenExpired');
// Returns: { isExpired: boolean }

// Get seconds until expiration
const { secondsRemaining } = await ipcRenderer.invoke('auth:getTokenExpirySeconds');
// Returns: { secondsRemaining: number }

// Clear tokens (called on logout)
await ipcRenderer.invoke('auth:clearTokens');
// Returns: { success: true }
```

### Login/Logout
```javascript
// Login
const result = await ipcRenderer.invoke('auth:login', { email, password });
// Internally stores tokens securely via TokenManager

// Logout
await ipcRenderer.invoke('auth:logout');
// Internally clears all tokens via TokenManager
```

## Log Sanitization

The system prevents token exposure in logs through `sanitizeForLogging()`:

### Patterns Removed
- `"Authorization": "Bearer ..."` → `"Authorization": "[REDACTED]"`
- `token: "..."` → `token: "[REDACTED]"`
- `refreshToken: "..."` → `refreshToken: "[REDACTED]"`
- `access_token: "..."` → `access_token: "[REDACTED]"`
- `"Bearer eyJ..."` → `"[REDACTED]"`
- Any JWT-like string → `"[REDACTED]"`

### Example
```javascript
// Log these without exposure:
logger.log('Response:', { token: 'eyJ...', userId: 123 });
// Actual log: Response: { token: '[REDACTED]', userId: 123 }

logger.error('Auth error:', error);
// Error message: "Invalid Bearer token" (token itself removed)
```

## Fallback Behavior

### KeyTar Optional
The system gracefully handles keytar unavailability:

```
If keytar available:
  ✓ Use OS-level secure storage
  ✓ Tokens encrypted by OS
  ✓ Best security

If keytar NOT available:
  ✓ Fall back to electron-store encrypted storage
  ✓ Tokens encrypted via electron-store
  ✓ Still secure, different storage location
  ✓ Automatic, transparent to app code
```

### Detecting Which Backend
```javascript
const tokenInfo = await ipcRenderer.invoke('auth:getTokenInfo');
console.log(`Using: ${tokenInfo.storageBackend}`); // "keytar" or "encrypted-store"
```

## Best Practices

### ✅ DO
- Use `ipcRenderer.invoke()` for token operations
- Store token metadata (expiration, hasToken) in renderer
- Call `auth:clearTokens` on logout
- Check token expiry before API calls
- Use provided IPC channels exclusively

### ❌ DON'T
- Attempt to access tokens directly in renderer
- Store token strings in localStorage
- Log complete error objects from API
- Pass tokens between processes
- Access token from electron-store directly
- Use synchronous token operations

## Implementation Examples

### Check Token Status in React Component
```javascript
import { useEffect, useState } from 'react';
const { ipcRenderer } = window.require('electron');

function TokenStatus() {
  const [tokenInfo, setTokenInfo] = useState(null);

  useEffect(() => {
    async function checkToken() {
      try {
        const info = await ipcRenderer.invoke('auth:getTokenInfo');
        setTokenInfo(info);
      } catch (error) {
        console.error('Failed to get token info:', error);
      }
    }
    
    checkToken();
    const interval = setInterval(checkToken, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  if (!tokenInfo?.hasToken) {
    return <p>Not authenticated</p>;
  }

  return (
    <p>Token expires in {tokenInfo.secondsRemaining} seconds</p>
  );
}
```

### Handle Token Expiry Before API Call
```javascript
async function makeApiCall() {
  try {
    // Check if token is expiring soon (within 5 minutes)
    const { secondsRemaining } = await ipcRenderer.invoke('auth:getTokenExpirySeconds');
    
    if (secondsRemaining < 300) {
      // Token expiring soon, refresh it
      await ipcRenderer.invoke('auth:refreshToken');
    }
    
    // Now make the API call
    const response = await ipcRenderer.invoke('api:get', { endpoint: '/products' });
    return response;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}
```

### Logout Properly
```javascript
async function handleLogout() {
  try {
    // Call logout endpoint
    await ipcRenderer.invoke('auth:logout');
    
    // Clear tokens from secure storage
    await ipcRenderer.invoke('auth:clearTokens');
    
    // Redirect to login
    window.location.href = '/login';
  } catch (error) {
    console.error('Logout failed:', error);
    // Force redirect even if logout fails
    window.location.href = '/login';
  }
}
```

## Security Considerations

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| Token stolen from localStorage | Tokens never in localStorage, stored in OS keychain |
| Token exposed in logs | Log sanitization removes all token patterns |
| Renderer process compromised | Token still secure in main process keychain |
| Application source code inspected | No token strings in source, all ops via IPC |
| Development tools inspect memory | Token in secure OS memory, not accessible |
| Token in transit to API | Uses HTTPS, standard bearer token in header |
| Token refresh leak | Refresh token also stored securely, cleared on logout |

### When Tokens Are Vulnerable

⚠️ Tokens ARE accessible during:
- **API transmission** (mitigated by HTTPS)
- **Renderer-Main communication** (mitigated by IPC validation)
- **In-memory cache** (mitigated by limited time and logout clearing)

### Defense in Depth

1. **Storage Layer**: OS keychain with fallback encryption
2. **Access Layer**: Main process only, IPC validation
3. **Visibility Layer**: Log sanitization, no debug exposure
4. **Lifecycle Layer**: Automatic expiry tracking, logout clearing
5. **Transport Layer**: HTTPS + Bearer token standard

## Troubleshooting

### "TokenManager not initialized" Error
Ensure `tokenManager` is passed to `IpcHandler.registerHandlers()`:
```javascript
const tokenManager = new TokenManager();
ipcHandler.registerHandlers(mainWindow, apiManager, tokenManager);
```

### Keytar Installation Issues
On Windows, keytar requires build tools:
```bash
npm install --global windows-build-tools
npm install
```

On Linux, ensure libsecret is installed:
```bash
sudo apt-get install libsecret-1-dev
```

### Tokens Not Persisting
Check that electron-store is configured with encryption:
```javascript
const store = new Store({ 
  encryptionKey: 'your-key-here',
  watch: true 
});
```

### API Calls Failing with 401
1. Check token hasn't expired: `auth:getTokenExpirySeconds`
2. Verify token in secure storage: `auth:getTokenInfo`
3. Manually refresh: `auth:refreshToken`
4. Clear and re-login: `auth:clearTokens`

## Production Deployment

### Pre-Deployment Checklist
- [ ] Keytar added to dependencies
- [ ] TokenManager initialized in main process
- [ ] IpcHandler receives tokenManager instance
- [ ] No hardcoded tokens in source
- [ ] All token operations use IPC (renderer side)
- [ ] Logout clears all tokens
- [ ] Log sanitization enabled
- [ ] Error handling doesn't expose tokens
- [ ] HTTPS configured for API calls
- [ ] Token refresh working correctly

### Environment Setup
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

## Related Files

- [TokenManager.js](./TokenManager.js) - Secure token storage implementation
- [ApiManager.js](../api/ApiManager.js) - API client using TokenManager
- [IpcHandler.js](../ipc/IpcHandler.js) - IPC interface for token operations
- [SECURITY_CONFIG.md](./SECURITY_CONFIG.md) - General security configuration
- [API_SECURITY.md](../api/API_SECURITY.md) - API security best practices

## Support

For security issues or vulnerabilities, please contact the development team immediately. Do not disclose security issues publicly.

For questions about token storage, refer to the example implementations above or check the inline code documentation.
