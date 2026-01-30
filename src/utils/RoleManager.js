const log = require('electron-log');

/**
 * Role Management Utility
 * Handles role-based access control and granular permissions
 * Aligned with Laravel Spatie Permission package backend model
 */
class RoleManager {
  /**
   * Available roles in the system
   */
  static ROLES = {
    ADMIN: 'admin',
    MANAGER: 'manager',
    CASHIER: 'cashier'
  };

  /**
   * All available permissions in the system
   * Organized by feature category matching backend structure
   */
  static PERMISSIONS = {
    // Sales/Orders (5)
    VIEW_ORDERS: 'view_orders',
    CREATE_ORDER: 'create_order',
    EDIT_ORDER: 'edit_order',
    DELETE_ORDER: 'delete_order',
    COMPLETE_ORDER: 'complete_order',

    // Payments (3)
    RECORD_PAYMENT: 'record_payment',
    REFUND_PAYMENT: 'refund_payment',
    VIEW_PAYMENTS: 'view_payments',

    // Products/Stock (6)
    VIEW_PRODUCTS: 'view_products',
    CREATE_PRODUCT: 'create_product',
    EDIT_PRODUCT: 'edit_product',
    DELETE_PRODUCT: 'delete_product',
    MANAGE_STOCK: 'manage_stock',
    VIEW_STOCK: 'view_stock',

    // Users (5)
    VIEW_USERS: 'view_users',
    CREATE_USER: 'create_user',
    EDIT_USER: 'edit_user',
    DELETE_USER: 'delete_user',
    ASSIGN_ROLE: 'assign_role',

    // Reports (2)
    VIEW_REPORTS: 'view_reports',
    EXPORT_REPORTS: 'export_reports',

    // Settings (2)
    MANAGE_SETTINGS: 'manage_settings',
    VIEW_LOGS: 'view_logs'
  };

  /**
   * Role-Permission mapping
   * Defines which permissions each role has
   * Matches Laravel backend Spatie Permission assignments
   */
  static ROLE_PERMISSIONS = {
    'cashier': [
      'view_orders',
      'create_order',
      'edit_order',
      'complete_order',
      'record_payment',
      'view_payments',
      'view_products',
      'view_stock'
    ],
    'manager': [
      // All cashier permissions
      'view_orders',
      'create_order',
      'edit_order',
      'complete_order',
      'record_payment',
      'view_payments',
      'view_products',
      'view_stock',
      // Plus management permissions
      'delete_order',
      'refund_payment',
      'create_product',
      'edit_product',
      'manage_stock',
      'view_users',
      'create_user',
      'edit_user',
      'assign_role',
      'view_reports',
      'export_reports'
    ],
    'admin': [
      // All permissions
      'view_orders',
      'create_order',
      'edit_order',
      'delete_order',
      'complete_order',
      'record_payment',
      'refund_payment',
      'view_payments',
      'view_products',
      'create_product',
      'edit_product',
      'delete_product',
      'manage_stock',
      'view_stock',
      'view_users',
      'create_user',
      'edit_user',
      'delete_user',
      'assign_role',
      'view_reports',
      'export_reports',
      'manage_settings',
      'view_logs'
    ]
  };

  /**
   * Role hierarchy - higher level has access to lower level routes
   */
  static ROLE_HIERARCHY = {
    'admin': 3,
    'manager': 2,
    'cashier': 1
  };

  /**
   * Route permissions - which permissions can access which routes
   */
  static ROUTE_PERMISSIONS = {
    '/pos': ['view_orders', 'create_order'],
    '/orders': ['view_orders'],
    '/products': ['view_products'],
    '/reports': ['view_reports'],
    '/dashboard': ['view_reports', 'manage_settings'],
    '/settings': ['manage_settings'],
    '/users': ['view_users']
  };

  /**
   * Check if user has a specific permission
   * Supports both direct permission array and role-based permission lookup
   * @param {Object} user - User object with roles or permissions
   * @param {string} permission - Permission to check
   * @returns {boolean} Whether user has permission
   */
  static hasPermission(user, permission) {
    if (!user) return false;

    // If user has permissions array directly, check it
    if (Array.isArray(user.permissions)) {
      return user.permissions.includes(permission);
    }

    // Otherwise, derive permissions from user's role(s)
    const userRoles = Array.isArray(user.roles) 
      ? user.roles.map(r => r.toLowerCase())
      : [user.role?.toLowerCase() || ''].filter(Boolean);

    // Collect all permissions for user's roles
    const userPermissions = new Set();
    userRoles.forEach(role => {
      const rolePerms = this.ROLE_PERMISSIONS[role] || [];
      rolePerms.forEach(perm => userPermissions.add(perm));
    });

    return userPermissions.has(permission);
  }

  /**
   * Check if user has any of the specified permissions
   * @param {Object} user - User object
   * @param {Array} permissions - Array of permissions to check
   * @returns {boolean} True if user has at least one permission
   */
  static hasAnyPermission(user, permissions) {
    if (!user || !Array.isArray(permissions)) return false;
    return permissions.some(perm => this.hasPermission(user, perm));
  }

  /**
   * Check if user has all of the specified permissions
   * @param {Object} user - User object
   * @param {Array} permissions - Array of permissions to check
   * @returns {boolean} True if user has all permissions
   */
  static hasAllPermissions(user, permissions) {
    if (!user || !Array.isArray(permissions)) return false;
    return permissions.every(perm => this.hasPermission(user, perm));
  }

  /**
   * Get user's default/home route based on role
   * @param {string|Array} userRoles - User's role(s)
   * @returns {string} Default route path
   */
  static getDefaultRoute(userRoles) {
    const roles = Array.isArray(userRoles) 
      ? userRoles.map(r => r.toLowerCase())
      : [userRoles?.toLowerCase() || ''].filter(Boolean);

    // Admin/Manager get dashboard
    if (roles.includes('admin') || roles.includes('manager')) {
      return '/dashboard';
    }

    // Cashier gets POS screen
    if (roles.includes('cashier')) {
      return '/pos';
    }

    // Default fallback
    return '/pos';
  }

  /**
   * Check if user has permission to access a route
   * Can check by required permissions or required roles
   * @param {Object} user - User object with roles/permissions
   * @param {string} route - Route path to check
   * @param {Object} options - Optional { requiredPermissions, requiredRoles }
   * @returns {boolean} Whether user can access route
   */
  static hasRoutePermission(user, route, options = {}) {
    if (!user) return false;

    const { requiredPermissions, requiredRoles } = options;

    // Check required permissions first if specified
    if (requiredPermissions && requiredPermissions.length > 0) {
      return this.hasAnyPermission(user, requiredPermissions);
    }

    // Check required roles if specified
    if (requiredRoles && requiredRoles.length > 0) {
      return this.hasRole(user, requiredRoles);
    }

    // Fall back to default route permissions if no specific requirements
    const routePermissions = this.ROUTE_PERMISSIONS[route];
    if (!routePermissions || routePermissions.length === 0) {
      return true; // No restrictions
    }

    // Check if user has any required permission for the route
    return this.hasAnyPermission(user, routePermissions);
  }

  /**
   * Check if user has a specific role
   * @param {Object} user - User object with roles
   * @param {string|Array} requiredRoles - Role(s) to check
   * @returns {boolean} Whether user has role
   */
  static hasRole(user, requiredRoles) {
    if (!user) return false;

    const userRoles = Array.isArray(user.roles) 
      ? user.roles.map(r => r.toLowerCase())
      : [user.role?.toLowerCase() || user.roles?.toLowerCase() || ''].filter(Boolean);

    const rolesArray = Array.isArray(requiredRoles) 
      ? requiredRoles.map(r => r.toLowerCase())
      : [requiredRoles?.toLowerCase()].filter(Boolean);

    return rolesArray.some(role => userRoles.includes(role));
  }

  /**
   * Check if user is manager or above
   * @param {Object} user - User object with roles
   * @returns {boolean} True if user is manager or admin
   */
  static isManager(user) {
    return this.hasRole(user, ['admin', 'manager']);
  }

  /**
   * Check if user is admin
   * @param {Object} user - User object with roles
   * @returns {boolean} True if user is admin
   */
  static isAdmin(user) {
    return this.hasRole(user, 'admin');
  }

  /**
   * Check if user is cashier
   * @param {Object} user - User object with roles
   * @returns {boolean} True if user is cashier
   */
  static isCashier(user) {
    return this.hasRole(user, 'cashier');
  }

  /**
   * Get routes available to user based on their permissions
   * @param {Object} user - User object with roles or permissions
   * @returns {Array} List of accessible routes
   */
  static getAvailableRoutes(user) {
    if (!user) return [];

    return Object.keys(this.ROUTE_PERMISSIONS)
      .filter(route => this.hasRoutePermission(user, route));
  }

  /**
   * Get all permissions for a user
   * @param {Object} user - User object with roles or permissions
   * @returns {Array} Array of permission strings
   */
  static getUserPermissions(user) {
    if (!user) return [];

    // If user has permissions array, return it
    if (Array.isArray(user.permissions)) {
      return user.permissions;
    }

    // Derive from roles
    const userRoles = Array.isArray(user.roles) 
      ? user.roles.map(r => r.toLowerCase())
      : [user.role?.toLowerCase() || ''].filter(Boolean);

    const permissions = new Set();
    userRoles.forEach(role => {
      const rolePerms = this.ROLE_PERMISSIONS[role] || [];
      rolePerms.forEach(perm => permissions.add(perm));
    });

    return Array.from(permissions);
  }

  // ============================================
  // Permission-specific helper methods
  // ============================================

  /**
   * Check order-related permissions
   */
  static canViewOrders(user) {
    return this.hasPermission(user, this.PERMISSIONS.VIEW_ORDERS);
  }

  static canCreateOrder(user) {
    return this.hasPermission(user, this.PERMISSIONS.CREATE_ORDER);
  }

  static canEditOrder(user) {
    return this.hasPermission(user, this.PERMISSIONS.EDIT_ORDER);
  }

  static canDeleteOrder(user) {
    return this.hasPermission(user, this.PERMISSIONS.DELETE_ORDER);
  }

  static canCompleteOrder(user) {
    return this.hasPermission(user, this.PERMISSIONS.COMPLETE_ORDER);
  }

  /**
   * Check payment-related permissions
   */
  static canRecordPayment(user) {
    return this.hasPermission(user, this.PERMISSIONS.RECORD_PAYMENT);
  }

  static canRefundPayment(user) {
    return this.hasPermission(user, this.PERMISSIONS.REFUND_PAYMENT);
  }

  static canViewPayments(user) {
    return this.hasPermission(user, this.PERMISSIONS.VIEW_PAYMENTS);
  }

  /**
   * Check product-related permissions
   */
  static canViewProducts(user) {
    return this.hasPermission(user, this.PERMISSIONS.VIEW_PRODUCTS);
  }

  static canCreateProduct(user) {
    return this.hasPermission(user, this.PERMISSIONS.CREATE_PRODUCT);
  }

  static canEditProduct(user) {
    return this.hasPermission(user, this.PERMISSIONS.EDIT_PRODUCT);
  }

  static canDeleteProduct(user) {
    return this.hasPermission(user, this.PERMISSIONS.DELETE_PRODUCT);
  }

  static canManageStock(user) {
    return this.hasPermission(user, this.PERMISSIONS.MANAGE_STOCK);
  }

  static canViewStock(user) {
    return this.hasPermission(user, this.PERMISSIONS.VIEW_STOCK);
  }

  /**
   * Check user management permissions
   */
  static canViewUsers(user) {
    return this.hasPermission(user, this.PERMISSIONS.VIEW_USERS);
  }

  static canCreateUser(user) {
    return this.hasPermission(user, this.PERMISSIONS.CREATE_USER);
  }

  static canEditUser(user) {
    return this.hasPermission(user, this.PERMISSIONS.EDIT_USER);
  }

  static canDeleteUser(user) {
    return this.hasPermission(user, this.PERMISSIONS.DELETE_USER);
  }

  static canAssignRole(user) {
    return this.hasPermission(user, this.PERMISSIONS.ASSIGN_ROLE);
  }

  /**
   * Check report-related permissions
   */
  static canViewReports(user) {
    return this.hasPermission(user, this.PERMISSIONS.VIEW_REPORTS);
  }

  static canExportReports(user) {
    return this.hasPermission(user, this.PERMISSIONS.EXPORT_REPORTS);
  }

  /**
   * Check settings permissions
   */
  static canManageSettings(user) {
    return this.hasPermission(user, this.PERMISSIONS.MANAGE_SETTINGS);
  }

  static canViewLogs(user) {
    return this.hasPermission(user, this.PERMISSIONS.VIEW_LOGS);
  }

  /**
   * Log access denial attempt
   * @param {Object} user - User object
   * @param {string} attemptedRoute - Route user tried to access
   */
  static logAccessDenial(user, attemptedRoute) {
    if (!user) return;

    const userRoles = Array.isArray(user.roles) 
      ? user.roles.join(',')
      : user.role || user.roles || 'unknown';

    const requiredRoles = this.ROUTE_PERMISSIONS[attemptedRoute]?.join(',') || 'none';

    log.warn(
      `Access Denied - User: ${user.email}, ` +
      `Roles: ${userRoles}, ` +
      `Attempted Route: ${attemptedRoute}, ` +
      `Required Roles: ${requiredRoles}`
    );
  }

  /**
   * Validate user object has required role structure
   * @param {Object} user - User object to validate
   * @returns {boolean} True if user has valid role structure
   */
  static isValidUser(user) {
    if (!user) return false;
    
    // Check if user has either 'roles' (array) or 'role' (string)
    const hasRoles = Array.isArray(user.roles) && user.roles.length > 0;
    const hasRole = typeof user.role === 'string' && user.role.length > 0;
    
    return user.email && (hasRoles || hasRole);
  }

  /**
   * Normalize user roles to consistent format
   * @param {Object} user - User object to normalize
   * @returns {Object} User object with normalized roles array
   */
  static normalizeRoles(user) {
    if (!user) return null;

    const normalized = { ...user };

    // Convert role (string) to roles (array) if needed
    if (user.role && !user.roles) {
      normalized.roles = [user.role];
    } else if (typeof user.roles === 'string') {
      normalized.roles = [user.roles];
    } else if (!Array.isArray(user.roles)) {
      normalized.roles = [];
    }

    // Ensure all roles are lowercase
    if (Array.isArray(normalized.roles)) {
      normalized.roles = normalized.roles.map(r => r.toLowerCase());
    }

    return normalized;
  }
}

export default RoleManager;
