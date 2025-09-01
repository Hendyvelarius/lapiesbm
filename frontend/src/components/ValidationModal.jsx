import React, { useState, useEffect } from 'react';
import { CheckCircle, X, AlertTriangle, Loader, Info } from 'lucide-react';
import api from '../services/api';
import '../styles/ValidationModal.css';

const ValidationModal = ({ isOpen, onClose, onValidationComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [validationSteps, setValidationSteps] = useState([
    {
      id: 1,
      title: 'Checking product formula assignments',
      description: 'Verifying HPP products have proper formula assignments and batch sizes',
      status: 'pending', // pending, running, completed, failed, warning
      details: null,
      errors: []
    },
    {
      id: 2,
      title: 'Validating formula data integrity',
      description: 'Checking assigned formulas exist and have valid batch sizes',
      status: 'pending',
      details: null,
      errors: []
    },
    {
      id: 3,
      title: 'Checking material price availability',
      description: 'Verifying all formula ingredients have current prices',
      status: 'pending',
      details: null,
      errors: []
    },
    {
      id: 4,
      title: 'Validating cost parameters',
      description: 'Checking labor costs, overhead costs, and other parameters',
      status: 'pending',
      details: null,
      errors: []
    },
    {
      id: 5,
      title: 'Verifying currency and exchange rates',
      description: 'Ensuring current exchange rates are available',
      status: 'pending',
      details: null,
      errors: []
    }
  ]);
  
  const [isRunning, setIsRunning] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [hasWarning, setHasWarning] = useState(false);
  const [validationData, setValidationData] = useState({
    chosenFormulas: [],
    availableFormulas: [],
    productList: []
  });

  // Load initial data when modal opens
  useEffect(() => {
    if (isOpen) {
      resetValidation();
      loadInitialData();
    }
  }, [isOpen]);

  const resetValidation = () => {
    setCurrentStep(0);
    setIsRunning(false);
    setHasError(false);
    setHasWarning(false);
    setValidationSteps(prev => prev.map(step => ({
      ...step,
      status: 'pending',
      details: null,
      errors: []
    })));
  };

  const loadInitialData = async () => {
    try {
      const [chosenRes, formulaRes, productRes] = await Promise.all([
        api.products.getChosenFormula(),
        api.products.getFormula(),
        api.master.getProductName()
      ]);

      setValidationData({
        chosenFormulas: chosenRes || [],
        availableFormulas: formulaRes || [],
        productList: productRes || []
      });
    } catch (error) {
      console.error('Error loading validation data:', error);
      // Still proceed with validation - errors will be caught in individual steps
    }
  };

  const startValidation = async () => {
    setIsRunning(true);
    setHasError(false);
    setHasWarning(false);
    let validationFailed = false;
    let hasWarnings = false;

    // Step 1 & 2: Formula Assignment and Data Integrity Validation
    const formulaValidationResult = await validateFormulaAssignments();
    if (formulaValidationResult === 'failed') {
      validationFailed = true;
    } else if (formulaValidationResult === 'warning') {
      hasWarnings = true;
    }

    // Only continue if formula validation didn't fail (warnings are okay)
    if (!validationFailed) {
      // Step 3: Material Price Validation (mockup for now)
      const materialValidationSuccess = await validateMaterialPrices();
      if (!materialValidationSuccess) {
        validationFailed = true;
      }
    }

    if (!validationFailed) {
      // Step 4: Cost Parameters Validation (mockup for now)
      const costValidationSuccess = await validateCostParameters();
      if (!costValidationSuccess) {
        validationFailed = true;
      }
    }

    if (!validationFailed) {
      // Step 5: Currency Validation (mockup for now)
      const currencyValidationSuccess = await validateCurrencyRates();
      if (!currencyValidationSuccess) {
        validationFailed = true;
      }
    }

    setIsRunning(false);
    setHasWarning(hasWarnings);

    // If all validations passed or only have warnings, notify parent
    if (!validationFailed) {
      const validationStatus = hasWarnings ? 'warning' : 'success';
      setTimeout(() => {
        onValidationComplete(validationStatus);
      }, 1000);
    } else {
      // If there were errors, notify parent but keep modal open
      onValidationComplete('failed');
    }
  };

  const validateFormulaAssignments = async () => {
    // Step 1: Check formula assignments and batch sizes
    setCurrentStep(1);
    updateStepStatus(1, 'running');
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing time

    const { chosenFormulas, availableFormulas } = validationData;
    const errors = [];
    
    // Create a map of available formulas by product and type
    const availableFormulaMap = {};
    availableFormulas.forEach(formula => {
      if (!availableFormulaMap[formula.Product_ID]) {
        availableFormulaMap[formula.Product_ID] = {};
      }
      if (!availableFormulaMap[formula.Product_ID][formula.TypeCode]) {
        availableFormulaMap[formula.Product_ID][formula.TypeCode] = [];
      }
      availableFormulaMap[formula.Product_ID][formula.TypeCode].push(formula);
    });

    // Create a map of chosen formulas by product
    const chosenFormulaMap = {};
    chosenFormulas.forEach(chosen => {
      chosenFormulaMap[chosen.Product_ID] = chosen;
    });

    // Only validate products that are part of HPP calculation (exist in M_COGS_PRODUCT_FORMULA_FIX)
    // These are the products that should have proper formula assignments
    const hppProductIds = chosenFormulas.map(cf => cf.Product_ID);

    let checkedProducts = 0;
    let productsWithIssues = [];

    hppProductIds.forEach(productId => {
      checkedProducts++;
      const chosen = chosenFormulaMap[productId];
      const available = availableFormulaMap[productId] || {};
      const productIssues = [];

      // First check if the chosen formula has a valid Std_Output (batch size)
      if (!chosen.Std_Output || chosen.Std_Output === 0) {
        productIssues.push(`Product batch size is null or 0 (${chosen.Std_Output || 'null'})`);
      }

      // Check each formula type
      ['PI', 'PS', 'KP', 'KS'].forEach(type => {
        const assignedValue = chosen ? chosen[type] : null;
        const availableFormulas = available[type] || [];

        // Check if there's a valid assignment (not null and not undefined)
        // Note: Empty string "" is a valid assignment for "unnamed" formulas
        const hasAssignment = assignedValue !== null && assignedValue !== undefined;
        
        if (availableFormulas.length > 0 && !hasAssignment) {
          // Product has available formulas but none assigned (null or undefined)
          productIssues.push(`${type} formulas available but none assigned`);
        } else if (hasAssignment && availableFormulas.length === 0) {
          // Product has assignment but no available formulas
          const displayValue = assignedValue === "" ? "(unnamed)" : `"${assignedValue}"`;
          productIssues.push(`${type} assigned to ${displayValue} but no formulas available for this type`);
        } else if (hasAssignment) {
          // Check if assigned formula exists (including empty string formulas)
          const assignedExists = availableFormulas.some(f => f.PPI_SubID === assignedValue);
          if (!assignedExists) {
            const displayValue = assignedValue === "" ? "(unnamed)" : `"${assignedValue}"`;
            productIssues.push(`${type} assigned to non-existent formula ${displayValue}`);
          }
        }
      });

      if (productIssues.length > 0) {
        productsWithIssues.push({
          productId,
          productName: getProductName(productId),
          issues: productIssues
        });
      }
    });

    if (productsWithIssues.length > 0) {
      errors.push(...productsWithIssues.map(p => 
        `${p.productId} (${p.productName}): ${p.issues.join(', ')}`
      ));
      updateStepStatus(1, 'failed', {
        summary: `${productsWithIssues.length} of ${checkedProducts} products have formula assignment issues`,
        errors
      });
      setHasError(true);
      return 'failed'; // Return failure
    }

    updateStepStatus(1, 'completed', {
      summary: `All ${checkedProducts} products have correct formula assignments and batch sizes`,
      details: `Checked ${checkedProducts} products, all formula assignments are valid`
    });

    // Step 2: Validate formula data integrity
    await new Promise(resolve => setTimeout(resolve, 500));
    setCurrentStep(2);
    updateStepStatus(2, 'running');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const criticalErrors = [];
    const warnings = [];
    
    chosenFormulas.forEach(chosen => {
      ['PI', 'PS', 'KP', 'KS'].forEach(type => {
        const assignedValue = chosen[type];
        
        // Check if there's a valid assignment (not null and not undefined)
        // Note: Empty string "" is a valid assignment for "unnamed" formulas
        const hasAssignment = assignedValue !== null && assignedValue !== undefined;
        
        if (hasAssignment) {
          const availableFormulas = availableFormulaMap[chosen.Product_ID]?.[type] || [];
          const assignedFormula = availableFormulas.find(f => f.PPI_SubID === assignedValue);
          
          if (!assignedFormula) {
            // Critical error: assigned formula doesn't exist
            const displayValue = assignedValue === "" ? "(unnamed)" : `"${assignedValue}"`;
            criticalErrors.push(
              `${chosen.Product_ID} (${getProductName(chosen.Product_ID)}): ${type} formula ${displayValue} does not exist`
            );
          } else if (!assignedFormula.BatchSize || assignedFormula.BatchSize === 0) {
            // Warning: formula exists but has invalid batch size
            const displayValue = assignedValue === "" ? "(unnamed)" : `"${assignedValue}"`;
            warnings.push(
              `${chosen.Product_ID} (${getProductName(chosen.Product_ID)}): ${type} formula ${displayValue} has invalid batch size (${assignedFormula.BatchSize || 'null'})`
            );
          }
        }
      });
    });

    // Handle critical errors first
    if (criticalErrors.length > 0) {
      updateStepStatus(2, 'failed', {
        summary: `${criticalErrors.length} formula(s) have critical issues`,
        errors: criticalErrors
      });
      setHasError(true);
      return 'failed';
    }

    // If only warnings, show warning state
    if (warnings.length > 0) {
      updateStepStatus(2, 'warning', {
        summary: `${warnings.length} formula(s) have batch size warnings`,
        errors: warnings,
        warningMessage: 'These formulas have invalid batch sizes but validation can proceed. Consider fixing these issues for better accuracy.'
      });
      return 'warning';
    }

    updateStepStatus(2, 'completed', {
      summary: `All assigned formulas have valid batch sizes`,
      details: `Validated batch sizes for all formula assignments`
    });
    
    return 'success';
  };

  // Material price validation - check if all formula materials have proper pricing
  const validateMaterialPrices = async () => {
    setCurrentStep(3);
    updateStepStatus(3, 'running');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      // Get active formula details containing all materials used in active formulas
      const activeFormulaDetails = await api.products.getActiveFormulaDetails();
      
      const missingPriceMaterials = [];
      const checkedMaterials = new Set(); // To avoid duplicate checks
      
      // Check each material in active formulas
      activeFormulaDetails.forEach(formula => {
        const materialKey = `${formula.PPI_ItemID}`;
        
        // Skip if already checked this material
        if (checkedMaterials.has(materialKey)) {
          return;
        }
        checkedMaterials.add(materialKey);
        
        const { UnitPrice, PurchaseQTYUnit, PurchaseUnit } = formula;
        
        // Validation logic:
        // 1. UnitPrice = 0 is valid (free materials)
        // 2. UnitPrice = null AND PurchaseQTYUnit = null AND PurchaseUnit = "" is valid (free materials in Harga Bahan)
        // 3. All null (UnitPrice = null, PurchaseQTYUnit = null, PurchaseUnit = null) = INVALID (not in Harga Bahan)
        
        const isAllNull = UnitPrice === null && PurchaseQTYUnit === null && PurchaseUnit === null;
        const isFreeInHargaBahan = UnitPrice === null && PurchaseQTYUnit === null && PurchaseUnit === "";
        const hasValidPrice = UnitPrice !== null && UnitPrice !== undefined;
        
        if (isAllNull) {
          // Material not added to Harga Bahan yet
          missingPriceMaterials.push({
            itemId: formula.PPI_ItemID,
            productName: formula.Product_Name,
            productId: formula.Product_ID,
            formulaType: formula.TypeCode,
            issue: 'Material not found in Harga Bahan database'
          });
        } else if (!isFreeInHargaBahan && !hasValidPrice) {
          // Material exists but has invalid pricing setup
          missingPriceMaterials.push({
            itemId: formula.PPI_ItemID,
            productName: formula.Product_Name,
            productId: formula.Product_ID,
            formulaType: formula.TypeCode,
            issue: 'Material has invalid price configuration'
          });
        }
      });
      
      if (missingPriceMaterials.length > 0) {
        const errors = missingPriceMaterials.map(material => 
          `${material.itemId} (used in ${material.productId} - ${material.productName} ${material.formulaType} formula): ${material.issue}`
        );
        
        updateStepStatus(3, 'failed', {
          summary: `${missingPriceMaterials.length} material(s) need price configuration`,
          errors,
          helpMessage: 'Please add these materials to Harga Bahan page or configure their pricing properly.'
        });
        
        return false;
      }
      
      updateStepStatus(3, 'completed', {
        summary: `All ${checkedMaterials.size} formula materials have valid pricing`,
        details: `Checked materials from ${activeFormulaDetails.length} active formula entries`
      });
      
      return true;
    } catch (error) {
      console.error('Error validating material prices:', error);
      updateStepStatus(3, 'failed', {
        summary: 'Failed to validate material prices',
        errors: [`Error loading material data: ${error.message}`]
      });
      
      return false;
    }
  };

  const validateCostParameters = async () => {
    setCurrentStep(4);
    updateStepStatus(4, 'running');
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    try {
      // Get pembebanan and parameter data
      const [pembebanannData, parameterData] = await Promise.all([
        api.master.getPembebanan(),
        api.master.getParameter()
      ]);
      
      const errors = [];
      let defaultCosts = [];
      let customCosts = [];
      
      // Validate Parameter data (should have all non-null values except Periode)
      if (!parameterData || parameterData.length === 0) {
        errors.push('Parameter data not found - required for cost calculations');
      } else {
        const currentYearParam = parameterData.find(p => p.Periode === '2025');
        if (!currentYearParam) {
          errors.push('Parameter data for current year (2025) not found');
        } else {
          const requiredParams = [
            'Direct_Labor', 'Factory_Over_Head', 'Depresiasi', 'MH_Timbang_BB',
            'MH_Timbang_BK', 'MH_Analisa', 'Biaya_Analisa', 'Jam_KWH_Mesin_Utama', 'Rate_KWH_Mesin'
          ];
          
          requiredParams.forEach(param => {
            const value = currentYearParam[param];
            if (value === null || value === undefined || typeof value !== 'number') {
              errors.push(`Parameter "${param}" is not properly set (current value: ${value})`);
            }
          });
        }
      }
      
      // Validate Pembebanan data
      if (!pembebanannData || pembebanannData.length === 0) {
        errors.push('Pembebanan data not found - required for machine cost calculations');
      } else {
        // Separate default costs (Group_ProductID = null) from custom costs
        defaultCosts = pembebanannData.filter(cost => cost.Group_ProductID === null);
        customCosts = pembebanannData.filter(cost => cost.Group_ProductID !== null);
        
        // Validate default costs (one for each PNCategoryID)
        const categoryIds = [...new Set(pembebanannData.map(p => p.Group_PNCategoryID))];
        categoryIds.forEach(categoryId => {
          const defaultCost = defaultCosts.find(d => d.Group_PNCategoryID === categoryId);
          if (!defaultCost) {
            errors.push(`Default cost not set for category ${categoryId}`);
          } else {
            if (defaultCost.Group_Proses_Rate === null || defaultCost.Group_Proses_Rate === undefined) {
              errors.push(`Default Group_Proses_Rate not set for category ${categoryId} (${defaultCost.Group_PNCategory_Name})`);
            }
            if (defaultCost.Group_Kemas_Rate === null || defaultCost.Group_Kemas_Rate === undefined) {
              errors.push(`Default Group_Kemas_Rate not set for category ${categoryId} (${defaultCost.Group_PNCategory_Name})`);
            }
          }
        });
        
        // Validate custom costs (products with specific cost assignments)
        customCosts.forEach(customCost => {
          if (customCost.Group_Proses_Rate === null || customCost.Group_Proses_Rate === undefined) {
            errors.push(`Custom Group_Proses_Rate not set for product ${customCost.Group_ProductID} in category ${customCost.Group_PNCategoryID}`);
          }
          if (customCost.Group_Kemas_Rate === null || customCost.Group_Kemas_Rate === undefined) {
            errors.push(`Custom Group_Kemas_Rate not set for product ${customCost.Group_ProductID} in category ${customCost.Group_PNCategoryID}`);
          }
          // Note: Toll_Fee is optional, so we don't validate it
        });
      }
      
      if (errors.length > 0) {
        updateStepStatus(4, 'failed', {
          summary: `${errors.length} cost parameter issue(s) found`,
          errors,
          helpMessage: 'Please configure cost parameters in Pembebanan and Parameter pages.'
        });
        
        return false;
      }
      
      updateStepStatus(4, 'completed', {
        summary: 'All cost parameters are properly configured',
        details: `Validated ${defaultCosts.length} default cost categories and ${customCosts.length} custom product costs`
      });
      
      return true;
    } catch (error) {
      console.error('Error validating cost parameters:', error);
      updateStepStatus(4, 'failed', {
        summary: 'Failed to validate cost parameters',
        errors: [`Error loading cost data: ${error.message}`]
      });
      
      return false;
    }
  };

  const validateCurrencyRates = async () => {
    setCurrentStep(5);
    updateStepStatus(5, 'running');
    await new Promise(resolve => setTimeout(resolve, 800));
    
    try {
      // Get currency data
      const currencyData = await api.master.getCurrency();
      
      if (!currencyData || currencyData.length === 0) {
        updateStepStatus(5, 'failed', {
          summary: 'Currency data not found',
          errors: ['No currency exchange rates available'],
          helpMessage: 'Please configure currency rates in the Currency page.'
        });
        
        return false;
      }
      
      const errors = [];
      const currentYear = '2025';
      
      // Get all currencies for current year
      const currentYearCurrencies = currencyData.filter(c => c.Periode === currentYear);
      
      if (currentYearCurrencies.length === 0) {
        errors.push(`No currency rates found for current year (${currentYear})`);
      } else {
        // Check if IDR exists for current year (required base currency)
        const idrCurrency = currentYearCurrencies.find(c => c.Curr_Code === 'IDR');
        if (!idrCurrency) {
          errors.push(`IDR base currency not found for year ${currentYear}`);
        }
        
        // Validate all other currencies for current year
        currentYearCurrencies.forEach(currency => {
          const { Curr_Code, Curr_Description, Kurs } = currency;
          
          if (!Curr_Code || Curr_Code.trim() === '') {
            errors.push(`Currency code is missing or empty (ID: ${currency.pk_id || 'unknown'})`);
          }
          
          if (!Curr_Description || Curr_Description.trim() === '') {
            errors.push(`Currency description is missing for ${Curr_Code || 'unknown currency'}`);
          }
          
          if (Kurs === null || Kurs === undefined || typeof Kurs !== 'number') {
            errors.push(`Exchange rate (Kurs) is not properly set for ${Curr_Code || 'unknown currency'} (current value: ${Kurs})`);
          }
        });
      }
      
      if (errors.length > 0) {
        updateStepStatus(5, 'failed', {
          summary: `${errors.length} currency configuration issue(s) found`,
          errors,
          helpMessage: 'Please configure all currency rates properly in the Currency page.'
        });
        
        return false;
      }
      
      updateStepStatus(5, 'completed', {
        summary: `All currency rates properly configured for ${currentYear}`,
        details: `Validated ${currentYearCurrencies.length} currencies including base IDR currency`
      });
      
      return true;
    } catch (error) {
      console.error('Error validating currency rates:', error);
      updateStepStatus(5, 'failed', {
        summary: 'Failed to validate currency rates',
        errors: [`Error loading currency data: ${error.message}`]
      });
      
      return false;
    }
  };

  const updateStepStatus = (stepId, status, details = null) => {
    setValidationSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, details, errors: details?.errors || [] }
        : step
    ));
  };

  const getProductName = (productId) => {
    const product = validationData.productList.find(p => p.Product_ID === productId);
    return product ? product.Product_Name : 'Unknown Product';
  };

  const getStepIcon = (step) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="step-icon completed" size={20} />;
      case 'warning':
        return <AlertTriangle className="step-icon warning" size={20} />;
      case 'running':
        return <Loader className="step-icon running" size={20} />;
      case 'failed':
        return <AlertTriangle className="step-icon failed" size={20} />;
      default:
        return <div className="step-icon pending" />;
    }
  };

  const canStart = validationData.chosenFormulas.length > 0 || validationData.availableFormulas.length > 0;
  const allCompleted = validationSteps.every(step => step.status === 'completed');

  if (!isOpen) return null;

  return (
    <div className="validation-modal-overlay">
      <div className="validation-modal">
        <div className="validation-modal-header">
          <h2>HPP Generation Validation</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="validation-modal-content">
          <div className="validation-info">
            <Info size={16} />
            <p>Validating system data integrity before HPP calculation. Please wait...</p>
          </div>

          <div className="validation-steps">
            {validationSteps.map((step) => (
              <div 
                key={step.id} 
                className={`validation-step ${step.status} ${currentStep === step.id ? 'current' : ''}`}
              >
                <div className="step-header">
                  <div className="step-indicator">
                    {getStepIcon(step)}
                    <span className="step-number">{step.id}</span>
                  </div>
                  <div className="step-info">
                    <h4 className="step-title">
                      {step.title}
                      {step.status === 'running' && <span className="dots">...</span>}
                    </h4>
                    <p className="step-description">{step.description}</p>
                  </div>
                </div>

                {step.details && (
                  <div className="step-details">
                    <div className={`step-result ${step.status}`}>
                      <strong>{step.details.summary}</strong>
                      {step.details.details && <p>{step.details.details}</p>}
                    </div>
                    
                    {step.errors && step.errors.length > 0 && (
                      <div className="step-errors">
                        <h5>Issues Found:</h5>
                        <ul>
                          {step.errors.map((error, idx) => (
                            <li key={idx}>{error}</li>
                          ))}
                        </ul>
                        <div className="error-help">
                          <p><strong>To fix these issues:</strong></p>
                          <ul>
                            <li>Go to <strong>Formula Assignment</strong> page to assign missing formulas</li>
                            <li>Use <strong>Product Formula</strong> page to create missing formulas or fix batch sizes</li>
                            <li>Ensure all required formula types (PI, PS, KP, KS) are properly configured</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="validation-modal-footer">
          {!isRunning && !hasError && !allCompleted && !hasWarning && (
            <button 
              className="btn btn-primary"
              onClick={startValidation}
              disabled={!canStart}
            >
              Start Validation
            </button>
          )}
          
          {hasError && (
            <div className="validation-actions">
              <button className="btn btn-secondary" onClick={onClose}>
                Close & Fix Issues
              </button>
              <button className="btn btn-primary" onClick={resetValidation}>
                Retry Validation
              </button>
            </div>
          )}

          {hasWarning && allCompleted && (
            <div className="validation-warning-actions">
              <div className="warning-message">
                <AlertTriangle className="warning-icon" size={20} />
                <p>Validation completed with warnings. You can proceed but consider fixing the issues for better accuracy.</p>
              </div>
              <div className="validation-actions">
                <button className="btn btn-secondary" onClick={onClose}>
                  Close & Fix Warnings
                </button>
                <button className="btn btn-warning" onClick={() => { onValidationComplete('warning'); onClose(); }}>
                  Proceed Anyway
                </button>
              </div>
            </div>
          )}

          {allCompleted && !hasError && !hasWarning && (
            <div className="validation-success">
              <CheckCircle className="success-icon" size={24} />
              <p>All validations passed! HPP calculation can proceed safely.</p>
            </div>
          )}

          {!hasError && !allCompleted && !hasWarning && (
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ValidationModal;
