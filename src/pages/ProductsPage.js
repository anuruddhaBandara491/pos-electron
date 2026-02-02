import React, { useState, useEffect, useContext } from 'react';
import AuthContext from '../context/AuthContext';
import RoleManager from '../utils/RoleManager';
import '../styles/ProductsPage.css';
import log from '../utils/logger';

export default function ProductsPage() {
  const { currentUser, userRoles, userPermissions } = useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    per_page: 15,
    current_page: 1,
    last_page: 1
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [toast, setToast] = useState(null);
  const [formData, setFormData] = useState({
    branch_id: 1,
    sku: '',
    name: '',
    description: '',
    price: '',
    cost: '',
    stock_qty: '',
    reorder_level: '5',
    category: '',
    is_active: true
  });
  const [formErrors, setFormErrors] = useState({});

  // Create user object with permissions for RoleManager
  const userWithPermissions = {
    ...currentUser,
    roles: userRoles,
    permissions: userPermissions
  };

  // Check permissions
  const canCreate = RoleManager.hasPermission(userWithPermissions, 'create_product');
  const canEdit = RoleManager.hasPermission(userWithPermissions, 'edit_product');
  const canDelete = RoleManager.hasPermission(userWithPermissions, 'delete_product');
  const isAdmin = userRoles?.includes('admin');
  const isManager = userRoles?.includes('manager');

  useEffect(() => {
    loadProducts();
  }, []);

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

  const loadProducts = async (page = 1) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await window.pos.products.getAll({ page });
      
      // Handle different response formats
      const productData = response?.data?.data || response?.data || response || [];
      setProducts(Array.isArray(productData) ? productData : []);
      
      // Extract pagination data
      if (response?.data?.pagination) {
        setPagination(response.data.pagination);
      }
    } catch (err) {
      log.error('Error loading products:', err);
      const errorMessage = err.message || 'Failed to load products';
      
      // Provide helpful message for common errors
      if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
        setError('Backend error: The products endpoint returned an internal server error. This usually means the products table doesn\'t exist in your database yet, or there\'s an issue with the backend API implementation.');
      } else if (errorMessage.includes('404')) {
        setError('Products endpoint not found. Please ensure your backend API includes the /api/v1/products route.');
      } else if (errorMessage.includes('Not authenticated')) {
        setError('Authentication required. Please log in again.');
      } else {
        setError(errorMessage);
      }
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        branch_id: product.branch_id || 1,
        sku: product.sku || '',
        name: product.name || '',
        description: product.description || '',
        price: product.price || '',
        cost: product.cost || '',
        stock_qty: product.stock_qty || '',
        reorder_level: product.reorder_level || '5',
        category: product.category || '',
        is_active: product.is_active !== false
      });
    } else {
      setEditingProduct(null);
      setFormData({
        branch_id: 1,
        sku: '',
        name: '',
        description: '',
        price: '',
        cost: '',
        stock_qty: '',
        reorder_level: '5',
        category: '',
        is_active: true
      });
    }
    setFormErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setFormData({
      branch_id: 1,
      sku: '',
      name: '',
      description: '',
      price: '',
      cost: '',
      stock_qty: '',
      reorder_level: '5',
      category: '',
      is_active: true
    });
    setFormErrors({});
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.sku?.trim()) {
      errors.sku = 'SKU is required';
    }

    if (!formData.name?.trim()) {
      errors.name = 'Product name is required';
    }

    if (!formData.price || parseFloat(formData.price) < 0) {
      errors.price = 'Valid price is required';
    }

    if (!formData.cost || parseFloat(formData.cost) < 0) {
      errors.cost = 'Valid cost is required';
    }

    if (formData.stock_qty === '' || parseFloat(formData.stock_qty) < 0) {
      errors.stock_qty = 'Valid stock quantity is required';
    }

    if (!formData.category?.trim()) {
      errors.category = 'Category is required';
    }

    // Manager cannot deactivate products
    if (isManager && !isAdmin && editingProduct && !formData.is_active) {
      errors.is_active = 'Only administrators can deactivate products';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showToast('Please fix form errors', 'error');
      return;
    }

    try {
      setError(null);
      
      const payload = {
        branch_id: parseInt(formData.branch_id),
        sku: formData.sku.trim(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        cost: parseFloat(formData.cost),
        stock_qty: parseInt(formData.stock_qty),
        reorder_level: parseInt(formData.reorder_level),
        category: formData.category.trim(),
        is_active: formData.is_active
      };
      
      if (editingProduct) {
        await window.pos.products.update(editingProduct.id, payload);
        showToast('Product updated successfully', 'success');
      } else {
        await window.pos.products.create(payload);
        showToast('Product created successfully', 'success');
      }
      
      handleCloseModal();
      loadProducts(pagination.current_page);
    } catch (err) {
      log.error('Error saving product:', err);
      const errorMsg = err.message || 'Failed to save product';
      setError(errorMsg);
      showToast(errorMsg, 'error');
    }
  };

  const handleToggleStatus = async (product) => {
    if (!isAdmin) {
      showToast('Only administrators can activate/deactivate products', 'error');
      return;
    }

    try {
      setError(null);
      await window.pos.products.update(product.id, { is_active: !product.is_active });
      showToast(`Product ${!product.is_active ? 'activated' : 'deactivated'} successfully`, 'success');
      loadProducts(pagination.current_page);
    } catch (err) {
      log.error('Error toggling product status:', err);
      const errorMsg = err.message || 'Failed to update product status';
      setError(errorMsg);
      showToast(errorMsg, 'error');
    }
  };

  const handleDelete = async (product) => {
    if (!canDelete) {
      showToast('You do not have permission to delete products', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${product.name}"?`)) {
      return;
    }

    try {
      setError(null);
      await window.pos.products.delete(product.id);
      showToast('Product deleted successfully', 'success');
      
      // If we deleted the last item on the page and it's not page 1, go to previous page
      if (products.length === 1 && pagination.current_page > 1) {
        loadProducts(pagination.current_page - 1);
      } else {
        loadProducts(pagination.current_page);
      }
    } catch (err) {
      log.error('Error deleting product:', err);
      const errorMsg = err.message || 'Failed to delete product';
      setError(errorMsg);
      showToast(errorMsg, 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="products-page">
        <div className="loading">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="products-page">
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
          <button onClick={() => setToast(null)}>×</button>
        </div>
      )}

      <div className="page-header">
        <h1>Products</h1>
        {canCreate && (
          <button className="btn-primary" onClick={() => handleOpenModal()}>
            Add Product
          </button>
        )}
      </div>

      {error && (
        <div className="error-banner">
          <strong>⚠️ Error:</strong> {error}
          <button onClick={() => loadProducts(pagination.current_page)} className="btn-retry">
            🔄 Retry
          </button>
        </div>
      )}

      {products.length === 0 ? (
        <div className="empty-state">
          <p>No products found</p>
          {canCreate && (
            <button className="btn-primary" onClick={() => handleOpenModal()}>
              Add Your First Product
            </button>
          )}
        </div>
      ) : (
        <div className="table-container">
          <table className="products-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id}>
                  <td>{product.sku}</td>
                  <td>{product.name}</td>
                  <td>${parseFloat(product.price || 0).toFixed(2)}</td>
                  <td>{product.stock_qty || 0}</td>
                  <td>
                    <span className={`status-badge ${product.is_active ? 'active' : 'inactive'}`}>
                      {product.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="actions">
                    {canEdit && (
                      <button 
                        className="btn-edit" 
                        onClick={() => handleOpenModal(product)}
                        title="Edit product"
                      >
                        Edit
                      </button>
                    )}
                    {isAdmin && (
                      <button 
                        className="btn-toggle" 
                        onClick={() => handleToggleStatus(product)}
                        title={product.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {product.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                    {canDelete && (
                      <button 
                        className="btn-delete" 
                        onClick={() => handleDelete(product)}
                        title="Delete product"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination.total > 0 && (
            <div className="pagination">
              <button 
                className="pagination-btn" 
                onClick={() => loadProducts(pagination.current_page - 1)}
                disabled={pagination.current_page === 1}
              >
                Previous
              </button>
              
              <div className="pagination-info">
                Page {pagination.current_page} of {pagination.last_page}
                <span className="pagination-total"> ({pagination.total} total items)</span>
              </div>
              
              <button 
                className="pagination-btn" 
                onClick={() => loadProducts(pagination.current_page + 1)}
                disabled={pagination.current_page === pagination.last_page}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} className="product-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="sku">SKU / Barcode *</label>
                  <input
                    type="text"
                    id="sku"
                    name="sku"
                    value={formData.sku}
                    onChange={handleInputChange}
                    placeholder="Enter SKU or Barcode"
                    className={formErrors.sku ? 'error' : ''}
                  />
                  {formErrors.sku && <span className="error-text">{formErrors.sku}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="category">Category *</label>
                  <input
                    type="text"
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    placeholder="e.g., Beverages"
                    className={formErrors.category ? 'error' : ''}
                  />
                  {formErrors.category && <span className="error-text">{formErrors.category}</span>}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="name">Product Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter product name"
                  className={formErrors.name ? 'error' : ''}
                />
                {formErrors.name && <span className="error-text">{formErrors.name}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter product description"
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="price">Selling Price *</label>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={formErrors.price ? 'error' : ''}
                  />
                  {formErrors.price && <span className="error-text">{formErrors.price}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="cost">Cost Price *</label>
                  <input
                    type="number"
                    id="cost"
                    name="cost"
                    value={formData.cost}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={formErrors.cost ? 'error' : ''}
                  />
                  {formErrors.cost && <span className="error-text">{formErrors.cost}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="stock_qty">Stock Quantity *</label>
                  <input
                    type="number"
                    id="stock_qty"
                    name="stock_qty"
                    value={formData.stock_qty}
                    onChange={handleInputChange}
                    min="0"
                    placeholder="0"
                    className={formErrors.stock_qty ? 'error' : ''}
                  />
                  {formErrors.stock_qty && <span className="error-text">{formErrors.stock_qty}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="reorder_level">Reorder Level</label>
                  <input
                    type="number"
                    id="reorder_level"
                    name="reorder_level"
                    value={formData.reorder_level}
                    onChange={handleInputChange}
                    min="0"
                    placeholder="5"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    disabled={isManager && !isAdmin && editingProduct && !editingProduct.is_active}
                  />
                  <span>Active</span>
                </label>
                {formErrors.is_active && <span className="error-text">{formErrors.is_active}</span>}
                {isManager && !isAdmin && (
                  <small className="helper-text">Note: Only administrators can deactivate products</small>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingProduct ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
