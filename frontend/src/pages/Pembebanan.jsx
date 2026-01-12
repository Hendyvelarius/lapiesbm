import React, { useState, useEffect, useCallback } from 'react';
import { masterAPI, productsAPI } from '../services/api';
import '../styles/Pembebanan.css';
import { Search, Filter, Users, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus, Edit, Trash2, X, Check, Download, Upload, Lock } from 'lucide-react';
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
  
  // Period state
  const [selectedPeriode, setSelectedPeriode] = useState(new Date().getFullYear().toString());
  const [periodeLoaded, setPeriodeLoaded] = useState(false); // Prevent race condition with default year
  
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
    groupAnalisaRate: '',
    rateAsGroupID: '' // For "Rate As" functionality
  });
  
  // Rate input mode state ('manual' or 'rateAs')
  const [rateInputMode, setRateInputMode] = useState('manual');
  
  // Import warning modal state
  const [showImportWarning, setShowImportWarning] = useState(false);
  const [importPeriode, setImportPeriode] = useState(new Date().getFullYear().toString());
  
  // Lock status state - tracks locked products for the selected period
  const [lockedProductIds, setLockedProductIds] = useState([]);
  const [hasAnyLockedProducts, setHasAnyLockedProducts] = useState(false);
  const [lockCheckLoading, setLockCheckLoading] = useState(false);
  
  // Dropdown states for Add modal
  const [availableGroups, setAvailableGroups] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);

  // Fetch locked products for the selected period
  const fetchLockedProducts = useCallback(async (periode) => {
    if (!periode) return;
    
    try {
      setLockCheckLoading(true);
      const result = await productsAPI.getLockedProducts(periode.toString());
      if (result.success && result.data) {
        setLockedProductIds(result.data);
        setHasAnyLockedProducts(result.data.length > 0);
      } else {
        setLockedProductIds([]);
        setHasAnyLockedProducts(false);
      }
    } catch (error) {
      console.error('Error fetching locked products:', error);
      setLockedProductIds([]);
      setHasAnyLockedProducts(false);
    } finally {
      setLockCheckLoading(false);
    }
  }, []);

  // Check if a product is locked
  const isProductLocked = useCallback((productId) => {
    if (!productId) return false;
    return lockedProductIds.includes(productId);
  }, [lockedProductIds]);

  // Fetch default year on component mount
  useEffect(() => {
    const fetchDefaultYear = async () => {
      try {
        const response = await productsAPI.getDefaultYear();
        if (response.success && response.data?.defaultYear) {
          const defaultYear = response.data.defaultYear;
          setSelectedPeriode(defaultYear);
          setImportPeriode(defaultYear);
        }
      } catch (error) {
        console.error('Failed to fetch default year:', error);
      } finally {
        setPeriodeLoaded(true);
      }
    };

    fetchDefaultYear();
  }, []);

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

  // Initial data load - wait for periode to load first
  useEffect(() => {
    if (!periodeLoaded) return; // Don't fetch until default year is loaded
    fetchAllData();
    fetchLockedProducts(selectedPeriode);
  }, [periodeLoaded, fetchLockedProducts]);
  
  // Reload when periode changes and fetch locked products
  useEffect(() => {
    if (selectedPeriode) {
      setCurrentPage(1); // Reset to first page when changing year
      fetchLockedProducts(selectedPeriode);
    }
  }, [selectedPeriode, fetchLockedProducts]);

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
    return pembebanData
      .filter(pembebanan => pembebanan.Group_Periode === selectedPeriode) // Filter by selected year
      .map(pembebanan => {
      // Check if this is a default rate (no specific product)
      if (!pembebanan.Group_ProductID) {
        return {
          pk_id: pembebanan.pk_id,
          periode: pembebanan.Group_Periode,
          productId: null,
          productName: 'DEFAULT RATE',
          isDefaultRate: true,
          isRateAs: false,
          rateAsGroupName: null,
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
        // Match by both Product ID and Periode to handle multiple years
        const productDetails = groupData.find(group => 
          group.Group_ProductID === pembebanan.Group_ProductID &&
          group.Periode === pembebanan.Group_Periode
        );
        
        // Check if this product uses "Rate As" functionality
        const isRateAs = pembebanan.Group_PNCategoryRateAs && pembebanan.Group_PNCategoryRateAs !== null;
        
        // If Rate As is set, find the default rate for the referenced group
        let actualRates = {
          rateProses: pembebanan.Group_Proses_Rate,
          rateKemas: pembebanan.Group_Kemas_Rate,
          rateGenerik: pembebanan.Group_PLN_Rate,
          rateAnalisa: pembebanan.Group_Analisa_Rate
        };
        
        let rateAsGroupName = null;
        
        if (isRateAs) {
          // Find the default rate entry for the referenced group (where Group_ProductID is null)
          const rateAsDefaultEntry = pembebanData.find(item => 
            !item.Group_ProductID && 
            item.Group_PNCategoryID === pembebanan.Group_PNCategoryRateAs
          );
          
          if (rateAsDefaultEntry) {
            actualRates = {
              rateProses: rateAsDefaultEntry.Group_Proses_Rate,
              rateKemas: rateAsDefaultEntry.Group_Kemas_Rate,
              rateGenerik: rateAsDefaultEntry.Group_PLN_Rate,
              rateAnalisa: rateAsDefaultEntry.Group_Analisa_Rate
            };
            rateAsGroupName = rateAsDefaultEntry.Group_PNCategory_Name;
          }
        }
        
        if (productDetails) {
          return {
            pk_id: pembebanan.pk_id,
            periode: pembebanan.Group_Periode,
            productId: pembebanan.Group_ProductID,
            productName: productDetails.Product_Name,
            isDefaultRate: false,
            isRateAs: isRateAs,
            rateAsGroupName: rateAsGroupName,
            groupId: productDetails.Group_PNCategory,
            groupName: productDetails.Group_PNCategoryName,
            ...actualRates,
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
            isRateAs: isRateAs,
            rateAsGroupName: rateAsGroupName,
            groupId: 'Unknown',
            groupName: 'Unknown Group',
            ...actualRates,
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
  }, [pembebanData, groupData, selectedPeriode]);

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
      
      // Also filter out locked products - users cannot add rates for locked products
      const availableProductsFiltered = allProducts.filter(product => 
        !existingProductIds.has(product.id) && !lockedProductIds.includes(product.id)
      );
      
      setAvailableProducts(availableProductsFiltered);
      setFilteredProducts(availableProductsFiltered);
    }
  }, [groupData, processedData, lockedProductIds]); // Added lockedProductIds as dependency

  // Inline editing functions
  const handleEdit = (item) => {
    setEditingRowId(item.pk_id);
    if (item.isRateAs) {
      // For Rate As products, store the current rateAs group ID
      setEditFormData({
        rateAsGroupID: item.Group_PNCategoryRateAs || ''
      });
    } else {
      // For manual products, store the rates
      setEditFormData({
        rateProses: item.rateProses,
        rateKemas: item.rateKemas,
        rateGenerik: item.rateGenerik || '',
        rateAnalisa: item.rateAnalisa || ''
      });
    }
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
      
      const editedItem = processedData.find(p => p.pk_id === editingRowId);
      
      if (editedItem.isRateAs) {
        // Update Rate As product - change the group it's rated as
        const updateData = {
          groupPNCategoryID: editedItem.groupId,
          groupPNCategoryName: editedItem.groupName,
          groupProductID: editedItem.productId,
          groupProsesRate: 0,
          groupKemasRate: 0,
          groupPLNRate: 0,
          groupAnalisaRate: 0,
          groupPNCategoryRateAs: editFormData.rateAsGroupID || null
        };
        
        await masterAPI.updatePembebanan(editingRowId, updateData);
      } else {
        // Update manual product - update the rates
        const updateData = {
          groupPNCategoryID: editedItem.groupId,
          groupPNCategoryName: editedItem.groupName,
          groupProductID: editedItem.productId,
          groupProsesRate: parseFloat(editFormData.rateProses) || 0,
          groupKemasRate: parseFloat(editFormData.rateKemas) || 0,
          groupPLNRate: parseFloat(editFormData.rateGenerik) || null,
          groupAnalisaRate: parseFloat(editFormData.rateAnalisa) || null,
          groupPNCategoryRateAs: null
        };
        
        await masterAPI.updatePembebanan(editingRowId, updateData);
      }
      
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
    setRateInputMode('manual'); // Reset mode
    setAddFormData({
      groupPNCategoryID: '',
      groupPNCategoryName: '',
      groupProductID: null,
      productName: '',
      groupProsesRate: '',
      groupKemasRate: '',
      groupGenerikRate: '',
      groupAnalisaRate: '',
      rateAsGroupID: ''
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

      // Validate based on rate input mode
      if (rateInputMode === 'manual') {
        if (!addFormData.groupProsesRate || parseFloat(addFormData.groupProsesRate) < 0) {
          notifier.alert('Please enter a valid Proses Rate (must be 0 or greater)');
          return;
        }
        
        if (!addFormData.groupKemasRate || parseFloat(addFormData.groupKemasRate) < 0) {
          notifier.alert('Please enter a valid Kemas Rate (must be 0 or greater)');
          return;
        }
      } else {
        // Rate As mode
        if (!addFormData.rateAsGroupID) {
          notifier.alert('Please select a group to rate as');
          return;
        }
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
        // Manual mode: use entered values, set rateAs to null
        // Rate As mode: set rates to 0, set rateAs to selected group ID
        groupProsesRate: rateInputMode === 'manual' ? parseFloat(addFormData.groupProsesRate) : 0,
        groupKemasRate: rateInputMode === 'manual' ? parseFloat(addFormData.groupKemasRate) : 0,
        groupPLNRate: rateInputMode === 'manual' ? (addFormData.groupGenerikRate ? parseFloat(addFormData.groupGenerikRate) : 0) : 0,
        groupAnalisaRate: rateInputMode === 'manual' ? (addFormData.groupAnalisaRate ? parseFloat(addFormData.groupAnalisaRate) : 0) : 0,
        groupPNCategoryRateAs: rateInputMode === 'rateAs' ? String(addFormData.rateAsGroupID) : null
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

  // Export function - exports all cost allocation data (including default rates) for selected year
  const handleExportCostAllocation = () => {
    try {
      // Export entries for the selected periode with proper formatting
      const exportData = pembebanData
        .filter(item => item.Group_Periode === selectedPeriode)
        .map(item => ({
          'Product ID': item.Group_ProductID || '',
          'Group ID': item.Group_PNCategoryID || '',
          'Group Name': item.Group_PNCategory_Name || '',
          'Is Default Rate': !item.Group_ProductID ? 'YES' : 'NO',
          'Rate As Group ID': item.Group_PNCategoryRateAs || '',
          'Rate Proses': parseFloat(item.Group_Proses_Rate) || 0,
          'Rate Kemas': parseFloat(item.Group_Kemas_Rate) || 0,
          'Rate PLN': parseFloat(item.Group_PLN_Rate) || 0,
          'Rate Analisa': parseFloat(item.Group_Analisa_Rate) || 0
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
        { wch: 18 }, // Rate As Group ID
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
      
      // Force Product ID, Group ID, and Rate As Group ID columns to be text format
      worksheet['!cols'][0] = { ...worksheet['!cols'][0], z: '@' }; // Product ID as text
      worksheet['!cols'][1] = { ...worksheet['!cols'][1], z: '@' }; // Group ID as text
      worksheet['!cols'][4] = { ...worksheet['!cols'][4], z: '@' }; // Rate As Group ID as text
      
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
        
        // Format Rate As Group ID column as text (including empty cells)
        const rateAsGroupIdCell = XLSX.utils.encode_cell({ r: row, c: 4 });
        if (!worksheet[rateAsGroupIdCell]) worksheet[rateAsGroupIdCell] = { v: '', t: 's' };
        worksheet[rateAsGroupIdCell].t = 's';
        worksheet[rateAsGroupIdCell].z = '@';
        
        // Format numeric columns explicitly as numbers with 2 decimal places
        for (let col = 5; col <= 8; col++) { // Rate columns (Proses, Kemas, PLN, Analisa) - shifted by 1
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
        // Pre-format empty rows for Product ID, Group ID, and Rate As Group ID as text
        const productIdCell = XLSX.utils.encode_cell({ r: extraRow, c: 0 });
        const groupIdCell = XLSX.utils.encode_cell({ r: extraRow, c: 1 });
        const rateAsGroupIdCell = XLSX.utils.encode_cell({ r: extraRow, c: 4 });
        
        worksheet[productIdCell] = { v: '', t: 's', z: '@' };
        worksheet[groupIdCell] = { v: '', t: 's', z: '@' };
        worksheet[rateAsGroupIdCell] = { v: '', t: 's', z: '@' };
        
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

      // Generate filename with selected year
      const filename = `Pembebanan_${selectedPeriode}.xlsx`;

      // Write and download the file
      XLSX.writeFile(workbook, filename);

      const defaultRatesCount = exportData.filter(item => item['Is Default Rate'] === 'YES').length;
      const customRatesCount = exportData.filter(item => item['Is Default Rate'] === 'NO').length;
      notifier.success(`Successfully exported ${exportData.length} cost allocation records for year ${selectedPeriode} to Excel (${defaultRatesCount} default rates, ${customRatesCount} custom rates)`);
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

        // Fetch locked products for the import period to exclude them from deletion
        let lockedIds = [];
        try {
          const lockedResponse = await productsAPI.getLockedProducts(importPeriode);
          if (lockedResponse.success && lockedResponse.data) {
            lockedIds = lockedResponse.data;
            if (lockedIds.length > 0) {
              notifier.info(`Found ${lockedIds.length} locked products - their rates will be preserved during import.`);
            }
          }
        } catch (lockErr) {
          console.warn('Could not fetch locked products, proceeding with full import:', lockErr);
        }

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

        // Filter out locked products from import data (they should not be overwritten)
        let filteredData = validatedData;
        let skippedCount = 0;
        if (lockedIds.length > 0) {
          filteredData = validatedData.filter(item => {
            // Default rates (no groupProductID) are always imported
            if (item.isDefaultRate || !item.groupProductID) {
              return true;
            }
            // Skip locked products
            if (lockedIds.includes(item.groupProductID)) {
              skippedCount++;
              return false;
            }
            return true;
          });
          
          if (skippedCount > 0) {
            notifier.info(`Skipped ${skippedCount} entries for locked products.`);
          }
        }

        // Call bulk import API with periode and locked product IDs
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const result = await masterAPI.bulkImportPembebanan(filteredData, user?.logNIK || 'system', importPeriode, lockedIds);

        // Show success message and refresh data
        await fetchAllData();
        setSelectedPeriode(importPeriode); // Switch to imported year's view

        let successMessage = `Import completed successfully for year ${importPeriode}! Deleted: ${result.data.deleted} old records, Inserted: ${result.data.inserted} new records`;
        if (skippedCount > 0) {
          successMessage += ` (${skippedCount} locked product entries skipped)`;
        }
        notifier.success(successMessage, {
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
        setImportPeriode(new Date().getFullYear().toString()); // Reset for next import
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
      const rateAsGroupId = row['Rate As Group ID'] || row['RateAsGroupID'] || row['Rate_As_Group_ID'] || '';

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

      // Check if this entry uses Rate As functionality
      const isRateAs = rateAsGroupId && String(rateAsGroupId).trim() !== '';
      
      // Add Rate As Group ID to processed row if specified
      if (isRateAs) {
        processedRow.groupPNCategoryRateAs = String(rateAsGroupId).trim();
      } else {
        processedRow.groupPNCategoryRateAs = null;
      }

      // Validate and extract numeric values
      // If Rate As is specified, ignore rate values and set them to 0
      const numericFields = isRateAs ? {
        rateProses: 0,
        rateKemas: 0,
        rateGenerik: 0,
        rateReagen: 0
      } : {
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
          
          <div className="period-selector">
            <label htmlFor="pembebanan-periode-select">Year:</label>
            <select
              id="pembebanan-periode-select"
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
                      <span className={`source-badge ${item.isDefaultRate ? 'default' : item.isRateAs ? 'rate-as' : 'manual'}`}>
                        {item.isDefaultRate ? 'DEF' : item.isRateAs ? 'R8S' : 'MNL'}
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
                      {item.isRateAs ? (
                        // Rate As product - show group selector
                        <>
                          <td>
                            <select
                              value={editFormData.rateAsGroupID || ''}
                              onChange={(e) => handleEditChange('rateAsGroupID', e.target.value)}
                              className="edit-select"
                            >
                              <option value="">Select Group to Rate As...</option>
                              {pembebanData
                                .filter(p => !p.Group_ProductID && p.Group_PNCategoryID !== item.groupPNCategoryID && p.Group_PNCategoryID !== '7')
                                .map(group => (
                                  <option key={group.Group_PNCategoryID} value={group.Group_PNCategoryID}>
                                    {group.Group_PNCategory_Name}
                                  </option>
                                ))}
                            </select>
                          </td>
                          <td colSpan="4" className="rate-as-info">
                            <div className="rate-as-message">
                              <span>Rates will be automatically assigned from the selected group's default rates</span>
                            </div>
                          </td>
                        </>
                      ) : (
                        // Manual product - show rate inputs
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
                        </>
                      )}
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
                        <span className={`category-badge ${item.isRateAs ? 'rate-as' : ''}`} title={item.isRateAs && item.rateAsGroupName ? `Rated as ${item.rateAsGroupName}` : item.groupName}>
                          {item.isRateAs && item.rateAsGroupName ? item.rateAsGroupName : item.groupName}
                        </span>
                      </td>
                      <td className="manhour">{parseFloat(item.rateProses).toFixed(2)}</td>
                      <td className="manhour">{parseFloat(item.rateKemas).toFixed(2)}</td>
                      <td className="manhour">{item.rateGenerik ? parseFloat(item.rateGenerik).toFixed(2) : '-'}</td>
                      <td className="manhour">{item.rateAnalisa ? parseFloat(item.rateAnalisa).toFixed(2) : '-'}</td>
                      <td className={`actions display-mode ${item.isDefaultRate ? 'single-button' : 'multiple-buttons'}`}>
                        {/* Lock check: Default rates locked when ANY products are locked, individual products locked based on their specific lock status */}
                        {(item.isDefaultRate && hasAnyLockedProducts) || (!item.isDefaultRate && isProductLocked(item.productId)) ? (
                          <div className="locked-indicator" title={item.isDefaultRate ? "Default rates are locked - some products have locked formulas" : "This product is locked in Formula Assignment"}>
                            <Lock size={16} />
                          </div>
                        ) : (
                          <>
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
                          </>
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
                      All products in "{addFormData.groupPNCategoryName}" either already have cost allocation entries or are locked.
                      Select a different group or edit existing entries.
                    </small>
                  </div>
                )}
                {hasAnyLockedProducts && (
                  <div className="lock-info-note" style={{marginTop: '0.5rem', padding: '0.5rem', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '4px', fontSize: '0.8rem', color: '#92400e'}}>
                    <Lock size={14} style={{display: 'inline', marginRight: '4px', verticalAlign: 'middle'}} />
                    Some products are locked and cannot be selected for new allocations.
                  </div>
                )}
              </div>
              
              {/* Rate Input Mode Toggle - Only show when Produk Toll In (ID 7) is selected */}
              {addFormData.groupPNCategoryID === '7' && addFormData.groupProductID && (
                <div className="rate-mode-toggle">
                  <label>Rate Input Method:</label>
                  <div className="toggle-buttons">
                    <button
                      type="button"
                      className={`toggle-btn ${rateInputMode === 'manual' ? 'active' : ''}`}
                      onClick={() => setRateInputMode('manual')}
                    >
                      Manual Input
                    </button>
                    <button
                      type="button"
                      className={`toggle-btn ${rateInputMode === 'rateAs' ? 'active' : ''}`}
                      onClick={() => setRateInputMode('rateAs')}
                    >
                      Rate As
                    </button>
                  </div>
                </div>
              )}
              
              {/* Show manual inputs or Rate As dropdown based on mode */}
              {rateInputMode === 'manual' ? (
                <>
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
                </>
              ) : (
                <div className="form-group">
                  <label>Rate as Group: *</label>
                  <select
                    value={addFormData.rateAsGroupID}
                    onChange={(e) => handleAddFormChange('rateAsGroupID', e.target.value)}
                    required
                  >
                    <option value="">Select Group to Rate As</option>
                    {availableGroups
                      .filter(group => group.id !== '7') // Exclude Produk Toll In
                      .map(group => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                  </select>
                  <small style={{color: '#666', fontStyle: 'italic', marginTop: '0.5rem', display: 'block'}}>
                    This product will use the same rates as the selected group
                  </small>
                </div>
              )}
              
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
                disabled={
                  !addFormData.groupPNCategoryName || 
                  !addFormData.groupProductID || 
                  (rateInputMode === 'manual' && (!addFormData.groupProsesRate || !addFormData.groupKemasRate)) ||
                  (rateInputMode === 'rateAs' && !addFormData.rateAsGroupID)
                }
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
        onClose={() => {
          setShowImportWarning(false);
          setImportPeriode(new Date().getFullYear().toString());
        }}
        onConfirm={handleImportConfirm}
        title="Cost Allocation Import"
        dataType="cost allocation entries"
        selectedPeriode={importPeriode}
        onPeriodeChange={setImportPeriode}
      />
    </div>
  );
};

export default Pembebanan;
