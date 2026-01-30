/**
 * Complete Example: Secure Token Integration in React
 * 
 * This file demonstrates best practices for using the secure token system
 * in a React application.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const { ipcRenderer } = window.require('electron');

// ============================================
// Authentication Context
// ============================================

const AuthContext = createContext(null);

/**
 * Auth Provider Component
 * Manages authentication state and provides auth functions to the app
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Check authentication status
  useEffect(() => {
    async function checkAuth() {
      try {
        setLoading(true);
        
        // Get token info
        const info = await ipcRenderer.invoke('auth:getTokenInfo');
        setTokenInfo(info);

        // Get current user if authenticated
        if (info.hasToken) {
          const currentUser = await ipcRenderer.invoke('auth:getCurrentUser');
          setUser(currentUser);
        } else {
          setUser(null);
        }

        setError(null);
      } catch (err) {
        console.error('Auth check failed:', err.message);
        setUser(null);
        setTokenInfo(null);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();

    // Check auth status every minute
    const interval = setInterval(checkAuth, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh token when expiring soon
  useEffect(() => {
    if (!tokenInfo?.hasToken) return;

    // If token expiring in less than 5 minutes, refresh it
    if (tokenInfo.secondsRemaining < 300) {
      console.log('Token expiring soon, refreshing...');
      ipcRenderer.invoke('auth:refreshToken').catch(err => {
        console.error('Token refresh failed:', err);
        // Force logout on refresh failure
        handleLogout();
      });
    }

    // Check again in 30 seconds
    const timeout = setTimeout(() => {
      ipcRenderer.invoke('auth:getTokenInfo').then(newInfo => {
        setTokenInfo(newInfo);
      });
    }, 30000);

    return () => clearTimeout(timeout);
  }, [tokenInfo?.secondsRemaining]);

  // Login
  const login = useCallback(async (email, password) => {
    try {
      setLoading(true);
      setError(null);

      const result = await ipcRenderer.invoke('auth:login', { email, password });
      
      setUser(result);
      
      // Update token info
      const info = await ipcRenderer.invoke('auth:getTokenInfo');
      setTokenInfo(info);

      return result;
    } catch (err) {
      const errorMsg = err.message || 'Login failed';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout
  const handleLogout = useCallback(async () => {
    try {
      await ipcRenderer.invoke('auth:logout');
      await ipcRenderer.invoke('auth:clearTokens');
      
      setUser(null);
      setTokenInfo(null);
      setError(null);
      
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
      // Force logout anyway
      navigate('/login');
    }
  }, [navigate]);

  // Refresh token
  const refreshToken = useCallback(async () => {
    try {
      await ipcRenderer.invoke('auth:refreshToken');
      
      // Update token info
      const info = await ipcRenderer.invoke('auth:getTokenInfo');
      setTokenInfo(info);
      
      return info;
    } catch (err) {
      console.error('Token refresh failed:', err);
      // On refresh failure, force logout
      await handleLogout();
      throw err;
    }
  }, [handleLogout]);

  // Check token validity
  const isTokenValid = useCallback(() => {
    if (!tokenInfo) return false;
    return tokenInfo.hasToken && tokenInfo.secondsRemaining > 0;
  }, [tokenInfo]);

  const value = {
    user,
    tokenInfo,
    loading,
    error,
    login,
    logout: handleLogout,
    refreshToken,
    isTokenValid,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to use auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// ============================================
// Login Component
// ============================================

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      if (err.message.includes('Invalid')) {
        setError('Email or password is incorrect');
      } else if (err.message.includes('not found')) {
        setError('Account does not exist');
      } else {
        setError(err.message || 'Login failed');
      }
    }
  }

  return (
    <div className="login-page">
      <h1>POS System</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={loading}
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}

// ============================================
// Protected Route Component
// ============================================

export function ProtectedRoute({ children }) {
  const { isTokenValid, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isTokenValid()) {
      navigate('/login', { replace: true });
    }
  }, [loading, isTokenValid, navigate]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isTokenValid()) {
    return null; // Will redirect via useEffect
  }

  return children;
}

// ============================================
// Navigation with Logout
// ============================================

export function Navigation() {
  const { user, tokenInfo, logout, loading } = useAuth();

  if (!user) {
    return null;
  }

  const minutes = Math.floor(tokenInfo.secondsRemaining / 60);
  const seconds = tokenInfo.secondsRemaining % 60;

  return (
    <nav className="navigation">
      <div className="nav-left">
        <h2>POS System</h2>
      </div>
      <div className="nav-right">
        <span className="user-info">
          {user.name} ({user.role})
        </span>
        <span className="token-status">
          Token expires in {minutes}m {seconds}s
        </span>
        <button 
          onClick={logout} 
          disabled={loading}
          className="logout-btn"
        >
          {loading ? 'Logging out...' : 'Logout'}
        </button>
      </div>
    </nav>
  );
}

// ============================================
// API Service Hook
// ============================================

/**
 * Custom hook for making secure API calls
 */
export function useApi() {
  const { tokenInfo, refreshToken, logout } = useAuth();

  const apiCall = useCallback(async (method, endpoint, data = null) => {
    try {
      // Check if token is expiring soon (within 5 minutes)
      if (tokenInfo?.secondsRemaining < 300) {
        console.log('Token expiring soon, refreshing...');
        await refreshToken();
      }

      // Make API call
      let response;
      switch (method.toUpperCase()) {
        case 'GET':
          response = await ipcRenderer.invoke('api:get', { endpoint });
          break;
        case 'POST':
          response = await ipcRenderer.invoke('api:post', { endpoint, data });
          break;
        case 'PUT':
          response = await ipcRenderer.invoke('api:put', { endpoint, data });
          break;
        case 'DELETE':
          response = await ipcRenderer.invoke('api:delete', { endpoint });
          break;
        default:
          throw new Error(`Unsupported method: ${method}`);
      }

      return response;
    } catch (error) {
      // Handle 401 (unauthorized)
      if (error.status === 401) {
        console.error('Unauthorized, logging out...');
        await logout();
        throw new Error('Session expired');
      }

      // Handle 403 (forbidden)
      if (error.status === 403) {
        throw new Error('You do not have permission to access this resource');
      }

      // Handle 500+ (server error)
      if (error.status >= 500) {
        throw new Error('Server error. Please try again later.');
      }

      // Re-throw other errors
      throw error;
    }
  }, [tokenInfo, refreshToken, logout]);

  return {
    get: (endpoint) => apiCall('GET', endpoint),
    post: (endpoint, data) => apiCall('POST', endpoint, data),
    put: (endpoint, data) => apiCall('PUT', endpoint, data),
    delete: (endpoint) => apiCall('DELETE', endpoint),
  };
}

// ============================================
// Example: Products Page Component
// ============================================

export function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const api = useApi();

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        setError(null);

        const data = await api.get('/products');
        setProducts(data);
      } catch (err) {
        setError(err.message || 'Failed to load products');
        console.error('Load products error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, [api]);

  if (loading) return <div>Loading products...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="products-page">
      <h1>Products</h1>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Price</th>
            <th>Stock</th>
          </tr>
        </thead>
        <tbody>
          {products.map(product => (
            <tr key={product.id}>
              <td>{product.id}</td>
              <td>{product.name}</td>
              <td>${product.price.toFixed(2)}</td>
              <td>{product.stock}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// Example: App Component with Routing
// ============================================

export function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

function MainApp() {
  const { isTokenValid } = useAuth();

  return (
    <div className="app">
      {isTokenValid() && <Navigation />}
      <main className="main-content">
        {/* React Router would wrap these in actual routes */}
        {isTokenValid() ? (
          <>
            <ProtectedRoute>
              <ProductsPage />
            </ProtectedRoute>
          </>
        ) : (
          <LoginPage />
        )}
      </main>
    </div>
  );
}

export default App;
