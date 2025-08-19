import React, { useState, useEffect, useMemo, useRef } from 'react';
import { masterAPI } from '../services/api';
import '../styles/ProductGroup.css';
import { Search, Filter, Edit, Trash2, Users, ChevronLeft, ChevronRight, X } from 'lucide-react';

const ProductGroup = () => {
  const [groupData, setGroupData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [paginatedData, setPaginatedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    productId: '',
    productName: '',
    pnCategory: '',
    pnCategoryName: '',
    manHourPros: '',
    manHourPack: '',
    rendemen: '',
    dept: ''
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    filterData();
  }, [groupData, searchTerm, selectedCategory]);

  useEffect(() => {
    paginateData();
  }, [filteredData, currentPage]);

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError('');

      const groupResponse = await masterAPI.getGroup();
      
      // Transform the data to match our component structure
      const transformedData = groupResponse.map(item => ({
        pk_id: item.pk_id,
        periode: item.Periode,
        productId: item.Group_ProductID,
        productName: item.Product_Name,
        pnCategory: item.Group_PNCategory,
        pnCategoryName: item.Group_PNCategoryName,
        manHourPros: item.Group_ManHourPros,
        manHourPack: item.Group_ManHourPack,
        rendemen: item.Group_Rendemen,
        dept: item.Group_Dept
      }));

      setGroupData(transformedData);
    } catch (err) {
      setError('Failed to fetch product group data');
      console.error('Error fetching product group data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    let filtered = groupData;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.productId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.pnCategoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.dept.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== 'All Categories') {
      filtered = filtered.filter(item => item.pnCategoryName === selectedCategory);
    }

    setFilteredData(filtered);
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

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= getTotalPages()) {
      setCurrentPage(newPage);
    }
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('id-ID').format(value);
  };

  const getUniqueCategories = () => {
    const categories = ['All Categories', ...new Set(groupData.map(item => item.pnCategoryName))];
    return categories;
  };

  const handleAddGroup = async () => {
    setModalMode('add');
    setEditingItem(null);
    setShowModal(true);
    setModalLoading(false);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setModalMode('add');
    setEditingItem(null);
    setFormData({
      productId: '',
      productName: '',
      pnCategory: '',
      pnCategoryName: '',
      manHourPros: '',
      manHourPack: '',
      rendemen: '',
      dept: ''
    });
  };

  const handleEditGroup = async (item) => {
    setModalMode('edit');
    setEditingItem(item);
    setShowModal(true);
    setModalLoading(false);
    
    // Pre-fill form with existing data
    setFormData({
      productId: item.productId,
      productName: item.productName,
      pnCategory: item.pnCategory.toString(),
      pnCategoryName: item.pnCategoryName,
      manHourPros: item.manHourPros.toString(),
      manHourPack: item.manHourPack.toString(),
      rendemen: item.rendemen.toString(),
      dept: item.dept
    });
  };

  const handleDeleteGroup = (item) => {
    setDeletingItem(item);
    setShowDeleteModal(true);
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitLoading(true);
      
      const submitData = {
        productId: formData.productId,
        productName: formData.productName,
        pnCategory: parseInt(formData.pnCategory),
        pnCategoryName: formData.pnCategoryName,
        manHourPros: parseFloat(formData.manHourPros),
        manHourPack: parseFloat(formData.manHourPack),
        rendemen: parseFloat(formData.rendemen),
        dept: formData.dept,
        userId: 'GWN'
      };
      
      if (modalMode === 'edit') {
        await masterAPI.updateGroup(editingItem.pk_id, submitData);
      } else {
        await masterAPI.addGroup(submitData);
      }
      
      // Refresh the data
      await fetchAllData();
      
      // Close modal
      handleModalClose();
      
    } catch (error) {
      console.error(`Error ${modalMode === 'edit' ? 'updating' : 'adding'} group:`, error);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      setSubmitLoading(true);
      await masterAPI.deleteGroup(deletingItem.pk_id);
      
      // Refresh the data
      await fetchAllData();
      
      // Close delete modal
      setShowDeleteModal(false);
      setDeletingItem(null);
      
    } catch (error) {
      console.error('Error deleting group:', error);
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="product-group-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading product group data...</p>
        </div>
      </div>
    );
  }

  if (error && groupData.length === 0) {
    return (
      <div className="product-group-container">
        <div className="error-message">
          <Users size={48} />
          <h3>Error Loading Data</h3>
          <p>{error}</p>
          <button onClick={fetchAllData} className="retry-btn">
            Try Again
          </button>
        </div>
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
              {getUniqueCategories().map(category => (
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
              <th>Product ID</th>
              <th>Product Name</th>
              <th>Category Name</th>
              <th>ManHour Process</th>
              <th>ManHour Packing</th>
              <th>Rendemen (%)</th>
              <th>Department</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item) => (
              <tr key={item.pk_id}>
                <td className="product-id">{item.productId}</td>
                <td className="product-name">
                  <div className="name-cell">
                    <span className="name">{item.productName}</span>
                  </div>
                </td>
                <td>
                  <span className={`category-badge category-${item.pnCategory}`}>
                    {item.pnCategoryName}
                  </span>
                </td>
                <td className="manhour">{formatNumber(item.manHourPros)}</td>
                <td className="manhour">{formatNumber(item.manHourPack)}</td>
                <td className="rendemen">{item.rendemen}%</td>
                <td className="dept">{item.dept}</td>
                <td className="actions">
                  <button 
                    className="edit-btn"
                    onClick={() => handleEditGroup(item)}
                    title="Edit Group"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    className="delete-btn"
                    onClick={() => handleDeleteGroup(item)}
                    title="Delete Group"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
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
            Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredData.length)} to{' '}
            {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} groups
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
              {Array.from({ length: Math.min(5, getTotalPages()) }, (_, index) => {
                let pageNumber;
                const totalPages = getTotalPages();
                
                if (totalPages <= 5) {
                  pageNumber = index + 1;
                } else {
                  if (currentPage <= 3) {
                    pageNumber = index + 1;
                  } else if (currentPage > totalPages - 3) {
                    pageNumber = totalPages - 4 + index;
                  } else {
                    pageNumber = currentPage - 2 + index;
                  }
                }
                
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

      {/* Add/Edit Group Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{modalMode === 'edit' ? 'Edit Product Group' : 'Add New Product Group'}</h2>
              <button className="modal-close" onClick={handleModalClose}>
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Product ID</label>
                  <input
                    type="text"
                    value={formData.productId}
                    onChange={(e) => handleFormChange('productId', e.target.value)}
                    placeholder="Enter Product ID"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Product Name</label>
                  <input
                    type="text"
                    value={formData.productName}
                    onChange={(e) => handleFormChange('productName', e.target.value)}
                    placeholder="Enter Product Name"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>PN Category</label>
                  <input
                    type="number"
                    value={formData.pnCategory}
                    onChange={(e) => handleFormChange('pnCategory', e.target.value)}
                    placeholder="Enter Category Number"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Category Name</label>
                  <input
                    type="text"
                    value={formData.pnCategoryName}
                    onChange={(e) => handleFormChange('pnCategoryName', e.target.value)}
                    placeholder="Enter Category Name"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>ManHour Process</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.manHourPros}
                    onChange={(e) => handleFormChange('manHourPros', e.target.value)}
                    placeholder="Enter Process Hours"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>ManHour Packing</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.manHourPack}
                    onChange={(e) => handleFormChange('manHourPack', e.target.value)}
                    placeholder="Enter Packing Hours"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Rendemen (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.rendemen}
                    onChange={(e) => handleFormChange('rendemen', e.target.value)}
                    placeholder="Enter Rendemen Percentage"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Department</label>
                  <input
                    type="text"
                    value={formData.dept}
                    onChange={(e) => handleFormChange('dept', e.target.value)}
                    placeholder="Enter Department"
                    required
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  className="modal-btn secondary" 
                  onClick={handleModalClose}
                  disabled={submitLoading}
                >
                  Cancel
                </button>
                <button 
                  className="modal-btn primary" 
                  onClick={handleSubmit}
                  disabled={!formData.productId || !formData.productName || submitLoading}
                >
                  {submitLoading ? (
                    <>
                      <div className="btn-spinner"></div>
                      {modalMode === 'edit' ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    <>
                      {modalMode === 'edit' ? <Edit size={16} /> : <Plus size={16} />}
                      {modalMode === 'edit' ? 'Update Group' : 'Add Group'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingItem && (
        <div className="modal-overlay">
          <div className="modal-content delete-modal">
            <div className="modal-header">
              <h2>Confirm Delete</h2>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="delete-warning">
                <Trash2 size={48} className="warning-icon" />
                <h3>Please make sure this is what you want to delete</h3>
                <div className="delete-info">
                  <div className="info-row">
                    <strong>Product ID:</strong>
                    <span>{deletingItem.productId}</span>
                  </div>
                  <div className="info-row">
                    <strong>Product Name:</strong>
                    <span>{deletingItem.productName}</span>
                  </div>
                  <div className="info-row">
                    <strong>Category:</strong>
                    <span>{deletingItem.pnCategoryName}</span>
                  </div>
                  <div className="info-row">
                    <strong>Department:</strong>
                    <span>{deletingItem.dept}</span>
                  </div>
                </div>
                <p className="warning-text">This action cannot be undone.</p>
              </div>

              <div className="modal-actions">
                <button 
                  className="modal-btn secondary" 
                  onClick={() => setShowDeleteModal(false)}
                  disabled={submitLoading}
                >
                  Cancel
                </button>
                <button 
                  className="modal-btn danger" 
                  onClick={handleConfirmDelete}
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
                      Confirm Delete
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
