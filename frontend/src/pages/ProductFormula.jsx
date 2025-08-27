import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/ProductFormula.css';

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
  const [groupedRecipes, setGroupedRecipes] = useState({});
  const [expandedSubIds, setExpandedSubIds] = useState(new Set());

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

      // Load product list and material data
      const [productsRes, materialsRes] = await Promise.all([
        api.master.getProductName(),
        api.master.getMaterial()
      ]);

      setProductList(productsRes || []);
      setMaterialData(materialsRes || []);
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
          batchSize: recipe.BatchSize, // Note: This might not be in the new structure
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
            <button className="btn-primary">
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
                                <div className="cell cell-output">
                                  {renderDefaultBadge(formulaData)}
                                </div>
                                <div className="cell cell-actions">
                                  <button 
                                    className="btn-edit"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // TODO: Handle edit
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button 
                                    className="btn-delete"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // TODO: Handle delete
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                              
                              {/* Expanded Ingredients */}
                              {isExpanded && (
                                <div className="ingredients-section">
                                  <div className="ingredients-header">
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
    </div>
  );
};

export default ProductFormula;
