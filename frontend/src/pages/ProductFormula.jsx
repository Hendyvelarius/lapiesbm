import React, { useState, useEffect } from 'react';
import api from '../services/api';
import AWN from 'awesome-notifications';
import 'awesome-notifications/dist/style.css';
import '../styles/ProductFormula.css';

// Initialize awesome-notifications
const notifier = new AWN({
  position: 'top-right',
  durations: {
    global: 5000
  }
});

const ProductFormula = () => {
  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Product selection states
  const [productList, setProductList] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  
  // Recipe data states
  const [recipeData, setRecipeData] = useState([]);
  const [materialData, setMaterialData] = useState([]);
  const [unitsData, setUnitsData] = useState([]);
  const [groupedRecipes, setGroupedRecipes] = useState({});
  const [expandedSubIds, setExpandedSubIds] = useState(new Set());

  // Add Formula Modal states
  const [showAddFormulaModal, setShowAddFormulaModal] = useState(false);
  const [addFormulaStep, setAddFormulaStep] = useState(1); // 1: Type, 2: Name, 3: Ingredients
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingFormula, setEditingFormula] = useState(null);
  const [newFormulaData, setNewFormulaData] = useState({
    type: '',
    subId: '',
    batchSize: 0,
    ingredients: []
  });
  const [existingFormulas, setExistingFormulas] = useState([]);
  
  // Material search states for ingredient form
  const [materialSearchTerms, setMaterialSearchTerms] = useState({});
  const [materialDropdownVisible, setMaterialDropdownVisible] = useState({});

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Filter products based on search term
  useEffect(() => {
    if (!showProductDropdown) {
      setFilteredProducts([]);
    } else if (searchTerm.trim() === '') {
      setFilteredProducts(productList);
    } else {
      const filtered = productList.filter(product =>
        product.Product_Name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.Product_ID?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [searchTerm, productList, showProductDropdown]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load product list, material data, and units data
      const [productsRes, materialsRes, unitsRes] = await Promise.all([
        api.master.getProductName(),
        api.master.getMaterial(),
        api.master.getUnit()
      ]);

      setProductList(productsRes || []);
      setMaterialData(materialsRes || []);
      setUnitsData(unitsRes || []);
    } catch (err) {
      console.error('Error loading initial data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadRecipeData = async (productId) => {
    try {
      setLoading(true);
      setError('');

      const recipeRes = await api.products.getRecipe(productId);
      setRecipeData(recipeRes || []);
      
      // Group recipes by Type and SubID
      const grouped = groupRecipesByTypeAndSubId(recipeRes || []);
      setGroupedRecipes(grouped);
    } catch (err) {
      console.error('Error loading recipe data:', err);
      setError('Failed to load recipe data. Please try again.');
      setRecipeData([]);
      setGroupedRecipes({});
    } finally {
      setLoading(false);
    }
  };

  const groupRecipesByTypeAndSubId = (recipes) => {
    const grouped = {};
    
    recipes.forEach(recipe => {
      const typeKey = recipe.TypeCode;
      const subIdKey = recipe.PPI_SubID || ' '; // Use space for unnamed formulas
      
      if (!grouped[typeKey]) {
        grouped[typeKey] = {};
      }
      
      if (!grouped[typeKey][subIdKey]) {
        grouped[typeKey][subIdKey] = {
          subId: subIdKey,
          type: typeKey,
          typeName: recipe.TypeName,
          batchSize: recipe.BatchSize, // Now properly joined from M_COGS_FORMULA_MANUAL
          default: recipe.Default,
          defaultCOGS: recipe.DefaultCOGS,
          ingredients: []
        };
      }
      
      grouped[typeKey][subIdKey].ingredients.push({
        seqId: recipe.PPI_SeqID,
        itemId: recipe.PPI_ItemID,
        quantity: recipe.PPI_QTY,
        unit: recipe.PPI_UnitID,
        itemName: getItemName(recipe.PPI_ItemID)
      });
    });
    
    // Sort ingredients by sequence ID within each formula
    Object.keys(grouped).forEach(type => {
      Object.keys(grouped[type]).forEach(subId => {
        grouped[type][subId].ingredients.sort((a, b) => a.seqId - b.seqId);
      });
    });
    
    return grouped;
  };

  // Define the desired order of formula types
  const getTypeOrder = (typeName) => {
    const typeOrder = {
      '1. PENGOLAHAN INTI': 1,
      '1. PENGOLAHAN SALUT': 2,
      '2. KEMAS PRIMER': 3,
      '2. KEMAS SEKUNDER': 4
    };
    return typeOrder[typeName] || 999; // Put unknown types at the end
  };

  // Get sorted type entries for rendering
  const getSortedTypeEntries = (groupedRecipes) => {
    return Object.entries(groupedRecipes).sort(([typeA, subIdsA], [typeB, subIdsB]) => {
      const firstFormulaA = Object.values(subIdsA)[0];
      const firstFormulaB = Object.values(subIdsB)[0];
      const typeNameA = firstFormulaA?.typeName || typeA;
      const typeNameB = firstFormulaB?.typeName || typeB;
      
      return getTypeOrder(typeNameA) - getTypeOrder(typeNameB);
    });
  };

  // Helper function to render default badges
  const renderDefaultBadge = (formulaData) => {
    const isDefault = formulaData.default === 'Aktif';
    const isDefaultCOGS = formulaData.defaultCOGS === 'Aktif';
    
    if (isDefault && isDefaultCOGS) {
      return <span className="default-badge lms-cogs-badge">LMS/COGS</span>;
    } else if (isDefault) {
      return <span className="default-badge lms-badge">LMS</span>;
    } else if (isDefaultCOGS) {
      return <span className="default-badge cogs-badge">COGS</span>;
    } else {
      return 'No';
    }
  };

  // Add Formula Modal Handlers
  const handleAddFormula = () => {
    if (!selectedProduct) {
      notifier.warning('Please select a product first');
      return;
    }
    
    // Get existing formulas for this product to prevent duplicates
    const productFormulas = recipeData.map(recipe => ({
      type: recipe.TypeCode,
      subId: recipe.PPI_SubID
    }));
    setExistingFormulas(productFormulas);
    
    // Reset form data
    setIsEditMode(false);
    setEditingFormula(null);
    setNewFormulaData({
      type: '',
      subId: '',
      batchSize: 0,
      ingredients: []
    });
    setAddFormulaStep(1);
    setShowAddFormulaModal(true);
  };

  const handleEditFormula = (formulaData) => {
    if (!selectedProduct) {
      notifier.warning('Please select a product first');
      return;
    }
    
    // Get existing formulas excluding the one being edited
    const productFormulas = recipeData
      .filter(recipe => !(recipe.TypeCode === formulaData.type && recipe.PPI_SubID === formulaData.subId))
      .map(recipe => ({
        type: recipe.TypeCode,
        subId: recipe.PPI_SubID
      }));
    setExistingFormulas(productFormulas);
    
    // Set edit mode and populate form with existing data
    setIsEditMode(true);
    setEditingFormula(formulaData);
    setNewFormulaData({
      type: formulaData.type,
      subId: formulaData.subId,
      batchSize: formulaData.batchSize || 1, // Default to 1 if no batch size
      ingredients: formulaData.ingredients.map((ingredient, index) => ({
        seqId: ingredient.seqId,
        itemId: ingredient.itemId,
        qty: ingredient.quantity.toString(),
        unitId: ingredient.unit
      }))
    });
    
    // Initialize search states for existing ingredients
    const searchTerms = {};
    const dropdownVisible = {};
    formulaData.ingredients.forEach((ingredient, index) => {
      searchTerms[index] = `${ingredient.itemId} - ${ingredient.itemName}`;
      dropdownVisible[index] = false;
    });
    setMaterialSearchTerms(searchTerms);
    setMaterialDropdownVisible(dropdownVisible);
    
    setAddFormulaStep(2); // Start at step 2 (details) for edit mode
    setShowAddFormulaModal(true);
  };

  const handleDeleteFormula = async (formulaData) => {
    if (!selectedProduct) return;
    
    // Use awesome-notifications for a modern confirmation dialog
    notifier.confirm(
      `Are you sure you want to delete the formula "${formulaData.subId}" (${getTypeDisplayName(formulaData.type)})?`,
      async () => {
        // This runs if user clicks OK/Yes
        try {
          setLoading(true);
          
          await api.master.deleteEntireFormulaManual({
            ppiType: formulaData.type,
            ppiSubId: formulaData.subId,
            ppiProductId: selectedProduct.Product_ID
          });
          
          notifier.success('Formula deleted successfully!');
          
          // Reload recipe data
          await loadRecipeData(selectedProduct.Product_ID);
          
        } catch (err) {
          console.error('Error deleting formula:', err);
          notifier.alert('Failed to delete formula. Please try again.');
        } finally {
          setLoading(false);
        }
      },
      () => {
        // This runs if user clicks Cancel/No - do nothing
        console.log('Delete cancelled');
      },
      {
        title: 'Delete Formula',
        okButtonText: 'Delete',
        cancelButtonText: 'Cancel'
      }
    );
  };

  const handleCloneFormula = async (formulaData) => {
    if (!selectedProduct) return;
    
    try {
      setLoading(true);
      
      // Debug log to see the structure
      console.log('Clone formula data:', formulaData);
      console.log('Selected product:', selectedProduct);
      
      // Generate new formula name based on naming rules
      const generateCloneName = (originalSubId) => {
        let baseName;
        
        if (originalSubId.startsWith('M_')) {
          // If already has M_ prefix, extract the name part
          baseName = originalSubId.substring(2);
        } else {
          // If no M_ prefix, add M_ and use original name
          baseName = originalSubId;
        }
        
        // Check for existing formulas with similar names
        let counter = originalSubId.startsWith('M_') ? 1 : 0;
        let newName = originalSubId.startsWith('M_') ? `M_${baseName}${counter || ''}` : `M_${baseName}`;
        
        // Keep incrementing until we find a unique name
        while (existingFormulas.some(formula => 
          formula.type === formulaData.type && formula.subId === newName
        )) {
          counter++;
          newName = `M_${baseName}${counter}`;
        }
        
        return newName;
      };
      
      const newSubId = generateCloneName(formulaData.subId);
      
      // Prepare the ingredients for cloning
      const ingredients = formulaData.ingredients.map(ingredient => ({
        seqId: ingredient.seqId,
        itemId: ingredient.itemId,
        qty: ingredient.quantity, // Note: using 'quantity' from display data
        unitId: ingredient.unit
      }));
      
      const cloneData = {
        ppiType: formulaData.type,
        ppiSubId: newSubId,
        ppiProductId: selectedProduct.Product_ID,
        ppiBatchSize: formulaData.batchSize || 1, // Use 1 as default if batchSize is null/undefined
        ingredients: ingredients
      };
      
      // Debug log to see what we're sending
      console.log('Clone data being sent:', cloneData);
      
      // Validate required fields before sending
      if (!cloneData.ppiType) {
        throw new Error('Missing ppiType (formula type)');
      }
      if (!cloneData.ppiSubId) {
        throw new Error('Missing ppiSubId (formula name)');
      }
      if (!cloneData.ppiProductId) {
        throw new Error('Missing ppiProductId');
      }
      if (!cloneData.ppiBatchSize || cloneData.ppiBatchSize <= 0) {
        throw new Error('Missing or invalid ppiBatchSize');
      }
      if (!cloneData.ingredients || cloneData.ingredients.length === 0) {
        throw new Error('Missing or empty ingredients array');
      }
      
      // Validate each ingredient
      const invalidIngredients = cloneData.ingredients.filter(ingredient => 
        !ingredient.itemId || !ingredient.qty || !ingredient.unitId
      );
      if (invalidIngredients.length > 0) {
        throw new Error(`Invalid ingredients found: ${invalidIngredients.length} items missing required fields`);
      }
      
      // Create the cloned formula
      await api.master.addBatchFormulaManual(cloneData);
      
      notifier.success(`Formula cloned successfully as "${newSubId}"!`);
      
      // Reload recipe data
      await loadRecipeData(selectedProduct.Product_ID);
      
    } catch (err) {
      console.error('Error cloning formula:', err);
      console.error('Formula data was:', formulaData);
      console.error('Selected product was:', selectedProduct);
      notifier.alert('Failed to clone formula. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAddFormulaModal = () => {
    setShowAddFormulaModal(false);
    setAddFormulaStep(1);
    setIsEditMode(false);
    setEditingFormula(null);
    setNewFormulaData({
      type: '',
      subId: '',
      batchSize: 0,
      ingredients: []
    });
    setExistingFormulas([]);
    // Clear material search states
    setMaterialSearchTerms({});
    setMaterialDropdownVisible({});
  };

  const handleFormulaTypeSelect = (type) => {
    setNewFormulaData(prev => ({ ...prev, type }));
    setAddFormulaStep(2);
  };

  const handleFormulaNameSubmit = (e) => {
    e.preventDefault();
    const subId = e.target.subId.value.trim();
    const batchSize = parseFloat(e.target.batchSize.value);
    
    if (!subId) {
      notifier.warning('Please enter a formula name');
      return;
    }
    
    if (isNaN(batchSize) || batchSize <= 0) {
      notifier.warning('Please enter a valid batch size');
      return;
    }
    
    // Check if formula name already exists for this type (skip check in edit mode if name unchanged)
    const finalSubId = `M_${subId}`;
    const exists = existingFormulas.some(formula => 
      formula.type === newFormulaData.type && formula.subId === finalSubId
    );
    
    if (exists) {
      notifier.warning(`Formula "${subId}" already exists for ${newFormulaData.type} type. Please choose a different name.`);
      return;
    }
    
    setNewFormulaData(prev => ({ 
      ...prev, 
      subId: finalSubId,
      batchSize,
      ingredients: isEditMode ? prev.ingredients : [{ seqId: 1, itemId: '', qty: '', unitId: '' }] // Keep existing ingredients in edit mode
    }));
    
    // Initialize search states for new formula only
    if (!isEditMode) {
      setMaterialSearchTerms({ 0: '' });
      setMaterialDropdownVisible({ 0: false });
    }
    
    setAddFormulaStep(3);
  };

  const handleAddIngredient = () => {
    const newSeqId = newFormulaData.ingredients.length + 1;
    const newIndex = newFormulaData.ingredients.length;
    setNewFormulaData(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { seqId: newSeqId, itemId: '', qty: '', unitId: '' }]
    }));
    
    // Initialize search state for new ingredient
    setMaterialSearchTerms(prev => ({
      ...prev,
      [newIndex]: ''
    }));
    setMaterialDropdownVisible(prev => ({
      ...prev,
      [newIndex]: false
    }));
  };

  const handleRemoveIngredient = (index) => {
    if (newFormulaData.ingredients.length <= 1) {
      notifier.warning('At least one ingredient is required');
      return;
    }
    
    setNewFormulaData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index).map((ingredient, i) => ({
        ...ingredient,
        seqId: i + 1
      }))
    }));
    
    // Clean up search states for removed ingredient and reindex
    const newSearchTerms = {};
    const newDropdownVisible = {};
    
    Object.keys(materialSearchTerms).forEach(key => {
      const idx = parseInt(key);
      if (idx < index) {
        newSearchTerms[idx] = materialSearchTerms[key];
        newDropdownVisible[idx] = materialDropdownVisible[key];
      } else if (idx > index) {
        newSearchTerms[idx - 1] = materialSearchTerms[key];
        newDropdownVisible[idx - 1] = materialDropdownVisible[key];
      }
    });
    
    setMaterialSearchTerms(newSearchTerms);
    setMaterialDropdownVisible(newDropdownVisible);
  };

  const handleIngredientChange = (index, field, value) => {
    setNewFormulaData(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((ingredient, i) => 
        i === index ? { ...ingredient, [field]: value } : ingredient
      )
    }));
  };

  // Material search helper functions
  const handleMaterialSearch = (index, searchTerm) => {
    setMaterialSearchTerms(prev => ({
      ...prev,
      [index]: searchTerm
    }));
  };

  const handleMaterialSelect = (index, selectedMaterial) => {
    handleIngredientChange(index, 'itemId', selectedMaterial.ITEM_ID);
    // Auto-populate unit from standard unit
    if (selectedMaterial.Item_Unit) {
      handleIngredientChange(index, 'unitId', selectedMaterial.Item_Unit);
    }
    // Clear search term and hide dropdown
    setMaterialSearchTerms(prev => ({
      ...prev,
      [index]: `${selectedMaterial.ITEM_ID} - ${selectedMaterial.Item_Name}`
    }));
    setMaterialDropdownVisible(prev => ({
      ...prev,
      [index]: false
    }));
  };

  const getFilteredBahanData = (index) => {
    const searchTerm = materialSearchTerms[index] || '';
    
    // Filter by ITEM_TYPE based on formula type
    let filteredByType = materialData;
    if (newFormulaData.type) {
      const formulaType = getTypeDisplayName(newFormulaData.type);
      
      if (formulaType === '1. PENGOLAHAN INTI' || formulaType === '1. PENGOLAHAN SALUT') {
        // For PENGOLAHAN types, only show BB materials
        filteredByType = materialData.filter(material => material.ITEM_TYPE === 'BB');
      } else if (formulaType === '2. KEMAS PRIMER' || formulaType === '2. KEMAS SEKUNDER') {
        // For KEMAS types, only show BK materials
        filteredByType = materialData.filter(material => material.ITEM_TYPE === 'BK');
      }
    }
    
    // Filter by search term
    if (!searchTerm.trim()) return filteredByType;
    
    return filteredByType.filter(material => 
      material.Item_Name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.ITEM_ID?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const handleMaterialInputFocus = (index) => {
    setMaterialDropdownVisible(prev => ({
      ...prev,
      [index]: true
    }));
  };

  const handleMaterialInputBlur = (index) => {
    // Delay hiding dropdown to allow for clicks
    setTimeout(() => {
      setMaterialDropdownVisible(prev => ({
        ...prev,
        [index]: false
      }));
    }, 200);
  };

  const clearMaterialSelection = (index) => {
    handleIngredientChange(index, 'itemId', '');
    handleIngredientChange(index, 'unitId', '');
    setMaterialSearchTerms(prev => ({
      ...prev,
      [index]: ''
    }));
  };

  const handleSubmitFormula = async () => {
    // Validate ingredients
    const invalidIngredients = newFormulaData.ingredients.filter(ingredient => 
      !ingredient.itemId || !ingredient.qty || !ingredient.unitId
    );
    
    if (invalidIngredients.length > 0) {
      notifier.warning('Please fill in all ingredient details');
      return;
    }
    
    // Validate required data
    if (!newFormulaData.type) {
      notifier.warning('Formula type is missing');
      return;
    }
    
    if (!newFormulaData.subId) {
      notifier.warning('Formula name is missing');
      return;
    }
    
    if (!newFormulaData.batchSize || newFormulaData.batchSize <= 0) {
      notifier.warning('Batch size must be greater than 0');
      return;
    }
    
    if (!selectedProduct?.Product_ID) {
      notifier.warning('Product ID is missing');
      return;
    }
    
    try {
      setLoading(true);
      
      const submitData = {
        ppiType: newFormulaData.type,
        ppiSubId: newFormulaData.subId,
        ppiProductId: selectedProduct.Product_ID,
        ppiBatchSize: newFormulaData.batchSize,
        ingredients: newFormulaData.ingredients
      };
      
      if (isEditMode) {
        // For edit mode: First delete the existing formula, then create new one
        await api.master.deleteEntireFormulaManual({
          ppiType: editingFormula.type,
          ppiSubId: editingFormula.subId,
          ppiProductId: selectedProduct.Product_ID
        });
        
        // Then create the updated formula
        await api.master.addBatchFormulaManual(submitData);
        
        notifier.success('Formula updated successfully!');
      } else {
        // For create mode: Just create the new formula
        await api.master.addBatchFormulaManual(submitData);
        
        notifier.success('Formula added successfully!');
      }
      
      handleCloseAddFormulaModal();
      
      // Reload recipe data
      await loadRecipeData(selectedProduct.Product_ID);
      
    } catch (err) {
      console.error('Error saving formula:', err);
      console.error('Submit data was:', {
        ppiType: newFormulaData.type,
        ppiSubId: newFormulaData.subId,
        ppiProductId: selectedProduct.Product_ID,
        ppiBatchSize: newFormulaData.batchSize,
        ingredients: newFormulaData.ingredients
      });
      notifier.alert(`Failed to ${isEditMode ? 'update' : 'add'} formula. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const getTypeDisplayName = (typeCode) => {
    const typeNames = {
      'PI': '1. PENGOLAHAN INTI',
      'PS': '1. PENGOLAHAN SALUT', 
      'KP': '2. KEMAS PRIMER',
      'KS': '2. KEMAS SEKUNDER'
    };
    return typeNames[typeCode] || typeCode;
  };

  const getItemName = (itemId) => {
    const material = materialData.find(m => m.ITEM_ID === itemId);
    return material ? material.Item_Name : itemId;
  };

  const handleProductSelect = async (product) => {
    setSelectedProduct(product);
    setSearchTerm('');
    setFilteredProducts([]);
    setShowProductDropdown(false);
    setExpandedSubIds(new Set()); // Reset expanded items
    
    // Load recipe data for selected product
    await loadRecipeData(product.Product_ID);
  };

  const handleClearProduct = () => {
    setSelectedProduct(null);
    setRecipeData([]);
    setGroupedRecipes({});
    setExpandedSubIds(new Set());
    setSearchTerm('');
  };

  const toggleSubIdExpansion = (type, subId) => {
    const key = `${type}-${subId}`;
    const newExpanded = new Set(expandedSubIds);
    
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    
    setExpandedSubIds(newExpanded);
  };

  if (loading && !selectedProduct) {
    return (
      <div className="product-formula-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="product-formula-container">
      {error && (
        <div className="error-message">
          {error}
          <button onClick={loadInitialData} className="retry-btn">Retry</button>
        </div>
      )}

      <div className="content-section">
        <div className="section-header">
          <div className="section-title">
            <h2>Product Formula Management</h2>
          </div>
          <div className="header-actions">
            {selectedProduct && (
              <button onClick={handleClearProduct} className="btn-secondary">
                Clear Selection
              </button>
            )}
            <button 
              onClick={handleAddFormula}
              className="btn-primary"
              disabled={!selectedProduct}
            >
              Add New Formula
            </button>
          </div>
        </div>

        {/* Product Selection */}
        <div className="product-selection-section">
          <h3>Select Product</h3>
          <div className="product-search">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setShowProductDropdown(true)}
              onBlur={() => {
                setTimeout(() => setShowProductDropdown(false), 200);
              }}
              placeholder="Click here to see all products, or type to search..."
              className="search-input"
            />
            
            {showProductDropdown && (
              <div className="search-results">
                {filteredProducts.length === 0 && searchTerm.trim() ? (
                  <div className="search-result-item no-results">
                    <span>No products found matching "{searchTerm}"</span>
                  </div>
                ) : (
                  <>
                    {searchTerm.trim() === '' && (
                      <div className="search-result-header">
                        <small>All products ({filteredProducts.length})</small>
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

        {/* Formula Table */}
        {selectedProduct && (
          <div className="formula-section">
            <h3>Product Formulas</h3>
            {loading ? (
              <div className="loading">Loading formulas...</div>
            ) : Object.keys(groupedRecipes).length === 0 ? (
              <div className="no-formulas">
                <p>No formulas found for this product.</p>
                <button className="btn-primary">Create First Formula</button>
              </div>
            ) : (
              <div className="formula-accordion">
                {getSortedTypeEntries(groupedRecipes).map(([type, subIds]) => {
                  // Get type name from the first formula in this type group
                  const firstFormula = Object.values(subIds)[0];
                  const typeName = firstFormula?.typeName || type;
                  
                  return (
                    <div key={type} className="formula-type-group">
                      <h4 className="formula-type-header">{typeName}</h4>
                      <div className="formula-table">
                        <div className="formula-table-header">
                          <div className="header-cell header-subid">Sub ID</div>
                          <div className="header-cell header-type">Type</div>
                          <div className="header-cell header-batch-size">Batch Size</div>
                          <div className="header-cell header-output">Default</div>
                          <div className="header-cell header-actions">Actions</div>
                        </div>
                        
                        {Object.entries(subIds).map(([subId, formulaData]) => {
                          const expansionKey = `${type}-${subId}`;
                          const isExpanded = expandedSubIds.has(expansionKey);
                          
                          return (
                            <div key={`${type}-${subId}`} className="formula-row-group">
                              {/* Main Formula Row */}
                              <div 
                                className={`formula-row ${isExpanded ? 'expanded' : ''}`}
                                onClick={() => toggleSubIdExpansion(type, subId)}
                              >
                                <div className="cell cell-subid">
                                  <span className="expand-icon">
                                    {isExpanded ? '▼' : '▶'}
                                  </span>
                                  {subId}
                                </div>
                                <div className="cell cell-type">{type}</div>
                                <div className="cell cell-batch-size">
                                  {formulaData.batchSize ? formulaData.batchSize.toLocaleString() : '-'}
                                </div>
                                <div className="cell cell-output">
                                  {renderDefaultBadge(formulaData)}
                                </div>
                                <div className="cell cell-actions">
                                  {/* Clone button - available for all formulas */}
                                  <button 
                                    className="btn-clone"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCloneFormula(formulaData);
                                    }}
                                    title="Clone this formula"
                                  >
                                    Clone
                                  </button>
                                  
                                  {/* Edit and Delete buttons - only for M_ prefixed formulas */}
                                  {formulaData.subId.startsWith('M_') && (
                                    <>
                                      <button 
                                        className="btn-edit"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditFormula(formulaData);
                                        }}
                                        title="Edit this formula"
                                      >
                                        Edit
                                      </button>
                                      <button 
                                        className="btn-delete"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteFormula(formulaData);
                                        }}
                                        title="Delete this formula"
                                      >
                                        Delete
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              {/* Expanded Ingredients */}
                              {isExpanded && (
                                <div className="ingredients-section">
                                  <div className="ingredients-table-header">
                                    <div className="ingredient-cell ing-seq">Seq</div>
                                    <div className="ingredient-cell ing-id">ID</div>
                                    <div className="ingredient-cell ing-name">Item Name</div>
                                    <div className="ingredient-cell ing-qty">Quantity</div>
                                    <div className="ingredient-cell ing-unit">Unit</div>
                                  </div>
                                  {formulaData.ingredients.map((ingredient, idx) => (
                                    <div key={idx} className="ingredient-row">
                                      <div className="ingredient-cell ing-seq">{ingredient.seqId}</div>
                                      <div className="ingredient-cell ing-id">{ingredient.itemId}</div>
                                      <div className="ingredient-cell ing-name" title={ingredient.itemName}>
                                        {ingredient.itemName}
                                      </div>
                                      <div className="ingredient-cell ing-qty">{ingredient.quantity}</div>
                                      <div className="ingredient-cell ing-unit">{ingredient.unit}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Formula Modal */}
      {showAddFormulaModal && (
        <div className="modal-overlay" onClick={handleCloseAddFormulaModal}>
          <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isEditMode ? 'Edit Formula' : 'Add New Formula'}</h3>
              <button onClick={handleCloseAddFormulaModal} className="close-btn">×</button>
            </div>
            
            <div className="modal-body">
              {/* Step 1: Product Info & Type Selection - Skip in edit mode */}
              {addFormulaStep === 1 && !isEditMode && (
                <div className="formula-step">
                  <div className="step-header">
                    <h4>Step 1: Select Formula Type</h4>
                    <div className="product-info">
                      <strong>Product:</strong> {selectedProduct?.Product_ID} - {selectedProduct?.Product_Name}
                    </div>
                  </div>
                  
                  <div className="type-selection">
                    <p>Choose the type for this formula:</p>
                    <div className="type-buttons">
                      {['PI', 'PS', 'KP', 'KS'].map(type => (
                        <button
                          key={type}
                          onClick={() => handleFormulaTypeSelect(type)}
                          className="type-btn"
                        >
                          <div className="type-code">{type}</div>
                          <div className="type-name">{getTypeDisplayName(type)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Formula Name & Batch Size - Edit mode */}
              {addFormulaStep === 2 && isEditMode && (
                <div className="formula-step">
                  <div className="step-header">
                    <h4>Edit Formula Details</h4>
                    <div className="product-info">
                      <strong>Product:</strong> {selectedProduct?.Product_ID} - {selectedProduct?.Product_Name}
                      <br />
                      <strong>Type:</strong> {getTypeDisplayName(newFormulaData.type)}
                    </div>
                  </div>
                  
                  <form onSubmit={handleFormulaNameSubmit} className="formula-details-form">
                    <div className="form-group">
                      <label>Formula Name:</label>
                      <div className="name-input-group">
                        <span className="prefix">M_</span>
                        <input
                          type="text"
                          name="subId"
                          placeholder="Enter formula name (e.g., C, GLC, GLD)"
                          className="name-input"
                          maxLength="10"
                          defaultValue={isEditMode ? newFormulaData.subId.replace('M_', '') : ''}
                          required
                        />
                      </div>
                      <small>Formula will be named: M_{'{formula_name}'}</small>
                    </div>
                    
                    <div className="form-group">
                      <label>Batch Size:</label>
                      <input
                        type="number"
                        name="batchSize"
                        placeholder="Enter batch size"
                        className="input-field"
                        min="1"
                        step="0.01"
                        defaultValue={isEditMode ? newFormulaData.batchSize : ''}
                        required
                      />
                    </div>
                    
                    <div className="step-actions">
                      <button type="button" onClick={handleCloseAddFormulaModal} className="btn-secondary">
                        Cancel
                      </button>
                      <button type="submit" className="btn-primary">
                        Continue to Ingredients
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Step 2: Formula Name & Batch Size - Create mode */}
              {addFormulaStep === 2 && !isEditMode && (
                <div className="formula-step">
                  <div className="step-header">
                    <h4>Step 2: Formula Details</h4>
                    <div className="product-info">
                      <strong>Product:</strong> {selectedProduct?.Product_ID} - {selectedProduct?.Product_Name}
                      <br />
                      <strong>Type:</strong> {getTypeDisplayName(newFormulaData.type)}
                    </div>
                  </div>
                  
                  <form onSubmit={handleFormulaNameSubmit} className="formula-details-form">
                    <div className="form-group">
                      <label>Formula Name:</label>
                      <div className="name-input-group">
                        <span className="prefix">M_</span>
                        <input
                          type="text"
                          name="subId"
                          placeholder="Enter formula name (e.g., C, GLC, GLD)"
                          className="name-input"
                          maxLength="10"
                          defaultValue={isEditMode ? newFormulaData.subId.replace('M_', '') : ''}
                          required
                        />
                      </div>
                      <small>Formula will be named: M_{'{formula_name}'}</small>
                    </div>
                    
                    <div className="form-group">
                      <label>Batch Size:</label>
                      <input
                        type="number"
                        name="batchSize"
                        placeholder="Enter batch size"
                        className="input-field"
                        min="1"
                        step="0.01"
                        defaultValue={isEditMode ? newFormulaData.batchSize : ''}
                        required
                      />
                    </div>
                    
                    <div className="step-actions">
                      <button type="button" onClick={() => setAddFormulaStep(1)} className="btn-secondary">
                        Back
                      </button>
                      <button type="submit" className="btn-primary">
                        Continue to Ingredients
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Step 3: Ingredients */}
              {addFormulaStep === 3 && (
                <div className="formula-step">
                  <div className="step-header">
                    <h4>Step 3: Add Ingredients</h4>
                    <div className="product-info">
                      <strong>Product:</strong> {selectedProduct?.Product_ID} - {selectedProduct?.Product_Name}
                      <br />
                      <strong>Formula:</strong> {getTypeDisplayName(newFormulaData.type)} - {newFormulaData.subId}
                      <br />
                      <strong>Batch Size:</strong> {newFormulaData.batchSize}
                    </div>
                  </div>
                  
                  <div className="ingredients-form">
                    <div className="ingredients-header">
                      <h5>Ingredients ({newFormulaData.ingredients.length})</h5>
                      <button type="button" onClick={handleAddIngredient} className="btn-add-ingredient">
                        + Add Ingredient
                      </button>
                    </div>
                    
                    <div className="ingredients-list">
                      {newFormulaData.ingredients.map((ingredient, index) => (
                        <div key={index} className="ingredient-form-row">
                          <div className="ingredient-seq">#{ingredient.seqId}</div>
                          
                          <div className="ingredient-select">
                            <label>Material:</label>
                            <div className="material-search-container">
                              <input
                                type="text"
                                value={materialSearchTerms[index] || ''}
                                onChange={(e) => handleMaterialSearch(index, e.target.value)}
                                onFocus={() => handleMaterialInputFocus(index)}
                                onBlur={() => handleMaterialInputBlur(index)}
                                placeholder="Type to search materials..."
                                className="material-search-input"
                                required
                              />
                              
                              {ingredient.itemId && (
                                <button
                                  type="button"
                                  onClick={() => clearMaterialSelection(index)}
                                  className="clear-material-btn"
                                  title="Clear selection"
                                >
                                  ×
                                </button>
                              )}
                              
                              {materialDropdownVisible[index] && (
                                <div className="material-search-results">
                                  {getFilteredBahanData(index).length === 0 ? (
                                    <div className="material-result-item no-results">
                                      <span>No materials found</span>
                                    </div>
                                  ) : (
                                    <>
                                      {getFilteredBahanData(index).slice(0, 15).map(material => (
                                        <div 
                                          key={material.ITEM_ID}
                                          className="material-result-item"
                                          onClick={() => handleMaterialSelect(index, material)}
                                        >
                                          <strong>{material.ITEM_ID}</strong> - {material.Item_Name}
                                          {material.Item_Unit && (
                                            <span className="material-unit-hint">
                                              (Unit: {material.Item_Unit})
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                      {getFilteredBahanData(index).length > 15 && (
                                        <div className="material-result-item more-results">
                                          <small>... and {getFilteredBahanData(index).length - 15} more. Keep typing to narrow down.</small>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="ingredient-qty">
                            <label>Quantity:</label>
                            <input
                              type="text"
                              value={ingredient.qty}
                              onChange={(e) => handleIngredientChange(index, 'qty', e.target.value)}
                              placeholder="0.00"
                              className="qty-input"
                              required
                            />
                          </div>
                          
                          <div className="ingredient-unit">
                            <label>Unit:</label>
                            <select
                              value={ingredient.unitId}
                              onChange={(e) => handleIngredientChange(index, 'unitId', e.target.value)}
                              className="unit-select"
                              required
                            >
                              <option value="">Select</option>
                              {unitsData.map(unit => (
                                <option key={unit.unit_id} value={unit.unit_id}>
                                  {unit.unit_id}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <div className="ingredient-actions">
                            <button
                              type="button"
                              onClick={() => handleRemoveIngredient(index)}
                              className="btn-remove-ingredient"
                              disabled={newFormulaData.ingredients.length <= 1}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="step-actions">
                      {!isEditMode && (
                        <button type="button" onClick={() => setAddFormulaStep(2)} className="btn-secondary">
                          Back
                        </button>
                      )}
                      {isEditMode && (
                        <button type="button" onClick={() => setAddFormulaStep(2)} className="btn-secondary">
                          Edit Details
                        </button>
                      )}
                      <button 
                        type="button" 
                        onClick={handleSubmitFormula}
                        className="btn-primary"
                        disabled={loading}
                      >
                        {loading ? 
                          (isEditMode ? 'Updating Formula...' : 'Creating Formula...') : 
                          (isEditMode ? 'Update Formula' : 'Create Formula')
                        }
                      </button>
                    </div>
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

export default ProductFormula;
