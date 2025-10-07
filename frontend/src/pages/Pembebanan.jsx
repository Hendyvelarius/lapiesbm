import React, { useState, useEffect } from 'react';
import { masterAPI } from '../services/api';
import '../styles/Pembebanan.css';
import { Search, Filter, Users, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus, Edit, Trash2, X, Check, Download, Upload } from 'lucide-react';
import AWN from 'awesome-notifications';
import 'awesome-notifications/dist/style.css';
import * as XLSX from 'xlsx';
import ImportWarningModal from '../components/ImportWarningModal';
import LoadingSpinner from '../components/LoadingSpinner';

// Initialize awesome-notifications
const notifier = new AWN({
  position: 'top-right',
  durations: {
    global: 4000
  }
});

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
    groupKemasRate: '',
    groupGenerikRate: '',
    groupAnalisaRate: ''
  });
  
  // Import warning modal state
  const [showImportWarning, setShowImportWarning] = useState(false);
  
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
          rateGenerik: pembebanan.Group_PLN_Rate,
          rateAnalisa: pembebanan.Group_Analisa_Rate,
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
            rateGenerik: pembebanan.Group_PLN_Rate,
            rateAnalisa: pembebanan.Group_Analisa_Rate,
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
            rateGenerik: pembebanan.Group_PLN_Rate,
            rateAnalisa: pembebanan.Group_Analisa_Rate,
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
      if (field === 'rateProses' || field === 'rateKemas' || field === 'rateGenerik' || field === 'rateAnalisa') {
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
      rateKemas: item.rateKemas,
      rateGenerik: item.rateGenerik || '',
      rateAnalisa: item.rateAnalisa || ''
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
        groupKemasRate: parseFloat(editFormData.rateKemas) || 0,
        groupPLNRate: parseFloat(editFormData.rateGenerik) || null,
        groupAnalisaRate: parseFloat(editFormData.rateAnalisa) || null
      };
      
      await masterAPI.updatePembebanan(editingRowId, updateData);
      
      // Refresh data
      await getCombinedData();
      
      setEditingRowId(null);
      setEditFormData({});
      
    } catch (error) {
      console.error('Error updating pembebanan:', error);
      notifier.alert('Error updating entry: ' + error.message);
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
      groupKemasRate: '',
      groupGenerikRate: '',
      groupAnalisaRate: ''
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
        notifier.alert('Please select a Group Name');
        return;
      }
      
      if (!addFormData.groupProductID) {
        notifier.alert('Please select a Product');
        return;
      }
      
      if (!addFormData.groupProsesRate || parseFloat(addFormData.groupProsesRate) < 0) {
        notifier.alert('Please enter a valid Proses Rate (must be 0 or greater)');
        return;
      }
      
      if (!addFormData.groupKemasRate || parseFloat(addFormData.groupKemasRate) < 0) {
        notifier.alert('Please enter a valid Kemas Rate (must be 0 or greater)');
        return;
      }

      // Additional validation to ensure groupPNCategoryID is set
      if (!addFormData.groupPNCategoryID) {
        notifier.alert('Group Category ID is missing. Please select a product again.');
        return;
      }
      
      // Check for duplicate entry
      const isDuplicate = processedData.some(item => 
        item.groupName === addFormData.groupPNCategoryName && 
        String(item.productId) === String(addFormData.groupProductID)
      );
      
      if (isDuplicate) {
        notifier.alert(`A cost allocation entry for ${addFormData.groupPNCategoryName} product ${addFormData.groupProductID} already exists. Please edit the existing entry instead.`);
        return;
      }
      
      const newEntry = {
        groupPNCategoryID: String(addFormData.groupPNCategoryID),
        groupPNCategoryName: String(addFormData.groupPNCategoryName),
        groupProductID: String(addFormData.groupProductID),
        groupProsesRate: parseFloat(addFormData.groupProsesRate),
        groupKemasRate: parseFloat(addFormData.groupKemasRate),
        groupPLNRate: addFormData.groupGenerikRate ? parseFloat(addFormData.groupGenerikRate) : null,
        groupAnalisaRate: addFormData.groupAnalisaRate ? parseFloat(addFormData.groupAnalisaRate) : null
      };
      
      await masterAPI.addPembebanan(newEntry);
      
      // Refresh data and close modal
      await getCombinedData();
      handleCancelAdd();
    } catch (error) {
      console.error('Error adding pembebanan entry:', error);
      notifier.alert('Error adding entry: ' + error.message);
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

  // Export function - exports all cost allocation data (including default rates)
  const handleExportCostAllocation = () => {
    try {
      // Export all entries (including default rates) with proper formatting
      const exportData = processedData
        .map(item => ({
          'Product ID': item.isDefaultRate ? '' : (item.productId || ''),
          'Group ID': item.groupId || '',
          'Group Name': item.groupName || '',
          'Is Default Rate': item.isDefaultRate ? 'YES' : 'NO',
          'Rate Proses': parseFloat(item.rateProses) || 0,
          'Rate Kemas': parseFloat(item.rateKemas) || 0,
          'Rate PLN': parseFloat(item.rateGenerik) || 0,
          'Rate Analisa': parseFloat(item.rateAnalisa) || 0
        }));

      if (exportData.length === 0) {
        notifier.alert('No cost allocation data available for export');
        return;
      }

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths for better display
      const columnWidths = [
        { wch: 15 }, // Product ID
        { wch: 12 }, // Group ID  
        { wch: 25 }, // Group Name
        { wch: 15 }, // Is Default Rate
        { wch: 12 }, // Rate Proses
        { wch: 12 }, // Rate Kemas
        { wch: 12 }, // Rate PLN
        { wch: 12 }  // Rate Analisa
      ];
      worksheet['!cols'] = columnWidths;

      // Format columns properly to avoid Excel warnings and ensure proper data entry
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      
      // Set column formats for the entire columns (not just existing cells)
      if (!worksheet['!cols']) worksheet['!cols'] = [];
      
      // Force Product ID and Group ID columns to be text format
      worksheet['!cols'][0] = { ...worksheet['!cols'][0], z: '@' }; // Product ID as text
      worksheet['!cols'][1] = { ...worksheet['!cols'][1], z: '@' }; // Group ID as text
      
      for (let row = range.s.r; row <= range.e.r; row++) {
        // Format Product ID column as text (including empty cells)
        const productIdCell = XLSX.utils.encode_cell({ r: row, c: 0 });
        if (!worksheet[productIdCell]) worksheet[productIdCell] = { v: '', t: 's' };
        worksheet[productIdCell].t = 's';
        worksheet[productIdCell].z = '@';
        
        // Format Group ID column as text (including empty cells)  
        const groupIdCell = XLSX.utils.encode_cell({ r: row, c: 1 });
        if (!worksheet[groupIdCell]) worksheet[groupIdCell] = { v: '', t: 's' };
        worksheet[groupIdCell].t = 's';
        worksheet[groupIdCell].z = '@';
        
        // Format numeric columns explicitly as numbers with 2 decimal places
        for (let col = 4; col <= 7; col++) { // Rate columns (Proses, Kemas, PLN, Analisa)
          const numCell = XLSX.utils.encode_cell({ r: row, c: col });
          if (worksheet[numCell] && row > range.s.r) { // Skip header row
            worksheet[numCell].t = 'n';
            worksheet[numCell].z = '0.00';
          }
        }
      }
      
      // Add additional empty rows with proper formatting to make manual entry easier
      const lastRow = range.e.r;
      for (let extraRow = lastRow + 1; extraRow <= lastRow + 10; extraRow++) {
        // Pre-format empty rows for Product ID and Group ID as text
        const productIdCell = XLSX.utils.encode_cell({ r: extraRow, c: 0 });
        const groupIdCell = XLSX.utils.encode_cell({ r: extraRow, c: 1 });
        
        worksheet[productIdCell] = { v: '', t: 's', z: '@' };
        worksheet[groupIdCell] = { v: '', t: 's', z: '@' };
        
        // Update range to include these new rows
        if (!worksheet['!ref']) {
          worksheet['!ref'] = XLSX.utils.encode_range({
            s: { r: range.s.r, c: range.s.c },
            e: { r: extraRow, c: range.e.c }
          });
        }
      }

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cost Allocation');

      // Generate filename with current date
      const filename = `cost_allocation_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Write and download the file
      XLSX.writeFile(workbook, filename);

      const defaultRatesCount = exportData.filter(item => item['Is Default Rate'] === 'YES').length;
      const customRatesCount = exportData.filter(item => item['Is Default Rate'] === 'NO').length;
      notifier.success(`Successfully exported ${exportData.length} cost allocation records to Excel (${defaultRatesCount} default rates, ${customRatesCount} custom rates)`);
    } catch (error) {
      console.error('Error exporting cost allocation data:', error);
      notifier.alert('Failed to export cost allocation data. Please try again.');
    }
  };

  // Import function - shows warning modal first
  const handleImportCostAllocation = () => {
    setShowImportWarning(true);
  };

  // Handle import confirmation from modal
  const handleImportConfirm = () => {
    proceedWithImport();
  };

  // Actual import function after confirmation
  const proceedWithImport = () => {
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls';
    input.style.display = 'none';

    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      try {
        setLoading(true);

        // Read and parse the file
        let importedData = [];
        
        if (file.name.endsWith('.csv')) {
          // Handle CSV file
          const text = await readFileAsText(file);
          importedData = parseCSV(text);
        } else {
          // Handle Excel file
          const buffer = await file.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          importedData = XLSX.utils.sheet_to_json(worksheet);
        }

        if (importedData.length === 0) {
          notifier.alert('No data found in the uploaded file.');
          return;
        }

        // Validate and map the imported data
        const validatedData = await validateAndMapImportData(importedData);
        
        if (validatedData.length === 0) {
          notifier.alert('No valid data found after validation. Please check your file format and data.');
          return;
        }

        // Call bulk import API
        const result = await masterAPI.bulkImportPembebanan(validatedData);

        // Show success message and refresh data
        await fetchAllData();

        notifier.success(`Import completed successfully! Deleted: ${result.data.deleted} old records, Inserted: ${result.data.inserted} new records`, {
          durations: { success: 6000 }
        });

      } catch (error) {
        console.error('Error importing data:', error);
        
        // Show different messages for validation errors vs. other errors
        if (error.message.includes('Validation failed')) {
          notifier.alert(`Import cancelled due to validation errors. Please fix the issues in your Excel file and try again.`);
        } else {
          notifier.alert(`Failed to import data: ${error.message}`);
        }
      } finally {
        setLoading(false);
      }
    };

    // Trigger file selection
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  // Helper function to read file as text
  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  // Helper function to parse CSV
  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }

    return data;
  };

  // Validate and map imported data against existing products and default rates
  const validateAndMapImportData = async (importedData) => {
    const validatedData = [];
    const errors = [];
    const foundDefaultRates = new Set(); // Track which default rates we've seen

    for (let i = 0; i < importedData.length; i++) {
      const row = importedData[i];
      const rowIndex = i + 2; // +2 because header is row 1

      // Check if this is a default rate
      const isDefaultRate = row['Is Default Rate'] === 'YES' || 
                           row['IsDefaultRate'] === 'YES' || 
                           row['Is_Default_Rate'] === 'YES' ||
                           (row['Product ID'] === null || row['Product ID'] === '' || row['Product ID'] === undefined) ||
                           String(row['Product ID']).trim() === '';

      const productId = row['Product ID'] || row['ProductID'] || row['productId'] || row['Product_ID'];
      const groupId = row['Group ID'] || row['GroupID'] || row['Group_ID'];
      const groupName = row['Group Name'] || row['GroupName'] || row['Group_Name'];

      let processedRow;

      if (isDefaultRate) {
        // Handle default rate
        if (!groupId || !groupName) {
          errors.push(`Row ${rowIndex}: Default rate entries require Group ID and Group Name`);
          continue;
        }

        // Track this default rate
        foundDefaultRates.add(String(groupId));

        processedRow = {
          groupProductID: null,
          groupPNCategoryID: String(groupId),
          groupPNCategoryName: String(groupName),
          isDefaultRate: true
        };
      } else {
        // Handle custom rate (product-specific)
        if (!productId) {
          errors.push(`Row ${rowIndex}: Product ID is required for custom rates`);
          continue;
        }

        // Find the product in our existing group data
        const productDetails = groupData.find(group => 
          String(group.Group_ProductID).toLowerCase() === String(productId).toLowerCase()
        );

        if (!productDetails) {
          errors.push(`Row ${rowIndex}: Product ID "${productId}" not found in system`);
          continue;
        }

        processedRow = {
          groupProductID: productDetails.Group_ProductID,
          groupPNCategoryID: productDetails.Group_PNCategory,
          groupPNCategoryName: productDetails.Group_PNCategoryName,
          isDefaultRate: false
        };
      }

      // Validate and extract numeric values
      const numericFields = {
        rateProses: row['Rate Proses'] || row['RateProses'] || row['Rate_Proses'] || 0,
        rateKemas: row['Rate Kemas'] || row['RateKemas'] || row['Rate_Kemas'] || 0,
        rateGenerik: row['Rate PLN'] || row['RatePLN'] || row['Rate_PLN'] || row['Rate Generik'] || row['RateGenerik'] || row['Rate_Generik'] || 0,
        rateReagen: row['Rate Analisa'] || row['RateAnalisa'] || row['Rate_Analisa'] || row['Rate Reagen'] || row['RateReagen'] || row['Rate_Reagen'] || 0
      };

      let validRow = true;

      // Validate and convert numeric fields
      for (const [key, value] of Object.entries(numericFields)) {
        if (value !== null && value !== undefined && value !== '') {
          const numValue = Number(value);
          if (isNaN(numValue)) {
            errors.push(`Row ${rowIndex}: ${key} must be a valid number`);
            validRow = false;
          } else {
            // Map field names to match backend expectations
            if (key === 'rateProses') processedRow.groupProsesRate = numValue;
            else if (key === 'rateKemas') processedRow.groupKemasRate = numValue;
            else if (key === 'rateGenerik') processedRow.groupGenerikRate = numValue;
            else if (key === 'rateReagen') processedRow.groupAnalisaRate = numValue; // Map rateReagen to rateAnalisa
            else if (key === 'tollFee') processedRow.tollFee = numValue;
          }
        } else {
          // Set default values for empty fields
          if (key === 'rateProses') processedRow.groupProsesRate = 0;
          else if (key === 'rateKemas') processedRow.groupKemasRate = 0;
          else if (key === 'rateGenerik') processedRow.groupGenerikRate = 0;
          else if (key === 'rateReagen') processedRow.groupAnalisaRate = 0;
          else if (key === 'tollFee') processedRow.tollFee = 0;
        }
      }

      if (validRow) {
        validatedData.push(processedRow);
      }
    }

    // Check if all existing default rates are present in the import
    const existingDefaultRates = processedData
      .filter(item => item.isDefaultRate)
      .map(item => String(item.groupId));
    
    const missingDefaultRates = existingDefaultRates.filter(groupId => !foundDefaultRates.has(groupId));
    
    if (missingDefaultRates.length > 0) {
      const missingGroups = missingDefaultRates
        .map(groupId => {
          const existingDefault = processedData.find(item => item.isDefaultRate && String(item.groupId) === groupId);
          return `${existingDefault?.groupName || 'Unknown'} (ID: ${groupId})`;
        });
      
      errors.push(`Missing required default rates for groups: ${missingGroups.join(', ')}`);
      errors.push('All existing default rates must be included in the import to ensure data consistency.');
    }

    // Show errors if any and prevent import
    if (errors.length > 0) {
      const errorMessage = `Import validation failed with ${errors.length} error(s):\n\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... and ${errors.length - 10} more errors` : ''}\n\nPlease fix these errors before importing.`;
      notifier.alert(errorMessage);
      throw new Error(`Validation failed with ${errors.length} errors. Import aborted.`);
    }

    return validatedData;
  };

  if (loading) {
    return (
      <LoadingSpinner 
        message="Loading cost allocation data..." 
        size="large" 
      />
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
          
          <button className="export-btn" onClick={handleExportCostAllocation}>
            <Download size={20} />
            Export
          </button>
          
          <button className="import-btn" onClick={handleImportCostAllocation}>
            <Upload size={20} />
            Import
          </button>
          
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
                <th onClick={() => handleSort('rateGenerik')} className="sortable">
                  Rate PLN
                  {sortField === 'rateGenerik' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('rateAnalisa')} className="sortable">
                  Rate Analisa
                  {sortField === 'rateAnalisa' && (
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
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={editFormData.rateGenerik}
                          onChange={(e) => handleEditChange('rateGenerik', e.target.value)}
                          className="edit-input"
                          placeholder="PLN Rate"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={editFormData.rateAnalisa}
                          onChange={(e) => handleEditChange('rateAnalisa', e.target.value)}
                          className="edit-input"
                          placeholder="Analisa Rate"
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
                      <td className="manhour">{item.rateGenerik ? parseFloat(item.rateGenerik).toFixed(2) : '-'}</td>
                      <td className="manhour">{item.rateAnalisa ? parseFloat(item.rateAnalisa).toFixed(2) : '-'}</td>
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
              
              <div className="form-row">
                <div className="form-group">
                  <label>PLN Rate:</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addFormData.groupGenerikRate}
                    onChange={(e) => handleAddFormChange('groupGenerikRate', e.target.value)}
                    placeholder="0.00 (Optional)"
                  />
                </div>
                <div className="form-group">
                  <label>Analisa Rate:</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addFormData.groupAnalisaRate}
                    onChange={(e) => handleAddFormChange('groupAnalisaRate', e.target.value)}
                    placeholder="0.00 (Optional)"
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
                    {deletingItem.rateGenerik && (
                      <div className="info-row">
                        <strong>Generik Rate:</strong>
                        <span>{deletingItem.rateGenerik}</span>
                      </div>
                    )}
                    {deletingItem.rateAnalisa && (
                      <div className="info-row">
                        <strong>Analisa Rate:</strong>
                        <span>{deletingItem.rateAnalisa}</span>
                      </div>
                    )}
                    {deletingItem.tollFee && (
                      <div className="info-row">
                        <strong>Toll Fee:</strong>
                        <span>{deletingItem.tollFee}</span>
                      </div>
                    )}
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
                      <div className="esbm-spinner esbm-spinner-small" style={{ marginRight: '8px' }}></div>
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

      {/* Import Warning Modal */}
      <ImportWarningModal
        isOpen={showImportWarning}
        onClose={() => setShowImportWarning(false)}
        onConfirm={handleImportConfirm}
        title="Cost Allocation Import"
        dataType="cost allocation entries"
      />
    </div>
  );
};

export default Pembebanan;
