import React, { useState } from 'react';

// API base configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3100/api';

// Generic API request function for expiry cost
const apiCall = async (endpoint, method = 'GET', data = null) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (data && method !== 'GET') {
    config.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, config);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || `HTTP error! status: ${response.status}`);
    }

    return result;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

const EditExpiredMaterialModal = ({ material, materials, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    itemId: material.ITEM_ID || '',
    itemQty: material.ITEM_QTY || '',
    itemUnit: material.ITEM_UNIT || 'g',
    periode: material.PERIODE || '',
    userId: material.user_id || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get unique units from materials
  const getAvailableUnits = () => {
    const units = [...new Set(materials.map(m => m.Item_Unit).filter(Boolean))];
    return units.length > 0 ? units : ['g', 'kg', 'ml', 'l', 'pcs'];
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Auto-select unit when material is selected (if changed)
    if (name === 'itemId' && value) {
      const selectedMaterial = materials.find(m => m.ITEM_ID === value);
      if (selectedMaterial && selectedMaterial.Item_Unit) {
        setFormData(prev => ({
          ...prev,
          itemUnit: selectedMaterial.Item_Unit
        }));
      }
    }

    // Clear error when user starts typing
    if (error) setError('');
  };

  const validateForm = () => {
    if (!formData.itemId.trim()) {
      setError('Please select a material');
      return false;
    }

    if (!formData.itemQty || isNaN(formData.itemQty) || parseFloat(formData.itemQty) <= 0) {
      setError('Please enter a valid quantity (greater than 0)');
      return false;
    }

    if (!formData.itemUnit.trim()) {
      setError('Please select a unit');
      return false;
    }

    if (!formData.periode.trim()) {
      setError('Period is required');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setLoading(true);
      setError('');

      const submitData = {
        itemId: formData.itemId.trim(),
        itemQty: parseFloat(formData.itemQty),
        itemUnit: formData.itemUnit.trim(),
        periode: formData.periode.trim(),
        userId: formData.userId.trim() || 'SYSTEM',
        processDate: material.process_date // Keep original process date
      };

      const response = await apiCall(`/expiry-cost/${material.pk_id}`, 'PUT', submitData);

      if (response.success) {
        onSave(); // This will close modal and reload data
      } else {
        setError(response.message || 'Failed to update expired material record');
      }
    } catch (err) {
      setError('Error updating expired material: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedMaterial = materials.find(m => m.ITEM_ID === formData.itemId);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Edit Expired Material</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="itemId">Material *</label>
              <select
                id="itemId"
                name="itemId"
                value={formData.itemId}
                onChange={handleInputChange}
                className="form-control"
                required
                disabled={loading}
              >
                <option value="">-- Select Material --</option>
                {materials.map((mat) => (
                  <option key={mat.ITEM_ID} value={mat.ITEM_ID}>
                    {mat.ITEM_ID} - {mat.Item_Name}
                  </option>
                ))}
              </select>
            </div>

            {selectedMaterial && (
              <div className="form-group">
                <label>Selected Material Info</label>
                <div className="material-info">
                  <p><strong>Name:</strong> {selectedMaterial.Item_Name}</p>
                  <p><strong>Default Unit:</strong> {selectedMaterial.Item_Unit || 'Not specified'}</p>
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="itemQty">Quantity *</label>
              <input
                id="itemQty"
                name="itemQty"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.itemQty}
                onChange={handleInputChange}
                className="form-control"
                placeholder="Enter quantity"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="itemUnit">Unit *</label>
              <select
                id="itemUnit"
                name="itemUnit"
                value={formData.itemUnit}
                onChange={handleInputChange}
                className="form-control"
                required
                disabled={loading}
              >
                <option value="">-- Select Unit --</option>
                {getAvailableUnits().map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="periode">Period *</label>
              <input
                id="periode"
                name="periode"
                type="text"
                value={formData.periode}
                onChange={handleInputChange}
                className="form-control"
                placeholder="e.g., 2025"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="userId">User ID</label>
              <input
                id="userId"
                name="userId"
                type="text"
                value={formData.userId}
                onChange={handleInputChange}
                className="form-control"
                placeholder="User ID"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Process Date</label>
              <input
                type="text"
                value={new Date(material.process_date).toLocaleDateString()}
                className="form-control"
                disabled
              />
              <small style={{ color: '#666', fontSize: '12px' }}>
                Original process date is preserved during editing
              </small>
            </div>

            <div className="form-group">
              <label>Record ID</label>
              <input
                type="text"
                value={material.pk_id}
                className="form-control"
                disabled
              />
              <small style={{ color: '#666', fontSize: '12px' }}>
                System-generated unique identifier
              </small>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-save"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Material'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditExpiredMaterialModal;
