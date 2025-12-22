import React, { useState, useEffect } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus, Edit, Trash2, X, Check, Download, Upload } from 'lucide-react';
import AWN from 'awesome-notifications';
import 'awesome-notifications/dist/style.css';
import * as XLSX from 'xlsx';
import LoadingSpinner from '../components/LoadingSpinner';
import { tollFeeAPI, masterAPI, productsAPI } from '../services/api';
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
  
  // Category and Period states
  const [selectedKategori, setSelectedKategori] = useState('Toll In');
  const [selectedPeriode, setSelectedPeriode] = useState(new Date().getFullYear().toString());
  const availableKategori = ['Toll In', 'Toll Out', 'Import', 'Lapi'];
  
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

  // Mock data for demonstration
  const mockTollFeeData = [
    {
      pk_id: 1,
      productId: 'G5',
      productName: 'LAMESON-125 mg/2 mL injeksi',
      tollFeeRate: '12.50',
      rounded: null,
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
      tollFeeRate: '10%',
      rounded: null,
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
      tollFeeRate: '8.25',
      rounded: null,
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

  // Load toll fee data from view API with category and period filtering
  const loadTollFeeData = async () => {
    try {
      setLoading(true);
      
      const result = await tollFeeAPI.getFromView(selectedKategori, selectedPeriode);
      
      if (result && result.success && Array.isArray(result.data)) {
        // Filter out products without Toll_Fee (where Toll_Fee is null)
        const filteredResult = result.data.filter(item => item.Toll_Fee !== null && item.Toll_Fee !== undefined);
        
        // Map the data from view columns
        const mappedData = filteredResult.map((item, index) => ({
          pk_id: index + 1, // Use index as temporary ID since view doesn't have pk_id
          productId: item.productid,
          productName: item.Product_Name,
          tollFeeRate: item.Toll_Fee,
          rounded: item.Rounded || null,
          kategori: item.Kategori,
          periode: item.Periode
        }));
        
        setTollFeeData(mappedData);
        setError('');
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

  // Load available products for Add New (excluding existing toll fee entries)
  const loadAvailableProducts = async () => {
    try {
      if (productNames.length === 0) return;
      
      // Get existing product IDs that already have toll fee rates
      const existingProductIds = tollFeeData.map(item => item.productId);
      
      // Filter to exclude products that already have toll fee entries
      const available = productNames.filter(product => 
        !existingProductIds.includes(product.Product_ID)
      );
      
      setAvailableProducts(available);
    } catch (err) {
      console.error('Error loading available products:', err);
      setAvailableProducts([]);
    }
  };

  // Initial data load
  useEffect(() => {
    loadTollFeeData();
  }, [selectedKategori, selectedPeriode]);

  // Re-map toll fee data when product names are loaded - REMOVED (no longer needed with view)
  
  // Update available products when toll fee data or product names change - REMOVED (no longer needed)
  
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
      tollFeeRate: item.tollFeeRate || '',
      rounded: item.rounded || ''
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
        throw new Error('Original margin entry not found');
      }
      
      const updateData = {
        tollFeeRate: editFormData.tollFeeRate || '', // Keep as string (varchar)
        rounded: editFormData.rounded || '', // Keep as string (varchar)
        userId: user?.nama || user?.inisialNama || 'SYSTEM',
        delegatedTo: originalItem.delegatedTo
        // Note: processDate is handled by the backend to ensure correct local timezone
      };
      
      const result = await tollFeeAPI.updateByProductAndPeriode(
        originalItem.productId,
        originalItem.periode || selectedPeriode,
        updateData
      );
      
      if (result.success) {
        // Refresh data and close edit mode
        await loadTollFeeData();
        setEditingRowId(null);
        setEditFormData({});
        
        notifier.success('Margin updated successfully');
      } else {
        throw new Error(result.message || 'Failed to update margin');
      }
    } catch (error) {
      console.error('Error updating margin:', error);
      notifier.alert('Failed to update margin: ' + error.message);
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
      
      if (!addFormData.tollFeeRate || addFormData.tollFeeRate.trim() === '') {
        notifier.warning('Please enter a valid Margin (number or percentage, e.g., 10 or 10%)');
        return;
      }

      setSubmitLoading(true);
      
      const newEntry = {
        productId: addFormData.selectedProduct.Product_ID,
        tollFeeRate: addFormData.tollFeeRate.trim(), // Keep as string (varchar)
        userId: user?.nama || user?.inisialNama || 'SYSTEM',
        delegatedTo: null
        // Note: processDate is handled by the backend to ensure correct local timezone
      };
      
      const result = await tollFeeAPI.create(newEntry);
      
      if (result.success) {
        // Refresh data and close modal
        await loadTollFeeData();
        handleCancelAdd();
        
        notifier.success('Margin entry added successfully');
      } else {
        throw new Error(result.message || 'Failed to add margin entry');
      }
    } catch (error) {
      console.error('Error adding margin entry:', error);
      notifier.alert('Failed to add margin entry: ' + error.message);
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
    if (window.confirm(`Are you sure you want to delete margin entry for ${item.productId} - ${item.productName} in ${item.periode || selectedPeriode}?`)) {
      try {
        const result = await tollFeeAPI.deleteByProductAndPeriode(
          item.productId,
          item.periode || selectedPeriode
        );
        
        if (result.success) {
          await loadTollFeeData();
          notifier.success('Margin entry deleted successfully');
        } else {
          throw new Error(result.message || 'Failed to delete margin entry');
        }
      } catch (error) {
        console.error('Error deleting margin entry:', error);
        notifier.alert('Failed to delete margin entry: ' + error.message);
      }
    }
  };

  // Export to Excel - Export all categories for the selected year
  const handleExportExcel = async () => {
    try {
      setLoading(true);
      
      const wb = XLSX.utils.book_new();
      let totalAssigned = 0;
      let totalUnassigned = 0;
      let unassignedProducts = []; // Collect all unassigned products for the Unassigned sheet
      
      // Fetch data for each category
      for (const kategori of availableKategori) {
        const result = await tollFeeAPI.getFromViewForExport(kategori, selectedPeriode);
        
        if (!result || !result.success || !Array.isArray(result.data)) {
          console.error(`Failed to fetch data for ${kategori}`);
          continue;
        }
        
        const allData = result.data;
        
        if (allData.length === 0) {
          continue;
        }

        // Separate data into products with and without margins
        const productsWithoutMargin = allData.filter(item => !item.Toll_Fee || item.Toll_Fee === null);
        const productsWithMargin = allData.filter(item => item.Toll_Fee && item.Toll_Fee !== null);
        
        totalAssigned += productsWithMargin.length;
        totalUnassigned += productsWithoutMargin.length;
        
        // For Lapi category, collect unassigned products separately and skip them in the main sheet
        let sheetData;
        if (kategori === 'Lapi') {
          unassignedProducts = productsWithoutMargin.map(item => ({
            'Product ID': item.productid || '',
            'Product Name': item.Product_Name || '',
            'Margin': '',
            'Rounded': ''
          }));
          
          // Only show assigned products on the Lapi sheet
          sheetData = productsWithMargin.map(item => ({
            'Product ID': item.productid || '',
            'Product Name': item.Product_Name || '',
            'Margin': item.Toll_Fee || '',
            'Rounded': item.Rounded || ''
          }));
        } else {
          // For other categories, show unassigned first, then assigned
          sheetData = [
            ...productsWithoutMargin.map(item => ({
              'Product ID': item.productid || '',
              'Product Name': item.Product_Name || '',
              'Margin': '',
              'Rounded': ''
            })),
            ...productsWithMargin.map(item => ({
              'Product ID': item.productid || '',
              'Product Name': item.Product_Name || '',
              'Margin': item.Toll_Fee || '',
              'Rounded': item.Rounded || ''
            }))
          ];
        }
        
        const ws = XLSX.utils.json_to_sheet(sheetData);
        ws['!cols'] = [
          { wch: 15 }, // Product ID
          { wch: 50 }, // Product Name
          { wch: 15 }, // Margin
          { wch: 15 }  // Rounded
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, kategori);
      }
      
      // Add Unassigned sheet if there are unassigned Lapi products
      if (unassignedProducts.length > 0) {
        const unassignedWs = XLSX.utils.json_to_sheet(unassignedProducts);
        unassignedWs['!cols'] = [
          { wch: 15 }, // Product ID
          { wch: 50 }, // Product Name
          { wch: 15 }, // Margin
          { wch: 15 }  // Rounded
        ];
        XLSX.utils.book_append_sheet(wb, unassignedWs, 'Unassigned');
      }
      
      // Check if we have any data to export
      if (wb.SheetNames.length === 0) {
        notifier.warning('No data to export for the selected year.');
        return;
      }

      // Create filename with year only
      const filename = `Margin_${selectedPeriode}.xlsx`;

      XLSX.writeFile(wb, filename);
      
      const totalCount = totalAssigned + totalUnassigned;
      
      notifier.success(
        `Excel file exported successfully! Total: ${totalCount} products (${totalAssigned} assigned, ${totalUnassigned} unassigned)`
      );
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      notifier.alert('Failed to export Excel file: ' + error.message);
    } finally {
      setLoading(false);
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
      
      // Process all sheets in the workbook
      let allDataRows = [];
      
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          return; // Skip sheets with no data
        }

        // Skip header row and add data rows from this sheet
        const dataRows = jsonData.slice(1).filter(row => 
          row && row.length > 0 && row[0] && String(row[0]).trim() !== ''
        );
        
        allDataRows = allDataRows.concat(dataRows);
      });

      if (allDataRows.length === 0) {
        throw new Error('No valid data rows found in any sheet of the Excel file');
      }

      // Process the combined Excel data from all sheets
      await processImportData(allDataRows);

    } catch (error) {
      console.error('Error processing Excel file:', error);
      notifier.alert('Error processing Excel file: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Process and validate import data
  const processImportData = async (dataRows) => {
    try {
      if (dataRows.length === 0) {
        throw new Error('No valid data rows found in Excel file');
      }

      const validationResults = [];
      const validEntries = [];
      const errors = [];
      const skippedRows = [];

      notifier.info(`Validating ${dataRows.length} entries...`);

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNum = i + 2; // +2 because we start from row 2 (after header)
        
        const productId = row[0] ? String(row[0]).trim() : '';
        const tollFeeRate = row[2]; // Column C - Margin
        const rounded = row[3]; // Column D - Rounded (optional)

        // Skip rows where BOTH Margin AND Rounded are empty
        const marginEmpty = tollFeeRate === undefined || tollFeeRate === null || String(tollFeeRate).trim() === '';
        const roundedEmpty = rounded === undefined || rounded === null || String(rounded).trim() === '';
        
        if (marginEmpty && roundedEmpty) {
          skippedRows.push(rowNum);
          continue;
        }

        // Validate Product ID
        if (!productId) {
          errors.push(`Row ${rowNum}: Product ID is required`);
          continue;
        }

        const marginValue = marginEmpty ? '' : String(tollFeeRate).trim();
        const roundedValue = roundedEmpty ? '' : String(rounded).trim();

        // Check for duplicates in import data
        const existingEntry = validEntries.find(e => e.productId === productId);
        if (existingEntry) {
          errors.push(`Row ${rowNum}: Duplicate Product ID "${productId}" (first occurrence at row ${existingEntry.originalRow})`);
          continue;
        }

        validEntries.push({
          productId,
          tollFeeRate: marginValue,
          rounded: roundedValue,
          periode: selectedPeriode, // Use the selected year
          originalRow: rowNum
        });
      }

      // Show validation results
      if (errors.length > 0) {
        const errorMessage = `Validation failed with ${errors.length} error(s):\n\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n\n... and ${errors.length - 10} more errors` : ''}`;
        notifier.alert(errorMessage);
        return;
      }

      if (validEntries.length === 0) {
        throw new Error('No valid entries found after validation. All rows were either duplicates, had errors, or were skipped (empty Margin and Rounded).');
      }

      // Show info about skipped rows if any
      if (skippedRows.length > 0) {
        notifier.info(`Skipped ${skippedRows.length} row(s) with empty Margin and Rounded values`);
      }

      // Show confirmation modal
      setImportConfirmData({
        validEntries,
        skippedCount: skippedRows.length,
        newDataCount: validEntries.length
      });
      setShowConfirmModal(true);

    } catch (error) {
      console.error('Error processing import data:', error);
      notifier.alert('Error processing import data: ' + error.message);
    }
  };

  // Perform bulk import (delete by periode, then insert)
  const performBulkImport = async (validEntries) => {
    try {
      setLoading(true);
      notifier.info('Importing margin data...');

      // Step 1: Delete all existing entries for the selected periode
      notifier.info(`Removing existing data for year ${selectedPeriode}...`);
      const deleteResult = await tollFeeAPI.bulkDeleteByPeriode(selectedPeriode);
      if (!deleteResult.success) {
        throw new Error(deleteResult.message || 'Failed to delete existing entries');
      }

      // Step 2: Prepare entries for bulk insert with proper user tracking
      const userId = user?.logNIK || user?.nama || user?.inisialNama || 'SYSTEM';
      const entriesToInsert = validEntries.map(entry => ({
        productId: entry.productId,
        tollFeeRate: entry.tollFeeRate,
        rounded: entry.rounded,
        periode: entry.periode,
        userId: userId,
        delegatedTo: null
        // Note: processDate is handled by the backend to ensure correct local timezone
      }));

      // Step 3: Bulk insert new entries
      notifier.info('Inserting new data...');
      const insertResult = await tollFeeAPI.bulkInsert(entriesToInsert, userId);
      
      if (!insertResult.success) {
        throw new Error(insertResult.message || 'Failed to insert new entries');
      }

      // Step 4: Reload data and notify success
      await loadTollFeeData();
      
      notifier.success(`Import completed successfully! Imported ${validEntries.length} entries for year ${selectedPeriode}.`);

    } catch (error) {
      console.error('Error performing bulk import:', error);
      notifier.alert('Import failed: ' + error.message);
      
      // Reload data to refresh the current state    } catch (error) {
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
    return <LoadingSpinner message="Loading margin data..." size="large" />;
  }

  return (
    <div className="toll-fee-container">
      <div className="toll-fee-content-section">
        {/* Header Actions */}
        <div className="toll-fee-section-header">
          <div className="toll-fee-section-info">
            <p className="toll-fee-section-description">
              Manage margin rates for products. Set and update margin cost allocations.
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
              title="Export margin data to Excel"
            >
              <Download size={16} />
              Export
            </button>
            <button 
              onClick={handleImportExcel}
              className="toll-fee-btn-import"
              disabled={loading}
              title="Import margin data from Excel"
            >
              <Upload size={16} />
              Import Excel
            </button>
            <button 
              onClick={() => setShowAddModal(true)}
              className="toll-fee-btn-primary toll-fee-add-btn"
              title="Add new margin entry"
            >
              <Plus size={16} />
              Add New
            </button>
          </div>
        </div>

        {/* Category Tabs and Period Selector */}
        <div className="toll-fee-controls-section">
          <div className="category-tabs">
            {availableKategori.map(kategori => (
              <button
                key={kategori}
                className={`category-tab ${selectedKategori === kategori ? 'active' : ''}`}
                onClick={() => {
                  setSelectedKategori(kategori);
                  setCurrentPage(1);
                }}
              >
                {kategori}
              </button>
            ))}
          </div>
          
          <div className="period-selector">
            <label htmlFor="periode-select">Year:</label>
            <select
              id="periode-select"
              value={selectedPeriode}
              onChange={(e) => {
                setSelectedPeriode(e.target.value);
                setCurrentPage(1);
              }}
              className="periode-select"
            >
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </div>
        </div>

        {/* Search and Filters */}
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
                  Margin
                  {sortField === 'tollFeeRate' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('rounded')} className="toll-fee-header-cell toll-fee-sortable">
                  Rounded
                  {sortField === 'rounded' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th className="toll-fee-header-cell toll-fee-actions-header">Actions</th>
              </tr>
            </thead>
            <tbody className="toll-fee-table-body">
              {paginatedData.length === 0 ? (
                <tr className="toll-fee-data-row toll-fee-empty-row">
                  <td colSpan="5" className="toll-fee-no-data">
                    {searchTerm 
                      ? `No margin entries found matching "${searchTerm}".`
                      : "No margin entries found. Click 'Add New' to get started."
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
                          type="text"
                          value={editFormData.tollFeeRate}
                          onChange={(e) => handleEditChange('tollFeeRate', e.target.value)}
                          className="toll-fee-edit-input"
                          placeholder="Margin"
                        />
                      ) : (
                        <span className={`toll-fee-rate-value ${item.tollFeeRate && item.tollFeeRate.includes('%') ? 'toll-fee-percentage' : 'toll-fee-numeric'}`}>
                          {item.tollFeeRate || ''}
                        </span>
                      )}
                    </td>
                    <td className="toll-fee-data-cell toll-fee-rounded-cell">
                      {editingRowId === item.pk_id ? (
                        <input
                          type="text"
                          value={editFormData.rounded}
                          onChange={(e) => handleEditChange('rounded', e.target.value)}
                          className="toll-fee-edit-input"
                          placeholder="Rounded"
                        />
                      ) : (
                        item.rounded || ''
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
                            title="Edit Margin"
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
              <h2>Add New Margin Entry</h2>
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
                            ? 'No products found matching your search' 
                            : 'Type to search products'
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
                <label>Margin: *</label>
                <input
                  type="text"
                  value={addFormData.tollFeeRate}
                  onChange={(e) => handleAddFormChange('tollFeeRate', e.target.value)}
                  placeholder="e.g., 10 or 10%"
                  required
                />
              </div>
              
              <div className="toll-fee-form-info">
                <small>
                  * Required fields<br/>
                  • Select a product from the dropdown<br/>
                  • Margin can be a number (e.g., 10) or percentage (e.g., 10%)<br/>
                  • Only products without existing margin entries are shown
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
              <h2>Import Margin Data</h2>
              <button className="toll-fee-modal-close" onClick={() => setShowImportModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="toll-fee-modal-body">
              <div className="toll-fee-instructions-section">
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

              <div className="toll-fee-instructions-section">
                <h3>📋 Expected Excel Format:</h3>
                <div className="toll-fee-format-example">
                  <p>Excel file can have multiple sheets (Toll In, Toll Out, Import, Lapi, Unassigned)</p>
                  <table className="toll-fee-format-table">
                    <thead>
                      <tr>
                        <th>Product ID</th>
                        <th>Product Name</th>
                        <th>Margin</th>
                        <th>Rounded</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>G5</td>
                        <td>LAMESON-125 mg/2 mL injeksi</td>
                        <td>12.50</td>
                        <td>13</td>
                      </tr>
                      <tr>
                        <td>G6</td>
                        <td>LAPIBAL-500 µG INJEKSI</td>
                        <td>10%</td>
                        <td></td>
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
                  <li>Column C: <strong>Margin</strong> (required for import - rows with empty Margin will be skipped)</li>
                  <li>Column D: <strong>Rounded</strong> (optional, can be blank)</li>
                  <li>First row must contain headers</li>
                  <li>All sheets in the workbook will be processed</li>
                  <li>Entries without Margin AND Rounded will be skipped</li>
                </ul>
              </div>

              <div className="toll-fee-instructions-section toll-fee-warning-section">
                <h3>⚠️ Important Warning:</h3>
                <ul>
                  <li><strong>All existing margin data for year {selectedPeriode} will be REPLACED</strong></li>
                  <li>This operation cannot be undone</li>
                  <li>Make sure your data is correct before importing</li>
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
                  <li>All Product IDs exist in the system</li>
                  <li>All Margin values are valid</li>
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
                  This will <strong>permanently replace all existing margin data</strong>. 
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
                        <th>Margin</th>
                        <th>Rounded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importConfirmData.validEntries.slice(0, 5).map((entry, index) => (
                        <tr key={index}>
                          <td className="toll-fee-product-id-cell">{entry.productId}</td>
                          <td className="toll-fee-product-name-cell">{entry.productName}</td>
                          <td className="toll-fee-toll-fee-rate-cell">{entry.tollFeeRate}</td>
                          <td className="toll-fee-toll-fee-rate-cell">{entry.rounded || ''}</td>
                        </tr>
                      ))}
                      {importConfirmData.validEntries.length > 5 && (
                        <tr className="toll-fee-more-rows">
                          <td colSpan="4">
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