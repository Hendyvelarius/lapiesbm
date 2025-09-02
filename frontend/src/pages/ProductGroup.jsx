import React, { useState, useEffect } from 'react';
import { masterAPI } from '../services/api';
import '../styles/ProductGroup.css';
import { Search, Filter, Edit, Trash2, Users, ChevronLeft, ChevronRight, X, Check, ChevronUp, ChevronDown } from 'lucide-react';

const ProductGroup = () => {
  const [groupData, setGroupData] = useState([]);
  const [groupManualData, setGroupManualData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [paginatedData, setPaginatedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  
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

  // Dropdown options
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [deptOptions, setDeptOptions] = useState([]);

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    filterData();
  }, [groupData, searchTerm, selectedCategory, sortField, sortDirection]);

  useEffect(() => {
    paginateData();
  }, [filteredData, currentPage]);

  useEffect(() => {
    // Extract unique categories and departments for dropdowns
    if (groupData.length > 0) {
      const categories = [...new Set(groupData.map(item => ({
        id: item.pnCategory,
        name: item.pnCategoryName
      })).filter(cat => cat.name).map(cat => JSON.stringify(cat)))].map(cat => JSON.parse(cat));
      
      const departments = [...new Set(groupData.map(item => item.dept).filter(dept => dept))];
      
      setCategoryOptions(categories);
      setDeptOptions(departments);
    }
  }, [groupData]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch both group and groupManual data
      const [groupResponse, groupManualResponse] = await Promise.all([
        masterAPI.getGroup(),
        masterAPI.getGroupManual()
      ]);
      
      // Transform group data
      const transformedGroupData = groupResponse.map(item => ({
        pk_id: item.Group_ProductID, // Use ProductID as primary key
        periode: item.Periode,
        productId: item.Group_ProductID,
        productName: item.Product_Name,
        pnCategory: item.Group_PNCategory,
        pnCategoryName: item.Group_PNCategoryName,
        manHourPros: item.Group_ManHourPros,
        manHourPack: item.Group_ManHourPack,
        rendemen: item.Group_Rendemen,
        dept: item.Group_Dept,
        mhtBB: item.Group_MHT_BB || 0,
        mhtBK: item.Group_MHT_BK || 0,
        mhAnalisa: item.Group_MH_Analisa || 0,
        kwhMesin: item.Group_KWH_Mesin || 0,
        sumberData: item.Sumber_Data || 'LMS' // Add source data with fallback
      }));

      setGroupData(transformedGroupData);
      setGroupManualData(groupManualResponse);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Check if a product exists in manual data
  const isInManual = (productId) => {
    return groupManualData.some(item => item.Group_ProductID === productId);
  };

  // Get source data for display
  const getSourceData = (item) => {
    // If item has explicit sumberData, use it
    if (item.sumberData) {
      return item.sumberData;
    }
    // Otherwise, check if it exists in manual data
    return isInManual(item.productId) ? 'Manual' : 'LMS';
  };

  // Sorting functionality
  const handleSort = (field) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);
  };

  const sortData = (data) => {
    if (!sortField) return data;
    
    return [...data].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      // Handle numeric fields
      if (['manHourPros', 'manHourPack', 'rendemen', 'pnCategory', 'mhtBB', 'mhtBK', 'mhAnalisa', 'kwhMesin'].includes(sortField)) {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      } else {
        // Handle string fields
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const filterData = () => {
    let filtered = groupData;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        // Original search fields
        const basicSearch = (
          String(item.productId).toLowerCase().includes(searchLower) ||
          String(item.productName).toLowerCase().includes(searchLower) ||
          String(item.pnCategoryName).toLowerCase().includes(searchLower)
        );
        
        // Source data search using helper function
        const sourceData = getSourceData(item);
        const sourceSearch = (
          (searchLower === 'lms' && sourceData === 'LMS') ||
          (searchLower === 'manual' && sourceData === 'Manual') ||
          (searchLower === 'mnl' && sourceData === 'Manual')
        );
        
        return basicSearch || sourceSearch;
      });
    }

    if (selectedCategory !== 'All Categories') {
      filtered = filtered.filter(item => item.pnCategoryName === selectedCategory);
    }

    // Apply sorting
    filtered = sortData(filtered);

    setFilteredData(filtered);
    
    // Reset to page 1 if current page would be empty after filtering
    const maxPage = Math.ceil(filtered.length / itemsPerPage) || 1;
    if (currentPage > maxPage) {
      setCurrentPage(1);
    }
  };

  const paginateData = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = filteredData.slice(startIndex, endIndex);
    setPaginatedData(paginated);
  };

  const getTotalPages = () => {
    return Math.ceil(filteredData.length / itemsPerPage);
  };

  // Helper function to get category badge class
  const getCategoryBadgeClass = (pnCategory, pnCategoryName) => {
    // If we have a valid category number, use it
    if (pnCategory && !isNaN(parseInt(pnCategory))) {
      return `category-badge category-${parseInt(pnCategory)}`;
    }
    
    // If no valid category number but we have a name, create a hash-based class
    if (pnCategoryName) {
      // Simple hash function to generate consistent category numbers from names
      let hash = 0;
      for (let i = 0; i < pnCategoryName.length; i++) {
        const char = pnCategoryName.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      const categoryNum = (Math.abs(hash) % 20) + 1; // Generate number 1-20
      return `category-badge category-${categoryNum}`;
    }
    
    // Fallback to default
    return 'category-badge';
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= getTotalPages()) {
      setCurrentPage(newPage);
    }
  };

  // Inline editing functions
  const handleEditClick = (item) => {
    setEditingRowId(item.productId);
    setEditFormData({
      pnCategory: item.pnCategory,
      pnCategoryName: item.pnCategoryName,
      manHourPros: item.manHourPros || '',
      manHourPack: item.manHourPack || '',
      rendemen: item.rendemen || '',
      dept: item.dept || '',
      mhtBB: item.mhtBB || '',
      mhtBK: item.mhtBK || '',
      mhAnalisa: item.mhAnalisa || '',
      kwhMesin: item.kwhMesin || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingRowId(null);
    setEditFormData({});
  };

  const handleFormChange = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // If group is changed, update group name
    if (field === 'pnCategory') {
      const selectedCategory = categoryOptions.find(cat => cat.id === parseInt(value));
      if (selectedCategory) {
        setEditFormData(prev => ({
          ...prev,
          pnCategoryName: selectedCategory.name
        }));
      }
    }
  };

  const handleSubmitEdit = async (item) => {
    try {
      setSubmitLoading(true);
      
      const submitData = {
        productId: item.productId,
        productName: item.productName,
        pnCategory: editFormData.pnCategory,
        pnCategoryName: editFormData.pnCategoryName,
        manHourPros: parseFloat(editFormData.manHourPros) || 0,
        manHourPack: parseFloat(editFormData.manHourPack) || 0,
        rendemen: parseFloat(editFormData.rendemen) || 0,
        dept: editFormData.dept,
        mhtBB: parseFloat(editFormData.mhtBB) || 0,
        mhtBK: parseFloat(editFormData.mhtBK) || 0,
        mhAnalisa: parseFloat(editFormData.mhAnalisa) || 0,
        kwhMesin: parseFloat(editFormData.kwhMesin) || 0
      };

      const isManualItem = isInManual(item.productId);
      
      if (isManualItem) {
        // Update existing manual entry
        await masterAPI.updateGroup(item.productId, submitData);
      } else {
        // Create new manual entry
        await masterAPI.addGroup(submitData);
      }

      // Refresh data
      await fetchAllData();
      
      // Reset editing state
      setEditingRowId(null);
      setEditFormData({});
      
    } catch (error) {
      console.error('Error saving group data:', error);
      setError('Failed to save data. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Delete functionality
  const handleDeleteClick = (item) => {
    setDeletingItem(item);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setSubmitLoading(true);
      await masterAPI.deleteGroup(deletingItem.productId);
      
      // Refresh data
      await fetchAllData();
      
      setShowDeleteModal(false);
      setDeletingItem(null);
      
    } catch (error) {
      console.error('Error deleting group:', error);
      setError('Failed to delete item. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setDeletingItem(null);
  };

  // Helper functions
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString();
  };

  const getCategories = () => {
    const categories = [...new Set(groupData.map(item => item.pnCategoryName).filter(Boolean))];
    return ['All Categories', ...categories];
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Loading product groups...</p>
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
    <div className="product-group-container">
      <div className="controls-section">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-controls">
          <div className="category-filter">
            <Filter size={18} />
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {getCategories().map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-scroll-wrapper">
          <table className="groups-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('productId')} className="sortable">
                  ID
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
                <th onClick={() => handleSort('pnCategoryName')} className="sortable">
                  Group Name
                  {sortField === 'pnCategoryName' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('manHourPros')} className="sortable">
                  MH Process
                  {sortField === 'manHourPros' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('manHourPack')} className="sortable">
                  MH Packing
                  {sortField === 'manHourPack' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('rendemen')} className="sortable">
                  Yield (%)
                  {sortField === 'rendemen' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('dept')} className="sortable">
                  Dept.
                  {sortField === 'dept' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('mhtBB')} className="sortable">
                  MHT BB
                  {sortField === 'mhtBB' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('mhtBK')} className="sortable">
                  MHT BK
                  {sortField === 'mhtBK' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('mhAnalisa')} className="sortable">
                  MH Analisa
                  {sortField === 'mhAnalisa' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('kwhMesin')} className="sortable">
                  KWH Mesin
                  {sortField === 'kwhMesin' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item) => (
                <tr key={item.productId}>
                  <td className="product-id">
                    <div className="product-id-container">
                      <span className="id-text">{item.productId}</span>
                      <span className={`source-badge ${getSourceData(item) === 'Manual' ? 'manual' : 'lms'}`}>
                        {getSourceData(item) === 'Manual' ? 'MNL' : 'LMS'}
                      </span>
                    </div>
                  </td>
                  <td className="product-name">
                    <div className="name-cell">
                      <span className="name">{item.productName}</span>
                    </div>
                  </td>
                  
                  {editingRowId === item.productId ? (
                    // Editing mode
                    <>
                      <td>
                        <select 
                          value={editFormData.pnCategory}
                          onChange={(e) => handleFormChange('pnCategory', e.target.value)}
                          className="edit-select"
                        >
                          <option value="">Select Category</option>
                          {categoryOptions.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={editFormData.manHourPros}
                          onChange={(e) => handleFormChange('manHourPros', e.target.value)}
                          className="edit-input"
                          placeholder="Process"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={editFormData.manHourPack}
                          onChange={(e) => handleFormChange('manHourPack', e.target.value)}
                          className="edit-input"
                          placeholder="Packing"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={editFormData.rendemen}
                          onChange={(e) => handleFormChange('rendemen', e.target.value)}
                          className="edit-input"
                          placeholder="Rendemen"
                        />
                      </td>
                      <td>
                        <select 
                          value={editFormData.dept}
                          onChange={(e) => handleFormChange('dept', e.target.value)}
                          className="edit-select"
                        >
                          <option value="">Select Dept</option>
                          {deptOptions.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={editFormData.mhtBB}
                          onChange={(e) => handleFormChange('mhtBB', e.target.value)}
                          className="edit-input"
                          placeholder="MHT BB"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={editFormData.mhtBK}
                          onChange={(e) => handleFormChange('mhtBK', e.target.value)}
                          className="edit-input"
                          placeholder="MHT BK"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={editFormData.mhAnalisa}
                          onChange={(e) => handleFormChange('mhAnalisa', e.target.value)}
                          className="edit-input"
                          placeholder="MH Analisa"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={editFormData.kwhMesin}
                          onChange={(e) => handleFormChange('kwhMesin', e.target.value)}
                          className="edit-input"
                          placeholder="KWH Mesin"
                        />
                      </td>
                      <td className="actions editing-mode">
                        <button 
                          className="submit-btn"
                          onClick={() => handleSubmitEdit(item)}
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
                        <span className={getCategoryBadgeClass(item.pnCategory, item.pnCategoryName)}>
                          {item.pnCategoryName}
                        </span>
                      </td>
                      <td className="manhour">{formatNumber(item.manHourPros)}</td>
                      <td className="manhour">{formatNumber(item.manHourPack)}</td>
                      <td className="rendemen">{item.rendemen ? `${item.rendemen}%` : '-'}</td>
                      <td className="dept">{item.dept || '-'}</td>
                      <td className="mht-bb">{formatNumber(item.mhtBB)}</td>
                      <td className="mht-bk">{formatNumber(item.mhtBK)}</td>
                      <td className="mh-analisa">{formatNumber(item.mhAnalisa)}</td>
                      <td className="kwh-mesin">{formatNumber(item.kwhMesin)}</td>
                      <td className={`actions display-mode ${isInManual(item.productId) ? 'multiple-buttons' : 'single-button'}`}>
                        <button 
                          className="edit-btn"
                          onClick={() => handleEditClick(item)}
                          title="Edit Group"
                        >
                          <Edit size={16} />
                        </button>
                        {isInManual(item.productId) && (
                          <button 
                            className="delete-btn"
                            onClick={() => handleDeleteClick(item)}
                            title="Delete Group"
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
            <h3>No Product Groups Found</h3>
            <p>
              {searchTerm
                ? selectedCategory === 'All Categories'
                  ? 'No groups match your search.'
                  : `No ${selectedCategory.toLowerCase()} groups match your search.`
                : selectedCategory === 'All Categories'
                  ? 'No groups available.'
                  : `No ${selectedCategory.toLowerCase()} groups available.`
              }
            </p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {filteredData.length > 0 && (
        <div className="pagination-container">
          <div className="pagination-info">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
          </div>
          
          <div className="pagination-controls">
            <button 
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            
            <div className="page-numbers">
              {Array.from({ length: Math.min(5, getTotalPages()) }, (_, i) => {
                const pageNumber = Math.max(1, Math.min(getTotalPages() - 4, currentPage - 2)) + i;
                return (
                  <button
                    key={pageNumber}
                    className={`page-number ${currentPage === pageNumber ? 'active' : ''}`}
                    onClick={() => handlePageChange(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                );
              })}
            </div>
            
            <button 
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === getTotalPages()}
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="table-info">
        <span>{filteredData.length} of {groupData.length} groups</span>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content delete-modal">
            <div className="modal-header">
              <h2>Delete Product Group</h2>
              <button className="modal-close" onClick={handleDeleteCancel}>
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="delete-warning">
                <div className="warning-icon">
                  <Trash2 size={48} />
                </div>
                <h3>Are you sure you want to delete this group?</h3>
                
                <div className="delete-info">
                  <div className="info-row">
                    <strong>Product ID:</strong>
                    <span>{deletingItem?.productId}</span>
                  </div>
                  <div className="info-row">
                    <strong>Product Name:</strong>
                    <span>{deletingItem?.productName}</span>
                  </div>
                  <div className="info-row">
                    <strong>Category:</strong>
                    <span>{deletingItem?.pnCategoryName}</span>
                  </div>
                </div>
                
                <p className="warning-text">
                  This action cannot be undone. The product will revert to default settings.
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
                      Delete Group
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

export default ProductGroup;
