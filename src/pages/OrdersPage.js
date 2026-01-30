import React, { useState, useCallback, useEffect, useRef } from 'react';
import log from '../utils/logger';
/* eslint-disable react-hooks/rules-of-hooks */
import BarcodeSearch from '../components/BarcodeSearch';
import { useOrder } from '../context/OrderContext';
import usePOSKeyboard from '../hooks/usePOSKeyboard';
import POSKeyboardService from '../services/POSKeyboardService';
import { usePaymentFlow } from '../hooks/usePaymentFlow';
import useSecureApi from '../hooks/useSecureApi';
import { useReceiptFlow } from '../hooks/useReceiptFlow';
import ReceiptService from '../services/ReceiptService';
import OfflineService from '../services/OfflineService';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { useErrorHandler, ErrorBoundary } from '../hooks/useErrorHandler';
import { ErrorModal, ErrorBanner } from '../components/ErrorDisplay';
import ErrorLogger from '../services/ErrorLogger';
import '../styles/OrdersPage.css';
import '../styles/OrderState.css';
import '../styles/Payment.css';
import '../styles/Receipt.css';
import '../styles/OfflineModeBanner.css';
import '../styles/ErrorDisplay.css';

function OrdersPageContent() {
  const orderState = useOrder();
  const { apiClient } = useSecureApi();
  
  const [lastError, setLastError] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [showPaymentPanel, setShowPaymentPanel] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptOrderId, setReceiptOrderId] = useState(null);
  
  const barcodeInputRef = useRef(null);
  const keyboardServiceRef = useRef(null);
  const receiptServiceRef = useRef(null);
  const offlineServiceRef = useRef(null);
  const errorLoggerRef = useRef(null);

  // Initialize error logger
  if (!errorLoggerRef.current && apiClient) {
    errorLoggerRef.current = new ErrorLogger(apiClient);
  }

  // Initialize receipt service
  if (!receiptServiceRef.current && apiClient) {
    receiptServiceRef.current = new ReceiptService(apiClient);
  }

  // Initialize offline service
  if (!offlineServiceRef.current && apiClient) {
    offlineServiceRef.current = new OfflineService(apiClient);
  }
  
  const errorHandler = useErrorHandler(errorLoggerRef.current);

  // Initialize payment flow
  const paymentFlow = usePaymentFlow(apiClient, currentOrderId);

  // Initialize receipt service
  const receiptFlow = useReceiptFlow(receiptServiceRef.current, receiptOrderId);

  // Initialize offline service
  const offlineSync = useOfflineSync(offlineServiceRef.current);

  // Fallback if OrderProvider not available
  if (!orderState) {
    return (
      <div className="orders-page">
        <div className="orders-error-message">
          ⚠ Order state not available. Check OrderProvider configuration.
        </div>
      </div>
    );
  }

  const { order, addItem, removeItem, updateItemQuantity, submitOrder, clearOrder } = orderState;

  /**
   * Handle product found from barcode scan
   * Add product to order
   */
  const handleProductFound = useCallback(
    (product) => {
      log.info('[OrdersPage] Product found from barcode:', product);
      try {
        addItem(product);
        setLastError(null);
      } catch (err) {
        log.error('[OrdersPage] Error adding item:', err);
        setLastError(err.message);
      }
    },
    [addItem]
  );

  /**
   * Initialize keyboard service
   */
  useEffect(() => {
    if (!orderState) return;

    const service = new POSKeyboardService(
      orderState,
      { onScan: handleProductFound }
    );
    keyboardServiceRef.current = service;

    return () => {
      if (service) service.clear();
    };
  }, [orderState, handleProductFound]);

  /**
   * Setup keyboard handlers for POS
   */
  const handleEnterKey = useCallback(async () => {
    try {
      if (barcodeInputRef.current) {
        const barcode = barcodeInputRef.current.value || '';
        await keyboardServiceRef.current?.handleEnterKey(barcode);
        // Clear input
        if (barcodeInputRef.current) {
          barcodeInputRef.current.value = '';
        }
      }
    } catch (err) {
      log.warn('[OrdersPage] Enter key action failed:', err.message);
      setLastError(err.message);
    }
  }, []);

  const handleEscapeKey = useCallback(async () => {
    try {
      await keyboardServiceRef.current?.handleEscapeKey();
      setLastError(null);
    } catch (err) {
      log.warn('[OrdersPage] Escape key action failed:', err.message);
    }
  }, []);

  const handleDeleteKey = useCallback(async () => {
    try {
      await keyboardServiceRef.current?.handleDeleteKey();
      setLastError(null);
    } catch (err) {
      log.warn('[OrdersPage] Delete key action failed:', err.message);
    }
  }, []);

  const handleUndoKey = useCallback(async () => {
    try {
      await keyboardServiceRef.current?.handleUndoKey();
      setLastError(null);
    } catch (err) {
      log.warn('[OrdersPage] Undo key action failed:', err.message);
    }
  }, []);

  const handleClearOrderKey = useCallback(async () => {
    try {
      await keyboardServiceRef.current?.handleClearOrderKey();
      setLastError(null);
    } catch (err) {
      log.warn('[OrdersPage] Clear order key action failed:', err.message);
    }
  }, []);

  const handleNumericKey = useCallback(async (digit) => {
    return async () => {
      try {
        await keyboardServiceRef.current?.handleNumericKey(digit);
      } catch (err) {
        log.warn('[OrdersPage] Numeric key action failed:', err.message);
      }
    };
  }, []);

  const handlePlusKey = useCallback(async () => {
    try {
      await keyboardServiceRef.current?.handlePlusKey();
      setLastError(null);
    } catch (err) {
      log.warn('[OrdersPage] Plus key action failed:', err.message);
    }
  }, []);

  const handleMinusKey = useCallback(async () => {
    try {
      await keyboardServiceRef.current?.handleMinusKey();
      setLastError(null);
    } catch (err) {
      log.warn('[OrdersPage] Minus key action failed:', err.message);
    }
  }, []);

  const handleTabKey = useCallback(async (event) => {
    try {
      const isShift = event.shiftKey;
      const result = await keyboardServiceRef.current?.handleTabKey(isShift);
      if (result?.success && result?.selectedItem) {
        setSelectedItemId(result.selectedItem.id);
        keyboardServiceRef.current?.setSelectedItemId(result.selectedItem.id);
      }
      setLastError(null);
    } catch (err) {
      log.warn('[OrdersPage] Tab key action failed:', err.message);
    }
  }, []);

  const handleSubmitOrderKey = useCallback(async () => {
    try {
      setSubmitLoading(true);
      const result = await keyboardServiceRef.current?.handleSubmitOrder();
      if (result?.success) {
        setLastError(null);
        setSelectedItemId(null);
      }
    } catch (err) {
      log.warn('[OrdersPage] Submit order key action failed:', err.message);
      setLastError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  }, []);

  /**
   * Register POS keyboard shortcuts
   */
  usePOSKeyboard({
    enabled: true,
    onEnter: handleEnterKey,
    onEscape: handleEscapeKey,
    onDelete: handleDeleteKey,
    onCtrlZ: handleUndoKey,
    onCtrlDelete: handleClearOrderKey,
    onPlus: handlePlusKey,
    onMinus: handleMinusKey,
    onTab: handleTabKey,
    onQuantityInput: handleNumericKey,
  });

  /**
   * Handle product not found
   */
  const handleProductNotFound = useCallback((barcode) => {
    log.warn('[OrdersPage] No product found for barcode:', barcode);
    setLastError(`No product found with barcode: ${barcode}`);
  }, []);

  /**
   * Handle quantity change
   */
  const handleQuantityChange = useCallback(
    (productId, newQuantity) => {
      try {
        if (newQuantity === 0) {
          removeItem(productId);
        } else {
          updateItemQuantity(productId, newQuantity);
        }
        setLastError(null);
      } catch (err) {
        log.error('[OrdersPage] Error updating quantity:', err);
        setLastError(err.message);
      }
    },
    [updateItemQuantity, removeItem]
  );

  /**
   * Handle submit order
   */
  const handleSubmitOrder = useCallback(async () => {
    try {
      setSubmitLoading(true);
      log.info('[OrdersPage] Submitting order...');
      
      const result = await submitOrder();
      log.info('[OrdersPage] Order submitted successfully:', result);
      
      // Queue order in offline service
      if (result.orderId) {
        const actionId = await offlineSync.queueAction({
          type: 'order',
          data: {
            orderId: result.orderId,
            items: order.items,
            total: order.total,
            timestamp: new Date().toISOString()
          }
        }, { source: 'OrdersPage', userAction: 'submit_order' });
        
        log.info('[OrdersPage] Order queued for offline sync:', actionId);
        
        // Set current order for payment
        setCurrentOrderId(result.orderId);
        setShowPaymentPanel(true);
        // Fetch initial payment balance
        await paymentFlow.fetchBalance(result.orderId);
      }
      
      errorHandler.clearError();
    } catch (err) {
      log.error('[OrdersPage] Order submission failed:', err);
      errorHandler.handleError(err, 'handleSubmitOrder', { itemCount: order.items.length });
    } finally {
      setSubmitLoading(false);
    }
  }, [submitOrder, paymentFlow, offlineSync, order, errorHandler]);

  /**
   * Handle partial payment submission
   */
  const handlePartialPayment = useCallback(async () => {
    const amount = parseFloat(paymentAmount);
    
    if (!amount || amount <= 0) {
      errorHandler.handleError(
        new Error('INVALID_AMOUNT'),
        'handlePartialPayment'
      );
      return;
    }

    try {
      log.info('[OrdersPage] Submitting partial payment:', { amount, method: paymentMethod });
      const result = await paymentFlow.submitPartialPayment(amount, paymentMethod);
      
      if (result) {
        // Queue payment in offline service
        const actionId = await offlineSync.queueAction({
          type: 'payment',
          data: {
            orderId: currentOrderId,
            amount: amount,
            method: paymentMethod,
            type: 'partial',
            timestamp: new Date().toISOString()
          }
        }, { source: 'OrdersPage', userAction: 'partial_payment' });
        
        log.info('[OrdersPage] Partial payment queued:', actionId);
        setPaymentAmount('');
        log.info('[OrdersPage] Partial payment successful');
        errorHandler.clearError();
      }
    } catch (err) {
      log.error('[OrdersPage] Partial payment failed:', err);
      errorHandler.handleError(err, 'handlePartialPayment', { amount, method: paymentMethod });
    }
  }, [paymentAmount, paymentMethod, paymentFlow, currentOrderId, offlineSync, errorHandler]);

  /**
   * Handle full payment submission
   */
  const handleFullPayment = useCallback(async () => {
    try {
      log.info('[OrdersPage] Submitting full payment:', { method: paymentMethod });
      const result = await paymentFlow.submitFullPayment(paymentMethod);
      
      if (result) {
        // Queue payment in offline service
        const actionId = await offlineSync.queueAction({
          type: 'payment',
          data: {
            orderId: currentOrderId,
            amount: order.total,
            method: paymentMethod,
            type: 'full',
            timestamp: new Date().toISOString()
          }
        }, { source: 'OrdersPage', userAction: 'full_payment' });
        
        log.info('[OrdersPage] Full payment queued:', actionId);
        log.info('[OrdersPage] Full payment successful, showing receipt');
        setPaymentAmount('');
        errorHandler.clearError();
        // Show receipt after brief delay
        setTimeout(() => {
          handlePaymentSuccess();
        }, 500);
      }
    } catch (err) {
      log.error('[OrdersPage] Full payment failed:', err);
      errorHandler.handleError(err, 'handleFullPayment', { method: paymentMethod });
    }
  }, [paymentMethod, paymentFlow, clearOrder, currentOrderId, offlineSync, order, errorHandler]);

  /**
   * Handle successful payment - show receipt modal
   */
  const handlePaymentSuccess = useCallback(() => {
    log.info(`[OrdersPage] Payment successful, showing receipt for order ${currentOrderId}`);
    
    // Show receipt modal
    setReceiptOrderId(currentOrderId);
    setShowReceiptModal(true);
    
    // Auto-fetch receipt
    receiptFlow.fetchReceipt();
  }, [currentOrderId, receiptFlow]);

  /**
   * Handle print receipt
   */
  const handlePrintReceipt = useCallback(async () => {
    try {
      await receiptFlow.printReceipt();
    } catch (error) {
      log.error('[OrdersPage] Print error:', error);
    }
  }, [receiptFlow]);

  /**
   * Handle reprint receipt
   */
  const handleReprintReceipt = useCallback(async () => {
    try {
      if (receiptOrderId) {
        await receiptFlow.reprintReceipt(receiptOrderId);
      }
    } catch (error) {
      log.error('[OrdersPage] Reprint error:', error);
    }
  }, [receiptOrderId, receiptFlow]);

  /**
   * Handle retry print
   */
  const handleRetryPrint = useCallback(async () => {
    try {
      receiptFlow.clearError();
      await receiptFlow.retryPrint();
    } catch (error) {
      log.error('[OrdersPage] Retry print error:', error);
    }
  }, [receiptFlow]);

  /**
   * Close receipt modal
   */
  const closeReceiptModal = useCallback(() => {
    setShowReceiptModal(false);
    setReceiptOrderId(null);
    receiptFlow.resetPrintState();
    closePaymentPanel();
  }, [receiptFlow]);

  /**
   * Close payment panel
   */
  const closePaymentPanel = useCallback(() => {
    setShowPaymentPanel(false);
    clearOrder();
    setCurrentOrderId(null);
    paymentFlow.resetPaymentState();
    setPaymentAmount('');
  }, [paymentFlow, clearOrder]);


  return (
    <div className="orders-page">
      {/* Offline Mode Banner */}
      {offlineSync && (
        <div 
          className={`offline-mode-banner ${offlineSync.indicator.status}`}
          style={{ display: offlineSync.indicator.status === 'online' && !offlineSync.isSyncing ? 'none' : 'flex' }}
        >
          <div className="banner-content">
            <div className="banner-icon">
              {offlineSync.indicator.status === 'syncing' && <span className="spinner">⟳</span>}
              {offlineSync.indicator.status === 'offline' && '⊘'}
              {offlineSync.indicator.status === 'error' && '⚠'}
            </div>
            <div className="banner-text">
              <h3>{offlineSync.indicator.message}</h3>
              <p>
                {offlineSync.indicator.status === 'offline' && `Queue: ${offlineSync.queueSize} actions`}
                {offlineSync.indicator.status === 'syncing' && `Syncing... ${Math.round(offlineSync.syncProgress)}%`}
                {offlineSync.indicator.status === 'error' && `Failed: ${offlineSync.failedCount} actions - Click retry`}
              </p>
              {offlineSync.syncProgress > 0 && offlineSync.indicator.status === 'syncing' && (
                <div className="sync-progress">
                  <div 
                    className="sync-progress-bar" 
                    style={{ width: `${offlineSync.syncProgress}%` }}
                  ></div>
                </div>
              )}
            </div>
            <div className="banner-actions">
              {offlineSync.indicator.status === 'error' && (
                <button 
                  className="retry-btn"
                  onClick={() => offlineSync.clearFailedQueue()}
                  title="Clear failed queue and retry"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Display Components */}
      <ErrorModal 
        error={errorHandler.error}
        displayError={errorHandler.displayError}
        onDismiss={errorHandler.clearError}
        onRetry={() => {
          errorHandler.clearError();
          // Re-trigger the last failed operation
        }}
      />

      <ErrorBanner
        error={errorHandler.error}
        displayError={errorHandler.displayError}
        onDismiss={errorHandler.clearError}
        onRetry={() => {
          errorHandler.clearError();
        }}
      />

      <div className="orders-header">
        <h1>Orders / Point of Sale</h1>
        <p>Keyboard-Driven POS | Press F1 for help</p>
      </div>

      {/* Hidden Barcode Input (captures Enter key) */}
      <input
        ref={barcodeInputRef}
        type="text"
        className="barcode-input-hidden"
        placeholder="Barcode"
        style={{ position: 'absolute', left: '-9999px' }}
        autoFocus
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            handleEnterKey();
          }
        }}
      />

      {/* Barcode Search Component */}
      <div className="orders-barcode-section">
        <BarcodeSearch
          onProductFound={handleProductFound}
          onProductNotFound={handleProductNotFound}
          enabled={true}
          autoFocus={true}
        />
        <div className="keyboard-hint">
          💾 <strong>Keyboard Shortcuts:</strong> Enter=Scan | Esc=Clear | Tab=Next | +/−=Qty | Del=Remove | Ctrl+Z=Undo
        </div>
      </div>

      {/* Error Message */}
      {lastError && (
        <div className="orders-error-message">
          <span className="icon">⚠</span> {lastError}
        </div>
      )}

      {/* Order State Error */}
      {order.error && (
        <div className="order-error">
          <strong>Order Error:</strong> {order.error}
        </div>
      )}

      {/* Order Summary */}
      {order.items.length > 0 && (
        <div className="order-summary">
          <h3>Order Summary</h3>
          <div className="order-summary-grid">
            <div className="order-summary-item">
              <label>Items</label>
              <div className="value">{order.totals.itemCount}</div>
            </div>
            <div className="order-summary-item">
              <label>Subtotal</label>
              <div className="value">${order.totals.subtotal.toFixed(2)}</div>
            </div>
            <div className="order-summary-item">
              <label>Tax (10%)</label>
              <div className="value">${order.totals.tax.toFixed(2)}</div>
            </div>
            <div className="order-summary-item">
              <label>Total</label>
              <div className="value">${order.totals.total.toFixed(2)}</div>
            </div>
          </div>

          {/* Sync Status */}
          <div
            className={`sync-status ${
              order.synced ? 'synced' : order.pendingChanges > 0 ? 'syncing' : 'error'
            }`}
          >
            <span className="sync-status-dot"></span>
            {order.synced
              ? 'All changes synced'
              : `${order.pendingChanges} pending change${order.pendingChanges !== 1 ? 's' : ''}`}
            {order.lastSyncTime && (
              <span>
                {' - Last sync: '}
                {new Date(order.lastSyncTime).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Order Items Table */}
      {order.items.length > 0 && (
        <div className="orders-products-section">
          <div className="section-header">
            <h2>Order Items ({order.items.length})</h2>
          </div>

          <table className="order-items-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Quantity</th>
                <th>Line Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr
                  key={item.id}
                  className={`order-item-row ${
                    selectedItemId === item.id ? 'selected' : ''
                  }`}
                  onClick={() => {
                    setSelectedItemId(item.id);
                    keyboardServiceRef.current?.setSelectedItemId(item.id);
                  }}
                >
                  <td>
                    <div className="product-info">
                      <div className="product-name">{item.name}</div>
                      <div className="product-sku">SKU: {item.sku}</div>
                    </div>
                  </td>
                  <td>${item.price.toFixed(2)}</td>
                  <td>
                    <div className="quantity-input-group">
                      <button
                        className="quantity-btn"
                        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                        disabled={submitLoading}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        className="quantity-input"
                        value={item.quantity}
                        min="1"
                        onChange={(e) =>
                          handleQuantityChange(item.id, parseInt(e.target.value) || 1)
                        }
                        disabled={submitLoading}
                      />
                      <button
                        className="quantity-btn"
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                        disabled={submitLoading}
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td>${item.lineTotal.toFixed(2)}</td>
                  <td>
                    <button
                      className="remove-btn"
                      onClick={() => removeItem(item.id)}
                      disabled={submitLoading}
                      title="Remove item"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Order Actions */}
          <div className="order-actions">
            <button
              className="btn-submit"
              onClick={handleSubmitOrder}
              disabled={submitLoading || order.items.length === 0}
            >
              {submitLoading ? 'Submitting...' : 'Submit Order'}
            </button>
            <button
              className="btn-clear"
              onClick={clearOrder}
              disabled={submitLoading || order.items.length === 0}
            >
              Clear Order
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {order.items.length === 0 && (
        <div className="orders-empty-state">
          <div className="empty-icon">📦</div>
          <p>No items in order</p>
          <p className="hint">Start scanning product barcodes to add items to your order</p>
        </div>
      )}

      {/* Payment Panel Modal */}
      {showPaymentPanel && currentOrderId && (
        <div className="payment-panel-overlay">
          <div className="payment-panel-modal">
            <div className="payment-header">
              <h2>💳 Payment</h2>
              <button
                className="close-btn"
                onClick={closePaymentPanel}
                disabled={paymentFlow.paymentState.submitting}
              >
                ✕
              </button>
            </div>

            {/* Payment Balance Display */}
            <div className="payment-balance-section">
              <div className="balance-grid">
                <div className="balance-item">
                  <label>Order Total</label>
                  <div className="amount">${paymentFlow.balance.totalAmount.toFixed(2)}</div>
                </div>
                <div className="balance-item">
                  <label>Paid</label>
                  <div className="amount paid">${paymentFlow.balance.totalPaid.toFixed(2)}</div>
                </div>
                <div className="balance-item highlight">
                  <label>Remaining</label>
                  <div className="amount remaining">
                    ${paymentFlow.balance.balanceRemaining.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Payment Status */}
              <div className={`payment-status ${paymentFlow.balance.status}`}>
                {paymentFlow.balance.status === 'paid' && '✓ Fully Paid'}
                {paymentFlow.balance.status === 'partial' && '⏳ Partial Payment'}
                {paymentFlow.balance.status === 'unpaid' && '⏸ Awaiting Payment'}
              </div>
            </div>

            {/* Backend Confirmation Status */}
            {paymentFlow.confirmedPaymentStatus && (
              <div className="backend-confirmation">
                <div className="confirmation-header">✓ Backend Confirmed</div>
                <div className="confirmation-details">
                  <div className="detail-row">
                    <span>Payment ID:</span>
                    <code>{paymentFlow.confirmedPaymentStatus.paymentId}</code>
                  </div>
                  <div className="detail-row">
                    <span>Status:</span>
                    <span className={`status-badge ${paymentFlow.confirmedPaymentStatus.status}`}>
                      {paymentFlow.confirmedPaymentStatus.status}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span>Remaining:</span>
                    <span>${paymentFlow.confirmedPaymentStatus.balanceRemaining.toFixed(2)}</span>
                  </div>
                  {paymentFlow.confirmedPaymentStatus.confirmedAt && (
                    <div className="detail-row">
                      <span>Confirmed:</span>
                      <span>
                        {new Date(paymentFlow.confirmedPaymentStatus.confirmedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Message */}
            {paymentFlow.paymentState.error && (
              <div className="payment-error">
                <span className="icon">⚠</span> {paymentFlow.paymentState.error}
              </div>
            )}

            {/* Success Message */}
            {paymentFlow.paymentState.success && (
              <div className="payment-success">
                <span className="icon">✓</span> {paymentFlow.paymentState.success}
              </div>
            )}

            {/* Payment Method Selection */}
            <div className="payment-method-section">
              <label>Payment Method</label>
              <div className="method-buttons">
                {['cash', 'card', 'check'].map((method) => (
                  <button
                    key={method}
                    className={`method-btn ${paymentMethod === method ? 'active' : ''}`}
                    onClick={() => setPaymentMethod(method)}
                    disabled={paymentFlow.paymentState.submitting}
                  >
                    {method.charAt(0).toUpperCase() + method.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Amount Input */}
            {paymentFlow.balance.balanceRemaining > 0 && (
              <div className="payment-amount-section">
                <label>Payment Amount</label>
                <div className="amount-input-group">
                  <span className="currency">$</span>
                  <input
                    type="number"
                    className="amount-input"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    max={paymentFlow.balance.balanceRemaining}
                    disabled={paymentFlow.paymentState.submitting}
                  />
                </div>
                <div className="amount-suggestions">
                  <button
                    className="suggestion-btn"
                    onClick={() => setPaymentAmount(paymentFlow.balance.balanceRemaining.toString())}
                    disabled={paymentFlow.paymentState.submitting}
                  >
                    Full (${paymentFlow.balance.balanceRemaining.toFixed(2)})
                  </button>
                </div>
              </div>
            )}

            {/* Payment History */}
            {paymentFlow.paymentHistory.length > 0 && (
              <div className="payment-history-section">
                <label>Payment History</label>
                <div className="history-list">
                  {paymentFlow.paymentHistory.map((payment, idx) => (
                    <div key={idx} className="history-item">
                      <div className="history-method">{payment.method}</div>
                      <div className="history-amount">${payment.amount.toFixed(2)}</div>
                      <div className="history-time">
                        {new Date(payment.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Actions */}
            <div className="payment-actions">
              {paymentFlow.balance.balanceRemaining > 0 ? (
                <>
                  <button
                    className="btn-payment partial"
                    onClick={handlePartialPayment}
                    disabled={
                      paymentFlow.paymentState.submitting ||
                      !paymentAmount ||
                      parseFloat(paymentAmount) <= 0
                    }
                  >
                    {paymentFlow.paymentState.submitting ? '⏳ Processing...' : 'Partial Payment'}
                  </button>
                  <button
                    className="btn-payment full"
                    onClick={handleFullPayment}
                    disabled={paymentFlow.paymentState.submitting}
                  >
                    {paymentFlow.paymentState.submitting ? '⏳ Processing...' : 'Pay Full Amount'}
                  </button>
                </>
              ) : (
                <div className="payment-complete">
                  <div className="complete-icon">✓</div>
                  <p>Order Fully Paid</p>
                  <button
                    className="btn-payment complete"
                    onClick={closePaymentPanel}
                  >
                    Complete Order
                  </button>
                </div>
              )}
            </div>

            {/* Loading State */}
            {paymentFlow.paymentState.loading && (
              <div className="payment-loading">
                <div className="spinner"></div>
                <p>Loading payment information...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RECEIPT MODAL */}
      {showReceiptModal && (
        <div className="receipt-modal-overlay" onClick={closeReceiptModal}>
          <div className="receipt-modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="receipt-header">
              <div>
                <h2 className="receipt-header-title">Receipt</h2>
                <p className="receipt-header-subtitle">Order #{receiptOrderId}</p>
              </div>
              <button
                className="receipt-close-button"
                onClick={closeReceiptModal}
                title="Close receipt"
              >
                ✕
              </button>
            </div>

            {/* Language Selector */}
            <div className="receipt-language-selector">
              <label className="receipt-language-label">Language:</label>
              <div className="receipt-language-buttons">
                {receiptFlow.supportedLanguages.map((lang) => (
                  <button
                    key={lang}
                    className={`receipt-language-button ${receiptFlow.language === lang ? 'active' : ''}`}
                    onClick={() => receiptFlow.changeLanguage(lang)}
                  >
                    {receiptFlow.getLanguageName(lang)}
                  </button>
                ))}
              </div>
            </div>

            {/* Loading State */}
            {receiptFlow.receiptLoading && (
              <div className="receipt-printer-preview">
                <div className="receipt-loading">
                  <div className="receipt-loading-spinner"></div>
                  <span>Loading receipt...</span>
                </div>
              </div>
            )}

            {/* Error State */}
            {receiptFlow.receiptError && (
              <div className="receipt-printer-preview">
                <div className="receipt-error-section">
                  <div className="receipt-error-title">
                    <span className="receipt-error-icon">⚠</span>
                    Failed to Load Receipt
                  </div>
                  <p className="receipt-error-message">{receiptFlow.receiptError}</p>
                </div>
              </div>
            )}

            {/* Receipt Preview */}
            {receiptFlow.receipt && !receiptFlow.receiptLoading && (
              <div className="receipt-printer-preview">
                <div className="receipt-paper">
                  {receiptServiceRef.current?.formatReceiptForPrinter(
                    receiptFlow.receipt,
                    receiptFlow.language
                  )}
                </div>
              </div>
            )}

            {/* Print Status Messages */}
            {receiptFlow.printStatus === 'success' && (
              <div className="receipt-success-section">
                <div className="receipt-success-title">
                  <span className="receipt-success-icon">✓</span>
                  Receipt Printed Successfully
                </div>
                <p className="receipt-success-message">
                  Printed at {new Date(receiptFlow.lastPrintTime).toLocaleTimeString()}
                </p>
              </div>
            )}

            {receiptFlow.printStatus === 'failed' && (
              <div className="receipt-error-section">
                <div className="receipt-error-title">
                  <span className="receipt-error-icon">⚠</span>
                  Print Failed
                </div>
                <p className="receipt-error-message">
                  {receiptFlow.printError} (Attempt {receiptFlow.printAttempts}/3)
                </p>
              </div>
            )}

            {/* Print Job Indicator */}
            {receiptFlow.isPrinting && (
              <div className="receipt-print-indicator">
                <div className="receipt-print-indicator-dot"></div>
                Printing... (Attempt {receiptFlow.printAttempts})
              </div>
            )}

            {/* Actions */}
            <div className="receipt-footer">
              <div className="receipt-button-group">
                <button
                  className="receipt-button receipt-button-print"
                  onClick={handlePrintReceipt}
                  disabled={receiptFlow.isPrinting || !receiptFlow.receipt}
                  title="Print receipt to thermal printer"
                >
                  {receiptFlow.isPrinting ? '⏳ Printing...' : '🖨 Print Receipt'}
                </button>
                {receiptFlow.printStatus === 'failed' && (
                  <button
                    className="receipt-button receipt-button-reprint receipt-retry-button"
                    onClick={handleRetryPrint}
                    disabled={receiptFlow.isPrinting}
                    title="Retry printing"
                  >
                    🔄 Retry
                  </button>
                )}
              </div>
              {receiptFlow.printStatus === 'success' && (
                <button
                  className="receipt-button receipt-button-reprint"
                  onClick={handleReprintReceipt}
                  disabled={receiptFlow.isPrinting}
                  title="Print another copy"
                >
                  📋 Reprint Copy
                </button>
              )}
              <button
                className="receipt-button receipt-button-close"
                onClick={closeReceiptModal}
                title="Close receipt"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export OrdersPage wrapped in ErrorBoundary for crash protection
export default function OrdersPage(props) {
  const errorLoggerRef = useRef(null);
  const { apiClient } = useSecureApi();

  // Initialize error logger
  if (!errorLoggerRef.current && apiClient) {
    errorLoggerRef.current = new ErrorLogger(apiClient);
  }

  return (
    <ErrorBoundary errorLogger={errorLoggerRef.current}>
      <OrdersPageContent {...props} />
    </ErrorBoundary>
  );
}
