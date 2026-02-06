import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import RoleManager from '../utils/RoleManager';
import '../styles/OrderDetailsPage.css';
import log from '../utils/logger';

export default function OrderDetailsPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userRoles, userPermissions } = useContext(AuthContext);
  
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [removingItemId, setRemovingItemId] = useState(null);
  
  // Add product state
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  // Quick Pay state
  const [showQuickPay, setShowQuickPay] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  // Payment history state
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [payments, setPayments] = useState([]);
  const [paymentsSummary, setPaymentsSummary] = useState(null);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Refund state
  const [showRefund, setShowRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);

  // Create user object with permissions for RoleManager
  const userWithPermissions = {
    ...currentUser,
    roles: userRoles,
    permissions: userPermissions
  };

  // Check permissions
  const canViewOrders = RoleManager.hasPermission(userWithPermissions, 'view_orders');
  const canEditOrders = RoleManager.hasPermission(userWithPermissions, 'edit_order');
  const isAdmin = userRoles?.includes('admin');
  const isManager = userRoles?.includes('manager');
  const canRefund = isAdmin || isManager;

  useEffect(() => {
    loadOrderDetails();
  }, [orderId]);

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const loadOrderDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await window.pos.orders.getById(orderId);
      const orderData = response?.data || response;
      
      setOrder(orderData);
      log.info('Order loaded:', orderData);
      
    } catch (err) {
      log.error('Error loading order:', err);
      setError(err.message || 'Failed to load order details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!canEditOrders) {
      showToast('You do not have permission to edit orders', 'error');
      return;
    }

    if (!window.confirm('Are you sure you want to remove this item?')) {
      return;
    }

    try {
      setRemovingItemId(itemId);
      await window.pos.orders.removeItem(orderId, itemId);
      
      showToast('Item removed successfully', 'success');
      
      // Reload order details
      await loadOrderDetails();
      
    } catch (err) {
      log.error('Error removing item:', err);
      showToast(err.message || 'Failed to remove item', 'error');
    } finally {
      setRemovingItemId(null);
    }
  };

  const loadProducts = async (search = '') => {
    try {
      const params = { per_page: 20 };
      if (search.trim()) {
        params.search = search.trim();
      }
      // Only show active products
      params.is_active = 'true';
      
      const response = await window.pos.products.getAll(params);
      const productData = response?.data || response || [];
      setProducts(Array.isArray(productData) ? productData : []);
    } catch (err) {
      log.error('Error loading products:', err);
      setProducts([]);
    }
  };

  const handleOpenAddProduct = () => {
    setShowAddProduct(true);
    setProductSearch('');
    setSelectedProduct(null);
    setQuantity(1);
    loadProducts();
  };

  const handleCloseAddProduct = () => {
    setShowAddProduct(false);
    setProductSearch('');
    setSelectedProduct(null);
    setQuantity(1);
  };

  const handleProductSearch = (e) => {
    const search = e.target.value;
    setProductSearch(search);
    loadProducts(search);
  };

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
  };

  const handleAddItem = async () => {
    if (!selectedProduct) {
      showToast('Please select a product', 'error');
      return;
    }

    if (quantity < 1) {
      showToast('Quantity must be at least 1', 'error');
      return;
    }

    try {
      setIsAdding(true);

      // Use quick add endpoint
      const itemData = {
        product_id: selectedProduct.id,
        quantity: parseInt(quantity),
        price: parseFloat(selectedProduct.price)
      };

      log.info('Adding item to order:', itemData);
      await window.pos.orders.quickAddItem(orderId, itemData);
      
      showToast('Product added successfully', 'success');
      
      // Reload order details to update totals
      await loadOrderDetails();
      
      // Close modal
      handleCloseAddProduct();
      
    } catch (err) {
      log.error('Error adding item:', err);
      showToast(err.message || 'Failed to add product', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleCompleteOrder = async () => {
    if (!canEditOrders) {
      showToast('You do not have permission to complete orders', 'error');
      return;
    }

    if (!window.confirm('Are you sure you want to complete this order? This action cannot be undone.')) {
      return;
    }

    try {
      setIsLoading(true);
      await window.pos.orders.complete(orderId);
      
      showToast('Order completed successfully', 'success');
      
      // Reload order details to update status
      await loadOrderDetails();
      
    } catch (err) {
      log.error('Error completing order:', err);
      showToast(err.message || 'Failed to complete order', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!canEditOrders) {
      showToast('You do not have permission to cancel orders', 'error');
      return;
    }

    if (!window.confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
      return;
    }

    try {
      setIsLoading(true);
      await window.pos.orders.cancel(orderId);
      
      showToast('Order cancelled successfully', 'success');
      
      // Reload order details to update status
      await loadOrderDetails();
      
    } catch (err) {
      log.error('Error cancelling order:', err);
      showToast(err.message || 'Failed to cancel order', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenQuickPay = () => {
    const orderTotal = parseFloat(order?.total || 0);
    setPaymentAmount(orderTotal.toFixed(2));
    setPaymentMethod('cash');
    setShowQuickPay(true);
  };

  const handleCloseQuickPay = () => {
    setShowQuickPay(false);
    setPaymentAmount('');
    setPaymentMethod('cash');
  };

  const handleQuickPay = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }

    try {
      setIsPaying(true);

      const paymentData = {
        payment_method: paymentMethod,
        amount: parseFloat(paymentAmount)
      };

      log.info('Processing quick pay:', paymentData);
      const response = await window.pos.orders.quickPay(orderId, paymentData);
      
      const result = response?.data || response;
      const balance = parseFloat(result.balance || 0);
      
      if (balance <= 0) {
        showToast('Payment complete! Order completed.', 'success');
        handleCloseQuickPay();
        // Reload to show completed status
        await loadOrderDetails();
      } else {
        showToast(`Payment recorded. Balance: ${formatCurrency(balance)}`, 'info');
        // Reload to show updated balance
        await loadOrderDetails();
      }
      
    } catch (err) {
      log.error('Error processing payment:', err);
      showToast(err.message || 'Failed to process payment', 'error');
    } finally {
      setIsPaying(false);
    }
  };

  const handleOpenPaymentHistory = async () => {
    setShowPaymentHistory(true);
    await loadPaymentHistory();
  };

  const handleClosePaymentHistory = () => {
    setShowPaymentHistory(false);
  };

  const loadPaymentHistory = async () => {
    try {
      setLoadingPayments(true);

      // Load both payments list and summary
      const [paymentsResponse, summaryResponse] = await Promise.all([
        window.pos.orders.getPayments(orderId),
        window.pos.orders.getPaymentsSummary(orderId)
      ]);

      // Extract payments array from nested response structure
      // Backend returns: { success: true, data: { payments: [...] } }
      const responseData = paymentsResponse?.data || paymentsResponse || {};
      const paymentsArray = responseData.payments || responseData.data?.payments || [];
      
      // Map backend field names to frontend expectations
      const mappedPayments = paymentsArray.map(payment => ({
        ...payment,
        payment_method: payment.method || payment.payment_method,
        payment_date: payment.created_at || payment.payment_date
      }));
      
      setPayments(mappedPayments);

      const summaryData = summaryResponse?.data || summaryResponse;
      setPaymentsSummary(summaryData);

      log.info('Payment history loaded:', { payments: mappedPayments, summary: summaryData });

    } catch (err) {
      log.error('Error loading payment history:', err);
      showToast(err.message || 'Failed to load payment history', 'error');
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleRefund = async () => {
    if (!refundAmount || parseFloat(refundAmount) <= 0) {
      showToast('Please enter a valid refund amount', 'error');
      return;
    }

    const amount = parseFloat(refundAmount);
    const totalPaid = parseFloat(paymentsSummary?.total_paid || 0);

    if (amount > totalPaid) {
      showToast('Refund amount cannot exceed total paid amount', 'error');
      return;
    }

    if (!window.confirm(
      `Are you sure you want to process a refund of ${formatCurrency(amount)}?\n\n` +
      `Reason: ${refundReason || 'No reason provided'}\n\n` +
      `This action cannot be undone.`
    )) {
      return;
    }

    try {
      setIsRefunding(true);
      log.info('Processing refund:', { amount, refundReason });

      const refundData = {
        amount: amount,
        reason: refundReason || 'No reason provided'
      };

      await window.pos.orders.refundPayment(orderId, refundData);
      
      showToast(`Refund of ${formatCurrency(amount)} processed successfully`, 'success');
      
      // Reset refund form
      setRefundAmount('');
      setRefundReason('');
      setShowRefund(false);
      
      // Reload payment history to show updated totals
      await loadPaymentHistory();
      
      // Also reload order details to show updated order status
      await loadOrderDetails();
      
    } catch (err) {
      log.error('Error processing refund:', err);
      showToast(err.message || 'Failed to process refund', 'error');
    } finally {
      setIsRefunding(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const getStatusBadge = (status) => {
    const statusClass = `status-badge status-${status?.toLowerCase() || 'unknown'}`;
    return <span className={statusClass}>{status || 'Unknown'}</span>;
  };

  if (!canViewOrders) {
    return (
      <div className="order-details-page">
        <div className="error-container">
          <p>You don't have permission to view orders.</p>
          <button onClick={() => navigate('/orders')} className="back-btn">
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="order-details-page">
        <div className="loading-container">
          <p>Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="order-details-page">
        <div className="error-container">
          <p>{error}</p>
          <div className="error-actions">
            <button onClick={loadOrderDetails} className="retry-btn">
              Retry
            </button>
            <button onClick={() => navigate('/orders')} className="back-btn">
              Back to Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="order-details-page">
        <div className="empty-state">
          <p>Order not found.</p>
          <button onClick={() => navigate('/orders')} className="back-btn">
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const items = order.items || order.order_items || [];
  const subtotal = parseFloat(order.subtotal || 0);
  const tax = parseFloat(order.tax || 0);
  const discount = parseFloat(order.discount || 0);
  const total = parseFloat(order.total || 0);

  return (
    <div className="order-details-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <button onClick={() => navigate('/orders')} className="back-btn">
            ← Back
          </button>
          <div className="header-info">
            <h1>Order #{order.order_number || order.id}</h1>
            {getStatusBadge(order.status)}
          </div>
        </div>
        <div className="header-right">
          {order.status === 'pending' && canEditOrders && (
            <>
              <button className="action-btn quick-pay" onClick={handleOpenQuickPay}>
                💳 Quick Pay
              </button>
              <button className="action-btn danger" onClick={handleCancelOrder}>
                Cancel Order
              </button>
              <button className="action-btn primary" onClick={handleCompleteOrder}>
                Complete Order
              </button>
            </>
          )}
          {order.status !== 'pending' && (
            <button className="action-btn secondary" onClick={() => log.info('Print receipt')}>
              Print Receipt
            </button>
          )}
        </div>
      </div>

      {/* Order Info */}
      <div className="order-info-card">
        <div className="info-row">
          <span className="info-label">Branch ID:</span>
          <span className="info-value">{order.branch_id}</span>
        </div>
        {order.notes && (
          <div className="info-row">
            <span className="info-label">Notes:</span>
            <span className="info-value">{order.notes}</span>
          </div>
        )}
        <div className="info-row">
          <span className="info-label">Created:</span>
          <span className="info-value">
            {new Date(order.created_at).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Items List */}
      <div className="items-section">
        <div className="items-header">
          <h2>Order Items</h2>
          {order.status === 'pending' && canEditOrders && (
            <button className="add-product-btn" onClick={handleOpenAddProduct}>
              + Add Product
            </button>
          )}
        </div>
        
        {items.length === 0 ? (
          <div className="empty-items">
            <p>No items in this order yet.</p>
          </div>
        ) : (
          <div className="items-list">
            {items.map((item) => (
              <div key={item.id} className="item-card">
                <div className="item-main">
                  <div className="item-info">
                    <h3 className="item-name">
                      {item.product_name || item.product?.name || 'Unknown Product'}
                    </h3>
                    <div className="item-details">
                      <span className="item-price">
                        {formatCurrency(item.price)} × {item.quantity}
                      </span>
                    </div>
                  </div>
                  <div className="item-right">
                    <div className="item-total">
                      {formatCurrency(item.line_total || (item.price * item.quantity))}
                    </div>
                    {order.status === 'pending' && canEditOrders && (
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={removingItemId === item.id}
                        className="remove-btn"
                        title="Remove item"
                      >
                        {removingItemId === item.id ? '...' : '×'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="totals-card">
        <div className="total-row">
          <span className="total-label">Subtotal:</span>
          <span className="total-value">{formatCurrency(subtotal)}</span>
        </div>
        
        {discount > 0 && (
          <div className="total-row discount">
            <span className="total-label">Discount:</span>
            <span className="total-value">-{formatCurrency(discount)}</span>
          </div>
        )}
        
        <div className="total-row">
          <span className="total-label">Tax:</span>
          <span className="total-value">{formatCurrency(tax)}</span>
        </div>
        
        <div className="total-row grand-total">
          <span className="total-label">Total:</span>
          <span className="total-value">{formatCurrency(total)}</span>
        </div>

        {/* Payment History Button */}
        {order.status !== 'pending' && (
          <button className="payment-history-btn" onClick={handleOpenPaymentHistory}>
            📋 View Payment History
          </button>
        )}
      </div>

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="modal-overlay" onClick={handleCloseAddProduct}>
          <div className="modal-content add-product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Product to Order</h2>
              <button className="close-btn" onClick={handleCloseAddProduct}>×</button>
            </div>

            <div className="modal-body">
              {/* Search */}
              <div className="search-section">
                <input
                  type="text"
                  placeholder="Search products by name or SKU..."
                  value={productSearch}
                  onChange={handleProductSearch}
                  className="search-input"
                  autoFocus
                />
              </div>

              {/* Product List */}
              <div className="product-list">
                {products.length === 0 ? (
                  <div className="no-products">
                    <p>No products found</p>
                  </div>
                ) : (
                  products.map((product) => (
                    <div
                      key={product.id}
                      className={`product-item ${selectedProduct?.id === product.id ? 'selected' : ''}`}
                      onClick={() => handleSelectProduct(product)}
                    >
                      <div className="product-info">
                        <div className="product-name">{product.name}</div>
                        <div className="product-sku">SKU: {product.sku}</div>
                      </div>
                      <div className="product-price">{formatCurrency(product.price)}</div>
                    </div>
                  ))
                )}
              </div>

              {/* Quantity Input */}
              {selectedProduct && (
                <div className="quantity-section">
                  <label htmlFor="quantity">Quantity:</label>
                  <div className="quantity-controls">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="qty-btn"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      id="quantity"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      min="1"
                      className="qty-input"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(quantity + 1)}
                      className="qty-btn"
                    >
                      +
                    </button>
                  </div>
                  <div className="line-total">
                    Line Total: {formatCurrency(selectedProduct.price * quantity)}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={handleCloseAddProduct}
                  className="cancel-btn"
                  disabled={isAdding}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="submit-btn"
                  disabled={!selectedProduct || isAdding}
                >
                  {isAdding ? 'Adding...' : 'Add to Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Pay Modal */}
      {showQuickPay && (
        <div className="modal-overlay" onClick={handleCloseQuickPay}>
          <div className="modal-content quick-pay-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Quick Pay</h2>
              <button className="close-btn" onClick={handleCloseQuickPay}>×</button>
            </div>

            <div className="modal-body">
              {/* Order Summary */}
              <div className="pay-summary">
                <div className="summary-row">
                  <span className="summary-label">Order Total:</span>
                  <span className="summary-value">{formatCurrency(total)}</span>
                </div>
                {order.balance && parseFloat(order.balance) > 0 && (
                  <div className="summary-row highlight">
                    <span className="summary-label">Balance Due:</span>
                    <span className="summary-value">{formatCurrency(order.balance)}</span>
                  </div>
                )}
              </div>

              {/* Payment Method Selector */}
              <div className="payment-method-section">
                <label>Payment Method:</label>
                <div className="payment-methods">
                  <button
                    className={`method-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('cash')}
                    onKeyDown={(e) => e.key === '1' && setPaymentMethod('cash')}
                    tabIndex={0}
                  >
                    <span className="method-key">1</span>
                    💵 Cash
                  </button>
                  <button
                    className={`method-btn ${paymentMethod === 'card' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('card')}
                    onKeyDown={(e) => e.key === '2' && setPaymentMethod('card')}
                    tabIndex={0}
                  >
                    <span className="method-key">2</span>
                    💳 Card
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div className="amount-section">
                <label htmlFor="paymentAmount">Amount:</label>
                <div className="amount-input-wrapper">
                  <span className="currency-symbol">$</span>
                  <input
                    type="number"
                    id="paymentAmount"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    step="0.01"
                    min="0"
                    className="amount-input"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleQuickPay();
                      } else if (e.key === 'Escape') {
                        handleCloseQuickPay();
                      }
                    }}
                  />
                </div>
                
                {/* Quick amount buttons */}
                <div className="quick-amounts">
                  <button onClick={() => setPaymentAmount(total.toFixed(2))} className="quick-amt-btn">
                    Exact
                  </button>
                  <button onClick={() => setPaymentAmount('20.00')} className="quick-amt-btn">
                    $20
                  </button>
                  <button onClick={() => setPaymentAmount('50.00')} className="quick-amt-btn">
                    $50
                  </button>
                  <button onClick={() => setPaymentAmount('100.00')} className="quick-amt-btn">
                    $100
                  </button>
                </div>

                {/* Change calculation for cash */}
                {paymentMethod === 'cash' && paymentAmount && parseFloat(paymentAmount) > total && (
                  <div className="change-display">
                    Change: <strong>{formatCurrency(parseFloat(paymentAmount) - total)}</strong>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={handleCloseQuickPay}
                  className="cancel-btn"
                  disabled={isPaying}
                  onKeyDown={(e) => e.key === 'Escape' && handleCloseQuickPay()}
                >
                  Cancel (Esc)
                </button>
                <button
                  type="button"
                  onClick={handleQuickPay}
                  className="submit-btn pay-btn"
                  disabled={isPaying || !paymentAmount}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickPay()}
                >
                  {isPaying ? 'Processing...' : 'Process Payment (Enter)'}
                </button>
              </div>

              <div className="keyboard-hint">
                💡 Tip: Press 1 for Cash, 2 for Card, Enter to pay, Esc to cancel
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Modal */}
      {showPaymentHistory && (
        <div className="modal-overlay" onClick={handleClosePaymentHistory}>
          <div className="modal-content payment-history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Payment History</h2>
              <button className="close-btn" onClick={handleClosePaymentHistory}>×</button>
            </div>

            <div className="modal-body">
              {loadingPayments ? (
                <div className="loading-payments">Loading payments...</div>
              ) : (
                <>
                  {/* Summary Cards */}
                  {paymentsSummary && (
                    <div className="payment-summary-cards">
                      <div className="summary-card total-paid">
                        <div className="card-label">Total Paid</div>
                        <div className="card-value">{formatCurrency(paymentsSummary.total_paid || 0)}</div>
                      </div>
                      <div className="summary-card balance-due">
                        <div className="card-label">Balance Due</div>
                        <div className="card-value">{formatCurrency(paymentsSummary.balance || 0)}</div>
                      </div>
                    </div>
                  )}

                  {/* Payment Method Summary */}
                  {paymentsSummary?.by_method && Object.keys(paymentsSummary.by_method).length > 0 && (
                    <div className="method-summary">
                      <h3>By Payment Method</h3>
                      <div className="method-cards">
                        {Object.entries(paymentsSummary.by_method).map(([method, data]) => (
                          <div key={method} className="method-card">
                            <div className="method-icon">
                              {method === 'cash' ? '💵' : method === 'card' ? '💳' : '💰'}
                            </div>
                            <div className="method-info">
                              <div className="method-name">{method.toUpperCase()}</div>
                              <div className="method-count">{data.count} payment{data.count !== 1 ? 's' : ''}</div>
                            </div>
                            <div className="method-amount">{formatCurrency(data.total)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payment List */}
                  <div className="payment-list-section">
                    <h3>Payment Transactions</h3>
                    {payments.length === 0 ? (
                      <div className="no-payments">
                        <p>No payments recorded for this order.</p>
                      </div>
                    ) : (
                      <div className="payment-list">
                        {payments.map((payment, index) => (
                          <div key={payment.id || index} className="payment-item">
                            <div className="payment-left">
                              <div className="payment-icon">
                                {payment.payment_method === 'cash' ? '💵' : '💳'}
                              </div>
                              <div className="payment-details">
                                <div className="payment-method-name">
                                  {payment.payment_method?.toUpperCase() || 'UNKNOWN'}
                                </div>
                                <div className="payment-date">
                                  {new Date(payment.created_at).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="payment-amount">{formatCurrency(payment.amount)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Refund Button (Admin/Manager Only) */}
              {canRefund && !loadingPayments && paymentsSummary && parseFloat(paymentsSummary.total_paid || 0) > 0 && (
                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowRefund(true)}
                    className="refund-btn"
                  >
                    💸 Process Refund
                  </button>
                </div>
              )}

              {/* Close Button */}
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={handleClosePaymentHistory}
                  className="submit-btn"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefund && (
        <div className="modal-overlay">
          <div className="modal-content refund-modal">
            <div className="modal-container">
              {/* Header */}
              <div className="modal-header">
                <h2>💸 Process Refund</h2>
                <button
                  className="close-btn"
                  onClick={() => {
                    setShowRefund(false);
                    setRefundAmount('');
                    setRefundReason('');
                  }}
                  disabled={isRefunding}
                >
                  ×
                </button>
              </div>

              {/* Info */}
              <div className="refund-info">
                <div className="info-row">
                  <span className="info-label">Order Number:</span>
                  <span className="info-value">{order?.order_number}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Total Paid:</span>
                  <span className="info-value">{formatCurrency(paymentsSummary?.total_paid || 0)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Current Balance:</span>
                  <span className="info-value">{formatCurrency(paymentsSummary?.balance || 0)}</span>
                </div>
              </div>

              {/* Form */}
              <div className="refund-form">
                <div className="form-group">
                  <label>Refund Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={paymentsSummary?.total_paid || 0}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder="0.00"
                    className="refund-amount-input"
                    disabled={isRefunding}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>Reason for Refund</label>
                  <textarea
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Enter reason for refund (optional)"
                    className="refund-reason-input"
                    rows="3"
                    disabled={isRefunding}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setShowRefund(false);
                    setRefundAmount('');
                    setRefundReason('');
                  }}
                  className="cancel-btn"
                  disabled={isRefunding}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRefund}
                  className="submit-btn refund-submit-btn"
                  disabled={isRefunding || !refundAmount || parseFloat(refundAmount) <= 0}
                >
                  {isRefunding ? 'Processing...' : `Refund ${refundAmount ? formatCurrency(refundAmount) : '$0.00'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
