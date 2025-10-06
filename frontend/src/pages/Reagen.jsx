import React, { useState, useEffect } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus, Edit, Trash2, X, Check, Download, Upload } from 'lucide-react';
import AWN from 'awesome-notifications';
import 'awesome-notifications/dist/style.css';
import * as XLSX from 'xlsx';
import LoadingSpinner from '../components/LoadingSpinner';
import { reagenAPI, masterAPI } from '../services/api';
import '../styles/Reagen.css';

// Initialize awesome-notifications
const notifier = new AWN({
  position: 'top-right',
  durations: {
    global: 4000
  }
});

const Reagen = ({ user }) => {
  // State management
  const [reagenData, setReagenData] = useState([]);
  const [productNames, setProductNames] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [paginatedData, setPaginatedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(0);
  
  // Modal and editing states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRowId, setEditingRowId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // Add form data
  const [addFormData, setAddFormData] = useState({
    selectedProduct: null,
    reagenRate: ''
  });
  
  // Product selection for Add modal
  const [availableProducts, setAvailableProducts] = useState([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  
  // Sorting states
  const [sortField, setSortField] = useState('productId');
  const [sortDirection, setSortDirection] = useState('asc');

  // Filter products for dropdown (limit results to 50 for performance)
  useEffect(() => {
    if (!showProductDropdown) {
      setFilteredProducts([]);
      return;
    }

    let filtered = availableProducts;
    
    if (productSearchTerm.trim()) {
      filtered = filtered.filter(product =>
        product.Product_ID.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
        product.Product_Name.toLowerCase().includes(productSearchTerm.toLowerCase())
      );
    }
    
    // Limit to 50 results for performance
    const limitedResults = filtered.slice(0, 50);
    setFilteredProducts(limitedResults);
    
    console.log(`Filtered products: ${limitedResults.length} of ${filtered.length} available`);
  }, [availableProducts, productSearchTerm, showProductDropdown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.product-search-container')) {
        setShowProductDropdown(false);
      }
    };

    if (showProductDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProductDropdown]);

  // Load reagen data from API
  const loadReagenData = async () => {
    try {
      setLoading(true);
      const result = await reagenAPI.getAll();
      
      if (result && result.success && Array.isArray(result.data)) {
        // Map the data to include product names
        const mappedData = result.data.map(item => {
          const productInfo = productNames.find(p => p.Product_ID === item.ProductID);
          return {
            pk_id: item.pk_id,
            productId: item.ProductID,
            productName: productInfo ? productInfo.Product_Name : `Product ${item.ProductID}`,
            reagenRate: item.Reagen_Rate,
            userId: item.user_id,
            delegatedTo: item.delegated_to,
            processDate: item.process_date,
            flagUpdate: item.flag_update,
            fromUpdate: item.from_update
          };
        });
        
        setReagenData(mappedData);
        setError('');
        console.log('Loaded reagen data:', mappedData.length, 'items');
      } else {
        throw new Error(result?.message || 'Invalid response format');
      }
    } catch (err) {
      console.error('Error loading reagen data:', err);
      console.error('Error details:', err.message);
      setError('Failed to load reagen data: ' + err.message);
      notifier.alert('Failed to load reagen data. Please check the console for details.');
      setReagenData([]);
    } finally {
      setLoading(false);
    }
  };

  // Load product data from group API
  const loadProductNames = async () => {
    try {
      const result = await masterAPI.getGroup();
      
      if (result && result.success && Array.isArray(result.data)) {
        // Transform group data to match expected format
        const transformedData = result.data.map(item => ({
          Product_ID: item.Group_ProductID,
          Product_Name: item.Product_Name,
          Group_PNCategory: item.Group_PNCategory,
          LOB: item.LOB,
          Jenis_Sediaan: item.Jenis_Sediaan,
          Group_Dept: item.Group_Dept
        }));
        
        setProductNames(transformedData);
        console.log('Loaded product data from group API:', transformedData.length, 'items');
      } else if (result && Array.isArray(result)) {
        // Handle case where API returns array directly (without success wrapper)
        const transformedData = result.map(item => ({
          Product_ID: item.Group_ProductID,
          Product_Name: item.Product_Name,
          Group_PNCategory: item.Group_PNCategory,
          LOB: item.LOB,
          Jenis_Sediaan: item.Jenis_Sediaan,
          Group_Dept: item.Group_Dept
        }));
        
        setProductNames(transformedData);
        console.log('Loaded product data (direct array):', transformedData.length, 'items');
      } else {
        throw new Error(result?.message || 'Invalid response format');
      }
    } catch (err) {
      console.error('Error loading product data:', err);
      console.error('Error details:', err.message);
      notifier.warning('Failed to load product data. You can still add reagen entries manually.');
      setProductNames([]);
    }
  };

  // Load available products for Add New (Group_PNCategory = 8 and excluding existing reagen entries)
  const loadAvailableProducts = async () => {
    try {
      if (productNames.length === 0) return;
      
      // Get existing product IDs that already have reagen rates
      const existingProductIds = reagenData.map(item => item.productId);
      
      // Filter for Group_PNCategory = 8 and exclude products that already have reagen entries
      const available = productNames.filter(product => 
        product.Group_PNCategory === 8 && 
        !existingProductIds.includes(product.Product_ID)
      );
      
      setAvailableProducts(available);
      console.log(`Available products for reagen (Group_PNCategory=8): ${available.length} items`);
    } catch (err) {
      console.error('Error loading available products:', err);
      setAvailableProducts([]);
    }
  };

  // Initial data load
  useEffect(() => {
    const loadInitialData = async () => {
      // Load product names first, but don't wait for it to complete
      loadProductNames();
      // Load reagen data immediately as well
      await loadReagenData();
    };
    loadInitialData();
  }, []);

  // Re-map reagen data when product names are loaded
  useEffect(() => {
    if (productNames.length > 0 && reagenData.length > 0) {
      const remappedData = reagenData.map(item => {
        const productInfo = productNames.find(p => p.Product_ID === item.productId);
        return {
          ...item,
          productName: productInfo ? productInfo.Product_Name : item.productName
        };
      });
      setReagenData(remappedData);
    }
  }, [productNames]);

  // Update available products when reagen data or product names change
  useEffect(() => {
    loadAvailableProducts();
  }, [reagenData, productNames]);

  // Filter and search functionality
  useEffect(() => {
    let filtered = reagenData;

    // Search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(item =>
        item.productId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.productName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredData(filtered);
  }, [reagenData, searchTerm]);

  // Pagination and sorting
  useEffect(() => {
    let sorted = [...filteredData];

    // Sorting
    if (sortField) {
      sorted.sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        } else {
          return sortDirection === 'asc' 
            ? (aValue || 0) - (bValue || 0)
            : (bValue || 0) - (aValue || 0);
        }
      });
    }

    // Pagination
    const totalPages = Math.ceil(sorted.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = sorted.slice(startIndex, endIndex);

    setTotalPages(totalPages);
    setPaginatedData(paginated);
  }, [filteredData, currentPage, itemsPerPage, sortField, sortDirection]);

  // Sorting handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Edit handlers
  const handleEdit = (item) => {
    setEditingRowId(item.pk_id);
    setEditFormData({
      reagenRate: item.reagenRate || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingRowId(null);
    setEditFormData({});
  };

  const handleEditChange = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmitEdit = async () => {
    try {
      setSubmitLoading(true);
      
      // Get the original item data
      const originalItem = reagenData.find(item => item.pk_id === editingRowId);
      if (!originalItem) {
        throw new Error('Original reagen entry not found');
      }
      
      const updateData = {
        productId: originalItem.productId,
        reagenRate: parseFloat(editFormData.reagenRate) || 0,
        userId: user?.nama || user?.inisialNama || 'SYSTEM',
        delegatedTo: originalItem.delegatedTo,
        processDate: new Date().toISOString()
      };
      
      const result = await reagenAPI.update(editingRowId, updateData);
      
      if (result.success) {
        // Refresh data and close edit mode
        await loadReagenData();
        setEditingRowId(null);
        setEditFormData({});
        
        notifier.success('Reagen rate updated successfully');
      } else {
        throw new Error(result.message || 'Failed to update reagen rate');
      }
    } catch (error) {
      console.error('Error updating reagen rate:', error);
      notifier.alert('Failed to update reagen rate: ' + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  // Add form handlers
  const handleAddFormChange = (field, value) => {
    setAddFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Product selection handlers
  const handleProductSearch = (value) => {
    setProductSearchTerm(value);
    setShowProductDropdown(true);
  };

  const handleProductSelect = (product) => {
    setAddFormData(prev => ({
      ...prev,
      selectedProduct: product
    }));
    setProductSearchTerm(`${product.Product_ID} - ${product.Product_Name}`);
    setShowProductDropdown(false);
  };

  const handleSubmitAdd = async () => {
    try {
      // Validation
      if (!addFormData.selectedProduct) {
        notifier.warning('Please select a product');
        return;
      }
      
      if (!addFormData.reagenRate || parseFloat(addFormData.reagenRate) < 0) {
        notifier.warning('Please enter a valid Reagen Rate (must be 0 or greater)');
        return;
      }

      setSubmitLoading(true);
      
      const newEntry = {
        productId: addFormData.selectedProduct.Product_ID,
        reagenRate: parseFloat(addFormData.reagenRate),
        userId: user?.nama || user?.inisialNama || 'SYSTEM',
        delegatedTo: null,
        processDate: new Date().toISOString()
      };
      
      const result = await reagenAPI.create(newEntry);
      
      if (result.success) {
        // Refresh data and close modal
        await loadReagenData();
        handleCancelAdd();
        
        notifier.success('Reagen entry added successfully');
      } else {
        throw new Error(result.message || 'Failed to add reagen entry');
      }
    } catch (error) {
      console.error('Error adding reagen entry:', error);
      notifier.alert('Failed to add reagen entry: ' + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancelAdd = () => {
    setShowAddModal(false);
    setAddFormData({
      selectedProduct: null,
      reagenRate: ''
    });
    setProductSearchTerm('');
    setShowProductDropdown(false);
  };

  // Delete handler
  const handleDelete = async (item) => {
    if (window.confirm(`Are you sure you want to delete reagen entry for ${item.productId} - ${item.productName}?`)) {
      try {
        const result = await reagenAPI.delete(item.pk_id);
        
        if (result.success) {
          await loadReagenData();
          notifier.success('Reagen entry deleted successfully');
        } else {
          throw new Error(result.message || 'Failed to delete reagen entry');
        }
      } catch (error) {
        console.error('Error deleting reagen entry:', error);
        notifier.alert('Failed to delete reagen entry: ' + error.message);
      }
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const exportData = reagenData.map(item => ({
        'Product ID': item.productId,
        'Product Name': item.productName,
        'Reagen Rate': item.reagenRate || 0
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      ws['!cols'] = [
        { wch: 15 }, // Product ID
        { wch: 40 }, // Product Name
        { wch: 15 }  // Reagen Rate
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Reagen Data');

      const now = new Date();
      const dateStr = now.getFullYear() + 
                     String(now.getMonth() + 1).padStart(2, '0') + 
                     String(now.getDate()).padStart(2, '0');
      const filename = `Reagen_Data_${dateStr}.xlsx`;

      XLSX.writeFile(wb, filename);
      notifier.success(`Excel file exported successfully! (${exportData.length} entries)`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      notifier.alert('Failed to export Excel file. Please try again.');
    }
  };

  // Import Excel placeholder
  const handleImportExcel = () => {
    // TODO: Implement Excel import functionality
    notifier.info('Import functionality will be implemented later');
  };

  // Pagination handlers
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading reagen data..." size="large" />;
  }

  return (
    <div className="reagen-container">
      <div className="content-section">
        {/* Header Actions */}
        <div className="section-header">
          <div className="section-info">
            <p className="section-description">
              Manage reagen rates for products. Set and update reagen cost allocations.
            </p>
            <div className="data-summary">
              Total Entries: <span className="count">{reagenData.length}</span>
              {searchTerm && (
                <>
                  {' | '}Filtered: <span className="count">{filteredData.length}</span>
                </>
              )}
            </div>
          </div>
          <div className="header-actions">
            <button 
              onClick={handleExportExcel}
              className="btn-secondary export-btn"
              disabled={loading || reagenData.length === 0}
              title="Export reagen data to Excel"
            >
              <Download size={16} />
              Export
            </button>
            <button 
              onClick={handleImportExcel}
              className="btn-secondary import-btn"
              disabled={loading}
              title="Import reagen data from Excel"
            >
              <Upload size={16} />
              Import
            </button>
            <button 
              onClick={() => setShowAddModal(true)}
              className="btn-primary add-btn"
              title="Add new reagen entry"
            >
              <Plus size={16} />
              Add New
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="controls-section">
          <div className="search-section">
            <div className="search-box">
              <Search className="search-icon" size={20} />
              <input
                type="text"
                placeholder="Search by Product ID or Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={loadReagenData} className="retry-btn">
              Try Again
            </button>
          </div>
        )}

        {/* Data Table */}
        <div className="reagen-table-container">
          <table className="reagen-data-table">
            <thead className="reagen-table-header">
              <tr className="reagen-header-row">
                <th onClick={() => handleSort('productId')} className="reagen-header-cell reagen-sortable">
                  Product ID
                  {sortField === 'productId' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('productName')} className="reagen-header-cell reagen-sortable">
                  Product Name
                  {sortField === 'productName' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('reagenRate')} className="reagen-header-cell reagen-sortable">
                  Reagen Rate
                  {sortField === 'reagenRate' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th className="reagen-header-cell reagen-actions-header">Actions</th>
              </tr>
            </thead>
            <tbody className="reagen-table-body">
              {paginatedData.length === 0 ? (
                <tr className="reagen-data-row reagen-empty-row">
                  <td colSpan="4" className="reagen-no-data">
                    {searchTerm 
                      ? `No reagen entries found matching "${searchTerm}".`
                      : "No reagen entries found. Click 'Add New' to get started."
                    }
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr key={item.pk_id} className="reagen-data-row">
                    <td className="reagen-data-cell reagen-product-id">{item.productId}</td>
                    <td className="reagen-data-cell reagen-product-name">{item.productName}</td>
                    <td className="reagen-data-cell reagen-rate-cell">
                      {editingRowId === item.pk_id ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editFormData.reagenRate}
                          onChange={(e) => handleEditChange('reagenRate', e.target.value)}
                          className="reagen-edit-input"
                          placeholder="Reagen Rate"
                        />
                      ) : (
                        <span className="reagen-rate-value">{parseFloat(item.reagenRate || 0).toFixed(2)}</span>
                      )}
                    </td>
                    <td className="reagen-data-cell reagen-actions-cell">
                      {editingRowId === item.pk_id ? (
                        <div className="reagen-edit-actions">
                          <button 
                            className="reagen-submit-btn"
                            onClick={handleSubmitEdit}
                            disabled={submitLoading}
                            title="Save Changes"
                          >
                            <Check size={16} />
                          </button>
                          <button 
                            className="reagen-cancel-btn"
                            onClick={handleCancelEdit}
                            disabled={submitLoading}
                            title="Cancel Edit"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="reagen-view-actions">
                          <button 
                            className="reagen-edit-btn"
                            onClick={() => handleEdit(item)}
                            title="Edit Reagen Rate"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            className="reagen-delete-btn"
                            onClick={() => handleDelete(item)}
                            title="Delete Entry"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="pagination-btn"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            
            <span className="pagination-info">
              Page {currentPage} of {totalPages} ({filteredData.length} total entries)
            </span>
            
            <button 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="pagination-btn"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Add New Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content add-modal">
            <div className="modal-header">
              <h2>Add New Reagen Entry</h2>
              <button className="modal-close" onClick={handleCancelAdd}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Select Product: *</label>
                <div className="product-search-container">
                  <input
                    type="text"
                    value={productSearchTerm}
                    onChange={(e) => handleProductSearch(e.target.value)}
                    onFocus={() => setShowProductDropdown(true)}
                    placeholder="Type to search products..."
                    className="product-search-input"
                    required
                  />
                  {showProductDropdown && (
                    <div className="product-dropdown">
                      {filteredProducts.length === 0 ? (
                        <div className="dropdown-item no-results">
                          {productSearchTerm 
                            ? 'No Group PNCategory 8 products found matching your search' 
                            : 'Type to search Group PNCategory 8 products'
                          }
                        </div>
                      ) : (
                        <>
                          {filteredProducts.map((product) => (
                            <div
                              key={product.Product_ID}
                              className="dropdown-item"
                              onClick={() => handleProductSelect(product)}
                            >
                              <div className="product-id">{product.Product_ID}</div>
                              <div className="product-name">{product.Product_Name}</div>
                              <div className="product-details">
                                {product.LOB} • {product.Jenis_Sediaan} • {product.Group_Dept}
                              </div>
                            </div>
                          ))}
                          {availableProducts.length > 50 && (
                            <div className="dropdown-item showing-limit">
                              Showing first 50 results. Type to filter more.
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
                {addFormData.selectedProduct && (
                  <div className="selected-product">
                    Selected: <strong>{addFormData.selectedProduct.Product_ID}</strong> - {addFormData.selectedProduct.Product_Name}
                  </div>
                )}
              </div>
              
              <div className="form-group">
                <label>Reagen Rate: *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={addFormData.reagenRate}
                  onChange={(e) => handleAddFormChange('reagenRate', e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div className="form-info">
                <small>
                  * Required fields<br/>
                  • Select a product from the dropdown<br/>
                  • Reagen Rate must be 0 or greater<br/>
                  • Only Group PNCategory 8 products without existing reagen entries are shown
                </small>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={handleCancelAdd}
                disabled={submitLoading}
              >
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={handleSubmitAdd}
                disabled={submitLoading}
              >
                {submitLoading ? 'Adding...' : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reagen;