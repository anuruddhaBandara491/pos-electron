/**
 * ROLE-BASED ROUTING - CODE EXAMPLES & SNIPPETS
 * Quick reference for common tasks
 */

// ============================================================================
// QUICK REFERENCE - COMMON TASKS
// ============================================================================

// ─────────────────────────────────────────────────────────────────────────
// 1. CHECK USER ROLE IN A COMPONENT
// ─────────────────────────────────────────────────────────────────────────

import { useContext } from 'react';
import AuthContext from '../context/AuthContext';

export default function MyComponent() {
  // Method 1: Using AuthContext
  const { currentUser, userRoles } = useContext(AuthContext);
  
  const isManager = userRoles.includes('manager');
  const isAdmin = userRoles.includes('admin');
  const isCashier = userRoles.includes('cashier');
  
  return (
    <div>
      {isManager && <ManagerPanel />}
      {isCashier && <CashierPanel />}
      <p>Your roles: {userRoles.join(', ')}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 2. USE AUTHSERVICE METHODS IN COMPONENT
// ─────────────────────────────────────────────────────────────────────────

import authService from '../services/AuthService';

export default function Dashboard() {
  // Method 2: Using AuthService singleton
  
  if (!authService.isManager()) {
    return <div>Access Denied - Manager Only</div>;
  }
  
  const userRoles = authService.getUserRoles();
  const homeRoute = authService.getDefaultRoute();
  const availableRoutes = authService.getAvailableRoutes();
  
  return (
    <div>
      <h1>Manager Dashboard</h1>
      <p>Your roles: {userRoles.join(', ')}</p>
      <p>Home route: {homeRoute}</p>
      <p>Available routes: {availableRoutes.join(', ')}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 3. CONDITIONAL RENDERING IN JSX
// ─────────────────────────────────────────────────────────────────────────

import { useContext } from 'react';
import AuthContext from '../context/AuthContext';

export default function AdminPanel() {
  const { userRoles } = useContext(AuthContext);
  const isAdmin = userRoles.includes('admin');
  const isManager = userRoles.includes('manager');
  
  return (
    <div>
      {/* Show only to admin */}
      {isAdmin && (
        <div className="admin-section">
          <h2>Admin Controls</h2>
          <button>Delete User</button>
          <button>Reset Password</button>
        </div>
      )}
      
      {/* Show to admin and manager */}
      {(isAdmin || isManager) && (
        <div className="manager-section">
          <h2>Management Tools</h2>
          <button>View Reports</button>
          <button>Export Data</button>
        </div>
      )}
      
      {/* Show to all authenticated users */}
      <div>
        <h2>User Profile</h2>
        <p>Your roles: {userRoles.join(', ')}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 4. PROTECT ROUTES IN APP.JS
// ─────────────────────────────────────────────────────────────────────────

import ProtectedRoute from './components/ProtectedRoute';
import DashboardPage from './pages/DashboardPage';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  
  return (
    <Routes>
      {/* Public route - no protection needed */}
      <Route path="/login" element={<LoginPage />} />
      
      {/* Protected route - specific roles only */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute
            user={currentUser}
            requiredRoles={['admin', 'manager']}
            fallbackPath="/pos"
            element={<DashboardPage />}
          />
        }
      />
      
      {/* Protected route - all authenticated users */}
      <Route 
        path="/orders" 
        element={
          <ProtectedRoute
            user={currentUser}
            requiredRoles={['admin', 'manager', 'cashier', 'operator']}
            element={<OrdersPage />}
          />
        }
      />
    </Routes>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 5. CONDITIONAL NAVIGATION MENU
// ─────────────────────────────────────────────────────────────────────────

import { useContext } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

export default function Navigation() {
  const { currentUser, userRoles } = useContext(AuthContext);
  
  const isManager = userRoles.includes('admin') || 
                    userRoles.includes('manager');
  
  return (
    <nav className="navbar">
      <ul className="nav-items">
        {/* Dashboard - managers only */}
        {isManager && (
          <li><Link to="/dashboard">Dashboard</Link></li>
        )}
        
        {/* Products - managers only */}
        {isManager && (
          <li><Link to="/products">Products</Link></li>
        )}
        
        {/* Orders - all users */}
        <li><Link to="/orders">Orders</Link></li>
        
        {/* Reports - managers only */}
        {isManager && (
          <li><Link to="/reports">Reports</Link></li>
        )}
      </ul>
      
      <div className="nav-user">
        <span>{currentUser?.name}</span>
        <span className="roles">{userRoles.join(', ')}</span>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 6. CHECK ROUTE PERMISSION
// ─────────────────────────────────────────────────────────────────────────

import RoleManager from '../utils/RoleManager';

// Check if user can access a specific route
const user = { email: 'john@example.com', roles: ['manager'] };
const canAccessProducts = RoleManager.hasRoutePermission(user, '/products');
const canAccessDashboard = RoleManager.hasRoutePermission(user, '/dashboard');

console.log(canAccessProducts);  // true
console.log(canAccessDashboard); // true

// Different user
const cashier = { email: 'jane@example.com', roles: ['cashier'] };
const canAccessProducts2 = RoleManager.hasRoutePermission(cashier, '/products');

console.log(canAccessProducts2); // false

// ─────────────────────────────────────────────────────────────────────────
// 7. GET USER DEFAULT HOME ROUTE
// ─────────────────────────────────────────────────────────────────────────

import authService from '../services/AuthService';

// After login, determine where to send user
const homeRoute = authService.getDefaultRoute();
// Manager/Admin: '/dashboard'
// Cashier/Operator: '/pos'

navigate(homeRoute);

// Or in App.js route
<Route 
  path="/" 
  element={<Navigate to={authService.getDefaultRoute() || '/pos'} replace />} 
/>

// ─────────────────────────────────────────────────────────────────────────
// 8. ADD NEW ROLE-RESTRICTED FEATURE
// ─────────────────────────────────────────────────────────────────────────

// Step 1: Add to RoleManager.ROUTE_PERMISSIONS
// In src/utils/RoleManager.js:
static ROUTE_PERMISSIONS = {
  // ... existing routes ...
  '/inventory': ['admin', 'manager'],  // NEW: inventory route
  '/audit-logs': ['admin']              // NEW: admin only
};

// Step 2: Add route in App.js
<Route 
  path="/inventory" 
  element={
    <ProtectedRoute
      user={currentUser}
      requiredRoles={['admin', 'manager']}
      fallbackPath={authService.getDefaultRoute() || '/pos'}
      element={<InventoryPage />}
    />
  }
/>

// Step 3: Add menu item in Navigation.js
{isManager && (
  <li><Link to="/inventory">Inventory</Link></li>
)}

// Step 4: Backend validates every API request
// Server must verify role before responding

// ─────────────────────────────────────────────────────────────────────────
// 9. LOG ROLE-BASED EVENTS
// ─────────────────────────────────────────────────────────────────────────

import log from 'electron-log';
import authService from '../services/AuthService';

// On login
const response = await authService.login(email, password, deviceName);
const roles = authService.getUserRoles();
log.info(`User ${email} logged in with roles: ${roles.join(', ')}`);

// On role check failure
const userRoles = authService.getUserRoles();
if (!userRoles.includes('manager')) {
  log.warn(`Access denied: ${user.email} attempted privileged action`);
}

// Custom role-based logging
class AuditLog {
  static logAction(action, details) {
    const user = authService.currentUser;
    const roles = authService.getUserRoles();
    
    log.info({
      timestamp: new Date().toISOString(),
      user: user.email,
      roles: roles.join(','),
      action: action,
      details: details
    });
  }
}

AuditLog.logAction('VIEW_REPORTS', { reportType: 'sales' });

// ─────────────────────────────────────────────────────────────────────────
// 10. HANDLE ROLE CHANGE WITHOUT LOGOUT
// ─────────────────────────────────────────────────────────────────────────

// If backend updates user roles while logged in:
// Need to refresh user data

async function refreshUserRoles() {
  try {
    const updatedUser = await authService.getCurrentUser();
    authService._storeUserData(updatedUser);
    
    // Update component state
    setCurrentUser(updatedUser);
    setUserRoles(authService.getUserRoles());
    
    // Check if new role allows current page
    const currentRoute = window.location.pathname;
    if (!RoleManager.hasRoutePermission(updatedUser, currentRoute)) {
      // Redirect to new default route
      navigate(authService.getDefaultRoute());
    }
  } catch (err) {
    log.error('Failed to refresh user roles:', err);
  }
}

// Call periodically or on user action
setInterval(refreshUserRoles, 5 * 60 * 1000); // Every 5 minutes

// ─────────────────────────────────────────────────────────────────────────
// 11. GET LIST OF AVAILABLE ROUTES FOR USER
// ─────────────────────────────────────────────────────────────────────────

import authService from '../services/AuthService';

// Get all routes user can access
const availableRoutes = authService.getAvailableRoutes();
console.log(availableRoutes);
// Manager: ['/dashboard', '/products', '/orders', '/reports', '/settings']
// Cashier: ['/orders', '/pos']

// Use to dynamically generate sidebar
function Sidebar() {
  const availableRoutes = authService.getAvailableRoutes();
  
  const routeLabels = {
    '/dashboard': 'Dashboard',
    '/products': 'Products',
    '/orders': 'Orders',
    '/reports': 'Reports',
    '/settings': 'Settings'
  };
  
  return (
    <aside className="sidebar">
      {availableRoutes.map(route => (
        <Link key={route} to={route}>
          {routeLabels[route]}
        </Link>
      ))}
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 12. ROLE-BASED ERROR MESSAGES
// ─────────────────────────────────────────────────────────────────────────

export default function ErrorBoundary({ error }) {
  const userRoles = authService.getUserRoles();
  const isManager = userRoles.includes('manager');
  
  return (
    <div className="error-page">
      {error.status === 403 && (
        <>
          <h1>Access Denied</h1>
          <p>Your account does not have permission to access this resource.</p>
          {isManager && (
            <details>
              <summary>Technical Details</summary>
              <pre>{error.message}</pre>
            </details>
          )}
        </>
      )}
      
      {error.status === 401 && (
        <>
          <h1>Session Expired</h1>
          <p>Please log in again.</p>
          <Link to="/login">Login</Link>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 13. NORMALIZE ROLES FROM DIFFERENT FORMATS
// ─────────────────────────────────────────────────────────────────────────

import RoleManager from '../utils/RoleManager';

// Backend returns different formats
const user1 = { email: 'john@example.com', roles: ['Manager', 'Admin'] };
const user2 = { email: 'jane@example.com', role: 'CASHIER' };
const user3 = { email: 'bob@example.com', roles: 'Operator' };

// Normalize all to consistent format
const normalized1 = RoleManager.normalizeRoles(user1);
// { email, roles: ['manager', 'admin'] }

const normalized2 = RoleManager.normalizeRoles(user2);
// { email, roles: ['cashier'] }

const normalized3 = RoleManager.normalizeRoles(user3);
// { email, roles: ['operator'] }

// ─────────────────────────────────────────────────────────────────────────
// 14. VALIDATE USER HAS REQUIRED ROLES
// ─────────────────────────────────────────────────────────────────────────

import RoleManager from '../utils/RoleManager';

function canPerformAction(user, action) {
  const actionPermissions = {
    'delete_user': ['admin'],
    'create_report': ['admin', 'manager'],
    'process_order': ['admin', 'manager', 'cashier', 'operator'],
    'view_inventory': ['admin', 'manager']
  };
  
  const requiredRoles = actionPermissions[action];
  if (!requiredRoles) return false;
  
  return RoleManager.hasRole(user, requiredRoles);
}

// Usage
if (canPerformAction(currentUser, 'delete_user')) {
  // Show delete button
} else {
  // Hide delete button
}

// ============================================================================
// COMMON PATTERNS
// ============================================================================

// Pattern 1: Role-based feature toggle
const Features = {
  REPORTS: authService.hasRole(['admin', 'manager']),
  INVENTORY: authService.hasRole(['admin', 'manager']),
  AUDIT: authService.hasRole('admin')
};

if (Features.REPORTS) {
  // Show reports button
}

// Pattern 2: Cascade role checks
if (authService.isAdmin()) {
  // Full admin access
} else if (authService.isManager()) {
  // Manager access
} else if (authService.isCashier()) {
  // Cashier access
} else {
  // No access
}

// Pattern 3: Role-based button states
<button 
  disabled={!authService.isManager()}
  title={authService.isManager() ? '' : 'Manager only'}
>
  Delete Product
</button>

// Pattern 4: Conditional component imports
const Dashboard = authService.isManager() 
  ? lazy(() => import('./pages/Dashboard'))
  : () => <div>Not authorized</div>;

// ============================================================================
