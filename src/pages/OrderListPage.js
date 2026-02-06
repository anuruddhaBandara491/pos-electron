import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import RoleManager from '../utils/RoleManager';
import '../styles/OrderListPage.css';
import log from '../utils/logger';

export default function OrderListPage() {
  const navigate = useNavigate();
  const { currentUser, userRoles, userPermissions } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    per_page: 15,
    current_page: 1,
    last_page: 1
  });
  
  // Filter State
  const [filters, setFilters] = useState({
    branch_id: currentUser?.branch_id || '',
    status: '',
    date_from: '',
    date_to: ''
  });
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    branch_id: currentUser?.branch_id || 1,
    discount: '0',
    notes: '',
    status: 'pending'
  });
  const [formErrors, setFormErrors] = useState({});
  const [createdOrderId, setCreatedOrderId] = useState(null);

  // Create user object with permissions for RoleManager
  const userWithPermissions = {
    ...currentUser,
    roles: userRoles,
    permissions: userPermissions
  };

  // Check permissions
  const canViewOrders = RoleManager.hasPermission(userWithPermissions, 'view_orders');
  const canEditOrders = RoleManager.hasPermission(userWithPermissions, 'edit_order');
  const canCreateOrders = RoleManager.hasPermission(userWithPermissions, 'create_order');

  useEffect(() => {
    loadOrders();
  }, []);

  // Reload when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrders(1);
    }, 500); // Debounce
    
    return () => clearTimeout(timer);
  }, [filters, sortBy, sortOrder]);

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

  const loadOrders = async (page = 1) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Build query parameters
      const params = { page };
      
      // Add filters
      if (filters.branch_id) {
        params.branch_id = filters.branch_id;
      }
      
      if (filters.status) {
        params.status = filters.status;
      }

      if (filters.date_from) {
        params.date_from = filters.date_from;
      }

      if (filters.date_to) {
        params.date_to = filters.date_to;
      }
      
      // Add sorting
      params.sort_by = sortBy;
      params.sort_order = sortOrder;

      const response = await window.pos.orders.getAll(params);
      
      // Handle nested data structure from API
      const responseData = response?.data || response;
      const orderData = responseData?.data || responseData || [];
      setOrders(Array.isArray(orderData) ? orderData : []);
      
      // Handle pagination
      if (responseData?.pagination) {
        setPagination(responseData.pagination);
      } else if (response?.meta) {
        setPagination({
          total: response.meta.total || 0,
          per_page: response.meta.per_page || 15,
          current_page: response.meta.current_page || 1,
          last_page: response.meta.last_page || 1
        });
      }
      
    } catch (err) {
      log.error('Error loading orders:', err);
      setError(err.message || 'Failed to load orders');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextPage = () => {
    if (pagination.current_page < pagination.last_page) {
      loadOrders(pagination.current_page + 1);
    }
  };

  const handlePrevPage = () => {
    if (pagination.current_page > 1) {
      loadOrders(pagination.current_page - 1);
    }
  };

  const handleOpenModal = () => {
    setFormData({
      branch_id: currentUser?.branch_id || 1,
      discount: '0',
      notes: '',
      status: 'pending'
    });
    setFormErrors({});
    setCreatedOrderId(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormErrors({});
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors({ ...formErrors, [name]: null });
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.branch_id) {
      errors.branch_id = 'Branch is required';
    }

    if (formData.discount === '' || parseFloat(formData.discount) < 0) {
      errors.discount = 'Valid discount is required (0 or greater)';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showToast('Please fix the form errors', 'error');
      return;
    }

    try {
      const orderPayload = {
        branch_id: parseInt(formData.branch_id),
        discount: parseFloat(formData.discount),
        notes: formData.notes?.trim() || null,
        status: formData.status
      };

      log.info('Creating order:', orderPayload);
      const response = await window.pos.orders.create(orderPayload);
      
      const newOrder = response?.data || response;
      const orderId = newOrder?.id;
      
      if (orderId) {
        setCreatedOrderId(orderId);
        showToast(`Order #${orderId} created successfully!`, 'success');
        log.info('Order created with ID:', orderId);
        
        // Reload orders list
        loadOrders();
        
        // Close modal after a short delay
        setTimeout(() => {
          handleCloseModal();
        }, 1500);
      } else {
        showToast('Order created but ID not returned', 'info');
        loadOrders();
        handleCloseModal();
      }
    } catch (err) {
      log.error('Error creating order:', err);
      showToast(err.message || 'Failed to create order', 'error');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const getStatusBadge = (status) => {
    const statusClass = `status-badge status-${status?.toLowerCase() || 'unknown'}`;
    return <span className={statusClass}>{status || 'Unknown'}</span>;
  };

  const clearFilters = () => {
    setFilters({
      branch_id: currentUser?.branch_id || '',
      status: '',
      date_from: '',
      date_to: ''
    });
  };

  if (!canViewOrders) {
    return (
      <div className="orders-list-page">
        <div className="error-container">
          <p>You don't have permission to view orders.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-list-page">
      <div className="page-header">
        <h1>Orders</h1>
        {canCreateOrders && (
          <button className="create-btn" onClick={handleOpenModal}>
            + Create Order
          </button>
        )}
      </div>

      {/* Create Order Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Order</h2>
              <button className="close-btn" onClick={handleCloseModal}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="order-form">
              <div className="form-group">
                <label htmlFor="branch_id">Branch ID *</label>
                <input
                  type="number"
                  id="branch_id"
                  name="branch_id"
                  value={formData.branch_id}
                  onChange={handleInputChange}
                  className={formErrors.branch_id ? 'error' : ''}
                  min="1"
                />
                {formErrors.branch_id && <span className="error-text">{formErrors.branch_id}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="discount">Discount</label>
                <input
                  type="number"
                  id="discount"
                  name="discount"
                  value={formData.discount}
                  onChange={handleInputChange}
                  className={formErrors.discount ? 'error' : ''}
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
                {formErrors.discount && <span className="error-text">{formErrors.discount}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="4"
                  placeholder="Enter any notes for this order"
                />
              </div>

              <div className="form-group">
                <label htmlFor="status">Status</label>
                <input
                  type="text"
                  id="status"
                  name="status"
                  value={formData.status}
                  disabled
                  className="disabled-input"
                />
                <span className="helper-text">New orders start as pending</span>
              </div>

              {createdOrderId && (
                <div className="success-message">
                  ✓ Order created with ID: {createdOrderId}
                </div>
              )}

              <div className="form-footer">
                <button type="button" onClick={handleCloseModal} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="filters-row">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="filter-select"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
            className="filter-input"
            placeholder="From Date"
          />

          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
            className="filter-input"
            placeholder="To Date"
          />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="filter-select"
          >
            <option value="created_at">Date</option>
            <option value="total">Total</option>
            <option value="order_number">Order Number</option>
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="filter-select"
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>

        {(filters.status || filters.date_from || filters.date_to) && (
          <div className="active-filters">
            <span>Active Filters:</span>
            <button onClick={clearFilters} className="clear-filters-btn">
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-container">
          <p>{error}</p>
          <button onClick={() => loadOrders()} className="retry-btn">
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="loading-container">
          <p>Loading orders...</p>
        </div>
      )}

      {/* Orders Table */}
      {!isLoading && !error && (
        <>
          {orders.length === 0 ? (
            <div className="empty-state">
              <p>No orders found.</p>
            </div>
          ) : (
            <>
              <div className="table-container">
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>Order Number</th>
                      <th>Date</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td>{order.order_number || `#${order.id}`}</td>
                        <td>{formatDate(order.created_at)}</td>
                        <td className="total-cell">{formatCurrency(order.total)}</td>
                        <td>{getStatusBadge(order.status)}</td>
                        <td>
                          <button 
                            className="view-btn"
                            onClick={() => navigate(`/orders/${order.id}`)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.total > 0 && (
                <div className="pagination">
                  <button 
                    onClick={handlePrevPage}
                    disabled={pagination.current_page === 1}
                    className="pagination-btn"
                  >
                    Previous
                  </button>
                  
                  <span className="pagination-info">
                    Page {pagination.current_page} of {pagination.last_page} ({pagination.total} total)
                  </span>
                  
                  <button 
                    onClick={handleNextPage}
                    disabled={pagination.current_page === pagination.last_page}
                    className="pagination-btn"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
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
