const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');

app.disableHardwareAcceleration(); // 🔥 FIX GPU crash

let mainWindow;
let authToken = null;
let cachedUser = null;

const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api/v1';

const extractAuthPayload = (data) => {
  if (!data) return { user: null, token: null };

  const token = data.token || data.access_token || data.data?.token || data.data?.access_token || null;
  const user = data.user || data.data?.user || data.data?.data?.user || data.data || null;

  return { user, token };
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    // In development, wait a moment for React dev server to start
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
    
    // Retry loading if connection is refused (dev server not ready)
    mainWindow.webContents.on('did-fail-load', () => {
      console.log('[Electron] Dev server not ready, retrying in 2 seconds...');
      setTimeout(() => {
        mainWindow.loadURL('http://localhost:3000');
      }, 2000);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }
}

/**
 * ================================
 * IPC HANDLERS
 * ================================
 */

// Auth: Login
ipcMain.handle('auth:login', async (_event, credentials) => {
  try {
    console.log('[IPC] Login attempt for:', credentials.email || credentials.username);

    const response = await axios.post(`${apiUrl}/auth/login`, credentials, {
      timeout: 10000,
    });

    console.log('[IPC] Login successful');
    console.log('[IPC] Login response data:', JSON.stringify(response.data, null, 2));

    const { user, token } = extractAuthPayload(response.data);
    if (!user) {
      throw new Error('Login succeeded but user data is missing');
    }

    console.log('[IPC] Extracted user:', JSON.stringify(user, null, 2));
    console.log('[IPC] User roles:', user.roles, 'User role:', user.role);

    if (token) {
      authToken = token;
    }
    cachedUser = user;

    return {
      success: true,
      user,
      token: token || null,
    };
  } catch (error) {
    console.error('[IPC] Login failed:', error.message);
    throw new Error(error.response?.data?.message || 'Login failed');
  }
});

// Auth: Logout
ipcMain.handle('auth:logout', async () => {
  try {
    console.log('[IPC] Logout request');

    if (authToken) {
      await axios.post(`${apiUrl}/auth/logout`, null, {
        timeout: 10000,
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
    }

    authToken = null;
    cachedUser = null;

    console.log('[IPC] Logout successful');

    return {
      success: true,
      message: 'Logged out successfully',
    };
  } catch (error) {
    console.error('[IPC] Logout failed:', error.message);
    authToken = null;
    cachedUser = null;
    return {
      success: false,
      error: error.message,
    };
  }
});

// Auth: Get current user
ipcMain.handle('auth:getCurrentUser', async () => {
  try {
    if (!authToken) {
      return cachedUser;
    }

    const response = await axios.get(`${apiUrl}/auth/me`, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    const { user } = extractAuthPayload(response.data);
    cachedUser = user || null;
    return cachedUser;
  } catch (error) {
    console.error('Failed to get current user:', error.message);
    return null;
  }
});

// Health check handler
ipcMain.handle('health:check', async () => {
  try {
    console.log('[IPC] Health check - calling:', `${apiUrl}/health`);
    
    const response = await axios.get(`${apiUrl}/health`, {
      timeout: 5000,
      validateStatus: (status) => status < 500, // Accept any status < 500
    });
    
    console.log('[IPC] Health check response:', response.status, response.data);
    
    return {
      ok: response.status === 200,
      status: response.status,
      data: response.data,
    };
  } catch (error) {
    console.log('[IPC] Health check failed:', error.message);
    return {
      ok: false,
      status: error.response?.status || 0,
      error: error.message,
    };
  }
});

// Products: Get All
ipcMain.handle('products:getAll', async (_event, params) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.get(`${apiUrl}/products`, {
      params: params || {},
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    console.log('[IPC] Products response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('[IPC] Get products failed:', error.message);
    console.error('[IPC] Error response status:', error.response?.status);
    console.error('[IPC] Error response data:', JSON.stringify(error.response?.data, null, 2));
    console.error('[IPC] Full error:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch products');
  }
});

// Products: Quick Search
ipcMain.handle('products:quickSearch', async (_event, query) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.get(`${apiUrl}/products/search/quick`, {
      params: { q: query },
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    console.log('[IPC] Quick search response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('[IPC] Quick search failed:', error.message);
    console.error('[IPC] Error response:', error.response?.data);
    throw new Error(error.response?.data?.message || 'Failed to search products');
  }
});

// Products: Get By ID
ipcMain.handle('products:getById', async (_event, id) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.get(`${apiUrl}/products/${id}`, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Get product failed:', error.message);
    throw new Error(error.response?.data?.message || 'Failed to fetch product');
  }
});

// Products: Create
ipcMain.handle('products:create', async (_event, product) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.post(`${apiUrl}/products`, product, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Create product failed:', error.message);
    throw new Error(error.response?.data?.message || 'Failed to create product');
  }
});

// Products: Update
ipcMain.handle('products:update', async (_event, id, product) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.put(`${apiUrl}/products/${id}`, product, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Update product failed:', error.message);
    throw new Error(error.response?.data?.message || 'Failed to update product');
  }
});

// Products: Delete
ipcMain.handle('products:delete', async (_event, id) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.delete(`${apiUrl}/products/${id}`, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Delete product failed:', error.message);
    throw new Error(error.response?.data?.message || 'Failed to delete product');
  }
});

// Products: Toggle Status
ipcMain.handle('products:toggleStatus', async (_event, id) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.patch(`${apiUrl}/products/${id}/toggle-status`, {}, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Toggle product status failed:', error.message);
    throw new Error(error.response?.data?.message || 'Failed to toggle product status');
  }
});

// Categories: Get All
ipcMain.handle('categories:getAll', async (_event, params) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.get(`${apiUrl}/categories`, {
      params: params || {},
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Get categories failed:', error.message);
    throw new Error(error.response?.data?.message || 'Failed to fetch categories');
  }
});

// Categories: Get By ID
ipcMain.handle('categories:getById', async (_event, id) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.get(`${apiUrl}/categories/${id}`, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Get category failed:', error.message);
    throw new Error(error.response?.data?.message || 'Failed to fetch category');
  }
});

// Categories: Create
ipcMain.handle('categories:create', async (_event, category) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.post(`${apiUrl}/categories`, category, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Create category failed:', error.message);
    throw new Error(error.response?.data?.message || 'Failed to create category');
  }
});

// Categories: Update
ipcMain.handle('categories:update', async (_event, id, category) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.put(`${apiUrl}/categories/${id}`, category, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Update category failed:', error.message);
    throw new Error(error.response?.data?.message || 'Failed to update category');
  }
});

// Categories: Delete
ipcMain.handle('categories:delete', async (_event, id) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.delete(`${apiUrl}/categories/${id}`, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Delete category failed:', error.message);
    throw new Error(error.response?.data?.message || 'Failed to delete category');
  }
});

// Orders: Create Order
ipcMain.handle('orders:create', async (_event, order) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.post(`${apiUrl}/orders`, order, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Create order failed:', error.message);
    
    // Enhanced error handling for network issues
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new Error('Cannot connect to server. Please check your network connection.');
    }
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      throw new Error('Request timed out. The server is not responding.');
    }
    
    throw new Error(error.response?.data?.message || 'Failed to create order');
  }
});

// Orders: List Orders
ipcMain.handle('orders:getAll', async (_event, params) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.get(`${apiUrl}/orders`, {
      params: params || {},
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('[IPC] List orders failed:', error.message);
    if (error.response) {
      console.error('[IPC] API Response Status:', error.response.status);
      console.error('[IPC] API Response Data:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Enhanced error handling for network issues
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new Error('Cannot connect to server. Please check your network connection.');
    }
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      throw new Error('Request timed out. The server is not responding.');
    }
    
    throw new Error(error.response?.data?.message || 'Failed to fetch orders');
  }
});

// Orders: Get Order
ipcMain.handle('orders:getById', async (_event, id) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.get(`${apiUrl}/orders/${id}`, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Get order failed:', error.message);
    throw new Error(error.response?.data?.message || 'Failed to fetch order');
  }
});

// Orders: Complete Order
ipcMain.handle('orders:complete', async (_event, id) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.post(`${apiUrl}/orders/${id}/complete`, {}, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Complete order failed:', error.message);
    throw new Error(error.response?.data?.message || 'Failed to complete order');
  }
});

// Orders: Quick Checkout (Single API call for complete order)
ipcMain.handle('orders:quickCheckout', async (_event, orderData) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.post(`${apiUrl}/quick-checkout`, orderData, {
      timeout: 15000,
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[IPC] Quick checkout response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('[IPC] Quick checkout failed:', error.message);
    console.error('[IPC] Error response:', error.response?.data);
    throw new Error(error.response?.data?.message || 'Failed to complete quick checkout');
  }
});

// Orders: Cancel Order
ipcMain.handle('orders:cancel', async (_event, id) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.post(`${apiUrl}/orders/${id}/cancel`, {}, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Cancel order failed:', error.message);
    throw new Error(error.response?.data?.message || 'Failed to cancel order');
  }
});

// Orders: Add Item to Order
ipcMain.handle('orders:addItem', async (_event, orderId, item) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.post(`${apiUrl}/orders/${orderId}/items`, item, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Add item to order failed:', error.message);
    throw new Error(error.response?.data?.message || 'Failed to add item to order');
  }
});

// Orders: Remove Item from Order
ipcMain.handle('orders:removeItem', async (_event, orderId, itemId) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.delete(`${apiUrl}/orders/${orderId}/items/${itemId}`, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Remove item from order failed:', error.message);
    throw new Error(error.response?.data?.message || 'Failed to remove item from order');
  }
});

// Orders: Quick Add Item
ipcMain.handle('orders:quickAddItem', async (_event, orderId, item) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.post(`${apiUrl}/orders/${orderId}/add-item`, item, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Quick add item failed:', error.message);
    throw new Error(error.response?.data?.message || 'Failed to quick add item');
  }
});

// Orders: Quick Pay
ipcMain.handle('orders:quickPay', async (_event, orderId, paymentData) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.post(`${apiUrl}/orders/${orderId}/quick-pay`, paymentData, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Quick pay failed:', error.message);
    throw new Error(error.response?.data?.message || 'Failed to process payment');
  }
});

// Orders: Get Order Summary
ipcMain.handle('orders:getSummary', async (_event, orderId) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.get(`${apiUrl}/orders/${orderId}/summary`, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Get order summary failed:', error.message);
    throw new Error(error.response?.data?.message || 'Failed to fetch order summary');
  }
});

// Orders: Get Payments
ipcMain.handle('orders:getPayments', async (_event, orderId) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.get(`${apiUrl}/orders/${orderId}/payments`, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Get payments failed:', error.message);
    throw new Error(error.response?.data?.message || 'Failed to fetch payments');
  }
});

// Orders: Get Payments Summary
ipcMain.handle('orders:getPaymentsSummary', async (_event, orderId) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.get(`${apiUrl}/orders/${orderId}/payments/summary`, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Get payments summary failed:', error.message);
    throw new Error(error.response?.data?.message || 'Failed to fetch payments summary');
  }
});

// Orders: Refund Payment
ipcMain.handle('orders:refundPayment', async (_event, orderId, refundData) => {
  try {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const response = await axios.post(`${apiUrl}/orders/${orderId}/payments/refund`, refundData, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('[IPC] Refund payment failed:', error.message);
    
    // Enhanced error handling for network issues
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new Error('Cannot connect to server. Please check your network connection.');
    }
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      throw new Error('Request timed out. The server is not responding.');
    }
    
    throw new Error(error.response?.data?.message || 'Failed to process refund');
  }
});

/**
 * ================================
 * APP LIFECYCLE
 * ================================
 */

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
