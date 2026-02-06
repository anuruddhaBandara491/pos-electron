import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/POSOrderEntry.css';

const log = {
  info: (...args) => window.pos?.logInfo ? window.pos.logInfo(args.join(' ')) : console.log(...args),
  error: (...args) => window.pos?.logError ? window.pos.logError(args.join(' ')) : console.error(...args)
};

/**
 * POS Order Entry Screen
 * Keyboard-optimized for fast order processing
 * 
 * Keyboard Shortcuts:
 * - F1: Focus search
 * - F2: Focus quantity
 * - F8: Complete order
 * - F9: Hold order
 * - ESC: Clear/Cancel
 * - Enter: Add item
 */
function POSOrderEntry() {
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const quantityInputRef = useRef(null);

  // Order state
  const [orderItems, setOrderItems] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');

  // Product search
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // UI state
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [error, setError] = useState(null);

  // Focus search on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Search products
  useEffect(() => {
    const searchProducts = async () => {
      if (!searchQuery.trim()) {
        setProducts([]);
        return;
      }

      try {
        setIsSearching(true);
        const params = {
          search: searchQuery.trim(),
          per_page: 10,
          is_active: 'true'
        };

        const response = await window.pos.products.getAll(params);
        const productData = response?.data || response || [];
        setProducts(Array.isArray(productData) ? productData : []);
        setSelectedProductIndex(0);
      } catch (err) {
        log.error('Error searching products:', err);
        setProducts([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F1: Focus search
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      
      // F2: Focus quantity
      if (e.key === 'F2') {
        e.preventDefault();
        quantityInputRef.current?.focus();
        quantityInputRef.current?.select();
      }
      
      // F8: Complete order
      if (e.key === 'F8') {
        e.preventDefault();
        if (orderItems.length > 0) {
          handleOpenPayment();
        }
      }
      
      // F9: Hold/Save order
      if (e.key === 'F9') {
        e.preventDefault();
        if (orderItems.length > 0) {
          handleHoldOrder();
        }
      }
      
      // ESC: Clear search or cancel
      if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('');
          setProducts([]);
        }
      }

      // Arrow keys in product list
      if (products.length > 0 && document.activeElement === searchInputRef.current) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedProductIndex(prev => 
            prev < products.length - 1 ? prev + 1 : prev
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedProductIndex(prev => prev > 0 ? prev - 1 : 0);
        } else if (e.key === 'Enter' && products[selectedProductIndex]) {
          e.preventDefault();
          handleAddProduct(products[selectedProductIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, products, selectedProductIndex, orderItems]);

  const handleAddProduct = (product) => {
    const qty = parseInt(quantity) || 1;
    
    // Check if product already in cart
    const existingIndex = orderItems.findIndex(item => item.product_id === product.id);
    
    if (existingIndex >= 0) {
      // Update quantity
      const updated = [...orderItems];
      updated[existingIndex].quantity += qty;
      updated[existingIndex].line_total = updated[existingIndex].quantity * updated[existingIndex].price;
      setOrderItems(updated);
    } else {
      // Add new item
      const newItem = {
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        price: parseFloat(product.price),
        quantity: qty,
        line_total: parseFloat(product.price) * qty
      };
      setOrderItems([...orderItems, newItem]);
    }

    // Reset search
    setSearchQuery('');
    setProducts([]);
    setQuantity(1);
    searchInputRef.current?.focus();
  };

  const handleRemoveItem = (index) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleUpdateQuantity = (index, newQty) => {
    const qty = parseInt(newQty) || 0;
    if (qty <= 0) {
      handleRemoveItem(index);
      return;
    }

    const updated = [...orderItems];
    updated[index].quantity = qty;
    updated[index].line_total = updated[index].price * qty;
    setOrderItems(updated);
  };

  const calculateTotals = () => {
    const subtotal = orderItems.reduce((sum, item) => sum + item.line_total, 0);
    const discountAmount = parseFloat(discount) || 0;
    const tax = (subtotal - discountAmount) * 0.1; // 10% tax
    const total = subtotal - discountAmount + tax;

    return { subtotal, discountAmount, tax, total };
  };

  const handleOpenPayment = () => {
    const { total } = calculateTotals();
    setPaymentAmount(total.toFixed(2));
    setShowPaymentModal(true);
  };

  const handleHoldOrder = async () => {
    if (!branchId) {
      setError('Please enter Branch ID');
      return;
    }

    try {
      setIsSubmitting(true);
      const { subtotal, discountAmount, tax, total } = calculateTotals();

      const orderData = {
        branch_id: parseInt(branchId),
        discount: discountAmount,
        notes: notes || 'Held order',
        items: orderItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price
        })),
        subtotal,
        tax,
        total
      };

      await window.pos.orders.create(orderData);
      
      // Reset form
      setOrderItems([]);
      setDiscount(0);
      setNotes('');
      setError(null);
      
      alert('Order held successfully!');
    } catch (err) {
      log.error('Error holding order:', err);
      setError(err.message || 'Failed to hold order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteOrder = async () => {
    if (!branchId) {
      setError('Please enter Branch ID');
      return;
    }

    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      setError('Please enter valid payment amount');
      return;
    }

    try {
      setIsSubmitting(true);
      const { subtotal, discountAmount, tax, total } = calculateTotals();

      const orderData = {
        branch_id: parseInt(branchId),
        discount: discountAmount,
        notes: notes || '',
        items: orderItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price
        })),
        payment: {
          method: paymentMethod,
          amount: parseFloat(paymentAmount)
        },
        subtotal,
        tax,
        total,
        complete: true
      };

      await window.pos.orders.create(orderData);
      
      // Show success and reset
      alert(`Order completed! Change: $${(parseFloat(paymentAmount) - total).toFixed(2)}`);
      
      // Reset form
      setOrderItems([]);
      setDiscount(0);
      setNotes('');
      setBranchId('');
      setShowPaymentModal(false);
      setError(null);
      
      searchInputRef.current?.focus();
    } catch (err) {
      log.error('Error completing order:', err);
      setError(err.message || 'Failed to complete order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount || 0).toFixed(2)}`;
  };

  const { subtotal, discountAmount, tax, total } = calculateTotals();

  return (
    <div className="pos-order-entry">
      {/* Header */}
      <div className="pos-header">
        <div className="pos-title">
          <h1>⚡ POS Order Entry</h1>
          <span className="items-count">{orderItems.length} items</span>
        </div>
        <div className="pos-actions">
          <button onClick={() => navigate('/orders')} className="btn-secondary">
            📋 Orders List
          </button>
        </div>
      </div>

      <div className="pos-content">
        {/* Left Panel - Product Search & Cart */}
        <div className="pos-left">
          {/* Search Section */}
          <div className="search-section">
            <div className="search-header">
              <h3>Search Product (F1)</h3>
              <div className="search-controls">
                <label>Qty:</label>
                <input
                  ref={quantityInputRef}
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="quantity-input"
                />
              </div>
            </div>
            
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Type product name, SKU, or scan barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              autoComplete="off"
            />

            {/* Product Results */}
            {products.length > 0 && (
              <div className="product-results">
                {products.map((product, index) => (
                  <div
                    key={product.id}
                    className={`product-result-item ${index === selectedProductIndex ? 'selected' : ''}`}
                    onClick={() => handleAddProduct(product)}
                  >
                    <div className="product-info">
                      <div className="product-name">{product.name}</div>
                      <div className="product-sku">SKU: {product.sku}</div>
                    </div>
                    <div className="product-price">{formatCurrency(product.price)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Items */}
          <div className="cart-section">
            <h3>Cart Items</h3>
            {orderItems.length === 0 ? (
              <div className="empty-cart">
                <p>🛒 Cart is empty</p>
                <p className="hint">Start scanning or searching products</p>
              </div>
            ) : (
              <div className="cart-items">
                {orderItems.map((item, index) => (
                  <div key={index} className="cart-item">
                    <div className="item-details">
                      <div className="item-name">{item.product_name}</div>
                      <div className="item-sku">{item.sku}</div>
                      <div className="item-price">{formatCurrency(item.price)} each</div>
                    </div>
                    <div className="item-controls">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateQuantity(index, e.target.value)}
                        className="item-quantity"
                      />
                      <div className="item-total">{formatCurrency(item.line_total)}</div>
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="btn-remove"
                        title="Remove item"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Order Details & Totals */}
        <div className="pos-right">
          {/* Order Details */}
          <div className="order-details-section">
            <h3>Order Details</h3>
            
            <div className="form-group">
              <label>Branch ID *</label>
              <input
                type="number"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                placeholder="Enter branch ID"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Discount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0.00"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Order notes (optional)"
                rows="2"
                className="form-input"
              />
            </div>
          </div>

          {/* Totals */}
          <div className="totals-section">
            <h3>Order Summary</h3>
            
            <div className="total-row">
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            
            {discountAmount > 0 && (
              <div className="total-row discount">
                <span>Discount:</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            
            <div className="total-row">
              <span>Tax (10%):</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            
            <div className="total-row grand-total">
              <span>TOTAL:</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              onClick={handleHoldOrder}
              disabled={orderItems.length === 0 || isSubmitting}
              className="btn-hold"
            >
              💾 Hold Order (F9)
            </button>
            <button
              onClick={handleOpenPayment}
              disabled={orderItems.length === 0 || isSubmitting}
              className="btn-complete"
            >
              💳 Complete Order (F8)
            </button>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="shortcuts-hint">
            <strong>Shortcuts:</strong> F1-Search | F2-Qty | F8-Complete | F9-Hold | ESC-Clear
          </div>

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💳 Complete Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} className="close-btn">×</button>
            </div>

            <div className="modal-body">
              <div className="payment-summary">
                <div className="summary-row">
                  <span>Total Amount:</span>
                  <span className="amount">{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="form-group">
                <label>Payment Method</label>
                <div className="payment-methods">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`method-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
                  >
                    💵 Cash
                  </button>
                  <button
                    onClick={() => setPaymentMethod('card')}
                    className={`method-btn ${paymentMethod === 'card' ? 'active' : ''}`}
                  >
                    💳 Card
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Amount Received</label>
                <input
                  type="number"
                  step="0.01"
                  min={total}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="payment-input"
                  autoFocus
                />
              </div>

              {parseFloat(paymentAmount) >= total && (
                <div className="change-display">
                  Change: <strong>{formatCurrency(parseFloat(paymentAmount) - total)}</strong>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowPaymentModal(false)} className="btn-cancel">
                Cancel
              </button>
              <button
                onClick={handleCompleteOrder}
                disabled={isSubmitting || parseFloat(paymentAmount) < total}
                className="btn-submit"
              >
                {isSubmitting ? 'Processing...' : 'Complete Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default POSOrderEntry;
