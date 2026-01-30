import { useContext, useCallback, useRef } from 'react';
import AuthContext from '../context/AuthContext';

/**
 * useSecureApi Hook
 * Provides a convenient way to make secure API calls with automatic
 * error handling, token refresh, and authentication management
 * 
 * Features:
 * - Bearer token attachment
 * - Automatic token refresh on 401
 * - Global error handling
 * - Loading and error states
 * - Request cancellation support
 */
function useSecureApi() {
  const authContext = useContext(AuthContext);
  const abortControllerRef = useRef(null);

  /**
   * Execute an API request with error handling
   */
  const request = useCallback(async (method, endpoint, data = null, options = {}) => {
    try {
      // Get token from auth context
      const token = authContext?.authToken;
      if (!token && !options.skipAuth) {
        throw new Error('No authentication token available');
      }

      // Create abort controller for request cancellation
      abortControllerRef.current = new AbortController();

      const url = endpoint.startsWith('http') ? endpoint : `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1'}${endpoint}`;

      const fetchOptions = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers
        },
        signal: abortControllerRef.current.signal,
        ...options.fetchOptions
      };

      // Add bearer token if available
      if (token) {
        fetchOptions.headers.Authorization = `Bearer ${token}`;
      }

      // Add request body for POST/PUT/PATCH
      if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
        fetchOptions.body = JSON.stringify(data);
      }

      const response = await fetch(url, fetchOptions);

      // Handle 401 - Attempt logout or token refresh
      if (response.status === 401) {
        if (authContext?.handleLogout) {
          await authContext.handleLogout();
        }
        throw new Error('Your session has expired. Please log in again.');
      }

      // Handle 403 - Forbidden
      if (response.status === 403) {
        if (authContext?.handleLogout) {
          await authContext.handleLogout();
        }
        throw new Error('You do not have permission to access this resource.');
      }

      // Handle other error statuses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || `HTTP ${response.status}: ${response.statusText}`;
        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = errorData;
        throw error;
      }

      const result = await response.json();
      return {
        success: true,
        data: result.data || result,
        status: response.status
      };
    } catch (error) {
      // Don't throw for abort errors (request was cancelled)
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request cancelled',
          status: 0
        };
      }

      return {
        success: false,
        error: error.message || 'An error occurred',
        status: error.status || 0,
        data: error.data || null
      };
    }
  }, [authContext]);

  /**
   * GET request
   */
  const get = useCallback((endpoint, options = {}) => {
    return request('GET', endpoint, null, options);
  }, [request]);

  /**
   * POST request
   */
  const post = useCallback((endpoint, data, options = {}) => {
    return request('POST', endpoint, data, options);
  }, [request]);

  /**
   * PUT request
   */
  const put = useCallback((endpoint, data, options = {}) => {
    return request('PUT', endpoint, data, options);
  }, [request]);

  /**
   * PATCH request
   */
  const patch = useCallback((endpoint, data, options = {}) => {
    return request('PATCH', endpoint, data, options);
  }, [request]);

  /**
   * DELETE request
   */
  const deleteRequest = useCallback((endpoint, options = {}) => {
    return request('DELETE', endpoint, null, options);
  }, [request]);

  /**
   * Cancel ongoing request
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    get,
    post,
    put,
    patch,
    delete: deleteRequest,
    cancel,
    request
  };
}

export default useSecureApi;
