import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/OrderCreatePage.css';

const log = {
  info: (...args) => window.pos?.logInfo ? window.pos.logInfo(args.join(' ')) : console.log(...args),
  error: (...args) => window.pos?.logError ? window.pos.logError(args.join(' ')) : console.error(...args)
};

/**
 * OrderCreatePage Component
 * User-friendly single-screen order creation
 * Add all products and complete order in one place
 */
function OrderCreatePage() {
  const navigate = useNavigate();
  const searchInputRef = useRef(null);

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
  const [error, setError] = useState(null);

  // Focus search on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Search products with debounce
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
      // Arrow keys navigation
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
      
      // ESC to clear search
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('');
        setProducts([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, products, selectedProductIndex]);

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

  const handleSaveOrder = async () => {
    if (!branchId) {
      setError('Please enter Branch ID');
      return;
    }

    if (orderItems.length === 0) {
      setError('Please add at least one product');
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
        subtotal,
        tax,
        total
      };

      log.info('Creating order:', orderData);
      const response = await window.pos.orders.create(orderData);
      const newOrder = response?.data?.data || response?.data || response;
      
      log.info('Order created successfully:', newOrder);
      
      // Navigate to order details
      if (newOrder?.id) {
        navigate(`/orders/${newOrder.id}`);
      } else {
        navigate('/orders');
      }
      
    } catch (err) {
      log.error('Error creating order:', err);
      setError(err.message || 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount || 0).toFixed(2)}`;
  };

  const { subtotal, discountAmount, tax, total } = calculateTotals();

  return (
    <div className="order-create-page-new">
      {/* Header */}
      <div className="create-header">
        <div className="header-left">
          <button onClick={() => navigate('/orders')} className="back-btn">
            ← Back
          </button>
          <h1>Create New Order</h1>
          <span className="items-badge">{orderItems.length} items</span>
        </div>
      </div>

      <div className="create-content">
        {/* Left: Product Search & Cart */}
        <div className="left-panel">
          {/* Search */}
          <div className="search-box">
            <div className="search-header">
              <h3>🔍 Search Products</h3>
              <div className="qty-control">
                <label>Qty:</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="qty-input"
                />
              </div>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Type name, SKU or scan barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-field"
            />

            {/* Results */}
            {products.length > 0 && (
              <div className="search-results">
                {products.map((product, index) => (
                  <div
                    key={product.id}
                    className={`result-item ${index === selectedProductIndex ? 'active' : ''}`}
                    onClick={() => handleAddProduct(product)}
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
          </div>

          {/* Cart */}
          <div className="cart-box">
            <h3>🛒 Cart Items</h3>
            {orderItems.length === 0 ? (
              <div className="empty-state">
                <p>Cart is empty</p>
                <span>Search and add products</span>
              </div>
            ) : (
              <div className="cart-list">
                {orderItems.map((item, index) => (
                  <div key={index} className="cart-item-row">
                    <div className="item-info">
                      <div className="item-name">{item.product_name}</div>
                      <div className="item-sku">{item.sku}</div>
                      <div className="item-price">{formatCurrency(item.price)} each</div>
                    </div>
                    <div className="item-actions">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateQuantity(index, e.target.value)}
                        className="qty-field"
                      />
                      <div className="item-subtotal">{formatCurrency(item.line_total)}</div>
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="remove-btn"
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

        {/* Right: Order Info & Totals */}
        <div className="right-panel">
          {/* Order Info */}
          <div className="info-box">
            <h3>📋 Order Information</h3>
            
            <div className="field-group">
              <label>Branch ID *</label>
              <input
                type="number"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                placeholder="Enter branch ID"
                className="field-input"
              />
            </div>

            <div className="field-group">
              <label>Discount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0.00"
                className="field-input"
              />
            </div>

            <div className="field-group">
              <label>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes (optional)"
                rows="3"
                className="field-input"
              />
            </div>
          </div>

          {/* Totals */}
          <div className="totals-box">
            <h3>💰 Order Total</h3>
            
            <div className="total-line">
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            
            {discountAmount > 0 && (
              <div className="total-line discount-line">
                <span>Discount:</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            
            <div className="total-line">
              <span>Tax (10%):</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            
            <div className="total-line grand">
              <span>TOTAL:</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="action-box">
            <button
              onClick={handleSaveOrder}
              disabled={orderItems.length === 0 || !branchId || isSubmitting}
              className="save-btn"
            >
              {isSubmitting ? '⏳ Creating...' : '✅ Create Order'}
            </button>
          </div>

          {error && (
            <div className="error-box">
              ⚠️ {error}
            </div>
          )}

          <div className="hints-box">
            <strong>💡 Tips:</strong> Use ↑↓ arrows to navigate results, Enter to add
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrderCreatePage;
