import logger from '../utils/logger';

/**
 * PaymentService - Handles POS payment operations
 * 
 * Features:
 * - Partial and full payment support
 * - Backend balance calculation
 * - Double submission prevention (idempotency keys)
 * - Backend-confirmed payment status
 * - Payment retry logic
 */
class PaymentService {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.pendingPayments = new Map(); // Track in-flight payments
    this.completedPayments = new Map(); // Track completed payments (for deduplication)
    this.paymentTimeout = 30000; // 30 second timeout
    logger.info('PaymentService initialized');
  }

  /**
   * Submit payment to backend
   * 
   * @param {Object} paymentData - Payment information
   * @param {string} paymentData.orderId - Order ID
   * @param {number} paymentData.amount - Payment amount
   * @param {string} paymentData.method - Payment method (cash, card, etc.)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Backend response with payment confirmation
   */
  async submitPayment(paymentData, options = {}) {
    const idempotencyKey = options.idempotencyKey || this._generateIdempotencyKey(paymentData);
    
    try {
      // Check for duplicate submission
      if (this.pendingPayments.has(idempotencyKey)) {
        logger.warn(`Duplicate payment submission detected: ${idempotencyKey}`);
        return this.pendingPayments.get(idempotencyKey);
      }

      if (this.completedPayments.has(idempotencyKey)) {
        logger.info(`Payment already completed: ${idempotencyKey}`);
        return this.completedPayments.get(idempotencyKey);
      }

      // Validate payment data
      this._validatePaymentData(paymentData);

      // Create pending promise
      const pendingPromise = this._executePayment(paymentData, idempotencyKey, options);
      this.pendingPayments.set(idempotencyKey, pendingPromise);

      // Execute payment
      const result = await pendingPromise;

      // Store completed payment
      this.completedPayments.set(idempotencyKey, result);

      // Clean up pending
      this.pendingPayments.delete(idempotencyKey);

      return result;
    } catch (error) {
      this.pendingPayments.delete(idempotencyKey);
      logger.error('Payment submission failed:', error);
      throw error;
    }
  }

  /**
   * Execute payment with retry logic
   * @private
   */
  async _executePayment(paymentData, idempotencyKey, options = {}) {
    const maxRetries = options.maxRetries || 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Payment attempt ${attempt}/${maxRetries}:`, {
          orderId: paymentData.orderId,
          amount: paymentData.amount,
          method: paymentData.method,
        });

        const response = await this._sendPaymentRequest(paymentData, idempotencyKey, {
          attempt,
          maxRetries,
        });

        logger.info('Payment successful:', {
          paymentId: response.paymentId,
          status: response.status,
          balanceRemaining: response.balanceRemaining,
        });

        return response;
      } catch (error) {
        lastError = error;
        logger.warn(`Payment attempt ${attempt} failed:`, error.message);

        // Don't retry on validation errors
        if (error.code === 'VALIDATION_ERROR' || error.code === 'PAYMENT_DECLINED') {
          throw error;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Payment failed after maximum retries');
  }

  /**
   * Send payment request to backend
   * @private
   */
  async _sendPaymentRequest(paymentData, idempotencyKey, metadata = {}) {
    try {
      const response = await this.apiClient.post('/payments/submit', {
        orderId: paymentData.orderId,
        amount: paymentData.amount,
        method: paymentData.method,
        reference: paymentData.reference,
        metadata: paymentData.metadata,
      }, {
        headers: {
          'Idempotency-Key': idempotencyKey,
          'X-Retry-Attempt': metadata.attempt || 1,
        },
        timeout: this.paymentTimeout,
      });

      // Validate backend response
      if (!response.paymentId) {
        throw new Error('Invalid payment response from backend');
      }

      return {
        paymentId: response.paymentId,
        orderId: response.orderId,
        amount: response.amount,
        method: response.method,
        status: response.status, // 'pending', 'completed', 'failed'
        balanceRemaining: response.balanceRemaining || 0,
        totalPaid: response.totalPaid || response.amount,
        timestamp: response.timestamp,
        reference: response.reference,
      };
    } catch (error) {
      const paymentError = new Error(error.message);
      paymentError.code = error.code || 'PAYMENT_ERROR';
      paymentError.status = error.status;
      throw paymentError;
    }
  }

  /**
   * Get payment balance for order
   * 
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Balance information from backend
   */
  async getPaymentBalance(orderId) {
    try {
      const response = await this.apiClient.get(`/payments/balance/${orderId}`, {
        timeout: 10000,
      });

      return {
        orderId: response.orderId,
        totalAmount: response.totalAmount,
        totalPaid: response.totalPaid || 0,
        balanceRemaining: response.balanceRemaining || response.totalAmount,
        payments: response.payments || [],
        status: response.status, // 'unpaid', 'partial', 'paid'
      };
    } catch (error) {
      logger.error('Failed to get payment balance:', error);
      throw error;
    }
  }

  /**
   * Confirm payment status with backend
   * 
   * @param {string} paymentId - Payment ID from previous submission
   * @returns {Promise<Object>} Confirmed payment status
   */
  async confirmPaymentStatus(paymentId) {
    try {
      const response = await this.apiClient.get(`/payments/${paymentId}/status`, {
        timeout: 10000,
      });

      return {
        paymentId: response.paymentId,
        orderId: response.orderId,
        status: response.status,
        amount: response.amount,
        balanceRemaining: response.balanceRemaining || 0,
        totalPaid: response.totalPaid,
        confirmedAt: response.confirmedAt,
      };
    } catch (error) {
      logger.error('Failed to confirm payment status:', error);
      throw error;
    }
  }

  /**
   * Handle partial payment
   * 
   * @param {string} orderId - Order ID
   * @param {number} partialAmount - Partial payment amount
   * @param {string} method - Payment method
   * @returns {Promise<Object>} Payment response with remaining balance
   */
  async submitPartialPayment(orderId, partialAmount, method) {
    try {
      // Get current balance
      const balance = await this.getPaymentBalance(orderId);

      if (partialAmount > balance.balanceRemaining) {
        const error = new Error(
          `Partial amount (${partialAmount}) exceeds balance (${balance.balanceRemaining})`
        );
        error.code = 'AMOUNT_EXCEEDS_BALANCE';
        throw error;
      }

      if (partialAmount <= 0) {
        const error = new Error('Partial amount must be greater than zero');
        error.code = 'INVALID_AMOUNT';
        throw error;
      }

      // Submit partial payment
      return await this.submitPayment({
        orderId,
        amount: partialAmount,
        method,
      }, {
        idempotencyKey: `partial-${orderId}-${partialAmount}-${Date.now()}`,
      });
    } catch (error) {
      logger.error('Partial payment failed:', error);
      throw error;
    }
  }

  /**
   * Submit full payment for remaining balance
   * 
   * @param {string} orderId - Order ID
   * @param {string} method - Payment method
   * @returns {Promise<Object>} Payment response
   */
  async submitFullPayment(orderId, method) {
    try {
      // Get current balance
      const balance = await this.getPaymentBalance(orderId);

      if (balance.balanceRemaining <= 0) {
        const error = new Error('Order is already fully paid');
        error.code = 'ALREADY_PAID';
        throw error;
      }

      // Submit full payment
      return await this.submitPayment({
        orderId,
        amount: balance.balanceRemaining,
        method,
      }, {
        idempotencyKey: `full-${orderId}-${Date.now()}`,
      });
    } catch (error) {
      logger.error('Full payment failed:', error);
      throw error;
    }
  }

  /**
   * Check if order is fully paid
   * 
   * @param {string} orderId - Order ID
   * @returns {Promise<boolean>} True if fully paid
   */
  async isOrderPaid(orderId) {
    try {
      const balance = await this.getPaymentBalance(orderId);
      return balance.balanceRemaining <= 0;
    } catch (error) {
      logger.error('Failed to check payment status:', error);
      throw error;
    }
  }

  /**
   * Get payment history for order
   * 
   * @param {string} orderId - Order ID
   * @returns {Promise<Array>} Array of payment records
   */
  async getPaymentHistory(orderId) {
    try {
      const response = await this.apiClient.get(`/payments/history/${orderId}`, {
        timeout: 10000,
      });

      return response.payments || [];
    } catch (error) {
      logger.error('Failed to get payment history:', error);
      throw error;
    }
  }

  /**
   * Validate payment data
   * @private
   */
  _validatePaymentData(paymentData) {
    if (!paymentData.orderId) {
      const error = new Error('orderId is required');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    if (!paymentData.amount || paymentData.amount <= 0) {
      const error = new Error('amount must be greater than zero');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    if (!paymentData.method) {
      const error = new Error('method is required');
      error.code = 'VALIDATION_ERROR';
      throw error;
    }
  }

  /**
   * Generate idempotency key for deduplication
   * @private
   */
  _generateIdempotencyKey(paymentData) {
    const key = `${paymentData.orderId}-${paymentData.amount}-${paymentData.method}-${Date.now()}`;
    return Buffer.from(key).toString('base64');
  }

  /**
   * Clear completed payment cache (for testing/cleanup)
   */
  clearCache() {
    this.completedPayments.clear();
    this.pendingPayments.clear();
    logger.info('Payment cache cleared');
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      pendingPayments: this.pendingPayments.size,
      completedPayments: this.completedPayments.size,
      cacheSize: this.pendingPayments.size + this.completedPayments.size,
    };
  }
}

export default PaymentService;
