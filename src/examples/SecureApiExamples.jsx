/**
 * EXAMPLE: Secure API Client Usage
 * Real-world implementation examples for the Electron POS app
 */

// ============================================================
// EXAMPLE 1: Login Component with Secure Authentication
// ============================================================

import React, { useState, useContext } from 'react';
import AuthContext from '../context/AuthContext';
import ipcApiService from '../api/IpcApiService';

/**
 * Login Component with secure token handling
 * Demonstrates:
 * - Secure login with token storage
 * - Error handling with user-friendly messages
 * - Async/await error handling
 * - Token expiration awareness
 */
function LoginPage() {
  const authContext = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Initialize IPC service
      await ipcApiService.initialize();

      // Validate input
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      // Make secure login request
      const result = await ipcApiService.login(email, password);

      if (result.success) {
        // Token is automatically stored by ApiManager
        // Update auth context
        if (authContext?.handleLogin) {
          await authContext.handleLogin(result.data);
        }

        // Redirect to dashboard
        window.location.href = '/dashboard';
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      // Handle specific error types
      if (err.message.includes('401')) {
        setError('Invalid email or password');
      } else if (err.message.includes('Network')) {
        setError('Network error. Please check your connection.');
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleLogin}>
        <h1>POS Login</h1>

        {error && <div className="error-alert">{error}</div>}

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div className="password-input">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label="Toggle password visibility"
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}

// ============================================================
// EXAMPLE 2: Dashboard with Token Refresh
// ============================================================

import { useEffect, useState } from 'react';
import useSecureApi from '../hooks/useSecureApi';

/**
 * Dashboard with automatic token refresh
 * Demonstrates:
 * - Secure data fetching with Bearer tokens
 * - Token expiration monitoring
 * - Automatic token refresh
 * - Multiple API calls with error handling
 */
function DashboardPage() {
  const api = useSecureApi();
  const [salesData, setSalesData] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tokenExpiry, setTokenExpiry] = useState(null);

  // Load dashboard data
  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError('');

      try {
        // Fetch sales report
        const salesResult = await api.get('/reports/sales', {
          headers: { 'X-Dashboard-Request': 'true' }
        });

        if (salesResult.success) {
          setSalesData(salesResult.data);
        } else {
          throw new Error(salesResult.error);
        }

        // Fetch inventory report
        const inventoryResult = await api.get('/reports/inventory');

        if (inventoryResult.success) {
          setInventory(inventoryResult.data);
        } else {
          throw new Error(inventoryResult.error);
        }

        // Check token expiration
        // (In real app, would get this from AuthContext)
        const expiresIn = 3600; // 1 hour
        setTokenExpiry(new Date(Date.now() + expiresIn * 1000));
      } catch (err) {
        setError(err.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();

    // Set up token refresh interval (refresh 5 minutes before expiry)
    const refreshInterval = setInterval(() => {
      const now = new Date();
      const timeUntilExpiry = tokenExpiry ? tokenExpiry.getTime() - now.getTime() : Infinity;

      if (timeUntilExpiry < 5 * 60 * 1000) {
        // Refresh token
        api.post('/auth/refresh').catch(err => {
          console.error('Token refresh failed:', err);
          // Will trigger logout on next 401
        });
      }
    }, 60000); // Check every minute

    return () => clearInterval(refreshInterval);
  }, [api, tokenExpiry]);

  if (loading) return <div>Loading dashboard...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      <div className="dashboard-grid">
        <div className="card">
          <h2>Today's Sales</h2>
          <p>${salesData?.total?.toFixed(2) || '0.00'}</p>
          <p className="subtitle">{salesData?.count || 0} transactions</p>
        </div>

        <div className="card">
          <h2>Inventory Status</h2>
          <p>{inventory?.totalItems || 0} items</p>
          <p className="subtitle">{inventory?.lowStock || 0} low stock</p>
        </div>

        {tokenExpiry && (
          <div className="card">
            <h2>Session Expires</h2>
            <p>{tokenExpiry.toLocaleTimeString()}</p>
            <p className="subtitle">Auto-refresh enabled</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// EXAMPLE 3: Products Management with CRUD Operations
// ============================================================

import { useCallback } from 'react';
import { formatApiError, buildQueryString } from '../api/apiUtils';

/**
 * Products page with CRUD operations
 * Demonstrates:
 * - Secure GET with pagination
 * - Secure POST/PUT/DELETE
 * - Error handling for each operation
 * - Loading states per operation
 */
function ProductsPage() {
  const api = useSecureApi();
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [operationLoading, setOperationLoading] = useState({});

  // Load products with pagination
  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      setError('');

      try {
        const result = await api.get('/products', {
          fetchOptions: {
            method: 'GET'
          }
        });

        if (result.success) {
          setProducts(result.data.items || []);
        } else {
          throw new Error(result.error);
        }
      } catch (err) {
        const errorData = formatApiError(err);
        setError(errorData.error);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [api, page, pageSize]);

  // Create product
  const handleCreateProduct = useCallback(async (formData) => {
    setOperationLoading(prev => ({ ...prev, create: true }));
    setError('');

    try {
      const result = await api.post('/products', {
        name: formData.name,
        price: parseFloat(formData.price),
        sku: formData.sku,
        category: formData.category
      });

      if (result.success) {
        // Add to products list
        setProducts(prev => [...prev, result.data]);
        return { success: true };
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      const errorData = formatApiError(err);
      setError(errorData.error);
      return { success: false, error: errorData.error };
    } finally {
      setOperationLoading(prev => ({ ...prev, create: false }));
    }
  }, [api]);

  // Update product
  const handleUpdateProduct = useCallback(async (productId, formData) => {
    setOperationLoading(prev => ({ ...prev, [productId]: true }));
    setError('');

    try {
      const result = await api.put(`/products/${productId}`, {
        name: formData.name,
        price: parseFloat(formData.price),
        sku: formData.sku,
        category: formData.category
      });

      if (result.success) {
        // Update products list
        setProducts(prev =>
          prev.map(p => p.id === productId ? result.data : p)
        );
        return { success: true };
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      const errorData = formatApiError(err);
      setError(errorData.error);
      return { success: false, error: errorData.error };
    } finally {
      setOperationLoading(prev => {
        const newState = { ...prev };
        delete newState[productId];
        return newState;
      });
    }
  }, [api]);

  // Delete product
  const handleDeleteProduct = useCallback(async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    setOperationLoading(prev => ({ ...prev, [productId]: true }));
    setError('');

    try {
      const result = await api.delete(`/products/${productId}`);

      if (result.success) {
        // Remove from products list
        setProducts(prev => prev.filter(p => p.id !== productId));
        return { success: true };
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      const errorData = formatApiError(err);
      setError(errorData.error);
      return { success: false, error: errorData.error };
    } finally {
      setOperationLoading(prev => {
        const newState = { ...prev };
        delete newState[productId];
        return newState;
      });
    }
  }, [api]);

  return (
    <div className="products-page">
      <h1>Products</h1>

      {error && <div className="error-alert">{error}</div>}

      <button onClick={() => handleCreateProduct(/* form data */)}>
        Add Product
      </button>

      {loading ? (
        <p>Loading products...</p>
      ) : (
        <table className="products-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>SKU</th>
              <th>Price</th>
              <th>Category</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.sku}</td>
                <td>${product.price.toFixed(2)}</td>
                <td>{product.category}</td>
                <td>
                  <button
                    onClick={() => handleUpdateProduct(product.id, {})}
                    disabled={operationLoading[product.id]}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    disabled={operationLoading[product.id]}
                    className="danger"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ============================================================
// EXAMPLE 4: Error Handling with Recovery
// ============================================================

/**
 * Custom hook for managing API errors with recovery options
 */
function useApiWithErrorRecovery() {
  const api = useSecureApi();
  const [error, setError] = useState(null);
  const [retryFn, setRetryFn] = useState(null);

  const call = useCallback(async (method, endpoint, data) => {
    try {
      const result = await api[method](endpoint, data);

      if (!result.success) {
        const error = new Error(result.error);
        error.status = result.status;
        throw error;
      }

      return result.data;
    } catch (err) {
      // Determine if error is recoverable
      const isRecoverable = !err.status || err.status >= 500 || err.status === 429;

      setError({
        message: err.message,
        isRecoverable,
        code: err.status
      });

      // Store retry function if recoverable
      if (isRecoverable) {
        setRetryFn(() => () => call(method, endpoint, data));
      }

      throw err;
    }
  }, [api]);

  const retry = useCallback(() => {
    if (retryFn) {
      setError(null);
      return retryFn();
    }
  }, [retryFn]);

  const clearError = useCallback(() => {
    setError(null);
    setRetryFn(null);
  }, []);

  return { call, error, retry, clearError };
}

// ============================================================
// EXAMPLE 5: Logout with Token Cleanup
// ============================================================

/**
 * Secure logout implementation
 * Demonstrates:
 * - API call to logout endpoint
 * - Token cleanup
 * - Session termination
 * - Redirect to login
 */
async function handleSecureLogout(api, authContext) {
  try {
    // Notify backend of logout
    await api.post('/auth/logout');
  } catch (error) {
    console.error('Logout notification failed:', error);
    // Continue with local logout even if API call fails
  } finally {
    // Clear local auth state
    if (authContext?.handleLogout) {
      await authContext.handleLogout();
    }

    // Redirect to login
    window.location.href = '/login';
  }
}

// ============================================================
// EXPORT EXAMPLES
// ============================================================

export {
  LoginPage,
  DashboardPage,
  ProductsPage,
  useApiWithErrorRecovery,
  handleSecureLogout
};
