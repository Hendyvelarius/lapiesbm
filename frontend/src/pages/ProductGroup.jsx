import React, { useState, useEffect, useCallback } from 'react';
import { masterAPI, productsAPI } from '../services/api';
import '../styles/ProductGroup.css';
import { Search, Filter, Edit, Trash2, Users, ChevronLeft, ChevronRight, X, Check, ChevronUp, ChevronDown, ToggleLeft, ToggleRight, Download, Upload, Lock } from 'lucide-react';
import AWN from 'awesome-notifications';
import 'awesome-notifications/dist/style.css';
import LoadingSpinner from '../components/LoadingSpinner';

// Initialize awesome-notifications
const notifier = new AWN({
  position: 'top-right',
  durations: {
    global: 5000
  }
});

const ProductGroup = () => {
  const [groupData, setGroupData] = useState([]);
  const [groupManualData, setGroupManualData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [paginatedData, setPaginatedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  
  // View mode state - Standard (non-generik) or Generik mode
  const [viewMode, setViewMode] = useState('Standard'); // 'Standard' or 'Generik'
  const [hasModeSwitched, setHasModeSwitched] = useState(false); // Track if user has switched modes
  
  // Year/Periode filter state
  const [selectedPeriode, setSelectedPeriode] = useState(new Date().getFullYear());
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

  // Import All modal states
  const [showImportAllModal, setShowImportAllModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);

  // Lock status state - tracks which products are locked for the selected period
  const [lockedProductIds, setLockedProductIds] = useState([]);
  const [lockCheckLoading, setLockCheckLoading] = useState(false);

  // Get current user from auth
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Dropdown options
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [deptOptions, setDeptOptions] = useState([]);

  // Fetch locked products for the selected period
  const fetchLockedProducts = useCallback(async (periode) => {
    if (!periode) return;
    
    try {
      setLockCheckLoading(true);
      const result = await productsAPI.getLockedProducts(periode.toString());
      if (result.success && result.data) {
        setLockedProductIds(result.data);
      } else {
        setLockedProductIds([]);
      }
    } catch (error) {
      console.error('Error fetching locked products:', error);
      setLockedProductIds([]);
    } finally {
      setLockCheckLoading(false);
    }
  }, []);

  // Check if a product is locked
  const isProductLocked = useCallback((productId) => {
    return lockedProductIds.includes(productId);
  }, [lockedProductIds]);

  // Fetch default year on component mount
  useEffect(() => {
    const fetchDefaultYear = async () => {
      try {
        const response = await productsAPI.getDefaultYear();
        if (response.success && response.data?.defaultYear) {
          setSelectedPeriode(parseInt(response.data.defaultYear));
          setSelectedYear(response.data.defaultYear);
        }
      } catch (error) {
        console.error('Failed to fetch default year:', error);
        // Keep current year as fallback if API fails
      } finally {
        setPeriodeLoaded(true);
      }
    };

    fetchDefaultYear();
  }, []);

  useEffect(() => {
    if (!periodeLoaded) return; // Don't fetch until default year is loaded
    fetchAllData();
    fetchLockedProducts(selectedPeriode); // Fetch locked products when period changes
  }, [selectedPeriode, periodeLoaded, fetchLockedProducts]); // Refetch when periode changes

  useEffect(() => {
    filterData();
  }, [groupData, searchTerm, selectedCategory, sortField, sortDirection, viewMode]);

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

  // Reset category filter when switching view modes
  useEffect(() => {
    setSelectedCategory('All Categories');
  }, [viewMode]);

  // Handle mode switching with animation trigger
  const handleModeSwitch = () => {
    setHasModeSwitched(true);
    setViewMode(viewMode === 'Standard' ? 'Generik' : 'Standard');
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch both group and groupManual data with selected periode
      const [groupResponse, groupManualResponse] = await Promise.all([
        masterAPI.getGroup(selectedPeriode),
        masterAPI.getGroupManual()
      ]);
      
      // Transform group data
      const transformedGroupData = groupResponse.map(item => ({
        pk_id: item.Group_ProductID, // Use ProductID as primary key
        periode: item.Periode,
        productId: item.Group_ProductID,
        productName: item.Product_Name,
        lob: item.LOB,
        jenisSediaan: item.Jenis_Sediaan,
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
        reagenRate: item.Reagen_Rate || 0,
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

    // Apply view mode filter first
    if (viewMode === 'Standard') {
      // Show only non-generik products (exclude "Produk Generik")
      filtered = filtered.filter(item => item.pnCategoryName !== 'Produk Generik');
    } else if (viewMode === 'Generik') {
      // Show only generik products (include "Produk Generik")
      filtered = filtered.filter(item => item.pnCategoryName === 'Produk Generik');
    }

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
    // For Generik mode, only initialize the editable fields
    setEditFormData({
      // Keep original values for read-only display
      pnCategory: item.pnCategory,
      pnCategoryName: item.pnCategoryName,
      manHourPros: item.manHourPros || 0,
      manHourPack: item.manHourPack || 0,
      rendemen: item.rendemen || 0,
      dept: item.dept || '',
      // Initialize editable Generik fields
      mhtBB: item.mhtBB || 0,
      mhtBK: item.mhtBK || 0,
      mhAnalisa: item.mhAnalisa || 0,
      kwhMesin: item.kwhMesin || 0
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
      
      // For Generik mode, prepare data with only the editable fields
      const submitData = {
        productId: item.productId,
        productName: item.productName,
        pnCategory: item.pnCategory, // Keep original
        pnCategoryName: item.pnCategoryName, // Keep original
        // Keep original values for non-editable fields (set as null for new entries)
        manHourPros: null,
        manHourPack: null,
        rendemen: null,
        dept: null,
        // Only these fields are editable in Generik mode
        mhtBB: parseFloat(editFormData.mhtBB) || 0,
        mhtBK: parseFloat(editFormData.mhtBK) || 0,
        mhAnalisa: parseFloat(editFormData.mhAnalisa) || 0,
        kwhMesin: parseFloat(editFormData.kwhMesin) || 0
      };

      const isManualItem = isInManual(item.productId);
      
      if (isManualItem) {
        // Update existing manual entry - only update Generik-specific fields
        const updateData = {
          productId: item.productId,
          productName: item.productName,
          pnCategory: item.pnCategory,
          pnCategoryName: item.pnCategoryName,
          // Keep existing values for these fields
          manHourPros: item.manHourPros || 0,
          manHourPack: item.manHourPack || 0,
          rendemen: item.rendemen || 0,
          dept: item.dept || '',
          // Update only these Generik-specific fields
          mhtBB: parseFloat(editFormData.mhtBB) || 0,
          mhtBK: parseFloat(editFormData.mhtBK) || 0,
          mhAnalisa: parseFloat(editFormData.mhAnalisa) || 0,
          kwhMesin: parseFloat(editFormData.kwhMesin) || 0
        };
        await masterAPI.updateGroup(item.productId, updateData);
      } else {
        // Create new manual entry - only with Generik-specific fields
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

  // Export functionality
  const handleExportAll = async () => {
  try {
    setSubmitLoading(true);

    // Import xlsx library dynamically
    const XLSX = await import('xlsx');

    // Separate data into Standard (OTC/ETHICAL) and Generik
    const standardData = groupData.filter(item => item.pnCategoryName !== 'Produk Generik');
    const generikData = groupData.filter(item => item.pnCategoryName === 'Produk Generik');

    // Prepare Standard (OTC/ETHICAL) data - WITHOUT MHT BB, MHT BK, MH Analisa, KWH Mesin
    const standardExcelData = standardData.map(item => ({
      'Product ID': item.productId || '',
      'Product Name': item.productName || '',
      'LOB': item.lob || '',
      'Sediaan': item.jenisSediaan || '',
      'Category ID': item.pnCategory || '',
      'Category Name': item.pnCategoryName || '',
      'MH Process': parseFloat(item.manHourPros) || 0,
      'MH Packing': parseFloat(item.manHourPack) || 0,
      'Yield (%)': parseFloat(item.rendemen) || 0,
      'Department': item.dept || '',
      'Source': getSourceData(item)
    }));

    // Prepare Generik data - WITH all columns including MHT BB, MHT BK, MH Analisa, KWH Mesin
    const generikExcelData = generikData.map(item => ({
      'Product ID': item.productId || '',
      'Product Name': item.productName || '',
      'LOB': item.lob || '',
      'Sediaan': item.jenisSediaan || '',
      'Category ID': item.pnCategory || '',
      'Category Name': item.pnCategoryName || '',
      'MH Process': parseFloat(item.manHourPros) || 0,
      'MH Packing': parseFloat(item.manHourPack) || 0,
      'Yield (%)': parseFloat(item.rendemen) || 0,
      'Department': item.dept || '',
      'MHT BB': parseFloat(item.mhtBB) || 0,
      'MHT BK': parseFloat(item.mhtBK) || 0,
      'MH Analisa': parseFloat(item.mhAnalisa) || 0,
      'KWH Mesin': parseFloat(item.kwhMesin) || 0,
      'Source': getSourceData(item)
    }));

    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // ===== SHEET 1: OTC/ETHICAL (Standard) =====
    const standardWorksheet = XLSX.utils.json_to_sheet(standardExcelData);

    // Set column widths for Standard sheet
    const standardColumnWidths = [
      { wch: 15 }, // Product ID
      { wch: 40 }, // Product Name
      { wch: 12 }, // LOB
      { wch: 15 }, // Sediaan
      { wch: 12 }, // Category ID
      { wch: 20 }, // Category Name
      { wch: 12 }, // MH Process
      { wch: 12 }, // MH Packing
      { wch: 10 }, // Yield (%)
      { wch: 15 }, // Department
      { wch: 10 }, // Source
    ];
    standardWorksheet['!cols'] = standardColumnWidths;

    // Apply header formatting for Standard sheet
    const standardHeaderCells = ['A1','B1','C1','D1','E1','F1','G1','H1','I1','J1','K1'];
    standardHeaderCells.forEach(cell => {
      if (standardWorksheet[cell]) {
        standardWorksheet[cell].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "366092" } },
          alignment: { horizontal: "center" }
        };
      }
    });

    // Apply number formatting to numeric columns (G-I) for Standard
    if (standardWorksheet['!ref']) {
      const standardRange = XLSX.utils.decode_range(standardWorksheet['!ref']);
      for (let row = standardRange.s.r + 1; row <= standardRange.e.r; row++) {
        ['G','H','I'].forEach(col => {
          const cellAddress = col + (row + 1);
          if (standardWorksheet[cellAddress]) {
            standardWorksheet[cellAddress].s = {
              numFmt: "0.00",
              alignment: { horizontal: "right" }
            };
          }
        });
      }
    }

    // Add Standard worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, standardWorksheet, 'OTC-ETHICAL');

    // ===== SHEET 2: GENERIK =====
    const generikWorksheet = XLSX.utils.json_to_sheet(generikExcelData);

    // Set column widths for Generik sheet
    const generikColumnWidths = [
      { wch: 15 }, // Product ID
      { wch: 40 }, // Product Name
      { wch: 12 }, // LOB
      { wch: 15 }, // Sediaan
      { wch: 12 }, // Category ID
      { wch: 20 }, // Category Name
      { wch: 12 }, // MH Process
      { wch: 12 }, // MH Packing
      { wch: 10 }, // Yield (%)
      { wch: 15 }, // Department
      { wch: 12 }, // MHT BB
      { wch: 12 }, // MHT BK
      { wch: 12 }, // MH Analisa
      { wch: 12 }, // KWH Mesin
      { wch: 10 }, // Source
    ];
    generikWorksheet['!cols'] = generikColumnWidths;

    // Apply header formatting for Generik sheet
    const generikHeaderCells = ['A1','B1','C1','D1','E1','F1','G1','H1','I1','J1','K1','L1','M1','N1','O1'];
    generikHeaderCells.forEach(cell => {
      if (generikWorksheet[cell]) {
        generikWorksheet[cell].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "366092" } },
          alignment: { horizontal: "center" }
        };
      }
    });

    // Apply number formatting to numeric columns (G-N) for Generik
    if (generikWorksheet['!ref']) {
      const generikRange = XLSX.utils.decode_range(generikWorksheet['!ref']);
      for (let row = generikRange.s.r + 1; row <= generikRange.e.r; row++) {
        ['G','H','I','K','L','M','N'].forEach(col => {
          const cellAddress = col + (row + 1);
          if (generikWorksheet[cellAddress]) {
            generikWorksheet[cellAddress].s = {
              numFmt: "0.00",
              alignment: { horizontal: "right" }
            };
          }
        });
      }
    }

    // Add Generik worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, generikWorksheet, 'GENERIK');

    // Generate filename with current date
    const fileName = `ProductGroup_AllData_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Write and download the file
    XLSX.writeFile(workbook, fileName);

    // Show success notification
    notifier.success(`Excel file exported successfully with ${standardData.length} OTC/ETHICAL and ${generikData.length} GENERIK products`, {
      durations: { success: 3000 }
    });

  } catch (error) {
    console.error('Error exporting data:', error);
    setError('Failed to export data. Please try again.');
  } finally {
    setSubmitLoading(false);
  }
};
  /*const handleExportAll = async () => {
    try {
      setSubmitLoading(true);
      
      // Create CSV content from all group data (both Standard and Generik)
      const csvHeaders = [
        'Product ID',
        'Product Name',
        'LOB',
        'Sediaan',
        'Category ID',
        'Category Name',
        'MH Process',
        'MH Packing',
        'Yield (%)',
        'Department',
        'MHT BB',
        'MHT BK',
        'MH Analisa',
        'KWH Mesin',
        'Source'
      ];
      
      const csvRows = groupData.map(item => [
        item.productId || '',
        item.productName || '',
        item.lob || '',
        item.jenisSediaan || '',
        item.pnCategory || '',
        item.pnCategoryName || '',
        item.manHourPros || 0,
        item.manHourPack || 0,
        item.rendemen || 0,
        item.dept || '',
        item.mhtBB || 0,
        item.mhtBK || 0,
        item.mhAnalisa || 0,
        item.kwhMesin || 0,
        getSourceData(item)
      ]);
      
      // Create CSV content
      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(cell => 
          typeof cell === 'string' && cell.includes(',') 
            ? `"${cell.replace(/"/g, '""')}"` 
            : cell
        ).join(','))
      ].join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `ProductGroup_AllData_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Error exporting data:', error);
      setError('Failed to export data. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };*/

  // Export Generik functionality - exports Generik products in Excel format with proper formatting
  // Import All functionality - handles bulk import with year selection
  const handleImportAllClick = () => {
    setSelectedYear(''); // Reset year selection
    setImportFile(null); // Reset file
    setShowImportAllModal(true);
  };

  const handleImportAllConfirm = async () => {
    if (!selectedYear) {
      notifier.alert('Please select a year first');
      return;
    }

    if (!importFile) {
      notifier.alert('Please select a file to import');
      return;
    }

    try {
      setImportLoading(true);

      // First, fetch locked products for the selected import year
      let lockedIds = [];
      try {
        const lockResult = await productsAPI.getLockedProducts(selectedYear.toString());
        if (lockResult.success && lockResult.data) {
          lockedIds = lockResult.data;
        }
      } catch (error) {
        console.error('Error checking locked products:', error);
        // Continue with import even if lock check fails
      }

      // Import xlsx library dynamically
      const XLSX = await import('xlsx');
      
      const buffer = await importFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      
      // Process both sheets
      let standardData = [];
      let generikData = [];
      
      // Check for OTC-ETHICAL sheet
      if (workbook.SheetNames.includes('OTC-ETHICAL')) {
        const standardSheet = workbook.Sheets['OTC-ETHICAL'];
        const standardRows = XLSX.utils.sheet_to_json(standardSheet);
        standardData = standardRows.map(row => ({
          productId: row['Product ID']?.toString().trim() || '',
          productName: row['Product Name']?.toString().trim() || '',
          pnCategory: parseInt(row['Category ID']) || null,
          pnCategoryName: row['Category Name']?.toString().trim() || '',
          manHourPros: parseFloat(row['MH Process']) || 0,
          manHourPack: parseFloat(row['MH Packing']) || 0,
          rendemen: parseFloat(row['Yield (%)']) || 0,
          dept: row['Department']?.toString().trim() || '',
          mhtBB: 0,
          mhtBK: 0,
          mhAnalisa: 0,
          kwhMesin: 0,
          periode: selectedYear
        }));
      }
      
      // Check for GENERIK sheet
      if (workbook.SheetNames.includes('GENERIK')) {
        const generikSheet = workbook.Sheets['GENERIK'];
        const generikRows = XLSX.utils.sheet_to_json(generikSheet);
        generikData = generikRows.map(row => ({
          productId: row['Product ID']?.toString().trim() || '',
          productName: row['Product Name']?.toString().trim() || '',
          pnCategory: parseInt(row['Category ID']) || null,
          pnCategoryName: row['Category Name']?.toString().trim() || '',
          manHourPros: parseFloat(row['MH Process']) || 0,
          manHourPack: parseFloat(row['MH Packing']) || 0,
          rendemen: parseFloat(row['Yield (%)']) || 0,
          dept: row['Department']?.toString().trim() || '',
          mhtBB: parseFloat(row['MHT BB']) || 0,
          mhtBK: parseFloat(row['MHT BK']) || 0,
          mhAnalisa: parseFloat(row['MH Analisa']) || 0,
          kwhMesin: parseFloat(row['KWH Mesin']) || 0,
          periode: selectedYear
        }));
      }

      const allData = [...standardData, ...generikData];

      if (allData.length === 0) {
        notifier.alert('No valid data found in the Excel file');
        return;
      }

      // Filter out locked products from import data
      const skippedLockedProducts = allData.filter(item => lockedIds.includes(item.productId));
      const dataToImport = allData.filter(item => !lockedIds.includes(item.productId));

      if (dataToImport.length === 0 && skippedLockedProducts.length > 0) {
        notifier.warning(`All ${skippedLockedProducts.length} products in the file are locked and cannot be imported.`);
        return;
      }

      // Get user ID
      const userId = user?.logNIK || 'SYSTEM';

      // Call API to bulk import with locked product IDs to exclude from deletion
      const response = await masterAPI.bulkImportProductGroup(dataToImport, selectedYear, userId, lockedIds);

      if (response.success) {
        let message = `Successfully imported ${response.rowsAffected} products for year ${selectedYear}`;
        if (skippedLockedProducts.length > 0) {
          message += `. ${skippedLockedProducts.length} locked products were skipped.`;
        }
        notifier.success(message);
        setShowImportAllModal(false);
        setImportFile(null);
        setSelectedYear('');
        
        // Refresh data
        await fetchAllData();
      } else {
        notifier.alert(response.message || 'Import failed');
      }

    } catch (error) {
      console.error('Error importing data:', error);
      notifier.alert('Failed to import data. Please check the file format and try again.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      
      if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        notifier.alert('Please select a valid Excel file (.xlsx or .xls)');
        return;
      }
      
      setImportFile(file);
    }
  };

  const getAvailableYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    
    // 2 years before, current year, 2 years after
    for (let i = -2; i <= 2; i++) {
      years.push(currentYear + i);
    }
    
    return years;
  };

  // Import Generik functionality
  // Helper functions
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    if (num === 0) return '0';
    return num.toLocaleString();
  };

  const getCategories = () => {
    // Filter categories based on current view mode
    let relevantData = groupData;
    if (viewMode === 'Standard') {
      relevantData = groupData.filter(item => item.pnCategoryName !== 'Produk Generik');
    } else if (viewMode === 'Generik') {
      relevantData = groupData.filter(item => item.pnCategoryName === 'Produk Generik');
    }
    
    const categories = [...new Set(relevantData.map(item => item.pnCategoryName).filter(Boolean))];
    return ['All Categories', ...categories];
  };

  if (loading) {
    return (
      <LoadingSpinner 
        message="Loading product groups..." 
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
    <div className={`product-group-container ${viewMode.toLowerCase()}-mode ${hasModeSwitched ? 'mode-switched' : ''}`}>
      <div className="controls-section">
        {/* Row 1: Search, Year, Mode Toggle */}
        <div className="controls-row controls-row-top">
          <div className="controls-left">
            <div className="search-box">
              <Search size={20} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="year-filter">
              <select 
                value={selectedPeriode}
                onChange={(e) => setSelectedPeriode(parseInt(e.target.value))}
                className="year-selector"
              >
                {getAvailableYears().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="controls-right">
            <div className={`mode-indicator ${viewMode.toLowerCase()}-mode ${hasModeSwitched ? 'animated' : ''}`}>
              <span>{viewMode.toUpperCase()} MODE</span>
            </div>
            <button 
              className={`toggle-btn ${viewMode.toLowerCase()}-mode`}
              onClick={handleModeSwitch}
              title={`Switch to ${viewMode === 'Standard' ? 'Generik' : 'Standard'} mode`}
            >
              {viewMode === 'Standard' ? <ToggleLeft size={20} /> : <ToggleRight size={20} />}
              <span>Switch to {viewMode === 'Standard' ? 'Generik' : 'Standard'}</span>
            </button>
          </div>
        </div>
        
        {/* Row 2: Category Filter + Export/Import */}
        <div className="controls-row controls-row-bottom">
          <div className="filter-controls">
            <div className="category-filter">
              <Filter size={18} />
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                title={selectedCategory}
              >
                {getCategories().map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="action-buttons">
            <button 
              className="export-btn"
              onClick={handleExportAll}
              disabled={submitLoading}
              title="Export all product group data to CSV"
            >
              <Download size={20} />
              <span>Export</span>
            </button>
            <button 
              className="import-btn"
              onClick={handleImportAllClick}
              disabled={submitLoading}
              title="Import all product group data from Excel"
            >
              <Upload size={20} />
              <span>Import</span>
            </button>
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
                {/* Generik-specific columns - only show in Generik mode */}
                {viewMode === 'Generik' && (
                  <>
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
                  </>
                )}
                {/* Actions column - only show in Generik mode */}
                {viewMode === 'Generik' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item) => (
                <tr key={item.productId} className={editingRowId === item.productId ? 'editing-row' : ''}>
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
                        {/* Group name - read-only in Generik mode */}
                        <span className={getCategoryBadgeClass(item.pnCategory, item.pnCategoryName)}>
                          {item.pnCategoryName}
                        </span>
                      </td>
                      <td className="manhour">{formatNumber(item.manHourPros)}</td>
                      <td className="manhour">{formatNumber(item.manHourPack)}</td>
                      <td className="rendemen">{item.rendemen ? `${item.rendemen}%` : '-'}</td>
                      <td className="dept">{item.dept || '-'}</td>
                      {/* Generik-specific editing fields - only show in Generik mode */}
                      {viewMode === 'Generik' && (
                        <>
                          <td>
                            <input
                              type="number"
                              value={editFormData.mhtBB || 0}
                              onChange={(e) => handleFormChange('mhtBB', e.target.value)}
                              className="edit-input generik-field"
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={editFormData.mhtBK || 0}
                              onChange={(e) => handleFormChange('mhtBK', e.target.value)}
                              className="edit-input generik-field"
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={editFormData.mhAnalisa || 0}
                              onChange={(e) => handleFormChange('mhAnalisa', e.target.value)}
                              className="edit-input generik-field"
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={editFormData.kwhMesin || 0}
                              onChange={(e) => handleFormChange('kwhMesin', e.target.value)}
                              className="edit-input generik-field"
                              min="0"
                              step="0.01"
                            />
                          </td>
                        </>
                      )}
                      {/* Actions column - only show in Generik mode */}
                      {viewMode === 'Generik' && (
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
                      )}
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
                      {/* Generik-specific display columns - only show in Generik mode */}
                      {viewMode === 'Generik' && (
                        <>
                          <td className="mht-bb">{formatNumber(item.mhtBB)}</td>
                          <td className="mht-bk">{formatNumber(item.mhtBK)}</td>
                          <td className="mh-analisa">{formatNumber(item.mhAnalisa)}</td>
                          <td className="kwh-mesin">{formatNumber(item.kwhMesin)}</td>
                        </>
                      )}
                      {/* Actions column - only show in Generik mode */}
                      {viewMode === 'Generik' && (
                        <td className={`actions display-mode ${isInManual(item.productId) ? 'multiple-buttons' : 'single-button'}`}>
                          {isProductLocked(item.productId) ? (
                            <div className="locked-indicator" title="This product is locked in Formula Assignment">
                              <Lock size={16} />
                            </div>
                          ) : (
                            <>
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
                            </>
                          )}
                        </td>
                      )}
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
            <h3>No {viewMode} Product Groups Found</h3>
            <p>
              {searchTerm
                ? selectedCategory === 'All Categories'
                  ? `No ${viewMode.toLowerCase()} groups match your search.`
                  : `No ${selectedCategory.toLowerCase()} groups match your search in ${viewMode.toLowerCase()} mode.`
                : selectedCategory === 'All Categories'
                  ? `No ${viewMode.toLowerCase()} groups available.`
                  : `No ${selectedCategory.toLowerCase()} groups available in ${viewMode.toLowerCase()} mode.`
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
        <span>{filteredData.length} of {groupData.filter(item => 
          viewMode === 'Standard' 
            ? item.pnCategoryName !== 'Produk Generik' 
            : item.pnCategoryName === 'Produk Generik'
        ).length} {viewMode.toLowerCase()} groups</span>
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
                      <div className="esbm-spinner esbm-spinner-small" style={{ marginRight: '8px' }}></div>
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

      {/* Import Warning Modal */}
      {/* Import All Modal */}
      {showImportAllModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Import All Product Groups</h2>
              <button className="modal-close" onClick={() => setShowImportAllModal(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="import-warning-section">
                <div className="warning-icon" style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <Upload size={48} color="#f59e0b" />
                </div>
                <h3 style={{ textAlign: 'center', color: '#f59e0b', marginBottom: '1rem' }}>Important Information</h3>
                <p style={{ marginBottom: '1rem', lineHeight: '1.6' }}>
                  This import will perform the following actions:
                </p>
                <ul style={{ marginLeft: '1.5rem', marginBottom: '1.5rem', lineHeight: '1.8' }}>
                  <li><strong>Delete all existing data</strong> for the selected year (periode)</li>
                  <li><strong>Insert new data</strong> from your Excel file for that year</li>
                  <li>Process both <strong>OTC-ETHICAL</strong> and <strong>GENERIK</strong> sheets</li>
                </ul>
                <p style={{ color: '#dc2626', fontWeight: '600', marginBottom: '1.5rem' }}>
                  ⚠️ This action cannot be undone. Please ensure you have selected the correct file and year.
                </p>
              </div>

              <div className="form-group">
                <label htmlFor="import-year">
                  Select Year (Periode) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  id="import-year"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  disabled={importLoading}
                  style={{ width: '100%' }}
                >
                  <option value="">Pick Year</option>
                  {getAvailableYears().map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="import-file">
                  Select Excel File <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="import-file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={importLoading}
                  style={{ width: '100%' }}
                />
                {importFile && (
                  <div style={{ marginTop: '0.5rem', color: '#059669', fontSize: '0.9rem' }}>
                    ✓ Selected: {importFile.name}
                  </div>
                )}
              </div>

              <div className="form-info">
                <small>
                  <strong>File Format:</strong> The Excel file must have the same format as the Export All function generates,
                  with sheets named <strong>"OTC-ETHICAL"</strong> and <strong>"GENERIK"</strong>.
                </small>
              </div>
              
              <div className="modal-actions">
                <button 
                  className="modal-btn secondary" 
                  onClick={() => setShowImportAllModal(false)}
                  disabled={importLoading}
                >
                  Cancel
                </button>
                <button 
                  className="modal-btn primary" 
                  onClick={handleImportAllConfirm}
                  disabled={importLoading || !selectedYear || !importFile}
                >
                  {importLoading ? (
                    <>
                      <div className="btn-spinner"></div>
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Import Data
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
