/**
 * ELECTRON LOGIN FLOW - QUICK REFERENCE
 * Complete implementation with 6 requirements fulfilled
 */

// ============================================================================
// REQUIREMENT 1: CREATE LOGIN SCREEN WITH DEVICE_NAME FIELD
// ============================================================================
// File: src/pages/LoginPage.js (145 lines)
// 
// Component Features:
// - Three form fields: email, password, deviceName
// - Real-time validation with error messages
// - Field-specific error display
// - Loading state during submission
// - Errors clear when user modifies field
// - Clean, professional UI with clear visual hierarchy
//
// Usage:
// <LoginPage onLogin={handleLogin} error={error} />
//
// Parameters passed to onLogin callback:
// onLogin(email, password, deviceName)

// ============================================================================
// REQUIREMENT 2: ACCEPT EMAIL, PASSWORD, DEVICE_NAME PARAMETERS
// ============================================================================
// Implementation Chain:
//
// 1. LoginPage.js: Collects all three from form inputs
//    - email: validated with regex pattern
//    - password: validated minimum 6 characters
//    - deviceName: required, non-empty string
//
// 2. App.js handleLogin(): Receives all three parameters
//    handleLogin(email, password, deviceName)
//
// 3. AuthService.login(): Passes to backend
//    login(email, password, deviceName)
//    └─ Converts to: { email, password, device_name: deviceName }
//
// 4. IPC Bridge (preload.js): Supports both formats
//    auth.login(email, password) // backward compatible
//    auth.login({ email, password, device_name })
//
// 5. Backend API: Expects
//    POST /auth/login
//    { "email": "...", "password": "...", "device_name": "..." }

// ============================================================================
// REQUIREMENT 3: CALL BACKEND LOGIN API
// ============================================================================
// File: src/api/ApiManager.js (login method at line 351)
//
// HTTP Request Details:
// Method: POST
// Endpoint: /auth/login
// Headers: 
//   - Content-Type: application/json
//   - Authorization: Bearer <token> (if refreshing)
//
// Request Body:
// {
//   "email": "user@example.com",
//   "password": "password123",
//   "device_name": "Terminal 1"
// }
//
// Implementation:
// const response = await this.client.post('/auth/login', { 
//   email, 
//   password,
//   device_name: device_name || 'electron-pos'
// });
//
// Call Chain:
// LoginPage → App.handleLogin() 
//   → AuthService.login()
//   → window.pos.auth.login() (IPC)
//   → IpcHandler.handleLogin()
//   → ApiManager.login()
//   → axios.post(/auth/login)
//   → Backend Server

// ============================================================================
// REQUIREMENT 4: STORE RETURNED TOKEN SECURELY
// ============================================================================
// File: src/security/TokenManager.js (310+ lines)
//
// Token Storage Process:
// 1. Backend returns: { user: {...}, token, refreshToken, expiresIn }
// 2. ApiManager.login() calls: this.setAuthToken(token, expiresIn)
// 3. TokenManager stores token in:
//    - Primary: OS Keychain (Windows Credential Manager)
//    - Fallback: electron-store with encryption
// 4. Token retrieved automatically via request interceptor
// 5. Token never exposed to renderer process
// 6. Token never logged to console
//
// Security Features:
// - Main process only access
// - OS keychain integration
// - Encrypted backup storage
// - Automatic expiration handling
// - 401 response triggers refresh
// - No hardcoded credentials
//
// Methods:
// await tokenManager.setAuthToken(token, expiresIn)
// const token = await tokenManager.getAuthToken()
// await tokenManager.clearAllTokens()
// const info = tokenManager.getTokenInfo()
// const isExpired = tokenManager.isTokenExpired()

// ============================================================================
// REQUIREMENT 5: REDIRECT TO POS SCREEN ON SUCCESS
// ============================================================================
// File: src/App.js (conditional rendering)
//
// Logic Flow:
// 1. User authenticates successfully
// 2. Backend returns user data and token
// 3. App state updated: isAuthenticated = true, currentUser = response.user
// 4. React conditional rendering triggers
// 5. Router switches from <LoginPage /> to dashboard routes
// 6. Navigation to /dashboard happens automatically
//
// Code:
// {isAuthenticated ? (
//   <>
//     <Navigation user={currentUser} onLogout={handleLogout} />
//     <main className="app-main">
//       <Router>
//         <Routes>
//           <Route path="/dashboard" element={<DashboardPage />} />
//           <Route path="/products" element={<ProductsPage />} />
//           <Route path="/orders" element={<OrdersPage />} />
//           <Route path="/reports" element={<ReportsPage />} />
//           <Route path="/settings" element={<SettingsPage />} />
//           <Route path="/" element={<Navigate to="/dashboard" replace />} />
//         </Routes>
//       </Router>
//     </main>
//   </>
// ) : (
//   <LoginPage onLogin={handleLogin} error={error} />
// )}
//
// Routes Available After Authentication:
// - /dashboard (DashboardPage)
// - /products (ProductsPage)
// - /orders (OrdersPage)
// - /reports (ReportsPage)
// - /settings (SettingsPage)
// - / redirects to /dashboard

// ============================================================================
// REQUIREMENT 6: SHOW BACKEND VALIDATION ERRORS
// ============================================================================
// File: src/services/AuthService.js (_extractErrorMessage method)
//
// Error Extraction Patterns (8+):
// 1. Backend message field
//    if (err.response?.data?.message) return message
//
// 2. Validation errors object
//    if (err.response?.data?.errors[field]) extract messages
//
// 3. Validation errors array
//    if (Array.isArray(err.response?.data?.errors)) return first error
//
// 4. Error field
//    if (err.response?.data?.error) return error
//
// 5. Invalid credentials
//    if (message.includes('invalid credentials')) 
//      return 'Invalid email or password'
//
// 6. User not found
//    if (message.includes('not found'))
//      return 'User account not found'
//
// 7. Unauthorized
//    if (message.includes('unauthorized'))
//      return 'Unauthorized: Please check your credentials'
//
// 8. Network errors
//    if (message.includes('network') || 'econnrefused')
//      return 'Network error: Cannot connect to server'
//
// 9. Timeout
//    if (message.includes('timeout'))
//      return 'Request timeout: Server is not responding'
//
// Error Display:
// - Displayed in LoginPage red error banner
// - Form validation errors shown below each field
// - Field errors clear when user modifies field
// - General error cleared when form submitted again
//
// Example Backend Responses Handled:
// 
// Response 1 (with message):
// { "message": "Invalid email or password" }
// Result: "Invalid email or password"
//
// Response 2 (validation errors):
// { "errors": { "email": "Email is invalid", "password": "Too short" } }
// Result: "Email is invalid; Too short"
//
// Response 3 (error array):
// { "errors": ["Email is invalid", "Password too short"] }
// Result: "Email is invalid"
//
// Response 4 (field array):
// { "errors": { "email": ["Email is invalid"] } }
// Result: "Email is invalid"

// ============================================================================
// COMPLETE AUTHENTICATION FLOW DIAGRAM
// ============================================================================
//
//  ┌─────────────┐
//  │  LoginPage  │ (src/pages/LoginPage.js)
//  │   - Form    │
//  │  - Email    │
//  │ - Password  │
//  │ - DevName   │
//  └──────┬──────┘
//         │ onLogin(email, password, deviceName)
//         ▼
//  ┌─────────────────────────────┐
//  │       App.js                │
//  │  handleLogin()              │
//  │  - Calls authService.login()│
//  │  - Updates state on success │
//  │  - Catches and shows errors │
//  └──────┬──────────────────────┘
//         │ authService.login(email, password, deviceName)
//         ▼
//  ┌──────────────────────────────┐
//  │    AuthService.js            │
//  │  - Validates credentials     │
//  │  - Calls IPC window.pos.auth │
//  │  - Extracts error messages   │
//  └──────┬───────────────────────┘
//         │ window.pos.auth.login({...})
//         ▼
//  ┌──────────────────────────────┐
//  │     preload.js               │
//  │  - IPC bridge                │
//  │  - Backward compatible       │
//  │  - Invokes ipcRenderer       │
//  └──────┬───────────────────────┘
//         │ ipcRenderer.invoke('auth:login', {...})
//         ▼
//  ┌──────────────────────────────┐
//  │    IpcHandler.js             │
//  │  handleLogin()               │
//  │  - Receives credentials      │
//  │  - Calls apiManager.login()  │
//  └──────┬───────────────────────┘
//         │ apiManager.login(email, password, device_name)
//         ▼
//  ┌──────────────────────────────┐
//  │    ApiManager.js             │
//  │  login()                     │
//  │  - Makes HTTP request        │
//  │  - Stores token via          │
//  │    TokenManager              │
//  │  - Returns user data         │
//  └──────┬───────────────────────┘
//         │ axios.post(/auth/login, {...})
//         ▼
//  ┌──────────────────────────────┐
//  │   Backend API Server         │
//  │   POST /auth/login           │
//  │   Returns: user, token,      │
//  │   refreshToken, expiresIn    │
//  └──────┬───────────────────────┘
//         │ Response: { user, token, refreshToken, expiresIn }
//         ▼
//  ┌──────────────────────────────┐
//  │    TokenManager.js           │
//  │  - Stores in OS keychain     │
//  │  - Backup in electron-store  │
//  │  - Sets expiration           │
//  │  - Main process only         │
//  └──────┬───────────────────────┘
//         │ Return to App.js
//         ▼
//  ┌──────────────────────────────┐
//  │  App state updated           │
//  │  isAuthenticated = true      │
//  │  currentUser = response.user │
//  └──────┬───────────────────────┘
//         │ React conditional render
//         ▼
//  ┌──────────────────────────────┐
//  │   Router shows /dashboard    │
//  │   - DashboardPage            │
//  │   - Navigation component     │
//  │   - Authenticated state      │
//  └──────────────────────────────┘

// ============================================================================
// TESTING CHECKLIST
// ============================================================================
//
// Unit Testing (Per Component):
// □ LoginPage: Validate form submission with all fields
// □ LoginPage: Test field-specific error display
// □ LoginPage: Test error clear on field change
// □ AuthService: Test error extraction from 8 patterns
// □ AuthService: Test session restoration from token
// □ App.js: Test auth state management
// □ ApiManager: Test POST /auth/login request
// □ IpcHandler: Test message routing
// □ TokenManager: Test secure storage
//
// Integration Testing:
// □ Complete login flow end-to-end
// □ Token storage and retrieval
// □ Session restoration on app restart
// □ Error display for each pattern
// □ Navigation to dashboard on success
// □ Logout functionality
// □ Token refresh on 401
//
// Manual Testing:
// □ Start app - should show login page
// □ Leave email empty - should show validation error
// □ Enter invalid email - should show validation error
// □ Leave password empty - should show validation error
// □ Enter password < 6 chars - should show validation error
// □ Leave device name empty - should show validation error
// □ Enter valid credentials - should show "Signing in..."
// □ On success - should redirect to /dashboard
// □ On error - should display backend error message
// □ Modify email - field error should clear
// □ Logout - should return to login page
// □ Close and reopen app - if token valid, restore dashboard
//
// Error Scenario Testing:
// □ Invalid credentials: Should show "Invalid email or password"
// □ User not found: Should show "User account not found"
// □ Network error: Should show "Cannot connect to server"
// □ Timeout: Should show "Server is not responding"
// □ Server validation: Should show backend messages
// □ Field validation: Should show field-specific errors
// □ Unauthorized: Should show "Please check credentials"
// □ Generic error: Should show user-friendly message

// ============================================================================
// DEBUGGING TIPS
// ============================================================================
//
// 1. Check electron-log for detailed logs:
//    Location: %APPDATA%/pos-electron/logs/main.log
//    Note: Tokens are sanitized, no actual tokens in logs
//
// 2. Check console for component errors:
//    DevTools → Console tab
//
// 3. Monitor Network tab for API requests:
//    DevTools → Network tab
//    Should see POST /auth/login requests
//
// 4. Verify token storage:
//    Windows: Credential Manager (Control Panel)
//    Look for "pos-electron" credentials
//
// 5. Check preload.js IPC methods:
//    Confirm window.pos.auth exists and has all methods
//    DevTools → Console: console.log(window.pos)
//
// 6. Monitor IPC messages:
//    Check ipcMain.handle registrations in IpcHandler
//
// 7. Backend API debugging:
//    Ensure /auth/login endpoint is implemented
//    Check that request body matches expectations
//    Return response in correct format
//
// 8. Token issues:
//    If token not storing: Check TokenManager logs
//    If token not retrieving: Check keychain access
//    If 401 errors persist: Check token expiration logic

// ============================================================================
// EXPECTED BACKEND RESPONSE FORMAT
// ============================================================================
//
// Success (200 OK):
// {
//   "user": {
//     "id": "123",
//     "email": "user@example.com",
//     "name": "John Doe",
//     "roles": ["pos-operator"]
//     // Any additional user data
//   },
//   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
//   "refreshToken": "refresh_token_value_here",
//   "expiresIn": 3600
// }
//
// Error Response (400/401/422):
// Option A:
// { "message": "Invalid email or password" }
//
// Option B:
// {
//   "errors": {
//     "email": "Email is invalid",
//     "password": "Password is too short"
//   }
// }
//
// Option C:
// {
//   "errors": [
//     "Email is invalid",
//     "Password is too short"
//   ]
// }

// ============================================================================
// FILES INVOLVED (6 Total)
// ============================================================================
//
// 1. src/pages/LoginPage.js (145 lines)
//    └─ Login form UI with three fields and validation
//
// 2. src/services/AuthService.js (231 lines)
//    └─ Authentication service with error extraction
//
// 3. src/App.js (138 lines)
//    └─ Main app component with auth state and routing
//
// 4. src/api/ApiManager.js (540 lines, 1 modified method)
//    └─ HTTP client with login() method
//
// 5. src/ipc/IpcHandler.js (605 lines, 1 modified method)
//    └─ IPC handlers including handleLogin()
//
// 6. src/preload.js (166 lines, 1 modified method + 3 new)
//    └─ IPC bridge with auth.login() and helper methods

// ============================================================================
