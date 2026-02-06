import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import '../styles/Navigation.css';
import RoleManager from '../utils/RoleManager';
// const RoleManager = require('../utils/RoleManager');

/**
 * Navigation Component
 * Permission-aware navigation that shows different menu items based on user permissions
 * 
 * Permissions determine feature visibility:
 * - view_reports, manage_settings: Dashboard, Settings
 * - view_products: Products management
 * - view_orders: Orders/POS (all roles have this)
 */
export default function Navigation({ user, onLogout }) {
  const { isAuthenticated, currentUser, userRoles, userPermissions } = useContext(AuthContext);

  // Create a user object with roles and permissions for RoleManager
  const userWithPermissions = {
    ...currentUser,
    roles: userRoles || currentUser?.roles || [],
    permissions: userPermissions || currentUser?.permissions || []
  };

  // Check if user has a specific permission
  const hasPermission = (permission) => {
    return RoleManager.hasPermission(userWithPermissions, permission);
  };

  // Check if user has any of the specified permissions
  const hasAnyPermission = (permissions) => {
    return RoleManager.hasAnyPermission(userWithPermissions, permissions);
  };

  return (
    <nav className="navigation">
      <div className="nav-brand">
        <h2>POS System</h2>
      </div>

      {isAuthenticated && (
        <>
          <ul className="nav-links">
            {/* Dashboard - Requires view_reports or manage_settings permission */}
            {hasAnyPermission(['view_reports', 'manage_settings']) && (
              <li>
                <Link to="/dashboard">Dashboard</Link>
              </li>
            )}

            {/* Products - Requires view_products permission */}
            {hasPermission('view_products') && (
              <li>
                <Link to="/products">Products</Link>
              </li>
            )}

            {/* Categories - Requires view_categories permission */}
            {hasPermission('view_categories') && (
              <li>
                <Link to="/categories">Categories</Link>
              </li>
            )}

            {/* Orders - All users with view_orders permission */}
            {hasPermission('view_orders') && (
              <li>
                <Link to="/orders">Orders</Link>
              </li>
            )}

            {/* Reports - Requires view_reports permission */}
            {hasPermission('view_reports') && (
              <li>
                <Link to="/reports">Reports</Link>
              </li>
            )}

            {/* Settings - Requires manage_settings permission */}
            {hasPermission('manage_settings') && (
              <li>
                <Link to="/settings">Settings</Link>
              </li>
            )}
          </ul>

          <div className="nav-user">
            <div className="user-details">
              <span className="user-name">{currentUser?.name || currentUser?.email}</span>
              <span className="user-roles">
                {userRoles?.length > 0 ? userRoles.join(', ') : 'User'}
              </span>
            </div>
            <button className="logout-button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </>
      )}
    </nav>
  );
}
