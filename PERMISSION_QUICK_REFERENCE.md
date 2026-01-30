# Permission-Based Routing - Quick Reference

## At a Glance

**What Changed:** Frontend updated to use permission-based access control matching Laravel backend's Spatie Permission package.

**Why:** More granular, maintainable access control aligned with backend architecture.

**Impact:** All routes and components now check permissions instead of just roles.

## 23 Permissions Reference

### Sales/Orders (5)
```
view_orders        View order list
create_order       Create new orders
edit_order         Edit existing orders
delete_order       Delete orders
complete_order     Mark orders complete
```

### Payments (3)
```
record_payment     Record order payments
refund_payment     Process refunds
view_payments      View payment history
```

### Products/Stock (6)
```
view_products      View product list
create_product     Create new products
edit_product       Edit product details
delete_product     Delete products
manage_stock       Update stock levels
view_stock         View stock information
```

### Users (5)
```
view_users         View user list
create_user        Create new users
edit_user          Edit user details
delete_user        Delete users
assign_role        Assign roles to users
```

### Reports (2)
```
view_reports       View business reports
export_reports     Export report data
```

### Settings (2)
```
manage_settings    Access system settings
view_logs          View system logs
```

## Role Permission Summary

| Permission | Cashier | Manager | Admin |
|-----------|---------|---------|-------|
| view_orders | ✓ | ✓ | ✓ |
| create_order | ✓ | ✓ | ✓ |
| edit_order | ✓ | ✓ | ✓ |
| delete_order | | ✓ | ✓ |
| complete_order | ✓ | ✓ | ✓ |
| record_payment | ✓ | ✓ | ✓ |
| refund_payment | | ✓ | ✓ |
| view_payments | ✓ | ✓ | ✓ |
| view_products | ✓ | ✓ | ✓ |
| create_product | | ✓ | ✓ |
| edit_product | | ✓ | ✓ |
| delete_product | | ✓ | ✓ |
| manage_stock | | ✓ | ✓ |
| view_stock | ✓ | ✓ | ✓ |
| view_users | | ✓ | ✓ |
| create_user | | ✓ | ✓ |
| edit_user | | ✓ | ✓ |
| delete_user | | ✓ | ✓ |
| assign_role | | ✓ | ✓ |
| view_reports | | ✓ | ✓ |
| export_reports | | ✓ | ✓ |
| manage_settings | | | ✓ |
| view_logs | | | ✓ |
| **Total** | 8 | 18 | 23 |

## Route Permission Mapping

| Route | Permission(s) | Roles |
|-------|--------------|-------|
| `/pos` | view_orders | Cashier, Manager, Admin |
| `/orders` | view_orders | Cashier, Manager, Admin |
| `/products` | view_products | Manager, Admin |
| `/dashboard` | view_reports OR manage_settings | Manager, Admin |
| `/reports` | view_reports | Manager, Admin |
| `/settings` | manage_settings | Admin, Manager |

## Common API Calls

### Check Single Permission
```javascript
authService.hasPermission('view_orders')
RoleManager.hasPermission(user, 'create_product')
```

### Check Multiple Permissions
```javascript
// Any of these
authService.hasAnyPermission(['view_reports', 'manage_settings'])

// All of these
authService.hasAllPermissions(['edit_order', 'complete_order'])
```

### Use Permission Helpers
```javascript
authService.canViewOrders()
authService.canCreateProduct()
authService.canManageStock()
authService.canViewReports()
// ... 23 helpers available
```

### Get All User Permissions
```javascript
authService.getUserPermissions()
// Returns: ['view_orders', 'create_order', 'edit_order', ...]
```

## Common Tasks

### Protect a Route by Permission
```javascript
<Route path="/reports" element={
  <ProtectedRoute
    user={currentUser}
    requiredPermissions={['view_reports']}
    element={<ReportsPage />}
  />
} />
```

### Show Button Based on Permission
```javascript
{authService.canCreateProduct() && (
  <button onClick={createProduct}>Create Product</button>
)}
```

### Show Menu Item Based on Permission
```javascript
{authService.hasPermission('view_reports') && (
  <Link to="/reports">Reports</Link>
)}
```

### Check Permission in Service/Component
```javascript
const canEdit = RoleManager.hasPermission(currentUser, 'edit_order');
const canDelete = RoleManager.hasPermission(currentUser, 'delete_order');
```

## Files Modified (6)

1. **src/utils/RoleManager.js** - Permission definitions and checks
2. **src/services/AuthService.js** - Permission caching and helpers
3. **src/components/ProtectedRoute.js** - Permission-based route protection
4. **src/App.js** - Route configuration with permissions
5. **src/components/Navigation.js** - Menu items based on permissions
6. **src/context/AuthContext.js** - Extended context with permissions

## Documentation Files (4)

1. **PERMISSION_BASED_ROUTING_GUIDE.md** - Comprehensive guide
2. **PERMISSION_IMPLEMENTATION_SUMMARY.md** - Change summary
3. **PERMISSION_CODE_EXAMPLES.md** - Usage examples
4. **PERMISSION_VERIFICATION_CHECKLIST.md** - Testing checklist

## Most Common Permission Checks

### For Cashiers (8 permissions)
```
✓ View and create orders
✓ Edit own orders
✓ Complete orders
✓ Record payments
✓ View products and stock
```

### For Managers (18 permissions)
```
✓ All cashier permissions
✓ Delete orders
✓ Refund payments
✓ Manage products and stock
✓ View and manage users
✓ View reports
```

### For Admins (All 23)
```
✓ All manager permissions
✓ Manage system settings
✓ View system logs
```

## Backward Compatibility

Old methods still work:
- `hasRole()` ✓
- `isManager()` ✓
- `isAdmin()` ✓
- `isCashier()` ✓
- `requiredRoles` in ProtectedRoute ✓

**But new code should use permissions!**

## Testing Quick Commands

### In Browser Console
```javascript
// What permissions does user have?
authService.getUserPermissions()

// Can user do something?
authService.canViewOrders()

// What routes are accessible?
RoleManager.getAvailableRoutes(authService.currentUser)

// What's the current user?
authService.currentUser
```

## Integration Checklist

Before going live:
- [ ] Backend returns roles in login response
- [ ] Test with cashier user
- [ ] Test with manager user
- [ ] Test with admin user
- [ ] Verify correct permissions assigned to each role
- [ ] Check navigation shows correct menu items
- [ ] Verify route access restricted correctly
- [ ] Test on page reload
- [ ] Test logout clears permissions

## Common Mistakes to Avoid

❌ Using role checks instead of permissions:
```javascript
// Don't do this anymore
if (authService.isManager()) { ... }

// Do this instead
if (authService.canViewReports()) { ... }
```

❌ Forgetting to check permission in component:
```javascript
// Don't show buttons without checking permission
// Always do this:
if (authService.hasPermission('create_product')) {
  return <CreateButton />;
}
```

❌ Hardcoding permission strings:
```javascript
// Don't do this
if (permission === 'view_orders') { ... }

// Use RoleManager constants instead
if (permission === RoleManager.PERMISSIONS.VIEW_ORDERS) { ... }
```

## Performance Note

All permission checks are O(1) operations:
- In-memory array/object lookups
- No database calls
- No API calls
- < 1ms per check

Caching permissions on login avoids recalculating from roles on every check.

## Troubleshooting

**"Permission denied" when it shouldn't be:**
1. Check backend returns correct roles
2. Verify role-permission mapping in RoleManager
3. Check permission name spelling exactly
4. Test in browser console: `authService.getUserPermissions()`

**Menu items not showing:**
1. Check permission name in Navigation.js
2. Verify `currentUser` has permission
3. Check context provider wraps app

**Route access still restricted:**
1. Verify ProtectedRoute has correct requiredPermissions
2. Check user has required permission
3. Test permission directly: `authService.hasPermission('...')`

## Version History

- **v1.0** - Initial permission-based implementation
  - 23 permissions
  - 3 roles (cashier, manager, admin)
  - 6 core routes
  - Full backend alignment

## Support Resources

1. **PERMISSION_BASED_ROUTING_GUIDE.md** - Full documentation
2. **PERMISSION_CODE_EXAMPLES.md** - 10+ working examples
3. **PERMISSION_VERIFICATION_CHECKLIST.md** - Testing guide
4. **Browser Console** - Check `authService.userPermissions` and `RoleManager`

## Key Points to Remember

1️⃣ **Permissions are derived from roles** - No separate API call needed
2️⃣ **All checks are cached** - Very fast, in-memory lookups
3️⃣ **Use permission helpers** - `canViewOrders()` easier than permission strings
4️⃣ **Multiple permissions** - Use `hasAny()` or `hasAll()` for complex logic
5️⃣ **Backward compatible** - Old role checks still work (migrate to permissions)
6️⃣ **Routes are protected** - All sensitive routes check permissions
7️⃣ **Menu is smart** - Items show/hide based on permissions
8️⃣ **Persists on reload** - Permissions maintained when page reloaded
9️⃣ **Clears on logout** - All data cleared, fresh login required
🔟 **Matches backend** - Frontend mirrors backend's permission model exactly

---

For detailed information, see the full documentation files.
For code examples, see PERMISSION_CODE_EXAMPLES.md.
For testing, follow PERMISSION_VERIFICATION_CHECKLIST.md.
