/**
 * API CLIENT IMPLEMENTATION GUIDE
 * 
 * This guide demonstrates how to use the secure API client system
 * in the Electron POS application with comprehensive security features.
 */

// ============================================================
// 1. USING ApiManager (Main Process)
// ============================================================

/**
 * The ApiManager is initialized in main.js and handles all API
 * communication with security features:
 * 
 * Features:
 * - Bearer token authentication
 * - Automatic token refresh on 401 (with request queuing)
 * - Global 401/403 error handling with forced logout
 * - Centralized error handling with ApiError class
 * - Request/response interceptors for logging and token injection
 * - Token expiration tracking
 * 
 * Example initialization in main.js:
 */

// const ApiManager = require('./src/api/ApiManager');
// const { ApiError } = require('./src/api/ApiManager');

// const apiManager = new ApiManager(logger, store, {
//   onAuthError: (message) => {
//     mainWindow.webContents.send('auth:error', message);
//   },
//   onTokenRefresh: (token) => {
//     mainWindow.webContents.send('auth:tokenRefreshed', token);
//   },
//   refreshEndpoint: '/auth/refresh',
//   logoutEndpoint: '/auth/logout'
// });

// ============================================================
// 2. USING IpcApiService (Renderer Process)
// ============================================================

/**
 * IpcApiService wraps the ApiManager calls through IPC
 * Use this in React components for secure API calls
 */

// In a React component:

import { useEffect, useState } from 'react';
import ipcApiService from '../api/IpcApiService';

function ExampleComponent() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);

      try {
        // Initialize service (one-time setup)
        await ipcApiService.initialize();

        // Make secure API call through IPC
        const result = await ipcApiService.getProducts({ page: 1, limit: 10 });
        setProducts(result.data || []);
      } catch (err) {
        // Errors are automatically normalized and can include:
        // - Authentication errors (will trigger logout)
        // - Network errors with retry logic
        // - Validation errors from backend
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {products.length > 0 && (
        <ul>
          {products.map(product => (
            <li key={product.id}>{product.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================
// 3. USING useSecureApi HOOK (Recommended for React)
// ============================================================

/**
 * Custom React hook for the best developer experience
 * Automatically handles auth context and provides type-safe methods
 */

import { useEffect, useState } from 'react';
import useSecureApi from '../hooks/useSecureApi';

function ProductsPage() {
  const api = useSecureApi();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      setError(null);

      try {
        // Simple GET request
        const result = await api.get('/products', {
          headers: { 'X-Request-ID': generateRequestId() }
        });

        if (result.success) {
          setProducts(result.data);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError('Failed to load products');
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [api]);

  const handleDelete = async (productId) => {
    const result = await api.delete(`/products/${productId}`);
    
    if (result.success) {
      setProducts(p => p.filter(prod => prod.id !== productId));
    } else {
      setError(result.error);
    }
  };

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {products.map(product => (
        <div key={product.id}>
          <h3>{product.name}</h3>
          <button onClick={() => handleDelete(product.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// 4. ERROR HANDLING PATTERNS
// ============================================================

/**
 * The system handles errors automatically:
 * 
 * 401 Unauthorized:
 * - Automatically attempts token refresh
 * - If refresh fails, forces logout
 * - Queues pending requests during refresh
 * 
 * 403 Forbidden:
 * - Immediately forces logout
 * - Shows permission error to user
 * 
 * Network Errors:
 * - Automatic retry with exponential backoff
 * - Configurable max retries and delays
 * 
 * Validation Errors:
 * - Returned as ApiError with status, data, and message
 * - Can be validated and transformed using apiUtils
 */

// Using apiUtils for error handling:

import { isNetworkError, shouldRetry, retryRequest } from '../api/apiUtils';

async function fetchWithRetry() {
  try {
    return await retryRequest(
      () => api.get('/protected-resource'),
      maxRetries = 3,
      initialDelay = 1000,
      backoffMultiplier = 2
    );
  } catch (error) {
    if (isNetworkError(error)) {
      console.error('Network error - check connectivity');
    } else if (error.status === 401) {
      console.error('Authentication failed');
    } else {
      console.error('Request failed:', error.message);
    }
  }
}

// ============================================================
// 5. AUTHENTICATION FLOW
// ============================================================

/**
 * Complete auth flow with token management:
 */

// Login
async function handleLogin(email, password) {
  try {
    const result = await ipcApiService.login(email, password);
    
    // Token is automatically saved by ApiManager
    // AuthContext is updated
    // Ready to make authenticated requests
    
    return result;
  } catch (error) {
    console.error('Login failed:', error.message);
  }
}

// Token Refresh (manual or automatic)
async function refreshAccessToken() {
  try {
    const result = await ipcApiService.refreshToken();
    // New token is automatically set in ApiManager
    return result;
  } catch (error) {
    // If refresh fails, user is automatically logged out
    redirectToLogin();
  }
}

// Logout
async function handleLogout() {
  try {
    await ipcApiService.logout();
    // Auth is cleared, ready to redirect to login
  } catch (error) {
    // Even if API logout fails, local auth is cleared
    console.error('Logout error:', error);
  }
}

// ============================================================
// 6. ADVANCED USAGE
// ============================================================

/**
 * Batch API calls with error handling
 */
import { batchRequests } from '../api/apiUtils';

async function loadDashboard() {
  const results = await batchRequests([
    ipcApiService.getSalesReport({ startDate: today }),
    ipcApiService.getInventoryReport(),
    ipcApiService.getTopProductsReport()
  ]);

  if (results.allSuccessful) {
    const [sales, inventory, topProducts] = results.successful;
    // All succeeded - update UI
  } else {
    // Some failed - show appropriate error message
    console.error('Failed requests:', results.failed);
  }
}

/**
 * Request caching with TTL
 */
import { createRequestCache } from '../api/apiUtils';

const productCache = createRequestCache(60000); // 60 second TTL

async function getProductWithCache(productId) {
  // Check cache first
  if (productCache.has(`product-${productId}`)) {
    return productCache.get(`product-${productId}`);
  }

  // Fetch from API
  const result = await ipcApiService.getProduct(productId);

  // Cache result
  productCache.set(`product-${productId}`, result);

  return result;
}

/**
 * Validate and transform API responses
 */
import { validateAndTransform } from '../api/apiUtils';

const productSchema = {
  name: {
    type: 'string',
    required: true,
    validator: (val) => val.length > 0
  },
  price: {
    type: 'number',
    required: true,
    validator: (val) => val > 0
  },
  sku: {
    type: 'string',
    transform: (val) => val.toUpperCase()
  }
};

async function createProduct(data) {
  try {
    // Validate before sending
    const validated = validateAndTransform(data, productSchema);
    const result = await ipcApiService.createProduct(validated);
    return result;
  } catch (error) {
    console.error('Validation failed:', error.validationErrors);
  }
}

// ============================================================
// 7. SECURITY BEST PRACTICES
// ============================================================

/**
 * ✓ DO:
 * - Always use Bearer tokens (automatically handled)
 * - Let system handle 401 errors and token refresh
 * - Validate user input before API calls
 * - Use HTTPS in production
 * - Store sensitive data securely (tokens in secure storage)
 * - Handle errors gracefully with user-friendly messages
 * - Log errors for debugging (with PII redaction)
 * 
 * ✗ DON'T:
 * - Never send tokens in URLs or query parameters
 * - Never store tokens in localStorage (use secure storage)
 * - Never log tokens or sensitive data
 * - Never bypass auth checks
 * - Never use HTTP in production
 * - Don't retry 401/403 errors indefinitely
 * - Don't expose error details to users
 */

// ============================================================
// SECURITY CHECKLIST
// ============================================================

const SecurityChecklist = [
  '✓ Bearer token authentication configured',
  '✓ Automatic 401 handling with token refresh',
  '✓ Automatic 403 handling with logout',
  '✓ Request/response interceptors for logging',
  '✓ Error normalization with ApiError class',
  '✓ Token expiration tracking',
  '✓ Secure storage of tokens (secure storage)',
  '✓ Request timeout configuration',
  '✓ Retry logic for transient failures',
  '✓ Error handlers for UI feedback',
  '✓ IPC-based API calls (protected by context isolation)',
  '✓ Centralized error handling',
  '✓ User-friendly error messages',
  '✓ Batch request handling',
  '✓ Request caching with TTL'
];

export default {
  handleLogin,
  handleLogout,
  refreshAccessToken,
  fetchWithRetry,
  createProduct,
  getProductWithCache
};
