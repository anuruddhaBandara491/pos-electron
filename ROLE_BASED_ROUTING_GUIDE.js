/**
 * ROLE-BASED ROUTING IMPLEMENTATION
 * Complete guide and reference for role-based access control
 */

// ============================================================================
// OVERVIEW
// ============================================================================
// 
// The role-based routing system protects routes and automatically redirects
// users based on their role from the backend:
//
// 1. User logs in with email, password, device_name
// 2. Backend returns user object with roles: ["admin"] | ["manager"] | ["cashier"]
// 3. AuthService extracts and caches roles
// 4. App uses RoleManager to check permissions
// 5. ProtectedRoute component blocks unauthorized access
// 6. Navigation component shows only available menu items
// 7. On app reload, roles are restored from token via getCurrentUser()

// ============================================================================
// ROLE HIERARCHY & PERMISSIONS
// ============================================================================

// Roles: admin > manager > cashier/operator
// 
// ADMIN:
//   - Full access to all routes
//   - /dashboard, /products, /orders, /reports, /settings, /pos
//   - Default home: /dashboard
//
// MANAGER:
//   - Access to management routes
//   - /dashboard, /products, /orders, /reports, /settings, /pos
//   - Default home: /dashboard
//
// CASHIER:
//   - Access to POS only
//   - /orders, /pos
//   - Default home: /pos
//   - Automatically redirected from /dashboard, /products, /reports, /settings
//
// OPERATOR:
//   - Same as cashier
//   - /orders, /pos
//   - Default home: /pos

// ============================================================================
// BACKEND RESPONSE FORMAT (Expected)
// ============================================================================

// POST /auth/login Success:
// {
//   "user": {
//     "id": "123",
//     "email": "user@example.com",
//     "name": "John Doe",
//     "roles": ["manager"]  // or "role": "manager" (both formats supported)
//   },
//   "token": "...",
//   "refreshToken": "...",
//   "expiresIn": 3600
// }

// ============================================================================
// FILE STRUCTURE
// ============================================================================

// New/Modified Files:
// 
// src/utils/RoleManager.js (NEW - 200+ lines)
//   - Centralized role and permission management
//   - Methods: hasRoutePermission(), getDefaultRoute(), isManager(), isCashier()
//   - Role hierarchy and route permissions configuration
//
// src/components/ProtectedRoute.js (NEW)
//   - React component that wraps routes
//   - Checks user role and redirects if unauthorized
//   - Logs access denial attempts
//
// src/services/AuthService.js (MODIFIED)
//   - Added role caching: this.currentUser, this.userRoles
//   - New methods: getUserRoles(), hasRole(), isManager(), isCashier()
//   - getDefaultRoute() - returns /dashboard or /pos based on role
//   - getAvailableRoutes() - lists accessible routes
//   - _storeUserData() - normalizes roles to array format
//   - _clearUserData() - clears on logout
//
// src/App.js (MODIFIED)
//   - Added userRoles state
//   - All routes wrapped with <ProtectedRoute> component
//   - Home route redirects based on role
//   - getHomeRoute() function for dynamic redirect
//
// src/components/Navigation.js (MODIFIED)
//   - Conditional menu rendering based on roles
//   - Admin/Manager see: Dashboard, Products, Orders, Reports, Settings
//   - Cashier see: Orders only
//   - Shows user roles in profile section
//
// src/context/AuthContext.js (MODIFIED)
//   - Added userRoles to context value
//   - Available in all components via useContext(AuthContext)

// ============================================================================
// AUTHENTICATION FLOW WITH ROLES
// ============================================================================

// 1. LOGIN FLOW
// LoginPage → App.handleLogin(email, password, deviceName)
//   ↓
// authService.login(email, password, deviceName)
//   ↓
// IPC to backend: POST /auth/login
//   ↓
// Backend returns: { user: { email, name, roles: ["manager"] }, token, ... }
//   ↓
// authService._storeUserData(userData) - normalizes and caches roles
//   ↓
// App.handleLogin() updates state:
//   - setIsAuthenticated(true)
//   - setCurrentUser(userData)
//   - setUserRoles(authService.getUserRoles())
//   ↓
// Router redirects to getHomeRoute() (authService.getDefaultRoute())
//   - /dashboard if admin/manager
//   - /pos if cashier/operator

// 2. ROUTE PROTECTION
// User navigates to /products
//   ↓
// ProtectedRoute checks:
//   - Is user authenticated? ✓
//   - Does user have required role? ['admin', 'manager']
//   - User is 'manager' → ✓ Allow
//   ↓
// ProductsPage renders

// 3. UNAUTHORIZED ACCESS
// Cashier tries to navigate to /products
//   ↓
// ProtectedRoute checks:
//   - Is user authenticated? ✓
//   - Does user have required role? ['admin', 'manager']
//   - User is 'cashier' → ✗ Denied
//   ↓
// Log warning: "User prevented from accessing protected route"
//   ↓
// Navigate to fallbackPath: /pos (from authService.getDefaultRoute())

// 4. APP RELOAD / SESSION RESTORATION
// User closes and reopens app
//   ↓
// App.useEffect() calls authService.initialize()
//   ↓
// Checks if valid token exists in OS keychain
// If token exists: returns true
//   ↓
// authService.getCurrentUser()
//   ↓
// IPC to backend: GET /auth/me (with Bearer token)
//   ↓
// Backend returns: { id, email, name, roles: ["manager"] }
//   ↓
// authService._storeUserData() caches roles
//   ↓
// App state updated with user and roles
//   ↓
// Router shows appropriate page based on role
// No need to log in again!

// ============================================================================
// COMPONENT USAGE EXAMPLES
// ============================================================================

// Example 1: Using ProtectedRoute in App.js
// <Route 
//   path="/products" 
//   element={
//     <ProtectedRoute
//       user={currentUser}
//       requiredRoles={['admin', 'manager']}
//       fallbackPath={authService.getDefaultRoute() || '/pos'}
//       element={<ProductsPage />}
//     />
//   }
// />

// Example 2: Using AuthService role checks in a component
// import authService from './services/AuthService';
// 
// export default function MyComponent() {
//   const isManager = authService.isManager();
//   const userRoles = authService.getUserRoles();
//   
//   return (
//     <div>
//       {isManager && <ManagerPanel />}
//       <p>Your roles: {userRoles.join(', ')}</p>
//     </div>
//   );
// }

// Example 3: Using AuthContext in component
// import AuthContext from './context/AuthContext';
// 
// export default function MyComponent() {
//   const { currentUser, userRoles } = useContext(AuthContext);
//   
//   return (
//     <div>
//       <p>User: {currentUser.name}</p>
//       <p>Roles: {userRoles.join(', ')}</p>
//     </div>
//   );
// }

// Example 4: Custom role checks with RoleManager
// import RoleManager from './utils/RoleManager';
// 
// const user = { email: 'john@example.com', roles: ['manager'] };
// 
// RoleManager.hasRole(user, 'manager') // true
// RoleManager.isManager(user) // true
// RoleManager.isCashier(user) // false
// RoleManager.getDefaultRoute(user.roles) // "/dashboard"
// RoleManager.hasRoutePermission(user, '/products') // true
// RoleManager.hasRoutePermission(user, '/orders') // true

// ============================================================================
// PROTECTING CUSTOM ROUTES
// ============================================================================

// To add a new protected route:
//
// 1. Define the route permission in RoleManager.ROUTE_PERMISSIONS:
//    '/inventory': ['admin', 'manager']
//
// 2. Add to App.js Routes:
//    <Route 
//      path="/inventory" 
//      element={
//        <ProtectedRoute
//          user={currentUser}
//          requiredRoles={['admin', 'manager']}
//          fallbackPath={authService.getDefaultRoute() || '/pos'}
//          element={<InventoryPage />}
//        />
//      }
//    />
//
// 3. Optionally add to Navigation.js menu (if not admin/manager only):
//    {isManager && (
//      <li>
//        <Link to="/inventory">Inventory</Link>
//      </li>
//    )}

// ============================================================================
// ROLE-BASED FEATURE FLAGS
// ============================================================================

// Show admin-only features in a component:
//
// export default function AdminPanel() {
//   const { currentUser, userRoles } = useContext(AuthContext);
//   const isAdmin = userRoles.includes('admin');
//   
//   return (
//     <>
//       <h1>Admin Dashboard</h1>
//       
//       {isAdmin && (
//         <div>
//           <button>Delete User</button>
//           <button>System Settings</button>
//         </div>
//       )}
//       
//       {isAdmin || userRoles.includes('manager') && (
//         <div>
//           <button>Generate Reports</button>
//         </div>
//       )}
//     </>
//   );
// }

// ============================================================================
// ERROR HANDLING & LOGGING
// ============================================================================

// Access Denial Attempt:
// Log entry: "User john@example.com (roles: cashier) attempted to access 
//             /products (required: admin,manager)"
//
// Triggered by: ProtectedRoute component when user lacks required role
//
// Why log this? For security auditing - helps detect:
// - Malicious access attempts
// - UI bugs that expose protected links
// - User permission misconfiguration

// ============================================================================
// TESTING ROLE-BASED ROUTING
// ============================================================================

// Test Case 1: Admin Login
// 1. Login with admin user
// 2. Verify redirected to /dashboard
// 3. Verify all menu items visible
// 4. Try to access /products → allowed
// 5. Try to access /pos → allowed

// Test Case 2: Cashier Login
// 1. Login with cashier user
// 2. Verify redirected to /pos
// 3. Verify only "Orders" menu visible
// 4. Try to access /products → redirected to /pos
// 5. Try to access /dashboard → redirected to /pos
// 6. Try to access /reports → redirected to /pos

// Test Case 3: Session Restoration
// 1. Login with manager
// 2. Close app completely
// 3. Reopen app
// 4. Verify no login page shown
// 5. Verify redirected to /dashboard
// 6. Verify roles still available

// Test Case 4: Role Change
// 1. Login as manager
// 2. Backend changes role to cashier
// 3. Logout and login again
// 4. Verify redirected to /pos
// 5. Verify admin routes blocked

// Test Case 5: Invalid Token
// 1. Manually clear token storage
// 2. Restart app
// 3. Verify shown login page
// 4. Login again to restore

// ============================================================================
// BEST PRACTICES
// ============================================================================

// 1. Always normalize roles to lowercase for comparison
//    → RoleManager and AuthService handle this automatically
//
// 2. Support both 'role' (string) and 'roles' (array) from backend
//    → _storeUserData() converts automatically
//
// 3. Log access denials for security auditing
//    → ProtectedRoute does this automatically
//
// 4. Cache roles after login to avoid repeated lookups
//    → AuthService caches in this.userRoles
//
// 5. Clear cached roles on logout
//    → _clearUserData() does this
//
// 6. Restore roles on app reload from token
//    → getCurrentUser() retrieves from backend with token
//
// 7. Use fallbackPath for unauthorized redirects
//    → Defaults to user's default route based on role
//
// 8. Define all permissions in one place (RoleManager)
//    → Single source of truth for route permissions
//
// 9. Show role in Navigation for user awareness
//    → Helps user understand what they can do
//
// 10. Test all role scenarios before deployment
//     → Use test cases above

// ============================================================================
// TROUBLESHOOTING
// ============================================================================

// Issue: User can access protected routes they shouldn't
// Solution: Check:
//   1. Is ProtectedRoute wrapping all sensitive routes?
//   2. Is requiredRoles correct?
//   3. Check browser logs for role cache value
//   4. Verify backend returns correct roles in response

// Issue: Cashier redirected to /pos but page doesn't exist
// Solution: Rename OrdersPage route to /pos or add alias
//   <Route path="/pos" element={<OrdersPage />} />

// Issue: Role not showing in Navigation
// Solution: Check:
//   1. Is userRoles passed to useContext?
//   2. Is AuthContext.Provider value updated?
//   3. Check App.js setUserRoles() is called

// Issue: App reloads but doesn't restore role
// Solution: Check:
//   1. Is authService.initialize() called?
//   2. Does backend /auth/me endpoint exist?
//   3. Check token is stored in Credential Manager
//   4. Check logs for role restoration error

// Issue: Menu items still show for unauthorized users
// Solution: Check:
//   1. Is hasRole() comparison case-insensitive?
//   2. Is userRoles state updating?
//   3. Is Navigation using updated userRoles?
//   4. Try console.log(userRoles) to debug

// ============================================================================
