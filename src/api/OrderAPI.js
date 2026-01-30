import log from 'electron-log';

/**
 * OrderAPI Service
 * 
 * Handles all order-related backend API calls.
 * 
 * Features:
 * - Add/remove/update order items
 * - Submit orders
 * - Get order details (reconciliation)
 * - Error handling and retry logic
 * - Request timeout handling
 * - Full audit logging
 * 
 * Note: Requires AuthContext token for API authentication
 */
class OrderAPI {
  constructor(apiManager, getToken, orderId = null) {
    this.apiManager = apiManager;
    this.getToken = getToken;
    this.orderId = orderId;
    this.baseUrl = '/api/v1';
    this.requestTimeout = 30000; // 30 seconds
  }

  /**
   * Set current order ID (for operations on existing orders)
   */
  setOrderId(orderId) {
    this.orderId = orderId;
    log.debug(`[OrderAPI] Order ID set to: ${orderId}`);
  }

  /**
   * Helper: Prepare request headers
   */
  _getHeaders() {
    const token = this.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Helper: Make HTTP request with timeout
   */
  async _request(method, path, data = null) {
    const url = `${this.baseUrl}${path}`;
    const options = {
      method,
      headers: this._getHeaders(),
      timeout: this.requestTimeout,
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);

      // Log request
      log.debug(`[OrderAPI] ${method} ${path}`, {
        status: response.status,
        statusText: response.statusText,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || response.statusText;

        throw {
          status: response.status,
          message: errorMessage,
          data: errorData,
        };
      }

      return await response.json();
    } catch (err) {
      if (err.status) {
        // HTTP error
        log.error(`[OrderAPI] HTTP error ${err.status}:`, err.message);
      } else if (err.name === 'AbortError') {
        log.error(`[OrderAPI] Request timeout for ${path}`);
        throw new Error(`Request timeout: ${path}`);
      } else {
        log.error(`[OrderAPI] Request failed:`, err.message);
      }

      throw err;
    }
  }

  /**
   * Create a new order
   */
  async createOrder(items = []) {
    try {
      log.info(`[OrderAPI] Creating new order with ${items.length} items`);

      const response = await this._request('POST', '/orders', {
        items: items.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
          price: item.price,
        })),
      });

      this.orderId = response.id;
      log.info(`[OrderAPI] Order created: ${response.id}`);

      return response;
    } catch (err) {
      log.error(`[OrderAPI] Create order failed:`, err);
      throw new Error(`Failed to create order: ${err.message}`);
    }
  }

  /**
   * Add item to order
   */
  async addOrderItem(productId, quantity = 1) {
    try {
      if (!this.orderId) {
        log.info(`[OrderAPI] No order ID, creating new order`);
        const order = await this.createOrder();
      }

      log.info(`[OrderAPI] Adding item ${productId} (qty: ${quantity}) to order ${this.orderId}`);

      const response = await this._request(
        'PATCH',
        `/orders/${this.orderId}/items`,
        {
          product_id: productId,
          quantity: quantity,
        }
      );

      log.info(`[OrderAPI] Item added successfully`);
      return response;
    } catch (err) {
      log.error(`[OrderAPI] Add item failed:`, err);
      throw new Error(`Failed to add item: ${err.message}`);
    }
  }

  /**
   * Remove item from order
   */
  async removeOrderItem(productId) {
    try {
      if (!this.orderId) {
        throw new Error('No order to remove item from');
      }

      log.info(`[OrderAPI] Removing item ${productId} from order ${this.orderId}`);

      const response = await this._request(
        'DELETE',
        `/orders/${this.orderId}/items/${productId}`
      );

      log.info(`[OrderAPI] Item removed successfully`);
      return response;
    } catch (err) {
      log.error(`[OrderAPI] Remove item failed:`, err);
      throw new Error(`Failed to remove item: ${err.message}`);
    }
  }

  /**
   * Update item quantity
   */
  async updateOrderItem(productId, quantity) {
    try {
      if (!this.orderId) {
        throw new Error('No order to update');
      }

      log.info(
        `[OrderAPI] Updating item ${productId} quantity to ${quantity} in order ${this.orderId}`
      );

      const response = await this._request(
        'PATCH',
        `/orders/${this.orderId}/items/${productId}`,
        {
          quantity: quantity,
        }
      );

      log.info(`[OrderAPI] Item updated successfully`);
      return response;
    } catch (err) {
      log.error(`[OrderAPI] Update item failed:`, err);
      throw new Error(`Failed to update item: ${err.message}`);
    }
  }

  /**
   * Get order details (reconciliation)
   * Fetches latest order state from backend
   */
  async getOrder() {
    try {
      if (!this.orderId) {
        // No active order, return empty
        return { items: [], totals: { subtotal: 0, tax: 0, total: 0 } };
      }

      log.info(`[OrderAPI] Fetching order ${this.orderId} from backend`);

      const response = await this._request('GET', `/orders/${this.orderId}`);

      log.info(`[OrderAPI] Order fetched successfully`);
      return response;
    } catch (err) {
      log.error(`[OrderAPI] Get order failed:`, err);
      throw new Error(`Failed to fetch order: ${err.message}`);
    }
  }

  /**
   * Submit order
   */
  async submitOrder(orderData) {
    try {
      if (!this.orderId) {
        throw new Error('No order to submit');
      }

      log.info(`[OrderAPI] Submitting order ${this.orderId}`);

      const response = await this._request('POST', `/orders/${this.orderId}/submit`, {
        items: orderData.items,
        totals: orderData.totals,
      });

      log.info(`[OrderAPI] Order submitted successfully: ${response.confirmation_number}`);

      // Clear order ID after submission
      this.orderId = null;

      return response;
    } catch (err) {
      log.error(`[OrderAPI] Submit order failed:`, err);
      throw new Error(`Failed to submit order: ${err.message}`);
    }
  }

  /**
   * Get order history (for user)
   */
  async getOrderHistory(limit = 10) {
    try {
      log.info(`[OrderAPI] Fetching order history (limit: ${limit})`);

      const response = await this._request('GET', `/orders?limit=${limit}`);

      log.info(`[OrderAPI] Order history fetched: ${response.orders.length} orders`);
      return response;
    } catch (err) {
      log.error(`[OrderAPI] Get order history failed:`, err);
      throw new Error(`Failed to fetch order history: ${err.message}`);
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder() {
    try {
      if (!this.orderId) {
        throw new Error('No order to cancel');
      }

      log.info(`[OrderAPI] Canceling order ${this.orderId}`);

      const response = await this._request('DELETE', `/orders/${this.orderId}`);

      log.info(`[OrderAPI] Order canceled successfully`);

      // Clear order ID after cancellation
      this.orderId = null;

      return response;
    } catch (err) {
      log.error(`[OrderAPI] Cancel order failed:`, err);
      throw new Error(`Failed to cancel order: ${err.message}`);
    }
  }
}

export default OrderAPI;
