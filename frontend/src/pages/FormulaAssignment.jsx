import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/FormulaAssignment.css';

const FormulaAssignment = () => {
  // State management
  const [chosenFormulas, setChosenFormulas] = useState([]);
  const [productList, setProductList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFormula, setEditingFormula] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    productId: '',
    productName: '',
    pi: '',
    ps: '',
    kp: '',
    ks: '',
    stdOutput: 0
  });
  
  // Formula selection states
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productFormulas, setProductFormulas] = useState({
    PI: [],
    PS: [],
    KP: [],
    KS: []
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  
  // Table search state
  const [tableSearchTerm, setTableSearchTerm] = useState('');

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  // Filter products based on search term
  useEffect(() => {
    // Get list of product IDs that already have formula assignments
    const assignedProductIds = chosenFormulas.map(formula => formula.Product_ID);
    
    if (!showProductDropdown) {
      // If dropdown is not shown, don't show any products
      setFilteredProducts([]);
    } else if (searchTerm.trim() === '') {
      // If dropdown is shown but no search term, show all unassigned products
      const allUnassigned = productList.filter(product => 
        !assignedProductIds.includes(product.Product_ID)
      );
      setFilteredProducts(allUnassigned);
    } else {
      // Filter based on search term among unassigned products
      const filtered = productList.filter(product => {
        // Only show products that don't already have assignments
        const notAssigned = !assignedProductIds.includes(product.Product_ID);
        
        // And match the search term
        const matchesSearch = product.Product_Name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             product.Product_ID?.toLowerCase().includes(searchTerm.toLowerCase());
        
        return notAssigned && matchesSearch;
      });
      setFilteredProducts(filtered);
    }
  }, [searchTerm, productList, chosenFormulas, showProductDropdown]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load chosen formulas and product list
      const [chosenRes, productsRes] = await Promise.all([
        api.products.getChosenFormula(),
        api.master.getProductName()
      ]);

      setChosenFormulas(chosenRes || []);
      setProductList(productsRes || []);

    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadProductFormulas = async (productId) => {
    try {
      setLoading(true);
      
      const formulas = await api.products.getFormulaById(productId);
      
      // Check if we got any formulas
      if (!formulas || formulas.length === 0) {
        setProductFormulas({ PI: [], PS: [], KP: [], KS: [] });
        return;
      }
      
      // Group formulas by TypeCode
      const grouped = {
        PI: formulas.filter(f => f.TypeCode === 'PI'),
        PS: formulas.filter(f => f.TypeCode === 'PS'),
        KP: formulas.filter(f => f.TypeCode === 'KP'),
        KS: formulas.filter(f => f.TypeCode === 'KS')
      };
      
      setProductFormulas(grouped);
    } catch (err) {
      console.error('Error loading product formulas:', err);
      setError(`Failed to load formulas for this product: ${err.message}`);
      // Reset to empty state on error
      setProductFormulas({ PI: [], PS: [], KP: [], KS: [] });
    } finally {
      setLoading(false);
    }
  };

  // Handle opening edit modal
  const handleEdit = async (formula) => {
    setEditingFormula(formula);
    setFormData({
      productId: formula.Product_ID,
      productName: formula.Product_Name || getProductName(formula.Product_ID),
      pi: formula.PI === null || formula.PI === undefined ? null : formula.PI,
      ps: formula.PS === null || formula.PS === undefined ? null : formula.PS,
      kp: formula.KP === null || formula.KP === undefined ? null : formula.KP,
      ks: formula.KS === null || formula.KS === undefined ? null : formula.KS,
      stdOutput: formula.Std_Output || 0
    });
    
    // Load available formulas for this product
    await loadProductFormulas(formula.Product_ID);
    setShowEditModal(true);
  };

  // Handle closing the add modal and resetting states
  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setShowProductDropdown(false);
    setSearchTerm('');
    setFilteredProducts([]);
    setSelectedProduct(null);
    setProductFormulas({ PI: [], PS: [], KP: [], KS: [] });
  };

  // Handle opening add modal
  const handleAdd = () => {
    setEditingFormula(null);
    setFormData({
      productId: '',
      productName: '',
      pi: null,
      ps: null,
      kp: null,
      ks: null,
      stdOutput: 0
    });
    setSelectedProduct(null);
    setProductFormulas({ PI: [], PS: [], KP: [], KS: [] });
    setSearchTerm('');
    setFilteredProducts([]);
    setShowProductDropdown(false);
    setShowAddModal(true);
  };

  // Handle product selection
  const handleProductSelect = async (product) => {
    setSelectedProduct(product);
    setFormData(prev => ({
      ...prev,
      productId: product.Product_ID,
      productName: product.Product_Name
    }));
    setSearchTerm(''); // Clear search term to hide results
    setFilteredProducts([]); // Clear filtered results
    setShowProductDropdown(false); // Close dropdown
    
    // Reset formula state before loading new ones
    setProductFormulas({ PI: [], PS: [], KP: [], KS: [] });
    
    // Load formulas for selected product
    await loadProductFormulas(product.Product_ID);
  };

  // Handle manual formula selection
  const handleFormulaSelect = (type, formulaId) => {
    // Handle "No Formula" selection (when user selects "No Formula" option)
    if (formulaId === undefined || formulaId === null || formulaId === 'NO_FORMULA') {
      setFormData(prev => ({
        ...prev,
        [type.toLowerCase()]: null
      }));
      return;
    }

    // Find the selected formula from the current product's formulas
    const formulas = productFormulas[type] || [];
    const selectedFormula = formulas.find(f => (f.PPI_SubID || '') === formulaId);
    
    if (selectedFormula) {
      const formulaBatchSize = selectedFormula.BatchSize;
      const currentStdOutput = parseFloat(formData.stdOutput) || 0;
      
      // If standard output is 0 or empty, automatically set it to formula batch size
      if (currentStdOutput === 0) {
        setFormData(prev => ({
          ...prev,
          [type.toLowerCase()]: formulaId,
          stdOutput: formulaBatchSize
        }));
      } else if (currentStdOutput !== formulaBatchSize) {
        // Show warning if batch sizes differ
        const formulaDisplayName = formulaId || 'ORI';
        const confirmed = window.confirm(
          `The selected formula "${formulaDisplayName}" has a batch size of ${formulaBatchSize}, ` +
          `which differs from the current standard output (${currentStdOutput}).\n\n` +
          `Do you want to update the standard output to match the formula's batch size?\n\n` +
          `Click OK to update, or Cancel to keep the current value.`
        );
        
        setFormData(prev => ({
          ...prev,
          [type.toLowerCase()]: formulaId,
          stdOutput: confirmed ? formulaBatchSize : currentStdOutput
        }));
      } else {
        // Batch sizes match, just update the formula
        setFormData(prev => ({
          ...prev,
          [type.toLowerCase()]: formulaId
        }));
      }
    } else {
      // Formula not found, just update with the formulaId (might be empty string)
      setFormData(prev => ({
        ...prev,
        [type.toLowerCase()]: formulaId
      }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.productId) {
      alert('Please select a product');
      return;
    }

    // For new assignments, check if product already has an assignment
    if (!editingFormula) {
      const existingAssignment = chosenFormulas.find(formula => formula.Product_ID === formData.productId);
      if (existingAssignment) {
        alert(`Product ${formData.productId} already has a formula assignment. Please edit the existing assignment or select a different product.`);
        return;
      }
    }

    try {
      setLoading(true);
      
      if (editingFormula) {
        // Update existing
        await api.products.updateChosenFormula(formData.productId, {
          pi: formData.pi,
          ps: formData.ps,
          kp: formData.kp,
          ks: formData.ks,
          stdOutput: formData.stdOutput
        });
      } else {
        // Add new
        await api.products.addChosenFormula(formData);
      }

      // Reload data and close modal
      await loadData();
      setShowEditModal(false);
      handleCloseAddModal();
    } catch (err) {
      console.error('Error saving formula:', err);
      alert('Failed to save formula. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this formula assignment?')) {
      return;
    }

    try {
      setLoading(true);
      await api.products.deleteChosenFormula(productId);
      await loadData();
    } catch (err) {
      console.error('Error deleting formula:', err);
      alert('Failed to delete formula. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get product name
  const getProductName = (productId) => {
    const product = productList.find(p => p.Product_ID === productId);
    return product ? product.Product_Name : productId;
  };

  // Helper function to get formula details - distinguish between null and unnamed
  const getFormulaDetails = (formulaId, type) => {
    if (formulaId === null || formulaId === undefined) {
      return '-';  // Truly empty/null
    } else if (formulaId === '') {
      return 'ORI'; // Assigned but unnamed formula
    } else {
      return formulaId; // Normal named formula
    }
  };

  // Filter chosen formulas based on search term
  const filteredChosenFormulas = chosenFormulas.filter(formula => {
    if (!tableSearchTerm.trim()) return true;
    
    const searchLower = tableSearchTerm.toLowerCase();
    const productName = getProductName(formula.Product_ID);
    
    return formula.Product_ID.toLowerCase().includes(searchLower) ||
           productName.toLowerCase().includes(searchLower);
  });

  if (loading && chosenFormulas.length === 0) {
    return (
      <div className="formula-assignment-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="formula-assignment-container">
      {error && (
        <div className="error-message">
          {error}
          <button onClick={loadData} className="retry-btn">Retry</button>
        </div>
      )}

      <div className="content-section">
        <div className="section-header">
          <div className="section-title">
            <h2>Current Formula Assignments</h2>
            {tableSearchTerm.trim() && (
              <span className="search-results-count">
                {filteredChosenFormulas.length} of {chosenFormulas.length} results
              </span>
            )}
          </div>
          <div className="header-actions">
            <div className="table-search">
              <input
                type="text"
                placeholder="Search by Product ID or Name..."
                value={tableSearchTerm}
                onChange={(e) => setTableSearchTerm(e.target.value)}
                className="table-search-input"
              />
            </div>
            <button onClick={handleAdd} className="btn-primary">
              Add New Assignment
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="formula-table">
            <thead>
              <tr>
                <th>Product ID</th>
                <th>Product Name</th>
                <th>PI Formula</th>
                <th>PS Formula</th>
                <th>KP Formula</th>
                <th>KS Formula</th>
                <th>Std Output</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredChosenFormulas.length === 0 ? (
                <tr>
                  <td colSpan="8" className="no-data">
                    {tableSearchTerm.trim() 
                      ? `No formula assignments found matching "${tableSearchTerm}".`
                      : "No formula assignments found. Click \"Add New Assignment\" to get started."
                    }
                  </td>
                </tr>
              ) : (
                filteredChosenFormulas.map((formula, index) => (
                  <tr key={`${formula.Product_ID}-${index}`}>
                    <td>{formula.Product_ID}</td>
                    <td>{getProductName(formula.Product_ID)}</td>
                    <td>{getFormulaDetails(formula.PI, 'PI')}</td>
                    <td>{getFormulaDetails(formula.PS, 'PS')}</td>
                    <td>{getFormulaDetails(formula.KP, 'KP')}</td>
                    <td>{getFormulaDetails(formula.KS, 'KS')}</td>
                    <td>{formula.Std_Output || 0}</td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          onClick={() => handleEdit(formula)}
                          className="btn-edit"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(formula.Product_ID)}
                          className="btn-delete"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={handleCloseAddModal}>
          <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Formula Assignment</h3>
              <button onClick={handleCloseAddModal} className="close-btn">×</button>
            </div>
            
            <form onSubmit={handleSubmit} className="formula-form">
              {/* Product Selection */}
              <div className="form-section">
                <h4>1. Select Product</h4>
                <div className="product-stats">
                  {productList.length - chosenFormulas.length > 0 ? (
                    <small>
                      {productList.length - chosenFormulas.length} products available for assignment 
                      ({chosenFormulas.length} already assigned)
                    </small>
                  ) : (
                    <small style={{color: '#dc2626'}}>
                      All products ({productList.length}) already have formula assignments. 
                      Edit existing assignments instead.
                    </small>
                  )}
                </div>
                <div className="product-search">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setShowProductDropdown(true)}
                    onBlur={() => {
                      // Delay hiding to allow clicking on products
                      setTimeout(() => setShowProductDropdown(false), 200);
                    }}
                    placeholder={productList.length - chosenFormulas.length > 0 
                      ? "Click here to see all available products, or type to search..."
                      : "No products available - all are assigned"
                    }
                    className="search-input"
                    disabled={productList.length - chosenFormulas.length === 0}
                  />
                  {/* Show search results when dropdown is open */}
                  {showProductDropdown && (
                    <div className="search-results">
                      {filteredProducts.length === 0 && searchTerm.trim() ? (
                        <div className="search-result-item no-results">
                          <span>No available products found matching "{searchTerm}"</span>
                          <small>Only products without existing formula assignments are shown</small>
                        </div>
                      ) : filteredProducts.length === 0 && !searchTerm.trim() ? (
                        <div className="search-result-item no-results">
                          <span>All products have been assigned formulas</span>
                          <small>No unassigned products available</small>
                        </div>
                      ) : (
                        <>
                          {searchTerm.trim() === '' && (
                            <div className="search-result-header">
                              <small>Available products ({filteredProducts.length})</small>
                            </div>
                          )}
                          {filteredProducts.slice(0, 10).map(product => (
                            <div 
                              key={product.Product_ID}
                              className="search-result-item"
                              onClick={() => handleProductSelect(product)}
                            >
                              <strong>{product.Product_ID}</strong> - {product.Product_Name}
                            </div>
                          ))}
                          {filteredProducts.length > 10 && (
                            <div className="search-result-item more-results">
                              <small>... and {filteredProducts.length - 10} more. Type to narrow down results.</small>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
                
                {selectedProduct && (
                  <div className="selected-product">
                    <strong>Selected:</strong> {selectedProduct.Product_ID} - {selectedProduct.Product_Name}
                  </div>
                )}
              </div>

              {/* Formula Selection */}
              {selectedProduct && (
                <div className="form-section">
                  <h4>2. Select Formulas</h4>
                  {loading ? (
                    <div className="formula-loading">
                      <p>Loading formulas for {selectedProduct.Product_Name}...</p>
                    </div>
                  ) : Object.keys(productFormulas).some(type => productFormulas[type].length > 0) ? (
                    <div className="formula-grid">
                      {Object.entries(productFormulas).map(([type, formulas]) => (
                        <div key={type} className="formula-type-section">
                          <h5>{type} Formulas</h5>
                          {formulas.length > 0 ? (
                            <select
                              value={formData[type.toLowerCase()] === null ? 'NO_FORMULA' : formData[type.toLowerCase()]}
                              onChange={(e) => handleFormulaSelect(type, e.target.value === 'NO_FORMULA' ? null : e.target.value)}
                              className="formula-select"
                            >
                              <option value="NO_FORMULA">No Formula</option>
                              {formulas.map((formula, idx) => (
                                <option key={`${type}-${formula.PPI_SubID || 'empty'}-${idx}`} value={formula.PPI_SubID || ''}>
                                  {formula.PPI_SubID || 'ORI'} {formula.Default === 'Aktif' ? '(Default) ' : ''}(Output: {formula.BatchSize})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="no-formulas-available">
                              <span>No {type} formulas available for this product</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-formulas-message">
                      <div className="alert alert-warning">
                        <h5>⚠️ No Formulas Available</h5>
                        <p>The selected product <strong>{selectedProduct.Product_ID} - {selectedProduct.Product_Name}</strong> does not have any formulas set up yet.</p>
                        <p>Please:</p>
                        <ul>
                          <li>Create a new formula for this product first, or</li>
                          <li>Select a different product that has formulas configured</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Standard Output */}
              {selectedProduct && Object.keys(productFormulas).some(type => productFormulas[type].length > 0) && (
                <div className="form-section">
                  <h4>3. Set Standard Output</h4>
                  <div className="std-output-section">
                    <label>Standard Output:</label>
                    <input
                      type="number"
                      value={formData.stdOutput}
                      onChange={(e) => setFormData(prev => ({ ...prev, stdOutput: e.target.value }))}
                      className="input-field"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" onClick={handleCloseAddModal} className="btn-secondary">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={
                    !formData.productId || 
                    loading || 
                    !Object.keys(productFormulas).some(type => productFormulas[type].length > 0)
                  }
                >
                  {loading ? 'Saving...' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Formula Assignment</h3>
              <button onClick={() => setShowEditModal(false)} className="close-btn">×</button>
            </div>
            
            <form onSubmit={handleSubmit} className="formula-form">
              <div className="form-section">
                <div className="selected-product">
                  <strong>Product:</strong> {formData.productId} - {formData.productName}
                </div>
              </div>

              {/* Formula Selection for Edit */}
              <div className="form-section" key={`edit-formulas-${formData.productId}`}>
                <h4>Update Formula Selection</h4>
                <div className="formula-grid">
                  {Object.entries(productFormulas).map(([type, formulas]) => (
                    <div key={type} className="formula-type-section">
                      <h5>{type} Formulas</h5>
                      {formulas.length > 0 ? (
                        <select
                          value={formData[type.toLowerCase()] === null ? 'NO_FORMULA' : formData[type.toLowerCase()]}
                          onChange={(e) => handleFormulaSelect(type, e.target.value === 'NO_FORMULA' ? null : e.target.value)}
                          className="formula-select"
                        >
                          <option value="NO_FORMULA">No Formula</option>
                          {formulas.map((formula, idx) => (
                            <option key={`edit-${type}-${formula.PPI_SubID || 'empty'}-${idx}`} value={formula.PPI_SubID || ''}>
                              {formula.PPI_SubID || 'ORI'} {formula.Default === 'Aktif' ? '(Default) ' : ''}(Output: {formula.BatchSize})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="no-formulas-available">
                          <span>No {type} formulas available for this product</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="std-output-section">
                  <label>Standard Output:</label>
                  <input
                    type="number"
                    value={formData.stdOutput}
                    onChange={(e) => setFormData(prev => ({ ...prev, stdOutput: e.target.value }))}
                    className="input-field"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Updating...' : 'Update Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormulaAssignment;
