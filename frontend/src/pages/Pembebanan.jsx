import React, { useState, useEffect } from 'react';
import { masterAPI } from '../services/api';
import '../styles/Pembebanan.css';
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
    groupProsesRate: '',
    groupKemasRate: ''
  });

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
  };

  const handleCancelAdd = () => {
    setShowAddModal(false);
    setAddFormData({
      groupPNCategoryID: '',
      groupPNCategoryName: '',
      groupProductID: null,
      groupProsesRate: '',
      groupKemasRate: ''
    });
  };

  const handleAddFormChange = (field, value) => {
    setAddFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmitAdd = async () => {
    try {
      const newEntry = {
        groupPNCategoryID: addFormData.groupPNCategoryID,
        groupPNCategoryName: addFormData.groupPNCategoryName,
        groupProductID: addFormData.groupProductID,
        groupProsesRate: parseFloat(addFormData.groupProsesRate) || 0,
        groupKemasRate: parseFloat(addFormData.groupKemasRate) || 0
      };
      
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
    <div className="pembebanan-page">
      <div className="page-header">
        <div className="header-top">
          <div className="title-section">
            <Users size={32} />
            <div>
              <h1>Cost Allocation Management</h1>
              <p>Manage product cost allocation rates for processing and packaging</p>
            </div>
          </div>
          
          <button className="add-btn" onClick={() => setShowAddModal(true)}>
            <Plus size={20} />
            Add New
          </button>
        </div>
        
        <div className="controls-section">
          <div className="search-filter-group">
            <div className="search-box">
              <Search size={20} />
              <input
                type="text"
                placeholder="Search by product name, group..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="filter-dropdown">
              <Filter size={20} />
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
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-scroll-wrapper">
          <table className="pembebanan-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('productId')} className="sortable">
                  Product ID
                  {sortField === 'productId' && (
                    sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                  )}
                </th>
                <th onClick={() => handleSort('productName')} className="sortable">
                  Product Name
                  {sortField === 'productName' && (
                    sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                  )}
                </th>
                <th onClick={() => handleSort('groupName')} className="sortable">
                  Group
                  {sortField === 'groupName' && (
                    sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                  )}
                </th>
                <th onClick={() => handleSort('rateProses')} className="sortable">
                  Rate Proses
                  {sortField === 'rateProses' && (
                    sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                  )}
                </th>
                <th onClick={() => handleSort('rateKemas')} className="sortable">
                  Rate Kemas
                  {sortField === 'rateKemas' && (
                    sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                  )}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(item => (
                <tr key={item.pk_id} className={item.isDefaultRate ? 'default-rate-row' : ''}>
                  <td>
                    {item.productId || '-'}
                  </td>
                  <td>
                    <div className="product-name-cell">
                      {item.isDefaultRate ? (
                        <span className="default-rate-name">{item.productName}</span>
                      ) : (
                        item.productName
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`group-badge ${item.isDefaultRate ? 'default' : 'product'}`}>
                      {item.groupName}
                    </span>
                  </td>
                  <td>
                    {editingRowId === item.pk_id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editFormData.rateProses}
                        onChange={(e) => handleEditChange('rateProses', e.target.value)}
                        className="edit-input"
                      />
                    ) : (
                      parseFloat(item.rateProses).toFixed(2)
                    )}
                  </td>
                  <td>
                    {editingRowId === item.pk_id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editFormData.rateKemas}
                        onChange={(e) => handleEditChange('rateKemas', e.target.value)}
                        className="edit-input"
                      />
                    ) : (
                      parseFloat(item.rateKemas).toFixed(2)
                    )}
                  </td>
                  <td>
                    <div className="table-actions">
                      {editingRowId === item.pk_id ? (
                        <>
                          <button
                            className="btn-save"
                            onClick={handleSubmitEdit}
                            disabled={submitLoading}
                          >
                            {submitLoading ? (
                              <>
                                <div className="btn-spinner"></div>
                                Saving...
                              </>
                            ) : (
                              <>
                                <Check size={16} />
                                Save
                              </>
                            )}
                          </button>
                          <button
                            className="btn-cancel"
                            onClick={handleCancelEdit}
                            disabled={submitLoading}
                          >
                            <X size={16} />
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            className="btn-edit"
                            onClick={() => handleEdit(item)}
                          >
                            <Edit size={16} />
                            Edit
                          </button>
                          <button 
                            className="btn-delete"
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredData.length === 0 ? (
        <div className="no-data-message">
          <Users size={48} />
          <h3>No Cost Allocation Data Found</h3>
          <p>
            {searchTerm || selectedGroup !== 'All Groups' 
              ? 'No data matches your current filters.' 
              : 'No cost allocation data available.'}
          </p>
        </div>
      ) : (
        <div className="table-info">
          <div className="pagination-container">
            <div className="pagination-info">
              <span>
                Showing {startItem} to {endItem} of {filteredData.length} entries
                {filteredData.length !== processedData.length && 
                  ` (filtered from ${processedData.length} total entries)`
                }
              </span>
            </div>
            
            {totalPages > 1 && (
              <div className="pagination-controls">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={20} />
                  Previous
                </button>
                
                <div className="page-numbers">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        className={`page-btn ${currentPage === pageNum ? 'active' : ''}`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
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
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
                <label>Category ID:</label>
                <input
                  type="text"
                  value={addFormData.groupPNCategoryID}
                  onChange={(e) => handleAddFormChange('groupPNCategoryID', e.target.value)}
                  placeholder="Enter category ID"
                />
              </div>
              <div className="form-group">
                <label>Category Name:</label>
                <input
                  type="text"
                  value={addFormData.groupPNCategoryName}
                  onChange={(e) => handleAddFormChange('groupPNCategoryName', e.target.value)}
                  placeholder="Enter category name"
                />
              </div>
              <div className="form-group">
                <label>Product ID (Optional):</label>
                <input
                  type="number"
                  value={addFormData.groupProductID || ''}
                  onChange={(e) => handleAddFormChange('groupProductID', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Leave empty for default rate"
                />
              </div>
              <div className="form-group">
                <label>Proses Rate:</label>
                <input
                  type="number"
                  step="0.01"
                  value={addFormData.groupProsesRate}
                  onChange={(e) => handleAddFormChange('groupProsesRate', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label>Kemas Rate:</label>
                <input
                  type="number"
                  step="0.01"
                  value={addFormData.groupKemasRate}
                  onChange={(e) => handleAddFormChange('groupKemasRate', e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button 
                type="button" 
                className="btn-cancel" 
                onClick={handleCancelAdd}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-save" 
                onClick={handleSubmitAdd}
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
              <p>Are you sure you want to delete this cost allocation entry?</p>
              {deletingItem && (
                <div className="delete-item-details">
                  <strong>Product:</strong> {deletingItem.productName}<br />
                  <strong>Group:</strong> {deletingItem.groupName}<br />
                  <strong>Proses Rate:</strong> {deletingItem.rateProses}<br />
                  <strong>Kemas Rate:</strong> {deletingItem.rateKemas}
                </div>
              )}
              <p className="warning-text">This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button 
                type="button" 
                className="btn-cancel" 
                onClick={handleDeleteCancel}
                disabled={submitLoading}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-delete" 
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
                    Delete Rate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pembebanan;
