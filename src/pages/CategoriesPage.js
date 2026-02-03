import React, { useState, useEffect, useContext } from 'react';
import AuthContext from '../context/AuthContext';
import RoleManager from '../utils/RoleManager';
import CategoryForm from '../components/CategoryForm';
import '../styles/CategoriesPage.css';
import log from '../utils/logger';

export default function CategoriesPage() {
  const { currentUser, userRoles, userPermissions } = useContext(AuthContext);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [toast, setToast] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [formErrors, setFormErrors] = useState({});

  // Create user object with permissions for RoleManager
  const userWithPermissions = {
    ...currentUser,
    roles: userRoles,
    permissions: userPermissions
  };

  // Check permissions
  const canCreate = RoleManager.hasPermission(userWithPermissions, 'create_category');
  const canEdit = RoleManager.hasPermission(userWithPermissions, 'edit_category');
  const canDelete = RoleManager.hasPermission(userWithPermissions, 'delete_category');

  useEffect(() => {
    loadCategories();
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

  const loadCategories = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await window.pos.categories.getAll();
      
      // Handle different response formats
      const categoryData = response?.data || response || [];
      setCategories(Array.isArray(categoryData) ? categoryData : []);
    } catch (err) {
      log.error('Error loading categories:', err);
      const errorMessage = err.message || 'Failed to load categories';
      
      if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
        setError('Backend error: The categories endpoint returned an internal server error.');
      } else if (errorMessage.includes('404')) {
        setError('Categories endpoint not found. Please ensure your backend API includes the /api/v1/categories route.');
      } else if (errorMessage.includes('Not authenticated')) {
        setError('Authentication required. Please log in again.');
      } else {
        setError(errorMessage);
      }
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name || '',
        description: category.description || ''
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        description: ''
      });
    }
    setFormErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({
      name: '',
      description: ''
    });
    setFormErrors({});
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name?.trim()) {
      errors.name = 'Category name is required';
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
        name: formData.name.trim(),
        description: formData.description.trim()
      };
      
      if (editingCategory) {
        await window.pos.categories.update(editingCategory.id, payload);
        showToast('Category updated successfully', 'success');
      } else {
        await window.pos.categories.create(payload);
        showToast('Category created successfully', 'success');
      }
      
      handleCloseModal();
      loadCategories();
    } catch (err) {
      log.error('Error saving category:', err);
      const errorMsg = err.message || 'Failed to save category';
      setError(errorMsg);
      showToast(errorMsg, 'error');
    }
  };

  const handleDelete = async (category) => {
    if (!canDelete) {
      showToast('You do not have permission to delete categories', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${category.name}"? Products using this category will have their category removed.`)) {
      return;
    }

    try {
      setError(null);
      await window.pos.categories.delete(category.id);
      showToast('Category deleted successfully', 'success');
      loadCategories();
    } catch (err) {
      log.error('Error deleting category:', err);
      const errorMsg = err.message || 'Failed to delete category';
      setError(errorMsg);
      showToast(errorMsg, 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="categories-page">
        <div className="loading">Loading categories...</div>
      </div>
    );
  }

  return (
    <div className="categories-page">
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
          <button onClick={() => setToast(null)}>×</button>
        </div>
      )}

      <div className="page-header">
        <h1>Categories</h1>
        {canCreate && (
          <button className="btn-primary" onClick={() => handleOpenModal()}>
            Add Category
          </button>
        )}
      </div>

      {error && (
        <div className="error-banner">
          <strong>⚠️ Error:</strong> {error}
          <button onClick={loadCategories} className="btn-retry">
            🔄 Retry
          </button>
        </div>
      )}

      {categories.length === 0 ? (
        <div className="empty-state">
          <p>No categories found</p>
          {canCreate && (
            <button className="btn-primary" onClick={() => handleOpenModal()}>
              Add Your First Category
            </button>
          )}
        </div>
      ) : (
        <div className="table-container">
          <table className="categories-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(category => (
                <tr key={category.id}>
                  <td>{category.name}</td>
                  <td>{category.description || '-'}</td>
                  <td className="actions">
                    {canEdit && (
                      <button 
                        className="btn-edit" 
                        onClick={() => handleOpenModal(category)}
                        title="Edit category"
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button 
                        className="btn-delete" 
                        onClick={() => handleDelete(category)}
                        title="Delete category"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCategory ? 'Edit Category' : 'Add Category'}</h2>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>
            
            <CategoryForm
              formData={formData}
              formErrors={formErrors}
              onInputChange={handleInputChange}
              onSubmit={handleSubmit}
              onCancel={handleCloseModal}
              isEditing={!!editingCategory}
            />
          </div>
        </div>
      )}
    </div>
  );
}
