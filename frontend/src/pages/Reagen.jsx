import React, { useState, useEffect } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus, Edit, Trash2, X, Check, Download, Upload } from 'lucide-react';
import AWN from 'awesome-notifications';
import 'awesome-notifications/dist/style.css';
import * as XLSX from 'xlsx';
import LoadingSpinner from '../components/LoadingSpinner';
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
    productId: '',
    productName: '',
    reagenRate: ''
  });
  
  // Sorting states
  const [sortField, setSortField] = useState('productId');
  const [sortDirection, setSortDirection] = useState('asc');

  // Load data function (placeholder for now)
  const loadReagenData = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const result = await reagenAPI.getReagenData();
      
      // Placeholder data for now
      const placeholderData = [
        { pk_id: 1, productId: 'P001', productName: 'Sample Product 1', reagenRate: 12.50 },
        { pk_id: 2, productId: 'P002', productName: 'Sample Product 2', reagenRate: 15.75 },
        { pk_id: 3, productId: 'P003', productName: 'Sample Product 3', reagenRate: 8.25 }
      ];
      
      setReagenData(placeholderData);
      setError('');
    } catch (err) {
      console.error('Error loading reagen data:', err);
      setError('Failed to load reagen data');
      notifier.alert('Failed to load reagen data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    loadReagenData();
  }, []);

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
      
      // TODO: Replace with actual API call
      // const updateData = {
      //   reagenRate: parseFloat(editFormData.reagenRate) || 0
      // };
      // await reagenAPI.updateReagen(editingRowId, updateData);
      
      // Placeholder success
      console.log('Updating reagen rate for ID:', editingRowId, 'Rate:', editFormData.reagenRate);
      
      // Refresh data and close edit mode
      await loadReagenData();
      setEditingRowId(null);
      setEditFormData({});
      
      notifier.success('Reagen rate updated successfully');
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

  const handleSubmitAdd = async () => {
    try {
      // Validation
      if (!addFormData.productId.trim()) {
        notifier.warning('Product ID is required');
        return;
      }
      
      if (!addFormData.productName.trim()) {
        notifier.warning('Product Name is required');
        return;
      }
      
      if (!addFormData.reagenRate || parseFloat(addFormData.reagenRate) < 0) {
        notifier.warning('Please enter a valid Reagen Rate (must be 0 or greater)');
        return;
      }

      setSubmitLoading(true);
      
      // TODO: Replace with actual API call
      // const newEntry = {
      //   productId: addFormData.productId.trim(),
      //   productName: addFormData.productName.trim(),
      //   reagenRate: parseFloat(addFormData.reagenRate)
      // };
      // await reagenAPI.addReagen(newEntry);
      
      // Placeholder success
      console.log('Adding new reagen entry:', addFormData);
      
      // Refresh data and close modal
      await loadReagenData();
      handleCancelAdd();
      
      notifier.success('Reagen entry added successfully');
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
      productId: '',
      productName: '',
      reagenRate: ''
    });
  };

  // Delete handler
  const handleDelete = async (item) => {
    if (window.confirm(`Are you sure you want to delete reagen entry for ${item.productId} - ${item.productName}?`)) {
      try {
        // TODO: Replace with actual API call
        // await reagenAPI.deleteReagen(item.pk_id);
        
        console.log('Deleting reagen entry:', item.pk_id);
        
        await loadReagenData();
        notifier.success('Reagen entry deleted successfully');
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
        <div className="table-container">
          <table className="reagen-table">
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
                <th onClick={() => handleSort('reagenRate')} className="sortable">
                  Reagen Rate
                  {sortField === 'reagenRate' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="4" className="no-data">
                    {searchTerm 
                      ? `No reagen entries found matching "${searchTerm}".`
                      : "No reagen entries found. Click 'Add New' to get started."
                    }
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr key={item.pk_id}>
                    <td className="product-id">{item.productId}</td>
                    <td className="product-name">{item.productName}</td>
                    <td className="reagen-rate">
                      {editingRowId === item.pk_id ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editFormData.reagenRate}
                          onChange={(e) => handleEditChange('reagenRate', e.target.value)}
                          className="edit-input"
                          placeholder="Reagen Rate"
                        />
                      ) : (
                        <span>{parseFloat(item.reagenRate || 0).toFixed(2)}</span>
                      )}
                    </td>
                    <td className="actions">
                      {editingRowId === item.pk_id ? (
                        <div className="edit-actions">
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
                        </div>
                      ) : (
                        <div className="view-actions">
                          <button 
                            className="edit-btn"
                            onClick={() => handleEdit(item)}
                            title="Edit Reagen Rate"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            className="delete-btn"
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
                <label>Product ID: *</label>
                <input
                  type="text"
                  value={addFormData.productId}
                  onChange={(e) => handleAddFormChange('productId', e.target.value)}
                  placeholder="Enter Product ID"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Product Name: *</label>
                <input
                  type="text"
                  value={addFormData.productName}
                  onChange={(e) => handleAddFormChange('productName', e.target.value)}
                  placeholder="Enter Product Name"
                  required
                />
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
                  • All fields must be filled<br/>
                  • Reagen Rate must be 0 or greater
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