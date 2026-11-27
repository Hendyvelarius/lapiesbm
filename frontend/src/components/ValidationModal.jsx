import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, X, AlertTriangle, Loader, Info } from 'lucide-react';
import api from '../services/api';
import '../styles/ValidationModal.css';

const EMPTY_DATA = { chosenFormulas: [], availableFormulas: [], productList: [] };

const ValidationModal = ({ isOpen, onClose, onValidationComplete, selectedYear }) => {
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
      description: 'Checking Pembebanan rates and General Costs per Sediaan for the selected year',
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
    },
    {
      id: 6,
      title: 'Checking Manhour & Yield (rendemen)',
      description: 'Verifying products have a Manhour & Yield row with a rendemen for the selected year',
      status: 'pending',
      details: null,
      errors: []
    }
  ]);
  
  const [isRunning, setIsRunning] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [hasWarning, setHasWarning] = useState(false);
  const [validationData, setValidationData] = useState(EMPTY_DATA);
  // Year whose data is in validationData. The modal stays mounted between opens, so without this
  // a run started while a new year was still loading validated the previous year's data
  // (opened for 2027 after 2026, it reported 2026's lock counts under a "2027" badge).
  const [loadedYear, setLoadedYear] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const loadSeq = useRef(0);
  const year = selectedYear?.toString();

  // Reload whenever the modal opens or the year changes
  useEffect(() => {
    if (isOpen) {
      resetValidation();
    }
  }, [isOpen, year]);

  const resetValidation = async () => {
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
    
    // Refetch data (also on retry, to pick up fixes made in the meantime)
    await loadInitialData();
  };

  const loadInitialData = async () => {
    const seq = ++loadSeq.current;
    const loadingYear = year;
    setValidationData(EMPTY_DATA);
    setLoadedYear(null);
    setLoadError(null);
    try {
      const [chosenRes, formulaRes, productRes] = await Promise.all([
        api.products.getChosenFormula(loadingYear),
        api.products.getFormula(),
        api.master.getProductName()
      ]);
      // A newer load (reopen, year change, retry) has started; drop this result
      if (seq !== loadSeq.current) return;

      // Keep only the selected year's assignments
      const chosenForYear = (chosenRes || []).filter(cf => String(cf.Periode) === loadingYear);
      if (chosenForYear.length !== (chosenRes || []).length) {
        console.error('[ValidationModal] Dropped formula assignments of another Periode than', loadingYear);
      }

      setValidationData({
        chosenFormulas: chosenForYear,
        availableFormulas: formulaRes || [],
        productList: productRes?.data || []
      });
      setLoadedYear(loadingYear);
    } catch (error) {
      if (seq !== loadSeq.current) return;
      console.error('Error loading validation data:', error);
      setLoadError(error.message || 'Unknown error');
      setHasError(true);
    }
  };

  const startValidation = async () => {
    // Only validate data that was loaded for the year shown in the header
    if (loadedYear !== year) return;
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

    // Continue with all validation steps even if previous ones failed
    // This allows us to collect all issues at once
    
    // Step 3: Material Price Validation
    const materialValidationSuccess = await validateMaterialPrices();
    if (!materialValidationSuccess) {
      validationFailed = true;
    }

    // Step 4: Cost Parameters Validation
    const costValidationSuccess = await validateCostParameters();
    if (!costValidationSuccess) {
      validationFailed = true;
    }

    // Step 5: Currency Validation
    const currencyValidationSuccess = await validateCurrencyRates();
    if (!currencyValidationSuccess) {
      validationFailed = true;
    }

    // Step 6: Manhour & Yield (rendemen)
    const yieldResult = await validateYield();
    if (yieldResult === 'failed') {
      validationFailed = true;
    } else if (yieldResult === 'warning') {
      hasWarnings = true;
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

    // A year with no assignments must not "pass" with 0 products checked
    if (chosenFormulas.length === 0) {
      updateStepStatus(1, 'failed', {
        summary: `No formula assignments found for ${year}`,
        errors: [`Formula Assignment has no products for ${year}. Assign formulas for ${year} first.`]
      });
      setHasError(true);
      return 'failed';
    }
    
    // Filter out locked products - they should not be validated
    const unlockedFormulas = chosenFormulas.filter(cf => !cf.isLock || cf.isLock === 0);
    const lockedCount = chosenFormulas.length - unlockedFormulas.length;
    
    // Check for duplicate Product_IDs
    const productIdCounts = {};
    chosenFormulas.forEach(cf => {
      productIdCounts[cf.Product_ID] = (productIdCounts[cf.Product_ID] || 0) + 1;
    });
    const duplicateProducts = Object.entries(productIdCounts).filter(([_, count]) => count > 1);
    if (duplicateProducts.length > 0) {
      console.warn('[Validation Step 1] WARNING: Duplicate Product_IDs found in chosen formulas:', duplicateProducts);
    }
    
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

    // Create a map of chosen formulas by product (unlocked only)
    const chosenFormulaMap = {};
    unlockedFormulas.forEach(chosen => {
      chosenFormulaMap[chosen.Product_ID] = chosen;
    });

    // Only validate unlocked products that are part of HPP calculation
    const hppProductIds = unlockedFormulas.map(cf => cf.Product_ID);

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
      const summaryMessage = lockedCount > 0 
        ? `${year}: ${productsWithIssues.length} of ${checkedProducts} unlocked products have issues (${lockedCount} locked products skipped)`
        : `${year}: ${productsWithIssues.length} of ${checkedProducts} products have formula assignment issues`;
      
      updateStepStatus(1, 'failed', {
        summary: summaryMessage,
        errors
      });
      setHasError(true);
      return 'failed'; // Return failure
    }

    const detailsMessage = lockedCount > 0
      ? `Checked ${checkedProducts} unlocked products (${lockedCount} locked products skipped), all formula assignments are valid`
      : `Checked ${checkedProducts} products, all formula assignments are valid`;
    
    const summaryMessage = lockedCount > 0
      ? `${year}: all ${checkedProducts} unlocked products have correct formula assignments (${lockedCount} locked)`
      : `${year}: all ${checkedProducts} products have correct formula assignments and batch sizes`;

    updateStepStatus(1, 'completed', {
      summary: summaryMessage,
      details: detailsMessage
    });

    // Step 2: Validate formula data integrity
    await new Promise(resolve => setTimeout(resolve, 500));
    setCurrentStep(2);
    updateStepStatus(2, 'running');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const criticalErrors = [];
    const warnings = [];
    
    // Only check unlocked formulas for data integrity
    unlockedFormulas.forEach(chosen => {
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

    const step2Summary = lockedCount > 0
      ? `All assigned formulas have valid batch sizes (${lockedCount} locked products skipped)`
      : `All assigned formulas have valid batch sizes`;
    
    const step2Details = lockedCount > 0
      ? `Validated batch sizes for ${unlockedFormulas.length} unlocked formula assignments`
      : `Validated batch sizes for all formula assignments`;

    updateStepStatus(2, 'completed', {
      summary: step2Summary,
      details: step2Details
    });
    
    return 'success';
  };

  // Material price validation - check if all formula materials have proper pricing
  const validateMaterialPrices = async () => {
    setCurrentStep(3);
    updateStepStatus(3, 'running');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      // Materials of the formulas assigned for this year, priced at this year's material prices
      // (without a year the view uses its own: the latest one with unlocked assignments)
      const [activeFormulaDetails, intermediatesRes] = await Promise.all([
        api.products.getActiveFormulaDetails(year),
        api.products.getIntermediates(year)
      ]);
      // Intermediates (granulat/pelarut/WFI, e.g. FW, HO) are made in-house: generation prices them
      // at their own HPP, so they need a Formula Assignment for the year, not a purchase price.
      const intermediates = new Map((intermediatesRes?.data || []).map(i => [i.itemId, i]));
      const computedIntermediates = [];
      
      // Only check materials for unlocked products
      const { chosenFormulas } = validationData;
      const unlockedProductIds = new Set(
        chosenFormulas
          .filter(cf => !cf.isLock || cf.isLock === 0)
          .map(cf => cf.Product_ID)
      );
      const lockedCount = chosenFormulas.length - unlockedProductIds.size;
      
      const relevantFormulaDetails = activeFormulaDetails.filter(
        formula => unlockedProductIds.has(formula.Product_ID)
      );
      
      const missingPriceMaterials = [];
      const checkedMaterials = new Set(); // To avoid duplicate checks
      
      // Check each material in unlocked product formulas
      relevantFormulaDetails.forEach(formula => {
        const materialKey = `${formula.PPI_ItemID}`;
        
        // Skip if already checked this material
        if (checkedMaterials.has(materialKey)) {
          return;
        }
        checkedMaterials.add(materialKey);

        const intermediate = intermediates.get(formula.PPI_ItemID);
        if (intermediate && !intermediate.locked) {
          if (intermediate.assigned) {
            computedIntermediates.push(formula.PPI_ItemID);
          } else {
            missingPriceMaterials.push({
              itemId: formula.PPI_ItemID,
              productName: formula.Product_Name,
              productId: formula.Product_ID,
              formulaType: formula.TypeCode,
              issue: `Intermediate (${intermediate.productName}) has no ${year} Formula Assignment, so its HPP cannot be calculated. Assign a formula for ${intermediate.productId} in ${year}.`
            });
          }
          return;
        }
        if (intermediate && intermediate.locked && !intermediate.hasPrice) {
          missingPriceMaterials.push({
            itemId: formula.PPI_ItemID,
            productName: formula.Product_Name,
            productId: formula.Product_ID,
            formulaType: formula.TypeCode,
            issue: `Intermediate (${intermediate.productName}) is locked for ${year} and has no ${year} price. Unlock ${intermediate.productId} so it is recalculated.`
          });
          return;
        }
        
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
            issue: `Material has no ${year} price in Harga Bahan`
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
        summary: lockedCount > 0
          ? `All ${checkedMaterials.size} formula materials have valid ${year} pricing (${lockedCount} locked skipped)`
          : `All ${checkedMaterials.size} formula materials have valid ${year} pricing`,
        details: (lockedCount > 0
          ? `Checked materials from ${relevantFormulaDetails.length} active formula entries (${lockedCount} locked products skipped)`
          : `Checked materials from ${relevantFormulaDetails.length} active formula entries`)
          + (computedIntermediates.length > 0
            ? `. Intermediates priced at their own ${year} HPP during generation: ${computedIntermediates.join(', ')}`
            : '')
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
      // sp_COGS_GenerateHPP reads Pembebanan and General Costs per Sediaan for the year.
      // (M_COGS_STD_PARAMETER is no longer read by the generator, and only has 2025 data,
      // so checking it said nothing about the year being generated.)
      const [pembebananAll, readinessRes] = await Promise.all([
        api.master.getPembebanan(),
        api.products.getYearReadiness(year)
      ]);
      const pembebanannData = (pembebananAll || []).filter(p => String(p.Group_Periode) === year);

      const errors = [];
      let defaultCosts = [];
      let customCosts = [];

      const generalCostRows = readinessRes?.data?.counts?.generalCosts ?? 0;
      if (generalCostRows === 0) {
        errors.push(`General Costs per Sediaan not set for ${year} - labor, overhead and depreciation would be zero`);
      }

      // Validate Pembebanan data
      if (pembebanannData.length === 0) {
        errors.push(`Pembebanan data not found for ${year} - required for machine cost calculations`);
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
          helpMessage: 'Please configure cost parameters in Biaya Lain and Pembebanan pages.'
        });
        
        return false;
      }
      
      updateStepStatus(4, 'completed', {
        summary: `All ${year} cost parameters are properly configured`,
        details: `Validated ${defaultCosts.length} default cost categories, ${customCosts.length} custom product costs and ${generalCostRows} General Costs per Sediaan rows`
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
      const currentYear = year;
      
      // Get all currencies for current year
      const currentYearCurrencies = currencyData.filter(c => c.Periode === currentYear);
      
      if (currentYearCurrencies.length === 0) {
        errors.push(`No currency rates found for ${currentYear}`);
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

  // sp_COGS_GenerateHPP divides each intermediate's (granulat/pelarut/WFI) cost by
  // Batch_Size * rendemen / 100 with no zero guard: one intermediate with rendemen 0 or blank makes
  // the whole generate fail ("Divide by zero"). Other products don't crash it but get HPP 0, and
  // products with no Manhour & Yield row for the year are skipped (no HPP at all).
  const validateYield = async () => {
    setCurrentStep(6);
    updateStepStatus(6, 'running');
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const res = await api.products.getYieldCheck(year);
      const allRows = res?.data || [];
      // inAssignment === false: in Manhour & Yield but missing from Formula Assignment (older backends omit the flag)
      const rows = allRows.filter(r => r.inAssignment !== false);
      const unassigned = allRows.filter(r => r.inAssignment === false);
      const label = r => `${r.productId} (${r.productName})`;
      const noRendemen = r => r.inYield && !(r.rendemen > 0);

      const errors = [
        ...rows
          .filter(r => r.isIntermediate && r.inYield && (noRendemen(r) || !(r.batchSize > 0)))
          .map(r => `${label(r)}: intermediate with ${!(r.rendemen > 0) ? `rendemen ${r.rendemen ?? 'blank'}` : `batch size ${r.batchSize ?? 'blank'}`} for ${year}. Its HPP is used as a material price, so generation fails. Set it in Manhour & Yield.`),
        // Not in the SP's header set, so its HPP is never computed and products using it keep a 0/stale price
        ...rows
          .filter(r => r.isIntermediate && !r.inYield)
          .map(r => `${label(r)}: intermediate not in ${year} Manhour & Yield, so its HPP is not calculated and products using it are costed with a 0 or old price. Add it to Manhour & Yield.`)
      ];

      const warnings = [
        ...rows
          .filter(r => !r.isIntermediate && noRendemen(r))
          .map(r => `${label(r)}: rendemen ${r.rendemen ?? 'blank'} for ${year}, so its HPP will be 0`),
        ...rows
          .filter(r => !r.isIntermediate && !r.inYield)
          .map(r => `${label(r)}: not in ${year} Manhour & Yield, so it is skipped (no HPP generated)`),
        // e.g. import products (no recipe): they need a blank Formula Assignment row with batch size 1
        ...unassigned
          .map(r => `${label(r)}: in ${year} Manhour & Yield but not in ${year} Formula Assignment, so it is skipped (no HPP generated). Products without a recipe (imports) need a blank assignment with batch size 1.`)
      ];

      if (errors.length > 0) {
        updateStepStatus(6, 'failed', {
          summary: `${errors.length} intermediate(s) have no usable ${year} Manhour & Yield`
            + (warnings.length > 0 ? ` (plus ${warnings.length} warning(s))` : ''),
          errors: [...errors, ...warnings],
          helpMessage: `Fill in rendemen for these products in the ${year} Manhour & Yield page, then retry.`
        });
        setHasError(true);
        return 'failed';
      }

      if (warnings.length > 0) {
        updateStepStatus(6, 'warning', {
          summary: `${warnings.length} product(s) will have HPP 0 or no HPP for ${year}`,
          errors: warnings,
          helpMessage: `If these products should have an HPP, fill in their rendemen in the ${year} Manhour & Yield page. Otherwise you can proceed.`
        });
        return 'warning';
      }

      updateStepStatus(6, 'completed', {
        summary: `All ${rows.length} products have a ${year} rendemen`,
        details: `Checked Manhour & Yield for ${rows.length} unlocked products`
      });
      return 'success';
    } catch (error) {
      console.error('Error validating Manhour & Yield:', error);
      updateStepStatus(6, 'failed', {
        summary: 'Failed to validate Manhour & Yield',
        errors: [`Error loading Manhour & Yield data: ${error.message}`]
      });
      setHasError(true);
      return 'failed';
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

  // Start only once this year's data is loaded (see loadedYear)
  const isLoadingData = isOpen && loadedYear !== year && !loadError;
  const canStart = loadedYear === year && !isRunning;
  // A step that ended with warnings is finished too (otherwise "Proceed Anyway" never shows)
  const allCompleted = validationSteps.every(step => step.status === 'completed' || step.status === 'warning');

  if (!isOpen) return null;

  return (
    <div className="validation-modal-overlay">
      <div className="validation-modal">
        <div className="validation-modal-header">
          <div>
            <h2>HPP Generation Validation</h2>
            <div className="validation-year-badge">Year: {selectedYear}</div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="validation-modal-content">
          <div className="validation-info">
            <Info size={16} />
            <p>
              {loadError
                ? `Could not load validation data for ${selectedYear}: ${loadError}`
                : isLoadingData
                  ? `Loading data for year ${selectedYear}...`
                  : `Validating system data integrity for year ${selectedYear} before HPP calculation.`}
            </p>
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
                          {step.details.helpMessage ? (
                            <p>{step.details.helpMessage}</p>
                          ) : (
                            <ul>
                              <li>Go to <strong>Formula Assignment</strong> page to assign missing formulas</li>
                              <li>Use <strong>Product Formula</strong> page to create missing formulas or fix batch sizes</li>
                              <li>Ensure all required formula types (PI, PS, KP, KS) are properly configured</li>
                            </ul>
                          )}
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
              {isLoadingData ? 'Loading...' : 'Start Validation'}
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
