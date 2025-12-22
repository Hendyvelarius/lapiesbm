import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api, { productsAPI } from '../services/api';
import AWN from 'awesome-notifications';
import 'awesome-notifications/dist/style.css';
import * as XLSX from 'xlsx';
import { FileDown, FileUp } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/FormulaAssignment.css';

const FormulaAssignment = ({ user }) => {
  // Initialize awesome-notifications inside component to avoid conflicts
  const notifier = useMemo(() => new AWN({
    position: 'top-right',
    durations: {
      global: 5000
    }
  }), []);
  // State management
  const [chosenFormulas, setChosenFormulas] = useState([]);
  const [productList, setProductList] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Year selection states
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [yearLoaded, setYearLoaded] = useState(false); // Prevent race condition with default year
  const [availableYears, setAvailableYears] = useState([]);
  const [importYear, setImportYear] = useState(new Date().getFullYear().toString());
  const [addYear, setAddYear] = useState(new Date().getFullYear().toString());
  
  // Generate year range for imports (current year +/- 2)
  const getImportYearRange = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 2; i <= currentYear + 2; i++) {
      years.push(i.toString());
    }
    return years;
  };
  
  const importYearRange = useMemo(() => getImportYearRange(), []);
  
  // Permission checks
  const canLock = () => {
    // Can lock: RD2 MGR, PL PL, HWA, GWN
    return (user?.empDeptID === 'RD2' && user?.empJobLevelID === 'MGR') ||
           (user?.empDeptID === 'PL' && user?.empJobLevelID === 'PL') ||
           ['HWA', 'GWN'].includes(user?.logNIK);
  };
  
  const canUnlock = () => {
    // Can unlock: PL PL, HWA, GWN
    return (user?.empDeptID === 'PL' && user?.empJobLevelID === 'PL') ||
           ['HWA', 'GWN'].includes(user?.logNIK);
  };
  
  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingFormula, setEditingFormula] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    productId: '',
    productName: '',
    pi: '',
    ps: '',
    kp: '',
    ks: '',
    stdOutput: 0
  });
  
  // Formula selection states
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productFormulas, setProductFormulas] = useState({
    PI: [],
    PS: [],
    KP: [],
    KS: []
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  
  // Recipe and price calculation states
  const [recipeData, setRecipeData] = useState([]);
  const [formulaPrices, setFormulaPrices] = useState({});
  const [totalProductPrice, setTotalProductPrice] = useState(0);
  
  // Recommendation states
  const [recommendations, setRecommendations] = useState([]);
  const [selectedRecommendation, setSelectedRecommendation] = useState('');
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  
  // Table search state
  const [tableSearchTerm, setTableSearchTerm] = useState('');

  // Import-related states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);

  // Fetch default year on component mount
  useEffect(() => {
    const fetchDefaultYear = async () => {
      try {
        const response = await productsAPI.getDefaultYear();
        if (response.success && response.data?.defaultYear) {
          const defaultYear = response.data.defaultYear;
          setSelectedYear(defaultYear);
          setImportYear(defaultYear);
          setAddYear(defaultYear);
        }
      } catch (error) {
        console.error('Failed to fetch default year:', error);
      } finally {
        setYearLoaded(true);
      }
    };

    fetchDefaultYear();
  }, []);
  const [importData, setImportData] = useState([]);
  const [validationResults, setValidationResults] = useState(null);
  const [availableFormulas, setAvailableFormulas] = useState([]);
  const [loadingImport, setLoadingImport] = useState(false);
  const [importStep, setImportStep] = useState('upload'); // 'upload', 'validation', 'confirmation'

  // Filter products based on search term
  useEffect(() => {
    // Get list of product IDs that already have formula assignments
    const assignedProductIds = chosenFormulas.map(formula => formula.Product_ID);
    
    if (!showProductDropdown) {
      // If dropdown is not shown, don't show any products
      setFilteredProducts([]);
    } else if (searchTerm.trim() === '') {
      // If dropdown is shown but no search term, show all unassigned products
      const allUnassigned = productList.filter(product => 
        !assignedProductIds.includes(product.Product_ID)
      );
      setFilteredProducts(allUnassigned);
    } else {
      // Filter based on search term among unassigned products
      const filtered = productList.filter(product => {
        // Only show products that don't already have assignments
        const notAssigned = !assignedProductIds.includes(product.Product_ID);
        
        // And match the search term
        const matchesSearch = product.Product_Name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             product.Product_ID?.toLowerCase().includes(searchTerm.toLowerCase());
        
        return notAssigned && matchesSearch;
      });
      setFilteredProducts(filtered);
    }
  }, [searchTerm, productList, chosenFormulas, showProductDropdown]);

  const loadData = useCallback(async () => {
    if (!yearLoaded) return; // Don't fetch until default year is loaded
    
    try {
      setLoading(true);

      // Load chosen formulas and product list
      const [chosenRes, productsRes, yearsRes] = await Promise.all([
        api.products.getChosenFormula(selectedYear),
        api.master.getProductName(),
        api.products.getAvailableYears()
      ]);

      setChosenFormulas(chosenRes || []);
      setProductList(productsRes?.data || []);
      
      if (yearsRes?.success && yearsRes?.data) {
        setAvailableYears(yearsRes.data);
      }

    } catch (err) {
      console.error('Error loading data:', err);
      notifier.alert('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [notifier, selectedYear, yearLoaded]);

  // Load initial data
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Recalculate price when formulaPrices or editingFormula changes
  useEffect(() => {
    if (editingFormula && Object.keys(formulaPrices).length > 0) {
      const totalPrice = calculateTotalProductPrice(formulaPrices, {
        pi: editingFormula.PI || '',
        ps: editingFormula.PS || '',
        kp: editingFormula.KP || '',
        ks: editingFormula.KS || ''
      });
      setTotalProductPrice(totalPrice);
    }
  }, [formulaPrices, editingFormula]);

  const loadProductFormulas = async (productId) => {
    try {
      setLoading(true);
      
      // Load both formula list and recipe data
      const [formulas, recipe] = await Promise.all([
        api.products.getFormulaById(productId),
        api.products.getRecipe(productId)
      ]);
      
      // Check if we got any formulas
      if (!formulas || formulas.length === 0) {
        setProductFormulas({ PI: [], PS: [], KP: [], KS: [] });
        setRecipeData([]);
        setFormulaPrices({});
        setTotalProductPrice(0);
        return;
      }
      
      // Group formulas by TypeCode
      const grouped = {
        PI: formulas.filter(f => f.TypeCode === 'PI'),
        PS: formulas.filter(f => f.TypeCode === 'PS'),
        KP: formulas.filter(f => f.TypeCode === 'KP'),
        KS: formulas.filter(f => f.TypeCode === 'KS')
      };
      
      setProductFormulas(grouped);
      
      // Store recipe data and calculate formula prices
      setRecipeData(recipe || []);
      const prices = calculateFormulaPrices(recipe || []);
      setFormulaPrices(prices);
      
      // Note: Auto-selection removed to prevent form state inconsistencies
      // Users should manually select formulas to ensure intentional assignments
    } catch (err) {
      console.error('Error loading product formulas:', err);
      notifier.alert(`Failed to load formulas for this product: ${err.message}`);
      // Reset to empty state on error
      setProductFormulas({ PI: [], PS: [], KP: [], KS: [] });
      setRecipeData([]);
      setFormulaPrices({});
      setTotalProductPrice(0);
    } finally {
      setLoading(false);
    }
  };

  // Load formula recommendations for a specific product
  const loadRecommendations = async (productId) => {
    try {
      setLoadingRecommendations(true);
      const result = await api.products.getFormulaRecommendations(productId);
      
      if (result.success && result.data) {
        setRecommendations(result.data);
      } else {
        setRecommendations([]);
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
      setRecommendations([]);
      notifier.warning('Could not load formula recommendations for this product');
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Handle opening edit modal
  const handleEdit = async (formula) => {
    // Check if this specific product is locked
    if (formula.isLock === 1) {
      notifier.warning(`Product ${formula.Product_ID} is locked. Cannot edit formula assignment.`);
      return;
    }
    
    try {
      setLoadingEdit(true);
      setEditingFormula(formula);
      setFormData({
        productId: formula.Product_ID,
        productName: formula.Product_Name || getProductName(formula.Product_ID),
        pi: formula.PI === null || formula.PI === undefined ? null : formula.PI,
        ps: formula.PS === null || formula.PS === undefined ? null : formula.PS,
        kp: formula.KP === null || formula.KP === undefined ? null : formula.KP,
        ks: formula.KS === null || formula.KS === undefined ? null : formula.KS,
        stdOutput: formula.Std_Output || 0
      });
      
      // Reset recommendation selection
      setSelectedRecommendation('');
      
      // Show modal immediately but with loading state
      setShowEditModal(true);
      
      // Load available formulas and recommendations for this product
      await Promise.all([
        loadProductFormulas(formula.Product_ID),
        loadRecommendations(formula.Product_ID)
      ]);
    } finally {
      setLoadingEdit(false);
    }
  };

  // Handle closing the add modal and resetting states
  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setShowProductDropdown(false);
    setSearchTerm('');
    setFilteredProducts([]);
    setSelectedProduct(null);
    setProductFormulas({ PI: [], PS: [], KP: [], KS: [] });
  };

  // Handle opening add modal
  const handleAdd = () => {
    setEditingFormula(null);
    setFormData({
      productId: '',
      productName: '',
      pi: null,
      ps: null,
      kp: null,
      ks: null,
      stdOutput: 0
    });
    setSelectedProduct(null);
    setProductFormulas({ PI: [], PS: [], KP: [], KS: [] });
    setSearchTerm('');
    setFilteredProducts([]);
    // Don't set dropdown to false initially, let the focus event handle it
    setShowAddModal(true);
  };

  // Handle product selection
  const handleProductSelect = async (product) => {
    setSelectedProduct(product);
    setFormData(prev => ({
      ...prev,
      productId: product.Product_ID,
      productName: product.Product_Name
    }));
    setSearchTerm(''); // Clear search term to hide results
    setFilteredProducts([]); // Clear filtered results
    setShowProductDropdown(false); // Close dropdown
    
    // Reset formula state before loading new ones
    setProductFormulas({ PI: [], PS: [], KP: [], KS: [] });
    
    // Load formulas for selected product
    await loadProductFormulas(product.Product_ID);
  };

  // Handle recommendation selection
  const handleRecommendationSelect = (recommendationIndex) => {
    setSelectedRecommendation(recommendationIndex);
    
    if (recommendationIndex === '' || recommendationIndex === 'manual') {
      // User selected "Select Formula" or manual - don't change anything
      return;
    }
    
    const recommendation = recommendations[parseInt(recommendationIndex)];
    if (!recommendation) return;
    
    // Update form data with recommendation
    setFormData(prev => ({
      ...prev,
      pi: recommendation.formulas.PI !== null && recommendation.formulas.PI !== undefined ? recommendation.formulas.PI : null,
      ps: recommendation.formulas.PS !== null && recommendation.formulas.PS !== undefined ? recommendation.formulas.PS : null,
      kp: recommendation.formulas.KP !== null && recommendation.formulas.KP !== undefined ? recommendation.formulas.KP : null,
      ks: recommendation.formulas.KS !== null && recommendation.formulas.KS !== undefined ? recommendation.formulas.KS : null,
      stdOutput: recommendation.stdOutput
    }));
    
    // Update total price
    setTimeout(() => {
      const totalPrice = calculateTotalProductPrice(formulaPrices, {
        pi: recommendation.formulas.PI !== null && recommendation.formulas.PI !== undefined ? recommendation.formulas.PI : '',
        ps: recommendation.formulas.PS !== null && recommendation.formulas.PS !== undefined ? recommendation.formulas.PS : '',
        kp: recommendation.formulas.KP !== null && recommendation.formulas.KP !== undefined ? recommendation.formulas.KP : '',
        ks: recommendation.formulas.KS !== null && recommendation.formulas.KS !== undefined ? recommendation.formulas.KS : ''
      });
      setTotalProductPrice(totalPrice);
    }, 10);
  };

  const handleFormulaSelect = (type, formulaId) => {
    // Check if user is trying to select "No Formula" when formulas are available
    if ((formulaId === undefined || formulaId === null || formulaId === 'NO_FORMULA')) {
      const availableFormulas = productFormulas[type] || [];
      const currentValue = formData[type.toLowerCase()];
      
      // Block "No Formula" selection if:
      // 1. There are available formulas for this type
      // 2. Currently has a formula assigned (not null/undefined)
      if (availableFormulas.length > 0 && currentValue !== null && currentValue !== undefined) {
        notifier.warning(`Cannot set ${type} to "No Formula" when formulas are available and currently assigned. Please select a specific formula instead.`, {
          durations: { warning: 6000 }
        });
        return; // Block the change
      }
      
      // Allow setting to null if conditions are met
      setFormData(prev => {
        const newData = {
          ...prev,
          [type.toLowerCase()]: null
        };
        
        // Recalculate total price with new formula selection
        setTimeout(() => {
          const totalPrice = calculateTotalProductPrice(formulaPrices, newData);
          setTotalProductPrice(totalPrice);
        }, 10);
        
        return newData;
      });
      return;
    }

    // Find the selected formula from the current product's formulas
    const formulas = productFormulas[type] || [];
    const selectedFormula = formulas.find(f => (f.PPI_SubID || '') === formulaId);
    
    if (selectedFormula) {
      const formulaBatchSize = selectedFormula.BatchSize;
      const currentStdOutput = parseFloat(formData.stdOutput) || 0;
      
      // If standard output is 0 or empty, automatically set it to formula batch size
      if (currentStdOutput === 0) {
        setFormData(prev => {
          const newData = {
            ...prev,
            [type.toLowerCase()]: formulaId,
            stdOutput: formulaBatchSize
          };
          
          // Recalculate total price with new formula selection
          setTimeout(() => {
            const totalPrice = calculateTotalProductPrice(formulaPrices, newData);
            setTotalProductPrice(totalPrice);
          }, 10);
          
          return newData;
        });
      } else if (currentStdOutput !== formulaBatchSize) {
        // Show professional confirmation dialog using Awesome Notifications
        const formulaDisplayName = formulaId || '(unnamed)';
        
        notifier.confirm(
          `Your chosen formula "${formulaDisplayName}" has a different output than the product's standard output.\n\nFormula Output: ${formulaBatchSize}\nCurrent Standard Output: ${currentStdOutput}\n\nClick OK to change the standard output to match the formula, or Cancel to keep the current output.`,
          () => {
            // User clicked OK - update both formula and std output
            setFormData(prev => {
              const newData = {
                ...prev,
                [type.toLowerCase()]: formulaId,
                stdOutput: formulaBatchSize
              };
              
              // Recalculate total price with new formula selection
              setTimeout(() => {
                const totalPrice = calculateTotalProductPrice(formulaPrices, newData);
                setTotalProductPrice(totalPrice);
              }, 10);
              
              return newData;
            });
            notifier.success(`Standard output updated from ${currentStdOutput} to ${formulaBatchSize}`);
          },
          () => {
            // User clicked Cancel - update formula but keep current std output
            setFormData(prev => {
              const newData = {
                ...prev,
                [type.toLowerCase()]: formulaId
              };
              
              // Recalculate total price with new formula selection
              setTimeout(() => {
                const totalPrice = calculateTotalProductPrice(formulaPrices, newData);
                setTotalProductPrice(totalPrice);
              }, 10);
              
              return newData;
            });
            notifier.info(`Formula updated, standard output kept at ${currentStdOutput}`);
          }
        );
      } else {
        // Batch sizes match, just update the formula
        setFormData(prev => {
          const newData = {
            ...prev,
            [type.toLowerCase()]: formulaId
          };
          
          // Recalculate total price with new formula selection
          setTimeout(() => {
            const totalPrice = calculateTotalProductPrice(formulaPrices, newData);
            setTotalProductPrice(totalPrice);
          }, 10);
          
          return newData;
        });
      }
    } else {
      // Formula not found, just update with the formulaId (might be empty string)
        setFormData(prev => {
          const newData = {
            ...prev,
            [type.toLowerCase()]: formulaId
          };        // Recalculate total price with new formula selection
        setTimeout(() => {
          const totalPrice = calculateTotalProductPrice(formulaPrices, newData);
          setTotalProductPrice(totalPrice);
        }, 10);
        
        return newData;
      });
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.productId) {
      notifier.warning('Please select a product before submitting the form');
      return;
    }

    // For new assignments, check if product already has an assignment
    if (!editingFormula) {
      const existingAssignment = chosenFormulas.find(formula => formula.Product_ID === formData.productId);
      if (existingAssignment) {
        notifier.warning(`Product ${formData.productId} already has a formula assignment. Please edit the existing assignment or select a different product.`);
        return;
      }
    }

    try {
      setLoading(true);
      
      if (editingFormula) {
        // Update existing
        await api.products.updateChosenFormula(formData.productId, {
          pi: formData.pi,
          ps: formData.ps,
          kp: formData.kp,
          ks: formData.ks,
          stdOutput: formData.stdOutput,
          isManual: 1,  // Default to manual (important)
          periode: selectedYear  // Use the selected year, not current year
        });
        notifier.success(`Formula assignment updated successfully for product ${formData.productId}`);
      } else {
        // Add new
        const userName = user?.logNIK || 'SYSTEM';
        console.log('Add - user.logNIK:', user?.logNIK, 'userName:', userName);
        const dataToSend = {
          ...formData,
          isManual: 1,  // Default to manual (important)
          periode: addYear,
          userId: userName,
          delegatedTo: userName
        };
        await api.products.addChosenFormula(dataToSend);
        notifier.success(`Formula assignment added successfully for product ${formData.productId}`);
      }

      // Reload data and close modal
      await loadData();
      setShowEditModal(false);
      handleCloseAddModal();
    } catch (err) {
      console.error('Error saving formula:', err);
      notifier.alert('Failed to save formula assignment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle delete - show custom confirmation modal
  const handleDelete = (formula) => {
    // Check if this specific product is locked
    if (formula.isLock === 1) {
      notifier.warning(`Product ${formula.Product_ID} is locked. Cannot delete formula assignment.`);
      return;
    }
    
    setDeletingProduct(formula.Product_ID);
    setShowDeleteModal(true);
  };

  // Confirm delete action
  const confirmDelete = async () => {
    if (!deletingProduct) return;
    
    try {
      setLoading(true);
      await api.products.deleteChosenFormula(deletingProduct, selectedYear);
      await loadData();
      notifier.success(`Formula assignment deleted successfully for product ${deletingProduct}`);
    } catch (err) {
      console.error('Error deleting formula:', err);
      notifier.alert('Failed to delete formula assignment. Please try again.');
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
      setDeletingProduct(null);
    }
  };

  // Cancel delete action
  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingProduct(null);
  };

  // Handle generate HPP for a specific product
  const handleGenerate = async (productId) => {
    try {
      setLoading(true);
      
      // Show confirmation dialog
      notifier.confirm(
        `Generate HPP calculation for product ${productId}?\n\nThis will run the HPP calculation process using the current formula assignments for this product.`,
        async () => {
          try {
            notifier.info(`Starting HPP generation for product ${productId}...`, {
              durations: { info: 3000 }
            });
            
            // Call the API to generate HPP
            const result = await api.products.generateHPP(productId);
            
            if (result.success) {
              notifier.success(`HPP generation completed successfully for product ${productId}!`, {
                durations: { success: 5000 }
              });
            } else {
              throw new Error(result.message || 'HPP generation failed');
            }
          } catch (error) {
            console.error('Error generating HPP:', error);
            notifier.alert(`Failed to generate HPP for product ${productId}: ${error.message}`);
          } finally {
            setLoading(false);
          }
        },
        () => {
          // User cancelled
          setLoading(false);
        },
        {
          title: 'Generate HPP',
          okButtonText: 'Generate',
          cancelButtonText: 'Cancel'
        }
      );
    } catch (error) {
      console.error('Error in handleGenerate:', error);
      notifier.alert('An unexpected error occurred while preparing HPP generation.');
      setLoading(false);
    }
  };

  // Handle auto assignment
  const handleAutoAssign = () => {
    notifier.confirm(
      'This will replace ALL existing formula assignments with automatically calculated optimal assignments based on cost analysis. Are you sure you want to proceed?',
      async () => {
        try {
          setLoading(true);
          notifier.info('Processing auto assignment... This will take some time. Please wait and do not close the browser.');
          
          const result = await api.products.autoAssignFormulas();
          await loadData(); // Reload the data to show new assignments
          
          notifier.success(`Auto assignment completed successfully! ${result.data.processed} products were assigned formulas.`);
        } catch (err) {
          console.error('Error during auto assignment:', err);
          notifier.alert('Failed to perform auto assignment. Please try again.');
        } finally {
          setLoading(false);
        }
      },
      () => {
        // User cancelled
      },
      {
        title: 'Auto Assign Formulas',
        okButtonText: 'Proceed',
        cancelButtonText: 'Cancel'
      }
    );
  };

  // Handle lock/unlock all year
  const handleLockAllYear = async (lockValue) => {
    const action = lockValue === 1 ? 'lock' : 'unlock';
    
    // Check permissions
    if (action === 'lock' && !canLock()) {
      notifier.warning('You do not have permission to lock years.');
      return;
    }
    if (action === 'unlock' && !canUnlock()) {
      notifier.warning('You do not have permission to unlock years.');
      return;
    }
    
    // Check if HPP has been generated for this year before locking
    if (action === 'lock') {
      try {
        setLoading(true);
        const hppData = await api.hpp.getResults(parseInt(selectedYear));
        
        // Check if HPP data exists for this year
        const hasHPPData = hppData && (
          (hppData.ethical && hppData.ethical.length > 0) ||
          (hppData.generik1 && hppData.generik1.length > 0) ||
          (hppData.generik2 && hppData.generik2.length > 0)
        );
        
        if (!hasHPPData) {
          setLoading(false);
          notifier.warning(
            `Cannot lock year ${selectedYear} because HPP has not been generated yet. Please generate HPP first in the Generate HPP page before locking.`,
            { durations: { warning: 8000 } }
          );
          return;
        }
        
        setLoading(false);
      } catch (error) {
        setLoading(false);
        console.error('Error checking HPP data:', error);
        notifier.alert('Failed to verify HPP data. Please try again.');
        return;
      }
    }
    
    notifier.confirm(
      `Are you sure you want to ${action} ALL products in year ${selectedYear}? ${lockValue === 1 ? 'This will prevent any modifications to all formula assignments for this year.' : 'This will allow modifications to all formula assignments in this year.'}`,
      async () => {
        try {
          setLoading(true);
          
          const result = await api.products.lockYear(selectedYear.toString(), lockValue);
          
          if (result.success) {
            notifier.success(`All products in year ${selectedYear} ${action}ed successfully!`);
            await loadData(); // Reload to get updated isLock values
          } else {
            throw new Error(result.message || `Failed to ${action} year`);
          }
        } catch (error) {
          console.error(`Error ${action}ing year:`, error);
          notifier.alert(`Failed to ${action} year ${selectedYear}. ${error.message}`);
        } finally {
          setLoading(false);
        }
      },
      () => {
        // User cancelled
      },
      {
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} All Year ${selectedYear}`,
        okButtonText: action.charAt(0).toUpperCase() + action.slice(1),
        cancelButtonText: 'Cancel'
      }
    );
  };

  // Handle lock/unlock individual product
  const handleLockProduct = async (productId, currentLockStatus) => {
    const action = currentLockStatus === 1 ? 'unlock' : 'lock';
    
    // Check permissions
    if (action === 'lock' && !canLock()) {
      notifier.warning('You do not have permission to lock products.');
      return;
    }
    if (action === 'unlock' && !canUnlock()) {
      notifier.warning('You do not have permission to unlock products.');
      return;
    }
    
    notifier.confirm(
      `Are you sure you want to ${action} product ${productId}?`,
      async () => {
        try {
          setLoading(true);
          
          // Call API to lock/unlock individual product
          const result = await api.products.lockProduct(productId, selectedYear.toString(), currentLockStatus === 1 ? 0 : 1);
          
          if (result.success) {
            notifier.success(`Product ${productId} ${action}ed successfully!`);
            await loadData(); // Reload to get updated isLock values
          } else {
            throw new Error(result.message || `Failed to ${action} product`);
          }
        } catch (error) {
          console.error(`Error ${action}ing product:`, error);
          notifier.alert(`Failed to ${action} product ${productId}. ${error.message}`);
        } finally {
          setLoading(false);
        }
      },
      () => {
        // User cancelled
      },
      {
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} Product`,
        okButtonText: action.charAt(0).toUpperCase() + action.slice(1),
        cancelButtonText: 'Cancel'
      }
    );
  };

  // Handle export to Excel
  const handleExportExcel = () => {
    try {
      // Helper function to format formula values for export
      const formatFormulaForExport = (formulaValue) => {
        if (formulaValue === null || formulaValue === undefined) {
          return '-'; // Unassigned formula
        } else if (formulaValue === '') {
          return ''; // Empty string formula (blank in Excel)
        } else {
          return formulaValue; // Named formula
        }
      };

      // Create a map of existing formula assignments for quick lookup
      const formulaMap = new Map();
      chosenFormulas.forEach(formula => {
        formulaMap.set(formula.Product_ID, formula);
      });

      // Prepare data for export - include ALL products
      const exportData = productList.map(product => {
        const existingFormula = formulaMap.get(product.Product_ID);
        
        if (existingFormula) {
          // Product has formula assignment - use proper formatting
          return {
            Product_ID: product.Product_ID,
            Product_Name: product.Product_Name,
            PI: formatFormulaForExport(existingFormula.PI),
            PS: formatFormulaForExport(existingFormula.PS),
            KP: formatFormulaForExport(existingFormula.KP),
            KS: formatFormulaForExport(existingFormula.KS)
          };
        } else {
          // Product has no formula assignment - all formulas are unassigned (-)
          return {
            Product_ID: product.Product_ID,
            Product_Name: product.Product_Name,
            PI: '-',
            PS: '-',
            KP: '-',
            KS: '-'
          };
        }
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData, {
        header: ['Product_ID', 'Product_Name', 'PI', 'PS', 'KP', 'KS']
      });

      // Set column widths for better readability
      ws['!cols'] = [
        { wch: 15 }, // Product_ID
        { wch: 30 }, // Product_Name
        { wch: 15 }, // PI
        { wch: 15 }, // PS
        { wch: 15 }, // KP
        { wch: 15 }  // KS
      ];

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Formula Assignments');

      // Generate filename with current date
      const now = new Date();
      const dateStr = now.getFullYear() + 
                     String(now.getMonth() + 1).padStart(2, '0') + 
                     String(now.getDate()).padStart(2, '0');
      const filename = `Formula_Assignments_${dateStr}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      
      const assignedCount = chosenFormulas.length;
      const unassignedCount = productList.length - assignedCount;
      notifier.success(`Excel file exported successfully! (${exportData.length} products: ${assignedCount} assigned, ${unassignedCount} unassigned)`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      notifier.alert('Failed to export Excel file. Please try again.');
    }
  };

  // Handle import Excel
  const handleImportExcel = () => {
    setShowImportModal(true);
    setImportStep('upload');
    setImportFile(null);
    setImportData([]);
    setValidationResults(null);
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      notifier.warning('Please select a valid Excel file (.xlsx or .xls)');
      return;
    }

    setImportFile(file);
  };

  // Process raw Excel data to group by Product_ID and filter by HPP='aktif'
  const processRawExcelData = (rawData) => {
    console.log('Processing raw Excel data:', rawData);
    
    // Group by Product_ID
    const groupedByProduct = {};
    
    rawData.forEach((row, index) => {
      const productId = row.Product_ID?.toString().trim();
      if (!productId) {
        console.warn(`Row ${index + 1}: Missing Product_ID, skipping`);
        return;
      }
      
      if (!groupedByProduct[productId]) {
        groupedByProduct[productId] = {
          Product_ID: productId,
          Product_Name: row.Product_Name?.toString().trim() || '',
          formulas: []
        };
      }
      
      // Add this formula to the product
      groupedByProduct[productId].formulas.push({
        TypeCode: row.TypeCode?.toString().trim(),
        TypeName: row.TypeName?.toString().trim() || '', // Optional
        PPI_SubID: row.PPI_SubID?.toString().trim(),
        BatchSize: parseFloat(row.BatchSize) || 0,
        COGS: row['HPP']?.toString().trim(),
        ppi_owner: row.ppi_owner?.toString().trim() || '', // Optional
        Total: row.Total || '', // Optional
        Item_type: row.Item_type?.toString().trim() || '', // Optional
        production: row.production || '' // Optional
      });
    });
    
    console.log('Grouped by product:', groupedByProduct);
    
    // Filter each product's formulas to only include HPP='aktif' (case insensitive)
    const processedProducts = [];
    
    Object.values(groupedByProduct).forEach(product => {
      const activeFormulas = product.formulas.filter(formula => 
        formula.COGS?.toLowerCase() === 'aktif'
      );
      
      if (activeFormulas.length > 0) {
        processedProducts.push({
          ...product,
          formulas: activeFormulas
        });
      }
    });
    
    console.log('Processed products with active formulas:', processedProducts);
    
    return processedProducts;
  };

  // Parse Excel file and validate data
  const handleParseAndValidate = async () => {
    if (!importFile) {
      notifier.warning('Please select a file first');
      return;
    }

    try {
      setLoadingImport(true);
      
      // Read Excel file
      const rawData = await readExcelFile(importFile);
      
      // Process the raw data (group by Product_ID, filter by HPP='aktif')
      const processedData = processRawExcelData(rawData);
      
      // Load available formulas from API (not needed anymore but keeping for compatibility)
      const formulas = await api.products.getFormula();
      setAvailableFormulas(formulas);
      
      // Validate the processed data
      const validation = validateImportData(processedData, formulas, productList);
      
      setImportData(processedData);
      setValidationResults(validation);
      
      if (validation.isValid) {
        setImportStep('confirmation');
      } else {
        setImportStep('validation');
      }
      
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      notifier.alert('Failed to parse Excel file. Please check the file format and try again.');
    } finally {
      setLoadingImport(false);
    }
  };

  // Read Excel file and return parsed data
  const readExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Look for "Summary Per SubID" sheet
          const targetSheetName = 'Summary Per SubID';
          let sheetName = null;
          
          // Find the exact sheet name (case-insensitive)
          for (const name of workbook.SheetNames) {
            if (name.toLowerCase() === targetSheetName.toLowerCase()) {
              sheetName = name;
              break;
            }
          }
          
          if (!sheetName) {
            throw new Error(`Sheet "${targetSheetName}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`);
          }
          
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          // Validate Excel format
          if (jsonData.length === 0) {
            throw new Error(`Sheet "${sheetName}" is empty`);
          }
          
          // Essential columns that we actually use (based on requirements)
          const requiredColumns = ['TypeCode', 'PPI_SubID', 'Product_ID', 'Product_Name', 'BatchSize', 'HPP'];
          // Optional columns (we ignore these but they might be present)
          const optionalColumns = ['ppi_owner', 'TypeName', 'Total', 'Item_type', 'production'];
          
          const firstRow = jsonData[0];
          const missingColumns = requiredColumns.filter(col => !(col in firstRow));
          
          if (missingColumns.length > 0) {
            throw new Error(`Missing required columns in "${sheetName}" sheet: ${missingColumns.join(', ')}`);
          }
          
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Validate import data against available formulas and products
  const validateImportData = (processedData, formulas, products) => {
    const errors = [];
    const warnings = [];
    const validProducts = new Set(products.map(p => p.Product_ID));
    const validTypeCodes = new Set(['PI', 'PS', 'KP', 'KS']);
    
    processedData.forEach((product, index) => {
      const productId = product.Product_ID;
      
      // Validate product existence
      if (!validProducts.has(productId)) {
        errors.push(`Product "${productId}" does not exist in the system`);
        return;
      }
      
      // Check for duplicate TypeCodes within the same product
      const typeCodeCounts = {};
      const batchSizes = new Set();
      
      product.formulas.forEach((formula, formulaIndex) => {
        const typeCode = formula.TypeCode;
        
        // Validate TypeCode
        if (!validTypeCodes.has(typeCode)) {
          errors.push(`Product "${productId}": Invalid TypeCode "${typeCode}". Must be one of: PI, PS, KP, KS`);
          return;
        }
        
        // Count TypeCodes for duplicate detection
        typeCodeCounts[typeCode] = (typeCodeCounts[typeCode] || 0) + 1;
        
        // Collect BatchSizes for consistency check
        if (formula.BatchSize > 0) {
          batchSizes.add(formula.BatchSize);
        }
      });
      
      // Check for duplicate TypeCodes
      Object.entries(typeCodeCounts).forEach(([typeCode, count]) => {
        if (count > 1) {
          const duplicateFormulas = product.formulas
            .filter(f => f.TypeCode === typeCode)
            .map(f => `${f.PPI_SubID || '(empty)'} (Batch: ${f.BatchSize})`)
            .join(', ');
          errors.push(`Product "${productId}": Multiple active ${typeCode} formulas detected: ${duplicateFormulas}. Only one active formula per TypeCode is allowed.`);
        }
      });
      
      // Check BatchSize consistency
      if (batchSizes.size > 1) {
        const sizesArray = Array.from(batchSizes).sort((a, b) => a - b);
        errors.push(`Product "${productId}": All active formulas must have the same BatchSize. Found: ${sizesArray.join(', ')}`);
      }
      
      // Validate that at least one formula exists
      if (product.formulas.length === 0) {
        warnings.push(`Product "${productId}": No active formulas found (no HPP='aktif' entries)`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        totalProducts: processedData.length,
        validProducts: processedData.filter(p => validProducts.has(p.Product_ID)).length,
        invalidProducts: processedData.filter(p => !validProducts.has(p.Product_ID)).length,
        totalActiveFormulas: processedData.reduce((sum, p) => sum + p.formulas.length, 0)
      }
    };
  };

  // Perform bulk import
  const handleConfirmImport = async () => {
    if (!validationResults?.isValid) {
      notifier.warning('Please fix validation errors before importing');
      return;
    }

    // Check if the import year is locked
    const isImportYearLocked = chosenFormulas.some(f => f.Periode === parseInt(importYear) && f.isLock === 1);
    if (isImportYearLocked) {
      notifier.warning(`Year ${importYear} is locked. Cannot import formula assignments.`);
      return;
    }

    try {
      setLoadingImport(true);
      
      // Transform import data to the format expected by backend
      const transformedData = transformImportData(importData, availableFormulas);
      
      // Call API to perform bulk import (need to create this endpoint)
      await api.products.bulkImportFormulas(transformedData);
      
      // Reload data and close modal
      await loadData();
      setShowImportModal(false);
      
      notifier.success(`Successfully imported ${transformedData.length} formula assignments!`);
      
    } catch (error) {
      console.error('Error importing formulas:', error);
      notifier.alert('Failed to import formulas. Please try again.');
    } finally {
      setLoadingImport(false);
    }
  };

  // Transform import data to backend format
  const transformImportData = (processedData, formulas) => {
    // Note: process_date is handled by the backend to ensure correct local timezone
    const userName = user?.logNIK || 'SYSTEM';
    console.log('Import - user.logNIK:', user?.logNIK, 'userName:', userName);
    
    return processedData.map(product => {
      const productId = product.Product_ID;
      
      // Initialize formula assignments
      const assignments = {
        PI: null,
        PS: null,
        KP: null,
        KS: null
      };
      
      // Get BatchSize (all formulas should have the same BatchSize after validation)
      let stdOutput = 0;
      
      // Process each active formula for this product
      product.formulas.forEach(formula => {
        const typeCode = formula.TypeCode;
        if (assignments.hasOwnProperty(typeCode)) {
          assignments[typeCode] = formula.PPI_SubID || ''; // Use PPI_SubID for formula assignment
          if (formula.BatchSize > 0) {
            stdOutput = formula.BatchSize;
          }
        }
      });
      
      return {
        Periode: importYear,
        Product_ID: productId,
        PI: assignments.PI,
        PS: assignments.PS,
        KP: assignments.KP,
        KS: assignments.KS,
        Std_Output: stdOutput,
        isManual: null,
        user_id: userName,
        delegated_to: userName,
        process_date: null, // Backend will set this with local timezone
        flag_update: null,
        from_update: null
      };
    });
  };

  // Close import modal
  const handleCloseImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportData([]);
    setValidationResults(null);
    setImportStep('upload');
  };

  // Helper function to get product name
  const getProductName = (productId) => {
    const product = productList.find(p => p.Product_ID === productId);
    return product ? product.Product_Name : productId;
  };

  // Helper function to format currency
  const formatCurrency = (amount) => {
    if (!amount || isNaN(amount)) return '0';
    return parseFloat(amount).toLocaleString('id-ID');
  };

  // Helper function to calculate formula prices from recipe data
  const calculateFormulaPrices = (recipeData) => {
    const formulaPrices = {};
    
    // Group by TypeCode and PPI_SubID
    recipeData.forEach(item => {
      const key = `${item.TypeCode}-${item.PPI_SubID}`;
      if (!formulaPrices[key]) {
        formulaPrices[key] = {
          typeCode: item.TypeCode,
          subId: item.PPI_SubID,
          typeName: item.TypeName,
          totalPrice: 0
        };
      }
      
      // Add UnitPrice to the total (UnitPrice is already the total price per ingredient)
      const unitPrice = parseFloat(item.UnitPrice) || 0;
      formulaPrices[key].totalPrice += unitPrice;
    });
    
    return formulaPrices;
  };

  // Helper function to calculate total product price based on current formula selection
  const calculateTotalProductPrice = (formulaPrices, currentSelection) => {
    let total = 0;
    
    // For each type (PI, PS, KP, KS), add the price of the selected formula
    ['PI', 'PS', 'KP', 'KS'].forEach(typeCode => {
      const selectedFormula = currentSelection[typeCode.toLowerCase()];
      
      // Check if formula is selected (not null/undefined, but empty string is valid)
      if (selectedFormula !== null && selectedFormula !== undefined) {
        const key = `${typeCode}-${selectedFormula}`;
        
        if (formulaPrices[key]) {
          total += formulaPrices[key].totalPrice;
        }
      }
    });
    
    return total;
  };

  // Helper function to calculate formula completeness (PI, KP, KS only - excluding PS)
  const calculateFormulaCompleteness = (formulas) => {
    let count = 0;
    if (formulas.PI !== null && formulas.PI !== undefined) count++;
    if (formulas.KP !== null && formulas.KP !== undefined) count++;
    if (formulas.KS !== null && formulas.KS !== undefined) count++;
    return count;
  };

  // Helper function to get the maximum completeness among all recommendations
  const getMaxCompleteness = (recommendations) => {
    if (!recommendations || recommendations.length === 0) return 0;
    return Math.max(...recommendations.map(rec => calculateFormulaCompleteness(rec.formulas)));
  };

  // Helper function to determine if a recommendation is complete
  const isRecommendationComplete = (recommendation, maxCompleteness) => {
    const completeness = calculateFormulaCompleteness(recommendation.formulas);
    return completeness === maxCompleteness && completeness === 3; // Complete means all 3 (PI, KP, KS) are set
  };

  // Helper function to get formula details - distinguish between null and unnamed
  const getFormulaDetails = (formulaId) => {
    if (formulaId === null || formulaId === undefined) {
      return '-';  // Truly empty/null
    } else if (formulaId === '') {
      return ' '; // Assigned but unnamed formula (single space instead of ORI)
    } else {
      return formulaId; // Normal named formula
    }
  };

  // Filter and sort chosen formulas based on search term and importance
  const filteredChosenFormulas = chosenFormulas
    .filter(formula => {
      if (!tableSearchTerm.trim()) return true;
      
      const searchLower = tableSearchTerm.toLowerCase();
      const productName = getProductName(formula.Product_ID);
      
      return formula.Product_ID.toLowerCase().includes(searchLower) ||
             productName.toLowerCase().includes(searchLower);
    })
    .sort((a, b) => {
      // Sort by isManual first (important products first)
      if (a.isManual === 1 && b.isManual !== 1) return -1;
      if (a.isManual !== 1 && b.isManual === 1) return 1;
      
      // Then sort by Product_ID for consistent ordering
      return a.Product_ID.localeCompare(b.Product_ID);
    });

  if (loading && chosenFormulas.length === 0) {
    return (
      <div className="formula-assignment-container">
        <LoadingSpinner 
          message="Loading formula assignments..." 
          size="large" 
        />
      </div>
    );
  }

  return (
    <div className="formula-assignment-container">
      <div className="content-section">
        <div className="section-header">
          <div className="year-selector-container">
            <label htmlFor="year-selector">Year:</label>
            <select
              id="year-selector"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="year-selector"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            {canLock() && (
              <button
                onClick={() => handleLockAllYear(1)}
                className="btn-lock-year"
                title="Lock all products in this year"
              >
                🔒 Lock All
              </button>
            )}
            {canUnlock() && (
              <button
                onClick={() => handleLockAllYear(0)}
                className="btn-unlock-year"
                title="Unlock all products in this year"
              >
                🔓 Unlock All
              </button>
            )}
          </div>
          {tableSearchTerm.trim() && (
            <span className="search-results-count">
              {filteredChosenFormulas.length} of {chosenFormulas.length} results
            </span>
          )}
          <div className="header-actions">
            <div className="table-search">
              <input
                type="text"
                placeholder="Search by Product ID or Name..."
                value={tableSearchTerm}
                onChange={(e) => setTableSearchTerm(e.target.value)}
                className="table-search-input"
              />
            </div>
            <button 
              onClick={handleExportExcel}
              className="btn-secondary export-btn"
              disabled={loading || productList.length === 0}
              title="Export all products with formula assignments to Excel (includes unassigned products)"
              style={{ display: 'none' }}
            >
              <FileDown size={16} />
              Export Excel
            </button>
            <button 
              onClick={handleImportExcel}
              className="btn-secondary import-btn"
              disabled={loading || chosenFormulas.some(f => f.isLock === 1)}
              title="Import formula assignments from Excel file"
            >
              <FileUp size={16} />
              Import Excel
            </button>
            {/* Auto Assignment button temporarily hidden */}
            <button 
              onClick={handleAutoAssign} 
              className="btn-secondary auto-assign-btn"
              disabled={loading}
              title="Automatically assign optimal formulas based on cost analysis"
              style={{ display: 'none' }}
            >
              Auto Assignment
            </button>
            <button 
              onClick={handleAdd} 
              className="btn-primary"
            >
              Add New Assignment
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="formula-assignment-table">
            <thead>
              <tr>
                <th>Product ID</th>
                <th>Product Name</th>
                <th>PI</th>
                <th>PS</th>
                <th>KP</th>
                <th>KS</th>
                <th>Std Output</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredChosenFormulas.length === 0 ? (
                <tr>
                  <td colSpan="8" className="no-data">
                    {tableSearchTerm.trim() 
                      ? `No formula assignments found matching "${tableSearchTerm}".`
                      : "No formula assignments found. Click \"Add New Assignment\" to get started."
                    }
                  </td>
                </tr>
              ) : (
                filteredChosenFormulas.map((formula, index) => (
                  <tr key={`${formula.Product_ID}-${index}`}>
                    <td>{formula.Product_ID}</td>
                    <td>{getProductName(formula.Product_ID)}</td>
                    <td>{getFormulaDetails(formula.PI)}</td>
                    <td>{getFormulaDetails(formula.PS)}</td>
                    <td>{getFormulaDetails(formula.KP)}</td>
                    <td>{getFormulaDetails(formula.KS)}</td>
                    <td>{formula.Std_Output || 0}</td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleEdit(formula);
                          }}
                          className="btn-edit"
                          type="button"
                          disabled={loadingEdit || formula.isLock === 1}
                        >
                          {loadingEdit ? (
                            <>
                              <div className="esbm-spinner esbm-spinner-small" style={{ marginRight: '8px' }}></div>
                              Loading...
                            </>
                          ) : (
                            'Edit'
                          )}
                        </button>
                        {((formula.isLock === 1 && canUnlock()) || (formula.isLock !== 1 && canLock())) && (
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleLockProduct(formula.Product_ID, formula.isLock);
                            }}
                            className={formula.isLock === 1 ? "btn-unlock" : "btn-lock"}
                            type="button"
                          >
                            {formula.isLock === 1 ? 'Unlock' : 'Lock'}
                          </button>
                        )}
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete(formula);
                          }}
                          className="btn-delete"
                          type="button"
                          disabled={formula.isLock === 1}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={handleCloseAddModal}>
          <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Formula Assignment</h3>
              <button onClick={handleCloseAddModal} className="close-btn">×</button>
            </div>
            
            <div className="modal-body-scrollable">
              <form onSubmit={handleSubmit} className="formula-form">
              {/* Year Selection */}
              <div className="form-section">
                <h4>1. Select Year</h4>
                <div className="year-selector-section">
                  <label htmlFor="add-year-selector">Assign formulas for year:</label>
                  <select
                    id="add-year-selector"
                    value={addYear}
                    onChange={(e) => setAddYear(e.target.value)}
                    className="year-selector-import"
                  >
                    {importYearRange.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Product Selection */}
              <div className="form-section">
                <h4>2. Select Product</h4>
                <div className="product-stats">
                  {productList.length - chosenFormulas.length > 0 ? (
                    <small>
                      {productList.length - chosenFormulas.length} products available for assignment 
                      ({chosenFormulas.length} already assigned)
                    </small>
                  ) : (
                    <small style={{color: '#dc2626'}}>
                      All products ({productList.length}) already have formula assignments. 
                      Edit existing assignments instead.
                    </small>
                  )}
                </div>
                <div className="product-search">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setShowProductDropdown(true)}
                    onBlur={() => {
                      // Delay hiding to allow clicking on products
                      setTimeout(() => setShowProductDropdown(false), 200);
                    }}
                    placeholder={productList.length - chosenFormulas.length > 0 
                      ? "Click here to see all available products, or type to search..."
                      : "No products available - all are assigned"
                    }
                    className="search-input"
                    disabled={productList.length - chosenFormulas.length === 0}
                  />

                  {/* Show search results when dropdown is open */}
                  {showProductDropdown && (
                    <div className="search-results" style={{ 
                      position: 'absolute',
                      top: '100%',
                      left: '0',
                      right: '0',
                      background: 'white',
                      border: '1px solid #e9ecef',
                      borderTop: 'none',
                      borderRadius: '0 0 6px 6px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}>
                      {filteredProducts.length === 0 && searchTerm.trim() ? (
                        <div className="search-result-item no-results">
                          <span>No available products found matching "{searchTerm}"</span>
                          <small>Only products without existing formula assignments are shown</small>
                        </div>
                      ) : filteredProducts.length === 0 && !searchTerm.trim() ? (
                        <div className="search-result-item no-results">
                          <span>All products have been assigned formulas</span>
                          <small>No unassigned products available</small>
                        </div>
                      ) : (
                        <>
                          {searchTerm.trim() === '' && (
                            <div className="search-result-header">
                              <small>Available products ({filteredProducts.length})</small>
                            </div>
                          )}
                          {filteredProducts.slice(0, 10).map(product => (
                            <div 
                              key={product.Product_ID}
                              className="search-result-item"
                              onClick={() => handleProductSelect(product)}
                            >
                              <strong>{product.Product_ID}</strong> - {product.Product_Name}
                            </div>
                          ))}
                          {filteredProducts.length > 10 && (
                            <div className="search-result-item more-results">
                              <small>... and {filteredProducts.length - 10} more. Type to narrow down results.</small>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
                
                {selectedProduct && (
                  <div className="selected-product">
                    <strong>Selected:</strong> {selectedProduct.Product_ID} - {selectedProduct.Product_Name}
                  </div>
                )}
              </div>

              {/* Formula Selection */}
              {selectedProduct && (
                <div className="form-section">
                  <h4>3. Select Formulas</h4>
                  {loading ? (
                    <div className="formula-loading">
                      <p>Loading formulas for {selectedProduct.Product_Name}...</p>
                    </div>
                  ) : (
                    <div className="formula-grid">
                      {Object.entries(productFormulas).map(([type, formulas]) => (
                        <div key={type} className="formula-type-section">
                          <h5>{type} Formulas</h5>
                          {formulas.length > 0 ? (
                            <select
                              value={(() => {
                                const currentValue = formData[type.toLowerCase()];
                                // If current value is null or undefined, show NO_FORMULA
                                if (currentValue === null || currentValue === undefined) {
                                  return 'NO_FORMULA';
                                }
                                // Check if current value exists in available formulas
                                const existsInFormulas = formulas.some(f => (f.PPI_SubID || '') === currentValue);
                                if (existsInFormulas) {
                                  return currentValue;
                                }
                                // If current value doesn't exist in formulas, show NO_FORMULA
                                return 'NO_FORMULA';
                              })()}
                              onChange={(e) => handleFormulaSelect(type, e.target.value === 'NO_FORMULA' ? null : e.target.value)}
                              className="formula-select"
                            >
                              <option value="NO_FORMULA">-- No Formula --</option>
                              {formulas.map((formula, idx) => (
                                <option key={`${type}-${formula.PPI_SubID || 'empty'}-${idx}`} value={formula.PPI_SubID || ''}>
                                  {formula.PPI_SubID || ' '} {formula.Default === 'Aktif' ? '(DEF) ' : ''}(Output: {formula.BatchSize})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="no-formulas-available">
                              <span>No {type} formulas available for this product</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Standard Output and Important */}
              {selectedProduct && (
                <div className="form-section">
                  <h4>4. Set Standard Output</h4>
                  <div className="output-and-cost-section">
                    <div className="std-output-field">
                      <label>Standard Output:</label>
                      <input
                        type="number"
                        value={formData.stdOutput}
                        onChange={(e) => setFormData(prev => ({ ...prev, stdOutput: e.target.value }))}
                        className="input-field"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    

                    
                    <div className="total-cost-field">
                      <label>Total Product Cost:</label>
                      <div className="price-value">
                        {totalProductPrice > 0 ? formatCurrency(totalProductPrice) : 'Not calculated'}
                      </div>
                    </div>
                  </div>
                  
                  {totalProductPrice > 0 && (
                    <div className="price-note">
                      <small>* Based on selected formula combination</small>
                    </div>
                  )}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" onClick={handleCloseAddModal} className="btn-secondary">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={!formData.productId || loading}
                >
                  {loading ? 'Saving...' : 'Save Assignment'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Formula Assignment</h3>
              <button onClick={() => setShowEditModal(false)} className="close-btn">×</button>
            </div>
            
            <div className="modal-body-scrollable">
              <form onSubmit={handleSubmit} className="formula-form">
              <div className="form-section">
                <div className="product-and-recommendations">
                  <div className="selected-product">
                    <strong>Product:</strong> {formData.productId} - {formData.productName}
                  </div>
                  
                  {/* Recommended Formula Sets */}
                  <div className="recommendations-section">
                    <label>Recommended Formula Set:</label>
                    {loadingRecommendations ? (
                      <div className="loading-recommendations">
                        <span>Loading recommendations...</span>
                      </div>
                    ) : (
                      <select
                        value={selectedRecommendation}
                        onChange={(e) => handleRecommendationSelect(e.target.value)}
                        className="recommendation-select"
                      >
                        <option value="">-- Select Formula Set --</option>
                        {(() => {
                          const maxCompleteness = getMaxCompleteness(recommendations);
                          return recommendations.map((rec, index) => {
                            const completeness = calculateFormulaCompleteness(rec.formulas);
                            const isComplete = isRecommendationComplete(rec, maxCompleteness);
                            const completenessText = `(${completeness}/3 formulas)`;
                            
                            return (
                              <option 
                                key={index} 
                                value={index}
                                className={isComplete ? 'complete-formula' : 'incomplete-formula'}
                                style={{
                                  backgroundColor: isComplete ? '#dcfce7' : '#fed7aa',
                                  color: isComplete ? '#166534' : '#c2410c'
                                }}
                              >
                                Batch {rec.stdOutput} - Cost: {formatCurrency(rec.totalCost)} {completenessText}
                              </option>
                            );
                          });
                        })()}
                        <option value="manual">Manual Selection</option>
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* Formula Selection for Edit */}
              <div className="form-section" key={`edit-formulas-${formData.productId}`}>
                <h4>Update Formula Selection</h4>
                <div className="formula-grid">
                  {Object.entries(productFormulas).map(([type, formulas]) => (
                    <div key={type} className="formula-type-section">
                      <h5>{type} Formulas</h5>
                      {formulas.length > 0 ? (
                        <select
                          value={(() => {
                            const currentValue = formData[type.toLowerCase()];
                            // If current value is null or undefined, show NO_FORMULA
                            if (currentValue === null || currentValue === undefined) {
                              return 'NO_FORMULA';
                            }
                            // Check if current value exists in available formulas
                            const existsInFormulas = formulas.some(f => (f.PPI_SubID || '') === currentValue);
                            if (existsInFormulas) {
                              return currentValue;
                            }
                            // If current value doesn't exist in formulas, show NO_FORMULA
                            return 'NO_FORMULA';
                          })()}
                          onChange={(e) => handleFormulaSelect(type, e.target.value === 'NO_FORMULA' ? null : e.target.value)}
                          className="formula-select"
                        >
                          <option value="NO_FORMULA">-- No Formula --</option>
                          {formulas.map((formula, idx) => (
                            <option key={`edit-${type}-${formula.PPI_SubID || 'empty'}-${idx}`} value={formula.PPI_SubID || ''}>
                              {formula.PPI_SubID || ' '} {formula.Default === 'Aktif' ? '(DEF) ' : ''}(Output: {formula.BatchSize})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="no-formulas-available">
                          <span>No {type} formulas available for this product</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="output-and-cost-section">
                  <div className="std-output-field">
                    <label>Standard Output:</label>
                    <input
                      type="number"
                      value={formData.stdOutput}
                      onChange={(e) => setFormData(prev => ({ ...prev, stdOutput: e.target.value }))}
                      className="input-field"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  

                  
                  <div className="total-cost-field">
                    <label>Total Product Cost:</label>
                    <div className="price-value">
                      {totalProductPrice > 0 ? formatCurrency(totalProductPrice) : 'Not calculated'}
                    </div>
                  </div>
                </div>
                
                {totalProductPrice > 0 && (
                  <div className="price-note">
                    <small>* Based on selected formula combination</small>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Updating...' : 'Update Assignment'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Deletion</h3>
              <button onClick={cancelDelete} className="close-btn">×</button>
            </div>
            <div className="modal-body">
              <div className="delete-confirmation">
                <div className="warning-icon">⚠️</div>
                <p>Are you sure you want to delete the formula assignment for:</p>
                <div className="product-info">
                  <strong>Product ID:</strong> {deletingProduct}<br />
                  <strong>Product Name:</strong> {getProductName(deletingProduct)}
                </div>
                <p className="warning-text">This action cannot be undone.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                onClick={cancelDelete}
                className="btn-secondary"
                type="button"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="btn-danger"
                type="button"
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={handleCloseImportModal}>
          <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Import Formula Assignments from Excel</h3>
              <button onClick={handleCloseImportModal} className="close-btn">×</button>
            </div>
            
            <div className="modal-body-scrollable">
              {importStep === 'upload' && (
                <div className="import-upload-step">
                  <div className="upload-instructions">
                    <h4>Step 1: Select Excel File</h4>
                    <p>Please select an Excel file (.xlsx or .xls) with <strong>two sheets</strong>:</p>
                    <ul>
                      <li><strong>Sheet 1:</strong> "Formula Details" (ignored)</li>
                      <li><strong>Sheet 2:</strong> "Summary Per SubID" (used for import)</li>
                    </ul>
                    <p>The <strong>"Summary Per SubID"</strong> sheet must contain these <strong>required columns</strong>:</p>
                    <div className="format-example">
                      <table className="example-table">
                        <thead>
                          <tr>
                            <th>TypeCode ✓</th>
                            <th>PPI_SubID ✓</th>
                            <th>Product_ID ✓</th>
                            <th>Product_Name ✓</th>
                            <th>BatchSize ✓</th>
                            <th>HPP ✓</th>
                            <th>ppi_owner</th>
                            <th>TypeName</th>
                            <th>Total</th>
                            <th>Item_type</th>
                            <th>production</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>PI</td>
                            <td>F1</td>
                            <td>01LA</td>
                            <td>Product A</td>
                            <td>3000</td>
                            <td>aktif</td>
                            <td>Owner1</td>
                            <td>Process Ingredient</td>
                            <td>100</td>
                            <td>Bahan</td>
                            <td>Yes</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="column-legend">
                      <p><strong>✓ Required columns</strong> | Other columns are optional (will be ignored)</p>
                    </div>
                    <div className="format-notes">
                      <h5>Import Process:</h5>
                      <ul>
                        <li>All rows are <strong>grouped by Product_ID</strong></li>
                        <li>Only formulas with <strong>HPP = "aktif"</strong> (case insensitive) are imported</li>
                        <li><strong>TypeCode</strong> must be one of: PI, PS, KP, KS</li>
                        <li>Each product can have <strong>only one active formula per TypeCode</strong></li>
                        <li>All active formulas for a product must have the <strong>same BatchSize</strong></li>
                        <li><strong>PPI_SubID</strong> becomes the formula assignment value</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="file-input-section">
                    <div className="year-selector-section">
                      <label htmlFor="import-year-selector">Import to Year:</label>
                      <select
                        id="import-year-selector"
                        value={importYear}
                        onChange={(e) => setImportYear(e.target.value)}
                        className="year-selector-import"
                      >
                        {importYearRange.map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                    
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                      className="file-input"
                      id="importFile"
                    />
                    <label htmlFor="importFile" className="file-input-label">
                      <FileUp size={20} />
                      {importFile ? importFile.name : 'Choose Excel File'}
                    </label>
                  </div>
                  
                  <div className="modal-actions">
                    <button type="button" onClick={handleCloseImportModal} className="btn-secondary">
                      Cancel
                    </button>
                    <button 
                      onClick={handleParseAndValidate}
                      className="btn-primary"
                      disabled={!importFile || loadingImport}
                    >
                      {loadingImport ? 'Processing...' : 'Validate Data'}
                    </button>
                  </div>
                </div>
              )}

              {importStep === 'validation' && validationResults && (
                <div className="import-validation-step">
                  <h4>Validation Results</h4>
                  
                  <div className="validation-summary">
                    <div className="summary-stats">
                      <div className="stat-item error">
                        <strong>{validationResults.errors.length}</strong> Error(s)
                      </div>
                      <div className="stat-item warning">
                        <strong>{validationResults.warnings.length}</strong> Warning(s)
                      </div>
                      <div className="stat-item info">
                        <strong>{validationResults.summary.totalProducts}</strong> Total Products
                      </div>
                      <div className="stat-item info">
                        <strong>{validationResults.summary.totalActiveFormulas}</strong> Active Formulas
                      </div>
                    </div>
                  </div>

                  {validationResults.errors.length > 0 && (
                    <div className="validation-errors">
                      <h5>❌ Errors (must be fixed):</h5>
                      <ul>
                        {validationResults.errors.map((error, index) => (
                          <li key={index} className="error-item">{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationResults.warnings.length > 0 && (
                    <div className="validation-warnings">
                      <h5>⚠️ Warnings:</h5>
                      <ul>
                        {validationResults.warnings.map((warning, index) => (
                          <li key={index} className="warning-item">{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="modal-actions">
                    <button type="button" onClick={handleCloseImportModal} className="btn-secondary">
                      Cancel
                    </button>
                    <button 
                      onClick={() => setImportStep('upload')}
                      className="btn-secondary"
                    >
                      Back to Upload
                    </button>
                  </div>
                </div>
              )}

              {importStep === 'confirmation' && validationResults && (
                <div className="import-confirmation-step">
                  <h4>✅ Validation Passed - Ready to Import</h4>
                  
                  <div className="confirmation-summary">
                    <div className="summary-stats">
                      <div className="stat-item success">
                        <strong>{validationResults.summary.totalProducts}</strong> Products Ready
                      </div>
                      <div className="stat-item info">
                        <strong>{validationResults.summary.validProducts}</strong> Valid Products
                      </div>
                      <div className="stat-item info">
                        <strong>{validationResults.summary.totalActiveFormulas}</strong> Active Formulas
                      </div>
                    </div>
                  </div>

                  <div className="import-preview">
                    <h5>Preview of Import Data:</h5>
                    <div className="preview-table-container">
                      <table className="preview-table">
                        <thead>
                          <tr>
                            <th>Product ID</th>
                            <th>Product Name</th>
                            <th>Active Formulas</th>
                            <th>Batch Size</th>
                            <th>PI</th>
                            <th>PS</th>
                            <th>KP</th>
                            <th>KS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importData.slice(0, 10).map((product, index) => {
                            const assignments = { PI: null, PS: null, KP: null, KS: null };
                            let batchSize = 0;
                            
                            product.formulas.forEach(formula => {
                              if (assignments.hasOwnProperty(formula.TypeCode)) {
                                assignments[formula.TypeCode] = formula.PPI_SubID || '';
                                if (formula.BatchSize > 0) batchSize = formula.BatchSize;
                              }
                            });
                            
                            return (
                              <tr key={index}>
                                <td>{product.Product_ID}</td>
                                <td>{product.Product_Name}</td>
                                <td>{product.formulas.length} formulas</td>
                                <td>{batchSize}</td>
                                <td>{assignments.PI === null ? '(unassigned)' : assignments.PI === '' ? '(empty)' : assignments.PI}</td>
                                <td>{assignments.PS === null ? '(unassigned)' : assignments.PS === '' ? '(empty)' : assignments.PS}</td>
                                <td>{assignments.KP === null ? '(unassigned)' : assignments.KP === '' ? '(empty)' : assignments.KP}</td>
                                <td>{assignments.KS === null ? '(unassigned)' : assignments.KS === '' ? '(empty)' : assignments.KS}</td>
                              </tr>
                            );
                          })}
                          {importData.length > 10 && (
                            <tr>
                              <td colSpan="8" className="preview-more">
                                ... and {importData.length - 10} more products
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="import-warning">
                    <div className="warning-box">
                      <h5>⚠️ Important Warning</h5>
                      <p>This operation will:</p>
                      <ul>
                        <li><strong>Delete existing formula assignments</strong> for year <strong>{importYear}</strong> that have at least one assigned formula</li>
                        <li><strong>Preserve products with entirely NULL assignments</strong> (where all formulas PI, PS, KP, KS are NULL)</li>
                        <li><strong>Replace deleted assignments with the imported data</strong></li>
                        <li>This action <strong>cannot be undone</strong></li>
                      </ul>
                      <p>Please make sure you have backed up your current assignments by exporting them first.</p>
                    </div>
                  </div>

                  <div className="modal-actions">
                    <button type="button" onClick={handleCloseImportModal} className="btn-secondary">
                      Cancel
                    </button>
                    <button 
                      onClick={() => setImportStep('upload')}
                      className="btn-secondary"
                    >
                      Back to Upload
                    </button>
                    <button 
                      onClick={handleConfirmImport}
                      className="btn-danger"
                      disabled={loadingImport}
                    >
                      {loadingImport ? 'Importing...' : 'Confirm Import'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormulaAssignment;
