/**
 * QUICK REFERENCE - Secure API Client
 * Fast lookup for common tasks and patterns
 */

// ============================================================
// 1. QUICK START
// ============================================================

// In React Component:
import useSecureApi from './hooks/useSecureApi';

function MyComponent() {
  const api = useSecureApi();
  
  // Use it:
  const data = await api.get('/endpoint');
  const result = await api.post('/endpoint', { data });
  const updated = await api.put('/endpoint/1', { data });
  await api.delete('/endpoint/1');
}

// In Main Process:
const ApiManager = require('./api/ApiManager');
const { ApiError } = require('./api/ApiManager');

const apiManager = new ApiManager(logger, store);
try {
  const data = await apiManager.getProducts();
} catch (error) {
  if (error instanceof ApiError) {
    console.log(error.getUserMessage());
  }
}

// In Renderer Process:
const ipcApiService = require('./api/IpcApiService');

await ipcApiService.initialize();
const products = await ipcApiService.getProducts();

// ============================================================
// 2. COMMON TASKS
// ============================================================

// LOGIN
const result = await ipcApiService.login('user@example.com', 'password');
// Token automatically saved!

// LOGOUT (with API call and cleanup)
await ipcApiService.logout();
// Auth cleared, user logged out

// GET DATA
const products = await api.get('/products?page=1&limit=10');
const product = await api.get(`/products/${id}`);

// POST DATA (CREATE)
const newProduct = await api.post('/products', {
  name: 'Product Name',
  price: 99.99,
  sku: 'SKU123'
});

// PUT DATA (UPDATE)
const updated = await api.put(`/products/${id}`, {
  name: 'Updated Name',
  price: 109.99
});

// DELETE DATA
await api.delete(`/products/${id}`);

// REFRESH TOKEN
await ipcApiService.refreshToken();

// BATCH REQUESTS
import { batchRequests } from './api/apiUtils';

const results = await batchRequests([
  api.get('/sales'),
  api.get('/inventory'),
  api.get('/revenue')
]);

// CACHE RESULTS
import { createRequestCache } from './api/apiUtils';

const cache = createRequestCache(60000); // 60 sec TTL
if (cache.has('products')) {
  return cache.get('products');
}
const products = await api.get('/products');
cache.set('products', products);

// RETRY WITH BACKOFF
import { retryRequest } from './api/apiUtils';

const data = await retryRequest(
  () => api.get('/unreliable-endpoint'),
  3,        // max retries
  1000,     // initial delay
  2         // backoff multiplier
);

// ============================================================
// 3. ERROR HANDLING
// ============================================================

// Try-catch pattern
try {
  const result = await api.get('/products');
  if (result.success) {
    setProducts(result.data);
  } else {
    setError(result.error);
  }
} catch (err) {
  setError(err.message);
}

// Check error type
import { isNetworkError, shouldRetry } from './api/apiUtils';

catch (error) {
  if (isNetworkError(error)) {
    // Network issue
  } else if (error.status === 401) {
    // Will auto-logout
  } else if (error.status === 403) {
    // Permission denied
  }
}

// Get user-friendly message
const apiError = new ApiError('...', 404, {}, null);
console.log(apiError.getUserMessage());
// → "The requested resource was not found."

// Merge error messages
import { mergeErrors } from './api/apiUtils';

const message = mergeErrors({
  email: 'Invalid format',
  password: 'Too short'
});
// → "Invalid format; Too short"

// ============================================================
// 4. AUTHENTICATION PATTERNS
// ============================================================

// Login Flow
async function handleLogin(email, password) {
  const result = await ipcApiService.login(email, password);
  // Token auto-saved, update UI, redirect to dashboard
}

// Logout Flow
async function handleLogout() {
  await ipcApiService.logout();
  // Auth cleared, redirect to login
}

// Check Token Expiration
const isExpired = apiManager.isTokenExpired();
const secondsLeft = apiManager.getTokenTimeRemaining();

// Manual Token Refresh
const refreshResult = await ipcApiService.refreshToken();
// Token auto-saved if successful

// Listen for Token Refresh
ipcApiService.onTokenRefreshed((newToken) => {
  console.log('Token refreshed');
});

// Listen for Auth Changes
ipcApiService.onAuthStateChange((authData) => {
  console.log('Auth state changed', authData);
});

// ============================================================
// 5. RESPONSE VALIDATION
// ============================================================

import { validateAndTransform } from './api/apiUtils';

// Define schema
const productSchema = {
  name: {
    type: 'string',
    required: true
  },
  price: {
    type: 'number',
    validator: (val) => val > 0
  },
  sku: {
    type: 'string',
    transform: (val) => val.toUpperCase()
  }
};

// Validate
const validated = validateAndTransform(data, productSchema);

// ============================================================
// 6. REQUEST CONFIGURATION
// ============================================================

// Custom headers
const result = await api.get('/products', {
  headers: {
    'X-Custom-Header': 'value',
    'X-Request-ID': generateId()
  }
});

// Custom timeout
const result = await api.get('/slow-endpoint', {
  fetchOptions: {
    timeout: 60000  // 60 seconds
  }
});

// Skip auth (for public endpoints)
const result = await api.get('/public/data', {
  skipAuth: true
});

// Custom options
const result = await api.post('/endpoint', data, {
  retry: false,
  timeout: 45000,
  validateResponse: true
});

// ============================================================
// 7. RESPONSE HANDLING
// ============================================================

// Result structure
{
  success: boolean,
  data: any,
  error?: string,
  status: number
}

// Check success
if (result.success) {
  console.log('Data:', result.data);
} else {
  console.log('Error:', result.error);
}

// Parse pagination
import { parsePagination } from './api/apiUtils';

const pagination = parsePagination(response.data);
console.log(pagination);
// { total, page, pageSize, totalPages, hasMore }

// ============================================================
// 8. INTERCEPTORS & HOOKS
// ============================================================

// Request interceptor (auto-added by ApiManager)
// - Injects Authorization header
// - Logs request details
// - Adds timing metadata

// Response interceptor (auto-added by ApiManager)
// - Extracts data from response
// - Handles 401 with token refresh
// - Handles 403 with forced logout
// - Normalizes errors

// Auth error callback
const apiManager = new ApiManager(logger, store, {
  onAuthError: (message) => {
    console.log('Auth error:', message);
    redirectToLogin();
  }
});

// Token refresh callback
const apiManager = new ApiManager(logger, store, {
  onTokenRefresh: (newToken) => {
    console.log('Token refreshed');
    // Update UI if needed
  }
});

// ============================================================
// 9. ADVANCED PATTERNS
// ============================================================

// Request cancellation
const api = useSecureApi();
const handleCancel = () => api.cancel();

// Timeout with fallback
import { withTimeout } from './api/apiUtils';

try {
  const data = await withTimeout(
    api.get('/slow-endpoint'),
    5000  // 5 second timeout
  );
} catch (err) {
  if (err.message === 'Request timeout') {
    // Handle timeout
  }
}

// Query string builder
import { buildQueryString } from './api/apiUtils';

const query = buildQueryString({
  page: 1,
  filter: ['active', 'pending'],
  search: 'term'
});
// → "page=1&filter=active&filter=pending&search=term"

// ============================================================
// 10. TROUBLESHOOTING
// ============================================================

// Check if initialized
const initialized = ipcApiService.isInitialized;

// Get current token
const token = apiManager.authToken;
const refreshToken = apiManager.refreshToken;

// Check token expiry
const expires = apiManager.tokenExpiresAt;
const timeLeft = apiManager.getTokenTimeRemaining();

// Clear auth manually
apiManager.clearAuth();

// Update API URL
apiManager.setApiUrl('http://new-api-url/v1');

// Set token manually
apiManager.setAuthToken(token, expiresIn);

// Listen to logs
process.env.DEBUG = 'pos:*';

// ============================================================
// 11. COMPLETE LOGIN EXAMPLE
// ============================================================

function LoginComponent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const authContext = useContext(AuthContext);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Initialize if needed
      await ipcApiService.initialize();

      // Login
      const result = await ipcApiService.login(email, password);

      // Update auth context
      if (authContext?.handleLogin) {
        await authContext.handleLogin(result.data);
      }

      // Redirect
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      {error && <div className="error">{error}</div>}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}

// ============================================================
// 12. COMPLETE DATA FETCH EXAMPLE
// ============================================================

function ProductsComponent() {
  const api = useSecureApi();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      setError('');

      try {
        const result = await api.get('/products', {
          headers: { 'X-Page': page }
        });

        if (result.success) {
          setProducts(result.data);
        } else {
          throw new Error(result.error);
        }
      } catch (err) {
        setError(err.message || 'Failed to load products');
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [api, page]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <ul>
        {products.map(p => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
      <button onClick={() => setPage(p => p + 1)}>Next Page</button>
    </div>
  );
}

// ============================================================
// HELPFUL LINKS
// ============================================================

// Full documentation:
// - src/api/API_SECURITY.md
// - src/api/API_INTEGRATION_GUIDE.js
// - src/examples/SecureApiExamples.jsx

// Implementation files:
// - src/api/ApiManager.js
// - src/api/IpcApiService.js
// - src/api/apiUtils.js
// - src/hooks/useSecureApi.js

// Overall guide:
// - SECURE_API_IMPLEMENTATION.md

export default {
  // Quick reference guide only - see imports above for actual usage
};
