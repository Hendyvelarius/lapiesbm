import React, { useState, useEffect } from 'react';
import { masterAPI, productsAPI } from '../services/api';
import '../styles/HPPSimulation.css';

export default function HPPSimulation() {
  const [step, setStep] = useState(1);
  const [simulationType, setSimulationType] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productOptions, setProductOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Available products with formulas (intersection of productName and chosenFormula)
  const [availableProducts, setAvailableProducts] = useState([]);

  // Formula data for selected product
  const [recipeData, setRecipeData] = useState([]);
  const [formulaGroups, setFormulaGroups] = useState({});
  const [selectedFormulas, setSelectedFormulas] = useState({});
  const [availableTypeCodes] = useState(['PI', 'PS', 'KP', 'KS']);
  const [typeCodeNames] = useState({
    'PI': '1. PENGOLAHAN INTI',
    'PS': '2. PENGOLAHAN SEKUNDER', 
    'KP': '3. KEMASAN PRIMER',
    'KS': '4. KEMASAN SEKUNDER'
  });

  // Material master data
  const [materialData, setMaterialData] = useState([]);
  const [materialMap, setMaterialMap] = useState({});

  // Load available products when component mounts or when simulation type changes to "Existing Formula"
  useEffect(() => {
    if (simulationType === 'existing') {
      loadAvailableProducts();
    }
  }, [simulationType]);

  // Filter products based on search query
  useEffect(() => {
    if (!productSearchQuery) {
      setProductOptions([]);
      return;
    }

    const filtered = availableProducts.filter(product => 
      product.Product_ID.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
      product.Product_Name.toLowerCase().includes(productSearchQuery.toLowerCase())
    );
    setProductOptions(filtered.slice(0, 10)); // Limit to 10 results
  }, [productSearchQuery, availableProducts]);

  const loadAvailableProducts = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Get all products and chosen formulas in parallel
      const [productNamesResponse, chosenFormulasResponse] = await Promise.all([
        masterAPI.getProductName(),
        productsAPI.getChosenFormula()
      ]);

      const productNames = productNamesResponse.data || productNamesResponse;
      const chosenFormulas = chosenFormulasResponse.data || chosenFormulasResponse;

      // Create a set of product IDs that have chosen formulas
      const productsWithFormulas = new Set(
        chosenFormulas.map(formula => formula.Product_ID)
      );

      // Filter product names to only include those with formulas
      const available = productNames.filter(product => 
        productsWithFormulas.has(product.Product_ID)
      );

      setAvailableProducts(available);
      
      console.log('Available products with formulas:', available);
    } catch (error) {
      console.error('Error loading available products:', error);
      setError('Failed to load available products. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulationTypeSelect = (type) => {
    setSimulationType(type);
    setError('');
    setSelectedProduct(null);
    setProductSearchQuery('');
    setProductOptions([]);
    
    if (type === 'existing') {
      setStep(2); // Move to product selection step
    } else {
      setError('Custom Formula simulation will be implemented soon.');
    }
  };

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setProductSearchQuery(''); // Clear search bar after selection
    setProductOptions([]);
  };

  const handleNextStep = () => {
    if (step === 2 && selectedProduct) {
      // Load recipe data for the selected product
      loadRecipeData(selectedProduct.Product_ID);
    }
  };

  const loadRecipeData = async (productId) => {
    setLoading(true);
    setError('');
    
    try {
      console.log('Loading recipe data for product:', productId);
      
      // Load both recipe data and material data in parallel
      const [recipeResponse, materialResponse] = await Promise.all([
        productsAPI.getRecipe(productId),
        masterAPI.getMaterial()
      ]);
      
      const recipeData = recipeResponse.data || recipeResponse;
      const materialData = materialResponse.data || materialResponse;
      
      setRecipeData(recipeData);
      setMaterialData(materialData);
      
      // Create material lookup map
      const materialLookup = {};
      materialData.forEach(material => {
        materialLookup[material.ITEM_ID] = material;
      });
      setMaterialMap(materialLookup);
      
      // Process and group the data by TypeCode and PPI_SubID
      const groups = processRecipeData(recipeData);
      setFormulaGroups(groups);
      
      // Set default selected formulas (active ones)
      const defaultSelections = getDefaultFormulas(groups);
      setSelectedFormulas(defaultSelections);
      
      setStep(3);
      console.log('Recipe data loaded:', { recipeData, materialData, groups, defaultSelections });
    } catch (error) {
      console.error('Error loading recipe data:', error);
      setError('Failed to load product recipe data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const processRecipeData = (data) => {
    const groups = {};
    
    // Group by TypeCode first, then by PPI_SubID
    data.forEach(item => {
      const { TypeCode, PPI_SubID } = item;
      
      if (!groups[TypeCode]) {
        groups[TypeCode] = {};
      }
      
      if (!groups[TypeCode][PPI_SubID]) {
        groups[TypeCode][PPI_SubID] = {
          subId: PPI_SubID,
          typeName: item.TypeName,
          isActive: item.DefaultCOGS === 'Aktif',
          batchSize: item.BatchSize,
          source: item.Source,
          materials: []
        };
      }
      
      // Add material to the formula
      groups[TypeCode][PPI_SubID].materials.push({
        seqId: item.PPI_SeqID,
        itemId: item.PPI_ItemID,
        unitId: item.PPI_UnitID,
        qty: parseFloat(item.PPI_QTY),
        unitPrice: item.UnitPrice,
        purchaseQtyUnit: item.PurchaseQTYUnit,
        purchaseUnit: item.PurchaseUnit,
        itemType: item.ITEM_TYPE
      });
    });
    
    return groups;
  };

  const getDefaultFormulas = (groups) => {
    const defaults = {};
    
    Object.keys(groups).forEach(typeCode => {
      // Find the active formula for this TypeCode
      const activeSubId = Object.keys(groups[typeCode]).find(subId => 
        groups[typeCode][subId].isActive
      );
      
      if (activeSubId) {
        defaults[typeCode] = activeSubId;
      }
    });
    
    return defaults;
  };

  const handleFormulaSelection = (typeCode, subId) => {
    setSelectedFormulas(prev => ({
      ...prev,
      [typeCode]: subId
    }));
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setSimulationType('');
      setSelectedProduct(null);
      setProductSearchQuery('');
      setProductOptions([]);
    } else if (step === 3) {
      setStep(2);
      setRecipeData([]);
      setFormulaGroups({});
      setSelectedFormulas({});
    }
  };

  return (
    <div className="hpp-simulation-container">
      <div className="hpp-simulation-header">
        <h1>HPP Simulation</h1>
        <p>Guided step-by-step process to simulate Cost of Goods Sold (COGS) for products</p>
      </div>

      <div className="hpp-simulation-card">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Step 1: Select Simulation Type */}
        {step === 1 && (
          <div className="simulation-step">
            <h2>Step 1: Choose Simulation Type</h2>
            <p>What type of simulation would you like to perform?</p>
            
            <div className="simulation-type-options">
              <div 
                className={`simulation-option ${simulationType === 'existing' ? 'selected' : ''}`}
                onClick={() => handleSimulationTypeSelect('existing')}
              >
                <div className="option-icon">📋</div>
                <h3>Existing Formula</h3>
                <p>Simulate COGS using an existing product formula that has already been configured in the system.</p>
                <div className="option-features">
                  <span>✓ Use predefined formulas</span>
                  <span>✓ Quick simulation</span>
                  <span>✓ Based on real product data</span>
                </div>
              </div>

              <div 
                className={`simulation-option ${simulationType === 'custom' ? 'selected' : ''}`}
                onClick={() => handleSimulationTypeSelect('custom')}
              >
                <div className="option-icon">⚙️</div>
                <h3>Custom Formula</h3>
                <p>Create a custom simulation with your own formula parameters and ingredient specifications.</p>
                <div className="option-features">
                  <span>✓ Custom ingredients</span>
                  <span>✓ Flexible parameters</span>
                  <span>✓ What-if scenarios</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Product Selection (for Existing Formula) */}
        {step === 2 && simulationType === 'existing' && (
          <div className="simulation-step">
            <h2>Step 2: Select Product</h2>
            <p>Choose a product that has an existing formula configured.</p>
            
            <div className="product-search-section">
              <div className="search-input-container">
                <input
                  type="text"
                  placeholder="Search by Product ID or Product Name..."
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  className="product-search-input"
                />
                {loading && (
                  <div className="search-loading">Searching...</div>
                )}
              </div>

              {productOptions.length > 0 && (
                <div className="product-options">
                  {productOptions.map((product) => (
                    <div
                      key={product.Product_ID}
                      className={`product-option ${selectedProduct?.Product_ID === product.Product_ID ? 'selected' : ''}`}
                      onClick={() => handleProductSelect(product)}
                    >
                      <div className="product-id">{product.Product_ID}</div>
                      <div className="product-name">{product.Product_Name}</div>
                    </div>
                  ))}
                </div>
              )}

              {productSearchQuery && productOptions.length === 0 && !loading && (
                <div className="no-products-found">
                  No products found matching "{productSearchQuery}". Make sure the product has a configured formula.
                </div>
              )}

              {selectedProduct && (
                <div className="selected-product">
                  <h4>Selected Product:</h4>
                  <div className="product-details">
                    <strong>{selectedProduct.Product_ID}</strong> - {selectedProduct.Product_Name}
                  </div>
                </div>
              )}
            </div>

            <div className="available-products-info">
              <p><strong>Available Products:</strong> {availableProducts.length} products with configured formulas</p>
            </div>

            <div className="form-actions">
              <button type="button" onClick={handleBack}>
                Back
              </button>
              <button 
                type="button" 
                onClick={handleNextStep}
                disabled={!selectedProduct}
              >
                Continue to Simulation
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Formula Selection */}
        {step === 3 && (
          <div className="simulation-step">
            <h2>Step 3: Select Formulas</h2>
            <p>Choose the formulas you want to simulate for <strong>{selectedProduct?.Product_ID} - {selectedProduct?.Product_Name}</strong></p>
            
            {loading && (
              <div className="loading-message">
                Loading recipe data and materials...
              </div>
            )}

            {!loading && Object.keys(formulaGroups).length === 0 && (
              <div className="no-formulas-message">
                No formulas found for this product. Please ensure the product has configured formulas.
              </div>
            )}

            {!loading && Object.keys(formulaGroups).length > 0 && (
              <div className="formula-selection-section">
                {availableTypeCodes.map(typeCode => {
                  const typeFormulas = formulaGroups[typeCode];
                  
                  if (!typeFormulas) {
                    return (
                      <div key={typeCode} className="formula-type-section">
                        <h3 className="formula-type-title unavailable">
                          {typeCode} - {typeCodeNames[typeCode]}
                          <span className="unavailable-badge">Not Available</span>
                        </h3>
                        <p className="unavailable-text">No formulas configured for this type.</p>
                      </div>
                    );
                  }

                  const subIds = Object.keys(typeFormulas);
                  const selectedSubId = selectedFormulas[typeCode];
                  const selectedFormula = selectedSubId ? typeFormulas[selectedSubId] : null;

                  return (
                    <div key={typeCode} className="formula-type-section">
                      <h3 className="formula-type-title">
                        {typeCode} - {typeCodeNames[typeCode]}
                      </h3>
                      
                      <div className="formula-dropdown-section">
                        <label className="formula-dropdown-label">
                          Select Formula:
                        </label>
                        <select
                          className="formula-dropdown"
                          value={selectedSubId || ''}
                          onChange={(e) => handleFormulaSelection(typeCode, e.target.value)}
                        >
                          <option value="">-- Select a formula --</option>
                          {subIds.map(subId => {
                            const formula = typeFormulas[subId];
                            return (
                              <option key={subId} value={subId}>
                                Formula {subId} - {formula.source} 
                                {formula.isActive ? ' (Currently Active)' : ''}
                                {formula.batchSize ? ` - Batch: ${formula.batchSize.toLocaleString()}` : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {selectedFormula && (
                        <div className="selected-formula-details">
                          <div className="formula-info">
                            <div className="formula-info-row">
                              <span className="info-label">Formula ID:</span>
                              <span className="info-value">
                                {selectedSubId}
                                {selectedFormula.isActive && <span className="active-indicator">Currently Active</span>}
                              </span>
                            </div>
                            <div className="formula-info-row">
                              <span className="info-label">Source:</span>
                              <span className="info-value">{selectedFormula.source}</span>
                            </div>
                            <div className="formula-info-row">
                              <span className="info-label">Batch Size:</span>
                              <span className="info-value">{selectedFormula.batchSize?.toLocaleString() || 'N/A'}</span>
                            </div>
                            <div className="formula-info-row">
                              <span className="info-label">Total Materials:</span>
                              <span className="info-value">{selectedFormula.materials.length}</span>
                            </div>
                          </div>

                          <div className="materials-table">
                            <h4>Materials Used:</h4>
                            <div className="table-container">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Seq</th>
                                    <th>Material ID</th>
                                    <th>Material Name</th>
                                    <th>Type</th>
                                    <th>Quantity</th>
                                    <th>Unit</th>
                                    <th>Unit Price</th>
                                    <th>Total Cost</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedFormula.materials.map((material, idx) => {
                                    const materialInfo = materialMap[material.itemId] || {};
                                    // Calculate actual unit price: total price divided by formula quantity
                                    const actualUnitPrice = material.unitPrice && material.qty 
                                      ? material.unitPrice / material.qty 
                                      : 0;
                                    // Total cost is just the UnitPrice (which is already the total cost for this material in the formula)
                                    const totalCost = material.unitPrice || 0;
                                    
                                    return (
                                      <tr key={idx}>
                                        <td>{material.seqId}</td>
                                        <td className="material-id-cell">{material.itemId}</td>
                                        <td className="material-name-cell">
                                          {materialInfo.Item_Name || 'Unknown Material'}
                                        </td>
                                        <td>
                                          <span className={`item-type-badge ${material.itemType.toLowerCase()}`}>
                                            {material.itemType}
                                          </span>
                                        </td>
                                        <td className="qty-cell">{material.qty.toLocaleString()}</td>
                                        <td>{material.unitId}</td>
                                        <td className="price-cell">
                                          {actualUnitPrice ? `Rp ${actualUnitPrice.toLocaleString()}` : 'N/A'}
                                        </td>
                                        <td className="total-cost-cell">
                                          <strong>Rp {totalCost.toLocaleString()}</strong>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="total-row">
                                    <td colSpan="7"><strong>Total Formula Cost:</strong></td>
                                    <td className="total-cost-cell">
                                      <strong>
                                        Rp {selectedFormula.materials
                                          .reduce((sum, material) => sum + (material.unitPrice || 0), 0)
                                          .toLocaleString()}
                                      </strong>
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="form-actions">
              <button type="button" onClick={handleBack}>
                Back
              </button>
              <button 
                type="button" 
                onClick={() => setStep(4)}
                disabled={loading || Object.keys(selectedFormulas).length === 0}
              >
                Continue to Simulation
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Simulation Configuration (placeholder for next implementation) */}
        {step === 4 && (
          <div className="simulation-step">
            <h2>Step 4: Simulation Configuration</h2>
            <p>Configure simulation parameters for <strong>{selectedProduct?.Product_ID} - {selectedProduct?.Product_Name}</strong></p>
            
            <div className="selected-formulas-summary">
              <h4>Selected Formulas:</h4>
              <ul>
                {Object.entries(selectedFormulas).map(([typeCode, subId]) => (
                  <li key={typeCode}>
                    <strong>{typeCode}</strong> - {typeCodeNames[typeCode]}: Formula {subId}
                    {formulaGroups[typeCode]?.[subId]?.isActive && ' (Currently Active)'}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="placeholder-content">
              <p>This step will be implemented next. Here we will:</p>
              <ul>
                <li>Display detailed cost calculations for selected formulas</li>
                <li>Allow parameter adjustments (batch size, material prices)</li>
                <li>Configure simulation scenarios</li>
                <li>Run the simulation calculations</li>
              </ul>
            </div>

            <div className="form-actions">
              <button type="button" onClick={handleBack}>
                Back
              </button>
              <button type="button" disabled>
                Run Simulation (Coming Soon)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
