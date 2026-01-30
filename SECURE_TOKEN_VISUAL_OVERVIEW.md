# Secure Token Storage System - Visual Overview

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Electron Application                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  RENDERER PROCESS                             │   │
│  │  (React App - Cannot access tokens directly)                 │   │
│  │                                                               │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │  Components: LoginPage, Navigation, Protected Routes │    │   │
│  │  │  Hooks: useAuth(), useApi()                          │    │   │
│  │  │  Context: AuthContext, AuthProvider                 │    │   │
│  │  └──────────────────────────┬──────────────────────────┘    │   │
│  │                              │                               │   │
│  │                              │ ipcRenderer.invoke()          │   │
│  │                              │ (Safe Metadata Only)          │   │
│  │                              ↓                               │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │  IPC Channels:                                       │    │   │
│  │  │  • auth:login                                        │    │   │
│  │  │  • auth:logout                                       │    │   │
│  │  │  • auth:getTokenInfo (safe metadata)               │    │   │
│  │  │  • auth:isTokenExpired                             │    │   │
│  │  │  • auth:getTokenExpirySeconds                      │    │   │
│  │  │  • api:get, api:post, api:put, api:delete         │    │   │
│  │  └──────────────────────────┬──────────────────────────┘    │   │
│  │                              │                               │   │
│  └──────────────────────────────┼───────────────────────────────┘   │
│                                  │ IPC Bridge                        │
│  ┌──────────────────────────────┼───────────────────────────────┐   │
│  │                              ↓                               │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │  MAIN PROCESS - IpcHandler                           │    │   │
│  │  │  • Validates IPC requests                            │    │   │
│  │  │  • Exposes only safe metadata                        │    │   │
│  │  │  • Handles auth operations                           │    │   │
│  │  │  • Delegates to TokenManager                         │    │   │
│  │  └──────────────────────────┬──────────────────────────┘    │   │
│  │                              │ Delegates to                   │   │
│  │                              ↓                               │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │  MAIN PROCESS - TokenManager                         │    │   │
│  │  │  • Manages all token operations (async)             │    │   │
│  │  │  • Interfaces with secure storage                    │    │   │
│  │  │  • Sanitizes logs                                    │    │   │
│  │  │  • Tracks token expiration                           │    │   │
│  │  │  • Caches tokens in memory (secure)                 │    │   │
│  │  └──────────┬───────────────────┬──────────────────────┘    │   │
│  │             │ Stores token in  │                             │   │
│  │             │ Primary/Fallback │                             │   │
│  │    ┌────────┴────────┐  ┌─────┴──────────┐                 │   │
│  │    ↓                 ↓  ↓                 ↓                 │   │
│  │  ┌──────────────────┐ ┌────────────────────────────────┐   │   │
│  │  │  OS KEYCHAIN     │ │ ENCRYPTED STORAGE              │   │   │
│  │  │  (via keytar)    │ │ (electron-store fallback)      │   │   │
│  │  │                  │ │                                │   │   │
│  │  │ Windows:         │ │ • AES-256 encrypted           │   │   │
│  │  │ Credential Mgr   │ │ • JSON serialized              │   │   │
│  │  │                  │ │ • Used if keytar unavailable  │   │   │
│  │  │ macOS:           │ │                                │   │   │
│  │  │ Keychain         │ │ Primary Storage (Preferred)   │   │   │
│  │  │                  │ │                                │   │   │
│  │  │ Linux:           │ │                                │   │   │
│  │  │ Secret Service   │ │                                │   │   │
│  │  └──────────────────┘ └────────────────────────────────┘   │   │
│  │                                                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  MAIN PROCESS - ApiManager                                   │   │
│  │  • Makes HTTP requests with Bearer token                      │   │
│  │  • Request interceptor awaits token from TokenManager         │   │
│  │  • Handles 401/403 with secure token refresh                │   │
│  │  • Uses sanitizing logger                                     │   │
│  │  • Gets tokens via TokenManager (never direct access)        │   │
│  └──────────────────────────────────┬──────────────────────────┘   │
│                                      │                               │
│                                      ↓ HTTPS                         │
│                        ┌─────────────────────────┐                  │
│                        │   API SERVER            │                  │
│                        │   • Returns tokens      │                  │
│                        │   • Validates Bearer    │                  │
│                        │   • Returns 401 if exp  │                  │
│                        └─────────────────────────┘                  │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### Login Flow

```
Renderer                IpcHandler          TokenManager        Keychain
   │                       │                    │                 │
   ├─ Login request ───────→│                    │                 │
   │                        ├─ Call api.login()  │                 │
   │                        │         ↓          │                 │
   │                        │         ↓ Return   │                 │
   │                        │  {token,refreshToken, expiresIn}     │
   │                        │                    │                 │
   │                        ├─ setAuthToken() ──→│                 │
   │                        │                    ├─ Store in ─────→│
   │                        │                    │  keychain       │
   │                        │                    │                 │
   │                        │                    ├─ Track ──────┐  │
   │                        │                    │  expiration  │  │
   │                        │                    │              ↓  │
   │ ← User data ───────────┤                    │  Cache in    │  │
   │                        │                    │  memory ←────┘  │
   │                                             │                 │
```

### API Request Flow (with Token)

```
Component         ApiManager          TokenManager        API Server
   │                  │                    │                 │
   ├─ GET /products ──→│                    │                 │
   │                  ├─ Request             │                 │
   │                  │ Interceptor          │                 │
   │                  │                      │                 │
   │                  ├─ getAuthToken() ────→│                 │
   │                  │                      ├─ Get from ─────→│
   │                  │                      │  cache or       │
   │                  │                      │  keychain       │
   │                  │ ← Token ─────────────┤                 │
   │                  │                      │                 │
   │                  ├─ Add Bearer header ──→ API Request ───→│
   │                  │                      │                 │
   │                  │                      │  ← Response ───│
   │                  │ ← {products} ─────────┤                 │
   │                  │                      │                 │
   │ ← {products} ────┤                      │                 │
   │                                          │                 │
```

### Token Refresh Flow (401 Response)

```
ApiManager         IpcHandler         TokenManager        Keychain      API
   │                  │                   │                 │             │
   │ ← 401 response ──┤                   │                 │             │
   │                  │                   │                 │             │
   ├─ Error handling  │                   │                 │             │
   │                  │                   │                 │             │
   ├─ getRefreshToken─→│                  │                 │             │
   │                  ├─ Get refresh ────→│                 │             │
   │                  │  token            ├─ From keychain →│             │
   │                  │  ← RefreshToken ──┤                 │             │
   │                  │                   │                 │             │
   ├─ POST /refresh ──────────────────────────────────────────────────→  │
   │                  │                   │                 │             │
   │  ← New token ────────────────────────────────────────────────────  │
   │                  │                   │                 │             │
   ├─ setAuthToken() ─→│                  │                 │             │
   │                  ├─ setAuthToken() ─→│                 │             │
   │                  │                   ├─ Store ────────→│             │
   │                  │                   │  new token      │             │
   │                  │                   │                 │             │
   ├─ Retry original request with new token ──────────────────────────→  │
   │                  │                   │                 │             │
   │  ← Response ────────────────────────────────────────────────────────│
   │                  │                   │                 │             │
```

### Logout Flow

```
Component         IpcHandler         TokenManager        Keychain      Logger
   │                  │                   │                 │             │
   ├─ Logout ────────→│                   │                 │             │
   │                  ├─ logout() ────────│                 │             │
   │                  │                   │                 │             │
   │                  ├─ clearAllTokens()→│                 │             │
   │                  │                   ├─ Delete from ──→│             │
   │                  │                   │  keychain       │             │
   │                  │                   │                 │             │
   │                  │                   ├─ Clear cache ──→ [REDACTED] ─→│
   │                  │                   │                 │             │
   │ ← { success } ───┤                   │                 │             │
   │                  │                   │                 │             │
   ├─ Redirect to /login
   │
```

## State Management Flow

```
┌────────────────────────────────────────────────────────────┐
│                    AuthContext State                        │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  user: {                                                    │
│    id: string                                               │
│    name: string                                             │
│    email: string                                            │
│    role: string                                             │
│  }                                                           │
│                                                              │
│  tokenInfo: {                                               │
│    hasToken: boolean                                        │
│    expiresAt: number (Unix timestamp)                       │
│    secondsRemaining: number                                 │
│    storageBackend: 'keytar' | 'encrypted-store'            │
│  }                                                           │
│                                                              │
│  loading: boolean                                           │
│  error: string | null                                       │
│                                                              │
│  Methods:                                                    │
│  - login(email, password)                                   │
│  - logout()                                                 │
│  - refreshToken()                                           │
│  - isTokenValid()                                           │
│                                                              │
└────────────────────────────────────────────────────────────┘
         ↓ Provided to Components
┌────────────────────────────────────────────────────────────┐
│                React Components                             │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  useAuth() hook provides:                                   │
│  - user data                                                │
│  - token status                                             │
│  - login/logout/refresh functions                           │
│  - token validation                                         │
│                                                              │
│  useApi() hook provides:                                    │
│  - get/post/put/delete methods                              │
│  - Automatic token refresh                                  │
│  - Error handling (especially 401)                          │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

## Log Sanitization

```
BEFORE LOGGING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  userId: 123,
  username: "john"
}

AFTER SANITIZATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  Authorization: "[REDACTED]",
  token: "[REDACTED]",
  refreshToken: "[REDACTED]",
  userId: 123,
  username: "john"
}

Patterns Removed:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ "Authorization": "Bearer ..."
✓ token: "..."
✓ refreshToken: "..."
✓ access_token: "..."
✓ "Bearer eyJ..." (JWT patterns)
✓ Any JWT-like string
```

## Token Expiry Tracking

```
Timeline of Token Lifecycle:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Login:
└─ Token issued with expiresIn (e.g., 3600 seconds)
   └─ expiresAt = current_time + 3600

Regular Use:
└─ API calls include token
   └─ secondsRemaining decreases
   
5 Minutes Before Expiry:
└─ Check: secondsRemaining < 300
   └─ YES: Refresh token
      └─ New token issued
      └─ Update expiresAt
      
0 Minutes (Expired):
└─ isTokenExpired() = true
   └─ On next API call, get 401
   └─ Force logout and redirect to login

After Logout:
└─ clearAllTokens()
   └─ Delete from keychain
   └─ Clear memory cache
   └─ Log sanitized: "Token cleared"
```

## Error Handling Flow

```
API Error Occurs
       │
       ├─ 400 Bad Request → Notify user
       │
       ├─ 401 Unauthorized → Token invalid/expired
       │   └─ Try refresh token
       │       ├─ Success → Retry request
       │       └─ Fail → Force logout
       │
       ├─ 403 Forbidden → No permission
       │   └─ Notify user "Insufficient permissions"
       │
       ├─ 500+ Server Error → Notify user "Server error"
       │
       └─ Network Error → Notify user "Connection failed"
```

## File Organization

```
src/
├── security/
│   ├── TokenManager.js              ← Core token management
│   ├── TOKEN_STORAGE.md             ← Architecture documentation
│   ├── DEVELOPER_GUIDE.md           ← Implementation guide
│   ├── QUICK_REFERENCE.md           ← Quick lookup
│   ├── SecurityManager.js           ← Existing (not modified)
│   └── securityConfig.js            ← Existing (not modified)
│
├── api/
│   └── ApiManager.js                ← Modified for TokenManager
│
├── ipc/
│   └── IpcHandler.js                ← Modified for token handlers
│
└── examples/
    └── SecureAuthExample.jsx        ← Complete React example

Root Documentation:
├── SECURE_TOKEN_CHECKLIST.md                ← Implementation tracking
├── SECURE_TOKEN_IMPLEMENTATION_COMPLETE.md  ← Completion summary
├── SECURE_TOKEN_SYSTEM_INDEX.md             ← This index
└── package.json                             ← Modified (keytar added)
```

## Summary

✅ **Complete System Implemented**
- TokenManager for secure token storage
- ApiManager integration with async operations
- IpcHandler with safe token access
- Complete documentation and examples
- Production-ready implementation

🔒 **Security Features**
- OS keychain integration (Windows/macOS/Linux)
- Encrypted fallback storage
- Main-process-only token access
- Log sanitization
- Automatic expiry tracking
- Secure logout

📚 **Documentation**
- Architecture overview (TOKEN_STORAGE.md)
- Developer guide (DEVELOPER_GUIDE.md)
- Quick reference (QUICK_REFERENCE.md)
- Working example (SecureAuthExample.jsx)
- Implementation tracking (SECURE_TOKEN_CHECKLIST.md)

Ready for production implementation and deployment!
