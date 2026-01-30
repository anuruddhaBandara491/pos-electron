# Permission-Based Routing Implementation Guide

## Overview
The frontend has been updated to align with the Laravel backend's Spatie Permission package model. Instead of simple role-based access control, the system now uses **granular permission-based access control**.

## Backend Permission Model

### Roles (3 Total)
- **cashier**: Entry-level role with basic sales operations
- **manager**: Management role with extended permissions
- **admin**: Full system access (all permissions)

### Permissions by Category (23 Total)

#### Sales/Orders (5)
- `view_orders` - View orders
- `create_order` - Create new orders
- `edit_order` - Edit existing orders
- `delete_order` - Delete orders
- `complete_order` - Mark orders as complete

#### Payments (3)
- `record_payment` - Record payment for orders
- `refund_payment` - Process refunds
- `view_payments` - View payment history

#### Products/Stock (6)
- `view_products` - View product catalog
- `create_product` - Create new products
- `edit_product` - Edit product details
- `delete_product` - Delete products
- `manage_stock` - Update stock levels
- `view_stock` - View stock information

#### Users (5)
- `view_users` - View user list
- `create_user` - Create new users
- `edit_user` - Edit user details
- `delete_user` - Delete users
- `assign_role` - Assign roles to users

#### Reports (2)
- `view_reports` - View business reports
- `export_reports` - Export report data

#### Settings (2)
- `manage_settings` - Access system settings
- `view_logs` - View system logs

## Role-Permission Assignments

### Cashier (8 permissions)
```
view_orders
create_order
edit_order
complete_order
record_payment
view_payments
view_products
view_stock
```

### Manager (18 permissions)
Includes all cashier permissions plus:
```
delete_order
refund_payment
create_product
edit_product
manage_stock
view_users
create_user
edit_user
assign_role
view_reports
export_reports
```

### Admin (All 23 permissions)
Includes all manager permissions plus:
```
manage_settings
view_logs
```

## Frontend Implementation

### Updated Files

#### 1. **RoleManager.js** - Permission Configuration
Defines all permissions and role-permission mappings matching the backend:
```javascript
// All available permissions organized by category
static PERMISSIONS = {
  VIEW_ORDERS: 'view_orders',
  CREATE_ORDER: 'create_order',
  // ... all 23 permissions
}

// Role-permission mappings matching backend
static ROLE_PERMISSIONS = {
  'cashier': ['view_orders', 'create_order', ...],
  'manager': ['view_orders', ..., 'view_reports'],
  'admin': [/* all 23 permissions */]
}
```

**New Methods:**
- `hasPermission(user, permission)` - Check if user has specific permission
- `hasAnyPermission(user, permissions)` - Check if user has any of the permissions
- `hasAllPermissions(user, permissions)` - Check if user has all permissions
- `getUserPermissions(user)` - Get all user permissions
- Permission-specific helpers: `canViewOrders()`, `canCreateProduct()`, etc.

#### 2. **AuthService.js** - Permission Caching
Enhanced to cache and provide permission checking:
```javascript
constructor() {
  this.currentUser = null;
  this.userRoles = [];
  this.userPermissions = [];  // NEW
}

// NEW: Check permissions
hasPermission(permission) { ... }
hasAnyPermission(permissions) { ... }
hasAllPermissions(permissions) { ... }
getUserPermissions() { ... }

// NEW: Permission-specific helpers
canViewOrders() { ... }
canCreateProduct() { ... }
// ... all permission helpers
```

#### 3. **ProtectedRoute.js** - Permission-Based Route Protection
Updated to support both role and permission-based protection:
```javascript
<ProtectedRoute
  user={currentUser}
  requiredPermissions={['view_orders']}
  element={<OrdersPage />}
/>

// Or use roles (backward compatible):
<ProtectedRoute
  user={currentUser}
  requiredRoles={['manager', 'admin']}
  element={<SettingsPage />}
/>

// Or use both with matchMode:
<ProtectedRoute
  user={currentUser}
  requiredRoles={['manager']}
  requiredPermissions={['view_reports']}
  matchMode="any"  // Either condition
  element={<ReportsPage />}
/>
```

#### 4. **App.js** - Route Permissions
Routes now use permission-based checks:
```javascript
// Permission-based route protection
<Route path="/products" element={
  <ProtectedRoute
    user={currentUser}
    requiredPermissions={['view_products']}
    element={<ProductsPage />}
  />
} />

// State management includes permissions
const [userPermissions, setUserPermissions] = useState([]);
```

#### 5. **Navigation.js** - Permission-Based Menu
Menu items now show based on permissions:
```javascript
{hasPermission('view_reports') && (
  <li><Link to="/reports">Reports</Link></li>
)}

{hasPermission('manage_settings') && (
  <li><Link to="/settings">Settings</Link></li>
)}
```

#### 6. **AuthContext.js** - Extended Context
Context now includes permissions:
```javascript
const AuthContext = createContext({
  isAuthenticated: false,
  currentUser: null,
  userRoles: [],
  userPermissions: [],  // NEW
  handleLogin: async () => {},
  handleLogout: async () => {}
});
```

## Current Route Permission Mapping

| Route | Required Permission(s) | Applicable Roles |
|-------|----------------------|-----------------|
| `/pos` | `view_orders` | All (cashier, manager, admin) |
| `/orders` | `view_orders` | All (cashier, manager, admin) |
| `/products` | `view_products` | Manager, Admin |
| `/dashboard` | `view_reports` OR `manage_settings` | Manager, Admin |
| `/reports` | `view_reports` | Manager, Admin |
| `/settings` | `manage_settings` | Admin, Manager |

## Integration with Backend

### Expected Backend Response Format
The backend should return permissions in the login/user response:

```javascript
// Option 1: Include permissions in user object
{
  user: {
    id: 1,
    email: "manager@company.com",
    name: "Manager",
    roles: ["manager"],
    permissions: ["view_orders", "create_order", ...]  // Direct permissions
  },
  token: "..."
}

// Option 2: Derive from roles (frontend handles it)
// Frontend will automatically calculate permissions from roles
```

## Usage Examples

### In Components
```javascript
// Check single permission
if (authService.hasPermission('view_orders')) {
  // Show orders section
}

// Check multiple permissions
if (authService.hasAnyPermission(['create_order', 'edit_order'])) {
  // Show order management buttons
}

// Use permission helpers
if (authService.canCreateProduct()) {
  // Show product creation form
}

// In context
const { currentUser } = useContext(AuthContext);
if (RoleManager.hasPermission(currentUser, 'view_reports')) {
  // Show reports
}
```

### In Routes
```javascript
// Permission-based
<Route path="/inventory" element={
  <ProtectedRoute
    user={currentUser}
    requiredPermissions={['view_stock', 'manage_stock']}
    matchMode="any"
    element={<InventoryPage />}
  />
} />

// Role-based (backward compatible)
<Route path="/admin" element={
  <ProtectedRoute
    user={currentUser}
    requiredRoles={['admin']}
    element={<AdminPage />}
  />
} />
```

## Migration from Role-Based to Permission-Based

### Before (Role-Based)
```javascript
if (authService.isManager()) {
  // Show manager features
}

<ProtectedRoute 
  requiredRoles={['admin', 'manager']}
  element={<Page />}
/>
```

### After (Permission-Based)
```javascript
if (authService.canViewReports()) {
  // Show reports
}

<ProtectedRoute 
  requiredPermissions={['view_reports']}
  element={<Page />}
/>
```

## Features Removed
- `operator` role (backend only uses cashier, manager, admin)
- Simple role-based checks replaced with permission checks (but still available for backward compatibility)

## Backward Compatibility
The system maintains backward compatibility with role-based checks:
- `hasRole()` still works
- `isManager()`, `isAdmin()`, `isCashier()` still work
- `ProtectedRoute` still accepts `requiredRoles`

However, **new code should use permission-based checks** for better alignment with the backend model.

## Permissions Caching Strategy
Permissions are:
1. Calculated from user's roles on login
2. Cached in `authService.userPermissions` and `App.js` state
3. Restored from roles on app reload (no separate API call needed)
4. Cleared on logout

This matches the backend's approach where permissions are derived from role assignments.

## Testing Checklist
- [ ] Login with cashier account → Verify only 8 permissions
- [ ] Login with manager account → Verify 18 permissions
- [ ] Login with admin account → Verify all 23 permissions
- [ ] Check navigation menu shows correct items based on permissions
- [ ] Verify route protection works for permission-based routes
- [ ] Test role fallback still works
- [ ] Verify permissions persist on app reload
- [ ] Check permissions clear on logout

## Notes
- Permissions are derived from roles, no separate API call needed
- Frontend role hierarchy removed (roles no longer have numeric hierarchy)
- All permission checking uses permission names, not role hierarchy
- Permission-based access is more maintainable and aligns with backend architecture
