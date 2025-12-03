import React, { useState, useEffect } from 'react';
import { masterAPI, productsAPI } from '../services/api';
import { Edit, Trash2 } from 'lucide-react';
import AddExpiredMaterialModal from '../components/AddExpiredMaterialModal';
import EditExpiredMaterialModal from '../components/EditExpiredMaterialModal';
import '../styles/ExpiryCost.css';
import AWN from 'awesome-notifications';
import 'awesome-notifications/dist/style.css';

// Initialize awesome-notifications
const notifier = new AWN({
  position: 'top-right',
  durations: {
    global: 4000
  }
});

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

const ExpiryCost = () => {
  const [expiredMaterials, setExpiredMaterials] = useState([]);
  const [materials, setMaterials] = useState([]); // Master material data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [allocationData, setAllocationData] = useState([]);
  const [productNames, setProductNames] = useState([]);
  const [selectedPeriode, setSelectedPeriode] = useState(new Date().getFullYear().toString());

  const currentYear = new Date().getFullYear().toString();

  // Fetch default year on component mount
  useEffect(() => {
    const fetchDefaultYear = async () => {
      try {
        const response = await productsAPI.getDefaultYear();
        if (response.success && response.data?.defaultYear) {
          setSelectedPeriode(response.data.defaultYear);
        }
      } catch (error) {
        console.error('Failed to fetch default year:', error);
      }
    };

    fetchDefaultYear();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedPeriode]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Load expired materials filtered by selectedPeriode
      const expiredResponse = await apiCall(`/expiry-cost?periode=${selectedPeriode}`);
      
      if (expiredResponse.success) {
        setExpiredMaterials(expiredResponse.data);
      } else {
        setError('Failed to load expired materials: ' + expiredResponse.message);
      }

      // Load master materials separately with better error handling
      try {
        const materialsResponse = await masterAPI.getMaterial();
        if (materialsResponse && materialsResponse.length > 0) {
          setMaterials(materialsResponse);
        } else {
          console.warn('No master materials found');
          setMaterials([]);
        }
      } catch (materialError) {
        console.error('Error loading master materials:', materialError);
        setMaterials([]);
        // Don't show error to user for materials since expired materials still work
      }

    } catch (err) {
      console.error('Error loading data:', err);
      setError('Error loading data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Get material name from master data
  const getMaterialName = (itemId) => {
    const material = materials.find(m => m.ITEM_ID === itemId);
    return material ? material.Item_Name : itemId;
  };

  const handleAddMaterial = () => {
    setShowAddModal(true);
  };

  const handleEditMaterial = (material) => {
    setSelectedMaterial(material);
    setShowEditModal(true);
  };

  const handleDeleteMaterial = async (materialId) => {
    notifier.confirm(
      'Are you sure you want to delete this expired material record?',
      async () => {
        try {
          const response = await apiCall(`/expiry-cost/${materialId}`, 'DELETE');
          
          if (response.success) {
            await loadData(); // Reload data
            notifier.success('Expired material record deleted successfully');
          } else {
            notifier.alert('Failed to delete material: ' + response.message);
          }
        } catch (err) {
          notifier.alert('Error deleting material: ' + err.message);
        }
      },
      () => {
        // User cancelled - do nothing
      }
    );
  };

  const handleGenerateExpiryCost = async () => {
    notifier.confirm(
      `Are you sure you want to generate expiry cost allocation for year ${selectedPeriode}? This will process all expired materials for the selected year.`,
      async () => {
        try {
          setGenerating(true);
          setError('');

          // Call the generate endpoint
          const response = await apiCall('/expiry-cost/generate', 'POST', { 
            periode: selectedPeriode 
          });

          if (response.success) {
            // Refetch data after successful generation
            notifier.success('Expiry cost allocation generated successfully!');
            await loadData();
          } else {
            setError('Failed to generate expiry cost: ' + response.message);
            notifier.alert('Failed to generate expiry cost: ' + response.message);
          }
        } catch (err) {
          setError('Error generating expiry cost: ' + err.message);
          notifier.alert('Error generating expiry cost: ' + err.message);
        } finally {
          setGenerating(false);
        }
      },
      () => {
        // User cancelled - do nothing
      }
    );
  };

  const handleViewAffectedProducts = async () => {
    try {
      setError('');
      
      // Load allocation data and product names
      const [allocationResponse, productNamesResponse] = await Promise.all([
        apiCall(`/expiry-cost/allocation/data?periode=${selectedPeriode}`),
        masterAPI.getProductName()
      ]);

      if (allocationResponse.success) {
        setAllocationData(allocationResponse.data);
      } else {
        setError('Failed to load allocation data: ' + allocationResponse.message);
        return;
      }

      if (productNamesResponse && productNamesResponse.length > 0) {
        setProductNames(productNamesResponse);
      } else {
        console.warn('No product names found');
        setProductNames([]);
      }

      setShowViewModal(true);
    } catch (err) {
      setError('Error loading affected products: ' + err.message);
    }
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setSelectedMaterial(null);
    setError('');
  };

  const onMaterialSaved = () => {
    closeModals();
    loadData(); // Reload data after save
  };

  if (loading) {
    return (
      <div className="expiry-cost">
        <div className="loading">Loading expired materials...</div>
      </div>
    );
  }

  return (
    <div className="expiry-cost">
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')} className="close-error">×</button>
        </div>
      )}

      <div className="content-section">
        <div className="section-header">
          <div className="header-title-with-filter">
            <h2>Expired Materials</h2>
            <div className="period-selector">
              <label htmlFor="periode-select">Year:</label>
              <select 
                id="periode-select"
                value={selectedPeriode} 
                onChange={(e) => setSelectedPeriode(e.target.value)}
                className="periode-select"
              >
                {[...Array(5)].map((_, i) => {
                  const year = new Date().getFullYear() - 2 + i;
                  return <option key={year} value={year.toString()}>{year}</option>;
                })}
              </select>
            </div>
          </div>
          <div className="header-actions">
            <button 
              className="btn btn-secondary"
              onClick={handleAddMaterial}
              disabled={generating}
            >
              Add Expired Material
            </button>
            <button 
              className="btn btn-info"
              onClick={handleViewAffectedProducts}
              disabled={generating}
            >
              View Affected Products
            </button>
            <button 
              className="btn btn-primary"
              onClick={handleGenerateExpiryCost}
              disabled={generating}
            >
              {generating ? 'Generating...' : 'Generate Expiry Cost'}
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="expiry-table">
            <thead>
              <tr>
                <th>Item ID</th>
                <th>Item Name</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>User</th>
                <th>Process Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expiredMaterials.length === 0 ? (
                <tr>
                  <td colSpan="7" className="no-data">
                    No expired materials found for {selectedPeriode}
                  </td>
                </tr>
              ) : (
                expiredMaterials.map((material) => (
                  <tr key={material.pk_id}>
                    <td>{material.ITEM_ID}</td>
                    <td>{getMaterialName(material.ITEM_ID)}</td>
                    <td className="text-right">{material.ITEM_QTY.toLocaleString()}</td>
                    <td>{material.ITEM_UNIT}</td>
                    <td>{material.user_id}</td>
                    <td>{new Date(material.process_date).toLocaleDateString()}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="edit-btn"
                          onClick={() => handleEditMaterial(material)}
                          title="Edit Material"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => handleDeleteMaterial(material.pk_id)}
                          title="Delete Material"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-summary">
          Total Records: {expiredMaterials.length}
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddExpiredMaterialModal
          materials={materials}
          onClose={closeModals}
          onSave={onMaterialSaved}
          currentYear={selectedPeriode}
        />
      )}

      {showEditModal && selectedMaterial && (
        <EditExpiredMaterialModal
          material={selectedMaterial}
          materials={materials}
          onClose={closeModals}
          onSave={onMaterialSaved}
        />
      )}

      {showViewModal && (
        <ViewAffectedProductsModal
          allocationData={allocationData}
          materials={materials}
          productNames={productNames}
          onClose={() => setShowViewModal(false)}
          currentYear={selectedPeriode}
        />
      )}
    </div>
  );
};

// ViewAffectedProductsModal component
const ViewAffectedProductsModal = ({ allocationData, materials, productNames, onClose, currentYear }) => {
  // Get material name by ID
  const getMaterialName = (itemId) => {
    const material = materials.find(m => m.ITEM_ID === itemId);
    return material ? material.Item_Name : itemId;
  };

  // Get product name by ID
  const getProductName = (productId) => {
    const product = productNames.find(p => p.Product_ID === productId);
    return product ? product.Product_Name : productId;
  };

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID').format(value);
  };

  // Format percentage
  const formatPercentage = (value) => {
    return (value * 100).toFixed(2) + '%';
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-large">
        <div className="modal-header">
          <h3>Affected Products - Expiry Cost Allocation ({currentYear})</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="allocation-summary">
            <p><strong>Total Allocations:</strong> {allocationData.length}</p>
            <p><strong>Period:</strong> {currentYear}</p>
          </div>

          <div className="table-container">
            <table className="allocation-table">
              <thead>
                <tr>
                  <th>Item ID</th>
                  <th>Item Name</th>
                  <th>Product ID</th>
                  <th>Product Name</th>
                  <th>Proportion</th>
                  <th>Cost per Batch</th>
                  <th>Total Batches</th>
                  <th>Batch Size</th>
                </tr>
              </thead>
              <tbody>
                {allocationData.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="no-data">
                      No allocation data found for {currentYear}
                    </td>
                  </tr>
                ) : (
                  allocationData.map((allocation) => (
                    <tr key={allocation.pk_id}>
                      <td>{allocation.Item_ID}</td>
                      <td className="item-name">{getMaterialName(allocation.Item_ID)}</td>
                      <td>{allocation.Product_ID}</td>
                      <td className="product-name">{getProductName(allocation.Product_ID)}</td>
                      <td className="text-center">{formatPercentage(allocation.Proporsi)}</td>
                      <td className="text-right">Rp {formatCurrency(allocation.Beban_Sisa_Bahan_Exp)}</td>
                      <td className="text-center">{allocation.Total_Batch}</td>
                      <td className="text-right">{formatCurrency(allocation.BatchSize)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpiryCost;
