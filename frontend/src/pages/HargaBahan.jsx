import React, { useState, useEffect, useMemo, useRef } from 'react';
import { masterAPI, hppAPI, productsAPI } from '../services/api';
import { getCurrentUser } from '../utils/auth';
import AWN from 'awesome-notifications';
import 'awesome-notifications/dist/style.css';
import '../styles/HargaBahan.css';
import { Plus, Search, Filter, Edit, Trash2, Package, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X, Check, Upload, Download, DollarSign, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';
import LoadingSpinner from '../components/LoadingSpinner';
import AffectedProductsModal from '../components/AffectedProductsModal';

// Initialize awesome-notifications
const notifier = new AWN({
  position: 'top-right',
  durations: {
    global: 5000
  }
});

const HargaBahan = () => {
  const [materialData, setMaterialData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [paginatedData, setPaginatedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Ingredients');
  const [selectedPeriode, setSelectedPeriode] = useState(new Date().getFullYear().toString());
  const [periodeLoaded, setPeriodeLoaded] = useState(false); // Prevent race condition with default year
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50); // Show only 50 items per page

  // Sorting states
  const [sortColumn, setSortColumn] = useState('itemId');
  const [sortDirection, setSortDirection] = useState('asc');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [availableItems, setAvailableItems] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [units, setUnits] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // Search states for modal inputs
  const [itemIdSearch, setItemIdSearch] = useState('');
  const [itemNameSearch, setItemNameSearch] = useState('');
  const [showItemIdDropdown, setShowItemIdDropdown] = useState(false);
  const [showItemNameDropdown, setShowItemNameDropdown] = useState(false);

  // Refs for click outside detection
  const itemIdRef = useRef(null);
  const itemNameRef = useRef(null);

  // Import states
  const [importPreviewData, setImportPreviewData] = useState([]);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [showFormatModal, setShowFormatModal] = useState(false); // For Bahan Kemas format modal
  const [showBahanBakuFormatModal, setShowBahanBakuFormatModal] = useState(false); // For Bahan Baku format modal
  const [showExportWarningModal, setShowExportWarningModal] = useState(false); // For export warning modal
  const [importPeriode, setImportPeriode] = useState(new Date().getFullYear().toString());
  const [exportPeriode, setExportPeriode] = useState(new Date().getFullYear().toString());
  
  // Import pagination states
  const [importCurrentPage, setImportCurrentPage] = useState(1);
  const [importItemsPerPage] = useState(20); // Fixed at 20 items per page
  const [importType, setImportType] = useState(''); // 'bahan-baku' or 'bahan-kemas'

  // Update Harga Bahan states
  const [showUpdateHargaModal, setShowUpdateHargaModal] = useState(false);
  const [selectedMaterialsForUpdate, setSelectedMaterialsForUpdate] = useState([]);
  const [updatePeriode, setUpdatePeriode] = useState(new Date().getFullYear().toString());
  const [updateMaterialsData, setUpdateMaterialsData] = useState([]);
  const [updateSearchTerm, setUpdateSearchTerm] = useState('');
  const [updateModalCurrentPage, setUpdateModalCurrentPage] = useState(1);
  const [updateModalItemsPerPage] = useState(50); // Show 50 items per page

  // Pending Updates states
  const [showPendingUpdatesModal, setShowPendingUpdatesModal] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState([]);
  const [loadingPendingUpdates, setLoadingPendingUpdates] = useState(false);
  const [expandedUpdateGroups, setExpandedUpdateGroups] = useState(new Set());
  const [confirmingUpdate, setConfirmingUpdate] = useState(null); // Track which group is being confirmed
  const [confirmingAll, setConfirmingAll] = useState(false); // Track if confirming all updates
  
  // Affected Products Modal states
  const [showAffectedModal, setShowAffectedModal] = useState(false);
  const [selectedUpdateDescription, setSelectedUpdateDescription] = useState('');
  const [selectedUpdateDate, setSelectedUpdateDate] = useState('');

  // Check if user can confirm price updates (PL department with PL job level, or NT department)
  const canConfirmPriceUpdate = () => {
    const currentUser = getCurrentUser();
    if (!currentUser) return false;
    
    // PL department with PL job level
    if (currentUser.empDeptID === 'PL' && currentUser.empJobLevelID === 'PL') {
      return true;
    }
    
    // NT department (temporary access)
    if (currentUser.empDeptID === 'NT') {
      return true;
    }
    
    return false;
  };

  // Fetch default year on component mount
  useEffect(() => {
    const fetchDefaultYear = async () => {
      try {
        const response = await productsAPI.getDefaultYear();
        if (response.success && response.data?.defaultYear) {
          const defaultYear = response.data.defaultYear;
          setSelectedPeriode(defaultYear);
          setUpdatePeriode(defaultYear);
          setImportPeriode(defaultYear);
          setExportPeriode(defaultYear);
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


  // Memoized filtered results (more performant than useEffect)
  const filteredItemIds = useMemo(() => {
    if (availableItems.length === 0) return [];
    
    return itemIdSearch.length > 0 
      ? availableItems.filter(item => 
          item.Item_ID.toLowerCase().includes(itemIdSearch.toLowerCase())
        )
      : availableItems;
  }, [availableItems, itemIdSearch]);

  const filteredItemNames = useMemo(() => {
    if (availableItems.length === 0) return [];
    
    return itemNameSearch.length > 0
      ? availableItems.filter(item => 
          item.Item_Name.toLowerCase().includes(itemNameSearch.toLowerCase())
        )
      : availableItems;
  }, [availableItems, itemNameSearch]);
  
  // Form states
  const [formData, setFormData] = useState({
    itemId: '',
    itemName: '',
    itemType: 'BB', // Default to Bahan Baku
    unit: '',
    price: '',
    currency: 'IDR',
    rate: 1
  });

  // Generate year options for periode selector (current year ± 2 years)
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 2; i <= currentYear + 2; i++) {
      years.push(i);
    }
    return years;
  };

  useEffect(() => {
    if (!periodeLoaded) return; // Don't fetch until default year is loaded
    fetchAllData();
  }, [selectedPeriode, periodeLoaded]);

  useEffect(() => {
    filterData();
  }, [materialData, searchTerm, selectedCategory, sortColumn, sortDirection]);

  useEffect(() => {
    paginateData();
  }, [filteredData, currentPage]);

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

  useEffect(() => {
    // Reset update modal pagination when search term changes
    setUpdateModalCurrentPage(1);
  }, [updateSearchTerm]);

  // Memoized filtered and paginated materials for update modal
  const filteredUpdateMaterials = useMemo(() => {
    if (materialData.length === 0) return [];
    
    const searchLower = updateSearchTerm.toLowerCase();
    return materialData.filter(mat => 
      mat.itemId.toLowerCase().includes(searchLower) ||
      mat.itemName.toLowerCase().includes(searchLower)
    );
  }, [materialData, updateSearchTerm]);

  const paginatedUpdateMaterials = useMemo(() => {
    const startIndex = (updateModalCurrentPage - 1) * updateModalItemsPerPage;
    const endIndex = startIndex + updateModalItemsPerPage;
    return filteredUpdateMaterials.slice(startIndex, endIndex);
  }, [filteredUpdateMaterials, updateModalCurrentPage, updateModalItemsPerPage]);

  const updateModalTotalPages = useMemo(() => {
    return Math.ceil(filteredUpdateMaterials.length / updateModalItemsPerPage);
  }, [filteredUpdateMaterials.length, updateModalItemsPerPage]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (itemIdRef.current && !itemIdRef.current.contains(event.target)) {
        setShowItemIdDropdown(false);
      }
      if (itemNameRef.current && !itemNameRef.current.contains(event.target)) {
        setShowItemNameDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError('');

      // Get current year
      const currentYear = new Date().getFullYear().toString();

      // Fetch all required data
      const [hargaBahanResponse, bahanResponse, currencyResponse] = await Promise.all([
        masterAPI.getHargaBahan(selectedPeriode),
        masterAPI.getBahan(),
        masterAPI.getCurrency()
      ]);

      // Filter currency data for selectedPeriode
      const periodeCurrencies = currencyResponse.filter(curr => curr.Periode === selectedPeriode);
      
      // Create currency lookup map
      const currencyMap = {};
      periodeCurrencies.forEach(curr => {
        currencyMap[curr.Curr_Code] = curr.Kurs;
      });

      // Create bahan lookup map for item names
      const bahanMap = {};
      bahanResponse.forEach(bahan => {
        bahanMap[bahan.Item_ID] = bahan.Item_Name;
      });

      // Combine all data
      const combinedData = hargaBahanResponse.map(item => ({
        pk_id: item.pk_id,
        itemId: item.ITEM_ID || 'N/A',
        itemName: bahanMap[item.ITEM_ID] || item.ITEM_ID || 'Unknown Item', // Use name from bahan API or fallback to ID
        itemType: getTypeDescription(item.ITEM_TYPE),
        unit: item.ITEM_PURCHASE_UNIT || 'N/A',
        price: item.ITEM_PURCHASE_STD_PRICE || 0,
        currency: item.ITEM_CURRENCY || 'IDR',
        rate: currencyMap[item.ITEM_CURRENCY] || item.ITEM_RATE || 1, // Use current rate from currency API or fallback
        lastUpdated: item.updatedAt || item.createdAt || new Date().toISOString(),
        rawType: item.ITEM_TYPE || 'unknown'
      }));

      setMaterialData(combinedData);
    } catch (err) {
      setError('Failed to fetch material data');
      console.error('Error fetching material data:', err);
      notifier.alert('Failed to load material data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getTypeDescription = (type) => {
    if (!type) return 'Tidak Diketahui';
    
    const typeMap = {
      'BB': 'Bahan Baku',
      'BK': 'Bahan Kemas',
      'BP': 'Bahan Pendukung',
      'BJ': 'Barang Jadi',
      // Add more mappings as needed
    };
    return typeMap[type] || type;
  };

  const filterData = () => {
    let filtered = materialData;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.itemId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.itemType.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category (allow "All Ingredients" to show everything)
    if (selectedCategory !== 'All Ingredients') {
      filtered = filtered.filter(item => item.itemType === selectedCategory);
    }

    // Sort the filtered data
    filtered = [...filtered].sort((a, b) => {
      let aValue = a[sortColumn];
      let bValue = b[sortColumn];
      
      // Handle null/undefined values
      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';
      
      // Handle numeric sorting for price and rate columns
      if (sortColumn === 'price' || sortColumn === 'rate') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      } else if (sortColumn === 'lastUpdated') {
        // Handle date sorting
        aValue = new Date(aValue).getTime() || 0;
        bValue = new Date(bValue).getTime() || 0;
      } else {
        // String comparison (case-insensitive)
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredData(filtered);
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  const getSortIcon = (column) => {
    if (sortColumn !== column) {
      return <ChevronDown size={14} className="sort-icon inactive" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp size={14} className="sort-icon active" />
      : <ChevronDown size={14} className="sort-icon active" />;
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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID').format(value);
  };

  // Format date without timezone conversion (treats server date as local time)
  const formatDate = (dateString) => {
    if (!dateString) return '';
    // Parse the date string manually to avoid timezone conversion
    // SQL Server returns format like: "2025-12-04T10:30:00.000Z" or "2025-12-04 10:30:00"
    const cleanDateStr = dateString.replace('T', ' ').replace('Z', '').split('.')[0];
    const [datePart] = cleanDateStr.split(' ');
    const [year, month, day] = datePart.split('-');
    
    // Month names in Indonesian
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthIndex = parseInt(month, 10) - 1;
    
    return `${parseInt(day, 10)} ${monthNames[monthIndex]} ${year}`;
  };

  // Format datetime without timezone conversion (treats server date as local time)
  const formatDateTimeLocal = (dateString) => {
    if (!dateString) return '';
    // Parse the date string manually to avoid timezone conversion
    // SQL Server returns format like: "2025-12-04T10:30:00.000Z" or "2025-12-04 10:30:00"
    const cleanDateStr = dateString.replace('T', ' ').replace('Z', '').split('.')[0];
    const [datePart, timePart] = cleanDateStr.split(' ');
    const [year, month, day] = datePart.split('-');
    const [hour, minute] = (timePart || '00:00').split(':');
    
    // Format as DD/MM/YYYY HH:mm
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  };

  const getUniqueCategories = () => {
    const categories = ['All Ingredients', ...new Set(materialData.map(item => item.itemType))];
    return categories;
  };

  const handleAddMaterial = async () => {
    setModalMode('add');
    setEditingItem(null);
    setShowModal(true);
    setModalLoading(true);
    
    try {
      // Fetch currencies for selectedPeriode
      const currencyResponse = await masterAPI.getCurrency();
      const periodeCurrencies = currencyResponse.filter(curr => curr.Periode === selectedPeriode);
      setCurrencies(periodeCurrencies);
      
      // Fetch units
      const unitsResponse = await masterAPI.getUnit();
      setUnits(unitsResponse);
      
      // Find available items that don't have prices set yet
      const allItems = await masterAPI.getBahan();
      const existingHargaBahan = await masterAPI.getHargaBahan(selectedPeriode);
      
      // Get list of item IDs that already have prices for the selected periode
      const existingItemIds = new Set(existingHargaBahan.map(item => item.ITEM_ID));
      
      // Filter out items that already have prices
      const availableForPricing = allItems.filter(item => !existingItemIds.has(item.Item_ID));
      
      setAvailableItems(availableForPricing);
      
      // Set default currency rate
      const defaultCurrency = currentYearCurrencies.find(curr => curr.Curr_Code === 'IDR');
      if (defaultCurrency) {
        setFormData(prev => ({ ...prev, rate: defaultCurrency.Kurs }));
      }
      
    } catch (error) {
      console.error('Error loading modal data:', error);
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateHargaBahan = () => {
    setUpdatePeriode(selectedPeriode);
    setSelectedMaterialsForUpdate([]);
    setUpdateSearchTerm('');
    setUpdateModalCurrentPage(1); // Reset pagination
    setShowUpdateHargaModal(true);
  };

  const handleGeneratePriceUpdate = async () => {
    // Validate selected materials
    if (selectedMaterialsForUpdate.length === 0) {
      notifier.alert('Please select at least one material to update.');
      return;
    }

    // Validate that all materials have valid new prices
    const invalidMaterials = selectedMaterialsForUpdate.filter(
      material => !material.newPrice || material.newPrice <= 0
    );

    if (invalidMaterials.length > 0) {
      notifier.alert('Please enter valid new prices for all selected materials.');
      return;
    }

    setSubmitLoading(true);

    try {
      // Prepare material price changes array
      const materialPriceChanges = selectedMaterialsForUpdate.map(material => ({
        materialId: material.itemId,
        newPrice: material.newPrice
      }));

      console.log('Sending price update simulation:', {
        materialPriceChanges,
        periode: updatePeriode
      });

      // Call the API
      const result = await hppAPI.generatePriceUpdateSimulation(
        materialPriceChanges,
        updatePeriode
      );

      console.log('Price update simulation result:', result);

      // Show success message
      notifier.success(`Price update simulation generated successfully for ${selectedMaterialsForUpdate.length} material(s)!`);

      // Close modal and reset
      setShowUpdateHargaModal(false);
      setSelectedMaterialsForUpdate([]);
      setUpdateSearchTerm('');
      setUpdateModalCurrentPage(1);

      // TODO: Phase 2 - Navigate to simulation results or show affected products modal

    } catch (error) {
      console.error('Error generating price update simulation:', error);
      notifier.alert('Failed to generate price update simulation: ' + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  // Load pending updates from simulation table
  const loadPendingUpdates = async () => {
    setLoadingPendingUpdates(true);
    try {
      const response = await hppAPI.getSimulationList();
      const simulations = response.data || [];
      
      // Filter for Price Update type simulations
      const priceUpdates = simulations.filter(sim => sim.Simulasi_Type === 'Price Update');
      
      setPendingUpdates(priceUpdates);
      console.log('Loaded pending updates:', priceUpdates.length);
    } catch (error) {
      console.error('Error loading pending updates:', error);
      notifier.alert('Failed to load pending updates: ' + error.message);
    } finally {
      setLoadingPendingUpdates(false);
    }
  };

  // Handle opening pending updates modal
  const handleOpenPendingUpdates = async () => {
    setShowPendingUpdatesModal(true);
    await loadPendingUpdates();
  };

  // Group pending updates by description (similar to price changes grouping)
  const groupedPendingUpdates = useMemo(() => {
    const groups = {};
    
    pendingUpdates.forEach(update => {
      const description = update.Simulasi_Deskripsi || 'No Description';
      
      if (!groups[description]) {
        groups[description] = [];
      }
      
      groups[description].push(update);
    });
    
    return groups;
  }, [pendingUpdates]);

  // Toggle group expansion
  const toggleUpdateGroup = (description) => {
    setExpandedUpdateGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(description)) {
        newSet.delete(description);
      } else {
        newSet.add(description);
      }
      return newSet;
    });
  };

  // Delete a pending update group
  const handleDeleteUpdateGroup = async (description) => {
    if (!confirm(`Are you sure you want to delete all simulations in this group?\n\nGroup: ${description}\n\nThis will delete ${groupedPendingUpdates[description].length} simulation(s).`)) {
      return;
    }

    try {
      const updateIds = groupedPendingUpdates[description].map(u => u.Simulasi_ID);
      
      // Delete each simulation
      for (const id of updateIds) {
        await hppAPI.deleteSimulation(id);
      }

      notifier.success(`Successfully deleted ${updateIds.length} pending update simulation(s)`);
      
      // Reload pending updates
      await loadPendingUpdates();
    } catch (error) {
      console.error('Error deleting update group:', error);
      notifier.alert('Failed to delete update group: ' + error.message);
    }
  };

  // Parse description to extract material price changes
  // Format: "Price Update : IN 009: 24.2 -> 30; IN 010: 28.6 -> 31; "
  // Returns: "IN 009:30#IN 010:31"
  const parseDescriptionForCommit = (description) => {
    try {
      // Remove "Price Update : " prefix
      const content = description.replace(/^Price Update\s*:\s*/i, '');
      
      // Split by semicolon and filter empty entries
      const entries = content.split(';').filter(e => e.trim());
      
      // Parse each entry: "IN 009: 24.2 -> 30" => "IN 009:30"
      const parsed = entries.map(entry => {
        const trimmed = entry.trim();
        // Match pattern: "ITEM_ID: oldPrice -> newPrice"
        const match = trimmed.match(/^(.+?):\s*[\d.,]+\s*->\s*([\d.,]+)\s*$/);
        if (match) {
          const itemId = match[1].trim();
          const newPrice = match[2].trim();
          return `${itemId}:${newPrice}`;
        }
        return null;
      }).filter(Boolean);
      
      return parsed.join('#');
    } catch (error) {
      console.error('Error parsing description:', error);
      return null;
    }
  };

  // Confirm a single price update group
  const handleConfirmUpdateGroup = async (description, event) => {
    if (event) event.stopPropagation();
    
    if (!canConfirmPriceUpdate()) {
      notifier.warning('You do not have permission to confirm price updates');
      return;
    }
    
    const updates = groupedPendingUpdates[description];
    if (!updates || updates.length === 0) {
      notifier.alert('No updates found for this group');
      return;
    }
    
    const firstUpdate = updates[0];
    const periode = firstUpdate?.Periode;
    
    if (!periode) {
      notifier.alert('Could not determine the periode for this update');
      return;
    }
    
    // Parse the description to get the parameter string
    const parameterString = parseDescriptionForCommit(description);
    if (!parameterString) {
      notifier.alert('Could not parse the price update description');
      return;
    }
    
    // Confirm with user
    if (!confirm(`Are you sure you want to confirm this price update?\n\nGroup: ${description}\nPeriode: ${periode}\n\nThis will update ${updates.length} product(s) and apply the new material prices.`)) {
      return;
    }
    
    setConfirmingUpdate(description);
    
    try {
      // Call the commit API
      const result = await hppAPI.commitPriceUpdate(parameterString, periode);
      
      if (result.success) {
        notifier.success(`Successfully confirmed price update for ${updates.length} product(s)`);
        
        // Delete the simulation records after successful commit
        const updateIds = updates.map(u => u.Simulasi_ID);
        for (const id of updateIds) {
          await hppAPI.deleteSimulation(id);
        }
        
        // Reload pending updates and main data
        await loadPendingUpdates();
        await fetchAllData();
      } else {
        notifier.alert('Failed to confirm price update: ' + (result.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error confirming price update:', error);
      notifier.alert('Failed to confirm price update: ' + error.message);
    } finally {
      setConfirmingUpdate(null);
    }
  };

  // Confirm all pending price updates
  const handleConfirmAllUpdates = async () => {
    if (!canConfirmPriceUpdate()) {
      notifier.warning('You do not have permission to confirm price updates');
      return;
    }
    
    const groupDescriptions = Object.keys(groupedPendingUpdates);
    if (groupDescriptions.length === 0) {
      notifier.warning('No pending updates to confirm');
      return;
    }
    
    // Confirm with user
    if (!confirm(`Are you sure you want to confirm ALL ${groupDescriptions.length} price update group(s)?\n\nThis will update ${pendingUpdates.length} product(s) total and apply all new material prices.\n\nThis action cannot be undone.`)) {
      return;
    }
    
    setConfirmingAll(true);
    let successCount = 0;
    let failCount = 0;
    
    try {
      for (const description of groupDescriptions) {
        const updates = groupedPendingUpdates[description];
        const firstUpdate = updates[0];
        const periode = firstUpdate?.Periode;
        
        if (!periode) {
          console.error(`Skipping group "${description}" - no periode found`);
          failCount++;
          continue;
        }
        
        const parameterString = parseDescriptionForCommit(description);
        if (!parameterString) {
          console.error(`Skipping group "${description}" - could not parse description`);
          failCount++;
          continue;
        }
        
        try {
          const result = await hppAPI.commitPriceUpdate(parameterString, periode);
          
          if (result.success) {
            // Delete the simulation records after successful commit
            const updateIds = updates.map(u => u.Simulasi_ID);
            for (const id of updateIds) {
              await hppAPI.deleteSimulation(id);
            }
            successCount++;
          } else {
            console.error(`Failed to confirm group "${description}":`, result.message);
            failCount++;
          }
        } catch (groupError) {
          console.error(`Error confirming group "${description}":`, groupError);
          failCount++;
        }
      }
      
      if (successCount > 0 && failCount === 0) {
        notifier.success(`Successfully confirmed all ${successCount} price update group(s)`);
      } else if (successCount > 0 && failCount > 0) {
        notifier.warning(`Confirmed ${successCount} group(s), but ${failCount} group(s) failed`);
      } else {
        notifier.alert(`Failed to confirm any price updates`);
      }
      
      // Reload data
      await loadPendingUpdates();
      await fetchAllData();
      
    } catch (error) {
      console.error('Error confirming all updates:', error);
      notifier.alert('Failed to confirm updates: ' + error.message);
    } finally {
      setConfirmingAll(false);
    }
  };

  // Open affected products modal for price update
  const handleShowAffectedProducts = (description, simulasiDate, event) => {
    if (event) event.stopPropagation();
    setSelectedUpdateDescription(description);
    setSelectedUpdateDate(simulasiDate);
    setShowAffectedModal(true);
  };

  // Close affected products modal
  const handleCloseAffectedModal = () => {
    setShowAffectedModal(false);
    setSelectedUpdateDescription('');
    setSelectedUpdateDate('');
  };

  const handleImportMaterial = () => {
    // Show Bahan Baku format information modal first
    setImportPeriode(selectedPeriode); // Default to current viewing year
    setShowBahanBakuFormatModal(true);
  };

  const proceedWithBahanBakuImport = () => {
    setShowBahanBakuFormatModal(false);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xls,.xlsx';
    input.onchange = handleFileUpload;
    input.click();
  };

  const handleImportBahanKemas = () => {
    // Show format information modal first
    setImportPeriode(selectedPeriode); // Default to current viewing year
    setShowFormatModal(true);
  };

  const proceedWithBahanKemasImport = () => {
    setShowFormatModal(false);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xls,.xlsx';
    input.onchange = handleBahanKemasFileUpload;
    input.click();
  };

  const handleBahanKemasFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImportLoading(true);
    setImportType('bahan-kemas'); // Set import type for Bahan Kemas
    
    try {
      // Step 1: Read and extract data from Excel
      const data = await readExcelFile(file);
      const extractedData = extractBahanKemasColumns(data);
      
      if (extractedData.length === 0) {
        notifier.alert('No valid Bahan Kemas data found in the Excel file');
        return;
      }
      
      console.log('=== BAHAN KEMAS AUTO-PROCESSING ===');
      notifier.info(`Extracted ${extractedData.length} records. Processing duplicates...`);
      
      // Step 2: Automatically process the data (normalize codes, handle duplicates)
      const currencyData = await masterAPI.getCurrency();
      const currentYear = new Date().getFullYear().toString();
      const currentYearCurrency = currencyData.filter(curr => curr.Periode === currentYear);
      
      const processedData = await processBahanKemasData(extractedData, currentYearCurrency);
      
      // Step 3: Show processed results
      setImportPreviewData(processedData);
      setImportCurrentPage(1); // Reset to first page
      setShowImportPreview(true);
      
      const duplicateCount = processedData.filter(item => item.isDuplicate).length;
      const totalRemoved = extractedData.length - processedData.length;
      
      if (duplicateCount > 0) {
        notifier.success(`Processing completed! ${processedData.length} items ready for import (${duplicateCount} duplicates resolved, ${totalRemoved} lower-priced items removed)`);
      } else {
        notifier.success(`Processing completed! ${processedData.length} Bahan Kemas items ready for import (no duplicates found)`);
      }
      
    } catch (error) {
      console.error('Error processing Bahan Kemas Excel file:', error);
      notifier.alert('Error processing Excel file. Please check the file format and ensure it follows the required structure.');
    } finally {
      setImportLoading(false);
    }
  };

  const extractBahanKemasColumns = (data) => {
    if (!data || data.length === 0) return [];
    
    console.log('=== BAHAN KEMAS IMPORT STRUCTURE ===');
    console.log('New Excel format (starting from row 2):');
    console.log('Column A: Item Type (must be "Bahan Kemas")');
    console.log('Column B: Item ID');
    console.log('Column D: Item Name (display only)');
    console.log('Column E: Item PRC ID');
    console.log('Column AB: Item Purchase Unit');
    console.log('Column AD: Item Currency');
    console.log('Column AE: Item Purchase Standard Price');
    console.log('=====================================');
    
    // Skip header row (row 1), start from row 2 (index 1)
    const extractedData = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      // Extract data from specific columns based on new format (same as Bahan Baku)
      const itemType = row[0] ? row[0].toString().trim() : ''; // Column A
      const itemId = row[1] ? row[1].toString().trim() : ''; // Column B
      const itemName = row[3] ? row[3].toString().trim() : ''; // Column D (index 3) - For display only
      const itemPrcId = row[4] ? row[4].toString().trim() : ''; // Column E (index 4)
      const itemPurchaseUnit = row[27] ? row[27].toString().trim() : ''; // Column AB (index 27)
      const itemCurrency = row[29] ? row[29].toString().trim() : ''; // Column AD (index 29)
      const itemPurchasePrice = row[30] ? row[30] : ''; // Column AE (index 30)
      
      // Only validate Item ID and Item Type - skip empty or invalid entries
      if (!itemId) continue;
      
      // Validate that Item Type is "Bahan Kemas" (case insensitive)
      if (itemType.toLowerCase() !== 'bahan kemas') {
        console.warn(`Row ${i + 1}: Invalid item type "${itemType}" - expected "Bahan Kemas". Skipping row.`);
        continue;
      }
      
      // Handle invalid or null price - set to 0 (same as Bahan Baku)
      let processedPrice = 0;
      if (itemPurchasePrice !== null && itemPurchasePrice !== undefined && itemPurchasePrice !== '') {
        const parsedPrice = parseFloat(itemPurchasePrice);
        if (!isNaN(parsedPrice) && parsedPrice >= 0) {
          processedPrice = parsedPrice;
        }
      }
      
      // Validate and handle invalid ITEM_PURCHASE_UNIT (same as Bahan Baku)
      let processedUnit = itemPurchaseUnit;
      if (!itemPurchaseUnit || 
          itemPurchaseUnit.toString().trim() === '' ||
          /^\d+$/.test(itemPurchaseUnit.toString().trim()) || // Pure number
          itemPurchaseUnit.toString().toLowerCase() === 'null' ||
          itemPurchaseUnit.toString().toLowerCase() === 'undefined' ||
          itemPurchaseUnit.toString().toLowerCase() === '(none)' ||
          itemPurchaseUnit.toString().toLowerCase() === 'none') {
        
        console.warn(`Row ${i + 1}: Invalid unit "${itemPurchaseUnit}" detected. Setting to null for manual review.`);
        processedUnit = null;
      }
      
      const rowData = {
        rowNumber: i + 1,
        itemType: itemType,
        itemId: itemId,
        itemName: itemName, // Column D - For display only
        itemPrcId: itemPrcId,
        itemPurchaseUnit: processedUnit,
        itemCurrency: itemCurrency,
        itemPurchasePrice: processedPrice,
        
        // Legacy field mapping for compatibility with existing processing logic
        itemCode: itemId,
        principle: itemPrcId,
        unit: processedUnit,
        currency: itemCurrency,
        price: processedPrice,
        
        // Database field mapping
        ITEM_ID: itemId,
        ITEM_TYPE: 'BK', // Convert "Bahan Kemas" to "BK"
        ITEM_PURCHASE_UNIT: processedUnit,
        ITEM_PURCHASE_STD_PRICE: processedPrice,
        ITEM_CURRENCY: itemCurrency,
        ITEM_PRC_ID: itemPrcId,
        
        // Validation flags for review (same as Bahan Baku)
        hasInvalidUnit: processedUnit === null,
        hasZeroPrice: processedPrice === 0
      };
      
      extractedData.push(rowData);
    }
    
    console.log(`Extracted ${extractedData.length} valid Bahan Kemas records`);
    console.log('Sample extracted data:', extractedData.slice(0, 3));
    return extractedData;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImportLoading(true);
    setImportType('bahan-baku'); // Set import type for Bahan Baku
    
    try {
      // Step 1: Read and extract data from Excel
      const data = await readExcelFile(file);
      const extractedData = extractRequiredColumns(data);
      
      if (extractedData.length === 0) {
        notifier.alert('No valid data found in the Excel file');
        return;
      }
      
      console.log('=== BAHAN BAKU AUTO-PROCESSING ===');
      notifier.info(`Extracted ${extractedData.length} records. Processing duplicates...`);
      
      // Step 2: Automatically process the data (normalize codes, handle duplicates)
      const [manufacturingItems, currencyData] = await Promise.all([
        masterAPI.getManufacturingItems(),
        masterAPI.getCurrency()
      ]);
      
      const currentYear = new Date().getFullYear().toString();
      const currentYearCurrency = currencyData.filter(curr => curr.Periode === currentYear);
      
      const processedData = await processImportData(extractedData, manufacturingItems, currentYearCurrency);
      
      // Step 3: Validate all items are BB (Bahan Baku) type
      const nonBBItems = processedData.filter(item => item.itemType !== 'BB');
      if (nonBBItems.length > 0) {
        console.warn('Non-BB items found:', nonBBItems);
        notifier.alert(`Import failed: Found ${nonBBItems.length} items that are not Bahan Baku (BB). Only BB items can be imported.`);
        return;
      }
      
      // Step 4: Show processed results
      setImportPreviewData(processedData);
      setImportCurrentPage(1); // Reset to first page
      setShowImportPreview(true);
      
      const duplicateCount = processedData.filter(item => item.isDuplicate).length;
      const totalRemoved = extractedData.length - processedData.length;
      
      if (duplicateCount > 0) {
        notifier.success(`Processing completed! ${processedData.length} items ready for import (${duplicateCount} duplicates resolved, ${totalRemoved} lower-priced items removed)`);
      } else {
        notifier.success(`Processing completed! ${processedData.length} Bahan Baku items ready for import (no duplicates found)`);
      }
      
    } catch (error) {
      console.error('Error processing Excel file:', error);
      notifier.alert('Error processing Excel file. Please check the file format.');
    } finally {
      setImportLoading(false);
    }
  };

  const readExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          console.log('Available sheets:', workbook.SheetNames);
          
          let selectedSheetName;
          
          // Check if there's a sheet named "First Sheet"
          if (workbook.SheetNames.includes('First Sheet')) {
            selectedSheetName = 'First Sheet';
            console.log('Using sheet: "First Sheet" (found by name)');
          } else {
            // Use the first available sheet (active sheet)
            selectedSheetName = workbook.SheetNames[0];
            console.log(`Using sheet: "${selectedSheetName}" (first/active sheet)`);
          }
          
          const worksheet = workbook.Sheets[selectedSheetName];
          
          // Convert to JSON with header row included
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          console.log(`Sheet "${selectedSheetName}" contains ${jsonData.length} rows`);
          
          resolve(jsonData);
          
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const extractRequiredColumns = (data) => {
    if (!data || data.length === 0) return [];
    
    console.log('=== BAHAN BAKU IMPORT STRUCTURE ===');
    console.log('New Excel format (starting from row 2):');
    console.log('Column A: Item Type (must be "Bahan Baku")');
    console.log('Column B: Item ID');
    console.log('Column D: Item Name (display only)');
    console.log('Column E: Item PRC ID');
    console.log('Column AB: Item Purchase Unit');
    console.log('Column AD: Item Currency');
    console.log('Column AE: Item Purchase Standard Price');
    console.log('=====================================');
    
    // Skip header row (row 1), start from row 2 (index 1)
    const extractedData = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      // Extract data from specific columns based on new format
      const itemType = row[0] ? row[0].toString().trim() : ''; // Column A
      const itemId = row[1] ? row[1].toString().trim() : ''; // Column B
      const itemName = row[3] ? row[3].toString().trim() : ''; // Column D (index 3) - For display only
      const itemPrcId = row[4] ? row[4].toString().trim() : ''; // Column E (index 4)
      const itemPurchaseUnit = row[27] ? row[27].toString().trim() : ''; // Column AB (index 27)
      const itemCurrency = row[29] ? row[29].toString().trim() : ''; // Column AD (index 29)
      const itemPurchasePrice = row[30] ? row[30] : ''; // Column AE (index 30)
      
      // Only validate Item ID and Item Type - skip empty or invalid entries
      if (!itemId) continue;
      
      // Validate that Item Type is "Bahan Baku" (case insensitive)
      if (itemType.toLowerCase() !== 'bahan baku') {
        console.warn(`Row ${i + 1}: Invalid item type "${itemType}" - expected "Bahan Baku". Skipping row.`);
        continue;
      }
      
      // Handle invalid or null price - set to 0
      let processedPrice = 0;
      if (itemPurchasePrice !== null && itemPurchasePrice !== undefined && itemPurchasePrice !== '') {
        const parsedPrice = parseFloat(itemPurchasePrice);
        if (!isNaN(parsedPrice) && parsedPrice >= 0) {
          processedPrice = parsedPrice;
        }
      }
      
      // Validate and handle invalid ITEM_PURCHASE_UNIT
      let processedUnit = itemPurchaseUnit;
      if (!itemPurchaseUnit || 
          itemPurchaseUnit.toString().trim() === '' ||
          /^\d+$/.test(itemPurchaseUnit.toString().trim()) || // Pure number
          itemPurchaseUnit.toString().toLowerCase() === 'null' ||
          itemPurchaseUnit.toString().toLowerCase() === 'undefined' ||
          itemPurchaseUnit.toString().toLowerCase() === '(none)' ||
          itemPurchaseUnit.toString().toLowerCase() === 'none') {
        
        console.warn(`Row ${i + 1}: Invalid unit "${itemPurchaseUnit}" detected. Setting to null for manual review.`);
        processedUnit = null;
      }
      
      const rowData = {
        rowNumber: i + 1,
        itemType: itemType,
        itemId: itemId,
        itemName: itemName, // Column D - For display only
        itemPrcId: itemPrcId,
        itemPurchaseUnit: processedUnit,
        itemCurrency: itemCurrency,
        itemPurchasePrice: processedPrice,
        
        // Legacy field mapping for compatibility with existing processing logic
        kode: itemId,
        kodePrinciple: itemPrcId,
        unitTerakhirPo: processedUnit,
        kurs: itemCurrency,
        estimasiHarga: processedPrice,
        
        // Database field mapping
        ITEM_ID: itemId,
        ITEM_TYPE: 'BB', // Convert "Bahan Baku" to "BB"
        ITEM_PURCHASE_UNIT: processedUnit,
        ITEM_PURCHASE_STD_PRICE: processedPrice,
        ITEM_CURRENCY: itemCurrency,
        ITEM_PRC_ID: itemPrcId,
        
        // Validation flags for review
        hasInvalidUnit: processedUnit === null,
        hasZeroPrice: processedPrice === 0
      };
      
      extractedData.push(rowData);
    }
    
    console.log(`Extracted ${extractedData.length} valid Bahan Baku records`);
    console.log('Sample extracted data:', extractedData.slice(0, 3));
    return extractedData;
  };

  const handleProcessImport = async () => {
    setImportLoading(true);
    
    try {
      // Step 1: Fetch manufacturing items and currency data
      const [manufacturingItems, currencyData] = await Promise.all([
        masterAPI.getManufacturingItems(),
        masterAPI.getCurrency()
      ]);
      
      // Filter currency data for current year (2025)
      const currentYear = new Date().getFullYear().toString();
      const currentYearCurrency = currencyData.filter(curr => curr.Periode === currentYear);
      
      console.log('Manufacturing items:', manufacturingItems);
      console.log('Current year currency:', currentYearCurrency);
      
      // Step 2: Process import data with duplicate detection and price calculation
      const processedData = await processImportData(importPreviewData, manufacturingItems, currentYearCurrency);
      
      console.log('Processed data:', processedData);
      
      // Step 3: Validate all items are BB (Bahan Baku) type
      const nonBBItems = processedData.filter(item => item.itemType !== 'BB');
      if (nonBBItems.length > 0) {
        console.warn('Non-BB items found:', nonBBItems);
        notifier.alert(`Import failed: Found ${nonBBItems.length} items that are not Bahan Baku (BB). Only BB items can be imported.`);
        return;
      }
      
      // Step 4: Update the preview table with processed data and reset pagination
      setImportPreviewData(processedData);
      setImportCurrentPage(1); // Reset to first page
      notifier.success(`Processing completed! ${processedData.length} Bahan Baku items ready for import.`);
      
    } catch (error) {
      console.error('Error processing import:', error);
      notifier.alert('Error processing import data: ' + error.message);
    } finally {
      setImportLoading(false);
    }
  };

  const handleFinalImport = async () => {
    setImportLoading(true);
    
    try {
      // Map the processed data to the required format
      const mappedData = importPreviewData.map((item, index) => {
        // Handle price conversion - only parse if not empty/null
        let price = null;
        if (item.finalPrice !== null && item.finalPrice !== undefined && item.finalPrice !== '') {
          price = parseFloat(item.finalPrice);
        } else if (item.estimasiHarga !== null && item.estimasiHarga !== undefined && item.estimasiHarga !== '') {
          price = parseFloat(item.estimasiHarga);
        }
        
        const mapped = {
          ITEM_ID: item.kode,
          ITEM_TYPE: 'BB', // Fixed: should be 'BB' not item.itemType
          ITEM_PURCHASE_UNIT: item.finalUnit || item.unitTerakhirPo || null,
          ITEM_PURCHASE_STD_PRICE: price,
          ITEM_CURRENCY: item.finalCurrency || item.kurs || null,
          ITEM_PRC_ID: item.kodePrinciple || null,
          user_id: 'SYSTEM',
          delegated_to: 'SYSTEM'
        };
        
        // Debug each item mapping
        console.log(`=== MAPPING DEBUG - Item ${index + 1} ===`);
        console.log('Original item:', {
          kode: item.kode,
          itemType: item.itemType,
          unitTerakhirPo: item.unitTerakhirPo,
          finalUnit: item.finalUnit,
          estimasiHarga: item.estimasiHarga,
          finalPrice: item.finalPrice,
          kurs: item.kurs,
          finalCurrency: item.finalCurrency,
          kodePrinciple: item.kodePrinciple
        });
        console.log('Mapped item:', mapped);
        console.log('Validation check:', {
          hasItemId: !!mapped.ITEM_ID,
          isItemTypeBB: mapped.ITEM_TYPE === 'BB',
          priceValue: mapped.ITEM_PURCHASE_STD_PRICE,
          priceType: typeof mapped.ITEM_PURCHASE_STD_PRICE,
          currencyValue: mapped.ITEM_CURRENCY,
          unitValue: mapped.ITEM_PURCHASE_UNIT
        });
        
        return mapped;
      });
      
      console.log('=== FINAL MAPPED DATA SUMMARY ===');
      console.log('Total items:', mappedData.length);
      console.log('First 3 items:', mappedData.slice(0, 3));
      console.log('Items with validation issues (missing ITEM_ID or wrong ITEM_TYPE):', mappedData.filter(item => 
        !item.ITEM_ID || item.ITEM_TYPE !== 'BB'
      ));
      console.log('Items with empty optional fields:', mappedData.filter(item => 
        !item.ITEM_PURCHASE_UNIT || 
        item.ITEM_PURCHASE_STD_PRICE === null || 
        item.ITEM_PURCHASE_STD_PRICE === undefined ||
        !item.ITEM_CURRENCY
      ));
      console.log('================================');
      
      // Call the bulk import API with importPeriode
      const result = await masterAPI.bulkImportBahanBaku(mappedData, importPeriode);
      
      console.log('Import result:', result);
      
      // Show success message and close modal
      notifier.success(`Successfully imported ${result.data.insertedRecords} Bahan Baku items for year ${importPeriode}!`);
      setShowImportPreview(false);
      
      // Refresh the main table data and switch to imported year if different
      if (selectedPeriode !== importPeriode) {
        setSelectedPeriode(importPeriode);
      } else {
        await fetchAllData();
      }
      
    } catch (error) {
      console.error('Error during final import:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Show more detailed error message
      let errorMessage = 'Error importing data';
      if (error.response?.data?.errors) {
        errorMessage += ':\n' + error.response.data.errors.join('\n');
      } else if (error.response?.data?.message) {
        errorMessage += ': ' + error.response.data.message;
      } else {
        errorMessage += ': ' + error.message;
      }
      
      notifier.alert(errorMessage);
    } finally {
      setImportLoading(false);
    }
  };

  const handleBahanKemasFinalImport = async () => {
    setImportLoading(true);
    
    try {
      // Map processed Bahan Kemas data to database format
      const mappedData = importPreviewData.map((item) => {
        // Fix price mapping - handle 0 values correctly (don't treat as falsy)
        let finalPrice = null;
        if (item.ITEM_PURCHASE_STD_PRICE !== undefined && item.ITEM_PURCHASE_STD_PRICE !== null) {
          finalPrice = item.ITEM_PURCHASE_STD_PRICE;
        } else if (item.finalPrice !== undefined && item.finalPrice !== null) {
          finalPrice = item.finalPrice;
        } else if (item.price !== undefined && item.price !== null && item.price !== '') {
          finalPrice = parseFloat(item.price);
        }
        
        // Ensure 0 is preserved as valid price (don't convert to null)
        if (finalPrice !== null && !isNaN(finalPrice)) {
          finalPrice = Number(finalPrice);
        } else {
          finalPrice = null;
        }

        return {
          ITEM_ID: item.ITEM_ID,
          ITEM_TYPE: 'BK', // Always BK for Bahan Kemas
          ITEM_PURCHASE_UNIT: item.ITEM_PURCHASE_UNIT || item.unit || null,
          ITEM_PURCHASE_STD_PRICE: finalPrice,
          ITEM_CURRENCY: item.ITEM_CURRENCY || item.finalCurrency || item.currency || 'IDR',
          ITEM_PRC_ID: item.ITEM_PRC_ID || item.principle || null,
          user_id: 'SYSTEM',
          delegated_to: 'SYSTEM'
          // Note: process_date is intentionally omitted - backend will use local server time
        };
      });
      
      console.log('=== BAHAN KEMAS FINAL IMPORT ===');
      console.log('Total items to import:', mappedData.length);
      console.log('Sample mapped data:', mappedData.slice(0, 3));
      console.log('==================================');
      
      // Call the bulk import API with importPeriode
      const result = await masterAPI.bulkImportBahanKemas(mappedData, importPeriode);
      
      if (result.success) {
        notifier.success(`Successfully imported ${result.data.insertedRecords} Bahan Kemas items for year ${importPeriode}!`);
        setShowImportPreview(false);
        
        // Switch to imported year if different from current view
        if (selectedPeriode !== importPeriode) {
          setSelectedPeriode(importPeriode);
        } else {
          await fetchAllData();
        }
      } else {
        throw new Error(result.message || 'Import failed');
      }
      
    } catch (error) {
      console.error('Error during Bahan Kemas final import:', error);
      notifier.alert('Error importing Bahan Kemas data: ' + error.message);
    } finally {
      setImportLoading(false);
    }
  };

  const processBahanKemasData = async (importData, currencyData) => {
    console.log('=== Starting Bahan Kemas Processing ===');
    console.log('Import data sample (first 3 items):', importData.slice(0, 3));
    
    // Step 1: Normalize item codes (remove .xxx endings)
    const normalizedData = importData.map(item => {
      const normalized = normalizeKode(item.itemId || item.itemCode); // Support both new and legacy field names
      console.log(`Normalizing: "${item.itemId || item.itemCode}" → "${normalized}"`);
      return {
        ...item,
        originalCode: item.itemId || item.itemCode,
        itemId: normalized, // New field name
        itemCode: normalized, // Legacy field name for compatibility
        ITEM_ID: normalized // Update the database field too
      };
    });
    
    // Step 2: Group by normalized code to find duplicates
    const groupedData = {};
    normalizedData.forEach(item => {
      if (!groupedData[item.itemCode]) {
        groupedData[item.itemCode] = [];
      }
      groupedData[item.itemCode].push(item);
    });
    
    console.log('Grouped data keys:', Object.keys(groupedData));
    console.log('Groups with duplicates:', Object.keys(groupedData).filter(key => groupedData[key].length > 1));
    
    // Step 3: Process each group
    const processedGroups = [];
    
    for (const [code, items] of Object.entries(groupedData)) {
      if (items.length === 1) {
        // Single item - mark as processed
        const processedItem = {
          ...items[0],
          isDuplicate: false,
          finalPrice: parseFloat(items[0].price) || 0,
          finalCurrency: items[0].currency,
          finalUnit: items[0].unit
        };
        processedGroups.push(processedItem);
      } else {
        // Multiple items - find highest priced item
        console.log(`Processing ${items.length} duplicates for code: ${code}`);
        const highestPricedItem = await findHighestPricedBahanKemas(items, currencyData);
        if (highestPricedItem) {
          processedGroups.push(highestPricedItem);
        }
      }
    }
    
    // Sort results: duplicates first, then singles
    const sortedResults = processedGroups.sort((a, b) => {
      // Duplicates (isDuplicate: true) should come first
      if (a.isDuplicate && !b.isDuplicate) return -1;
      if (!a.isDuplicate && b.isDuplicate) return 1;
      // Within same type, sort by code alphabetically
      return a.itemCode.localeCompare(b.itemCode);
    });
    
    console.log('Sorted results (duplicates first):', sortedResults.length);
    return sortedResults;
  };

  const findHighestPricedBahanKemas = async (items, currencyData) => {
    const processedItems = [];
    
    for (const item of items) {
      // Calculate normalized price for comparison (convert to IDR)
      const normalizedPrice = await calculateBahanKemasNormalizedPrice(item, currencyData);
      
      processedItems.push({
        ...item,
        originalPrice: parseFloat(item.price) || 0,
        normalizedPrice: normalizedPrice,
        finalUnit: item.unit,
        finalCurrency: item.currency,
        isDuplicate: true
      });
    }
    
    // Find the item with the highest normalized price
    if (processedItems.length === 0) return null;
    
    const highestPricedItem = processedItems.reduce((highest, current) => {
      return current.normalizedPrice > highest.normalizedPrice ? current : highest;
    });
    
    console.log(`Selected highest priced item for ${items[0].itemCode}: ${highestPricedItem.normalizedPrice} IDR (original: ${highestPricedItem.originalPrice} ${highestPricedItem.currency})`);
    
    return {
      ...highestPricedItem,
      finalPrice: highestPricedItem.originalPrice
    };
  };

  const calculateBahanKemasNormalizedPrice = async (item, currencyData) => {
    let price = parseFloat(item.price) || 0;
    const currency = item.currency;
    
    console.log(`Calculating normalized price for: ${price} ${currency}`);
    
    // Convert currency to IDR for comparison
    if (currency && currency.toUpperCase() !== 'IDR') {
      const currencyRate = currencyData.find(c => c.Curr_Code.toUpperCase() === currency.toUpperCase());
      if (currencyRate) {
        price = price * parseFloat(currencyRate.Kurs);
        console.log(`Currency conversion: ${item.price} ${currency} = ${price} IDR (rate: ${currencyRate.Kurs})`);
      } else {
        console.warn(`Currency rate not found for: ${currency}, using original price`);
      }
    }
    
    return price;
  };

  const processImportData = async (importData, manufacturingItems, currencyData) => {
    console.log('=== Starting processImportData ===');
    console.log('Import data sample (first 3 items):', importData.slice(0, 3));
    console.log('Manufacturing items sample (first 5 items):', manufacturingItems.slice(0, 5));
    
    // Step 1: Normalize codes (remove .000 endings)
    const normalizedData = importData.map(item => {
      const normalized = normalizeKode(item.kode);
      console.log(`Normalizing: "${item.kode}" → "${normalized}"`);
      return {
        ...item,
        originalKode: item.kode,
        kode: normalized
      };
    });
    
    // Step 2: Group by normalized kode to find duplicates
    const groupedData = {};
    normalizedData.forEach(item => {
      if (!groupedData[item.kode]) {
        groupedData[item.kode] = [];
      }
      groupedData[item.kode].push(item);
    });
    
    console.log('Grouped data keys:', Object.keys(groupedData));
    
    // Step 3: Process each group
    const processedGroups = [];
    
    for (const [kode, items] of Object.entries(groupedData)) {
      if (items.length === 1) {
        // Single item, just process normally
        const processedItem = await processSingleItem(items[0], manufacturingItems, currencyData);
        if (processedItem) {
          processedGroups.push(processedItem);
        }
      } else {
        // Multiple items, need to find the highest priced one
        console.log(`Found ${items.length} duplicates for kode: ${kode}`);
        const highestPricedItem = await findHighestPricedItem(items, manufacturingItems, currencyData);
        if (highestPricedItem) {
          processedGroups.push(highestPricedItem);
        }
      }
    }
    
    // Sort results: duplicates first, then singles
    const sortedResults = processedGroups.sort((a, b) => {
      // Duplicates (isDuplicate: true) should come first
      if (a.isDuplicate && !b.isDuplicate) return -1;
      if (!a.isDuplicate && b.isDuplicate) return 1;
      // Within same type, sort by kode alphabetically
      return a.kode.localeCompare(b.kode);
    });
    
    console.log('Sorted results (duplicates first):', sortedResults.length);
    return sortedResults;
  };

  const normalizeKode = (kode) => {
    // Remove .### pattern from the end (dot followed by 3 numbers)
    return kode.toString().replace(/\.\d{3}$/, '');
  };

  const processSingleItem = async (item, manufacturingItems, currencyData) => {
    console.log(`\n=== Processing single item ===`);
    console.log(`Looking for kode: "${item.kode}"`);
    console.log(`Original kode was: "${item.originalKode}"`);
    
    // Show available Item_IDs for comparison
    const availableItemIds = manufacturingItems.map(mi => mi.Item_ID).slice(0, 10);
    console.log('Available Item_IDs (first 10):', availableItemIds);
    
    // Find matching manufacturing item
    const manufacturingItem = manufacturingItems.find(mi => mi.Item_ID === item.kode);
    
    if (!manufacturingItem) {
      console.warn(`❌ Manufacturing item not found for kode: "${item.kode}"`);
      
      // Let's check if any Item_ID contains our kode
      const partialMatches = manufacturingItems.filter(mi => 
        mi.Item_ID && mi.Item_ID.includes(item.kode)
      );
      console.log('Partial matches found:', partialMatches.length > 0 ? partialMatches : 'None');
      
      // Check for exact matches with different case
      const caseMatches = manufacturingItems.filter(mi => 
        mi.Item_ID && mi.Item_ID.toLowerCase() === item.kode.toLowerCase()
      );
      console.log('Case-insensitive matches:', caseMatches.length > 0 ? caseMatches : 'None');
      
      return null;
    }
    
    console.log(`✅ Found manufacturing item:`, manufacturingItem);
    
    return {
      ...item,
      itemName: manufacturingItem.Item_Name,
      itemType: manufacturingItem.Item_Type, // BB or BK
      manufacturingUnit: manufacturingItem.Item_Unit,
      itemBJ: manufacturingItem.Item_BJ,
      finalPrice: parseFloat(item.estimasiHarga) || 0,
      finalUnit: item.unitTerakhirPo,
      finalCurrency: item.kurs,
      isDuplicate: false
    };
  };

  const findHighestPricedItem = async (items, manufacturingItems, currencyData) => {
    const processedItems = [];
    
    for (const item of items) {
      const manufacturingItem = manufacturingItems.find(mi => mi.Item_ID === item.kode);
      
      if (!manufacturingItem) {
        console.warn(`Manufacturing item not found for kode: ${item.kode}`);
        continue;
      }
      
      // Calculate normalized price for comparison
      const normalizedPrice = await calculateNormalizedPrice(
        item, 
        manufacturingItem, 
        currencyData
      );
      
      processedItems.push({
        ...item,
        itemName: manufacturingItem.Item_Name,
        itemType: manufacturingItem.Item_Type,
        manufacturingUnit: manufacturingItem.Item_Unit,
        itemBJ: manufacturingItem.Item_BJ,
        originalPrice: parseFloat(item.estimasiHarga) || 0,
        normalizedPrice: normalizedPrice,
        finalUnit: item.unitTerakhirPo,
        finalCurrency: item.kurs,
        isDuplicate: true
      });
    }
    
    // Find the item with the highest normalized price
    if (processedItems.length === 0) return null;
    
    const highestPricedItem = processedItems.reduce((highest, current) => {
      return current.normalizedPrice > highest.normalizedPrice ? current : highest;
    });
    
    console.log(`Selected highest priced item for ${items[0].kode}: ${highestPricedItem.normalizedPrice} (original: ${highestPricedItem.originalPrice})`);
    
    return {
      ...highestPricedItem,
      finalPrice: highestPricedItem.originalPrice
    };
  };

  const calculateNormalizedPrice = async (item, manufacturingItem, currencyData) => {
    let price = parseFloat(item.estimasiHarga) || 0;
    const currency = item.kurs;
    const unit = item.unitTerakhirPo;
    const itemBJ = parseFloat(manufacturingItem.Item_BJ) || 1;
    
    // Step 1: Convert currency to IDR
    if (currency && currency.toUpperCase() !== 'IDR') {
      const currencyRate = currencyData.find(c => c.Curr_Code.toUpperCase() === currency.toUpperCase());
      if (currencyRate) {
        price = price * parseFloat(currencyRate.Kurs);
        console.log(`Currency conversion: ${item.estimasiHarga} ${currency} = ${price} IDR`);
      }
    }
    
    // Step 2: Convert unit to standard (kg for weight, l for volume)
    if (unit) {
      const unitLower = unit.toLowerCase();
      
      // Convert grams to kg
      if (unitLower === 'g' || unitLower === 'gram' || unitLower === 'grams') {
        price = price * 1000; // Price per kg
        console.log(`Unit conversion: g to kg, adjusted price: ${price}`);
      }
      // Convert ml to l
      else if (unitLower === 'ml' || unitLower === 'mililiter') {
        price = price * 1000; // Price per liter
        console.log(`Unit conversion: ml to l, adjusted price: ${price}`);
      }
    }
    
    // Step 3: Handle different unit compositions (kg vs l using specific gravity)
    if (unit) {
      const unitLower = unit.toLowerCase();
      const manufacturingUnitLower = manufacturingItem.Item_Unit ? manufacturingItem.Item_Unit.toLowerCase() : '';
      
      // If item is sold in liters but manufacturing unit is kg (or vice versa)
      if ((unitLower.includes('l') && manufacturingUnitLower.includes('kg')) ||
          (unitLower.includes('liter') && manufacturingUnitLower.includes('kg'))) {
        
        if (itemBJ && itemBJ !== 0) {
          price = price / itemBJ;
          console.log(`Specific gravity conversion: ${price} / ${itemBJ} = ${price / itemBJ}`);
        }
      }
    }
    
    return price;
  };

  const handleModalClose = () => {
    setShowModal(false);
    setModalMode('add');
    setEditingItem(null);
    setFormData({
      itemId: '',
      itemName: '',
      itemType: 'BB',
      unit: '',
      price: '',
      currency: 'IDR',
      rate: 1
    });
    
    // Reset search states
    setItemIdSearch('');
    setItemNameSearch('');
    setShowItemIdDropdown(false);
    setShowItemNameDropdown(false);
  };

  const handleEditMaterial = async (item) => {
    setModalMode('edit');
    setEditingItem(item);
    setShowModal(true);
    setModalLoading(true);
    
    try {
      // Fetch currencies for selectedPeriode
      const currencyResponse = await masterAPI.getCurrency();
      const periodeCurrencies = currencyResponse.filter(curr => curr.Periode === selectedPeriode);
      setCurrencies(periodeCurrencies);
      
      // Fetch units
      const unitsResponse = await masterAPI.getUnit();
      setUnits(unitsResponse);
      
      // For edit mode, we don't need available items since we're editing existing
      setAvailableItems([]);
      
      // Pre-fill form with existing data
      const selectedCurrency = periodeCurrencies.find(curr => curr.Curr_Code === item.currency);
      setFormData({
        itemId: item.itemId,
        itemName: item.itemName,
        itemType: item.rawType || 'BB',
        unit: item.unit,
        price: item.price.toString(),
        currency: item.currency,
        rate: selectedCurrency ? selectedCurrency.Kurs : item.rate
      });
      
      // Set search fields for display (though they'll be readonly in edit mode)
      setItemIdSearch(item.itemId);
      setItemNameSearch(item.itemName);
      
    } catch (error) {
      console.error('Error loading edit modal data:', error);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteMaterial = (item) => {
    setDeletingItem(item);
    setShowDeleteModal(true);
  };

  const handleExportAllMaterials = async () => {
    setShowExportWarningModal(false);
    
    try {
      // Fetch data for the export periode
      let dataToExport = materialData;
      
      // If export periode is different from selected periode, fetch data for export periode
      if (exportPeriode !== selectedPeriode) {
        notifier.info(`Fetching data for year ${exportPeriode}...`);
        const response = await masterAPI.getHargaBahan(exportPeriode);
        dataToExport = response.data || [];
      }
      
      if (dataToExport.length === 0) {
        notifier.warning(`No materials found for year ${exportPeriode}`);
        return;
      }
      
      // Prepare data for export
      const exportData = dataToExport.map(item => ({
        'Item ID': item.itemId || '',
        'Item Name': item.itemName || '',
        'Item Type': item.itemType || '',
        'Raw Type': item.rawType || '',
        'Unit': item.unit || '',
        'Price': item.price || 0,
        'Currency': item.currency || '',
        'Rate': item.rate || 0,
        'Last Updated': item.lastUpdated ? new Date(item.lastUpdated).toLocaleString('id-ID') : ''
      }));

      // Create workbook
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'All Materials');

      // Auto-size columns
      const colWidths = [
        { wch: 15 }, // Item ID
        { wch: 40 }, // Item Name
        { wch: 15 }, // Item Type
        { wch: 10 }, // Raw Type
        { wch: 10 }, // Unit
        { wch: 15 }, // Price
        { wch: 10 }, // Currency
        { wch: 15 }, // Rate
        { wch: 20 }  // Last Updated
      ];
      ws['!cols'] = colWidths;

      // Generate filename with timestamp and year
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `Material_Prices_Export_${exportPeriode}_${timestamp}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      
      notifier.success(`Successfully exported ${exportData.length} materials for year ${exportPeriode} to ${filename}`);
    } catch (error) {
      console.error('Export error:', error);
      notifier.alert('Failed to export materials: ' + error.message);
    }
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Auto-fill related fields
    if (field === 'itemId') {
      const selectedItem = availableItems.find(item => item.Item_ID === value);
      if (selectedItem) {
        setFormData(prev => ({
          ...prev,
          itemId: value,
          itemName: selectedItem.Item_Name
        }));
      }
    }
    
    if (field === 'itemName') {
      const selectedItem = availableItems.find(item => item.Item_Name === value);
      if (selectedItem) {
        setFormData(prev => ({
          ...prev,
          itemId: selectedItem.Item_ID,
          itemName: value
        }));
      }
    }
    
    if (field === 'currency') {
      const selectedCurrency = currencies.find(curr => curr.Curr_Code === value);
      if (selectedCurrency) {
        setFormData(prev => ({
          ...prev,
          currency: value,
          rate: selectedCurrency.Kurs
        }));
      }
    }
  };

  // Handlers for searchable inputs
  const handleItemIdSearch = (value) => {
    setItemIdSearch(value);
    setFormData(prev => ({ ...prev, itemId: value }));
    setShowItemIdDropdown(true);
    
    // Auto-fill item name when typing exact match
    const exactMatch = availableItems.find(item => item.Item_ID === value);
    if (exactMatch) {
      setFormData(prev => ({ ...prev, itemName: exactMatch.Item_Name }));
      setItemNameSearch(exactMatch.Item_Name);
    }
  };

  const handleItemNameSearch = (value) => {
    setItemNameSearch(value);
    setFormData(prev => ({ ...prev, itemName: value }));
    setShowItemNameDropdown(true);
    
    // Auto-fill item ID when typing exact match
    const exactMatch = availableItems.find(item => item.Item_Name === value);
    if (exactMatch) {
      setFormData(prev => ({ ...prev, itemId: exactMatch.Item_ID }));
      setItemIdSearch(exactMatch.Item_ID);
    }
  };

  const handleItemIdSelect = (item) => {
    // Auto-fill from last purchase data if available
    const newFormData = {
      itemId: item.Item_ID,
      itemName: item.Item_Name
    };
    
    // Auto-fill unit if available and valid
    if (item.Item_LastPurchaseUnit && 
        item.Item_LastPurchaseUnit !== '(none)' && 
        item.Item_LastPurchaseUnit !== '(NONE)' &&
        item.Item_LastPurchaseUnit !== 'none') {
      newFormData.unit = item.Item_LastPurchaseUnit;
    }
    
    // Auto-fill currency if available
    if (item.Item_LastPriceCurrency) {
      newFormData.currency = item.Item_LastPriceCurrency;
      
      // Update rate based on selected currency
      const selectedCurrency = currencies.find(curr => curr.Curr_Code === item.Item_LastPriceCurrency);
      if (selectedCurrency) {
        newFormData.rate = selectedCurrency.Kurs;
      }
    }
    
    // Auto-fill price if available and greater than 0
    if (item.Item_LastPrice && item.Item_LastPrice > 0) {
      newFormData.price = item.Item_LastPrice.toString();
    }
    
    setFormData(prev => ({ ...prev, ...newFormData }));
    setItemIdSearch(item.Item_ID);
    setItemNameSearch(item.Item_Name);
    setShowItemIdDropdown(false);
    setShowItemNameDropdown(false);
  };

  const handleItemNameSelect = (item) => {
    // Auto-fill from last purchase data if available
    const newFormData = {
      itemId: item.Item_ID,
      itemName: item.Item_Name
    };
    
    // Auto-fill unit if available and valid
    if (item.Item_LastPurchaseUnit && 
        item.Item_LastPurchaseUnit !== '(none)' && 
        item.Item_LastPurchaseUnit !== '(NONE)' &&
        item.Item_LastPurchaseUnit !== 'none') {
      newFormData.unit = item.Item_LastPurchaseUnit;
    }
    
    // Auto-fill currency if available
    if (item.Item_LastPriceCurrency) {
      newFormData.currency = item.Item_LastPriceCurrency;
      
      // Update rate based on selected currency
      const selectedCurrency = currencies.find(curr => curr.Curr_Code === item.Item_LastPriceCurrency);
      if (selectedCurrency) {
        newFormData.rate = selectedCurrency.Kurs;
      }
    }
    
    // Auto-fill price if available and greater than 0
    if (item.Item_LastPrice && item.Item_LastPrice > 0) {
      newFormData.price = item.Item_LastPrice.toString();
    }
    
    setFormData(prev => ({ ...prev, ...newFormData }));
    setItemIdSearch(item.Item_ID);
    setItemNameSearch(item.Item_Name);
    setShowItemIdDropdown(false);
    setShowItemNameDropdown(false);
  };

  const handleSubmit = async () => {
    try {
      setSubmitLoading(true);
      
      const currentUser = getCurrentUser();
      const submitData = {
        itemId: formData.itemId,
        itemType: formData.itemType,
        unit: formData.unit,
        price: parseFloat(formData.price),
        currency: formData.currency,
        rate: formData.rate,
        userId: currentUser?.logNIK || 'SYSTEM',
        periode: selectedPeriode
      };
      
      if (modalMode === 'edit') {
        await masterAPI.updateHargaBahan(editingItem.pk_id, submitData);
        notifier.success('Material price updated successfully!');
      } else {
        await masterAPI.addHargaBahan(submitData);
        notifier.success('Material price added successfully!');
      }
      
      // Refresh the data
      await fetchAllData();
      
      // Close modal
      handleModalClose();
      
    } catch (error) {
      console.error(`Error ${modalMode === 'edit' ? 'updating' : 'adding'} material:`, error);
      
      // Extract error message from API response if available
      let errorMessage = `Failed to ${modalMode === 'edit' ? 'update' : 'add'} material price`;
      if (error.message && error.message.includes('Missing required fields')) {
        errorMessage = 'Please fill in all required fields';
      } else if (error.message && error.message.includes('Price must be a valid number')) {
        errorMessage = 'Please enter a valid price';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      notifier.alert(errorMessage);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      setSubmitLoading(true);
      await masterAPI.deleteHargaBahan(deletingItem.pk_id);
      
      notifier.success('Material price deleted successfully!');
      
      // Refresh the data
      await fetchAllData();
      
      // Close delete modal
      setShowDeleteModal(false);
      setDeletingItem(null);
      
    } catch (error) {
      console.error('Error deleting material:', error);
      
      // Extract error message from API response if available
      let errorMessage = 'Failed to delete material price';
      if (error.message) {
        errorMessage = error.message;
      }
      
      notifier.alert(errorMessage);
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="harga-bahan-container">
        <LoadingSpinner 
          message="Loading material data..." 
          size="large" 
        />
      </div>
    );
  }

  if (error && materialData.length === 0) {
    return (
      <div className="harga-bahan-container">
        <div className="error-message">
          <Package size={48} />
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
    <div className="harga-bahan-container">
      {/* Header Controls */}
      <div className="page-header">
        {/* Left Section: Search and Filters */}
        <div className="header-left">
          <div className="search-box">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search materials..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="filters-group">
            <div className="period-selector">
              <label htmlFor="periode-select">Year:</label>
              <select 
                id="periode-select"
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

        {/* Right Section: Action Buttons */}
        <div className="header-right">
          <div className="action-buttons-group">
            {/* Import/Export Group */}
            <div className="button-group">
              <button className="import-btn" onClick={handleImportBahanKemas}>
                <Upload size={20} />
                Import Bahan Kemas
              </button>
              
              <button className="import-btn" onClick={handleImportMaterial}>
                <Upload size={20} />
                Import Bahan Baku
              </button>
              
              <button className="export-btn" onClick={() => {
                setExportPeriode(selectedPeriode);
                setShowExportWarningModal(true);
              }}>
                <Download size={20} />
                Export
              </button>
            </div>

            {/* Primary Actions Group */}
            <div className="button-group primary-actions">
              <button className="pending-updates-btn" onClick={handleOpenPendingUpdates}>
                <Package size={20} />
                Pending Updates
              </button>

              <button className="update-harga-btn" onClick={handleUpdateHargaBahan}>
                <DollarSign size={20} />
                Update Harga
              </button>
              
              <button className="add-btn" onClick={handleAddMaterial}>
                <Plus size={20} />
                Tambah Bahan
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="materials-table">
          <thead>
            <tr>
              <th className="sortable-header" onClick={() => handleSort('itemId')}>
                <span>Item ID</span>
                {getSortIcon('itemId')}
              </th>
              <th className="sortable-header" onClick={() => handleSort('itemName')}>
                <span>Item Name</span>
                {getSortIcon('itemName')}
              </th>
              <th className="sortable-header" onClick={() => handleSort('itemType')}>
                <span>Item Type</span>
                {getSortIcon('itemType')}
              </th>
              <th className="sortable-header" onClick={() => handleSort('unit')}>
                <span>Unit</span>
                {getSortIcon('unit')}
              </th>
              <th className="sortable-header" onClick={() => handleSort('price')}>
                <span>Price</span>
                {getSortIcon('price')}
              </th>
              <th className="sortable-header" onClick={() => handleSort('currency')}>
                <span>Currency</span>
                {getSortIcon('currency')}
              </th>
              <th className="sortable-header" onClick={() => handleSort('rate')}>
                <span>Rate</span>
                {getSortIcon('rate')}
              </th>
              <th className="sortable-header" onClick={() => handleSort('lastUpdated')}>
                <span>Last Updated</span>
                {getSortIcon('lastUpdated')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item) => (
              <tr key={item.pk_id}>
                <td className="item-id">{item.itemId}</td>
                <td className="item-name">
                  <div className="name-cell">
                    <span className="name">{item.itemName}</span>
                  </div>
                </td>
                <td>
                  <span className={`type-badge ${item.rawType?.toLowerCase() || 'unknown'}`}>
                    {item.itemType}
                  </span>
                </td>
                <td className="unit">{item.unit}</td>
                <td className="price">
                  {formatCurrency(item.price)}
                </td>
                <td className="currency">{item.currency}</td>
                <td className="rate">{formatCurrency(item.rate)}</td>
                <td className="date">{formatDate(item.lastUpdated)}</td>
                <td className="actions">
                  <button 
                    className="edit-btn"
                    onClick={() => handleEditMaterial(item)}
                    title="Edit Material"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    className="delete-btn"
                    onClick={() => handleDeleteMaterial(item)}
                    title="Delete Material"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredData.length === 0 && !loading && (
          <div className="no-data">
            <Package size={48} />
            <h3>No Materials Found</h3>
            <p>
              {searchTerm
                ? selectedCategory === 'All Ingredients'
                  ? 'No materials match your search.'
                  : `No ${selectedCategory.toLowerCase()} materials match your search.`
                : selectedCategory === 'All Ingredients'
                  ? 'No materials available. Add your first material to get started.'
                  : `No ${selectedCategory.toLowerCase()} materials available.`
              }
            </p>
            <button className="add-btn" onClick={handleAddMaterial}>
              <Plus size={20} />
              Tambah Bahan
            </button>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {filteredData.length > 0 && (
        <div className="pagination-container">
          <div className="pagination-info">
            Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredData.length)} to{' '}
            {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} materials
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
        <span>{filteredData.length} of {materialData.length} materials</span>
      </div>

      {/* Add Material Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{modalMode === 'edit' ? 'Edit Bahan' : 'Tambah Bahan Baru'}</h2>
              <button className="modal-close" onClick={handleModalClose}>
                <X size={24} />
              </button>
            </div>
            
            {modalLoading ? (
              <LoadingSpinner 
                message="Loading available materials..." 
                size="medium" 
                className="esbm-modal-loading"
              />
            ) : modalMode === 'add' && availableItems.length === 0 ? (
              <div className="modal-no-items">
                <Check size={48} className="success-icon" />
                <h3>All Products Have Prices Set!</h3>
                <p>Awesome! All available materials already have their prices configured.</p>
                <button className="modal-btn primary" onClick={handleModalClose}>
                  Got it!
                </button>
              </div>
            ) : (
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Item ID</label>
                    {modalMode === 'edit' ? (
                      <input
                        type="text"
                        value={formData.itemId}
                        readOnly
                        className="readonly-input"
                      />
                    ) : (
                      <div className="searchable-input-container" ref={itemIdRef}>
                        <input
                          type="text"
                          value={itemIdSearch}
                          onChange={(e) => handleItemIdSearch(e.target.value)}
                          onFocus={() => setShowItemIdDropdown(true)}
                          placeholder="Type to search Item ID..."
                          required
                        />
                        
                        {showItemIdDropdown && filteredItemIds.length > 0 && (
                          <div className="searchable-dropdown">
                            {filteredItemIds.slice(0, 10).map(item => (
                              <div 
                                key={item.Item_ID}
                                className="dropdown-item"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleItemIdSelect(item);
                                }}
                              >
                                <strong>{item.Item_ID}</strong>
                                <small>{item.Item_Name}</small>
                              </div>
                            ))}
                            {filteredItemIds.length > 10 && (
                              <div className="dropdown-item disabled">
                                ... and {filteredItemIds.length - 10} more items
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label>Item Name</label>
                    {modalMode === 'edit' ? (
                      <input
                        type="text"
                        value={formData.itemName}
                        readOnly
                        className="readonly-input"
                      />
                    ) : (
                      <div className="searchable-input-container" ref={itemNameRef}>
                        <input
                          type="text"
                          value={itemNameSearch}
                          onChange={(e) => handleItemNameSearch(e.target.value)}
                          onFocus={() => setShowItemNameDropdown(true)}
                          placeholder="Type to search Item Name..."
                          required
                        />
                        
                        {showItemNameDropdown && filteredItemNames.length > 0 && (
                          <div className="searchable-dropdown">
                            {filteredItemNames.slice(0, 10).map(item => (
                              <div 
                                key={item.Item_ID}
                                className="dropdown-item"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleItemNameSelect(item);
                                }}
                              >
                                <strong>{item.Item_Name}</strong>
                                <small>{item.Item_ID}</small>
                              </div>
                            ))}
                            {filteredItemNames.length > 10 && (
                              <div className="dropdown-item disabled">
                                ... and {filteredItemNames.length - 10} more items
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Item Type</label>
                    <select 
                      value={formData.itemType} 
                      onChange={(e) => handleFormChange('itemType', e.target.value)}
                      required
                    >
                      <option value="BB">Bahan Baku</option>
                      <option value="BK">Bahan Kemas</option>
                      <option value="BP">Bahan Pendukung</option>
                      <option value="BJ">Barang Jadi</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Unit</label>
                    <select 
                      value={formData.unit}
                      onChange={(e) => handleFormChange('unit', e.target.value)}
                      required
                    >
                      <option value="">Select Unit</option>
                      {units.map((unit, index) => (
                        <option key={`${unit.unit_id}-${index}`} value={unit.unit_id}>
                          {unit.unit_id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Price</label>
                    <input 
                      type="number" 
                      value={formData.price}
                      onChange={(e) => handleFormChange('price', e.target.value)}
                      placeholder="Enter price"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Currency</label>
                    <select 
                      value={formData.currency} 
                      onChange={(e) => handleFormChange('currency', e.target.value)}
                      required
                    >
                      {currencies.map(curr => (
                        <option key={curr.Curr_Code} value={curr.Curr_Code}>
                          {curr.Curr_Code} - {curr.Curr_Description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Exchange Rate</label>
                  <input 
                    type="number" 
                    value={formData.rate}
                    readOnly
                    className="readonly-input"
                  />
                  <small>Rate is automatically set based on selected currency</small>
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
                    disabled={!formData.itemId || !formData.unit || !formData.price || submitLoading}
                  >
                    {submitLoading ? (
                      <>
                        <div className="esbm-spinner esbm-spinner-small" style={{ marginRight: '8px' }}></div>
                        {modalMode === 'edit' ? 'Updating...' : 'Adding...'}
                      </>
                    ) : (
                      <>
                        {modalMode === 'edit' ? <Edit size={16} /> : <Plus size={16} />}
                        {modalMode === 'edit' ? 'Update Material' : 'Add Material'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
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
                    <strong>Item ID:</strong>
                    <span>{deletingItem.itemId}</span>
                  </div>
                  <div className="info-row">
                    <strong>Item Name:</strong>
                    <span>{deletingItem.itemName}</span>
                  </div>
                  <div className="info-row">
                    <strong>Item Type:</strong>
                    <span>{deletingItem.itemType}</span>
                  </div>
                  <div className="info-row">
                    <strong>Current Price:</strong>
                    <span>{formatCurrency(deletingItem.price)} {deletingItem.currency}</span>
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
                      <div className="esbm-spinner esbm-spinner-small" style={{ marginRight: '8px' }}></div>
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

      {/* Import Preview Modal */}
      {showImportPreview && (
        <div className="modal-overlay">
          <div className="modal-content large-modal">
            <div className="modal-header">
              <h3>Import Preview - {importType === 'bahan-kemas' ? 'Bahan Kemas' : 'Material Prices'}</h3>
              <button 
                className="close-btn" 
                onClick={() => setShowImportPreview(false)}
              >
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div className="import-preview-info">
                <div style={{ backgroundColor: '#e0f2fe', border: '1px solid #0284c7', borderRadius: '8px', padding: '12px', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ color: '#0369a1', fontWeight: '600', fontSize: '14px' }}>📅 Import to year:</label>
                    <select 
                      value={importPeriode}
                      onChange={(e) => setImportPeriode(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        border: '1px solid #0284c7',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#0369a1',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        minWidth: '100px'
                      }}
                    >
                      {generateYearOptions().map(year => (
                        <option key={year} value={year.toString()}>{year}</option>
                      ))}
                    </select>
                    {importPeriode !== selectedPeriode && (
                      <span style={{ color: '#ea580c', fontSize: '13px', fontWeight: '500' }}>
                        ⚠️ Different from current view ({selectedPeriode})
                      </span>
                    )}
                  </div>
                </div>
                
                <p><strong>Records found:</strong> {importPreviewData.length}</p>
                {importType === 'bahan-kemas' ? (
                  <>
                    <p><strong>Import Type:</strong> Bahan Kemas (BK)</p>
                    <p><strong>Columns Read:</strong> Item Type (A), Item ID (B), Item Name (D), PRC ID (E), Unit (AB), Currency (AD), Price (AE)</p>
                    {importPreviewData.some(item => item.isDuplicate) && (
                      <p style={{color: '#f59e0b'}}><strong>Note:</strong> Duplicates detected and resolved by selecting highest priced items</p>
                    )}
                    {importPreviewData.some(item => item.hasInvalidUnit) && (
                      <p style={{color: '#dc2626'}}><strong>🚫 Critical Warning:</strong> {importPreviewData.filter(item => item.hasInvalidUnit).length} items have invalid units - import blocked until fixed</p>
                    )}
                    {importPreviewData.some(item => item.hasZeroPrice) && (
                      <p style={{color: '#f59e0b'}}><strong>Notice:</strong> {importPreviewData.filter(item => item.hasZeroPrice).length} items have zero price (automatically set)</p>
                    )}
                  </>
                ) : (
                  <>
                    <p><strong>Import Type:</strong> Bahan Baku (BB)</p>
                    <p><strong>Columns Read:</strong> Item Type (A), Item ID (B), Item Name (D), PRC ID (E), Unit (AB), Currency (AD), Price (AE)</p>
                    {importPreviewData.some(item => item.isDuplicate) && (
                      <p style={{color: '#f59e0b'}}><strong>Note:</strong> Duplicates detected and resolved by selecting highest priced items</p>
                    )}
                    {importPreviewData.some(item => item.hasInvalidUnit) && (
                      <p style={{color: '#dc2626'}}><strong>🚫 Critical Warning:</strong> {importPreviewData.filter(item => item.hasInvalidUnit).length} items have invalid units - import blocked until fixed</p>
                    )}
                    {importPreviewData.some(item => item.hasZeroPrice) && (
                      <p style={{color: '#f59e0b'}}><strong>Notice:</strong> {importPreviewData.filter(item => item.hasZeroPrice).length} items have zero price (automatically set)</p>
                    )}
                  </>
                )}
              </div>
              
              {importPreviewData.length > 0 && (() => {
                // Calculate pagination
                const totalPages = Math.ceil(importPreviewData.length / importItemsPerPage);
                const startIndex = (importCurrentPage - 1) * importItemsPerPage;
                const endIndex = startIndex + importItemsPerPage;
                const currentPageData = importPreviewData.slice(startIndex, endIndex);
                
                return (
                  <>
                    <div className="pagination-info">
                      <p>Showing {startIndex + 1} to {Math.min(endIndex, importPreviewData.length)} of {importPreviewData.length} items (Page {importCurrentPage} of {totalPages})</p>
                      {importPreviewData.filter(item => item.isDuplicate).length > 0 && (
                        <p style={{color: '#f59e0b', fontSize: '0.9em', marginTop: '0.5rem'}}>
                          🔄 {importType === 'bahan-kemas' ? 'Duplicates processed - highest priced items selected' : 'Duplicates are shown first'}
                        </p>
                      )}
                    </div>
                    
                    <div className="preview-table-container">
                      <table className="preview-table">
                        <thead>
                          <tr>
                            <th>Row #</th>
                            <th>Kode</th>
                            <th>Item Name</th>
                            <th>Type</th>
                            <th>Unit</th>
                            <th>Currency</th>
                            <th>Price</th>
                            <th>Principle</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentPageData.map((row, index) => (
                            <tr key={startIndex + index} style={{
                              backgroundColor: (row.hasInvalidUnit || row.hasZeroPrice) ? '#fef3c7' : 'transparent'
                            }}>
                              <td>{row.rowNumber}</td>
                              <td>{row.kode || row.itemCode}</td>
                              <td>{row.itemName || 'N/A'}</td>
                              <td>{row.itemType || 'N/A'}</td>
                              <td style={{color: row.hasInvalidUnit ? '#dc2626' : 'inherit'}}>
                                {row.finalUnit || row.unitTerakhirPo || row.unit || 'NULL'}
                                {row.hasInvalidUnit && <small style={{display: 'block', color: '#dc2626'}}>Invalid</small>}
                              </td>
                              <td>{row.finalCurrency || row.kurs || row.currency}</td>
                              <td style={{color: row.hasZeroPrice ? '#f59e0b' : 'inherit'}}>
                                {row.finalPrice || row.estimasiHarga || row.price}
                                {row.hasZeroPrice && <small style={{display: 'block', color: '#f59e0b'}}>Zero</small>}
                              </td>
                              <td>{row.kodePrinciple || row.principle || 'N/A'}</td>
                              <td>
                                {row.isDuplicate ? (
                                  <span style={{color: '#f59e0b', fontWeight: 'bold'}}>
                                    🔄 Duplicate (Selected)
                                  </span>
                                ) : row.hasInvalidUnit ? (
                                  <span style={{color: '#dc2626', fontWeight: 'bold'}}>
                                    Needs Fix
                                  </span>
                                ) : row.hasZeroPrice ? (
                                  <span style={{color: '#f59e0b', fontWeight: 'bold'}}>
                                    Needs Review
                                  </span>
                                ) : (
                                  <span style={{color: '#10b981', fontWeight: 'bold'}}>
                                    ✓ {importType === 'bahan-kemas' ? 'Valid' : 'Valid'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="import-pagination">
                        <button 
                          onClick={() => setImportCurrentPage(1)}
                          disabled={importCurrentPage === 1}
                          className="pagination-btn"
                        >
                          First
                        </button>
                        <button 
                          onClick={() => setImportCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={importCurrentPage === 1}
                          className="pagination-btn"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        
                        <span className="pagination-info-text">
                          Page {importCurrentPage} of {totalPages}
                        </span>
                        
                        <button 
                          onClick={() => setImportCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={importCurrentPage === totalPages}
                          className="pagination-btn"
                        >
                          <ChevronRight size={16} />
                        </button>
                        <button 
                          onClick={() => setImportCurrentPage(totalPages)}
                          disabled={importCurrentPage === totalPages}
                          className="pagination-btn"
                        >
                          Last
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setShowImportPreview(false)}
              >
                Close Preview
              </button>
              
              {/* Check for critical warnings (invalid units) */}
              {(() => {
                const hasCriticalWarnings = importPreviewData.some(item => item.hasInvalidUnit);
                
                return (
                  <>
                    {/* Bahan Kemas Import - Data is already processed, ready for DB import */}
                    {importType === 'bahan-kemas' && importPreviewData.length > 0 && (
                      <button 
                        className={hasCriticalWarnings ? "btn-disabled" : "btn-primary"}
                        onClick={handleBahanKemasFinalImport}
                        disabled={importLoading || hasCriticalWarnings}
                        title={hasCriticalWarnings ? "Cannot import: Fix invalid units first" : ""}
                      >
                        {hasCriticalWarnings ? 'Fix Data Issues First' : 
                         importLoading ? 'Importing...' : 'Import to Database'}
                      </button>
                    )}
                    
                    {/* Bahan Baku Import - Auto-processed flow */}
                    {importType === 'bahan-baku' && (
                      <button 
                        className={hasCriticalWarnings ? "btn-disabled" : "btn-primary"}
                        onClick={handleFinalImport}
                        disabled={importLoading || hasCriticalWarnings}
                        title={hasCriticalWarnings ? "Cannot import: Fix invalid units first" : ""}
                      >
                        {hasCriticalWarnings ? 'Fix Data Issues First' : 
                         importLoading ? 'Importing...' : 'Import to Database'}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Bahan Kemas Format Information Modal */}
      {showFormatModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Bahan Kemas Import Format Guide</h2>
              <button className="modal-close" onClick={() => setShowFormatModal(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="format-guide">
                <div style={{ backgroundColor: '#e0f2fe', border: '1px solid #0284c7', borderRadius: '8px', padding: '12px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ color: '#0369a1', fontWeight: '600', fontSize: '14px' }}>📅 Import to year:</label>
                    <select 
                      value={importPeriode}
                      onChange={(e) => setImportPeriode(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        border: '1px solid #0284c7',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#0369a1',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        minWidth: '100px'
                      }}
                    >
                      {generateYearOptions().map(year => (
                        <option key={year} value={year.toString()}>{year}</option>
                      ))}
                    </select>
                    {importPeriode !== selectedPeriode && (
                      <span style={{ color: '#ea580c', fontSize: '13px', fontWeight: '500' }}>
                        ⚠️ Different from current view ({selectedPeriode})
                      </span>
                    )}
                  </div>
                </div>
                
                <h3>📋 Required Excel Format</h3>
                <p>Your Excel file must follow this exact column structure:</p>
                
                <div className="format-table-container" style={{ marginBottom: '20px' }}>
                  <table className="format-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f3f4f6' }}>
                        <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'left' }}>Column</th>
                        <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'left' }}>Field Name</th>
                        <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'left' }}>Description</th>
                        <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'left' }}>Required</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', fontWeight: 'bold' }}>A</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Item Type</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Must be "Bahan Kemas" exactly</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', color: '#dc2626' }}>Yes</td>
                      </tr>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', fontWeight: 'bold' }}>B</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Item Code/ID</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Unique identifier for the item</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', color: '#dc2626' }}>Yes</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', fontWeight: 'bold' }}>D</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Item Name</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Display name (for reference only)</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', color: '#059669' }}>No</td>
                      </tr>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', fontWeight: 'bold' }}>E</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Principle/PRC ID</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Principle code reference</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', color: '#059669' }}>No</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', fontWeight: 'bold' }}>AB</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Purchase Unit</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Unit of measurement (kg, pcs, etc.)</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', color: '#059669' }}>No</td>
                      </tr>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', fontWeight: 'bold' }}>AD</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Currency</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Currency code (IDR, USD, etc.)</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', color: '#059669' }}>No</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', fontWeight: 'bold' }}>AE</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Purchase Price</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Standard purchase price</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', color: '#059669' }}>No</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="format-notes">
                  <h4>⚠️ Important Notes:</h4>
                  <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
                    <li><strong>Row 1:</strong> Must contain headers (will be skipped)</li>
                    <li><strong>Data starts from Row 2</strong></li>
                    <li><strong>Item Type validation:</strong> Only "Bahan Kemas" entries will be processed</li>
                    <li><strong>Duplicate handling:</strong> Items with same code will be automatically deduplicated by highest price</li>
                    <li><strong>Currency conversion:</strong> All prices will be normalized to IDR for comparison</li>
                    <li><strong>Code normalization:</strong> Codes ending with ".xxx" (e.g., "130.000") will be normalized to "130"</li>
                  </ul>
                  
                  <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '15px', margin: '15px 0' }}>
                    <h4 style={{ color: '#92400e', margin: '0 0 10px 0' }}>🗑️ Data Replacement Warning</h4>
                    <p style={{ margin: '0', color: '#92400e', fontWeight: '500' }}>
                      <strong>All existing Bahan Kemas (BK) data will be deleted and replaced</strong> with the uploaded data. 
                      This action cannot be undone. Please ensure your Excel file contains all the data you want to keep.
                    </p>
                  </div>
                  
                  <h4 style={{ color: '#dc2626', marginTop: '15px' }}>🚫 Data Validation Rules:</h4>
                  <ul style={{ paddingLeft: '20px', lineHeight: '1.6', color: '#374151' }}>
                    <li><strong>Invalid Units:</strong> Pure numbers (e.g., "5"), "null", "undefined", "(none)", "none" will be flagged and block import</li>
                    <li><strong>Zero Prices:</strong> Items with 0 or invalid prices will be normalized to 0 (warning only)</li>
                    <li><strong>Empty Fields:</strong> Missing essential data will be handled gracefully</li>
                    <li><strong>Critical Warnings:</strong> Import will be blocked until invalid units are fixed manually</li>
                  </ul>
                </div>

                <div className="process-info" style={{ backgroundColor: '#f0f9ff', padding: '15px', borderRadius: '8px', marginTop: '15px' }}>
                  <h4 style={{ color: '#0369a1', margin: '0 0 10px 0' }}>🚀 Auto-Processing</h4>
                  <p style={{ margin: '0', color: '#0c4a6e' }}>
                    After upload, your data will be automatically processed for duplicates and normalized. 
                    You'll only need to review the results and click "Import to Database".
                  </p>
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  className="modal-btn secondary" 
                  onClick={() => setShowFormatModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="modal-btn primary" 
                  onClick={proceedWithBahanKemasImport}
                >
                  <Upload size={16} />
                  Continue with Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bahan Baku Format Information Modal */}
      {showBahanBakuFormatModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Bahan Baku Import Format Guide</h2>
              <button className="modal-close" onClick={() => setShowBahanBakuFormatModal(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="format-guide">
                <div style={{ backgroundColor: '#e0f2fe', border: '1px solid #0284c7', borderRadius: '8px', padding: '12px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ color: '#0369a1', fontWeight: '600', fontSize: '14px' }}>📅 Import to year:</label>
                    <select 
                      value={importPeriode}
                      onChange={(e) => setImportPeriode(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        border: '1px solid #0284c7',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#0369a1',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        minWidth: '100px'
                      }}
                    >
                      {generateYearOptions().map(year => (
                        <option key={year} value={year.toString()}>{year}</option>
                      ))}
                    </select>
                    {importPeriode !== selectedPeriode && (
                      <span style={{ color: '#ea580c', fontSize: '13px', fontWeight: '500' }}>
                        ⚠️ Different from current view ({selectedPeriode})
                      </span>
                    )}
                  </div>
                </div>
                
                <h3>📋 Required Excel Format</h3>
                <p>Your Excel file must follow this exact column structure:</p>
                
                <div className="format-table-container" style={{ marginBottom: '20px' }}>
                  <table className="format-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f3f4f6' }}>
                        <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'left' }}>Column</th>
                        <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'left' }}>Field Name</th>
                        <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'left' }}>Description</th>
                        <th style={{ border: '1px solid #d1d5db', padding: '8px', textAlign: 'left' }}>Required</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', fontWeight: 'bold' }}>A</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Item Type</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Must be "Bahan Baku" exactly</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', color: '#dc2626' }}>Yes</td>
                      </tr>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', fontWeight: 'bold' }}>B</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Item Code/ID</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Unique identifier for the item</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', color: '#dc2626' }}>Yes</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', fontWeight: 'bold' }}>D</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Item Name</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Display name (for reference only)</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', color: '#059669' }}>No</td>
                      </tr>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', fontWeight: 'bold' }}>E</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Principle/PRC ID</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Principle code reference</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', color: '#059669' }}>No</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', fontWeight: 'bold' }}>AB</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Purchase Unit</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Unit of measurement (kg, pcs, etc.)</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', color: '#059669' }}>No</td>
                      </tr>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', fontWeight: 'bold' }}>AD</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Currency</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Currency code (IDR, USD, etc.)</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', color: '#059669' }}>No</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', fontWeight: 'bold' }}>AE</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Purchase Price</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Standard purchase price</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', color: '#059669' }}>No</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="format-notes">
                  <h4>⚠️ Important Notes:</h4>
                  <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
                    <li><strong>Row 1:</strong> Must contain headers (will be skipped)</li>
                    <li><strong>Data starts from Row 2</strong></li>
                    <li><strong>Item Type validation:</strong> Only "Bahan Baku" entries will be processed</li>
                    <li><strong>Duplicate handling:</strong> Items with same code will be automatically deduplicated by highest price</li>
                    <li><strong>Currency conversion:</strong> All prices will be normalized to IDR for comparison</li>
                    <li><strong>Code normalization:</strong> Codes ending with ".xxx" (e.g., "130.000") will be normalized to "130"</li>
                  </ul>
                  
                  <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '15px', margin: '15px 0' }}>
                    <h4 style={{ color: '#92400e', margin: '0 0 10px 0' }}>🗑️ Data Replacement Warning</h4>
                    <p style={{ margin: '0', color: '#92400e', fontWeight: '500' }}>
                      <strong>All existing Bahan Baku (BB) data will be deleted and replaced</strong> with the uploaded data. 
                      This action cannot be undone. Please ensure your Excel file contains all the data you want to keep.
                    </p>
                  </div>
                  
                  <h4 style={{ color: '#dc2626', marginTop: '15px' }}>🚫 Data Validation Rules:</h4>
                  <ul style={{ paddingLeft: '20px', lineHeight: '1.6', color: '#374151' }}>
                    <li><strong>Invalid Units:</strong> Pure numbers (e.g., "5"), "null", "undefined", "(none)", "none" will be flagged and block import</li>
                    <li><strong>Zero Prices:</strong> Items with 0 or invalid prices will be normalized to 0 (warning only)</li>
                    <li><strong>Empty Fields:</strong> Missing essential data will be handled gracefully</li>
                    <li><strong>Critical Warnings:</strong> Import will be blocked until invalid units are fixed manually</li>
                  </ul>
                </div>

                <div className="process-info" style={{ backgroundColor: '#f0f9ff', padding: '15px', borderRadius: '8px', marginTop: '15px' }}>
                  <h4 style={{ color: '#0369a1', margin: '0 0 10px 0' }}>🚀 Auto-Processing</h4>
                  <p style={{ margin: '0', color: '#0c4a6e' }}>
                    After upload, your data will be automatically processed for duplicates and normalized. 
                    You'll only need to review the results and click "Import to Database".
                  </p>
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  className="modal-btn secondary" 
                  onClick={() => setShowBahanBakuFormatModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="modal-btn primary" 
                  onClick={proceedWithBahanBakuImport}
                >
                  <Upload size={16} />
                  Continue with Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Warning Modal */}
      {showExportWarningModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Export All Materials</h2>
              <button className="modal-close" onClick={() => setShowExportWarningModal(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="format-guide">
                <div style={{ backgroundColor: '#e0f2fe', border: '1px solid #0284c7', borderRadius: '8px', padding: '15px', marginBottom: '20px' }}>
                  <h4 style={{ color: '#0369a1', margin: '0 0 10px 0' }}>📅 Select Export Year</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ color: '#0c4a6e', fontWeight: '500' }}>Export data for year:</label>
                    <select 
                      value={exportPeriode}
                      onChange={(e) => setExportPeriode(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #0284c7',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#0369a1',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        minWidth: '100px'
                      }}
                    >
                      {generateYearOptions().map(year => (
                        <option key={year} value={year.toString()}>{year}</option>
                      ))}
                    </select>
                    {exportPeriode !== selectedPeriode && (
                      <span style={{ color: '#ea580c', fontSize: '14px', fontWeight: '500' }}>
                        ⚠️ Different from current view ({selectedPeriode})
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '15px', marginBottom: '20px' }}>
                  <h3 style={{ color: '#92400e', margin: '0 0 10px 0' }}>⚠️ Important Notice</h3>
                  <p style={{ margin: '0 0 10px 0', color: '#92400e', fontWeight: '500' }}>
                    <strong>The exported Excel format is NOT meant for re-importing into the system.</strong>
                  </p>
                  <p style={{ margin: '0', color: '#92400e', lineHeight: '1.6' }}>
                    This export is designed for reporting and data analysis purposes only. 
                    The column structure differs from the import format required by the system.
                  </p>
                </div>

                <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #0ea5e9', borderRadius: '8px', padding: '15px', marginBottom: '15px' }}>
                  <h4 style={{ color: '#0369a1', margin: '0 0 10px 0' }}>📊 Export Contents</h4>
                  <p style={{ margin: '0 0 10px 0', color: '#0c4a6e' }}>
                    The exported file will include all materials currently in the database with the following information:
                  </p>
                  <ul style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#0c4a6e', margin: '0' }}>
                    <li>Item ID and Name</li>
                    <li>Item Type (Bahan Kemas / Bahan Baku)</li>
                    <li>Unit of Measurement</li>
                    <li>Price and Currency</li>
                    <li>Exchange Rate</li>
                    <li>Last Updated Date</li>
                  </ul>
                </div>

                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #22c55e', borderRadius: '8px', padding: '15px' }}>
                  <h4 style={{ color: '#166534', margin: '0 0 10px 0' }}>💡 For Import Requirements</h4>
                  <p style={{ margin: '0', color: '#166534', lineHeight: '1.6' }}>
                    If you need to import materials into the system, please use the <strong>"Import Bahan Kemas"</strong> or <strong>"Import Bahan Baku"</strong> buttons above. 
                    Click on either button to see the required import format specifications.
                  </p>
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  className="modal-btn secondary" 
                  onClick={() => setShowExportWarningModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="modal-btn primary" 
                  onClick={handleExportAllMaterials}
                >
                  <Download size={16} />
                  Proceed with Export
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Harga Bahan Modal */}
      {showUpdateHargaModal && (
        <div className="modal-overlay">
          <div className="modal update-harga-modal">
            <div className="modal-header">
              <h2>Update Harga Bahan</h2>
              <button className="close-btn" onClick={() => setShowUpdateHargaModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="modal-body">
              <div className="update-harga-section">
                {/* Year Selector */}
                <div className="update-year-section">
                  <label htmlFor="update-periode-select" className="section-label">
                    Select Year for Price Update:
                  </label>
                  <select 
                    id="update-periode-select"
                    value={updatePeriode}
                    onChange={(e) => setUpdatePeriode(e.target.value)}
                    className="periode-select-large"
                  >
                    {generateYearOptions().map(year => (
                      <option key={year} value={year.toString()}>{year}</option>
                    ))}
                  </select>
                  {updatePeriode !== selectedPeriode && (
                    <div className="warning-note">
                      ⚠️ You are updating prices for year {updatePeriode}, which differs from the current view ({selectedPeriode})
                    </div>
                  )}
                </div>

                {/* Material Selection Section */}
                <div className="material-selection-section">
                  <h3 className="section-title">Select Materials to Update</h3>
                  
                  <div className="search-box-modal">
                    <Search size={20} />
                    <input
                      type="text"
                      placeholder="Search materials by ID or name..."
                      value={updateSearchTerm}
                      onChange={(e) => {
                        setUpdateSearchTerm(e.target.value);
                        setUpdateModalCurrentPage(1); // Reset to first page on search
                      }}
                    />
                  </div>

                  {/* Pagination Info */}
                  <div className="pagination-info-bar">
                    <span className="results-count">
                      Showing {paginatedUpdateMaterials.length > 0 ? ((updateModalCurrentPage - 1) * updateModalItemsPerPage) + 1 : 0} 
                      {' '}-{' '}
                      {Math.min(updateModalCurrentPage * updateModalItemsPerPage, filteredUpdateMaterials.length)}
                      {' '}of{' '}
                      {filteredUpdateMaterials.length} materials
                    </span>
                    {filteredUpdateMaterials.length > 0 && (
                      <span className="selected-count">
                        {selectedMaterialsForUpdate.length} selected
                      </span>
                    )}
                  </div>

                  <div className="materials-list">
                    {paginatedUpdateMaterials.length > 0 ? (
                      paginatedUpdateMaterials.map(material => {
                        const isSelected = selectedMaterialsForUpdate.some(
                          m => m.pk_id === material.pk_id
                        );
                        
                        return (
                          <div
                            key={material.pk_id}
                            className={`material-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedMaterialsForUpdate(prev =>
                                  prev.filter(m => m.pk_id !== material.pk_id)
                                );
                              } else {
                                setSelectedMaterialsForUpdate(prev => [
                                  ...prev,
                                  {
                                    ...material,
                                    newPrice: material.price,
                                    adjustmentType: 'amount',
                                    adjustmentValue: 0
                                  }
                                ]);
                              }
                            }}
                          >
                            <div className="material-checkbox">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                              />
                            </div>
                            <div className="material-info">
                              <div className="material-id">{material.itemId}</div>
                              <div className="material-name">{material.itemName}</div>
                            </div>
                            <div className="material-current-price">
                              <div className="price-label">Current Price</div>
                              <div className="price-value">
                                {material.currency} {parseFloat(material.price).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="no-materials-message">
                        {updateSearchTerm ? 'No materials found matching your search.' : 'No materials available.'}
                      </div>
                    )}
                  </div>

                  {/* Pagination Controls */}
                  {updateModalTotalPages > 1 && (
                    <div className="update-modal-pagination">
                      <button
                        className="pagination-btn"
                        onClick={() => setUpdateModalCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={updateModalCurrentPage === 1}
                      >
                        <ChevronLeft size={20} />
                      </button>
                      
                      <span className="pagination-info-text">
                        Page {updateModalCurrentPage} of {updateModalTotalPages}
                      </span>
                      
                      <button
                        className="pagination-btn"
                        onClick={() => setUpdateModalCurrentPage(prev => Math.min(updateModalTotalPages, prev + 1))}
                        disabled={updateModalCurrentPage === updateModalTotalPages}
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Selected Materials Summary */}
                {selectedMaterialsForUpdate.length > 0 && (
                  <div className="selected-materials-section">
                    <h3 className="section-title">
                      Selected Materials ({selectedMaterialsForUpdate.length})
                    </h3>
                    
                    <div className="selected-materials-list">
                      {selectedMaterialsForUpdate.map((material, index) => (
                        <div key={material.pk_id} className="selected-material-card">
                          <div className="card-header">
                            <div className="material-basic-info">
                              <span className="material-id-badge">{material.itemId}</span>
                              <span className="material-name-text">{material.itemName}</span>
                            </div>
                            <button
                              className="remove-material-btn"
                              onClick={() => {
                                setSelectedMaterialsForUpdate(prev =>
                                  prev.filter(m => m.pk_id !== material.pk_id)
                                );
                              }}
                            >
                              <X size={18} />
                            </button>
                          </div>
                          
                          <div className="price-adjustment-section">
                            <div className="current-price-display">
                              <label>Current Price:</label>
                              <span className="price-amount">
                                {material.currency} {parseFloat(material.price).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </span>
                            </div>

                            <div className="adjustment-type-selector">
                              <label>Adjustment Type:</label>
                              <div className="radio-group">
                                <label className="radio-option">
                                  <input
                                    type="radio"
                                    name={`adjustment-type-${material.pk_id}`}
                                    value="amount"
                                    checked={material.adjustmentType === 'amount'}
                                    onChange={() => {
                                      setSelectedMaterialsForUpdate(prev =>
                                        prev.map(m =>
                                          m.pk_id === material.pk_id
                                            ? { ...m, adjustmentType: 'amount', adjustmentValue: 0 }
                                            : m
                                        )
                                      );
                                    }}
                                  />
                                  New Price Amount
                                </label>
                                <label className="radio-option">
                                  <input
                                    type="radio"
                                    name={`adjustment-type-${material.pk_id}`}
                                    value="percentage"
                                    checked={material.adjustmentType === 'percentage'}
                                    onChange={() => {
                                      setSelectedMaterialsForUpdate(prev =>
                                        prev.map(m =>
                                          m.pk_id === material.pk_id
                                            ? { ...m, adjustmentType: 'percentage', adjustmentValue: 0 }
                                            : m
                                        )
                                      );
                                    }}
                                  />
                                  Percentage Change
                                </label>
                              </div>
                            </div>

                            {material.adjustmentType === 'amount' ? (
                              <div className="input-group">
                                <label>New Price:</label>
                                <div className="price-input-wrapper">
                                  <span className="currency-prefix">{material.currency}</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={material.newPrice === 0 || material.newPrice === '' ? '' : material.newPrice}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      const newPrice = value === '' ? '' : parseFloat(value);
                                      setSelectedMaterialsForUpdate(prev =>
                                        prev.map(m =>
                                          m.pk_id === material.pk_id
                                            ? { ...m, newPrice }
                                            : m
                                        )
                                      );
                                    }}
                                    placeholder="Enter new price"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="input-group">
                                <label>Percentage Change:</label>
                                <div className="percentage-input-wrapper">
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={material.adjustmentValue}
                                    onChange={(e) => {
                                      const adjustmentValue = parseFloat(e.target.value) || 0;
                                      const currentPrice = parseFloat(material.price);
                                      const newPrice = currentPrice * (1 + adjustmentValue / 100);
                                      setSelectedMaterialsForUpdate(prev =>
                                        prev.map(m =>
                                          m.pk_id === material.pk_id
                                            ? { ...m, adjustmentValue, newPrice }
                                            : m
                                        )
                                      );
                                    }}
                                    placeholder="e.g., 10 for +10%, -5 for -5%"
                                  />
                                  <span className="percentage-suffix">%</span>
                                </div>
                                <div className="calculated-price">
                                  New Price: {material.currency} {parseFloat(material.newPrice).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button 
                  className="modal-btn secondary" 
                  onClick={() => setShowUpdateHargaModal(false)}
                  disabled={submitLoading}
                >
                  Cancel
                </button>
                <button 
                  className="modal-btn primary" 
                  disabled={selectedMaterialsForUpdate.length === 0 || submitLoading}
                  onClick={handleGeneratePriceUpdate}
                >
                  <Check size={16} />
                  {submitLoading ? 'Generating Simulation...' : `Generate Simulation (${selectedMaterialsForUpdate.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Updates Modal */}
      {showPendingUpdatesModal && (
        <div className="modal-overlay">
          <div className="modal pending-updates-modal">
            <div className="modal-header">
              <h2>Pending Price Updates</h2>
              <button className="close-btn" onClick={() => setShowPendingUpdatesModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="modal-body">
              {loadingPendingUpdates ? (
                <LoadingSpinner message="Loading pending updates..." />
              ) : Object.keys(groupedPendingUpdates).length > 0 ? (
                <div className="pending-updates-list">
                  <div className="pending-updates-info">
                    <p>
                      <strong>{pendingUpdates.length}</strong> pending simulation(s) grouped into{' '}
                      <strong>{Object.keys(groupedPendingUpdates).length}</strong> update group(s)
                    </p>
                  </div>

                  {Object.entries(groupedPendingUpdates).map(([description, updates]) => {
                    const isExpanded = expandedUpdateGroups.has(description);
                    const firstUpdate = updates[0];
                    const periode = firstUpdate?.Periode || 'N/A';
                    const simulasiDate = firstUpdate?.Simulasi_Date || '';
                    
                    return (
                      <div key={description} className="update-group-card">
                        <div className="update-group-header" onClick={() => toggleUpdateGroup(description)}>
                          <div className="update-group-info">
                            <div className="update-group-title">
                              {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                              <span className="update-description">{description}</span>
                            </div>
                            <div className="update-group-meta">
                              <span className="update-count">{updates.length} product(s) affected</span>
                              <span className="update-periode">Periode: {periode}</span>
                              <span className="update-date">
                                {formatDateTimeLocal(firstUpdate.Simulasi_Date)}
                              </span>
                            </div>
                          </div>
                          <div className="update-group-actions" onClick={(e) => e.stopPropagation()}>
                            {canConfirmPriceUpdate() && (
                              <button
                                className="confirm-update-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConfirmUpdateGroup(description);
                                }}
                                disabled={confirmingUpdate === description}
                                title="Confirm and apply this price update"
                              >
                                {confirmingUpdate === description ? (
                                  <span className="loading-spinner-mini" />
                                ) : (
                                  <Check size={18} />
                                )}
                              </button>
                            )}
                            <button
                              className="view-details-btn"
                              onClick={(e) => handleShowAffectedProducts(description, simulasiDate, e)}
                              title="View detailed impact"
                            >
                              <Eye size={18} />
                            </button>
                            <button
                              className="delete-group-btn"
                              onClick={() => handleDeleteUpdateGroup(description)}
                              title="Delete this update group"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="update-group-items">
                            <table className="updates-table">
                              <thead>
                                <tr>
                                  <th>Product ID</th>
                                  <th>Product Name</th>
                                  <th>Simulasi ID</th>
                                  <th>LOB</th>
                                  <th>Version</th>
                                </tr>
                              </thead>
                              <tbody>
                                {updates.map(update => (
                                  <tr key={update.Simulasi_ID}>
                                    <td>{update.Product_ID}</td>
                                    <td>{update.Product_Name}</td>
                                    <td>{update.Simulasi_ID}</td>
                                    <td>{update.LOB}</td>
                                    <td>{update.Versi}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="no-pending-updates">
                  <Package size={64} />
                  <h3>No Pending Updates</h3>
                  <p>You don't have any pending price update simulations.</p>
                  <button 
                    className="action-btn"
                    onClick={() => {
                      setShowPendingUpdatesModal(false);
                      handleUpdateHargaBahan();
                    }}
                  >
                    Create New Update
                  </button>
                </div>
              )}
            </div>

            <div className="modal-actions">
              {canConfirmPriceUpdate() && Object.keys(groupedPendingUpdates).length > 0 && (
                <button 
                  className="modal-btn primary confirm-all-btn" 
                  onClick={handleConfirmAllUpdates}
                  disabled={confirmingAll}
                >
                  {confirmingAll ? (
                    <>
                      <span className="loading-spinner-mini" /> Confirming...
                    </>
                  ) : (
                    <>
                      <Check size={18} /> Confirm All
                    </>
                  )}
                </button>
              )}
              <button 
                className="modal-btn secondary" 
                onClick={() => setShowPendingUpdatesModal(false)}
              >
                Close
              </button>
              </div>
            </div>
          </div>
        )}

        {/* Affected Products Modal for Price Updates */}
        <AffectedProductsModal
          isOpen={showAffectedModal}
          onClose={handleCloseAffectedModal}
          priceChangeDescription={selectedUpdateDescription}
          priceChangeDate={selectedUpdateDate}
          priceUpdateMode={true}
        />
    </div>
  );
};

export default HargaBahan;