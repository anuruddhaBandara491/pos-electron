import { createContext } from 'react';

/**
 * Authentication Context
 * Manages authentication state, user roles, permissions, and provides auth functions to app
 * 
 * Context Values:
 * - isAuthenticated: boolean - Whether user is logged in
 * - currentUser: Object - Current user data (email, name, roles, permissions)
 * - userRoles: Array - Array of user role strings (lowercase)
 * - userPermissions: Array - Array of user permission strings
 * - handleLogin: Function - Called to log in user
 * - handleLogout: Function - Called to log out user
 */
const AuthContext = createContext({
  isAuthenticated: false,
  currentUser: null,
  userRoles: [],
  userPermissions: [],
 backendHealthy: true,
 healthCheckService: null,
  handleLogin: async () => {},
  handleLogout: async () => {}
});

export default AuthContext;
