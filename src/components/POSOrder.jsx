import React, { useState, useEffect, useRef, useContext } from 'react';
import AuthContext from '../context/AuthContext';
import '../styles/POSOrder.css';

const log = {
  info: (...args) => window.pos?.logInfo ? window.pos.logInfo(args.join(' ')) : console.log(...args),
  error: (...args) => window.pos?.logError ? window.pos.logError(args.join(' ')) : console.error(...args)
};

/**
 * POSOrder Component
 * Complete single-screen POS order entry system
 * Handles: Search → Add Items → Set Details → Payment → Complete
 * No navigation required - entire lifecycle in one screen
 */
function POSOrder() {
  const { currentUser } = useContext(AuthContext);
  const searchInputRef = useRef(null);
  const quantityInputRef = useRef(null);
  const paymentAmountInputRef = useRef(null);

  // Cart & Order State
  const [orderId, setOrderId] = useState(null); // Current draft order ID
  const [orderNumber, setOrderNumber] = useState(null); // Order number from backend
  const [orderStatus, setOrderStatus] = useState('draft'); // draft, pending, completed, cancelled
  const [orderItems, setOrderItems] = useState([]);
  const [branchId, setBranchId] = useState(currentUser?.branch_id || '');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [isOrderCompleted, setIsOrderCompleted] = useState(false);

  // Payment & Balance State
  const [totalPaid, setTotalPaid] = useState(0);
  const [orderBalance, setOrderBalance] = useState(0);

  // Product Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isSearching, setIsSearching] = useState(false);

  // Cart Selection State
  const [selectedCartItemIndex, setSelectedCartItemIndex] = useState(-1);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  
  // Quick Pay Modal State
  const [showQuickPayModal, setShowQuickPayModal] = useState(false);
  const [quickPayAmount, setQuickPayAmount] = useState('');
  const [quickPayMethod, setQuickPayMethod] = useState('cash');
  const quickPayInputRef = useRef(null);

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [toast, setToast] = useState(null);
  const [lastCompletedOrderId, setLastCompletedOrderId] = useState(null);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Product search with debounce
  useEffect(() => {
    const searchProducts = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      try {
        setIsSearching(true);
        const response = await window.pos.products.quickSearch(searchQuery.trim());
        
        // Backend returns: { success: true, message: "Products found", data: [...] }
        const productData = response?.data || [];
        setSearchResults(Array.isArray(productData) ? productData : []);
        setSelectedResultIndex(0);
      } catch (err) {
        log.error('Error searching products:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchProducts, 150);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Focus payment amount when modal opens
  useEffect(() => {
    if (showPaymentModal) {
      setTimeout(() => paymentAmountInputRef.current?.focus(), 100);
    }
  }, [showPaymentModal]);

  useEffect(() => {
    if (showQuickPayModal) {
      setTimeout(() => quickPayInputRef.current?.focus(), 100);
    }
  }, [showQuickPayModal]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't interfere with modal inputs
      if (showPaymentModal || showQuickPayModal) return;

      // F2: Focus product input (search)
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // F4: Quick Pay (open quick pay modal)
      if (e.key === 'F4') {
        e.preventDefault();
        if (orderItems.length > 0 && !isSubmitting) {
          handleOpenQuickPayModal();
        }
      }

      // F8: Complete order with payment
      if (e.key === 'F8') {
        e.preventDefault();
        if (orderItems.length > 0 && !isSubmitting) {
          handleOpenPaymentModal();
        }
      }

      // F9: Hold order (save without payment)
      if (e.key === 'F9') {
        e.preventDefault();
        handleHoldOrder();
      }

      // ESC: Cancel Order
      if (e.key === 'Escape') {
        e.preventDefault();
        // If search is active, clear it first
        if (searchQuery) {
          setSearchQuery('');
          setSearchResults([]);
          searchInputRef.current?.focus();
        } else if (orderItems.length > 0 && !isOrderCompleted) {
          // Otherwise cancel the order (not if already completed)
          handleCancelOrder();
        }
      }

      // Arrow navigation in search results (only when focused on search input)
      if (searchResults.length > 0 && document.activeElement === searchInputRef.current) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedResultIndex(prev => 
            prev < searchResults.length - 1 ? prev + 1 : prev
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedResultIndex(prev => prev > 0 ? prev - 1 : 0);
        } else if (e.key === 'Enter' && searchResults[selectedResultIndex]) {
          e.preventDefault();
          handleAddProduct(searchResults[selectedResultIndex]);
        }
      }

      // Allow Enter to add product even when not focused on search (for barcode scanners)
      if (e.key === 'Enter' && searchResults.length > 0 && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        // Use the selected result index, or default to first result if none selected
        const productToAdd = searchResults[selectedResultIndex] || searchResults[0];
        if (productToAdd) {
          handleAddProduct(productToAdd);
        }
      }

      // Allow Enter to add product even when not focused on search (for barcode scanners)
      if (e.key === 'Enter' && searchResults.length > 0 && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        // If there's a selected result, use it; otherwise use first result
        const productToAdd = searchResults[selectedResultIndex >= 0 ? selectedResultIndex : 0];
        if (productToAdd) {
          handleAddProduct(productToAdd);
        }
      }

      // Cart item keyboard navigation (when not in input fields)
      const activeElement = document.activeElement;
      const isInInput = activeElement === searchInputRef.current || 
                       activeElement === quantityInputRef.current ||
                       activeElement?.tagName === 'INPUT';

      if (!isInInput && orderItems.length > 0) {
        // Arrow Down: Select next cart item
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedCartItemIndex(prev => {
            if (prev < 0) return 0;
            return prev < orderItems.length - 1 ? prev + 1 : prev;
          });
        }
        
        // Arrow Up: Select previous cart item
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedCartItemIndex(prev => {
            if (prev < 0) return orderItems.length - 1;
            return prev > 0 ? prev - 1 : 0;
          });
        }

        // Delete key: Remove selected cart item
        if (e.key === 'Delete' && selectedCartItemIndex >= 0) {
          e.preventDefault();
          handleRemoveItem(selectedCartItemIndex);
          // Adjust selection after deletion
          setSelectedCartItemIndex(prev => {
            if (orderItems.length <= 1) return -1;
            if (prev >= orderItems.length - 1) return orderItems.length - 2;
            return prev;
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, searchResults, selectedResultIndex, showPaymentModal, orderItems, branchId, selectedCartItemIndex]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount || 0).toFixed(2)}`;
  };

  const handleAddProduct = (product) => {
    const qty = parseInt(quantity) || 1;
    
    if (!branchId) {
      showToast('Please select a branch first', 'error');
      return;
    }

    // Add item to local cart (no API call - will send all at once on complete)
    const existingIndex = orderItems.findIndex(item => item.product_id === product.id);
    
    if (existingIndex >= 0) {
      // Update quantity in local state
      const updated = [...orderItems];
      updated[existingIndex].quantity += qty;
      updated[existingIndex].line_total = updated[existingIndex].quantity * updated[existingIndex].price;
      setOrderItems(updated);
      showToast(`Updated ${product.name} → ${updated[existingIndex].quantity} pcs`, 'info');
    } else {
      // Add new item to local state
      const newItem = {
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        price: parseFloat(product.price),
        quantity: qty,
        line_total: qty * parseFloat(product.price)
      };
      setOrderItems([...orderItems, newItem]);
      showToast(`Added ${product.name} (${qty} pcs)`, 'success');
    }

    // Clear search and reset quantity
    setSearchQuery('');
    setSearchResults([]);
    setSelectedResultIndex(-1);
    setQuantity(1);
    
    // Auto-focus search for next item
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const handleRemoveItem = (index) => {
    const item = orderItems[index];
    
    // Remove from local cart (no API call)
    setOrderItems(orderItems.filter((_, i) => i !== index));
    showToast(`Removed ${item.product_name}`, 'info');
    
    // Reset cart selection if needed
    if (selectedCartItemIndex === index) {
      setSelectedCartItemIndex(-1);
    } else if (selectedCartItemIndex > index) {
      setSelectedCartItemIndex(selectedCartItemIndex - 1);
    }
  };

  const handleUpdateQuantity = (index, newQty) => {
    const qty = parseInt(newQty) || 0;
    
    if (qty <= 0) {
      handleRemoveItem(index);
      return;
    }

    // Update quantity in local cart
    const updated = [...orderItems];
    updated[index].quantity = qty;
    updated[index].line_total = updated[index].price * qty;
    setOrderItems(updated);
  };

  const calculateTotals = () => {
    const subtotal = orderItems.reduce((sum, item) => sum + item.line_total, 0);
    const discountAmount = parseFloat(discount) || 0;
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const tax = taxableAmount * 0.1; // 10% tax
    const total = subtotal - discountAmount + tax;
    const balance = Math.max(0, total - totalPaid);

    return { subtotal, discountAmount, tax, total, balance };
  };

  // Fetch order summary from server to sync totals and payments
  const fetchOrderSummary = async () => {
    if (!orderId) return;

    try {
      const response = await window.pos.orders.getSummary(orderId);
      const summary = response?.data || response;
      
      if (summary) {
        // Update payment info from server
        if (summary.total_paid !== undefined) {
          setTotalPaid(parseFloat(summary.total_paid));
        }
        if (summary.balance !== undefined) {
          setOrderBalance(parseFloat(summary.balance));
        }
        
        log.info('Order summary synced:', summary);
      }
    } catch (err) {
      log.error('Error fetching order summary:', err);
      // Continue with local calculation if API fails
    }
  };

  // Update totals after operations
  useEffect(() => {
    if (orderId && orderItems.length > 0) {
      // Debounce summary fetch to avoid too many API calls
      const timer = setTimeout(() => {
        fetchOrderSummary();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [orderItems, discount, orderId]);

  const validateOrder = () => {
    if (orderItems.length === 0) {
      showToast('Please add at least one product', 'error');
      return false;
    }

    if (!branchId) {
      showToast('Please select a branch', 'error');
      return false;
    }

    return true;
  };

  const handleHoldOrder = async () => {
    if (!validateOrder()) return;

    try {
      setIsSubmitting(true);

      // Note: Hold functionality would need to save items to backend
      // For now, just show message and keep items in cart
      log.info('Order held with items:', orderItems);
      
      showToast('Order items saved in cart', 'success');
      
    } catch (err) {
      log.error('Error holding order:', err);
      showToast(err.message || 'Failed to hold order', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenPaymentModal = () => {
    if (!validateOrder()) return;

    setPaymentAmount('');
    setPaymentMethod('cash');
    setShowPaymentModal(true);
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentAmount('');
    setPaymentMethod('cash');
  };

  const handleSetQuickAmount = (amount) => {
    if (amount === 'exact') {
      const { total } = calculateTotals();
      setPaymentAmount(total.toFixed(2));
    } else {
      setPaymentAmount(amount.toString());
    }
    paymentAmountInputRef.current?.focus();
  };

  const calculateChange = () => {
    const { total } = calculateTotals();
    const paid = parseFloat(paymentAmount) || 0;
    return Math.max(0, paid - total);
  };

  const handleCompleteOrder = async () => {
    const { total } = calculateTotals();
    const paid = parseFloat(paymentAmount) || 0;

    if (paid < total) {
      showToast('Payment amount is less than order total', 'error');
      return;
    }

    if (!paymentMethod) {
      showToast('Please select a payment method', 'error');
      return;
    }

    if (orderItems.length === 0) {
      showToast('Cannot complete order with no items', 'error');
      return;
    }

    try {
      setIsSubmitting(true);

      // Prepare order data for single API call
      const { subtotal, discountAmount, tax } = calculateTotals();
      const orderData = {
        items: orderItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: parseFloat(item.price)
        })),
        payment: {
          method: paymentMethod,
          amount: paid,
          reference: `${paymentMethod.toUpperCase()}-${Date.now()}`
        },
        discount: parseFloat(discount) || 0,
        tax_rate: 0.1, // 10% tax
        notes: notes || 'Quick sale',
        branch_id: parseInt(branchId)
      };

      log.info('Quick checkout with single API call:', orderData);
      
      // Single API call to complete entire order
      const response = await window.pos.orders.quickCheckout(orderData);
      const completedOrder = response?.data || response;
      
      // Update state with completed order
      setOrderId(completedOrder.id);
      setOrderNumber(completedOrder.order_number);
      setOrderStatus('completed');
      setIsOrderCompleted(true);
      setTotalPaid(paid);
      
      const change = calculateChange();
      const changeMsg = change > 0 
        ? `Order #${completedOrder.order_number} completed! Change: ${formatCurrency(change)}`
        : `Order #${completedOrder.order_number} completed successfully!`;
      
      showToast(changeMsg, 'success');
      
      setLastCompletedOrderId(completedOrder.id);
      handleClosePaymentModal();
      
      // Reset form after brief success display (800ms for instant readiness)
      setTimeout(() => {
        resetForm();
      }, 800);
      
    } catch (err) {
      log.error('Error completing order:', err);
      showToast(err.message || 'Failed to complete order', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    // Clear all order state
    setOrderId(null);
    setOrderNumber(null);
    setOrderStatus('draft');
    setIsOrderCompleted(false);
    setOrderItems([]);
    setSelectedCartItemIndex(-1);
    setBranchId(currentUser?.branch_id || 1);
    setDiscount(0);
    setNotes('');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedResultIndex(-1);
    setQuantity(1);
    setTotalPaid(0);
    setOrderBalance(0);
    setLastCompletedOrderId(null);
    
    // Focus product input for instant next order entry
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  // Quick Pay Functions
  const handleOpenQuickPayModal = () => {
    if (!validateOrder()) return;

    const { total } = calculateTotals();
    setQuickPayAmount(total.toFixed(2));
    setQuickPayMethod('cash');
    setShowQuickPayModal(true);
  };

  const handleCloseQuickPayModal = () => {
    setShowQuickPayModal(false);
    setQuickPayAmount('');
    setQuickPayMethod('cash');
  };

  const handleQuickPaySubmit = async () => {
    const amount = parseFloat(quickPayAmount) || 0;
    const { total } = calculateTotals();

    if (amount <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }

    if (amount < total) {
      showToast('Payment amount is less than order total', 'error');
      return;
    }

    if (!quickPayMethod) {
      showToast('Please select a payment method', 'error');
      return;
    }

    if (orderItems.length === 0) {
      showToast('Cannot complete order with no items', 'error');
      return;
    }

    try {
      setIsSubmitting(true);

      // Prepare order data for single API call
      const orderData = {
        items: orderItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: parseFloat(item.price)
        })),
        payment: {
          method: quickPayMethod,
          amount: amount,
          reference: `${quickPayMethod.toUpperCase()}-${Date.now()}`
        },
        discount: parseFloat(discount) || 0,
        tax_rate: 0.1,
        notes: notes || 'Quick sale',
        branch_id: parseInt(branchId)
      };

      log.info('Quick Pay - completing order with single API call:', orderData);
      
      // Single API call to complete entire order
      const response = await window.pos.orders.quickCheckout(orderData);
      const completedOrder = response?.data || response;
      
      // Update state with completed order
      setOrderId(completedOrder.id);
      setOrderNumber(completedOrder.order_number);
      setOrderStatus('completed');
      setIsOrderCompleted(true);
      setTotalPaid(amount);
      
      const change = Math.max(0, amount - total);
      const changeMsg = change > 0 
        ? `Order #${completedOrder.order_number} completed! Change: ${formatCurrency(change)}`
        : `Order #${completedOrder.order_number} completed successfully!`;
      
      showToast(changeMsg, 'success');
      handleCloseQuickPayModal();
      
      // Reset form after brief success display (800ms)
      setTimeout(() => {
        resetForm();
      }, 800);
      
    } catch (err) {
      log.error('Error completing order:', err);
      showToast(err.message || 'Failed to complete order', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickPayKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleQuickPaySubmit();
    }
  };

  const handleCancelOrder = async () => {
    if (orderItems.length === 0) {
      showToast('No order to cancel', 'info');
      return;
    }

    if (!window.confirm('Cancel this order? This action cannot be undone.')) {
      return;
    }

    if (!orderId) {
      // No orderId yet, just clear local state
      await resetForm();
      showToast('Order cancelled', 'info');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Cancel order via API
      log.info('Cancelling order:', orderId);
      await window.pos.orders.cancel(orderId);
      
      setOrderStatus('cancelled');
      showToast(`Order #${orderNumber || orderId} cancelled`, 'info');
      
      // Reset form
      setTimeout(() => {
        resetForm();
      }, 1500);
      
    } catch (err) {
      log.error('Error cancelling order:', err);
      showToast(err.message || 'Failed to cancel order', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewOrder = async () => {
    if (orderItems.length > 0 && orderId) {
      if (!window.confirm('Start a new order? Current order will be cancelled.')) {
        return;
      }
      
      // Cancel current order if it exists
      try {
        await window.pos.orders.cancel(orderId);
        log.info('Cancelled order:', orderId);
      } catch (err) {
        log.error('Error cancelling order:', err);
      }
    }
    
    setLastCompletedOrderId(null);
    await resetForm();
    showToast('Ready for new order', 'info');
  };

  // Calculate totals for render
  const { subtotal, discountAmount, tax, total, balance } = calculateTotals();
  const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const changeAmount = calculateChange();

  return (
    <div>
      {/* Completion Success Indicator */}
      {isOrderCompleted && orderStatus === 'completed' && (
        <div className="completion-overlay">
          <div className="completion-card">
            <div className="completion-icon">✓</div>
            <h2>Order Completed!</h2>
            <p className="completion-order-number">Order #{orderNumber || orderId}</p>
            <p className="completion-message">All inputs are now locked</p>
            <p className="completion-reset">Starting new order...</p>
          </div>
        </div>
      )}

      {/* Cancellation Indicator */}
      {orderStatus === 'cancelled' && (
        <div className="completion-overlay">
          <div className="completion-card cancellation">
            <div className="completion-icon cancel-icon">✕</div>
            <h2>Order Cancelled</h2>
            <p className="completion-order-number">Order #{orderNumber || orderId}</p>
            <p className="completion-reset">Resetting...</p>
          </div>
        </div>
      )}

      {/* Main Content - Two Panels */}
      <div className="pos-content">
        {/* Left Panel - Product Search & Cart */}
        <div className="left-panel">
          {/* Search Section */}
          <div className="search-section">
            <div className="search-header">
              <label>🔍 Add Product (Scan or Search)</label>
              <div className="qty-control">
                <label htmlFor="quantity">Qty:</label>
                <input
                  ref={quantityInputRef}
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="qty-input"
                  disabled={isOrderCompleted}
                  title="F2 to focus"
                />
              </div>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Scan barcode or type product name/SKU... (F2)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              disabled={isOrderCompleted}
            />
            {searchQuery && (
              <div className="search-hint">
                Press ↑↓ to navigate, Enter to add, ESC to clear
              </div>
            )}

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((product, index) => (
                  <div
                    key={product.id}
                    className={`result-item ${index === selectedResultIndex ? 'selected' : ''}`}
                    onClick={() => handleAddProduct(product)}
                    onMouseEnter={() => setSelectedResultIndex(index)}
                  >
                    <div className="result-info">
                      <div className="result-name">{product.name}</div>
                      <div className="result-sku">SKU: {product.sku}</div>
                    </div>
                    <div className="result-price">{formatCurrency(product.price)}</div>
                  </div>
                ))}
              </div>
            )}

            {isSearching && (
              <div className="search-loading">🔄 Searching products...</div>
            )}
            
            {searchQuery && searchResults.length === 0 && !isSearching && (
              <div className="search-empty">No products found. Try different keywords.</div>
            )}
          </div>

          {/* Cart Section */}
          <div className="cart-section">
            <div className="cart-header">
              <h3>🛒 ORDER ITEMS</h3>
              <span className="items-count">{orderItems.length} items</span>
            </div>

            {orderItems.length === 0 ? (
              <div className="empty-cart">
                <p>No items yet</p>
                <span>Add products to start building order</span>
              </div>
            ) : (
              <div className="cart-table-container">
                <table className="cart-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="text-center">Qty</th>
                      <th className="text-right">Price</th>
                      <th className="text-right">Total</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item, index) => (
                      <tr
                        key={index}
                        className={`cart-table-row ${index === selectedCartItemIndex ? 'selected' : ''}`}
                        onClick={() => setSelectedCartItemIndex(index)}
                      >
                        <td>
                          <div className="product-cell">
                            <div className="product-name">{item.product_name}</div>
                            <div className="product-sku">{item.sku}</div>
                          </div>
                        </td>
                        <td className="text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateQuantity(index, e.target.value)}
                            className="qty-table-input"
                            disabled={isOrderCompleted}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="text-right price-cell">
                          {formatCurrency(item.price)}
                        </td>
                        <td className="text-right total-cell">
                          {formatCurrency(item.line_total)}
                        </td>
                        <td className="text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveItem(index);
                            }}
                            className="btn-remove-table"
                            disabled={isOrderCompleted}
                            title="Delete key to remove"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="cart-keyboard-hint">
                  <kbd>↑</kbd> <kbd>↓</kbd> Navigate • <kbd>Delete</kbd> Remove • <kbd>ESC</kbd> Cancel Order
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Order Info & Totals */}
        <div className="right-panel">
          {/* Discount Section */}
          <div className="info-section">
            <h3>💵 Discount & Adjustments</h3>
            
            <div className="form-group">
              <label htmlFor="discount">Discount ($)</label>
              <input
                id="discount"
                type="number"
                step="0.01"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0.00"
                className="form-input"
                disabled={isOrderCompleted}
              />
            </div>
          </div>

          {/* Totals Section */}
          <div className="totals-section">
            <h3>💰 Order Summary</h3>
            
            <div className="totals-grid">
              <div className="total-row">
                <span className="total-label">Subtotal:</span>
                <span className="total-value">{formatCurrency(subtotal)}</span>
              </div>
              
              {discountAmount > 0 && (
                <div className="total-row discount">
                  <span className="total-label">Discount:</span>
                  <span className="total-value">-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              
              <div className="total-row">
                <span className="total-label">Tax (10%):</span>
                <span className="total-value">{formatCurrency(tax)}</span>
              </div>
              
              <div className="total-divider"></div>
              
              <div className="total-row grand">
                <span className="total-label">TOTAL:</span>
                <span className="total-value">{formatCurrency(total)}</span>
              </div>

              {totalPaid > 0 && (
                <>
                  <div className="total-divider thin"></div>
                  
                  <div className="total-row paid">
                    <span className="total-label">Paid:</span>
                    <span className="total-value">-{formatCurrency(totalPaid)}</span>
                  </div>
                  
                  <div className="total-row balance">
                    <span className="total-label">Balance Due:</span>
                    <span className="total-value">{formatCurrency(balance)}</span>
                  </div>
                </>
              )}
            </div>

            {orderItems.length > 0 && (
              <div className="totals-summary">
                <div className="summary-item">
                  <span className="summary-icon">📦</span>
                  <span className="summary-text">
                    {orderItems.reduce((sum, item) => sum + item.quantity, 0)} items
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-icon">💵</span>
                  <span className="summary-text">
                    {balance > 0 ? `Due: ${formatCurrency(balance)}` : 'Paid in full'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Keyboard Shortcuts */}
          <div className="shortcuts-section">
            <h4>💡 Keyboard Shortcuts</h4>
            <div className="shortcut-list">
              <div className="shortcut"><kbd>F1</kbd> Focus Search</div>
              <div className="shortcut"><kbd>F2</kbd> Focus Quantity</div>
              <div className="shortcut"><kbd>↑↓</kbd> Navigate Items</div>
              <div className="shortcut"><kbd>Enter</kbd> Add Product</div>
              <div className="shortcut"><kbd>Delete</kbd> Remove Selected</div>
              <div className="shortcut"><kbd>F8</kbd> Complete Order</div>
              <div className="shortcut"><kbd>F9</kbd> Hold Order</div>
              <div className="shortcut"><kbd>ESC</kbd> Clear Search</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Pay Modal */}
      {showQuickPayModal && (
        <div className="modal-overlay" onClick={handleCloseQuickPayModal}>
          <div className="modal-content quick-pay-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚡ Quick Pay</h2>
              <button onClick={handleCloseQuickPayModal} className="btn-close">×</button>
            </div>

            <div className="modal-body">
              <div className="order-total-display">
                <div className="total-row">
                  <span>Order Total:</span>
                  <span className="total-amount">{formatCurrency(total)}</span>
                </div>
                {totalPaid > 0 && (
                  <>
                    <div className="total-row paid">
                      <span>Already Paid:</span>
                      <span>-{formatCurrency(totalPaid)}</span>
                    </div>
                    <div className="total-row balance">
                      <span>Balance Due:</span>
                      <span className="balance-amount">{formatCurrency(balance)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Payment Method */}
              <div className="form-group">
                <label>Payment Method:</label>
                <div className="payment-methods">
                  <label className={`payment-option ${quickPayMethod === 'cash' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="quickPayMethod"
                      value="cash"
                      checked={quickPayMethod === 'cash'}
                      onChange={(e) => setQuickPayMethod(e.target.value)}
                    />
                    <span>💵 Cash</span>
                  </label>
                  <label className={`payment-option ${quickPayMethod === 'card' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="quickPayMethod"
                      value="card"
                      checked={quickPayMethod === 'card'}
                      onChange={(e) => setQuickPayMethod(e.target.value)}
                    />
                    <span>💳 Card</span>
                  </label>
                  <label className={`payment-option ${quickPayMethod === 'digital' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="quickPayMethod"
                      value="digital"
                      checked={quickPayMethod === 'digital'}
                      onChange={(e) => setQuickPayMethod(e.target.value)}
                    />
                    <span>📱 Digital</span>
                  </label>
                </div>
              </div>

              {/* Payment Amount */}
              <div className="form-group">
                <label htmlFor="quickPayAmount">Payment Amount:</label>
                <input
                  ref={quickPayInputRef}
                  id="quickPayAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={quickPayAmount}
                  onChange={(e) => setQuickPayAmount(e.target.value)}
                  onKeyPress={handleQuickPayKeyPress}
                  className="form-input large"
                  placeholder="0.00"
                />
                <div className="input-hint">Press Enter to submit</div>
              </div>

              {/* Quick Amount Buttons */}
              <div className="quick-amounts">
                <button onClick={() => setQuickPayAmount(balance.toFixed(2))} className="btn-quick">
                  Full Balance
                </button>
                <button onClick={() => setQuickPayAmount('50')} className="btn-quick">
                  $50
                </button>
                <button onClick={() => setQuickPayAmount('100')} className="btn-quick">
                  $100
                </button>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                onClick={handleCloseQuickPayModal} 
                className="btn-cancel"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                onClick={handleQuickPaySubmit}
                className="btn-submit"
                disabled={isSubmitting || parseFloat(quickPayAmount) <= 0}
              >
                {isSubmitting ? '⏳ Processing...' : '✓ Submit Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Pay Modal */}
      {showQuickPayModal && (
        <div className="modal-overlay" onClick={handleCloseQuickPayModal}>
          <div className="modal-content quick-pay-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚡ Quick Pay</h2>
              <button onClick={handleCloseQuickPayModal} className="btn-close">×</button>
            </div>

            <div className="modal-body">
              <div className="order-total-display">
                <div className="total-row">
                  <span>Order Total:</span>
                  <span className="total-amount">{formatCurrency(total)}</span>
                </div>
                {totalPaid > 0 && (
                  <>
                    <div className="total-row paid">
                      <span>Already Paid:</span>
                      <span>-{formatCurrency(totalPaid)}</span>
                    </div>
                    <div className="total-row balance">
                      <span>Balance Due:</span>
                      <span className="balance-amount">{formatCurrency(balance)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Payment Method */}
              <div className="form-group">
                <label>Payment Method:</label>
                <div className="payment-methods">
                  <label className={`payment-option ${quickPayMethod === 'cash' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="quickPayMethod"
                      value="cash"
                      checked={quickPayMethod === 'cash'}
                      onChange={(e) => setQuickPayMethod(e.target.value)}
                    />
                    <span>💵 Cash</span>
                  </label>
                  <label className={`payment-option ${quickPayMethod === 'card' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="quickPayMethod"
                      value="card"
                      checked={quickPayMethod === 'card'}
                      onChange={(e) => setQuickPayMethod(e.target.value)}
                    />
                    <span>💳 Card</span>
                  </label>
                  <label className={`payment-option ${quickPayMethod === 'digital' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="quickPayMethod"
                      value="digital"
                      checked={quickPayMethod === 'digital'}
                      onChange={(e) => setQuickPayMethod(e.target.value)}
                    />
                    <span>📱 Digital</span>
                  </label>
                </div>
              </div>

              {/* Payment Amount */}
              <div className="form-group">
                <label htmlFor="quickPayAmount">Payment Amount:</label>
                <input
                  ref={quickPayInputRef}
                  id="quickPayAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={quickPayAmount}
                  onChange={(e) => setQuickPayAmount(e.target.value)}
                  onKeyPress={handleQuickPayKeyPress}
                  className="form-input large"
                  placeholder="0.00"
                />
                <div className="input-hint">Press Enter to submit</div>
              </div>

              {/* Quick Amount Buttons */}
              <div className="quick-amounts">
                <button onClick={() => setQuickPayAmount(balance.toFixed(2))} className="btn-quick">
                  Full Balance
                </button>
                <button onClick={() => setQuickPayAmount('50')} className="btn-quick">
                  $50
                </button>
                <button onClick={() => setQuickPayAmount('100')} className="btn-quick">
                  $100
                </button>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                onClick={handleCloseQuickPayModal} 
                className="btn-cancel"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                onClick={handleQuickPaySubmit}
                className="btn-submit"
                disabled={isSubmitting || parseFloat(quickPayAmount) <= 0}
              >
                {isSubmitting ? '⏳ Processing...' : '✓ Submit Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={handleClosePaymentModal}>
          <div className="modal-content payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💳 Complete Order & Payment</h2>
              <button onClick={handleClosePaymentModal} className="btn-close">×</button>
            </div>

            <div className="modal-body">
              <div className="order-total-display">
                <span>Order Total:</span>
                <span className="total-amount">{formatCurrency(total)}</span>
              </div>

              {/* Payment Method */}
              <div className="form-group">
                <label>Payment Method:</label>
                <div className="payment-methods">
                  <label className={`payment-option ${paymentMethod === 'cash' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash"
                      checked={paymentMethod === 'cash'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    <span>💵 Cash</span>
                  </label>
                  <label className={`payment-option ${paymentMethod === 'card' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="card"
                      checked={paymentMethod === 'card'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    <span>💳 Card</span>
                  </label>
                  <label className={`payment-option ${paymentMethod === 'digital' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="digital"
                      checked={paymentMethod === 'digital'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    <span>📱 Digital</span>
                  </label>
                </div>
              </div>

              {/* Payment Amount */}
              <div className="form-group">
                <label htmlFor="paymentAmount">Amount Received:</label>
                <input
                  ref={paymentAmountInputRef}
                  id="paymentAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCompleteOrder();
                    }
                  }}
                  className="form-input large"
                  placeholder="0.00"
                />
              </div>

              {/* Quick Amount Buttons */}
              <div className="quick-amounts">
                <button onClick={() => handleSetQuickAmount('exact')} className="btn-quick">
                  Exact
                </button>
                <button onClick={() => handleSetQuickAmount(50)} className="btn-quick">
                  $50
                </button>
                <button onClick={() => handleSetQuickAmount(100)} className="btn-quick">
                  $100
                </button>
              </div>

              {/* Change Display */}
              {parseFloat(paymentAmount) >= total && (
                <div className="change-display">
                  <span>Change to Return:</span>
                  <span className="change-amount">{formatCurrency(changeAmount)}</span>
                </div>
              )}

              {parseFloat(paymentAmount) < total && parseFloat(paymentAmount) > 0 && (
                <div className="insufficient-payment">
                  ⚠️ Insufficient payment amount
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button 
                onClick={handleClosePaymentModal} 
                className="btn-cancel"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                onClick={handleCompleteOrder}
                className="btn-submit"
                disabled={isSubmitting || parseFloat(paymentAmount) < total}
              >
                {isSubmitting ? '⏳ Processing...' : '✓ Complete Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default POSOrder;
