import React, { useState, useEffect, useMemo, useRef } from 'react';
import { masterAPI } from '../services/api';
import AWN from 'awesome-notifications';
import 'awesome-notifications/dist/style.css';
import '../styles/HargaBahan.css';
import { Plus, Search, Filter, Edit, Trash2, Package, ChevronLeft, ChevronRight, X, Check, Upload } from 'lucide-react';

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
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50); // Show only 50 items per page

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

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    filterData();
  }, [materialData, searchTerm, selectedCategory]);

  useEffect(() => {
    paginateData();
  }, [filteredData, currentPage]);

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

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
        masterAPI.getHargaBahan(),
        masterAPI.getBahan(),
        masterAPI.getCurrency()
      ]);

      // Filter currency data for current year
      const currentYearCurrencies = currencyResponse.filter(curr => curr.Periode === currentYear);
      
      // Create currency lookup map
      const currencyMap = {};
      currentYearCurrencies.forEach(curr => {
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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID').format(value);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
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
      // Get current year
      const currentYear = new Date().getFullYear().toString();
      
      // Fetch currencies for current year
      const currencyResponse = await masterAPI.getCurrency();
      const currentYearCurrencies = currencyResponse.filter(curr => curr.Periode === currentYear);
      setCurrencies(currentYearCurrencies);
      
      // Fetch units
      const unitsResponse = await masterAPI.getUnit();
      setUnits(unitsResponse);
      
      // Find available items that don't have prices set yet
      const allItems = await masterAPI.getBahan();
      const existingHargaBahan = await masterAPI.getHargaBahan();
      
      // Get list of item IDs that already have prices
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

  const handleImportMaterial = () => {
    // Placeholder for import functionality
    // Will be implemented with full import system
    notifier.info('Import functionality will be implemented soon');
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
      // Get current year
      const currentYear = new Date().getFullYear().toString();
      
      // Fetch currencies for current year
      const currencyResponse = await masterAPI.getCurrency();
      const currentYearCurrencies = currencyResponse.filter(curr => curr.Periode === currentYear);
      setCurrencies(currentYearCurrencies);
      
      // Fetch units
      const unitsResponse = await masterAPI.getUnit();
      setUnits(unitsResponse);
      
      // For edit mode, we don't need available items since we're editing existing
      setAvailableItems([]);
      
      // Pre-fill form with existing data
      const selectedCurrency = currentYearCurrencies.find(curr => curr.Curr_Code === item.currency);
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
      
      const submitData = {
        itemId: formData.itemId,
        itemType: formData.itemType,
        unit: formData.unit,
        price: parseFloat(formData.price),
        currency: formData.currency,
        rate: formData.rate,
        userId: 'GWN' // This should come from user session/context in real app
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
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading material data...</p>
        </div>
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
      <div className="controls-section">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search materials..."
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
          
          <button className="import-btn" onClick={handleImportMaterial}>
            <Upload size={20} />
            Import
          </button>
          
          <button className="add-btn" onClick={handleAddMaterial}>
            <Plus size={20} />
            Tambah Bahan
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="materials-table">
          <thead>
            <tr>
              <th>Item ID</th>
              <th>Item Name</th>
              <th>Item Type</th>
              <th>Unit</th>
              <th>Price</th>
              <th>Currency</th>
              <th>Rate</th>
              <th>Last Updated</th>
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
              <div className="modal-loading">
                <div className="spinner"></div>
                <p>Loading available materials...</p>
              </div>
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
                        <div className="btn-spinner"></div>
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

export default HargaBahan;
