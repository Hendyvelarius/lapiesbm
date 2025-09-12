import React, { useState } from 'react';

// API base configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

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

const AddExpiredMaterialModal = ({ materials, onClose, onSave, currentYear }) => {
  const [formData, setFormData] = useState({
    itemId: '',
    itemQty: '',
    itemUnit: 'g' // Default unit
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);

  // Filter materials based on search
  const filteredMaterials = materials.filter(material => 
    material.ITEM_ID.toLowerCase().includes(materialSearch.toLowerCase()) ||
    material.Item_Name.toLowerCase().includes(materialSearch.toLowerCase())
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleMaterialSearchChange = (e) => {
    setMaterialSearch(e.target.value);
    setShowMaterialDropdown(true);
    
    // Clear selected material if search changes
    if (formData.itemId) {
      setFormData(prev => ({
        ...prev,
        itemId: '',
        itemUnit: 'g'
      }));
    }
  };

  const handleMaterialSelect = (material) => {
    setFormData(prev => ({
      ...prev,
      itemId: material.ITEM_ID,
      itemUnit: material.Item_Unit || 'g' // Auto-update unit from selected material
    }));
    setMaterialSearch(`${material.ITEM_ID} - ${material.Item_Name}`);
    setShowMaterialDropdown(false);
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
        periode: currentYear,
        userId: 'SYSTEM', // You might want to get this from user context
        processDate: new Date().toISOString()
      };

      const response = await apiCall('/expiry-cost', 'POST', submitData);

      if (response.success) {
        onSave(); // This will close modal and reload data
      } else {
        setError(response.message || 'Failed to create expired material record');
      }
    } catch (err) {
      setError('Error creating expired material: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedMaterial = materials.find(m => m.ITEM_ID === formData.itemId);

  // Close dropdown when clicking outside
  const handleClickOutside = (e) => {
    if (!e.target.closest('.material-search-container')) {
      setShowMaterialDropdown(false);
    }
  };

  // Add event listener for clicking outside
  React.useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Add Expired Material</h3>
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
              <div className="material-search-container">
                <input
                  id="itemId"
                  type="text"
                  value={materialSearch}
                  onChange={handleMaterialSearchChange}
                  onFocus={() => setShowMaterialDropdown(true)}
                  className="form-control"
                  placeholder="Search materials..."
                  required
                  disabled={loading}
                  autoComplete="off"
                />
                {showMaterialDropdown && filteredMaterials.length > 0 && (
                  <div className="material-dropdown">
                    {filteredMaterials.slice(0, 10).map((material) => (
                      <div 
                        key={material.ITEM_ID} 
                        className="material-option"
                        onClick={() => handleMaterialSelect(material)}
                      >
                        <div className="material-id">{material.ITEM_ID}</div>
                        <div className="material-name">{material.Item_Name}</div>
                        <div className="material-unit">{material.Item_Unit}</div>
                      </div>
                    ))}
                    {filteredMaterials.length > 10 && (
                      <div className="material-more">
                        ... {filteredMaterials.length - 10} more results. Type to filter.
                      </div>
                    )}
                  </div>
                )}
                {showMaterialDropdown && filteredMaterials.length === 0 && materialSearch && (
                  <div className="material-dropdown">
                    <div className="no-materials">No materials found</div>
                  </div>
                )}
              </div>
            </div>

            {formData.itemId && (
              <div className="form-group">
                <label>Selected Material Info</label>
                <div className="material-info">
                  {(() => {
                    const selectedMaterial = materials.find(m => m.ITEM_ID === formData.itemId);
                    return selectedMaterial ? (
                      <>
                        <p><strong>ID:</strong> {selectedMaterial.ITEM_ID}</p>
                        <p><strong>Name:</strong> {selectedMaterial.Item_Name}</p>
                        <p><strong>Type:</strong> {selectedMaterial.ITEM_TYPE}</p>
                        <p><strong>Unit:</strong> {selectedMaterial.Item_Unit}</p>
                      </>
                    ) : null;
                  })()}
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
                className="form-control form-control-compact"
                placeholder="Enter quantity"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="itemUnit">Unit *</label>
              <input
                id="itemUnit"
                name="itemUnit"
                type="text"
                value={formData.itemUnit}
                onChange={handleInputChange}
                className="form-control form-control-compact"
                placeholder="Unit"
                required
                disabled={loading}
                readOnly={!!formData.itemId} // Make readonly if material is selected
              />
              {formData.itemId && (
                <small style={{ color: '#666', fontSize: '12px' }}>
                  Unit is automatically set based on selected material
                </small>
              )}
            </div>

            <div className="form-group">
              <label>Period</label>
              <input
                type="text"
                value={currentYear}
                className="form-control form-control-compact"
                disabled
              />
              <small style={{ color: '#666', fontSize: '12px' }}>
                The material will be recorded for the current year ({currentYear})
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
              {loading ? 'Saving...' : 'Save Material'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddExpiredMaterialModal;
