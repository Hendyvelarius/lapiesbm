import React, { useState, useEffect, useMemo, useRef } from 'react';
import { masterAPI } from '../services/api';
import AWN from 'awesome-notifications';
import 'awesome-notifications/dist/style.css';
import '../styles/HargaBahan.css';
import { Plus, Search, Filter, Edit, Trash2, Package, ChevronLeft, ChevronRight, X, Check, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

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
  
  // Import pagination states
  const [importCurrentPage, setImportCurrentPage] = useState(1);
  const [importItemsPerPage] = useState(20); // Fixed at 20 items per page

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

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImportLoading(true);
    
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
          
          // Get the first worksheet
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
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
    
    // Get the header row (first row)
    const headers = data[0];
    console.log('Headers found:', headers);
    
    // Find the column indices for the required columns
    const columnMap = {};
    
    // Define the column names to look for (case insensitive)
    const requiredColumns = {
      kode: ['kode'],
      unitTerakhirPo: ['unit terakhir po', 'unit terakhir po idr'],
      kurs: ['kurs'],
      estimasiHarga: ['estimasi harga'],
      kodePrinciple: ['kode principle']
    };
    
    // Find column indices
    headers.forEach((header, index) => {
      if (header) {
        const headerLower = header.toString().toLowerCase().trim();
        
        Object.keys(requiredColumns).forEach(key => {
          requiredColumns[key].forEach(searchTerm => {
            // Use exact match for "kode" to avoid matching "Kode Principle"
            if (key === 'kode') {
              if (headerLower === searchTerm.toLowerCase()) {
                columnMap[key] = index;
              }
            } else {
              // Use includes for other columns
              if (headerLower.includes(searchTerm.toLowerCase())) {
                columnMap[key] = index;
              }
            }
          });
        });
      }
    });
    
    console.log('Column mapping:', columnMap);
    
    // Check if we found all required columns
    const missingColumns = Object.keys(requiredColumns).filter(key => !(key in columnMap));
    if (missingColumns.length > 0) {
      notifier.alert(`Missing required columns: ${missingColumns.join(', ')}`);
      return [];
    }
    
    // Extract data from rows (skip header row)
    const extractedData = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      const rowData = {
        kode: row[columnMap.kode] || '',
        unitTerakhirPo: row[columnMap.unitTerakhirPo] || '',
        kurs: row[columnMap.kurs] || '',
        estimasiHarga: row[columnMap.estimasiHarga] || '',
        kodePrinciple: row[columnMap.kodePrinciple] || '',
        rowNumber: i + 1
      };
      
      // Only add row if at least kode is not empty
      if (rowData.kode && rowData.kode.toString().trim() !== '') {
        extractedData.push(rowData);
      }
    }
    
    console.log('Extracted data:', extractedData);
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
      await loadHargaBahan();
      
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

      {/* Import Preview Modal */}
      {showImportPreview && (
        <div className="modal-overlay">
          <div className="modal-content large-modal">
            <div className="modal-header">
              <h3>Import Preview - Material Prices</h3>
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
                <p><strong>Processed columns:</strong> Kode, Item Name, Type, Unit, Currency, Price</p>
                {importPreviewData.some(item => item.isDuplicate) && (
                  <p style={{color: '#f59e0b'}}><strong>Note:</strong> Duplicates detected and resolved by selecting highest priced items</p>
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
                          🔄 Duplicates are shown first
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
                            <tr key={startIndex + index}>
                              <td>{row.rowNumber}</td>
                              <td>{row.kode}</td>
                              <td>{row.itemName || 'N/A'}</td>
                              <td>{row.itemType || 'N/A'}</td>
                              <td>{row.finalUnit || row.unitTerakhirPo}</td>
                              <td>{row.finalCurrency || row.kurs}</td>
                              <td>{row.finalPrice || row.estimasiHarga}</td>
                              <td>{row.kodePrinciple || 'N/A'}</td>
                              <td>
                                {row.isDuplicate ? (
                                  <span style={{color: '#f59e0b', fontWeight: 'bold'}}>
                                    🔄 Duplicate (Selected)
                                  </span>
                                ) : (
                                  <span style={{color: '#10b981', fontWeight: 'bold'}}>
                                    ✓ Single
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
              {importPreviewData.length > 0 && importPreviewData[0].itemName && (
                <button 
                  className="btn-primary"
                  onClick={handleFinalImport}
                  disabled={importLoading}
                >
                  {importLoading ? 'Importing...' : 'Import to Database'}
                </button>
              )}
              {(!importPreviewData.length || !importPreviewData[0].itemName) && (
                <button 
                  className="btn-primary"
                  onClick={handleProcessImport}
                  disabled={importLoading}
                >
                  {importLoading ? 'Processing...' : 'Process Import'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HargaBahan;
