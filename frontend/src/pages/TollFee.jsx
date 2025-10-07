import React, { useState, useEffect } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus, Edit, Trash2, X, Check, Download, Upload } from 'lucide-react';
import AWN from 'awesome-notifications';
import 'awesome-notifications/dist/style.css';
import * as XLSX from 'xlsx';
import LoadingSpinner from '../components/LoadingSpinner';
import { tollFeeAPI, masterAPI } from '../services/api';
import '../styles/TollFee.css';

// Initialize awesome-notifications
const notifier = new AWN({
  position: 'top-right',
  durations: {
    global: 4000
  }
});

const TollFee = ({ user }) => {
  // State management
  const [tollFeeData, setTollFeeData] = useState([]);
  const [productNames, setProductNames] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [paginatedData, setPaginatedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
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
    tollFeeRate: ''
  });
  
  // Product selection for Add modal
  const [availableProducts, setAvailableProducts] = useState([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  
  // Sorting states
  const [sortField, setSortField] = useState('productId');
  const [sortDirection, setSortDirection] = useState('asc');

  // Mock data for demonstration
  const mockTollFeeData = [
    {
      pk_id: 1,
      productId: 'G5',
      productName: 'LAMESON-125 mg/2 mL injeksi',
      tollFeeRate: 12.50,
      userId: 'SYSTEM',
      delegatedTo: null,
      processDate: '2024-10-07T10:30:00',
      flagUpdate: 'N',
      fromUpdate: null
    },
    {
      pk_id: 2,
      productId: 'G6',
      productName: 'LAPIBAL-500 µG INJEKSI',
      tollFeeRate: 15.75,
      userId: 'SYSTEM',
      delegatedTo: null,
      processDate: '2024-10-07T10:30:00',
      flagUpdate: 'N',
      fromUpdate: null
    },
    {
      pk_id: 3,
      productId: 'G8',
      productName: 'LAPIMOX-125mg/5ml Dry Syrup',
      tollFeeRate: 8.25,
      userId: 'SYSTEM',
      delegatedTo: null,
      processDate: '2024-10-07T10:30:00',
      flagUpdate: 'N',
      fromUpdate: null
    }
  ];

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
      if (!event.target.closest('.toll-fee-product-search-container')) {
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

  // Load toll fee data from API
  const loadTollFeeData = async () => {
    try {
      setLoading(true);
      
      const result = await tollFeeAPI.getAll();
      
      if (result && result.success && Array.isArray(result.data)) {
        // Map the data to include product names
        const mappedData = result.data.map(item => {
          const productInfo = productNames.find(p => p.Product_ID === item.ProductID);
          return {
            pk_id: item.pk_id,
            productId: item.ProductID,
            productName: productInfo ? productInfo.Product_Name : `Product ${item.ProductID}`,
            tollFeeRate: item.Toll_Fee,
            userId: item.user_id,
            delegatedTo: item.delegated_to,
            processDate: item.process_date,
            flagUpdate: item.flag_update,
            fromUpdate: item.from_update
          };
        });
        
        setTollFeeData(mappedData);
        setError('');
        console.log('Loaded toll fee data:', mappedData.length, 'items');
      } else {
        throw new Error(result?.message || 'Invalid response format');
      }
    } catch (err) {
      console.error('Error loading toll fee data:', err);
      console.error('Error details:', err.message);
      setError('Failed to load toll fee data: ' + err.message);
      notifier.alert('Failed to load toll fee data. Please check the console for details.');
      setTollFeeData([]);
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
      notifier.warning('Failed to load product data. You can still add toll fee entries manually.');
      setProductNames([]);
    }
  };

  // Load available products for Add New (Group_PNCategory = 6 or 7 and excluding existing toll fee entries)
  const loadAvailableProducts = async () => {
    try {
      if (productNames.length === 0) return;
      
      // Get existing product IDs that already have toll fee rates
      const existingProductIds = tollFeeData.map(item => item.productId);
      
      // Filter for Group_PNCategory = 6 or 7 and exclude products that already have toll fee entries
      const available = productNames.filter(product => 
        (product.Group_PNCategory === 6 || product.Group_PNCategory === 7) && 
        !existingProductIds.includes(product.Product_ID)
      );
      
      setAvailableProducts(available);
      console.log(`Available products for toll fee (Group_PNCategory=6 or 7): ${available.length} items`);
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
      // Load toll fee data immediately as well
      await loadTollFeeData();
    };
    loadInitialData();
  }, []);

  // Re-map toll fee data when product names are loaded
  useEffect(() => {
    if (productNames.length > 0 && tollFeeData.length > 0) {
      const remappedData = tollFeeData.map(item => {
        const productInfo = productNames.find(p => p.Product_ID === item.productId);
        return {
          ...item,
          productName: productInfo ? productInfo.Product_Name : item.productName
        };
      });
      setTollFeeData(remappedData);
    }
  }, [productNames]);

  // Update available products when toll fee data or product names change
  useEffect(() => {
    loadAvailableProducts();
  }, [tollFeeData, productNames]);

  // Filter and search functionality
  useEffect(() => {
    let filtered = tollFeeData;

    // Search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(item =>
        item.productId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.productName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredData(filtered);
  }, [tollFeeData, searchTerm]);

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
      tollFeeRate: item.tollFeeRate || ''
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
      const originalItem = tollFeeData.find(item => item.pk_id === editingRowId);
      if (!originalItem) {
        throw new Error('Original toll fee entry not found');
      }
      
      const updateData = {
        productId: originalItem.productId,
        tollFeeRate: parseFloat(editFormData.tollFeeRate) || 0,
        userId: user?.nama || user?.inisialNama || 'SYSTEM',
        delegatedTo: originalItem.delegatedTo,
        processDate: new Date().toISOString()
      };
      
      const result = await tollFeeAPI.update(editingRowId, updateData);
      
      if (result.success) {
        // Refresh data and close edit mode
        await loadTollFeeData();
        setEditingRowId(null);
        setEditFormData({});
        
        notifier.success('Toll fee rate updated successfully');
      } else {
        throw new Error(result.message || 'Failed to update toll fee rate');
      }
    } catch (error) {
      console.error('Error updating toll fee rate:', error);
      notifier.alert('Failed to update toll fee rate: ' + error.message);
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
      
      if (!addFormData.tollFeeRate || parseFloat(addFormData.tollFeeRate) < 0) {
        notifier.warning('Please enter a valid Toll Fee Rate (must be 0 or greater)');
        return;
      }

      setSubmitLoading(true);
      
      const newEntry = {
        productId: addFormData.selectedProduct.Product_ID,
        tollFeeRate: parseFloat(addFormData.tollFeeRate),
        userId: user?.nama || user?.inisialNama || 'SYSTEM',
        delegatedTo: null,
        processDate: new Date().toISOString()
      };
      
      const result = await tollFeeAPI.create(newEntry);
      
      if (result.success) {
        // Refresh data and close modal
        await loadTollFeeData();
        handleCancelAdd();
        
        notifier.success('Toll fee entry added successfully');
      } else {
        throw new Error(result.message || 'Failed to add toll fee entry');
      }
    } catch (error) {
      console.error('Error adding toll fee entry:', error);
      notifier.alert('Failed to add toll fee entry: ' + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancelAdd = () => {
    setShowAddModal(false);
    setAddFormData({
      selectedProduct: null,
      tollFeeRate: ''
    });
    setProductSearchTerm('');
    setShowProductDropdown(false);
  };

  // Delete handler
  const handleDelete = async (item) => {
    if (window.confirm(`Are you sure you want to delete toll fee entry for ${item.productId} - ${item.productName}?`)) {
      try {
        const result = await tollFeeAPI.delete(item.pk_id);
        
        if (result.success) {
          await loadTollFeeData();
          notifier.success('Toll fee entry deleted successfully');
        } else {
          throw new Error(result.message || 'Failed to delete toll fee entry');
        }
      } catch (error) {
        console.error('Error deleting toll fee entry:', error);
        notifier.alert('Failed to delete toll fee entry: ' + error.message);
      }
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      if (tollFeeData.length === 0) {
        notifier.warning('No toll fee data to export.');
        return;
      }

      const exportData = tollFeeData.map(item => ({
        'Product ID': item.productId,
        'Product Name': item.productName,
        'Toll Fee Rate': parseFloat(item.tollFeeRate || 0).toFixed(2)
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      ws['!cols'] = [
        { wch: 15 }, // Product ID
        { wch: 50 }, // Product Name
        { wch: 15 }  // Toll Fee Rate
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Toll Fee Data');

      const now = new Date();
      const dateStr = now.getFullYear() + 
                     String(now.getMonth() + 1).padStart(2, '0') + 
                     String(now.getDate()).padStart(2, '0');
      const filename = `TollFee_Data_${dateStr}.xlsx`;

      XLSX.writeFile(wb, filename);
      notifier.success(`Excel file exported successfully! (${exportData.length} entries)`);
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
        const tollFeeRate = row[2]; // Column C

        // Validate Product ID
        if (!productId) {
          errors.push(`Row ${rowNum}: Product ID is required`);
          continue;
        }

        // Validate Toll Fee Rate
        if (tollFeeRate === undefined || tollFeeRate === null || tollFeeRate === '') {
          errors.push(`Row ${rowNum}: Toll Fee Rate is required`);
          continue;
        }

        const numericRate = parseFloat(tollFeeRate);
        if (isNaN(numericRate) || numericRate < 0) {
          errors.push(`Row ${rowNum}: Toll Fee Rate must be a number 0 or greater (got: ${tollFeeRate})`);
          continue;
        }

        // Check if Product ID exists in Group PNCategory 6 or 7
        const productInfo = productNames.find(p => 
          p.Product_ID === productId && (p.Group_PNCategory === 6 || p.Group_PNCategory === 7)
        );

        if (!productInfo) {
          const generalProduct = productNames.find(p => p.Product_ID === productId);
          if (generalProduct) {
            errors.push(`Row ${rowNum}: Product ID "${productId}" does not belong to Group PNCategory 6 or 7 (found in category ${generalProduct.Group_PNCategory})`);
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
          tollFeeRate: numericRate,
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
        currentDataCount: tollFeeData.length,
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
      notifier.info('Importing toll fee data...');

      // Step 1: Get all existing toll fee IDs for bulk delete
      const existingIds = tollFeeData.map(item => item.pk_id);

      // Step 2: Bulk delete existing entries if any exist
      if (existingIds.length > 0) {
        notifier.info('Removing existing data...');
        const deleteResult = await tollFeeAPI.bulkDelete(existingIds);
        if (!deleteResult.success) {
          throw new Error(deleteResult.message || 'Failed to delete existing entries');
        }
      }

      // Step 3: Prepare entries for bulk insert
      const entriesToInsert = validEntries.map(entry => ({
        productId: entry.productId,
        tollFeeRate: entry.tollFeeRate,
        userId: user?.nama || user?.inisialNama || 'SYSTEM',
        delegatedTo: null,
        processDate: new Date().toISOString()
      }));

      // Step 4: Bulk insert new entries
      notifier.info('Inserting new data...');
      const insertResult = await tollFeeAPI.bulkInsert(entriesToInsert);
      
      if (!insertResult.success) {
        throw new Error(insertResult.message || 'Failed to insert new entries');
      }

      // Step 5: Reload data and notify success
      await loadTollFeeData();
      
      notifier.success(`Import completed successfully! Imported ${validEntries.length} entries.`);

    } catch (error) {
      console.error('Error performing bulk import:', error);
      notifier.alert('Import failed: ' + error.message);
      
      // Reload data to refresh the current state
      await loadTollFeeData();
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
    return <LoadingSpinner message="Loading toll fee data..." size="large" />;
  }

  return (
    <div className="toll-fee-container">
      <div className="toll-fee-content-section">
        {/* Header Actions */}
        <div className="toll-fee-section-header">
          <div className="toll-fee-section-info">
            <p className="toll-fee-section-description">
              Manage toll fee rates for products. Set and update toll fee cost allocations.
            </p>
            <div className="toll-fee-data-summary">
              Total Entries: <span className="toll-fee-count">{tollFeeData.length}</span>
              {searchTerm && (
                <>
                  {' | '}Filtered: <span className="toll-fee-count">{filteredData.length}</span>
                </>
              )}
            </div>
          </div>
          <div className="toll-fee-header-actions">
            <button 
              onClick={handleExportExcel}
              className="toll-fee-btn-export"
              disabled={loading || tollFeeData.length === 0}
              title="Export toll fee data to Excel"
            >
              <Download size={16} />
              Export
            </button>
            <button 
              onClick={handleImportExcel}
              className="toll-fee-btn-import"
              disabled={loading || productNames.length === 0}
              title={productNames.length === 0 ? "Please wait for product data to load" : "Import toll fee data from Excel (replaces all existing data)"}
            >
              <Upload size={16} />
              Import Excel
            </button>
            <button 
              onClick={() => setShowAddModal(true)}
              className="toll-fee-btn-primary toll-fee-add-btn"
              title="Add new toll fee entry"
            >
              <Plus size={16} />
              Add New
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="toll-fee-controls-section">
          <div className="toll-fee-search-section">
            <div className="toll-fee-search-box">
              <Search className="toll-fee-search-icon" size={20} />
              <input
                type="text"
                placeholder="Search by Product ID or Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="toll-fee-search-input"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="toll-fee-error-message">
            <p>{error}</p>
            <button onClick={loadTollFeeData} className="toll-fee-retry-btn">
              Try Again
            </button>
          </div>
        )}

        {/* Data Table */}
        <div className="toll-fee-table-container">
          <table className="toll-fee-data-table">
            <thead className="toll-fee-table-header">
              <tr className="toll-fee-header-row">
                <th onClick={() => handleSort('productId')} className="toll-fee-header-cell toll-fee-sortable">
                  Product ID
                  {sortField === 'productId' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('productName')} className="toll-fee-header-cell toll-fee-sortable">
                  Product Name
                  {sortField === 'productName' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('tollFeeRate')} className="toll-fee-header-cell toll-fee-sortable">
                  Toll Fee Rate
                  {sortField === 'tollFeeRate' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th className="toll-fee-header-cell toll-fee-actions-header">Actions</th>
              </tr>
            </thead>
            <tbody className="toll-fee-table-body">
              {paginatedData.length === 0 ? (
                <tr className="toll-fee-data-row toll-fee-empty-row">
                  <td colSpan="4" className="toll-fee-no-data">
                    {searchTerm 
                      ? `No toll fee entries found matching "${searchTerm}".`
                      : "No toll fee entries found. Click 'Add New' to get started."
                    }
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr key={item.pk_id} className="toll-fee-data-row">
                    <td className="toll-fee-data-cell toll-fee-product-id">{item.productId}</td>
                    <td className="toll-fee-data-cell toll-fee-product-name">{item.productName}</td>
                    <td className="toll-fee-data-cell toll-fee-rate-cell">
                      {editingRowId === item.pk_id ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editFormData.tollFeeRate}
                          onChange={(e) => handleEditChange('tollFeeRate', e.target.value)}
                          className="toll-fee-edit-input"
                          placeholder="Toll Fee Rate"
                        />
                      ) : (
                        <span className="toll-fee-rate-value">{parseFloat(item.tollFeeRate || 0).toFixed(2)}</span>
                      )}
                    </td>
                    <td className="toll-fee-data-cell toll-fee-actions-cell">
                      {editingRowId === item.pk_id ? (
                        <div className="toll-fee-edit-actions">
                          <button 
                            className="toll-fee-submit-btn"
                            onClick={handleSubmitEdit}
                            disabled={submitLoading}
                            title="Save Changes"
                          >
                            <Check size={16} />
                          </button>
                          <button 
                            className="toll-fee-cancel-btn"
                            onClick={handleCancelEdit}
                            disabled={submitLoading}
                            title="Cancel Edit"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="toll-fee-view-actions">
                          <button 
                            className="toll-fee-edit-btn"
                            onClick={() => handleEdit(item)}
                            title="Edit Toll Fee Rate"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            className="toll-fee-delete-btn"
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
          <div className="toll-fee-pagination">
            <button 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="toll-fee-pagination-btn"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            
            <span className="toll-fee-pagination-info">
              Page {currentPage} of {totalPages} ({filteredData.length} total entries)
            </span>
            
            <button 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="toll-fee-pagination-btn"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Add New Modal */}
      {showAddModal && (
        <div className="toll-fee-modal-overlay">
          <div className="toll-fee-modal-content toll-fee-add-modal">
            <div className="toll-fee-modal-header">
              <h2>Add New Toll Fee Entry</h2>
              <button className="toll-fee-modal-close" onClick={handleCancelAdd}>
                <X size={24} />
              </button>
            </div>
            <div className="toll-fee-modal-body">
              <div className="toll-fee-form-group">
                <label>Select Product: *</label>
                <div className="toll-fee-product-search-container">
                  <input
                    type="text"
                    value={productSearchTerm}
                    onChange={(e) => handleProductSearch(e.target.value)}
                    onFocus={() => setShowProductDropdown(true)}
                    placeholder="Type to search products..."
                    className="toll-fee-product-search-input"
                    required
                  />
                  {showProductDropdown && (
                    <div className="toll-fee-product-dropdown">
                      {filteredProducts.length === 0 ? (
                        <div className="toll-fee-dropdown-item toll-fee-no-results">
                          {productSearchTerm 
                            ? 'No Group PNCategory 6 or 7 products found matching your search' 
                            : 'Type to search Group PNCategory 6 or 7 products'
                          }
                        </div>
                      ) : (
                        <>
                          {filteredProducts.map((product) => (
                            <div
                              key={product.Product_ID}
                              className="toll-fee-dropdown-item"
                              onClick={() => handleProductSelect(product)}
                            >
                              <div className="toll-fee-product-id">{product.Product_ID}</div>
                              <div className="toll-fee-product-name">{product.Product_Name}</div>
                              <div className="toll-fee-product-details">
                                {product.LOB} • {product.Jenis_Sediaan} • {product.Group_Dept}
                              </div>
                            </div>
                          ))}
                          {availableProducts.length > 50 && (
                            <div className="toll-fee-dropdown-item toll-fee-showing-limit">
                              Showing first 50 results. Type to filter more.
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
                {addFormData.selectedProduct && (
                  <div className="toll-fee-selected-product">
                    Selected: <strong>{addFormData.selectedProduct.Product_ID}</strong> - {addFormData.selectedProduct.Product_Name}
                  </div>
                )}
              </div>
              
              <div className="toll-fee-form-group">
                <label>Toll Fee Rate: *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={addFormData.tollFeeRate}
                  onChange={(e) => handleAddFormChange('tollFeeRate', e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div className="toll-fee-form-info">
                <small>
                  * Required fields<br/>
                  • Select a product from the dropdown<br/>
                  • Toll Fee Rate must be 0 or greater<br/>
                  • Only Group PNCategory 6 or 7 products without existing toll fee entries are shown
                </small>
              </div>
            </div>
            <div className="toll-fee-modal-footer">
              <button 
                className="toll-fee-btn-secondary"
                onClick={handleCancelAdd}
                disabled={submitLoading}
              >
                Cancel
              </button>
              <button 
                className="toll-fee-btn-primary"
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
        <div className="toll-fee-modal-overlay">
          <div className="toll-fee-modal-content toll-fee-import-instructions-modal">
            <div className="toll-fee-modal-header">
              <h2>Import Toll Fee Data</h2>
              <button className="toll-fee-modal-close" onClick={() => setShowImportModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="toll-fee-modal-body">
              <div className="toll-fee-instructions-section">
                <h3>📋 Expected Excel Format:</h3>
                <div className="toll-fee-format-example">
                  <table className="toll-fee-format-table">
                    <thead>
                      <tr>
                        <th>Product ID</th>
                        <th>Product Name</th>
                        <th>Toll Fee Rate</th>
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

              <div className="toll-fee-instructions-section">
                <h3>✅ Validation Rules:</h3>
                <ul>
                  <li>Column A: <strong>Product ID</strong> (required)</li>
                  <li>Column B: <strong>Product Name</strong> (reference only, will be ignored)</li>
                  <li>Column C: <strong>Toll Fee Rate</strong> (required, must be 0 or greater)</li>
                  <li>First row must contain headers</li>
                  <li>All Product IDs must belong to <strong>Group PNCategory 6 or 7</strong></li>
                  <li>Product IDs must exist in the system</li>
                  <li>Empty rows will be ignored</li>
                </ul>
              </div>

              <div className="toll-fee-instructions-section toll-fee-warning-section">
                <h3>⚠️ Important Warning:</h3>
                <ul>
                  <li><strong>All existing toll fee data will be REPLACED</strong></li>
                  <li>This operation cannot be undone</li>
                  <li>Make sure your data is correct before importing</li>
                  <li>Current entries: <strong>{tollFeeData.length}</strong></li>
                </ul>
              </div>
            </div>
            <div className="toll-fee-modal-footer">
              <button 
                className="toll-fee-btn-secondary"
                onClick={() => setShowImportModal(false)}
              >
                Cancel
              </button>
              <button 
                className="toll-fee-btn-primary"
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
        <div className="toll-fee-modal-overlay">
          <div className="toll-fee-modal-content toll-fee-import-confirm-modal">
            <div className="toll-fee-modal-header">
              <h2>Confirm Import</h2>
              <button className="toll-fee-modal-close" onClick={handleImportCancel}>
                <X size={24} />
              </button>
            </div>
            <div className="toll-fee-modal-body">
              <div className="toll-fee-confirmation-section toll-fee-success-section">
                <h3>✅ Validation Successful!</h3>
                <ul>
                  <li><strong>{importConfirmData.validEntries.length}</strong> valid entries ready to import</li>
                  <li>All Product IDs belong to Group PNCategory 6 or 7</li>
                  <li>All Toll Fee Rates are valid numbers</li>
                </ul>
              </div>

              <div className="toll-fee-confirmation-section toll-fee-warning-section">
                <h3>⚠️ Data Replacement Warning:</h3>
                <div className="toll-fee-data-comparison">
                  <div className="toll-fee-data-item">
                    <span className="toll-fee-label">Current entries:</span>
                    <span className="toll-fee-value toll-fee-current">{importConfirmData.currentDataCount}</span>
                  </div>
                  <div className="toll-fee-data-item">
                    <span className="toll-fee-label">New entries:</span>
                    <span className="toll-fee-value toll-fee-new">{importConfirmData.newDataCount}</span>
                  </div>
                </div>
                <p className="toll-fee-warning-text">
                  This will <strong>permanently replace all existing toll fee data</strong>. 
                  This operation cannot be undone.
                </p>
              </div>

              <div className="toll-fee-confirmation-section">
                <h3>📋 Preview of Import Data:</h3>
                <div className="toll-fee-preview-table-container">
                  <table className="toll-fee-preview-table">
                    <thead>
                      <tr>
                        <th>Product ID</th>
                        <th>Product Name</th>
                        <th>Toll Fee Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importConfirmData.validEntries.slice(0, 5).map((entry, index) => (
                        <tr key={index}>
                          <td className="toll-fee-product-id-cell">{entry.productId}</td>
                          <td className="toll-fee-product-name-cell">{entry.productName}</td>
                          <td className="toll-fee-toll-fee-rate-cell">{entry.tollFeeRate.toFixed(2)}</td>
                        </tr>
                      ))}
                      {importConfirmData.validEntries.length > 5 && (
                        <tr className="toll-fee-more-rows">
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
            <div className="toll-fee-modal-footer">
              <button 
                className="toll-fee-btn-secondary"
                onClick={handleImportCancel}
                disabled={submitLoading}
              >
                Cancel
              </button>
              <button 
                className="toll-fee-btn-danger"
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

export default TollFee;