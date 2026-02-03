import React from 'react';
import '../styles/Forms.css';

/**
 * Reusable Category Form Component
 * Used for both creating and updating categories
 * 
 * @param {Object} formData - Current form data { name, description }
 * @param {Object} formErrors - Validation errors { name, description }
 * @param {Function} onInputChange - Handler for input changes
 * @param {Function} onSubmit - Handler for form submission
 * @param {Function} onCancel - Handler for cancel action
 * @param {boolean} isEditing - Whether in edit mode (affects button text)
 */
export default function CategoryForm({ 
  formData, 
  formErrors, 
  onInputChange, 
  onSubmit, 
  onCancel,
  isEditing = false 
}) {
  return (
    <form onSubmit={onSubmit} className="form-component">
      <div className="form-group">
        <label htmlFor="name">Category Name *</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={onInputChange}
          className={formErrors.name ? 'error' : ''}
          placeholder="e.g., Beverages"
          autoComplete="off"
        />
        {formErrors.name && (
          <span className="error-text">{formErrors.name}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={onInputChange}
          placeholder="Optional description"
          rows="3"
        />
      </div>

      <div className="form-footer">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          {isEditing ? 'Update' : 'Create'} Category
        </button>
      </div>
    </form>
  );
}
