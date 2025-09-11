import React, { useState, useEffect } from 'react';
import { masterAPI, productsAPI, hppAPI } from '../services/api';
import '../styles/HPPSimulation.css';
import '../styles/ProductHPPReport.css'; // Import for modal styling

// Utility functions
const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};

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

  // Simulation results
  const [simulationResults, setSimulationResults] = useState(null);
  const [genericType, setGenericType] = useState('1'); // For GENERIC LOB products
  const [showDetailedReport, setShowDetailedReport] = useState(false);

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

  const buildFormulaString = () => {
    // Build formula string in format: PI#-#PS#KP#KS
    // Use "-" for types that don't have selections
    const parts = [];
    availableTypeCodes.forEach(typeCode => {
      const subId = selectedFormulas[typeCode];
      parts.push(subId || '-');
    });
    return parts.join('#-#');
  };

  const handleRunSimulation = async () => {
    if (Object.keys(selectedFormulas).length === 0) {
      setError('Please select at least one formula before running simulation.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formulaString = buildFormulaString();
      console.log('Running simulation with:', {
        productId: selectedProduct.Product_ID,
        formulaString,
        selectedFormulas
      });

      const response = await hppAPI.generateSimulation(
        selectedProduct.Product_ID,
        formulaString
      );

      const results = response.data || response;
      setSimulationResults(results);
      
      // Move to simulation results step
      setStep(4);
      
      console.log('Simulation completed:', results);
    } catch (error) {
      console.error('Simulation error:', error);
      setError('Failed to run simulation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalCost = (result) => {
    const costs = [
      result.Biaya_Proses || 0,
      result.Biaya_Kemas || 0,
      result.Biaya_Generik || 0,
      result.Biaya_Reagen || 0,
      result.Toll_Fee || 0,
      result.Direct_Labor || 0,
      result.Factory_Over_Head || 0,
      result.Depresiasi || 0
    ];
    return costs.reduce((sum, cost) => sum + cost, 0);
  };

  const calculateCostPerUnit = (result) => {
    const totalCost = calculateTotalCost(result);
    const batchSize = result.Batch_Size || 1;
    return totalCost / batchSize;
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
    } else if (step === 4) {
      setStep(3);
      setSimulationResults(null);
      setGenericType('1');
    }
  };

  // Helper functions to extract material data from selected formulas
  const getBahanBakuFromFormulas = () => {
    const materials = [];
    Object.entries(selectedFormulas).forEach(([typeCode, subId]) => {
      const formula = formulaGroups[typeCode]?.[subId];
      if (formula) {
        formula.materials.forEach(material => {
          const materialInfo = materialMap[material.itemId];
          if (materialInfo && materialInfo.ITEM_TYPE === 'BB') {
            materials.push(material);
          }
        });
      }
    });
    return materials;
  };

  const getBahanKemasFromFormulas = () => {
    const materials = [];
    Object.entries(selectedFormulas).forEach(([typeCode, subId]) => {
      const formula = formulaGroups[typeCode]?.[subId];
      if (formula) {
        formula.materials.forEach(material => {
          const materialInfo = materialMap[material.itemId];
          if (materialInfo && materialInfo.ITEM_TYPE === 'BK') {
            materials.push(material);
          }
        });
      }
    });
    return materials;
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
                onClick={handleRunSimulation}
                disabled={loading || Object.keys(selectedFormulas).length === 0}
              >
                {loading ? 'Running Simulation...' : 'Run Simulation'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Simulation Results */}
        {step === 4 && simulationResults && (
          <div className="simulation-step">
            <h2>Step 4: Simulation Results</h2>
            <p>HPP simulation completed for <strong>{selectedProduct?.Product_ID} - {selectedProduct?.Product_Name}</strong></p>
            
            {simulationResults.length > 0 && (
              <div className="simulation-results-section">
                {/* Print Preview Button */}
                <div className="simulation-actions">
                  <button 
                    type="button" 
                    onClick={() => setShowDetailedReport(true)}
                    className="show-detailed-report-btn"
                  >
                    📋 Show Detailed Report (Print Preview)
                  </button>
                </div>

                {/* LOB Type Selection for GENERIC products */}
                {simulationResults[0].LOB === 'GENERIC' && (
                  <div className="generic-type-selection">
                    <h4>Generic Product Type Selection:</h4>
                    <div className="radio-group">
                      <label className="radio-option">
                        <input
                          type="radio"
                          name="genericType"
                          value="1"
                          checked={genericType === '1'}
                          onChange={(e) => setGenericType(e.target.value)}
                        />
                        <span>Generic Type 1</span>
                      </label>
                      <label className="radio-option">
                        <input
                          type="radio"
                          name="genericType"
                          value="2"
                          checked={genericType === '2'}
                          onChange={(e) => setGenericType(e.target.value)}
                        />
                        <span>Generic Type 2</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Simulation Summary */}
                <div className="simulation-summary">
                  <h4>Simulation Summary:</h4>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <span className="summary-label">Product Type (LOB):</span>
                      <span className="summary-value">{simulationResults[0].LOB}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Batch Size:</span>
                      <span className="summary-value">{simulationResults[0].Batch_Size?.toLocaleString()}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Group Category:</span>
                      <span className="summary-value">{simulationResults[0].Group_PNCategory_Name}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Rendemen:</span>
                      <span className="summary-value">{simulationResults[0].Group_Rendemen}%</span>
                    </div>
                  </div>
                </div>

                {/* Cost Breakdown */}
                <div className="cost-breakdown">
                  <h4>Cost Breakdown:</h4>
                  <div className="cost-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Cost Component</th>
                          <th>Amount (Rp)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Processing Cost</td>
                          <td>{(simulationResults[0].Biaya_Proses || 0).toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td>Packaging Cost</td>
                          <td>{(simulationResults[0].Biaya_Kemas || 0).toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td>Generic Cost</td>
                          <td>{(simulationResults[0].Biaya_Generik || 0).toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td>Reagent Cost</td>
                          <td>{(simulationResults[0].Biaya_Reagen || 0).toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td>Toll Fee</td>
                          <td>{(simulationResults[0].Toll_Fee || 0).toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td>Direct Labor</td>
                          <td>{(simulationResults[0].Direct_Labor || 0).toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td>Factory Overhead</td>
                          <td>{(simulationResults[0].Factory_Over_Head || 0).toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td>Depreciation</td>
                          <td>{(simulationResults[0].Depresiasi || 0).toLocaleString()}</td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr className="total-row">
                          <td><strong>Total Cost per Batch</strong></td>
                          <td><strong>{calculateTotalCost(simulationResults[0]).toLocaleString()}</strong></td>
                        </tr>
                        <tr className="total-row">
                          <td><strong>Cost per Unit</strong></td>
                          <td><strong>{calculateCostPerUnit(simulationResults[0]).toLocaleString()}</strong></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Labor Hours Breakdown */}
                <div className="labor-hours">
                  <h4>Labor Hours Breakdown:</h4>
                  <div className="labor-grid">
                    <div className="labor-item">
                      <span className="labor-label">Processing (MH):</span>
                      <span className="labor-value">{simulationResults[0].MH_Proses_Std || 0}</span>
                    </div>
                    <div className="labor-item">
                      <span className="labor-label">Packaging (MH):</span>
                      <span className="labor-value">{simulationResults[0].MH_Kemas_Std || 0}</span>
                    </div>
                    <div className="labor-item">
                      <span className="labor-label">Analysis (MH):</span>
                      <span className="labor-value">{simulationResults[0].MH_Analisa_Std || 0}</span>
                    </div>
                    <div className="labor-item">
                      <span className="labor-label">Material Weighing (MH):</span>
                      <span className="labor-value">{simulationResults[0].MH_Timbang_BB || 0}</span>
                    </div>
                    <div className="labor-item">
                      <span className="labor-label">Packaging Weighing (MH):</span>
                      <span className="labor-value">{simulationResults[0].MH_Timbang_BK || 0}</span>
                    </div>
                    <div className="labor-item">
                      <span className="labor-label">Machine (MH):</span>
                      <span className="labor-value">{simulationResults[0].MH_Mesin_Std || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Selected Formulas Summary */}
                <div className="selected-formulas-final">
                  <h4>Selected Formulas Used:</h4>
                  <div className="formulas-grid">
                    {Object.entries(selectedFormulas).map(([typeCode, subId]) => (
                      <div key={typeCode} className="formula-final-item">
                        <span className="formula-type">{typeCode}:</span>
                        <span className="formula-id">Formula {subId}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="form-actions">
              <button type="button" onClick={handleBack}>
                Back to Formula Selection
              </button>
              <button type="button" onClick={() => window.print()}>
                Print Results
              </button>
              <button type="button" onClick={() => setStep(1)}>
                New Simulation
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Report Modal - matching ProductHPPReport structure */}
      {showDetailedReport && simulationResults && simulationResults.length > 0 && (
        <div className="product-hpp-modal-overlay">
          <div className="product-hpp-modal">
            <div className="product-hpp-modal-header">
              <h2>Product HPP Report - {selectedProduct?.Product_Name || 'Simulation Result'}</h2>
              <div className="product-hpp-modal-actions">
                <button
                  onClick={() => window.print()}
                  className="product-hpp-export-btn pdf"
                >
                  📄 PDF
                </button>
                <button 
                  onClick={() => setShowDetailedReport(false)} 
                  className="product-hpp-close-btn"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="product-hpp-modal-content">
              <div className="product-hpp-report">
                {/* Document Header - Excel Style */}
                <div className="document-header">
                  <div className="header-row">
                    <div className="header-left">
                      <h3>Perhitungan Estimasi COGS</h3>
                    </div>
                    <div className="header-right">
                      <div className="header-info">
                        <span className="label">Site :</span>
                        <span className="value">PN1/PN2</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Product Info Section */}
                <div className="product-info-section">
                  <div className="info-grid">
                    <div className="info-left">
                      <div className="info-line">
                        <span className="label">Kode Produk - Description</span>
                        <span className="separator">:</span>
                        <span className="value">{selectedProduct.Product_ID} - {selectedProduct.Product_Name}</span>
                      </div>
                      <div className="info-line">
                        <span className="label">Batch Size Teori</span>
                        <span className="separator">:</span>
                        <span className="value">{(simulationResults[0].Batch_Size || 0).toLocaleString()} KOTAK</span>
                      </div>
                      <div className="info-line">
                        <span className="label">Batch Size Actual</span>
                        <span className="separator">:</span>
                        <span className="value">{((simulationResults[0].Batch_Size || 0) * (simulationResults[0].Group_Rendemen || 100) / 100).toLocaleString()} KOTAK</span>
                      </div>
                      <div className="info-line">
                        <span className="label">Rendemen</span>
                        <span className="separator">:</span>
                        <span className="value">{(simulationResults[0].Group_Rendemen || 0).toFixed(2)}%</span>
                      </div>
                    </div>
                    <div className="info-right">
                      <div className="info-line">
                        <span className="label">LOB</span>
                        <span className="separator">:</span>
                        <span className="value">{simulationResults[0].LOB || 'ETH/GEN/OTC/EXP'}</span>
                      </div>
                      <div className="info-line">
                        <span className="label">Tanggal Print</span>
                        <span className="separator">:</span>
                        <span className="value">{new Date().toLocaleDateString('id-ID')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bahan Baku Section */}
                <div className="material-section">
                  <div className="section-title">
                    <h4>Bahan Baku</h4>
                  </div>
                  <table className="excel-table">
                    <thead>
                      <tr>
                        <th rowSpan="2" className="narrow"></th>
                        <th rowSpan="2">Kode Material</th>
                        <th rowSpan="2">Nama Material</th>
                        <th rowSpan="2">Qty</th>
                        <th rowSpan="2">Satuan</th>
                        <th rowSpan="2">Cost/unit</th>
                        <th rowSpan="2">Extended Cost</th>
                        <th rowSpan="2">Per pack</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getBahanBakuFromFormulas().map((item, index) => (
                        <tr key={`bb-sim-${item.itemId}-${index}`}>
                          <td>{index + 1}</td>
                          <td>{item.itemId}</td>
                          <td>{materialMap[item.itemId]?.Item_Name || 'Unknown Material'}</td>
                          <td className="number">{formatNumber(item.qty)}</td>
                          <td>{item.unitId}</td>
                          <td className="number">{formatNumber(item.unitPrice / item.qty)}</td>
                          <td className="number">{formatNumber(item.unitPrice)}</td>
                          <td className="number">{formatNumber(item.unitPrice / ((simulationResults[0].Batch_Size || 1) * (simulationResults[0].Group_Rendemen || 100) / 100))}</td>
                        </tr>
                      ))}
                      <tr className="total-row">
                        <td colSpan="6"><strong>Total BB :</strong></td>
                        <td className="number total">
                          <strong>{formatNumber(getBahanBakuFromFormulas().reduce((sum, item) => sum + item.unitPrice, 0))}</strong>
                        </td>
                        <td className="number total">
                          <strong>{formatNumber(getBahanBakuFromFormulas().reduce((sum, item) => sum + item.unitPrice, 0) / ((simulationResults[0].Batch_Size || 1) * (simulationResults[0].Group_Rendemen || 100) / 100))}</strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Bahan Kemas Section */}
                <div className="material-section">
                  <div className="section-title">
                    <h4>Bahan Kemas</h4>
                  </div>
                  <table className="excel-table">
                    <thead>
                      <tr>
                        <th rowSpan="2" className="narrow"></th>
                        <th rowSpan="2">Kode Material</th>
                        <th rowSpan="2">Nama Material</th>
                        <th rowSpan="2">Qty</th>
                        <th rowSpan="2">Satuan</th>
                        <th rowSpan="2">Cost/unit</th>
                        <th rowSpan="2">Extended Cost</th>
                        <th rowSpan="2">Per pack</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getBahanKemasFromFormulas().map((item, index) => (
                        <tr key={`bk-sim-${item.itemId}-${index}`}>
                          <td>{index + 1}</td>
                          <td>{item.itemId}</td>
                          <td>{materialMap[item.itemId]?.Item_Name || 'Unknown Material'}</td>
                          <td className="number">{formatNumber(item.qty)}</td>
                          <td>{item.unitId}</td>
                          <td className="number">{formatNumber(item.unitPrice / item.qty)}</td>
                          <td className="number">{formatNumber(item.unitPrice)}</td>
                          <td className="number">{formatNumber(item.unitPrice / ((simulationResults[0].Batch_Size || 1) * (simulationResults[0].Group_Rendemen || 100) / 100))}</td>
                        </tr>
                      ))}
                      <tr className="total-row">
                        <td colSpan="6"><strong>Total BK :</strong></td>
                        <td className="number total">
                          <strong>{formatNumber(getBahanKemasFromFormulas().reduce((sum, item) => sum + item.unitPrice, 0))}</strong>
                        </td>
                        <td className="number total">
                          <strong>{formatNumber(getBahanKemasFromFormulas().reduce((sum, item) => sum + item.unitPrice, 0) / ((simulationResults[0].Batch_Size || 1) * (simulationResults[0].Group_Rendemen || 100) / 100))}</strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Dynamic Overhead Section based on LOB */}
                {simulationResults[0].LOB === 'ETHICAL' && (
                  <div className="labor-section">
                    <div className="material-section">
                      <div className="section-title">
                        <h4>Overhead</h4>
                      </div>
                      <table className="excel-table">
                        <thead>
                          <tr>
                            <th>Resource Scheduling</th>
                            <th>Nama Material</th>
                            <th>Qty</th>
                            <th>Mhrs/machine hours</th>
                            <th>Cost/unit</th>
                            <th>Extended Cost</th>
                            <th>Per pack</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>1 PENGOLAHAN</td>
                            <td>OPERATOR PROSES LINE PN1/PN2</td>
                            <td className="number">{formatNumber(simulationResults[0].MH_Proses_Std || 0)}</td>
                            <td>HRS</td>
                            <td className="number">{formatNumber(simulationResults[0].Biaya_Proses || 0)}</td>
                            <td className="number">{formatNumber((simulationResults[0].MH_Proses_Std || 0) * (simulationResults[0].Biaya_Proses || 0))}</td>
                            <td className="number">{formatNumber(((simulationResults[0].MH_Proses_Std || 0) * (simulationResults[0].Biaya_Proses || 0)) / ((simulationResults[0].Batch_Size || 1) * (simulationResults[0].Group_Rendemen || 100) / 100))}</td>
                          </tr>
                          <tr>
                            <td>2 PENGEMASAN</td>
                            <td>OPERATOR PROSES LINE PN1/PN2</td>
                            <td className="number">{formatNumber(simulationResults[0].MH_Kemas_Std || 0)}</td>
                            <td>HRS</td>
                            <td className="number">{formatNumber(simulationResults[0].Biaya_Kemas || 0)}</td>
                            <td className="number">{formatNumber((simulationResults[0].MH_Kemas_Std || 0) * (simulationResults[0].Biaya_Kemas || 0))}</td>
                            <td className="number">{formatNumber(((simulationResults[0].MH_Kemas_Std || 0) * (simulationResults[0].Biaya_Kemas || 0)) / ((simulationResults[0].Batch_Size || 1) * (simulationResults[0].Group_Rendemen || 100) / 100))}</td>
                          </tr>
                          <tr className="total-row">
                            <td colSpan="2"><strong>Total Hours</strong></td>
                            <td className="number"><strong>{formatNumber((simulationResults[0].MH_Proses_Std || 0) + (simulationResults[0].MH_Kemas_Std || 0))}</strong></td>
                            <td><strong>Total Cost</strong></td>
                            <td></td>
                            <td className="number total">
                              <strong>{formatNumber(((simulationResults[0].MH_Proses_Std || 0) * (simulationResults[0].Biaya_Proses || 0)) + ((simulationResults[0].MH_Kemas_Std || 0) * (simulationResults[0].Biaya_Kemas || 0)))}</strong>
                            </td>
                            <td className="number total">
                              <strong>{formatNumber((((simulationResults[0].MH_Proses_Std || 0) * (simulationResults[0].Biaya_Proses || 0)) + ((simulationResults[0].MH_Kemas_Std || 0) * (simulationResults[0].Biaya_Kemas || 0))) / ((simulationResults[0].Batch_Size || 1) * (simulationResults[0].Group_Rendemen || 100) / 100))}</strong>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Final Total */}
                <div className="final-total-section">
                  <table className="excel-table">
                    <tbody>
                      <tr className="final-total">
                        <td><strong>Total COGS Estimasi</strong></td>
                        <td colSpan="3"></td>
                        <td><strong>Total HPP</strong></td>
                        <td className="number final">
                          <strong>{formatNumber(calculateTotalCost(simulationResults[0]))}</strong>
                        </td>
                        <td className="number final">
                          <strong>{formatNumber(calculateCostPerUnit(simulationResults[0]))}</strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
