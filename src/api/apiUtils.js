/**
 * API Utilities
 * Common helper functions for API operations, error handling, and data transformation
 */

/**
 * Format API response to consistent structure
 */
export const formatApiResponse = (response) => {
  return {
    success: true,
    data: response.data || response,
    status: response.status || 200,
    timestamp: new Date().toISOString()
  };
};

/**
 * Format API error to consistent structure
 */
export const formatApiError = (error, defaultMessage = 'An error occurred') => {
  const status = error.status || error.response?.status || 500;
  const message = error.message || error.response?.data?.message || defaultMessage;
  
  return {
    success: false,
    error: message,
    status,
    data: error.response?.data || error.data || null,
    timestamp: new Date().toISOString(),
    details: {
      isAuthError: status === 401 || status === 403,
      isServerError: status >= 500,
      isClientError: status >= 400 && status < 500,
      isNetworkError: status === 0
    }
  };
};

/**
 * Retry failed API request with exponential backoff
 */
export const retryRequest = async (
  requestFn,
  maxRetries = 3,
  initialDelay = 1000,
  backoffMultiplier = 2
) => {
  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      
      // Don't retry authentication errors
      if (error.status === 401 || error.status === 403) {
        throw error;
      }

      // Don't retry client errors (except 429 - too many requests)
      if (error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw error;
      }

      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= backoffMultiplier;
    }
  }

  throw lastError;
};

/**
 * Build query string from parameters object
 */
export const buildQueryString = (params) => {
  if (!params || Object.keys(params).length === 0) {
    return '';
  }

  const queryParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(v => queryParams.append(key, v));
      } else {
        queryParams.set(key, value);
      }
    }
  });

  return queryParams.toString();
};

/**
 * Parse pagination information from response
 */
export const parsePagination = (response) => {
  return {
    total: response.total || response.count || 0,
    page: response.page || 1,
    pageSize: response.pageSize || response.limit || 10,
    totalPages: response.totalPages || Math.ceil((response.total || 0) / (response.pageSize || 10)),
    hasMore: response.hasMore || (response.page < response.totalPages)
  };
};

/**
 * Create a timeout promise that rejects after specified time
 */
export const createTimeout = (ms, message = 'Request timeout') => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
};

/**
 * Race between a request and a timeout
 */
export const withTimeout = async (requestPromise, timeoutMs = 30000) => {
  return Promise.race([
    requestPromise,
    createTimeout(timeoutMs)
  ]);
};

/**
 * Create abort controller with timeout
 */
export const createAbortWithTimeout = (timeoutMs = 30000) => {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
  
  return {
    signal: abortController.signal,
    abort: () => {
      clearTimeout(timeoutId);
      abortController.abort();
    },
    isAborted: () => abortController.signal.aborted
  };
};

/**
 * Batch multiple API requests and handle errors gracefully
 */
export const batchRequests = async (requests) => {
  const results = await Promise.allSettled(requests);
  
  return {
    successful: results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value),
    failed: results
      .filter(r => r.status === 'rejected')
      .map((r, i) => ({ index: i, error: r.reason })),
    allSuccessful: results.every(r => r.status === 'fulfilled')
  };
};

/**
 * Transform and validate API response data
 */
export const validateAndTransform = (data, schema) => {
  if (!schema) return data;

  const errors = [];
  const transformed = {};

  Object.entries(schema).forEach(([key, validator]) => {
    const value = data[key];
    
    try {
      if (validator.required && (value === null || value === undefined)) {
        errors.push(`Field '${key}' is required`);
      } else if (value !== null && value !== undefined) {
        if (validator.type) {
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          if (actualType !== validator.type) {
            errors.push(`Field '${key}' must be of type ${validator.type}`);
          }
        }
        
        if (validator.validator && !validator.validator(value)) {
          errors.push(`Field '${key}' validation failed`);
        }

        transformed[key] = validator.transform ? validator.transform(value) : value;
      }
    } catch (error) {
      errors.push(`Field '${key}': ${error.message}`);
    }
  });

  if (errors.length > 0) {
    const error = new Error(`Validation failed: ${errors.join(', ')}`);
    error.validationErrors = errors;
    throw error;
  }

  return transformed;
};

/**
 * Create a simple request cache
 */
export const createRequestCache = (ttlMs = 60000) => {
  const cache = new Map();

  return {
    get: (key) => {
      const entry = cache.get(key);
      if (!entry) return null;

      if (Date.now() - entry.timestamp > ttlMs) {
        cache.delete(key);
        return null;
      }

      return entry.value;
    },
    set: (key, value) => {
      cache.set(key, {
        value,
        timestamp: Date.now()
      });
    },
    clear: () => cache.clear(),
    delete: (key) => cache.delete(key),
    has: (key) => {
      const entry = cache.get(key);
      return entry && (Date.now() - entry.timestamp <= ttlMs);
    }
  };
};

/**
 * Merge multiple error messages from different sources
 */
export const mergeErrors = (errors) => {
  if (!errors) return '';
  
  if (typeof errors === 'string') return errors;
  if (Array.isArray(errors)) return errors.join('; ');
  if (typeof errors === 'object') {
    return Object.values(errors)
      .flat()
      .join('; ');
  }
  
  return 'Unknown error';
};

/**
 * Check if error is due to network connectivity
 */
export const isNetworkError = (error) => {
  if (error.name === 'AbortError') return true;
  if (error.message === 'Failed to fetch') return true;
  if (error.status === 0) return true;
  
  return false;
};

/**
 * Check if error should trigger automatic retry
 */
export const shouldRetry = (error, retryCount = 0, maxRetries = 3) => {
  // Don't retry if max retries exceeded
  if (retryCount >= maxRetries) return false;

  // Don't retry auth errors
  if (error.status === 401 || error.status === 403) return false;

  // Retry network errors, server errors, and rate limiting
  return isNetworkError(error) || error.status >= 500 || error.status === 429;
};

export default {
  formatApiResponse,
  formatApiError,
  retryRequest,
  buildQueryString,
  parsePagination,
  createTimeout,
  withTimeout,
  createAbortWithTimeout,
  batchRequests,
  validateAndTransform,
  createRequestCache,
  mergeErrors,
  isNetworkError,
  shouldRetry
};
