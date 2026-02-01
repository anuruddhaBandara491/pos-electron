import React from 'react';
import { Navigate } from 'react-router-dom';
import log from '../utils/logger';
import RoleManager from '../utils/RoleManager';

/**
 * Protected Route Guard Component
 * Protects routes based on user roles and/or permissions
 * 
 * Usage (by role):
 * <ProtectedRoute 
 *   user={currentUser} 
 *   requiredRoles={['manager', 'admin']}
 *   element={<SettingsPage />}
 * />
 * 
 * Usage (by permission):
 * <ProtectedRoute 
 *   user={currentUser} 
 *   requiredPermissions={['view_orders']}
 *   element={<OrdersPage />}
 * />
 * 
 * Usage (by role or permission):
 * <ProtectedRoute 
 *   user={currentUser} 
 *   requiredRoles={['manager']}
 *   requiredPermissions={['view_reports']}
 *   matchMode="any" // 'any' = either role or permission, 'all' = both required
 *   element={<ReportsPage />}
 * />
 */
const ProtectedRoute = ({ 
  user, 
  requiredRoles, 
  requiredPermissions,
  matchMode = 'any', // 'any' or 'all'
  fallbackPath = '/pos', 
  element 
}) => {
  // No user - redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const hasRequiredRoles = () => {
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    return RoleManager.hasRole(user, requiredRoles);
  };

  const hasRequiredPermissions = () => {
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }
    return RoleManager.hasAnyPermission(user, requiredPermissions);
  };

  // Determine access based on match mode
  let hasAccess = false;
  let denialReason = '';

  if (requiredRoles && requiredRoles.length > 0 && requiredPermissions && requiredPermissions.length > 0) {
    // Both roles and permissions specified
    if (matchMode === 'all') {
      hasAccess = hasRequiredRoles() && hasRequiredPermissions();
      denialReason = hasRequiredRoles() ? 'permission' : 'role';
    } else {
      hasAccess = hasRequiredRoles() || hasRequiredPermissions();
      if (!hasAccess) {
        denialReason = 'role or permission';
      }
    }
  } else if (requiredRoles && requiredRoles.length > 0) {
    // Only roles specified
    hasAccess = hasRequiredRoles();
    denialReason = 'role';
  } else if (requiredPermissions && requiredPermissions.length > 0) {
    // Only permissions specified
    hasAccess = hasRequiredPermissions();
    denialReason = 'permission';
  } else {
    // No restrictions
    hasAccess = true;
  }

  if (!hasAccess) {
    const userRoles = Array.isArray(user.roles) 
      ? user.roles.join(',')
      : user.role || 'unknown';
    
    const userPermissions = RoleManager.getUserPermissions(user);

    log.warn(
      `User ${user.email} (roles: ${userRoles}, permissions: ${userPermissions.length}) ` +
      `denied access due to insufficient ${denialReason}`
    );
    return <Navigate to={fallbackPath} replace />;
  }

  return element;
};

export default ProtectedRoute;
