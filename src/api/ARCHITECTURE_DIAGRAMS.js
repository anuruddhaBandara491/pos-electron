/**
 * SECURE API CLIENT ARCHITECTURE DIAGRAMS
 * 
 * Visual representation of the API client flow and components
 */

// ============================================================
// 1. REQUEST FLOW WITH TOKEN REFRESH
// ============================================================

/*
┌─────────────────────────────────────────────────────────────┐
│                    React Component                          │
└─────────────────┬───────────────────────────────────────────┘
                  │ useSecureApi()
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              useSecureApi Hook                              │
│  - GET, POST, PUT, PATCH, DELETE                            │
│  - Error handling                                           │
│  - Request cancellation                                     │
└─────────────────┬───────────────────────────────────────────┘
                  │ ipcRenderer.invoke()
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              IPC (Secure Communication)                     │
│  - Protected by context isolation                          │
│  - Serialized data only                                    │
└─────────────────┬───────────────────────────────────────────┘
                  │ ipcMain.handle()
                  ▼
┌─────────────────────────────────────────────────────────────┐
│           IPC Handler (Main Process)                        │
│  - Routes IPC calls                                        │
│  - Calls ApiManager                                        │
│  - Returns results to renderer                             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│           ApiManager (Main Process)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Request Interceptor                                 │  │
│  │ ✓ Inject Bearer token                              │  │
│  │ ✓ Add headers                                       │  │
│  │ ✓ Log request                                       │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                    │                                        │
│                    ▼                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Axios Client                                        │  │
│  │ - Creates HTTP request                              │  │
│  │ - Sends to backend                                  │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                    │                                        │
│                    ▼                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Response Interceptor                                │  │
│  │ ┌─ Check Status Code                                │  │
│  │ │                                                   │  │
│  │ ├─ 2xx Success?                                    │  │
│  │ │  └─ Extract & return data                        │  │
│  │ │                                                   │  │
│  │ ├─ 401 Unauthorized?                               │  │
│  │ │  ├─ Already refreshing?                          │  │
│  │ │  │  └─ Queue request                             │  │
│  │ │  └─ Start refresh                                │  │
│  │ │     ├─ Call /auth/refresh                        │  │
│  │ │     ├─ Save new token                            │  │
│  │ │     ├─ Retry original request                    │  │
│  │ │     └─ Notify subscribers                        │  │
│  │ │                                                   │  │
│  │ ├─ 403 Forbidden?                                  │  │
│  │ │  └─ Force logout                                 │  │
│  │ │                                                   │  │
│  │ └─ Other errors?                                   │  │
│  │    └─ Normalize to ApiError                        │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │  Backend API        │
        │  /api/v1/*          │
        └─────────────────────┘
*/

// ============================================================
// 2. TOKEN REFRESH WITH REQUEST QUEUING
// ============================================================

/*
Request 1 → 401 ─┐
Request 2 → 401 ─┼─→ Refresh Lock ─→ Call /auth/refresh ─→ Success
Request 3 → 401 ─┘                                           │
                                                              ├─ Update Token
                 ┌──────────────────────────────────────────┤
                 │                                           ├─ Notify Subscribers
                 │                                           │
                 ▼                                           ▼
            Request 1 Retry ─────────────────────→ Success
            Request 2 Retry ─────────────────────→ Success
            Request 3 Retry ─────────────────────→ Success

                 or

            Refresh Lock ───→ Call /auth/refresh ─→ FAIL
                                                     │
                                    ┌────────────────┘
                                    │
                                    ▼
                            Force Logout
                            Clear Auth
                            Return 401 Error
*/

// ============================================================
// 3. ERROR HANDLING FLOW
// ============================================================

/*
API Request
    │
    ▼
Response Received
    │
    ├─ Status 2xx? ─→ Success (extract data) ─→ Return
    │
    ├─ Status 401? ─→ Unauthorized
    │               │
    │               ├─ Already refreshing? ─→ Queue request
    │               │
    │               └─ Start refresh ─→ Success? ─→ Retry request
    │                                   │
    │                                   └─ Fail? ─→ Force logout
    │
    ├─ Status 403? ─→ Forbidden ─→ Force logout
    │
    ├─ Status 429? ─→ Rate limited ─→ Exponential backoff retry
    │
    ├─ Status 5xx? ─→ Server error ─→ Exponential backoff retry
    │
    └─ Other error? ─→ Normalize to ApiError ─→ Return error

        ▼

  All Errors Normalized to ApiError Class
    │
    ├─ Message: User-friendly description
    ├─ Status: HTTP status code
    ├─ Data: Backend error response
    ├─ Timestamp: When error occurred
    │
    └─ Helper Methods:
        ├─ isAuthError() - 401/403?
        ├─ isRecoverable() - Server error (5xx)?
        └─ getUserMessage() - Friendly message
*/

// ============================================================
// 4. COMPONENT ARCHITECTURE
// ============================================================

/*
┌─────────────────────────────────────────────────────────────┐
│                   Presentation Layer                        │
│                 (React Components)                          │
│  ┌────────────────┐  ┌───────────────┐  ┌──────────────┐   │
│  │ LoginPage      │  │ DashboardPage │  │ ProductsPage │   │
│  └────────┬───────┘  └───────┬───────┘  └──────┬───────┘   │
└───────────┼──────────────────┼──────────────────┼───────────┘
            │                  │                  │
            └──────────────────┼──────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Hook Layer                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ useSecureApi()                                       │   │
│  │ - get(endpoint, options)                             │   │
│  │ - post(endpoint, data, options)                      │   │
│  │ - put(endpoint, data, options)                       │   │
│  │ - patch(endpoint, data, options)                     │   │
│  │ - delete(endpoint, options)                          │   │
│  │ - cancel()                                           │   │
│  └──────────────────┬───────────────────────────────────┘   │
└─────────────────────┼───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               IPC Communication Layer                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ipcRenderer.invoke()                                 │   │
│  │ - Secure inter-process communication                 │   │
│  │ - Data serialization                                 │   │
│  │ - Error propagation                                  │   │
│  └──────────────────┬───────────────────────────────────┘   │
└─────────────────────┼───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               IPC Service Layer                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ IpcApiService                                        │   │
│  │ - initialize()                                       │   │
│  │ - call(channel, data)                                │   │
│  │ - Retry logic                                        │   │
│  │ - Event listeners                                    │   │
│  │ - Batch operations                                   │   │
│  └──────────────────┬───────────────────────────────────┘   │
└─────────────────────┼───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              IPC Handler Layer                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ IpcHandler (Main Process)                            │   │
│  │ - Routes IPC calls                                   │   │
│  │ - Calls ApiManager methods                           │   │
│  │ - Error handling                                     │   │
│  │ - Auth event emission                                │   │
│  └──────────────────┬───────────────────────────────────┘   │
└─────────────────────┼───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              API Manager Layer                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ApiManager (Main Process)                            │   │
│  │                                                      │   │
│  │ ┌─ Public Methods ──────────────────────────────┐   │   │
│  │ │ - login(email, password)                      │   │   │
│  │ │ - logout()                                    │   │   │
│  │ │ - getProducts(params)                         │   │   │
│  │ │ - ... (all API endpoints)                     │   │   │
│  │ └────────────────────────────────────────────────┘   │   │
│  │                                                      │   │
│  │ ┌─ Token Management ────────────────────────────┐   │   │
│  │ │ - setAuthToken(token, expiresIn)              │   │   │
│  │ │ - setRefreshToken(token)                      │   │   │
│  │ │ - clearAuth()                                 │   │   │
│  │ │ - isTokenExpired()                            │   │   │
│  │ │ - getTokenTimeRemaining()                     │   │   │
│  │ └────────────────────────────────────────────────┘   │   │
│  │                                                      │   │
│  │ ┌─ Error Handling ──────────────────────────────┐   │   │
│  │ │ - handle401Error()                            │   │   │
│  │ │ - handle403Error()                            │   │   │
│  │ │ - normalizeError()                            │   │   │
│  │ └────────────────────────────────────────────────┘   │   │
│  │                                                      │   │
│  │ ┌─ Interceptors ────────────────────────────────┐   │   │
│  │ │ - Request interceptor (token injection)       │   │   │
│  │ │ - Response interceptor (error handling)       │   │   │
│  │ └────────────────────────────────────────────────┘   │   │
│  └──────────────────┬───────────────────────────────────┘   │
└─────────────────────┼───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Axios HTTP Client                              │
│  - HTTP requests                                            │
│  - Connection pooling                                       │
│  - Timeout management                                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend API                                │
│  /api/v1/auth/login                                         │
│  /api/v1/auth/refresh                                       │
│  /api/v1/products                                           │
│  /api/v1/orders                                             │
│  ... (all endpoints)                                        │
└─────────────────────────────────────────────────────────────┘
*/

// ============================================================
// 5. SECURITY FLOW
// ============================================================

/*
┌──────────────────────────────────────────────────────────┐
│              User Initiates Action                       │
│              (Click button, submit form)                 │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│           useSecureApi Hook Called                       │
│  - Get auth token from context                           │
│  - Validate input                                        │
│  - Build request                                         │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│        IPC Request to Main Process                       │
│  - Data is serialized                                    │
│  - No code/functions passed                              │
│  - Protected by context isolation                        │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│      ApiManager - Request Interceptor                    │
│  ✓ Validate token exists                                │
│  ✓ Inject Authorization: Bearer <token>                │
│  ✓ Add secure headers                                   │
│  ✓ Log request (no PII)                                 │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│      HTTP Request Sent to Backend                        │
│  Headers:                                                │
│  - Authorization: Bearer eyJhbGc...                      │
│  - Content-Type: application/json                        │
│  - Custom headers from caller                            │
│                                                          │
│  Body: JSON data (validated & serialized)                │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│      Backend API Processes Request                       │
│  - Validates token signature & expiration                │
│  - Checks user permissions                               │
│  - Validates business logic                              │
│  - Returns response or error                             │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│    ApiManager - Response Interceptor                     │
│  ┌────────────────────────────────────────────────────┐ │
│  │ if (status === 200-299)                            │ │
│  │   → Extract data → Return                          │ │
│  │                                                    │ │
│  │ if (status === 401)                                │ │
│  │   → Check if already refreshing                    │ │
│  │   → Lock refresh, call /auth/refresh               │ │
│  │   → Update token in storage                        │ │
│  │   → Queue/Retry original request                   │ │
│  │   → Or force logout if refresh fails               │ │
│  │                                                    │ │
│  │ if (status === 403)                                │ │
│  │   → Clear all auth                                 │ │
│  │   → Force logout                                   │ │
│  │   → Return permission error                        │ │
│  │                                                    │ │
│  │ else                                               │ │
│  │   → Normalize to ApiError                          │ │
│  │   → Include user-friendly message                  │ │
│  │   → Return error                                   │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│       IPC Response to Renderer Process                   │
│  - Success: { success: true, data }                      │
│  - Error: { success: false, error, status }              │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│       useSecureApi - Handle Response                     │
│  - Check result.success                                  │
│  - Update state (data or error)                          │
│  - Update UI                                             │
│  - Callback to user                                      │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│           User Sees Result                               │
│  - Data displayed                                        │
│  - Error message shown                                   │
│  - UI updated                                            │
└──────────────────────────────────────────────────────────┘
*/

// ============================================================
// 6. FILE DEPENDENCIES
// ============================================================

/*
React Components
    │
    ├─→ useSecureApi() [hooks/useSecureApi.js]
    │       └─→ Fetch API
    │
    └─→ AuthContext [context/AuthContext.js]
            └─→ Authentication state


IPC (Renderer ↔ Main)
    │
    ├─→ IpcApiService [api/IpcApiService.js]
    │       └─→ ipcRenderer.invoke()
    │
    └─→ IpcHandler [ipc/IpcHandler.js]
            └─→ ipcMain.handle()


Main Process
    │
    ├─→ IpcHandler [ipc/IpcHandler.js]
    │       └─→ ApiManager [api/ApiManager.js]
    │
    ├─→ ApiManager [api/ApiManager.js]
    │       ├─→ axios [npm]
    │       ├─→ electron-log [npm]
    │       └─→ store [electron-store]
    │
    ├─→ SecurityManager [security/SecurityManager.js]
    │       └─→ Token validation
    │
    └─→ store [electron-store]
            └─→ Secure token storage


Utilities
    │
    ├─→ apiUtils [api/apiUtils.js]
    │       ├─→ Error formatting
    │       ├─→ Retry logic
    │       ├─→ Cache management
    │       └─→ Data validation
    │
    └─→ ApiError [api/ApiManager.js]
            └─→ Normalized error class


Documentation
    │
    ├─→ API_SECURITY.md [api/API_SECURITY.md]
    ├─→ API_INTEGRATION_GUIDE.js [api/API_INTEGRATION_GUIDE.js]
    ├─→ QUICK_REFERENCE.js [api/QUICK_REFERENCE.js]
    ├─→ SecureApiExamples.jsx [examples/SecureApiExamples.jsx]
    └─→ SECURE_API_IMPLEMENTATION.md [root/SECURE_API_IMPLEMENTATION.md]
*/

// ============================================================
// 7. TOKEN LIFECYCLE
// ============================================================

/*
User Login
    │
    ▼
POST /auth/login (email, password)
    │
    ├─ Credentials valid?
    │  │
    │  ├─ YES: Return { token, refreshToken, expiresIn }
    │  │       │
    │  │       ▼
    │  │   ApiManager.setAuthToken(token, expiresIn)
    │  │   │
    │  │   ├─ Save token to secure storage
    │  │   ├─ Set expiration time
    │  │   ├─ Attach to Authorization header
    │  │   │
    │  │   └─ Ready for authenticated requests
    │  │
    │  └─ NO: Return 401 Unauthorized
    │         │
    │         └─ Show error to user
    │
    ├─ Token Valid?
    │  │
    │  ├─ YES: Continue, use token for requests
    │  │
    │  └─ NO (expired or invalid)
    │      │
    │      └─ Next request returns 401
    │
    ▼
Request with Authorization Header
    │
    ├─ 200: Success, continue
    │
    ├─ 401: Unauthorized
    │  │
    │  ├─ Check if already refreshing
    │  │  ├─ YES: Queue request
    │  │  └─ NO: Start refresh
    │  │
    │  ▼
    │  POST /auth/refresh (refreshToken)
    │  │
    │  ├─ Valid refresh token?
    │  │  │
    │  │  ├─ YES: Return new token
    │  │  │       │
    │  │  │       ▼
    │  │  │   ApiManager.setAuthToken(newToken, expiresIn)
    │  │  │   │
    │  │  │   ├─ Save new token
    │  │  │   ├─ Retry original request
    │  │  │   ├─ Retry queued requests
    │  │  │   │
    │  │  │   └─ Continue using new token
    │  │  │
    │  │  └─ NO: Refresh failed
    │  │      │
    │  │      ▼
    │  │   ApiManager.clearAuth()
    │  │   │
    │  │   ├─ Clear token
    │  │   ├─ Clear refresh token
    │  │   ├─ Clear expiration
    │  │   │
    │  │   └─ Force logout, redirect to login
    │  │
    │  └─ Retry original request
    │
    └─ User Logout
       │
       ▼
    POST /auth/logout
       │
       ├─ Success: Clear local auth
       ├─ Failure: Still clear local auth
       │
       ▼
    ApiManager.clearAuth()
       │
       ├─ Clear token from memory
       ├─ Clear token from storage
       ├─ Clear refresh token
       ├─ Clear expiration
       ├─ Clear subscribers
       │
       └─ Redirect to login page
*/

// ============================================================
// SUMMARY
// ============================================================

/*
The secure API client system provides:

1. SECURITY
   - Bearer token authentication
   - Automatic token refresh (401 handling)
   - Forced logout on forbidden (403)
   - Centralized error handling
   - XSS prevention via context isolation

2. RELIABILITY
   - Retry logic with exponential backoff
   - Request queuing during token refresh
   - Timeout management
   - Error normalization
   - Recovery mechanisms

3. DEVELOPER EXPERIENCE
   - Simple React hooks (useSecureApi)
   - IPC service for main process
   - Utility functions for common tasks
   - Comprehensive documentation
   - Working examples

4. PRODUCTION READY
   - Logging and monitoring
   - Configuration options
   - Performance optimizations
   - Security best practices
   - Troubleshooting guides

All components work together seamlessly to provide
a secure, reliable, and user-friendly API client
experience for the Electron POS application.
*/

export default {
  // This is a documentation file - see code examples above
};
