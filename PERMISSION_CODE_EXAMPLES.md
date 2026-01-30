# Permission-Based Routing - Code Examples

## Quick Start Examples

### Example 1: Route-Level Permission Protection

#### Protected Route by Permission
```javascript
// In App.js - Protect route with required permission
<Route 
  path="/reports" 
  element={
    <ProtectedRoute
      user={currentUser}
      requiredPermissions={['view_reports']}
      fallbackPath="/pos"
      element={<ReportsPage />}
    />
  }
/>

// User without view_reports permission → Redirected to /pos
// User with view_reports permission → Access granted
```

#### Multiple Permissions (Any)
```javascript
// User needs ANY of these permissions
<ProtectedRoute
  user={currentUser}
  requiredPermissions={['view_reports', 'manage_settings']}
  matchMode="any"
  fallbackPath="/pos"
  element={<DashboardPage />}
/>

// User with view_reports OR manage_settings → Access granted
// User with neither → Redirected to /pos
```

#### Multiple Permissions (All)
```javascript
// User needs ALL of these permissions
<ProtectedRoute
  user={currentUser}
  requiredPermissions={['view_orders', 'create_order', 'complete_order']}
  matchMode="all"
  fallbackPath="/login"
  element={<OrderManagementPage />}
/>

// User must have all three permissions → Access granted
```

### Example 2: Component-Level Permission Checks

#### Using AuthService
```javascript
import authService from '../services/AuthService';

function OrdersPage() {
  return (
    <div>
      <h1>Orders</h1>
      
      {/* Show create button only if user has permission */}
      {authService.canCreateOrder() && (
        <button onClick={createNewOrder}>Create Order</button>
      )}
      
      {/* Show edit/delete buttons based on permissions */}
      {authService.hasPermission('edit_order') && (
        <button onClick={editOrder}>Edit</button>
      )}
      
      {authService.hasPermission('delete_order') && (
        <button onClick={deleteOrder}>Delete</button>
      )}
    </div>
  );
}
```

#### Using Context
```javascript
import { useContext } from 'react';
import AuthContext from '../context/AuthContext';
import RoleManager from '../utils/RoleManager';

function ProductsPage() {
  const { currentUser } = useContext(AuthContext);
  
  const canEdit = RoleManager.hasPermission(currentUser, 'edit_product');
  const canDelete = RoleManager.hasPermission(currentUser, 'delete_product');
  const canManageStock = RoleManager.hasPermission(currentUser, 'manage_stock');
  
  return (
    <div>
      {canEdit && <button>Edit Product</button>}
      {canDelete && <button>Delete Product</button>}
      {canManageStock && <button>Update Stock</button>}
    </div>
  );
}
```

### Example 3: Navigation Menu with Permissions

```javascript
// In Navigation.js
import { useContext } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import RoleManager from '../utils/RoleManager';

export default function Navigation() {
  const { currentUser, isAuthenticated } = useContext(AuthContext);
  
  const hasPermission = (perm) => RoleManager.hasPermission(currentUser, perm);
  
  if (!isAuthenticated) return null;
  
  return (
    <nav>
      <ul>
        {/* Dashboard - Show if user can view reports OR manage settings */}
        {(hasPermission('view_reports') || hasPermission('manage_settings')) && (
          <li><Link to="/dashboard">Dashboard</Link></li>
        )}
        
        {/* Products - Show only to users who can view products */}
        {hasPermission('view_products') && (
          <li><Link to="/products">Products</Link></li>
        )}
        
        {/* Orders - Show to users who can view orders */}
        {hasPermission('view_orders') && (
          <li><Link to="/orders">Orders</Link></li>
        )}
        
        {/* Reports - Show only to users who can view reports */}
        {hasPermission('view_reports') && (
          <li><Link to="/reports">Reports</Link></li>
        )}
        
        {/* Settings - Show only to admins/managers */}
        {hasPermission('manage_settings') && (
          <li><Link to="/settings">Settings</Link></li>
        )}
      </ul>
    </nav>
  );
}
```

### Example 4: Feature Flags Based on Permissions

```javascript
// OrdersPage.js - Show features based on user permissions
import authService from '../services/AuthService';

function OrdersPage() {
  return (
    <div className="orders-container">
      <h1>Orders</h1>
      
      {/* Order creation section - Only for users who can create orders */}
      {authService.canCreateOrder() && (
        <section className="create-order">
          <h2>Create New Order</h2>
          <OrderForm />
        </section>
      )}
      
      {/* Orders list */}
      <section className="orders-list">
        <OrdersList 
          canEdit={authService.canEditOrder()}
          canDelete={authService.canDeleteOrder()}
          canComplete={authService.canCompleteOrder()}
        />
      </section>
      
      {/* Payment section - Only if user can record payments */}
      {authService.hasAnyPermission(['record_payment', 'refund_payment']) && (
        <section className="payment-section">
          <h2>Payments</h2>
          {authService.canRecordPayment() && <PaymentForm />}
          {authService.canRefundPayment() && <RefundForm />}
        </section>
      )}
    </div>
  );
}
```

## Advanced Examples

### Example 5: Conditional Button Actions

```javascript
// ProductCard.js - Show buttons based on permissions
import RoleManager from '../utils/RoleManager';
import { useContext } from 'react';
import AuthContext from '../context/AuthContext';

function ProductCard({ product }) {
  const { currentUser } = useContext(AuthContext);
  
  // Check specific permissions
  const canEdit = RoleManager.canEditProduct(currentUser);
  const canDelete = RoleManager.canDeleteProduct(currentUser);
  const canManageStock = RoleManager.canManageStock(currentUser);
  
  return (
    <div className="product-card">
      <h3>{product.name}</h3>
      <p>Price: ${product.price}</p>
      <p>Stock: {product.stock_quantity}</p>
      
      <div className="actions">
        {canEdit && (
          <button className="edit-btn" onClick={() => editProduct(product.id)}>
            Edit
          </button>
        )}
        
        {canManageStock && (
          <button className="stock-btn" onClick={() => updateStock(product.id)}>
            Update Stock
          </button>
        )}
        
        {canDelete && (
          <button className="delete-btn" onClick={() => deleteProduct(product.id)}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
```

### Example 6: Role-Based Fallback (Backward Compatible)

```javascript
// Still works with role checks if needed
import RoleManager from '../utils/RoleManager';

function AdminPanel() {
  const user = getCurrentUser();
  
  // New way - Permission-based
  if (RoleManager.hasPermission(user, 'manage_settings')) {
    return <SettingsPanel />;
  }
  
  // Old way - Still works for backward compatibility
  if (RoleManager.isAdmin(user)) {
    return <SettingsPanel />;
  }
  
  return <AccessDenied />;
}
```

### Example 7: Complex Permission Logic

```javascript
// OrderManagementService.js - Complex permission requirements
import RoleManager from '../utils/RoleManager';

class OrderManagementService {
  // Can user perform order workflow?
  canManageOrder(user, order) {
    const isCreator = order.created_by === user.id;
    
    // Can complete order if has permission
    if (RoleManager.canCompleteOrder(user)) {
      return true;
    }
    
    // Can edit own orders if cashier
    if (isCreator && RoleManager.hasPermission(user, 'edit_order')) {
      return true;
    }
    
    return false;
  }
  
  // Can user process payment?
  canProcessPayment(user, paymentType) {
    if (paymentType === 'refund') {
      return RoleManager.canRefundPayment(user);
    }
    
    return RoleManager.canRecordPayment(user);
  }
  
  // What actions can user perform on this order?
  getAvailableActions(user, order) {
    const actions = [];
    
    if (RoleManager.canEditOrder(user)) {
      actions.push('edit');
    }
    
    if (RoleManager.canCompleteOrder(user)) {
      actions.push('complete');
    }
    
    if (RoleManager.canDeleteOrder(user)) {
      actions.push('delete');
    }
    
    if (RoleManager.hasPermission(user, 'record_payment')) {
      actions.push('recordPayment');
    }
    
    if (RoleManager.hasPermission(user, 'refund_payment')) {
      actions.push('refund');
    }
    
    return actions;
  }
}
```

### Example 8: Dynamic Route Guards

```javascript
// utils/routeGuards.js - Reusable permission checks
import RoleManager from '../utils/RoleManager';

export const routeGuards = {
  canAccessOrders: (user) => RoleManager.canViewOrders(user),
  
  canAccessProducts: (user) => RoleManager.canViewProducts(user),
  
  canAccessReports: (user) => RoleManager.canViewReports(user),
  
  canAccessSettings: (user) => RoleManager.canManageSettings(user),
  
  canAccessDashboard: (user) => 
    RoleManager.hasAnyPermission(user, ['view_reports', 'manage_settings']),
  
  canManageUsers: (user) => RoleManager.canViewUsers(user),
  
  canViewPayments: (user) => RoleManager.canViewPayments(user),
  
  isManager: (user) => RoleManager.isManager(user),
  
  isAdmin: (user) => RoleManager.isAdmin(user)
};

// Usage in App.js
import { routeGuards } from './utils/routeGuards';

<Route 
  path="/reports" 
  element={
    routeGuards.canAccessReports(currentUser) 
      ? <ReportsPage /> 
      : <AccessDenied />
  }
/>
```

### Example 9: Permission Context Hook

```javascript
// hooks/usePermissions.js
import { useContext } from 'react';
import AuthContext from '../context/AuthContext';
import RoleManager from '../utils/RoleManager';

export function usePermissions() {
  const { currentUser } = useContext(AuthContext);
  
  return {
    // Check methods
    has: (permission) => RoleManager.hasPermission(currentUser, permission),
    hasAny: (permissions) => RoleManager.hasAnyPermission(currentUser, permissions),
    hasAll: (permissions) => RoleManager.hasAllPermissions(currentUser, permissions),
    
    // Get methods
    getAll: () => RoleManager.getUserPermissions(currentUser),
    getUser: () => currentUser,
    
    // Specific permission checks (with shorter names)
    canView: (resource) => RoleManager.hasPermission(currentUser, `view_${resource}`),
    canCreate: (resource) => RoleManager.hasPermission(currentUser, `create_${resource}`),
    canEdit: (resource) => RoleManager.hasPermission(currentUser, `edit_${resource}`),
    canDelete: (resource) => RoleManager.hasPermission(currentUser, `delete_${resource}`),
  };
}

// Usage in component
function MyComponent() {
  const permissions = usePermissions();
  
  return (
    <div>
      {permissions.canCreate('order') && <CreateOrderButton />}
      {permissions.canDelete('product') && <DeleteProductButton />}
      {permissions.hasAny(['view_reports', 'view_logs']) && <ViewReportsSection />}
    </div>
  );
}
```

### Example 10: Integration with Backend API

```javascript
// utils/apiGuards.js - Check permissions before API calls
import RoleManager from '../utils/RoleManager';
import authService from '../services/AuthService';

class ApiGuards {
  static requirePermission(permission) {
    return (target, propertyKey, descriptor) => {
      const originalMethod = descriptor.value;
      
      descriptor.value = async function(...args) {
        if (!authService.hasPermission(permission)) {
          throw new Error(`Insufficient permissions: ${permission}`);
        }
        return originalMethod.apply(this, args);
      };
      
      return descriptor;
    };
  }
}

// Usage
class OrderService {
  @ApiGuards.requirePermission('create_order')
  async createOrder(data) {
    // Only called if user has create_order permission
    return await api.post('/orders', data);
  }
  
  @ApiGuards.requirePermission('delete_order')
  async deleteOrder(orderId) {
    // Only called if user has delete_order permission
    return await api.delete(`/orders/${orderId}`);
  }
}
```

## Debugging Examples

### Check Current User Permissions
```javascript
// In browser console
authService.currentUser
// { id: 1, email: "manager@co.com", roles: ["manager"], ... }

authService.getUserRoles()
// ["manager"]

authService.getUserPermissions()
// ["view_orders", "create_order", "edit_order", "complete_order", ...]

authService.hasPermission('view_reports')
// true

authService.hasPermission('manage_settings')
// true (managers have this)

authService.canCreateProduct()
// true
```

### Test Route Access
```javascript
// Check if route is accessible
RoleManager.hasRoutePermission(
  authService.currentUser,
  '/reports'
)
// true or false

RoleManager.getAvailableRoutes(authService.currentUser)
// ["/dashboard", "/orders", "/products", "/reports"]
```

### Verify Permission Mapping
```javascript
// Check what permissions a role has
RoleManager.ROLE_PERMISSIONS['manager']
// Array of 18 permissions

RoleManager.ROLE_PERMISSIONS['cashier']
// Array of 8 permissions

// Check all available permissions
Object.keys(RoleManager.PERMISSIONS)
// 23 permission constants
```

## Best Practices

1. **Use Permission Helpers When Possible**
   ```javascript
   // Good
   if (authService.canCreateOrder()) { ... }
   
   // Also OK
   if (authService.hasPermission('create_order')) { ... }
   ```

2. **Group Related Permissions**
   ```javascript
   // Good - Clear intent
   if (authService.hasAnyPermission(['record_payment', 'refund_payment'])) {
     return <PaymentSection />;
   }
   ```

3. **Use Context for Permission Checks in Components**
   ```javascript
   // Better - Uses context, more testable
   const { currentUser } = useContext(AuthContext);
   if (RoleManager.hasPermission(currentUser, 'view_reports')) { ... }
   ```

4. **Check Permissions Early in Routes**
   ```javascript
   // Good - Prevents loading unnecessary data
   if (!authService.canViewOrders()) {
     return <Navigate to="/login" />;
   }
   ```

5. **Use ProtectedRoute for All Sensitive Routes**
   ```javascript
   // Good - Centralized permission checking
   <Route 
     path="/admin"
     element={<ProtectedRoute requiredRoles={['admin']} element={...} />}
   />
   ```

## Troubleshooting

### Permissions Not Showing
```javascript
// Check if permissions are cached
console.log(authService.userPermissions);

// Verify user roles
console.log(authService.userRoles);

// Check role-permission mapping
console.log(RoleManager.ROLE_PERMISSIONS[userRole]);
```

### Route Access Denied
```javascript
// Check current user
console.log(authService.currentUser);

// Check required permissions for route
console.log(RoleManager.ROUTE_PERMISSIONS['/path']);

// Verify permission check
console.log(authService.hasPermission('required_perm'));
```

### Context Not Updating
```javascript
// Ensure AuthContext is properly provided
console.log(useContext(AuthContext));

// Check if component is inside Provider
// <AuthContext.Provider value={{...}}>
```
