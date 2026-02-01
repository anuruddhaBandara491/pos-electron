import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Services
import authService from './services/AuthService';
import healthCheckService from './services/HealthCheckService';
import { useVersionCheck } from './hooks/useVersionCheck';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import OrdersPage from './pages/OrdersPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

// Components
import Navigation from './components/Navigation';
import ProtectedRoute from './components/ProtectedRoute';
import HealthCheckIndicator from './components/HealthCheckIndicator';
import OfflineModeBanner from './components/OfflineModeBanner';
import { VersionUpdateNotification, CriticalVersionBlock } from './components/VersionNotifier';
import AuthContext from './context/AuthContext';
import { OrderProvider } from './context/OrderContext'; // Add this import

const log = {
  info: (...args) => {
    if (window.pos?.logInfo) window.pos.logInfo(args.join(' '));
    else console.log(...args);
  },
  warn: (...args) => {
    if (window.pos?.logWarn) window.pos.logWarn(args.join(' '));
    else console.warn(...args);
  },
  error: (...args) => {
    if (window.pos?.logError) window.pos.logError(args.join(' '));
    else console.error(...args);
  },
  debug: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(...args);
    }
  },
};

/**
 * Main App Component
 * Handles authentication state, permission-based routing, and health checks
 * 
 * Features:
 * - Role and permission-based access control
 * - Backend health monitoring
 * - Offline mode detection and alerts
 * - Session restoration
 */
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRoles, setUserRoles] = useState([]);
  const [userPermissions, setUserPermissions] = useState([]);
  const [backendHealthy, setBackendHealthy] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Version checking state (uses IPC to main process)
  const versionStatus = useVersionCheck(null);

  // Initialize health check service and authentication on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        log.info('Initializing health check service...');
        const isHealthy = await healthCheckService.initialize();
        setBackendHealthy(isHealthy);

        // Don't show error immediately on initial load - wait for status to stabilize
        // The status change listener will handle showing errors if backend stays offline
        if (isHealthy) {
          setError(null);
          log.info('Backend is online and ready');
        } else {
          // Backend appears offline, but don't show error yet - let periodic checks confirm
          log.warn('Initial health check failed, waiting for periodic checks...');
        }

        // Subscribe to health status changes
        const unsubscribeHealth = healthCheckService.onStatusChange((healthy) => {
          setBackendHealthy(healthy);
           log.debug(`[App] Health status listener called: ${healthy ? 'ONLINE' : 'OFFLINE'}`);
          
          // Clear error when health recovers, set error only when unhealthy
          if (healthy) {
            setError(null);
            log.info('Backend health recovered: OFFLINE → ONLINE');
             log.debug('[App] Error state cleared to null');
          } else {
            setError('Backend is currently offline. Please check your connection.');
            log.warn('Backend health degraded: ONLINE → OFFLINE');
             log.debug('[App] Error state set to offline message');
          }
        });

        // Check authentication
        await authService.initialize();
        const user = await authService.getCurrentUser();
        if (user) {
          setIsAuthenticated(true);
          setCurrentUser(user);
          
          // Extract and cache user roles and permissions
          const roles = authService.getUserRoles();
          const permissions = authService.getUserPermissions();
          setUserRoles(roles);
          setUserPermissions(permissions);
          
          log.info(
            `App loaded with authenticated user: ${user.email}, roles: ${roles.join(', ')}, permissions: ${permissions.length}`
          );
        }

        // Cleanup on unmount
        return unsubscribeHealth;
      } catch (err) {
        log.warn('App initialization error:', err.message);
        setError('Failed to initialize app. Please try again later.');
        setIsAuthenticated(false);
        setCurrentUser(null);
        setUserRoles([]);
        setUserPermissions([]);
      } finally {
        setIsLoading(false);
      }
    };

    const cleanup = initializeApp();
    
    return () => {
      cleanup?.then?.(unsubscribe => unsubscribe?.());
      healthCheckService.stopPeriodicChecks();
    };
  }, []);

  /**
   * Handle user login
   * Calls backend API via AuthService, stores token, updates state
   * Automatically redirects based on user role
   */
  const handleLogin = async (email, password, deviceName) => {
    try {
      setIsLoading(true);
      setError(null);
      
      log.debug(`Login attempt: ${email} on device: ${deviceName}`);
      
      // Call auth service which handles backend API call and role extraction
      const response = await authService.login(email, password, deviceName);
      
      // Get user data (could be in response.user or response)
      const userData = response.user || response;
      
      // Update app state with user, roles, and permissions
      setIsAuthenticated(true);
      setCurrentUser(userData);
      
      // Extract and cache roles and permissions for route protection
      const roles = authService.getUserRoles();
      const permissions = authService.getUserPermissions();
      setUserRoles(roles);
      setUserPermissions(permissions);
      
      log.info(
        `Login successful: ${email}, roles: ${roles.join(', ')}, ` +
        `permissions: ${permissions.length}, ` +
        `home route: ${authService.getDefaultRoute()}`
      );
    } catch (err) {
      // Error message already extracted by AuthService
      const errorMessage = err.message || 'Login failed. Please try again.';
      setError(errorMessage);
      setIsAuthenticated(false);
      setCurrentUser(null);
      setUserRoles([]);
      setUserPermissions([]);
      
      log.error('Login failed:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle user logout
   * Clears tokens, user data, roles, and permissions
   */
  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await authService.logout();
      setIsAuthenticated(false);
      setCurrentUser(null);
      setUserRoles([]);
      setUserPermissions([]);
      setError(null);
      log.info('User logged out successfully');
    } catch (err) {
      setError(err.message || 'Logout failed');
      log.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Determine home route based on user role
  const getHomeRoute = () => {
    if (!isAuthenticated || !currentUser) {
      return '/login';
    }
    return authService.getDefaultRoute() || '/pos';
  };

  if (isLoading) {
    return <div className="app-loading">Loading...</div>;
  }

  return (
    <AuthContext.Provider 
      value={{ 
        isAuthenticated, 
        currentUser, 
        userRoles,
        userPermissions,
        backendHealthy,
        healthCheckService,
        handleLogin, 
        handleLogout
      }}
    >
      <div className="app-container">
        {/* Critical Version Block - prevents app usage if incompatible */}
        {versionStatus.shouldBlock && (
          <CriticalVersionBlock />
        )}
        
        {/* Version Update Notification Banner */}
        {!versionStatus.shouldBlock && versionStatus.hasUpdate && (
          <VersionUpdateNotification />
        )}
        
        {/* Offline Mode Alert */}
        <OfflineModeBanner healthCheckService={healthCheckService} />
        
        {isAuthenticated ? (
          <Router>
            {/* Header with Navigation and Health Indicator */}
            <header className="app-header">
              <Navigation user={currentUser} onLogout={handleLogout} />
              <HealthCheckIndicator healthCheckService={healthCheckService} />
            </header>
            
            <main className="app-main">
              <OrderProvider> {/* Add OrderProvider wrapper */}
                <Routes>
                  {/* Dashboard - view_reports or manage_settings permission */}
                  <Route 
                    path="/dashboard" 
                    element={
                      <ProtectedRoute
                        user={currentUser}
                        requiredPermissions={['view_reports', 'manage_settings']}
                        matchMode="any"
                        fallbackPath={authService.getDefaultRoute() || '/pos'}
                        element={<DashboardPage />}
                      />
                    }
                  />

                  {/* Products Management - view_products permission (managers/admins) */}
                  <Route 
                    path="/products" 
                    element={
                      <ProtectedRoute
                        user={currentUser}
                        requiredPermissions={['view_products']}
                        fallbackPath={authService.getDefaultRoute() || '/pos'}
                        element={<ProductsPage />}
                      />
                    }
                  />

                  {/* Orders/POS - view_orders permission (all users) */}
                  <Route 
                    path="/orders" 
                    element={
                      <ProtectedRoute
                        user={currentUser}
                        requiredPermissions={['view_orders']}
                        fallbackPath={authService.getDefaultRoute() || '/pos'}
                        element={<OrdersPage />}
                      />
                    }
                  />

                  {/* POS alias for Orders - view_orders permission */}
                  <Route 
                    path="/pos" 
                    element={
                      <ProtectedRoute
                        user={currentUser}
                        requiredPermissions={['view_orders']}
                        fallbackPath="/pos"
                        element={<OrdersPage />}
                      />
                    }
                  />

                  {/* Reports - view_reports permission (managers/admins) */}
                  <Route 
                    path="/reports" 
                    element={
                      <ProtectedRoute
                        user={currentUser}
                        requiredPermissions={['view_reports']}
                        fallbackPath={authService.getDefaultRoute() || '/pos'}
                        element={<ReportsPage />}
                      />
                    }
                  />

                  {/* Settings - manage_settings permission (managers/admins) */}
                  <Route 
                    path="/settings" 
                    element={
                      <ProtectedRoute
                        user={currentUser}
                        requiredPermissions={['manage_settings']}
                        fallbackPath={authService.getDefaultRoute() || '/pos'}
                        element={<SettingsPage />}
                      />
                    }
                  />

                  {/* Home Route - Auto-redirect based on role */}
                  <Route 
                    path="/" 
                    element={<Navigate to={getHomeRoute()} replace />} 
                  />

                  {/* 404 - Redirect to home */}
                  <Route 
                    path="*" 
                    element={<Navigate to={getHomeRoute()} replace />} 
                  />
                </Routes>
              </OrderProvider> {/* Close OrderProvider wrapper */}
            </main>
          </Router>
        ) : (
          <LoginPage onLogin={handleLogin} error={error} />
        )}
      </div>
    </AuthContext.Provider>
  );
}

export default App;
