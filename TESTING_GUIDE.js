// ============================================================================
// QUICK START: ELECTRON LOGIN FLOW TESTING GUIDE
// ============================================================================

// STEP 1: START THE APP
// ============================================================================
// Run: npm start
// Expected: LoginPage displays with email, password, device_name inputs

// STEP 2: TEST FORM VALIDATION
// ============================================================================
// Test Case 1: Empty Email
// Action: Click Sign In without entering email
// Expected: Error "Email is required" below email field

// Test Case 2: Invalid Email
// Action: Enter "notanemail" and click Sign In
// Expected: Error "Please enter a valid email address"

// Test Case 3: Empty Password
// Action: Enter valid email, leave password empty, click Sign In
// Expected: Error "Password is required"

// Test Case 4: Short Password
// Action: Enter email, password "12345", click Sign In
// Expected: Error "Password must be at least 6 characters"

// Test Case 5: Empty Device Name
// Action: Enter email and password, leave device name empty, click Sign In
// Expected: Error "Device name is required"

// STEP 3: TEST SUCCESSFUL LOGIN
// ============================================================================
// Requirements:
// - Backend running with POST /auth/login endpoint
// - Valid credentials in backend database

// Test Case 6: Successful Login
// Action:
// 1. Enter valid email (e.g., user@example.com)
// 2. Enter valid password (e.g., password123)
// 3. Enter device name (e.g., Terminal 1, Register A)
// 4. Click Sign In
//
// Expected:
// 1. Button shows "Signing in..." and is disabled
// 2. Inputs are disabled
// 3. Page redirects to /dashboard
// 4. Navigation menu appears
// 5. Shows logged-in user info

// STEP 4: TEST ERROR RESPONSES
// ============================================================================
// Configure backend to return various error formats

// Test Case 7: Invalid Credentials
// Backend Response:
// { "message": "Invalid email or password" }
//
// Action: Login with wrong password
// Expected: Error "Invalid email or password" shows in red banner

// Test Case 8: Validation Errors (Object)
// Backend Response:
// { "errors": { "email": "Email is not valid", "password": "Too short" } }
//
// Expected: Error displays combined messages

// Test Case 9: Validation Errors (Array)
// Backend Response:
// { "errors": ["Email is invalid", "Password is too short"] }
//
// Expected: Shows first error message

// Test Case 10: User Not Found
// Backend Response:
// { "message": "User not found" }
//
// Expected: Error "User account not found" displays

// STEP 5: TEST ERROR RECOVERY
// ============================================================================
// Test Case 11: Clear Field Error
// Action:
// 1. Click Sign In with invalid email
// 2. See "Please enter a valid email address"
// 3. Modify the email field
// 4. Error disappears
//
// Expected: Field error clears when user edits field

// Test Case 12: New Login After Error
// Action:
// 1. Failed login shows error
// 2. Enter different credentials
// 3. Click Sign In
// 4. Previous error is cleared
// 5. New login attempt proceeds
//
// Expected: Previous error cleared, new attempt shown

// STEP 6: TEST SESSION RESTORATION
// ============================================================================
// Test Case 13: Session Restore on App Restart
// Action:
// 1. Login successfully
// 2. Verify on /dashboard
// 3. Close app completely (Ctrl+Q)
// 4. Reopen app
//
// Expected:
// - App skips login page
// - Directly shows /dashboard
// - User info still displayed
// - Session restored from token

// STEP 7: TEST LOGOUT
// ============================================================================
// Test Case 14: Logout Functionality
// Action:
// 1. Logged in on /dashboard
// 2. Click logout button (in Navigation)
// 3. Click Sign In
// 4. See login page
//
// Expected:
// - Navigation hidden
// - LoginPage displays
// - Token cleared from storage
// - Can login again

// STEP 8: TEST TOKEN STORAGE
// ============================================================================
// Test Case 15: Token in Windows Credential Manager
// Action:
// 1. Login successfully
// 2. Open Windows Credential Manager
//    - Control Panel → Credential Manager
//    - Or: Type "credential" in Windows search
// 3. Look for "pos-electron" entries
//
// Expected:
// - Found credential with authToken
// - No plain text token visible
// - Encrypted storage

// STEP 9: NETWORK ERROR TESTING
// ============================================================================
// Test Case 16: Backend Not Responding
// Action:
// 1. Stop backend server
// 2. Try to login
// 3. Wait for request timeout
//
// Expected:
// Error shows: "Network error: Cannot connect to server. Please check your connection."
// Or: "Request timeout: Server is not responding. Please try again."

// STEP 10: MONITOR LOGS
// ============================================================================
// Check electron-log output for debugging:
//
// Location: %APPDATA%/pos-electron/logs/main.log
//
// Look for:
// - "Attempting login for [email]"
// - "Login successful for user: [email]"
// - "Login failed for [email]: [error]"
// - "User logged out successfully"
//
// Note: Tokens are sanitized - no actual tokens in logs

// ============================================================================
// DEVICE VALIDATION
// ============================================================================
// Device Name Feature:
// - Tracks which device/register/terminal user logged in from
// - Example: "Terminal 1", "Register A", "POS-Main"
// - Sent to backend as device_name
// - Useful for audit trail and session management
// - Required field in login

// ============================================================================
// TROUBLESHOOTING
// ============================================================================

// Issue: Form shows validation error forever
// Solution: Check LoginPage.js error clearing logic
// Location: handleFieldChange() function

// Issue: LoginPage shows but no error messages
// Solution: Check css file exists and imports correctly
// Location: src/styles/LoginPage.css

// Issue: Backend error not showing
// Solution: Check AuthService._extractErrorMessage()
// Location: src/services/AuthService.js line ~150
// Add: console.log('Backend response:', err.response?.data)

// Issue: Token not storing
// Solution: Check TokenManager and IPC handlers
// Location: src/security/TokenManager.js
// Command: Check Windows Credential Manager

// Issue: Session not restoring on restart
// Solution: Check AuthService.initialize()
// Location: src/services/AuthService.js line ~14
// Add: console.log('Token info:', tokenInfo)

// Issue: Logout not clearing session
// Solution: Check handleLogout() and logout chain
// Location: src/App.js and AuthService.js

// Issue: Device name not being sent
// Solution: Check preload.js auth.login()
// Location: src/preload.js
// Verify device_name is in credentials object

// ============================================================================
// TESTING COMMANDS
// ============================================================================

// Start app (development):
// npm start

// Build for release:
// npm run build

// Check logs:
// Open: %APPDATA%/pos-electron/logs/main.log

// Debug in DevTools:
// In app: Ctrl+Shift+I
// Or: Menu → View → Toggle Developer Tools

// ============================================================================
// CHECKLIST FOR PRODUCTION READINESS
// ============================================================================

// Frontend:
// [ ] Form validation working
// [ ] Error messages clear
// [ ] Loading states show
// [ ] Navigation appears after login
// [ ] All routes accessible

// Backend:
// [ ] /auth/login endpoint exists
// [ ] Accepts { email, password, device_name }
// [ ] Returns { user, token, refreshToken, expiresIn }
// [ ] Validation errors properly formatted
// [ ] Server errors handled gracefully

// Security:
// [ ] Token stored in Credential Manager
// [ ] No tokens in localStorage
// [ ] No tokens in logs
// [ ] Session restoration works
// [ ] Token refresh works

// Integration:
// [ ] Complete flow tested
// [ ] Error scenarios tested
// [ ] Session restoration tested
// [ ] Logout tested
// [ ] Multiple login/logout cycles tested

// Performance:
// [ ] Login response < 5 seconds
// [ ] No memory leaks on repeated logins
// [ ] Token refresh doesn't freeze UI
// [ ] App startup < 3 seconds

// ============================================================================
// NEXT STEPS AFTER TESTING
// ============================================================================

// 1. Fix any issues found during testing
// 2. Test with production backend
// 3. Verify all error messages are appropriate
// 4. Test on target user machines
// 5. Monitor logs in production
// 6. Set up automated error reporting
// 7. Document any backend API requirements
// 8. Create user documentation
// 9. Plan rollout strategy
// 10. Schedule user training

// ============================================================================
// SUPPORT & DEBUGGING
// ============================================================================

// For detailed debugging:
// 1. Check src/services/AuthService.js for error extraction
// 2. Monitor window.pos API availability in DevTools
// 3. Check IPC message flow in IpcHandler
// 4. Verify ApiManager request/response interceptors
// 5. Monitor TokenManager.getAuthToken() availability

// Common issues:
// - Form not validating: Check LoginPage.validateForm()
// - Backend errors not showing: Check AuthService._extractErrorMessage()
// - Token not storing: Check TokenManager.setAuthToken()
// - Session not restoring: Check AuthService.initialize()
// - API not called: Check window.pos exists in DevTools console

// ============================================================================
