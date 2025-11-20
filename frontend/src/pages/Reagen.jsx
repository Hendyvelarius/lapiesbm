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
  
  // Period state
  const [selectedPeriode, setSelectedPeriode] = useState(new Date().getFullYear().toString());
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(0);
  
  // Modal and editing states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [importConfirmData, setImportConfirmData] = useState(null);
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
        // Filter by selected periode and map the data to include product names
        const filteredByPeriode = result.data.filter(item => 
          item.Periode === selectedPeriode
        );
        
        const mappedData = filteredByPeriode.map(item => {
          const productInfo = productNames.find(p => p.Product_ID === item.ProductID);
          return {
            pk_id: item.pk_id,
            productId: item.ProductID,
            productName: productInfo ? productInfo.Product_Name : `Product ${item.ProductID}`,
            reagenRate: item.Reagen_Rate,
            periode: item.Periode,
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

  // Reload data when periode changes
  useEffect(() => {
    if (productNames.length > 0) {
      loadReagenData();
      setCurrentPage(1); // Reset to first page when changing year
    }
  }, [selectedPeriode]);

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
      if (reagenData.length === 0) {
        notifier.warning('No reagen data to export.');
        return;
      }

      const exportData = reagenData.map(item => ({
        'Product ID': item.productId,
        'Product Name': item.productName,
        'Reagen Rate': parseFloat(item.reagenRate || 0).toFixed(2)
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      ws['!cols'] = [
        { wch: 15 }, // Product ID
        { wch: 50 }, // Product Name
        { wch: 15 }  // Reagen Rate
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Reagen Data');

      const filename = `Reagen_${selectedPeriode}.xlsx`;

      XLSX.writeFile(wb, filename);
      notifier.success(`Excel file exported successfully! (${exportData.length} entries for year ${selectedPeriode})`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      notifier.alert('Failed to export Excel file. Please try again.');
    }
  };

  // Import Excel functionality
  const handleImportExcel = () => {
    setShowImportModal(true);
  };

  // Handle import modal confirmation
  const handleImportConfirm = () => {
    setShowImportModal(false);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = handleFileUpload;
    input.click();
  };

  // Handle final import confirmation
  const handleFinalImportConfirm = async () => {
    if (importConfirmData && importConfirmData.validEntries) {
      setShowConfirmModal(false);
      await performBulkImport(importConfirmData.validEntries);
      setImportConfirmData(null);
    }
  };

  // Handle import cancellation
  const handleImportCancel = () => {
    setShowConfirmModal(false);
    setImportConfirmData(null);
  };

  // Handle file upload and processing
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      notifier.info('Processing Excel file...');

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        throw new Error('Excel file must contain at least a header row and one data row');
      }

      // Process the Excel data
      await processImportData(jsonData);

    } catch (error) {
      console.error('Error processing Excel file:', error);
      notifier.alert('Error processing Excel file: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Process and validate import data
  const processImportData = async (jsonData) => {
    try {
      // Skip header row and filter out empty rows
      const dataRows = jsonData.slice(1).filter(row => 
        row && row.length > 0 && row[0] && String(row[0]).trim() !== ''
      );

      if (dataRows.length === 0) {
        throw new Error('No valid data rows found in Excel file');
      }

      const validationResults = [];
      const validEntries = [];
      const errors = [];

      notifier.info(`Validating ${dataRows.length} entries...`);

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNum = i + 2; // +2 because we start from row 2 (after header)
        
        const productId = row[0] ? String(row[0]).trim() : '';
        const reagenRate = row[2]; // Column C

        // Validate Product ID
        if (!productId) {
          errors.push(`Row ${rowNum}: Product ID is required`);
          continue;
        }

        // Validate Reagen Rate
        if (reagenRate === undefined || reagenRate === null || reagenRate === '') {
          errors.push(`Row ${rowNum}: Reagen Rate is required`);
          continue;
        }

        const numericRate = parseFloat(reagenRate);
        if (isNaN(numericRate) || numericRate < 0) {
          errors.push(`Row ${rowNum}: Reagen Rate must be a number 0 or greater (got: ${reagenRate})`);
          continue;
        }

        // Check if Product ID exists in Group PNCategory 8
        const productInfo = productNames.find(p => 
          p.Product_ID === productId && p.Group_PNCategory === 8
        );

        if (!productInfo) {
          const generalProduct = productNames.find(p => p.Product_ID === productId);
          if (generalProduct) {
            errors.push(`Row ${rowNum}: Product ID "${productId}" does not belong to Group PNCategory 8 (found in category ${generalProduct.Group_PNCategory})`);
          } else {
            errors.push(`Row ${rowNum}: Product ID "${productId}" does not exist in the system`);
          }
          continue;
        }

        // Check for duplicates in import data
        const existingEntry = validEntries.find(e => e.productId === productId);
        if (existingEntry) {
          errors.push(`Row ${rowNum}: Duplicate Product ID "${productId}" (first occurrence at row ${existingEntry.originalRow})`);
          continue;
        }

        validEntries.push({
          productId,
          reagenRate: numericRate,
          originalRow: rowNum,
          productName: productInfo.Product_Name
        });
      }

      // Show validation results
      if (errors.length > 0) {
        const errorMessage = `Validation failed with ${errors.length} error(s):\n\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n\n... and ${errors.length - 10} more errors` : ''}`;
        notifier.alert(errorMessage);
        return;
      }

      if (validEntries.length === 0) {
        throw new Error('No valid entries found after validation');
      }

      // Show confirmation modal
      setImportConfirmData({
        validEntries,
        currentDataCount: reagenData.length,
        newDataCount: validEntries.length
      });
      setShowConfirmModal(true);

    } catch (error) {
      console.error('Error processing import data:', error);
      notifier.alert('Error processing import data: ' + error.message);
    }
  };

  // Perform bulk import (delete all, then insert)
  const performBulkImport = async (validEntries) => {
    try {
      setLoading(true);
      notifier.info('Importing reagen data...');

      // Step 1: Delete all existing entries for the selected periode
      notifier.info(`Removing existing data for year ${selectedPeriode}...`);
      const deleteResult = await reagenAPI.bulkDeleteByPeriode(selectedPeriode);
      if (!deleteResult.success) {
        throw new Error(deleteResult.message || 'Failed to delete existing entries');
      }

      // Step 2: Prepare entries for bulk insert with proper user tracking
      const userId = user?.logNIK || user?.nama || user?.inisialNama || 'SYSTEM';
      const entriesToInsert = validEntries.map(entry => ({
        productId: entry.productId,
        reagenRate: entry.reagenRate,
        periode: selectedPeriode,
        userId: userId,
        delegatedTo: null,
        processDate: new Date().toISOString()
      }));

      // Step 3: Bulk insert new entries
      notifier.info('Inserting new data...');
      const insertResult = await reagenAPI.bulkInsert(entriesToInsert, userId);
      
      if (!insertResult.success) {
        throw new Error(insertResult.message || 'Failed to insert new entries');
      }

      // Step 4: Reload data and notify success
      await loadReagenData();
      
      notifier.success(`Import completed successfully! Imported ${validEntries.length} entries for year ${selectedPeriode}.`);

    } catch (error) {
      console.error('Error performing bulk import:', error);
      notifier.alert('Import failed: ' + error.message);
      
      // Reload data to refresh the current state
      await loadReagenData();
    } finally {
      setLoading(false);
    }
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
              disabled={loading || productNames.length === 0}
              title={productNames.length === 0 ? "Please wait for product data to load" : "Import reagen data from Excel (replaces all existing data)"}
            >
              <Upload size={16} />
              Import Excel
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
          <div className="period-selector">
            <label htmlFor="reagen-periode-select">Year:</label>
            <select
              id="reagen-periode-select"
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

      {/* Import Instructions Modal */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-content import-instructions-modal">
            <div className="modal-header">
              <h2>Import Reagen Data</h2>
              <button className="modal-close" onClick={() => setShowImportModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div className="instructions-section">
                <h3>📅 Select Year for Import:</h3>
                <select 
                  value={selectedPeriode} 
                  onChange={(e) => setSelectedPeriode(e.target.value)}
                  className="periode-select"
                  style={{ width: '150px', padding: '8px', marginTop: '10px', fontSize: '14px' }}
                >
                  {[...Array(5)].map((_, i) => {
                    const year = new Date().getFullYear() - 2 + i;
                    return <option key={year} value={year.toString()}>{year}</option>;
                  })}
                </select>
                <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
                  All imported entries will be assigned to year <strong>{selectedPeriode}</strong>
                </p>
              </div>

              <div className="instructions-section">
                <h3>📋 Expected Excel Format:</h3>
                <div className="format-example">
                  <table className="format-table">
                    <thead>
                      <tr>
                        <th>Product ID</th>
                        <th>Product Name</th>
                        <th>Reagen Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>G5</td>
                        <td>LAMESON-125 mg/2 mL injeksi</td>
                        <td>12.50</td>
                      </tr>
                      <tr>
                        <td>G6</td>
                        <td>LAPIBAL-500 µG INJEKSI</td>
                        <td>15.75</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="instructions-section">
                <h3>✅ Validation Rules:</h3>
                <ul>
                  <li>Column A: <strong>Product ID</strong> (required)</li>
                  <li>Column B: <strong>Product Name</strong> (reference only, will be ignored)</li>
                  <li>Column C: <strong>Reagen Rate</strong> (required, must be 0 or greater)</li>
                  <li>First row must contain headers</li>
                  <li>All Product IDs must belong to <strong>Group PNCategory 8</strong></li>
                  <li>Product IDs must exist in the system</li>
                  <li>Empty rows will be ignored</li>
                </ul>
              </div>

              <div className="instructions-section warning-section">
                <h3>⚠️ Important Warning:</h3>
                <ul>
                  <li><strong>All existing reagen data for year {selectedPeriode} will be REPLACED</strong></li>
                  <li>This operation cannot be undone</li>
                  <li>Make sure your data is correct before importing</li>
                </ul>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setShowImportModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={handleImportConfirm}
              >
                Select Excel File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Confirmation Modal */}
      {showConfirmModal && importConfirmData && (
        <div className="modal-overlay">
          <div className="modal-content import-confirm-modal">
            <div className="modal-header">
              <h2>Confirm Import</h2>
              <button className="modal-close" onClick={handleImportCancel}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div className="confirmation-section success-section">
                <h3>✅ Validation Successful!</h3>
                <ul>
                  <li><strong>{importConfirmData.validEntries.length}</strong> valid entries ready to import</li>
                  <li>All Product IDs belong to Group PNCategory 8</li>
                  <li>All Reagen Rates are valid numbers</li>
                </ul>
              </div>

              <div className="confirmation-section warning-section">
                <h3>⚠️ Data Replacement Warning:</h3>
                <div className="data-comparison">
                  <div className="data-item">
                    <span className="label">Current entries:</span>
                    <span className="value current">{importConfirmData.currentDataCount}</span>
                  </div>
                  <div className="data-item">
                    <span className="label">New entries:</span>
                    <span className="value new">{importConfirmData.newDataCount}</span>
                  </div>
                </div>
                <p className="warning-text">
                  This will <strong>permanently replace all existing reagen data</strong>. 
                  This operation cannot be undone.
                </p>
              </div>

              <div className="confirmation-section">
                <h3>📋 Preview of Import Data:</h3>
                <div className="preview-table-container">
                  <table className="preview-table">
                    <thead>
                      <tr>
                        <th>Product ID</th>
                        <th>Product Name</th>
                        <th>Reagen Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importConfirmData.validEntries.slice(0, 5).map((entry, index) => (
                        <tr key={index}>
                          <td className="product-id-cell">{entry.productId}</td>
                          <td className="product-name-cell">{entry.productName}</td>
                          <td className="reagen-rate-cell">{entry.reagenRate.toFixed(2)}</td>
                        </tr>
                      ))}
                      {importConfirmData.validEntries.length > 5 && (
                        <tr className="more-rows">
                          <td colSpan="3">
                            ... and {importConfirmData.validEntries.length - 5} more entries
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={handleImportCancel}
                disabled={submitLoading}
              >
                Cancel
              </button>
              <button 
                className="btn-danger"
                onClick={handleFinalImportConfirm}
                disabled={submitLoading}
              >
                {submitLoading ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reagen;