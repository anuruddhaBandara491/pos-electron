# Secure API Client Implementation

## Overview

This implementation provides a **production-ready secure API client** for the Electron POS application with comprehensive security features:

- 🔐 **Bearer Token Authentication** - Automatic Authorization header injection
- 🔄 **Token Refresh** - Automatic refresh on 401 with request queuing
- ⛔ **Auth Error Handling** - Global 401/403 handling with forced logout
- 📊 **Centralized Error Handling** - Unified `ApiError` class for all errors
- 🔁 **Retry Logic** - Exponential backoff for transient failures
- 📝 **Request Logging** - Debug-level logging with timing information
- 🚀 **Performance** - Request timeout, caching, and batch operations
- 🔒 **Security** - XSS prevention, input validation, secure storage

## Architecture

### Core Components

```
src/api/
├── ApiManager.js              # Main API client (Main Process)
├── IpcApiService.js           # IPC wrapper (Renderer Process)
├── apiUtils.js                # Utility functions for API operations
├── API_INTEGRATION_GUIDE.js    # Usage examples and patterns
└── API_SECURITY.md            # This file

src/hooks/
└── useSecureApi.js            # React hook for secure API calls

src/security/
├── SecurityManager.js         # Security verification
└── securityConfig.js          # Security configuration
```

### Data Flow

```
React Component
     ↓
useSecureApi Hook / IpcApiService
     ↓
IPC (ipcRenderer.invoke)
     ↓
Main Process (IpcHandler)
     ↓
ApiManager (with Axios)
     ↓
Backend API
     ↓ (Response)
Interceptors (401/403 handling, token refresh)
     ↓
IpcHandler → IPC
     ↓
React Component
```

## Security Features

### 1. Bearer Token Authentication

Tokens are automatically attached to every authenticated request:

```javascript
// Automatically added by ApiManager interceptor
Authorization: Bearer <token>
```

**Token Storage:**
- Stored securely using Electron's store/secure storage
- Never stored in localStorage
- Cleared on logout
- Expiration tracked automatically

### 2. Token Refresh (401 Handling)

When a 401 (Unauthorized) response is received:

1. **Request Queuing**: Pending requests are queued
2. **Token Refresh**: Automatic call to `/auth/refresh` endpoint
3. **Token Update**: New token is saved and applied
4. **Request Retry**: Original request is retried with new token
5. **Fallback**: If refresh fails → Force logout

**Request Queuing Flow:**
```
Request 1 → 401 → Start refresh → Queue Request 1
Request 2 → 401 → Already refreshing → Queue Request 2
Request 3 → 401 → Already refreshing → Queue Request 3
           → Refresh completes → Retry all queued requests
```

### 3. Forbidden Access (403 Handling)

When a 403 (Forbidden) response is received:

1. Immediately clears authentication
2. Forces user logout
3. Redirects to login page
4. Provides user-friendly error message

### 4. Centralized Error Handling

All errors are normalized to the `ApiError` class:

```javascript
class ApiError extends Error {
  constructor(message, status, data, originalError) {
    super(message);
    this.status = status;      // HTTP status code
    this.data = data;          // Backend error data
    this.timestamp = new Date().toISOString();
  }

  // Helper methods
  isAuthError()               // Check if 401/403
  isRecoverable()             // Check if server error
  getUserMessage()            // Get user-friendly message
}
```

### 5. Request/Response Interceptors

**Request Interceptor:**
- Validates authentication token
- Injects Bearer token header
- Logs request details
- Records timing metadata

**Response Interceptor:**
- Handles 401 with token refresh
- Handles 403 with forced logout
- Normalizes errors to ApiError
- Logs response timing
- Extracts data from response

### 6. Automatic Retry with Exponential Backoff

Transient failures automatically retry:

```javascript
// Default: 3 retries with 1s initial delay
Retry 1: Wait 1000ms → Attempt
Retry 2: Wait 2000ms → Attempt  (2x backoff)
Retry 3: Wait 4000ms → Attempt  (2x backoff)
Failure: Reject with ApiError
```

**NOT Retried:**
- 401/403 (auth errors)
- 4xx errors (client errors, except 429)
- Abort errors

## Usage Patterns

### Pattern 1: IPC Service (Recommended for Main Process)

```javascript
import ipcApiService from './api/IpcApiService';

// Initialize once
await ipcApiService.initialize();

// Make secure calls
const result = await ipcApiService.getProducts({ page: 1 });

if (result.success) {
  console.log('Products:', result.data);
} else {
  console.error('Error:', result.error);
}
```

### Pattern 2: useSecureApi Hook (Recommended for React)

```javascript
import useSecureApi from './hooks/useSecureApi';

function ProductsPage() {
  const api = useSecureApi();

  useEffect(() => {
    api.get('/products')
      .then(result => {
        if (result.success) {
          setProducts(result.data);
        }
      });
  }, [api]);

  return <div>{/* render products */}</div>;
}
```

### Pattern 3: Direct ApiManager (Main Process)

```javascript
import ApiManager, { ApiError } from './api/ApiManager';

const apiManager = new ApiManager(logger, store, {
  onAuthError: (msg) => mainWindow.webContents.send('auth:error', msg),
  onTokenRefresh: (token) => mainWindow.webContents.send('auth:tokenRefreshed', token)
});

try {
  const products = await apiManager.getProducts();
} catch (error) {
  if (error instanceof ApiError) {
    if (error.isAuthError()) {
      // Handle auth error
    } else if (error.isRecoverable()) {
      // Retry later
    }
  }
}
```

## API Methods

### Authentication

```javascript
await apiService.login(email, password)
await apiService.logout()
await apiService.getCurrentUser()
await apiService.refreshToken()
await apiService.saveToken(token)
```

### Products

```javascript
await apiService.getProducts(params)
await apiService.getProduct(id)
await apiService.createProduct(data)
await apiService.updateProduct(id, data)
await apiService.deleteProduct(id)
```

### Orders

```javascript
await apiService.getOrders(params)
await apiService.getOrder(id)
await apiService.createOrder(data)
await apiService.updateOrder(id, data)
await apiService.cancelOrder(id)
await apiService.checkoutOrder(data)
```

### Payments

```javascript
await apiService.processPayment(data)
await apiService.getPaymentHistory(params)
await apiService.refundPayment(paymentId)
```

### Reports

```javascript
await apiService.getSalesReport(params)
await apiService.getInventoryReport(params)
await apiService.getTopProductsReport(params)
await apiService.getCashFlowReport(params)
```

### Storage

```javascript
await apiService.getStorageValue(key)
await apiService.setStorageValue(key, value)
await apiService.removeStorageValue(key)
await apiService.clearStorage()
```

## Utility Functions

### Error Handling

```javascript
import { isNetworkError, shouldRetry, mergeErrors } from './api/apiUtils';

// Check error type
if (isNetworkError(error)) {
  console.log('Network connectivity issue');
}

// Check if should retry
if (shouldRetry(error, retryCount, maxRetries)) {
  // Retry the request
}

// Merge multiple errors
const errorMessage = mergeErrors(error.validationErrors);
```

### Request Management

```javascript
import { 
  retryRequest,
  buildQueryString,
  createRequestCache,
  batchRequests 
} from './api/apiUtils';

// Retry with backoff
const result = await retryRequest(
  () => api.get('/resource'),
  maxRetries = 3,
  initialDelay = 1000,
  backoffMultiplier = 2
);

// Build query strings
const query = buildQueryString({ 
  page: 1, 
  filter: ['active', 'pending'] 
});

// Cache results with TTL
const cache = createRequestCache(60000); // 60 second TTL
cache.set('products', data);
const cached = cache.get('products');

// Batch multiple requests
const results = await batchRequests([
  api.get('/sales'),
  api.get('/inventory'),
  api.get('/revenue')
]);

if (results.allSuccessful) {
  // All succeeded
}
```

### Data Validation

```javascript
import { validateAndTransform } from './api/apiUtils';

const schema = {
  email: {
    type: 'string',
    required: true,
    validator: (val) => val.includes('@')
  },
  age: {
    type: 'number',
    validator: (val) => val >= 18
  }
};

const validated = validateAndTransform(userData, schema);
```

## Configuration

### ApiManager Options

```javascript
const apiManager = new ApiManager(logger, store, {
  // Callback when auth error occurs
  onAuthError: (message) => {
    // Handle auth error
  },

  // Callback when token is refreshed
  onTokenRefresh: (newToken) => {
    // Handle token refresh
  },

  // Custom endpoints
  refreshEndpoint: '/auth/refresh',
  logoutEndpoint: '/auth/logout'
});
```

### Token Expiration

```javascript
// Set token with expiration
apiManager.setAuthToken(token, expiresIn = 3600);

// Check expiration
const isExpired = apiManager.isTokenExpired();
const secondsRemaining = apiManager.getTokenTimeRemaining();
```

## Error Messages

### User-Friendly Messages

The system automatically provides user-friendly error messages:

```javascript
error.getUserMessage()

// Examples:
// 400 → "Invalid request. Please check your input."
// 401 → "Your session has expired. Please log in again."
// 403 → "You do not have permission to access this resource."
// 404 → "The requested resource was not found."
// 429 → "Too many requests. Please try again later."
// 500+ → "Server error. Please try again later."
```

## Security Best Practices

### ✅ DO

- ✓ Always use Bearer token authentication
- ✓ Let system handle 401 errors automatically
- ✓ Validate user input before API calls
- ✓ Use HTTPS in production
- ✓ Store tokens in secure storage (not localStorage)
- ✓ Handle errors gracefully with user feedback
- ✓ Log errors for debugging (redact PII)
- ✓ Implement token rotation
- ✓ Set reasonable request timeouts
- ✓ Use exponential backoff for retries

### ❌ DON'T

- ✗ Send tokens in URLs or query parameters
- ✗ Store tokens in localStorage
- ✗ Log tokens or sensitive data
- ✗ Bypass authentication checks
- ✗ Use HTTP in production
- ✗ Retry auth errors indefinitely
- ✗ Expose error details to users
- ✗ Disable CORS security headers
- ✗ Accept invalid/expired certificates
- ✗ Store credentials in code/config files

## Troubleshooting

### Token Refresh Loop

If experiencing infinite token refresh loops:

```javascript
// Check error handling in refresh endpoint
if (config.url.includes(this.refreshEndpoint)) {
  // Prevent infinite refresh
  return this.forceLogout();
}
```

### Missing Token

If token is not being attached:

```javascript
// Check if token is set
console.log(apiManager.authToken);

// Verify token is not expired
console.log(apiManager.isTokenExpired());

// Check secure storage
console.log(store.get('authToken'));
```

### Request Timeout

If requests are timing out:

```javascript
// Check network connectivity
// Increase timeout in ApiManager
timeout: 45000, // default 30000

// Check backend server status
await ipcApiService.healthCheck();
```

### 401/403 Not Handled

If auth errors are not being handled:

```javascript
// Verify onAuthError callback is registered
// Check if interceptors are properly configured
// Verify token refresh endpoint is correct
// Check if refresh token is valid
```

## Testing

### Mock API Responses

```javascript
// Mock successful response
jest.mock('./api/IpcApiService', () => ({
  getProducts: jest.fn().mockResolvedValue({
    success: true,
    data: [{ id: 1, name: 'Product 1' }]
  })
}));

// Mock error response
jest.mock('./api/IpcApiService', () => ({
  getProducts: jest.fn().mockRejectedValue(
    new Error('API Error')
  )
}));
```

### Test Auth Error Handling

```javascript
it('should handle 401 and force logout', async () => {
  const apiManager = new ApiManager(logger, store, {
    onAuthError: jest.fn()
  });

  // Simulate 401 error
  // Verify logout was called
  // Verify token was cleared
});
```

## Performance Considerations

1. **Token Caching**: Tokens are cached in memory, not requested repeatedly
2. **Request Caching**: Use `createRequestCache()` for frequently accessed data
3. **Batch Operations**: Use `batchRequests()` to reduce network calls
4. **Timeouts**: Set appropriate timeouts to prevent hanging requests
5. **Retry Backoff**: Exponential backoff prevents server overload
6. **Connection Pooling**: Axios handles connection pooling automatically

## Monitoring & Logging

All API calls are logged with:

- Request method, URL, and timing
- Response status and timing
- Error messages with stack traces
- Authentication state changes
- Token refresh events

Enable debug logging:

```javascript
process.env.DEBUG = 'pos:*';
// or in console
localStorage.debug = 'pos:*';
```

## Support & Maintenance

- Review token expiration settings regularly
- Monitor 401/403 error rates
- Update error handling for new API endpoints
- Test token refresh flow periodically
- Audit authentication logs monthly
- Keep axios and dependencies updated

## Further Reading

- [Axios Documentation](https://axios-http.com/docs/intro)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8949)
- [Electron Security](https://www.electronjs.org/docs/tutorial/security)
- [Web API Security](https://owasp.org/www-community/attacks/csrf)
