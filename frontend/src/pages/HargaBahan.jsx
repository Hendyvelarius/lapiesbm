import React, { useState, useEffect, useMemo, useRef } from 'react';
import { masterAPI } from '../services/api';
import AWN from 'awesome-notifications';
import 'awesome-notifications/dist/style.css';
import '../styles/HargaBahan.css';
import { Plus, Search, Filter, Edit, Trash2, Package, ChevronLeft, ChevronRight, X, Check, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import LoadingSpinner from '../components/LoadingSpinner';

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

  // Import states
  const [importPreviewData, setImportPreviewData] = useState([]);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [showFormatModal, setShowFormatModal] = useState(false); // New state for format modal
  
  // Import pagination states
  const [importCurrentPage, setImportCurrentPage] = useState(1);
  const [importItemsPerPage] = useState(20); // Fixed at 20 items per page
  const [importType, setImportType] = useState(''); // 'bahan-baku' or 'bahan-kemas'

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
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xls,.xlsx';
    input.onchange = handleFileUpload;
    input.click();
  };

  const handleImportBahanKemas = () => {
    // Show format information modal first
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
    console.log('Required Excel format (starting from row 2):');
    console.log('Column A: Item Type (must be "Bahan Kemas")');
    console.log('Column B: Item Code/ID'); 
    console.log('Column D: Item Name (display only)');
    console.log('Column E: Principle/PRC ID');
    console.log('Column L: Purchase Unit');
    console.log('Column AD: Purchase Price');
    console.log('Column AE: Currency');
    console.log('=====================================');
    
    // Skip header row (row 1), start from row 2 (index 1)
    const extractedData = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      // Extract data from specific columns
      const itemType = row[0] ? row[0].toString().trim() : ''; // Column A
      const itemCode = row[1] ? row[1].toString().trim() : ''; // Column B  
      const itemName = row[3] ? row[3].toString().trim() : ''; // Column D
      const principle = row[4] ? row[4].toString().trim() : ''; // Column E
      const unit = row[11] ? row[11].toString().trim() : ''; // Column L (index 11)
      const price = row[29] ? row[29] : ''; // Column AD (index 29)
      const currency = row[30] ? row[30].toString().trim() : ''; // Column AE (index 30)
      
      // Only validate Item Code and Item Type - skip empty or invalid entries
      if (!itemCode) continue;
      
      // Validate that Item Type is "Bahan Kemas" (case insensitive)
      if (itemType.toLowerCase() !== 'bahan kemas') {
        console.warn(`Row ${i + 1}: Invalid item type "${itemType}" - expected "Bahan Kemas". Skipping row.`);
        continue;
      }
      
      const rowData = {
        rowNumber: i + 1,
        itemType: itemType,
        itemCode: itemCode,
        itemName: itemName,
        principle: principle,
        unit: unit,
        price: price,
        currency: currency,
        // Derived fields for database insertion
        ITEM_ID: itemCode,
        ITEM_TYPE: 'BK', // Convert "Bahan Kemas" to "BK"
        ITEM_PURCHASE_UNIT: unit,
        ITEM_PURCHASE_STD_PRICE: price ? parseFloat(price) : null,
        ITEM_CURRENCY: currency,
        ITEM_PRC_ID: principle
      };
      
      extractedData.push(rowData);
    }
    
    console.log(`Extracted ${extractedData.length} valid Bahan Kemas records`);
    return extractedData;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImportLoading(true);
    setImportType('bahan-baku'); // Set import type for Bahan Baku
    
    try {
      const data = await readExcelFile(file);
      const extractedData = extractRequiredColumns(data);
      
      if (extractedData.length === 0) {
        notifier.alert('No valid data found in the Excel file');
        return;
      }
      
      setImportPreviewData(extractedData);
      setShowImportPreview(true);
      notifier.success(`Successfully extracted ${extractedData.length} records from Excel file`);
      
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
          itemPurchaseUnit.toString().toLowerCase() === 'undefined') {
        
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
      
      // Call the bulk import API
      const result = await masterAPI.bulkImportBahanBaku(mappedData);
      
      console.log('Import result:', result);
      
      // Show success message and close modal
      notifier.success(`Successfully imported ${result.data.insertedRecords} Bahan Baku items!`);
      setShowImportPreview(false);
      
      // Refresh the main table data
      await fetchAllData();
      
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
        const currentDateTime = new Date().toISOString();
        
        return {
          ITEM_ID: item.ITEM_ID,
          ITEM_TYPE: 'BK', // Always BK for Bahan Kemas
          ITEM_PURCHASE_UNIT: item.ITEM_PURCHASE_UNIT || item.unit || null,
          ITEM_PURCHASE_STD_PRICE: item.ITEM_PURCHASE_STD_PRICE || item.finalPrice || parseFloat(item.price) || null,
          ITEM_CURRENCY: item.ITEM_CURRENCY || item.finalCurrency || item.currency || 'IDR',
          ITEM_PRC_ID: item.ITEM_PRC_ID || item.principle || null,
          user_id: 'SYSTEM',
          delegated_to: 'SYSTEM', 
          process_date: currentDateTime
        };
      });
      
      console.log('=== BAHAN KEMAS FINAL IMPORT ===');
      console.log('Total items to import:', mappedData.length);
      console.log('Sample mapped data:', mappedData.slice(0, 3));
      console.log('==================================');
      
      // Call the bulk import API
      const result = await masterAPI.bulkImportBahanKemas(mappedData);
      
      if (result.success) {
        notifier.success(`Successfully imported ${result.data.insertedRecords} Bahan Kemas items!`);
        setShowImportPreview(false);
        await fetchAllData(); // Refresh the main table
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
      const normalized = normalizeKode(item.itemCode);
      console.log(`Normalizing: "${item.itemCode}" → "${normalized}"`);
      return {
        ...item,
        originalCode: item.itemCode,
        itemCode: normalized,
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
          
          <button className="import-btn" onClick={handleImportBahanKemas}>
            <Upload size={20} />
            Import Bahan Kemas
          </button>
          
          <button className="import-btn" onClick={handleImportMaterial}>
            <Upload size={20} />
            Import Bahan Baku
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
                <p><strong>Records found:</strong> {importPreviewData.length}</p>
                {importType === 'bahan-kemas' ? (
                  <>
                    <p><strong>Import Type:</strong> Bahan Kemas (BK)</p>
                    <p><strong>Columns Read:</strong> Item Type (A), Item Code (B), Item Name (D), Principle (E), Unit (L), Price (AD), Currency (AE)</p>
                    {importPreviewData.some(item => item.isDuplicate) ? (
                      <p style={{color: '#f59e0b'}}><strong>Status:</strong> Auto-processed - Duplicates resolved by highest price selection</p>
                    ) : (
                      <p style={{color: '#10b981'}}><strong>Status:</strong> Auto-processed - No duplicates found, ready for import</p>
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
                    
                    {/* Bahan Baku Import - Standard flow */}
                    {importType === 'bahan-baku' && importPreviewData.length > 0 && importPreviewData[0].itemName && (
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
                    {importType === 'bahan-baku' && (!importPreviewData.length || !importPreviewData[0].itemName) && (
                      <button 
                        className={hasCriticalWarnings ? "btn-disabled" : "btn-primary"}
                        onClick={handleProcessImport}
                        disabled={importLoading || hasCriticalWarnings}
                        title={hasCriticalWarnings ? "Cannot process: Fix invalid units first" : ""}
                      >
                        {hasCriticalWarnings ? 'Fix Data Issues First' : 
                         importLoading ? 'Processing...' : 'Process Import'}
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
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', fontWeight: 'bold' }}>L</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Purchase Unit</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Unit of measurement (kg, pcs, etc.)</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', color: '#059669' }}>No</td>
                      </tr>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', fontWeight: 'bold' }}>AD</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Purchase Price</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Standard purchase price</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', color: '#059669' }}>No</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px', fontWeight: 'bold' }}>AE</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Currency</td>
                        <td style={{ border: '1px solid #d1d5db', padding: '8px' }}>Currency code (IDR, USD, etc.)</td>
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
    </div>
  );
};

export default HargaBahan;
