import React, { useState, useEffect } from 'react';
import { masterAPI } from '../services/api';
import '../styles/ProductGroup.css';
import { Search, Filter, Users, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus, Edit, Trash2, X, Check } from 'lucide-react';

const Pembebanan = () => {
  const [pembebanData, setPembebanData] = useState([]);
  const [groupData, setGroupData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [paginatedData, setPaginatedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('All Groups');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Sorting states
  const [sortField, setSortField] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');

  // Inline editing states
  const [editingRowId, setEditingRowId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // Delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);

  // Add modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addFormData, setAddFormData] = useState({
    groupPNCategoryID: '',
    groupPNCategoryName: '',
    groupProductID: null,
    productName: '',
    groupProsesRate: '',
    groupKemasRate: ''
  });
  
  // Dropdown states for Add modal
  const [availableGroups, setAvailableGroups] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);

  // Fetch all data
  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [pembebanResponse, groupResponse] = await Promise.all([
        masterAPI.getPembebanan(),
        masterAPI.getGroup()
      ]);
      
      setPembebanData(pembebanResponse);
      setGroupData(groupResponse);
      setError('');
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchAllData();
  }, []);

  // Combine pembebanan and group data
  const getCombinedData = async () => {
    try {
      const [pembebanResponse, groupResponse] = await Promise.all([
        masterAPI.getPembebanan(),
        masterAPI.getGroup()
      ]);
      
      setPembebanData(pembebanResponse);
      setGroupData(groupResponse);
      setError('');
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data. Please try again.');
    }
  };

  // Process combined data
  const processedData = React.useMemo(() => {
    return pembebanData.map(pembebanan => {
      // Check if this is a default rate (no specific product)
      if (!pembebanan.Group_ProductID) {
        return {
          pk_id: pembebanan.pk_id,
          periode: pembebanan.Group_Periode,
          productId: null,
          productName: 'DEFAULT RATE',
          isDefaultRate: true,
          groupId: pembebanan.Group_PNCategoryID,
          groupName: pembebanan.Group_PNCategory_Name,
          rateProses: pembebanan.Group_Proses_Rate,
          rateKemas: pembebanan.Group_Kemas_Rate,
          userId: pembebanan.user_id,
          processDate: pembebanan.process_date,
          sortPriority: 0 // Higher priority for sorting (default rates at top)
        };
      } else {
        // For actual products, find the product details from group data
        const productDetails = groupData.find(group => 
          group.Group_ProductID === pembebanan.Group_ProductID
        );
        
        if (productDetails) {
          return {
            pk_id: pembebanan.pk_id,
            periode: pembebanan.Group_Periode,
            productId: pembebanan.Group_ProductID,
            productName: productDetails.Product_Name,
            isDefaultRate: false,
            groupId: productDetails.Group_PNCategory,
            groupName: productDetails.Group_PNCategoryName,
            rateProses: pembebanan.Group_Proses_Rate,
            rateKemas: pembebanan.Group_Kemas_Rate,
            userId: pembebanan.user_id,
            processDate: pembebanan.process_date,
            sortPriority: 1 // Lower priority for sorting (actual products after defaults)
          };
        } else {
          // Product not found in group data, show as unknown
          return {
            pk_id: pembebanan.pk_id,
            periode: pembebanan.Group_Periode,
            productId: pembebanan.Group_ProductID,
            productName: 'Unknown Product',
            isDefaultRate: false,
            groupId: 'Unknown',
            groupName: 'Unknown Group',
            rateProses: pembebanan.Group_Proses_Rate,
            rateKemas: pembebanan.Group_Kemas_Rate,
            userId: pembebanan.user_id,
            processDate: pembebanan.process_date,
            sortPriority: 1
          };
        }
      }
    }).sort((a, b) => {
      // First sort by priority (default rates first)
      if (a.sortPriority !== b.sortPriority) {
        return a.sortPriority - b.sortPriority;
      }
      // Then sort by group name
      return a.groupName.localeCompare(b.groupName);
    });
  }, [pembebanData, groupData]);

  // Filter and search data
  useEffect(() => {
    let filtered = processedData;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.groupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.groupId.toString().toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply group filter
    if (selectedGroup !== 'All Groups') {
      filtered = filtered.filter(item => item.groupName === selectedGroup);
    }

    setFilteredData(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [processedData, searchTerm, selectedGroup]);

  // Handle sorting
  const handleSort = (field) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);

    const sorted = [...filteredData].sort((a, b) => {
      let aValue = a[field];
      let bValue = b[field];

      // Handle numeric fields
      if (field === 'rateProses' || field === 'rateKemas') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      }

      // Handle string fields
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (newDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setFilteredData(sorted);
  };

  // Pagination
  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setPaginatedData(filteredData.slice(startIndex, endIndex));
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, filteredData.length);

  // Get unique groups for filter dropdown
  const uniqueGroups = [...new Set(processedData.map(item => item.groupName))].sort();

  // Process available groups and products for Add modal
  useEffect(() => {
    if (groupData.length > 0) {
      // Get unique groups with their IDs
      const groupsMap = new Map();
      groupData.forEach(item => {
        if (item.Group_PNCategory && item.Group_PNCategoryName) {
          groupsMap.set(item.Group_PNCategoryName, {
            id: String(item.Group_PNCategory),
            name: item.Group_PNCategoryName
          });
        }
      });
      setAvailableGroups(Array.from(groupsMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
      
      // Get all products
      const allProducts = groupData
        .filter(item => item.Group_ProductID && item.Product_Name)
        .map(item => ({
          id: String(item.Group_ProductID),
          name: item.Product_Name,
          groupId: String(item.Group_PNCategory),
          groupName: item.Group_PNCategoryName
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      // Filter out products that already exist in pembebanan data
      // Only exclude products that have specific product-based entries (not default rates)
      const existingProductIds = new Set(
        processedData
          .filter(item => !item.isDefaultRate && item.productId) // Only actual product entries
          .map(item => String(item.productId))
      );
      
      const availableProducts = allProducts.filter(product => 
        !existingProductIds.has(product.id)
      );
      
      setAvailableProducts(availableProducts);
      setFilteredProducts(availableProducts);
    }
  }, [groupData, processedData]); // Added processedData as dependency to update when pembebanan data changes

  // Inline editing functions
  const handleEdit = (item) => {
    setEditingRowId(item.pk_id);
    setEditFormData({
      rateProses: item.rateProses,
      rateKemas: item.rateKemas
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
      
      const updateData = {
        groupPNCategoryID: processedData.find(p => p.pk_id === editingRowId)?.groupId,
        groupPNCategoryName: processedData.find(p => p.pk_id === editingRowId)?.groupName,
        groupProductID: processedData.find(p => p.pk_id === editingRowId)?.productId,
        groupProsesRate: parseFloat(editFormData.rateProses) || 0,
        groupKemasRate: parseFloat(editFormData.rateKemas) || 0
      };
      
      await masterAPI.updatePembebanan(editingRowId, updateData);
      
      // Refresh data
      await getCombinedData();
      
      setEditingRowId(null);
      setEditFormData({});
      
    } catch (error) {
      console.error('Error updating pembebanan:', error);
      alert('Error updating entry: ' + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  // Add modal functions
  const handleAdd = () => {
    setShowAddModal(true);
    // Reset filtered products to show all when modal opens
    setFilteredProducts(availableProducts);
  };

  const handleCancelAdd = () => {
    setShowAddModal(false);
    setAddFormData({
      groupPNCategoryID: '',
      groupPNCategoryName: '',
      groupProductID: null,
      productName: '',
      groupProsesRate: '',
      groupKemasRate: ''
    });
    setFilteredProducts(availableProducts);
  };

  const handleAddFormChange = (field, value) => {
    setAddFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Handle group selection
    if (field === 'groupPNCategoryName') {
      const selectedGroup = availableGroups.find(group => group.name === value);
      if (selectedGroup) {
        setAddFormData(prev => ({
          ...prev,
          groupPNCategoryID: selectedGroup.id,
          groupPNCategoryName: selectedGroup.name,
          groupProductID: null,
          productName: ''
        }));
        
        // Filter products based on selected group AND exclude existing products
        const filtered = availableProducts.filter(product => product.groupName === value);
        setFilteredProducts(filtered);
      } else {
        // If group is cleared, show all products
        setFilteredProducts(availableProducts);
        setAddFormData(prev => ({
          ...prev,
          groupPNCategoryID: '',
          groupProductID: null,
          productName: ''
        }));
      }
    }

    // Handle product selection
    if (field === 'groupProductID') {
      const selectedProduct = filteredProducts.find(product => product.id === String(value));
      if (selectedProduct) {
        setAddFormData(prev => ({
          ...prev,
          groupProductID: selectedProduct.id,
          productName: selectedProduct.name,
          // Auto-select group if not already selected
          groupPNCategoryID: prev.groupPNCategoryID || selectedProduct.groupId,
          groupPNCategoryName: prev.groupPNCategoryName || selectedProduct.groupName
        }));
      } else if (value === '') {
        setAddFormData(prev => ({
          ...prev,
          groupProductID: null,
          productName: ''
        }));
      }
    }
  };

  const handleSubmitAdd = async () => {
    try {
      // Validation
      if (!addFormData.groupPNCategoryName) {
        alert('Please select a Group Name');
        return;
      }
      
      if (!addFormData.groupProductID) {
        alert('Please select a Product');
        return;
      }
      
      if (!addFormData.groupProsesRate || parseFloat(addFormData.groupProsesRate) < 0) {
        alert('Please enter a valid Proses Rate (must be 0 or greater)');
        return;
      }
      
      if (!addFormData.groupKemasRate || parseFloat(addFormData.groupKemasRate) < 0) {
        alert('Please enter a valid Kemas Rate (must be 0 or greater)');
        return;
      }

      // Additional validation to ensure groupPNCategoryID is set
      if (!addFormData.groupPNCategoryID) {
        alert('Group Category ID is missing. Please select a product again.');
        return;
      }
      
      // Check for duplicate entry
      const isDuplicate = processedData.some(item => 
        item.groupName === addFormData.groupPNCategoryName && 
        String(item.productId) === String(addFormData.groupProductID)
      );
      
      if (isDuplicate) {
        alert(`A cost allocation entry for ${addFormData.groupPNCategoryName} product ${addFormData.groupProductID} already exists. Please edit the existing entry instead.`);
        return;
      }

      // Debug logging
      console.log('Add form data being sent:', addFormData);
      
      const newEntry = {
        groupPNCategoryID: String(addFormData.groupPNCategoryID),
        groupPNCategoryName: String(addFormData.groupPNCategoryName),
        groupProductID: String(addFormData.groupProductID),
        groupProsesRate: parseFloat(addFormData.groupProsesRate),
        groupKemasRate: parseFloat(addFormData.groupKemasRate)
      };

      console.log('Processed entry data:', newEntry);
      
      await masterAPI.addPembebanan(newEntry);
      
      // Refresh data and close modal
      await getCombinedData();
      handleCancelAdd();
    } catch (error) {
      console.error('Error adding pembebanan entry:', error);
      alert('Error adding entry: ' + error.message);
    }
  };

  // Delete functions
  const handleDelete = (item) => {
    setDeletingItem(item);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setSubmitLoading(true);
      
      await masterAPI.deletePembebanan(deletingItem.pk_id);
      
      // Refresh data
      await fetchAllData();
      
      setShowDeleteModal(false);
      setDeletingItem(null);
      
    } catch (error) {
      console.error('Error deleting pembebanan:', error);
      setError('Failed to delete item. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setDeletingItem(null);
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Loading cost allocation data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-message">
        <Users size={48} />
        <p>{error}</p>
        <button className="retry-btn" onClick={fetchAllData}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="product-group-container pembebanan-page">
      <div className="controls-section">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search by product name, group..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-controls">
          <div className="category-filter">
            <Filter size={18} />
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
            >
              <option value="All Groups">All Groups</option>
              {uniqueGroups.map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </div>
          
          <button className="add-btn" onClick={() => setShowAddModal(true)}>
            <Plus size={20} />
            Add New
          </button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-scroll-wrapper">
          <table className="groups-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('productId')} className="sortable">
                  Product ID
                  {sortField === 'productId' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('productName')} className="sortable">
                  Product Name
                  {sortField === 'productName' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('groupName')} className="sortable">
                  Group
                  {sortField === 'groupName' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('rateProses')} className="sortable">
                  Rate Proses
                  {sortField === 'rateProses' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('rateKemas')} className="sortable">
                  Rate Kemas
                  {sortField === 'rateKemas' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item) => (
                <tr key={item.pk_id} className={item.isDefaultRate ? 'default-rate-row' : ''}>
                  <td className="product-id">
                    <div className="product-id-container">
                      <span className="id-text">{item.productId || '-'}</span>
                      <span className={`source-badge ${item.isDefaultRate ? 'default' : 'product'}`}>
                        {item.isDefaultRate ? 'DEF' : 'PRD'}
                      </span>
                    </div>
                  </td>
                  <td className="product-name">
                    <div className="name-cell">
                      <span className="name">
                        {item.isDefaultRate ? (
                          <span className="default-rate-name">{item.productName}</span>
                        ) : (
                          item.productName
                        )}
                      </span>
                    </div>
                  </td>
                  
                  {editingRowId === item.pk_id ? (
                    // Editing mode
                    <>
                      <td>
                        <span className="category-badge">
                          {item.groupName}
                        </span>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={editFormData.rateProses}
                          onChange={(e) => handleEditChange('rateProses', e.target.value)}
                          className="edit-input"
                          placeholder="Proses Rate"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={editFormData.rateKemas}
                          onChange={(e) => handleEditChange('rateKemas', e.target.value)}
                          className="edit-input"
                          placeholder="Kemas Rate"
                        />
                      </td>
                      <td className="actions editing-mode">
                        <button 
                          className="submit-btn"
                          onClick={handleSubmitEdit}
                          disabled={submitLoading}
                          title="Save Changes"
                        >
                          <Check size={16} />
                        </button>
                        <button 
                          className="cancel-btn"
                          onClick={handleCancelEdit}
                          disabled={submitLoading}
                          title="Cancel Edit"
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </>
                  ) : (
                    // Display mode
                    <>
                      <td>
                        <span className="category-badge">
                          {item.groupName}
                        </span>
                      </td>
                      <td className="manhour">{parseFloat(item.rateProses).toFixed(2)}</td>
                      <td className="manhour">{parseFloat(item.rateKemas).toFixed(2)}</td>
                      <td className={`actions display-mode ${item.isDefaultRate ? 'single-button' : 'multiple-buttons'}`}>
                        <button 
                          className="edit-btn"
                          onClick={() => handleEdit(item)}
                          title="Edit Rate"
                        >
                          <Edit size={16} />
                        </button>
                        {!item.isDefaultRate && (
                          <button 
                            className="delete-btn"
                            onClick={() => handleDelete(item)}
                            title="Delete Rate"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredData.length === 0 && !loading && (
          <div className="no-data">
            <Users size={48} />
            <h3>No Cost Allocation Data Found</h3>
            <p>
              {searchTerm
                ? selectedGroup === 'All Groups'
                  ? 'No data matches your search.'
                  : `No ${selectedGroup.toLowerCase()} data matches your search.`
                : selectedGroup === 'All Groups'
                  ? 'No cost allocation data available.'
                  : `No ${selectedGroup.toLowerCase()} data available.`
              }
            </p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {filteredData.length > 0 && (
        <div className="pagination-container">
          <div className="pagination-info">
            Showing {startItem} to {endItem} of {filteredData.length} entries
          </div>
          
          <div className="pagination-controls">
            <button 
              className="pagination-btn"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            
            <div className="page-numbers">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                return (
                  <button
                    key={pageNumber}
                    className={`page-number ${currentPage === pageNumber ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                );
              })}
            </div>
            
            <button 
              className="pagination-btn"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="table-info">
        <span>{filteredData.length} of {processedData.length} cost allocation entries</span>
      </div>

      {/* Add New Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content add-modal">
            <div className="modal-header">
              <h2>Add New Cost Allocation</h2>
              <button className="modal-close" onClick={handleCancelAdd}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Group Name: *</label>
                <select
                  value={addFormData.groupPNCategoryName}
                  onChange={(e) => handleAddFormChange('groupPNCategoryName', e.target.value)}
                  required
                >
                  <option value="">Select Group Name</option>
                  {availableGroups.map(group => (
                    <option key={group.id} value={group.name}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Product ID & Name: *</label>
                <select
                  value={addFormData.groupProductID || ''}
                  onChange={(e) => handleAddFormChange('groupProductID', e.target.value)}
                  disabled={!addFormData.groupPNCategoryName}
                  required
                >
                  <option value="">
                    {!addFormData.groupPNCategoryName 
                      ? "Select Group Name first" 
                      : filteredProducts.length === 0 
                        ? "No available products (all products in this group already have cost allocations)"
                        : "Select Product (Required)"
                    }
                  </option>
                  {filteredProducts.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.id} - {product.name}
                    </option>
                  ))}
                </select>
                {addFormData.groupProductID && (
                  <div className="selected-product-info">
                    <small>Selected: {addFormData.groupProductID} - {addFormData.productName}</small>
                  </div>
                )}
                {addFormData.groupPNCategoryName && filteredProducts.length === 0 && (
                  <div className="no-products-info">
                    <small style={{color: '#666', fontStyle: 'italic'}}>
                      All products in "{addFormData.groupPNCategoryName}" already have cost allocation entries.
                      Select a different group or edit existing entries.
                    </small>
                  </div>
                )}
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Proses Rate: *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addFormData.groupProsesRate}
                    onChange={(e) => handleAddFormChange('groupProsesRate', e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Kemas Rate: *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addFormData.groupKemasRate}
                    onChange={(e) => handleAddFormChange('groupKemasRate', e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
              
              <div className="form-info">
                <small>
                  * Required fields<br/>
                  • Both Group Name and Product must be selected<br/>
                  • Product rates are specific to the selected product only
                </small>
              </div>
            </div>
            <div className="modal-actions">
              <button 
                type="button" 
                className="modal-btn secondary" 
                onClick={handleCancelAdd}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="modal-btn primary" 
                onClick={handleSubmitAdd}
                disabled={!addFormData.groupPNCategoryName || !addFormData.groupProductID || !addFormData.groupProsesRate || !addFormData.groupKemasRate}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content delete-modal">
            <div className="modal-header">
              <h2>Delete Cost Allocation</h2>
              <button className="modal-close" onClick={handleDeleteCancel}>
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="delete-warning">
                <div className="warning-icon">
                  <Trash2 size={48} />
                </div>
                <h3>Are you sure you want to delete this cost allocation?</h3>
                
                {deletingItem && (
                  <div className="delete-info">
                    <div className="info-row">
                      <strong>Product:</strong>
                      <span>{deletingItem.productName}</span>
                    </div>
                    <div className="info-row">
                      <strong>Group:</strong>
                      <span>{deletingItem.groupName}</span>
                    </div>
                    <div className="info-row">
                      <strong>Proses Rate:</strong>
                      <span>{deletingItem.rateProses}</span>
                    </div>
                    <div className="info-row">
                      <strong>Kemas Rate:</strong>
                      <span>{deletingItem.rateKemas}</span>
                    </div>
                  </div>
                )}
                
                <p className="warning-text">
                  This action cannot be undone.
                </p>
              </div>
              
              <div className="modal-actions">
                <button 
                  className="modal-btn secondary" 
                  onClick={handleDeleteCancel}
                  disabled={submitLoading}
                >
                  Cancel
                </button>
                <button 
                  className="modal-btn danger" 
                  onClick={handleDeleteConfirm}
                  disabled={submitLoading}
                >
                  {submitLoading ? (
                    <>
                      <div className="btn-spinner"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Delete Cost Allocation
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pembebanan;
