const { connect } = require("../../config/sqlserver");
const sql = require("mssql");

/**
 * Get the latest (highest) periode from HPP data
 */
async function getLatestPeriode() {
  try {
    const db = await connect();
    const result = await db.request().query(`
      SELECT TOP 1 Periode 
      FROM M_COGS_PRODUCT_FORMULA_FIX 
      ORDER BY Periode DESC
    `);
    return result.recordset[0]?.Periode || new Date().getFullYear().toString();
  } catch (error) {
    console.error("Error getting latest periode:", error);
    throw error;
  }
}

/**
 * Get HPP data for dashboard statistics
 * Returns all products from the latest year with HPP, HNA, and category information
 * 
 * IMPORTANT: Generik Type 1 and Generik Type 2 contain the SAME products.
 * They are just different calculation types. We only use Generik Type 1 data
 * and completely ignore Generik Type 2 to avoid duplicates.
 * 
 * Category (Toll In, Toll Out, Import, Lapi) comes directly from the HPP list procedure.
 */
async function getDashboardHPPData(year = null) {
  try {
    const db = await connect();
    const periode = year || await getLatestPeriode();
    
    const request = db.request().input('year', sql.VarChar(4), periode);
    const result = await request.query(`exec sp_COGS_HPP_List @year`);

    // The stored procedure returns three recordsets: ethical, generik1, generik2
    // IMPORTANT: generik1 and generik2 have the SAME products - only use generik1
    const ethical = result.recordsets[0] || [];
    const generik1 = result.recordsets[1] || [];
    // generik2 is intentionally ignored - same products as generik1, different calculation type

    // Combine ethical and generik1 products (NOT generik2)
    // HPP Logic: Use HPP2 if it has a value > 0, otherwise use HPP
    const allProducts = [
      ...ethical.map(p => {
        const hpp2 = parseFloat(p.HPP2) || 0;
        const hpp = hpp2 > 0 ? hpp2 : (parseFloat(p.HPP) || 0);
        return { ...p, HPP: hpp, productType: 'ETHICAL' };
      }),
      ...generik1.map(p => {
        const hpp2 = parseFloat(p.HPP2) || 0;
        const hpp = hpp2 > 0 ? hpp2 : (parseFloat(p.HPP) || 0);
        return { ...p, HPP: hpp, productType: 'GENERIK' };
      })
    ];

    // Categorize products and get toll category from Category column in HPP list
    const allCategorizedProducts = allProducts.map(p => {
      // Determine LOB category based on LOB field
      let actualCategory = p.productType;
      if (p.LOB) {
        const lob = p.LOB.toUpperCase();
        if (lob === 'OTC') actualCategory = 'OTC';
        else if (lob === 'ETHICAL') actualCategory = 'ETHICAL';
        else if (lob.includes('GENERIC') || lob.includes('GENERIK')) actualCategory = 'GENERIK';
      }
      
      // Get toll category directly from Category column in HPP list
      // Values: 'Toll In', 'Toll Out', 'Import', 'Lapi'
      const tollCategory = p.Category || null;
      
      return { ...p, actualCategory, tollCategory };
    });

    // IMPORTANT: Exclude all Toll In products from dashboard
    // Toll In products are completely removed from all calculations and displays
    const categorizedProducts = allCategorizedProducts.filter(p => p.tollCategory !== 'Toll In');

    // Count products by toll category (excluding Toll In)
    // Note: 'Lapi' from database is displayed as 'Inhouse' in frontend
    const tollCounts = {
      tollOut: categorizedProducts.filter(p => p.tollCategory === 'Toll Out').length,
      import: categorizedProducts.filter(p => p.tollCategory === 'Import').length,
      inhouse: categorizedProducts.filter(p => p.tollCategory === 'Lapi').length
    };

    // Debug: Log unique Category values to verify format
    const uniqueCategories = [...new Set(allProducts.map(p => p.Category))];

    return {
      periode,
      products: categorizedProducts,
      tollCounts,
      rawData: { ethical, generik1 }
    };
  } catch (error) {
    console.error("Error getting dashboard HPP data:", error);
    throw error;
  }
}

/**
 * Get comprehensive dashboard statistics
 */
async function getDashboardStats(year = null) {
  try {
    const { periode, products, tollCounts, rawData } = await getDashboardHPPData(year);

    // Count products by LOB category
    const ethicalCount = products.filter(p => p.actualCategory === 'ETHICAL').length;
    const otcCount = products.filter(p => p.actualCategory === 'OTC').length;
    const generikCount = products.filter(p => p.actualCategory === 'GENERIK').length;
    const totalProducts = products.length;

    // Toll counts (Toll In excluded from dashboard)
    const { tollOut: tollOutCount, import: importCount, inhouse: inhouseCount } = tollCounts;

    // Calculate Cost Management (COGS) statistics
    // COGS = (Total HPP / HNA) * 100
    // IMPORTANT: Exclude products with 0% COGS (HPP = 0 or HNA = 0) from calculations
    // Using parseFloat and explicit > 0 check to handle string values from database
    const validProducts = products.filter(p => {
      const hpp = parseFloat(p.HPP) || 0;
      const hna = parseFloat(p.Product_SalesHNA) || 0;
      // Only include products where both HPP > 0 AND HNA > 0
      // This ensures 0% COGS products don't affect the average calculations
      return hpp > 0 && hna > 0;
    });

    const totalHPP = validProducts.reduce((sum, p) => sum + (parseFloat(p.HPP) || 0), 0);
    const totalHNA = validProducts.reduce((sum, p) => sum + (parseFloat(p.Product_SalesHNA) || 0), 0);
    
    // Calculate COGS Ratio using Simple Average (consistent with category averages)
    // This treats each product equally, rather than weighting by HNA value
    const overallCOGS = validProducts.length > 0 
      ? validProducts.reduce((sum, p) => {
          return sum + ((parseFloat(p.HPP) / parseFloat(p.Product_SalesHNA)) * 100);
        }, 0) / validProducts.length
      : 0;

    // Products with COGS >= 30% vs < 30%
    const productsHighCOGS = validProducts.filter(p => {
      const cogs = (parseFloat(p.HPP) / parseFloat(p.Product_SalesHNA)) * 100;
      return cogs >= 30;
    }).length;
    const productsLowCOGS = validProducts.length - productsHighCOGS;

    // Pricing Risk Indicator - Average COGS by category
    const calculateAvgCOGS = (category, isTollCategory = false) => {
      const categoryProducts = isTollCategory
        ? validProducts.filter(p => p.tollCategory === category)
        : validProducts.filter(p => p.actualCategory === category);
      if (categoryProducts.length === 0) return 0;
      const totalCOGS = categoryProducts.reduce((sum, p) => {
        return sum + ((parseFloat(p.HPP) / parseFloat(p.Product_SalesHNA)) * 100);
      }, 0);
      return totalCOGS / categoryProducts.length;
    };

    // LOB category averages
    const avgCOGSEthical = calculateAvgCOGS('ETHICAL');
    const avgCOGSOTC = calculateAvgCOGS('OTC');
    const avgCOGSGenerik = calculateAvgCOGS('GENERIK');

    // Toll category averages (Toll In excluded)
    // Note: 'Lapi' from database is displayed as 'Inhouse' in frontend
    const avgCOGSTollOut = calculateAvgCOGS('Toll Out', true);
    const avgCOGSImport = calculateAvgCOGS('Import', true);
    const avgCOGSInhouse = calculateAvgCOGS('Lapi', true);

    // Average HPP distribution (BB, BK, Others)
    // Others = (MH_Proses_Std * Biaya_Proses) + (MH_Kemas_Std * Biaya_Kemas) + Expiry Cost + Margin
    const calculateCostDistribution = (productList) => {
      const validList = productList.filter(p => p.HPP && parseFloat(p.HPP) > 0);
      if (validList.length === 0) return { bb: 0, bk: 0, others: 0 };

      let totalBB = 0, totalBK = 0, totalOthers = 0, totalHPP = 0;
      
      validList.forEach(p => {
        const bb = parseFloat(p.totalBB) || 0;
        const bk = parseFloat(p.totalBK) || 0;
        const hpp = parseFloat(p.HPP) || 0;
        
        // Calculate Others: processing costs + expiry + margin
        const biayaProses = (parseFloat(p.MH_Proses_Std) || 0) * (parseFloat(p.Biaya_Proses) || 0);
        const biayaKemas = (parseFloat(p.MH_Kemas_Std) || 0) * (parseFloat(p.Biaya_Kemas) || 0);
        const expiryCost = parseFloat(p.Beban_Sisa_Bahan_Exp) || 0;
        
        // Margin calculation - if margin exists as percentage, calculate based on subtotal
        // IMPORTANT: toll_fee is per unit, must multiply by Batch_Size to match batch-level costs (BB, BK, etc.)
        let marginCost = 0;
        const batchSize = parseFloat(p.Batch_Size) || 1;
        if (p.margin && parseFloat(p.margin) > 0) {
          const marginPercent = parseFloat(p.margin);
          const subtotal = bb + bk + biayaProses + biayaKemas + expiryCost;
          marginCost = subtotal * marginPercent;
        } else if (p.toll_fee && parseFloat(p.toll_fee) > 0) {
          marginCost = (parseFloat(p.toll_fee) || 0) * batchSize;
        }
        
        // For Generik products, include additional costs
        const biayaReagen = parseFloat(p.Biaya_Reagen) || 0;
        const biayaAnalisa = parseFloat(p.Biaya_Analisa) || 0;
        const ratePLN = parseFloat(p.Rate_PLN) || 0;
        const directLabor = parseFloat(p.Direct_Labor) || 0;
        const factoryOverhead = parseFloat(p.Factory_Over_Head_50) || parseFloat(p.Factory_Over_Head) || 0;
        const depresiasi = parseFloat(p.Depresiasi) || 0;
        
        const others = biayaProses + biayaKemas + expiryCost + marginCost + 
                      biayaReagen + biayaAnalisa + ratePLN + directLabor + factoryOverhead + depresiasi;
        
        totalBB += bb;
        totalBK += bk;
        totalOthers += others;
        totalHPP += hpp;
      });

      // Calculate percentages based on total HPP
      const bbPercent = totalHPP > 0 ? (totalBB / totalHPP) * 100 : 0;
      const bkPercent = totalHPP > 0 ? (totalBK / totalHPP) * 100 : 0;
      const othersPercent = totalHPP > 0 ? (totalOthers / totalHPP) * 100 : 0;
      
      // Normalize to 100% if needed
      const total = bbPercent + bkPercent + othersPercent;
      if (total > 0 && total !== 100) {
        const factor = 100 / total;
        return {
          bb: Math.max(0, bbPercent * factor),
          bk: Math.max(0, bkPercent * factor),
          others: Math.max(0, othersPercent * factor)
        };
      }

      return {
        bb: Math.max(0, bbPercent),
        bk: Math.max(0, bkPercent),
        others: Math.max(0, othersPercent)
      };
    };

    // Calculate category-specific statistics
    // Total count includes ALL products (even HNA=0), but COGS breakdown only for valid products
    const calculateCategoryStats = (category, isTollCategory = false) => {
      // Get ALL products for this category (for total count)
      let allCategoryProducts;
      if (category === 'ALL') {
        allCategoryProducts = products;
      } else if (isTollCategory) {
        allCategoryProducts = products.filter(p => p.tollCategory === category);
      } else {
        allCategoryProducts = products.filter(p => p.actualCategory === category);
      }
      
      // Get only valid products (HNA > 0) for COGS breakdown
      let validCategoryProducts;
      if (category === 'ALL') {
        validCategoryProducts = validProducts;
      } else if (isTollCategory) {
        validCategoryProducts = validProducts.filter(p => p.tollCategory === category);
      } else {
        validCategoryProducts = validProducts.filter(p => p.actualCategory === category);
      }
      
      const count = allCategoryProducts.length; // Total includes all products
      const highCOGS = validCategoryProducts.filter(p => {
        const cogs = (parseFloat(p.HPP) / parseFloat(p.Product_SalesHNA)) * 100;
        return cogs >= 30;
      }).length;
      const lowCOGS = validCategoryProducts.length - highCOGS; // Only valid products can have COGS
      
      return { count, highCOGS, lowCOGS };
    };

    // Cost distribution by LOB category
    const costDistributionAll = calculateCostDistribution(products);
    const costDistributionEthical = calculateCostDistribution(products.filter(p => p.actualCategory === 'ETHICAL'));
    const costDistributionOTC = calculateCostDistribution(products.filter(p => p.actualCategory === 'OTC'));
    const costDistributionGenerik = calculateCostDistribution(products.filter(p => p.actualCategory === 'GENERIK'));
    
    // Cost distribution by Toll category (Toll In excluded)
    // Note: 'Lapi' from database is displayed as 'Inhouse' in frontend
    const costDistributionTollOut = calculateCostDistribution(products.filter(p => p.tollCategory === 'Toll Out'));
    const costDistributionImport = calculateCostDistribution(products.filter(p => p.tollCategory === 'Import'));
    const costDistributionInhouse = calculateCostDistribution(products.filter(p => p.tollCategory === 'Lapi'));

    // HPP info cards by LOB category
    const hppStatsAll = calculateCategoryStats('ALL');
    const hppStatsEthical = calculateCategoryStats('ETHICAL');
    const hppStatsOTC = calculateCategoryStats('OTC');
    const hppStatsGenerik = calculateCategoryStats('GENERIK');
    
    // HPP info cards by Toll category (Toll In excluded)
    // Note: 'Lapi' from database is displayed as 'Inhouse' in frontend
    const hppStatsTollOut = calculateCategoryStats('Toll Out', true);
    const hppStatsImport = calculateCategoryStats('Import', true);
    const hppStatsInhouse = calculateCategoryStats('Lapi', true);

    // Heat Map: LOB x Category matrix
    // Shows total products and high COGS count for each combination
    const calculateHeatMapCell = (lob, tollCategory) => {
      // Get all products matching this LOB and toll category
      const cellProducts = products.filter(p => 
        p.actualCategory === lob && p.tollCategory === tollCategory
      );
      const total = cellProducts.length;
      
      // Get products with valid HNA for COGS calculation
      const validCellProducts = cellProducts.filter(p => 
        p.Product_SalesHNA && parseFloat(p.Product_SalesHNA) > 0
      );
      const highCOGS = validCellProducts.filter(p => {
        const cogs = (parseFloat(p.HPP) / parseFloat(p.Product_SalesHNA)) * 100;
        return cogs >= 30;
      }).length;
      
      return { total, highCOGS };
    };

    // Heat map data (Toll In excluded)
    // Note: 'Lapi' from database is displayed as 'Inhouse' in frontend
    const heatMap = {
      inhouse: {
        ethical: calculateHeatMapCell('ETHICAL', 'Lapi'),
        otc: calculateHeatMapCell('OTC', 'Lapi'),
        generik: calculateHeatMapCell('GENERIK', 'Lapi')
      },
      import: {
        ethical: calculateHeatMapCell('ETHICAL', 'Import'),
        otc: calculateHeatMapCell('OTC', 'Import'),
        generik: calculateHeatMapCell('GENERIK', 'Import')
      },
      tollOut: {
        ethical: calculateHeatMapCell('ETHICAL', 'Toll Out'),
        otc: calculateHeatMapCell('OTC', 'Toll Out'),
        generik: calculateHeatMapCell('GENERIK', 'Toll Out')
      }
    };

    return {
      periode,
      productCounts: {
        total: totalProducts,
        ethical: ethicalCount,
        otc: otcCount,
        generik: generikCount,
        // Toll category counts (Toll In excluded)
        tollOut: tollOutCount,
        import: importCount,
        inhouse: inhouseCount
      },
      costManagement: {
        totalHPP,
        totalHNA,
        overallCOGS: overallCOGS.toFixed(2),
        productsWithData: validProducts.length
      },
      pricingRiskIndicator: {
        // LOB categories
        ethical: avgCOGSEthical.toFixed(2),
        otc: avgCOGSOTC.toFixed(2),
        generik: avgCOGSGenerik.toFixed(2),
        // Toll categories (Toll In excluded)
        tollOut: avgCOGSTollOut.toFixed(2),
        import: avgCOGSImport.toFixed(2),
        inhouse: avgCOGSInhouse.toFixed(2)
      },
      costDistribution: {
        // LOB categories
        all: costDistributionAll,
        ethical: costDistributionEthical,
        otc: costDistributionOTC,
        generik: costDistributionGenerik,
        // Toll categories (Toll In excluded)
        tollOut: costDistributionTollOut,
        import: costDistributionImport,
        inhouse: costDistributionInhouse
      },
      hppStats: {
        // LOB categories
        all: hppStatsAll,
        ethical: hppStatsEthical,
        otc: hppStatsOTC,
        generik: hppStatsGenerik,
        // Toll categories (Toll In excluded)
        tollOut: hppStatsTollOut,
        import: hppStatsImport,
        inhouse: hppStatsInhouse
      },
      // Heat map data for LOB x Category matrix
      heatMap,
      // Include ALL products for detailed view (including those with HNA=0)
      // Products with HNA=0 will show COGS as 0 but are excluded from calculations
      products: products.map(p => {
        const bb = parseFloat(p.totalBB) || 0;
        const bk = parseFloat(p.totalBK) || 0;
        const hpp = parseFloat(p.HPP) || 0;
        const hna = parseFloat(p.Product_SalesHNA) || 0;
        
        // Calculate Others for each product
        const biayaProses = (parseFloat(p.MH_Proses_Std) || 0) * (parseFloat(p.Biaya_Proses) || 0);
        const biayaKemas = (parseFloat(p.MH_Kemas_Std) || 0) * (parseFloat(p.Biaya_Kemas) || 0);
        const expiryCost = parseFloat(p.Beban_Sisa_Bahan_Exp) || 0;
        
        // IMPORTANT: toll_fee is per unit, must multiply by Batch_Size to match batch-level costs (BB, BK, etc.)
        let marginCost = 0;
        const batchSize = parseFloat(p.Batch_Size) || 1;
        if (p.margin && parseFloat(p.margin) > 0) {
          const marginPercent = parseFloat(p.margin);
          const subtotal = bb + bk + biayaProses + biayaKemas + expiryCost;
          marginCost = subtotal * marginPercent;
        } else if (p.toll_fee && parseFloat(p.toll_fee) > 0) {
          marginCost = (parseFloat(p.toll_fee) || 0) * batchSize;
        }
        
        const biayaReagen = parseFloat(p.Biaya_Reagen) || 0;
        const biayaAnalisa = parseFloat(p.Biaya_Analisa) || 0;
        const ratePLN = parseFloat(p.Rate_PLN) || 0;
        const directLabor = parseFloat(p.Direct_Labor) || 0;
        const factoryOverhead = parseFloat(p.Factory_Over_Head_50) || parseFloat(p.Factory_Over_Head) || 0;
        const depresiasi = parseFloat(p.Depresiasi) || 0;
        
        const others = biayaProses + biayaKemas + expiryCost + marginCost + 
                      biayaReagen + biayaAnalisa + ratePLN + directLabor + factoryOverhead + depresiasi;
        
        return {
          Product_ID: p.Product_ID,
          Product_Name: p.Product_Name,
          category: p.actualCategory,
          // Map 'Lapi' to 'Inhouse' for display
          tollCategory: p.tollCategory === 'Lapi' ? 'Inhouse' : p.tollCategory,
          LOB: p.LOB,
          HPP: hpp,
          HNA: hna,
          COGS: hna > 0 ? ((hpp / hna) * 100).toFixed(2) : 0,
          totalBB: bb,
          totalBK: bk,
          totalOthers: others,
          // Percentages for pie chart display
          bbPercent: hpp > 0 ? ((bb / hpp) * 100).toFixed(1) : 0,
          bkPercent: hpp > 0 ? ((bk / hpp) * 100).toFixed(1) : 0,
          othersPercent: hpp > 0 ? ((others / hpp) * 100).toFixed(1) : 0
        };
      })
    };
  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    throw error;
  }
}

/**
 * Get available years for dashboard dropdown
 */
async function getAvailableYears() {
  try {
    const db = await connect();
    const result = await db.request().query(`
      SELECT DISTINCT Periode 
      FROM M_COGS_PRODUCT_FORMULA_FIX 
      ORDER BY Periode DESC
    `);
    return result.recordset.map(row => row.Periode);
  } catch (error) {
    console.error("Error getting available years:", error);
    throw error;
  }
}

/**
 * Get HPP Actual vs Standard comparison data
 * Compares actual batch HPP per unit against standard HPP for the same product
 * @param {string} year - Year (e.g., '2026')
 * @param {string} mode - 'YTD' or 'MTD'
 * @param {number} month - Month (1-12), only used when mode='MTD'
 * @returns {Object} Comparison statistics and batch details
 */
async function getHPPActualVsStandard(year = null, mode = 'YTD', month = null) {
  try {
    const db = await connect();
    const targetYear = year || new Date().getFullYear().toString();
    
    // Build period filter based on mode
    let periodFilter = '';
    if (mode === 'MTD' && month) {
      const periodStr = `${targetYear}${String(month).padStart(2, '0')}`;
      periodFilter = `AND h.Periode = '${periodStr}'`;
    } else {
      // YTD - all periods in the year
      periodFilter = `AND h.Periode LIKE '${targetYear}%'`;
    }
    
    // First, get standard HPP data from sp_COGS_HPP_List
    const standardRequest = db.request().input('year', sql.VarChar(4), targetYear);
    const standardResult = await standardRequest.query(`exec sp_COGS_HPP_List @year`);
    
    // Combine ethical and generik1 results (stored proc returns 3 recordsets)
    const ethical = standardResult.recordsets[0] || [];
    const generik1 = standardResult.recordsets[1] || [];
    
    // Build a map of Product_ID -> Standard HPP per unit
    // Track products with margin/rounded to exclude them from comparison
    const standardHPPMap = {};
    const excludedProductIds = new Set(); // Products with margin or rounded
    
    [...ethical, ...generik1].forEach(p => {
      const hpp = parseFloat(p.HPP) || 0;
      const margin = parseFloat(p.margin) || 0;
      const rounded = parseFloat(p.rounded) || 0;
      const batchSize = parseFloat(p.Batch_Size) || 0;
      const rendemen = parseFloat(p.Group_Rendemen) || 100; // Rendemen percentage (default 100%)
      const totalBB = parseFloat(p.totalBB) || 0;
      const totalBK = parseFloat(p.totalBK) || 0;
      const lob = p.LOB || '';
      
      // Exclude products that have margin or rounded set
      if (margin !== 0 || rounded !== 0) {
        excludedProductIds.add(p.Product_ID);
      }
      
      // Calculate Standard Overhead based on LOB type
      // For Ethical/OTC: (MH_Proses_Std × Biaya_Proses) + (MH_Kemas_Std × Biaya_Kemas) + Beban_Sisa_Bahan_Exp
      // For Generic: Additional items like MH_Timbang, MH_Analisa, MH_Mesin × Rate_PLN, Biaya_Reagen, Biaya_Analisa
      
      const mhProsesStd = parseFloat(p.MH_Proses_Std) || 0;
      const mhKemasStd = parseFloat(p.MH_Kemas_Std) || 0;
      const biayaProses = parseFloat(p.Biaya_Proses) || 0;
      const biayaKemas = parseFloat(p.Biaya_Kemas) || 0;
      const bebanSisaBahanExp = parseFloat(p.Beban_Sisa_Bahan_Exp) || 0;
      
      let overheadStd = 0;
      
      if (lob === 'GENERIK') {
        // Generic products have more overhead components
        const mhAnalisaStd = parseFloat(p.MH_Analisa_Std) || 0;
        const mhTimbangBB = parseFloat(p.MH_Timbang_BB) || 0;
        const mhTimbangBK = parseFloat(p.MH_Timbang_BK) || 0;
        const mhMesinStd = parseFloat(p.MH_Mesin_Std) || 0;
        const biayaReagen = parseFloat(p.Biaya_Reagen) || 0;
        const biayaAnalisa = parseFloat(p.Biaya_Analisa) || 0;
        const ratePLN = parseFloat(p.Rate_PLN) || 0;
        
        overheadStd = 
          (mhProsesStd * biayaProses) +
          (mhKemasStd * biayaKemas) +
          (mhTimbangBB * biayaProses) +  // MH_Timbang uses Biaya_Proses rate
          (mhTimbangBK * biayaProses) +
          (mhAnalisaStd * biayaAnalisa) +
          (mhMesinStd * ratePLN) +
          biayaReagen +
          bebanSisaBahanExp;
      } else {
        // Ethical/OTC products - simpler overhead
        overheadStd = 
          (mhProsesStd * biayaProses) +
          (mhKemasStd * biayaKemas) +
          bebanSisaBahanExp;
      }
      
      standardHPPMap[p.Product_ID] = {
        hppPerUnit: hpp,
        batchSize: batchSize,
        rendemen: rendemen,         // Rendemen percentage
        // Expected output = Batch_Size * Rendemen / 100
        expectedOutput: batchSize * rendemen / 100,
        totalBB: totalBB,           // Total for standard batch
        totalBK: totalBK,           // Total for standard batch  
        overhead: overheadStd,      // Total for standard batch
        lob: lob
      };
    });
    
    // Query to get actual batches with raw values for overhead calculation
    const actualQuery = `
      SELECT 
        h.HPP_Actual_ID,
        h.DNc_No,
        h.DNc_ProductID as Product_ID,
        h.Product_Name,
        h.BatchNo,
        h.BatchDate,
        h.Periode,
        h.LOB,
        h.Group_PNCategory_Name,
        h.Output_Actual,
        h.Batch_Size_Std,
        h.Total_Cost_BB,
        h.Total_Cost_BK,
        p.Product_SalesHNA as HNA,
        -- Raw values for overhead calculation (calculated in JS based on LOB)
        ISNULL(h.MH_Proses_Actual, h.MH_Proses_Std) as MH_Proses,
        ISNULL(h.MH_Kemas_Actual, h.MH_Kemas_Std) as MH_Kemas,
        ISNULL(h.MH_Timbang_BB, 0) as MH_Timbang_BB,
        ISNULL(h.MH_Timbang_BK, 0) as MH_Timbang_BK,
        ISNULL(h.MH_Analisa_Std, 0) as MH_Analisa,
        ISNULL(h.MH_Mesin_Std, 0) as MH_Mesin,
        ISNULL(h.Rate_MH_Proses, 0) as Rate_MH_Proses,
        ISNULL(h.Rate_MH_Kemas, 0) as Rate_MH_Kemas,
        ISNULL(h.Rate_MH_Timbang, 0) as Rate_MH_Timbang,
        ISNULL(h.Biaya_Analisa, 0) as Biaya_Analisa,
        ISNULL(h.Rate_PLN, 0) as Rate_PLN,
        ISNULL(h.Biaya_Reagen, 0) as Biaya_Reagen,
        ISNULL(h.Direct_Labor, 0) as Direct_Labor,
        ISNULL(h.Factory_Overhead, 0) as Factory_Overhead,
        ISNULL(h.Depresiasi, 0) as Depresiasi,
        ISNULL(h.Beban_Sisa_Bahan_Exp, 0) as Beban_Sisa_Bahan_Exp,
        ISNULL(h.Cost_Utility, 0) as Cost_Utility,
        ISNULL(h.Toll_Fee, 0) as Toll_Fee,
        ISNULL(h.Biaya_Lain, 0) as Biaya_Lain
      FROM t_COGS_HPP_Actual_Header h
      LEFT JOIN m_Product p ON h.DNc_ProductID = p.Product_ID
      WHERE h.Calculation_Status = 'COMPLETED'
        AND h.LOB != 'GRANULATE'
        ${periodFilter}
        AND ISNULL(h.Output_Actual, 0) > 0
      ORDER BY h.BatchDate DESC, h.DNc_ProductID
    `;
    
    const actualResult = await db.request().query(actualQuery);
    const actualBatches = actualResult.recordset || [];
    
    // Helper function to determine if product is Ethical/OTC or Generic
    const isEthicalOrOTC = (lob) => lob === 'ETHICAL' || lob === 'OTC';
    const isGeneric = (lob) => lob === 'GENERIK' || lob === 'GENERIC';
    
    // Helper function to calculate overhead based on LOB type (matching HPP Actual page)
    const calculateActualOverhead = (b) => {
      const lob = b.LOB || '';
      
      if (isEthicalOrOTC(lob)) {
        // Ethical/OTC: Only Pengolahan + Pengemasan + Expiry
        const biayaProses = b.MH_Proses * b.Rate_MH_Proses;
        const biayaKemas = b.MH_Kemas * b.Rate_MH_Kemas;
        return biayaProses + biayaKemas + b.Beban_Sisa_Bahan_Exp;
      } else if (isGeneric(lob)) {
        // Generic1: Timbang + Proses + Kemas + Analisa + Mesin + Reagen + Expiry
        const biayaTimbangBB = b.MH_Timbang_BB * (b.Rate_MH_Timbang || b.Rate_MH_Proses);
        const biayaTimbangBK = b.MH_Timbang_BK * (b.Rate_MH_Timbang || b.Rate_MH_Proses);
        const biayaProses = b.MH_Proses * b.Rate_MH_Proses;
        const biayaKemas = b.MH_Kemas * b.Rate_MH_Kemas;
        const biayaAnalisa = b.MH_Analisa * b.Biaya_Analisa;
        const biayaMesin = b.MH_Mesin * b.Rate_PLN;
        return biayaTimbangBB + biayaTimbangBK + biayaProses + biayaKemas + biayaAnalisa + biayaMesin + b.Biaya_Reagen + b.Beban_Sisa_Bahan_Exp;
      } else {
        // Generic2 or other: Direct Labor + Factory Overhead + Depresiasi + Expiry
        const totalMH = b.MH_Proses + b.MH_Kemas;
        const directLabor = totalMH * b.Direct_Labor;
        const factoryOH = totalMH * b.Factory_Overhead;
        const depresiasi = totalMH * b.Depresiasi;
        return directLabor + factoryOH + depresiasi + b.Beban_Sisa_Bahan_Exp;
      }
    };
    
    // Calculate Total HPP Actual = Total BB + Total BK + Overhead
    const calculateTotalHPPActual = (b) => {
      const totalBB = b.Total_Cost_BB || 0;
      const totalBK = b.Total_Cost_BK || 0;
      const overhead = calculateActualOverhead(b);
      return totalBB + totalBK + overhead;
    };
    
    // Filter out products with margin/rounded, then calculate HPP per unit
    const batches = actualBatches
      .filter(b => !excludedProductIds.has(b.Product_ID)) // Exclude margin/rounded products
      .map(b => {
      const overheadActual = calculateActualOverhead(b);
      const totalHPPActual = (b.Total_Cost_BB || 0) + (b.Total_Cost_BK || 0) + overheadActual;
      const hppActualPerUnit = b.Output_Actual > 0 ? totalHPPActual / b.Output_Actual : 0;
      const standardData = standardHPPMap[b.Product_ID] || { hppPerUnit: 0, batchSize: 0 };
      const hppStandardPerUnit = standardData.hppPerUnit;
      
      // Calculate variance percentage: (Actual - Standard) / Standard * 100
      const variancePercent = hppStandardPerUnit > 0 
        ? ((hppActualPerUnit - hppStandardPerUnit) / hppStandardPerUnit * 100)
        : 0;
      
      return {
        hppActualId: b.HPP_Actual_ID,
        productId: b.Product_ID,
        productName: b.Product_Name,
        batchNo: b.BatchNo,
        batchDate: b.BatchDate,
        periode: b.Periode,
        lob: b.LOB,
        category: b.Group_PNCategory_Name,
        outputActual: b.Output_Actual,
        // Use rendemen-adjusted expected output for fair comparison
        batchSizeStd: standardData.expectedOutput || standardData.batchSize || b.Batch_Size_Std || 0,
        hppActualTotal: totalHPPActual,
        hppActualPerUnit: hppActualPerUnit,
        hppStandardPerUnit: hppStandardPerUnit,
        hppStandardTotal: hppStandardPerUnit * b.Output_Actual,
        variancePercent: variancePercent,
        hna: b.HNA,
        // Breakdown: Total BB (TOTALS, not per unit)
        totalBBActual: b.Total_Cost_BB || 0,
        totalBBStd: standardData.totalBB || 0,
        // Breakdown: Total BK (TOTALS, not per unit)
        totalBKActual: b.Total_Cost_BK || 0,
        totalBKStd: standardData.totalBK || 0,
        // Breakdown: Overhead (TOTALS, not per unit)
        overheadActual: overheadActual,
        overheadStd: standardData.overhead || 0,
        // Classification
        costStatus: hppActualPerUnit < hppStandardPerUnit ? 'lower' :
                   hppActualPerUnit > hppStandardPerUnit ? 'higher' : 'same'
      };
    });
    
    // Filter batches that have valid standard HPP for comparison
    const validBatches = batches.filter(b => 
      b.hppStandardPerUnit > 0 && 
      b.hppActualPerUnit > 0
    );
    
    // Count batches: lower cost vs higher cost vs same
    const lowerCostBatches = validBatches.filter(b => b.costStatus === 'lower');
    const higherCostBatches = validBatches.filter(b => b.costStatus === 'higher');
    const sameCostBatches = validBatches.filter(b => b.costStatus === 'same');
    
    // Calculate average ratio (Actual / Standard)
    // A ratio of 100% means actual equals standard
    // Below 100% means actual is lower (better)
    // Above 100% means actual is higher (worse)
    let avgRatio = 100;
    if (validBatches.length > 0) {
      const totalRatio = validBatches.reduce((sum, b) => {
        return sum + (b.hppActualPerUnit / b.hppStandardPerUnit * 100);
      }, 0);
      avgRatio = totalRatio / validBatches.length;
    }
    
    // Calculate total variance in currency
    const totalVariance = validBatches.reduce((sum, b) => {
      return sum + (b.hppActualTotal - b.hppStandardTotal);
    }, 0);
    
    // Get available months for MTD selection
    const monthsQuery = `
      SELECT DISTINCT 
        SUBSTRING(Periode, 5, 2) as Month,
        Periode
      FROM t_COGS_HPP_Actual_Header
      WHERE Periode LIKE '${targetYear}%'
        AND Calculation_Status = 'COMPLETED'
      ORDER BY Periode
    `;
    const monthsResult = await db.request().query(monthsQuery);
    const availableMonths = monthsResult.recordset.map(r => parseInt(r.Month));
    
    return {
      year: targetYear,
      mode,
      month: mode === 'MTD' ? month : null,
      availableMonths,
      summary: {
        totalBatches: validBatches.length,
        lowerCostCount: lowerCostBatches.length,
        higherCostCount: higherCostBatches.length,
        sameCostCount: sameCostBatches.length,
        avgActualVsStandardRatio: avgRatio,
        totalVariance: totalVariance,
        // Percentages for the bar
        lowerCostPercent: validBatches.length > 0 ? (lowerCostBatches.length / validBatches.length * 100) : 0,
        higherCostPercent: validBatches.length > 0 ? (higherCostBatches.length / validBatches.length * 100) : 0
      },
      batches
    };
  } catch (error) {
    console.error("Error getting HPP Actual vs Standard:", error);
    throw error;
  }
}

/**
 * Get HPP Actual vs Standard batch data for a specific periode
 * Used when clicking on a trend chart data point
 * @param {string} periode - Periode (e.g., '202601')
 * @param {string} lob - LOB filter: 'ALL', 'ETHICAL', 'OTC', 'GENERIK'
 * @returns {Object} Batch details with comparison data
 */
async function getActualVsStandardByPeriode(periode, lob = 'ALL') {
  try {
    const db = await connect();
    
    // Always use the latest year for standard data to ensure consistency
    // (same approach as the trend function)
    const latestYear = await getLatestPeriode();
    
    // Build LOB filter
    const lobFilter = lob && lob !== 'ALL' ? `AND h.LOB = '${lob}'` : '';
    
    // First, get standard HPP data from sp_COGS_HPP_List using latest year
    const standardRequest = db.request().input('year', sql.VarChar(4), latestYear);
    const standardResult = await standardRequest.query(`exec sp_COGS_HPP_List @year`);
    
    // Combine ethical and generik1 results
    const ethical = standardResult.recordsets[0] || [];
    const generik1 = standardResult.recordsets[1] || [];
    
    // Build standard HPP map (exclude products with margin/rounded)
    const standardHPPMap = {};
    const excludedProductIds = new Set();
    
    [...ethical, ...generik1].forEach(p => {
      const margin = parseFloat(p.margin) || 0;
      const rounded = parseFloat(p.rounded) || 0;
      
      if (margin !== 0 || rounded !== 0) {
        excludedProductIds.add(p.Product_ID);
        return;
      }
      
      const hpp = parseFloat(p.HPP) || 0;
      const batchSize = parseFloat(p.Batch_Size) || 0;
      const rendemen = parseFloat(p.Group_Rendemen) || 100; // Rendemen percentage (default 100%)
      // Try both field name conventions (totalBB/totalBK or Jml_BB/Jml_BK)
      const totalBB = parseFloat(p.totalBB) || parseFloat(p.Jml_BB) || 0;
      const totalBK = parseFloat(p.totalBK) || parseFloat(p.Jml_BK) || 0;
      const productLob = (p.LOB || '').toUpperCase();
      const isGeneric = productLob === 'GENERIK' || productLob === 'GENERIC';
      
      // Calculate standard overhead (matching the existing function's approach)
      const mhProsesStd = parseFloat(p.MH_Proses_Std) || 0;
      const mhKemasStd = parseFloat(p.MH_Kemas_Std) || 0;
      const biayaProses = parseFloat(p.Biaya_Proses) || parseFloat(p.biaya_proses) || parseFloat(p.Rate_MH_Proses) || 0;
      const biayaKemas = parseFloat(p.Biaya_Kemas) || parseFloat(p.biaya_kemas) || parseFloat(p.Rate_MH_Kemas) || 0;
      const bebanSisaBahanExp = parseFloat(p.Beban_Sisa_Bahan_Exp) || 0;
      
      let overheadStd = 0;
      if (isGeneric) {
        const mhTimbangBBStd = parseFloat(p.MH_Timbang_BB) || 0;
        const mhTimbangBKStd = parseFloat(p.MH_Timbang_BK) || 0;
        const mhAnalisaStd = parseFloat(p.MH_Analisa_Std) || 0;
        const biayaAnalisa = parseFloat(p.Biaya_Analisa) || 0;
        const mhMesinStd = parseFloat(p.MH_Mesin_Std) || 0;
        const ratePLN = parseFloat(p.Rate_PLN) || 0;
        const biayaReagen = parseFloat(p.Biaya_Reagen) || 0;
        
        overheadStd = 
          (mhTimbangBBStd * biayaProses) +
          (mhTimbangBKStd * biayaProses) +
          (mhProsesStd * biayaProses) +
          (mhKemasStd * biayaKemas) +
          (mhAnalisaStd * biayaAnalisa) +
          (mhMesinStd * ratePLN) +
          biayaReagen +
          bebanSisaBahanExp;
      } else {
        overheadStd = 
          (mhProsesStd * biayaProses) +
          (mhKemasStd * biayaKemas) +
          bebanSisaBahanExp;
      }
      
      standardHPPMap[p.Product_ID] = {
        hppPerUnit: hpp,
        batchSize: batchSize,
        rendemen: rendemen,
        expectedOutput: batchSize * rendemen / 100,
        totalBB: totalBB,
        totalBK: totalBK,
        overhead: overheadStd,
        lob: productLob
      };
    });
    
    // Query actual batches for the specific periode
    const actualQuery = `
      SELECT 
        h.HPP_Actual_ID,
        h.DNc_No,
        h.DNc_ProductID as Product_ID,
        h.Product_Name,
        h.BatchNo,
        h.BatchDate,
        h.Periode,
        h.LOB,
        h.Group_PNCategory_Name,
        h.Output_Actual,
        h.Batch_Size_Std,
        h.Total_Cost_BB,
        h.Total_Cost_BK,
        p.Product_SalesHNA as HNA,
        ISNULL(h.MH_Proses_Actual, h.MH_Proses_Std) as MH_Proses,
        ISNULL(h.MH_Kemas_Actual, h.MH_Kemas_Std) as MH_Kemas,
        ISNULL(h.MH_Timbang_BB, 0) as MH_Timbang_BB,
        ISNULL(h.MH_Timbang_BK, 0) as MH_Timbang_BK,
        ISNULL(h.MH_Analisa_Std, 0) as MH_Analisa,
        ISNULL(h.MH_Mesin_Std, 0) as MH_Mesin,
        ISNULL(h.Rate_MH_Proses, 0) as Rate_MH_Proses,
        ISNULL(h.Rate_MH_Kemas, 0) as Rate_MH_Kemas,
        ISNULL(h.Rate_MH_Timbang, 0) as Rate_MH_Timbang,
        ISNULL(h.Biaya_Analisa, 0) as Biaya_Analisa,
        ISNULL(h.Rate_PLN, 0) as Rate_PLN,
        ISNULL(h.Biaya_Reagen, 0) as Biaya_Reagen,
        ISNULL(h.Direct_Labor, 0) as Direct_Labor,
        ISNULL(h.Factory_Overhead, 0) as Factory_Overhead,
        ISNULL(h.Depresiasi, 0) as Depresiasi,
        ISNULL(h.Beban_Sisa_Bahan_Exp, 0) as Beban_Sisa_Bahan_Exp
      FROM t_COGS_HPP_Actual_Header h
      LEFT JOIN m_Product p ON h.DNc_ProductID = p.Product_ID
      WHERE h.Calculation_Status = 'COMPLETED'
        AND h.LOB != 'GRANULATE'
        AND h.Periode = '${periode}'
        AND ISNULL(h.Output_Actual, 0) > 0
        ${lobFilter}
      ORDER BY h.BatchDate DESC, h.DNc_ProductID
    `;
    
    const actualResult = await db.request().query(actualQuery);
    const actualBatches = actualResult.recordset || [];
    
    // Helper functions
    const isEthicalOrOTC = (l) => l === 'ETHICAL' || l === 'OTC';
    const isGeneric = (l) => l === 'GENERIK' || l === 'GENERIC';
    
    const calculateActualOverhead = (b) => {
      const l = b.LOB || '';
      if (isEthicalOrOTC(l)) {
        return (b.MH_Proses * b.Rate_MH_Proses) + (b.MH_Kemas * b.Rate_MH_Kemas) + b.Beban_Sisa_Bahan_Exp;
      } else if (isGeneric(l)) {
        const biayaTimbangBB = b.MH_Timbang_BB * (b.Rate_MH_Timbang || b.Rate_MH_Proses);
        const biayaTimbangBK = b.MH_Timbang_BK * (b.Rate_MH_Timbang || b.Rate_MH_Proses);
        return biayaTimbangBB + biayaTimbangBK + (b.MH_Proses * b.Rate_MH_Proses) + 
               (b.MH_Kemas * b.Rate_MH_Kemas) + (b.MH_Analisa * b.Biaya_Analisa) + 
               (b.MH_Mesin * b.Rate_PLN) + b.Biaya_Reagen + b.Beban_Sisa_Bahan_Exp;
      } else {
        const totalMH = b.MH_Proses + b.MH_Kemas;
        return (totalMH * b.Direct_Labor) + (totalMH * b.Factory_Overhead) + 
               (totalMH * b.Depresiasi) + b.Beban_Sisa_Bahan_Exp;
      }
    };
    
    // Process batches
    const batches = actualBatches
      .filter(b => !excludedProductIds.has(b.Product_ID))
      .map(b => {
        const overheadActual = calculateActualOverhead(b);
        const totalHPPActual = (b.Total_Cost_BB || 0) + (b.Total_Cost_BK || 0) + overheadActual;
        const hppActualPerUnit = b.Output_Actual > 0 ? totalHPPActual / b.Output_Actual : 0;
        
        // Get standard data with complete default values
        const standardData = standardHPPMap[b.Product_ID] || { 
          hppPerUnit: 0, 
          batchSize: 0,
          totalBB: 0,
          totalBK: 0,
          overhead: 0,
          lob: ''
        };
        const hppStandardPerUnit = standardData.hppPerUnit;
        
        const variancePercent = hppStandardPerUnit > 0 
          ? ((hppActualPerUnit - hppStandardPerUnit) / hppStandardPerUnit * 100)
          : 0;
        
        return {
          hppActualId: b.HPP_Actual_ID,
          productId: b.Product_ID,
          productName: b.Product_Name,
          batchNo: b.BatchNo,
          batchDate: b.BatchDate,
          periode: b.Periode,
          lob: b.LOB,
          category: b.Group_PNCategory_Name,
          outputActual: b.Output_Actual,
          // Use rendemen-adjusted expected output for fair comparison
          batchSizeStd: standardData.expectedOutput || standardData.batchSize || b.Batch_Size_Std || 0,
          hppActualTotal: totalHPPActual,
          hppActualPerUnit: hppActualPerUnit,
          hppStandardPerUnit: hppStandardPerUnit,
          hppStandardTotal: hppStandardPerUnit * b.Output_Actual,
          variancePercent: variancePercent,
          hna: b.HNA,
          totalBBActual: b.Total_Cost_BB || 0,
          totalBBStd: standardData.totalBB || 0,
          totalBKActual: b.Total_Cost_BK || 0,
          totalBKStd: standardData.totalBK || 0,
          overheadActual: overheadActual,
          overheadStd: standardData.overhead || 0,
          costStatus: hppActualPerUnit < hppStandardPerUnit ? 'lower' :
                     hppActualPerUnit > hppStandardPerUnit ? 'higher' : 'same'
        };
      });
    
    const validBatches = batches.filter(b => b.hppStandardPerUnit > 0 && b.hppActualPerUnit > 0);
    const lowerCostBatches = validBatches.filter(b => b.costStatus === 'lower');
    const higherCostBatches = validBatches.filter(b => b.costStatus === 'higher');
    
    let avgRatio = 100;
    if (validBatches.length > 0) {
      const totalRatio = validBatches.reduce((sum, b) => sum + (b.hppActualPerUnit / b.hppStandardPerUnit * 100), 0);
      avgRatio = totalRatio / validBatches.length;
    }
    
    return {
      periode,
      lob,
      summary: {
        totalBatches: validBatches.length,
        lowerCostCount: lowerCostBatches.length,
        higherCostCount: higherCostBatches.length,
        avgActualVsStandardRatio: avgRatio,
        lowerCostPercent: validBatches.length > 0 ? (lowerCostBatches.length / validBatches.length * 100) : 0,
        higherCostPercent: validBatches.length > 0 ? (higherCostBatches.length / validBatches.length * 100) : 0
      },
      batches: validBatches
    };
  } catch (error) {
    console.error("Error getting HPP Actual vs Standard by periode:", error);
    throw error;
  }
}

module.exports = {
  getLatestPeriode,
  getDashboardHPPData,
  getDashboardStats,
  getAvailableYears,
  getHPPActualVsStandard,
  getActualVsStandardTrend,
  getActualVsStandardByPeriode,
  getActualDashboardStats
};

/**
 * Get dashboard stats from HPP Actual batches (Cost Management & Pricing Risk)
 * This aggregates actual batch data instead of standard product data
 * @param {string} year - Year (e.g., '2026')
 * @returns {Object} Dashboard stats based on actual batches
 */
async function getActualDashboardStats(year = null) {
  try {
    const db = await connect();
    const targetYear = year || new Date().getFullYear().toString();
    
    // First, get standard HPP data to get Category (toll type) for each product
    // Category comes from sp_COGS_HPP_List, not from m_Product directly
    const standardRequest = db.request().input('year', sql.VarChar(4), targetYear);
    const standardResult = await standardRequest.query(`exec sp_COGS_HPP_List @year`);
    
    // Build a map of Product_ID -> Category (toll type)
    // Also track products with margin/rounded to exclude them (same as getHPPActualVsStandard)
    const ethical = standardResult.recordsets[0] || [];
    const generik1 = standardResult.recordsets[1] || [];
    
    const categoryMap = {};
    const excludedProductIds = new Set(); // Products with margin or rounded
    
    [...ethical, ...generik1].forEach(p => {
      categoryMap[p.Product_ID] = p.Category; // 'Toll In', 'Toll Out', 'Import', 'Lapi'
      
      // Exclude products that have margin or rounded set (same logic as getHPPActualVsStandard)
      const margin = parseFloat(p.margin) || 0;
      const rounded = parseFloat(p.rounded) || 0;
      if (margin !== 0 || rounded !== 0) {
        excludedProductIds.add(p.Product_ID);
      }
    });
    
    // Query all completed batches for the year (excluding granulates)
    const query = `
      SELECT 
        h.HPP_Actual_ID,
        h.DNc_ProductID,
        h.Product_Name,
        h.BatchNo,
        h.Periode,
        h.LOB,
        h.Output_Actual,
        h.Total_Cost_BB,
        h.Total_Cost_BK,
        p.Product_SalesHNA as HNA,
        -- Overhead components for distribution breakdown
        ISNULL(h.MH_Proses_Actual, h.MH_Proses_Std) as MH_Proses,
        ISNULL(h.MH_Kemas_Actual, h.MH_Kemas_Std) as MH_Kemas,
        ISNULL(h.Rate_MH_Proses, 0) as Rate_MH_Proses,
        ISNULL(h.Rate_MH_Kemas, 0) as Rate_MH_Kemas,
        ISNULL(h.MH_Timbang_BB, 0) as MH_Timbang_BB,
        ISNULL(h.MH_Timbang_BK, 0) as MH_Timbang_BK,
        ISNULL(h.Rate_MH_Timbang, 0) as Rate_MH_Timbang,
        ISNULL(h.MH_Analisa_Std, 0) as MH_Analisa,
        ISNULL(h.Biaya_Analisa, 0) as Biaya_Analisa,
        ISNULL(h.MH_Mesin_Std, 0) as MH_Mesin,
        ISNULL(h.Rate_PLN, 0) as Rate_PLN,
        ISNULL(h.Biaya_Reagen, 0) as Biaya_Reagen,
        ISNULL(h.Beban_Sisa_Bahan_Exp, 0) as Beban_Sisa_Bahan_Exp,
        ISNULL(h.Direct_Labor, 0) as Direct_Labor,
        ISNULL(h.Factory_Overhead, 0) as Factory_Overhead,
        ISNULL(h.Depresiasi, 0) as Depresiasi,
        ISNULL(h.Toll_Fee, 0) as Toll_Fee,
        ISNULL(h.Cost_Utility, 0) as Cost_Utility,
        ISNULL(h.Biaya_Lain, 0) as Biaya_Lain
      FROM t_COGS_HPP_Actual_Header h
      LEFT JOIN m_Product p ON h.DNc_ProductID = p.Product_ID
      WHERE h.Calculation_Status = 'COMPLETED'
        AND h.LOB != 'GRANULATE'
        AND h.Periode LIKE '${targetYear}%'
        AND ISNULL(h.Output_Actual, 0) > 0
    `;
    
    const result = await db.request().query(query);
    const batches = result.recordset || [];
    
    if (batches.length === 0) {
      return {
        year: targetYear,
        batchCount: 0,
        costManagement: {
          totalHPP: 0,
          totalHNA: 0,
          overallCOGS: '0.00',
          batchesWithData: 0
        },
        pricingRiskIndicator: {
          ethical: '0.00',
          otc: '0.00',
          generik: '0.00',
          tollOut: '0.00',
          import: '0.00',
          inhouse: '0.00'
        },
        costDistribution: {
          all: { bb: 0, bk: 0, others: 0 },
          ethical: { bb: 0, bk: 0, others: 0 },
          otc: { bb: 0, bk: 0, others: 0 },
          generik: { bb: 0, bk: 0, others: 0 },
          tollOut: { bb: 0, bk: 0, others: 0 },
          import: { bb: 0, bk: 0, others: 0 },
          inhouse: { bb: 0, bk: 0, others: 0 }
        }
      };
    }
    
    // Helper to calculate actual overhead per batch
    const calculateOverhead = (b) => {
      const lob = (b.LOB || '').toUpperCase();
      const biayaProses = (b.MH_Proses || 0) * (b.Rate_MH_Proses || 0);
      const biayaKemas = (b.MH_Kemas || 0) * (b.Rate_MH_Kemas || 0);
      
      if (lob === 'GENERIK' || lob === 'GENERIC') {
        const biayaTimbangBB = (b.MH_Timbang_BB || 0) * (b.Rate_MH_Timbang || b.Rate_MH_Proses || 0);
        const biayaTimbangBK = (b.MH_Timbang_BK || 0) * (b.Rate_MH_Timbang || b.Rate_MH_Proses || 0);
        const biayaAnalisa = (b.MH_Analisa || 0) * (b.Biaya_Analisa || 0);
        const biayaMesin = (b.MH_Mesin || 0) * (b.Rate_PLN || 0);
        return biayaTimbangBB + biayaTimbangBK + biayaProses + biayaKemas + 
               biayaAnalisa + biayaMesin + (b.Biaya_Reagen || 0) + (b.Beban_Sisa_Bahan_Exp || 0);
      } else {
        // Ethical/OTC
        return biayaProses + biayaKemas + (b.Beban_Sisa_Bahan_Exp || 0);
      }
    };
    
    // Categorize batches by LOB and toll category
    // Filter out products with margin/rounded (same as getHPPActualVsStandard)
    const categorizedBatches = batches
      .filter(b => !excludedProductIds.has(b.DNc_ProductID))
      .map(b => {
      const lob = (b.LOB || '').toUpperCase();
      let actualLOB = lob;
      if (lob === 'OTC') actualLOB = 'OTC';
      else if (lob === 'ETHICAL') actualLOB = 'ETHICAL';
      else if (lob === 'GENERIK' || lob === 'GENERIC') actualLOB = 'GENERIK';
      
      // Toll category from categoryMap (derived from sp_COGS_HPP_List)
      // Values: 'Toll In', 'Toll Out', 'Import', 'Lapi'
      const tollCategory = categoryMap[b.DNc_ProductID] || null;
      
      const totalBB = parseFloat(b.Total_Cost_BB) || 0;
      const totalBK = parseFloat(b.Total_Cost_BK) || 0;
      const overhead = calculateOverhead(b);
      const totalHPP = totalBB + totalBK + overhead;
      const hna = parseFloat(b.HNA) || 0;
      const outputActual = parseFloat(b.Output_Actual) || 0;
      
      // COGS = (HPP per unit / HNA) * 100
      const hppPerUnit = outputActual > 0 ? totalHPP / outputActual : 0;
      const cogs = hna > 0 ? (hppPerUnit / hna) * 100 : 0;
      
      return {
        ...b,
        actualLOB,
        tollCategory,
        totalBB,
        totalBK,
        overhead,
        totalHPP,
        hna,
        outputActual,
        hppPerUnit,
        cogs
      };
    });
    
    // Filter out Toll In products
    const validBatches = categorizedBatches.filter(b => b.tollCategory !== 'Toll In');
    
    // Filter batches with valid HNA for COGS calculations
    const batchesWithHNA = validBatches.filter(b => b.hna > 0);
    
    // Overall totals for Cost Management
    const totalHPP = validBatches.reduce((sum, b) => sum + b.totalHPP, 0);
    const totalHNA = validBatches.reduce((sum, b) => sum + (b.hna * b.outputActual), 0);
    const overallCOGS = totalHNA > 0 ? (totalHPP / totalHNA) * 100 : 0;
    
    // Calculate average COGS by LOB (weighted by batch count with valid HNA)
    const calculateAvgCOGS = (filterFn) => {
      const filtered = batchesWithHNA.filter(filterFn);
      if (filtered.length === 0) return 0;
      const avgCogs = filtered.reduce((sum, b) => sum + b.cogs, 0) / filtered.length;
      return avgCogs;
    };
    
    // LOB averages
    const avgCOGSEthical = calculateAvgCOGS(b => b.actualLOB === 'ETHICAL');
    const avgCOGSOTC = calculateAvgCOGS(b => b.actualLOB === 'OTC');
    const avgCOGSGenerik = calculateAvgCOGS(b => b.actualLOB === 'GENERIK');
    
    // Toll category averages
    const avgCOGSTollOut = calculateAvgCOGS(b => b.tollCategory === 'Toll Out');
    const avgCOGSImport = calculateAvgCOGS(b => b.tollCategory === 'Import');
    const avgCOGSInhouse = calculateAvgCOGS(b => b.tollCategory === 'Lapi');
    
    // Cost distribution by category
    const calculateDistribution = (filterFn) => {
      const filtered = validBatches.filter(filterFn);
      const totalBB = filtered.reduce((sum, b) => sum + b.totalBB, 0);
      const totalBK = filtered.reduce((sum, b) => sum + b.totalBK, 0);
      const totalOthers = filtered.reduce((sum, b) => sum + b.overhead, 0);
      return { bb: totalBB, bk: totalBK, others: totalOthers };
    };
    
    const costDistributionAll = calculateDistribution(() => true);
    const costDistributionEthical = calculateDistribution(b => b.actualLOB === 'ETHICAL');
    const costDistributionOTC = calculateDistribution(b => b.actualLOB === 'OTC');
    const costDistributionGenerik = calculateDistribution(b => b.actualLOB === 'GENERIK');
    const costDistributionTollOut = calculateDistribution(b => b.tollCategory === 'Toll Out');
    const costDistributionImport = calculateDistribution(b => b.tollCategory === 'Import');
    const costDistributionInhouse = calculateDistribution(b => b.tollCategory === 'Lapi');
    
    return {
      year: targetYear,
      batchCount: validBatches.length,
      costManagement: {
        totalHPP,
        totalHNA,
        overallCOGS: overallCOGS.toFixed(2),
        batchesWithData: batchesWithHNA.length
      },
      pricingRiskIndicator: {
        ethical: avgCOGSEthical.toFixed(2),
        otc: avgCOGSOTC.toFixed(2),
        generik: avgCOGSGenerik.toFixed(2),
        tollOut: avgCOGSTollOut.toFixed(2),
        import: avgCOGSImport.toFixed(2),
        inhouse: avgCOGSInhouse.toFixed(2)
      },
      costDistribution: {
        all: costDistributionAll,
        ethical: costDistributionEthical,
        otc: costDistributionOTC,
        generik: costDistributionGenerik,
        tollOut: costDistributionTollOut,
        import: costDistributionImport,
        inhouse: costDistributionInhouse
      },
      // Batch details for modal display
      batches: validBatches.map(b => ({
        HPP_Actual_ID: b.HPP_Actual_ID,
        Product_ID: b.DNc_ProductID,
        Product_Name: b.Product_Name,
        BatchNo: b.BatchNo,
        Periode: b.Periode,
        category: b.actualLOB,
        tollCategory: b.tollCategory,
        HNA: b.hna,
        HPP: b.hppPerUnit,
        COGS: b.cogs,
        Output_Actual: b.outputActual,
        totalBB: b.totalBB,
        totalBK: b.totalBK,
        totalOthers: b.overhead,
        totalHPP: b.totalHPP
      }))
    };
  } catch (error) {
    console.error("Error getting actual dashboard stats:", error);
    throw error;
  }
}

/**
 * Get 13-month trend data for HPP Actual vs Standard comparison
 * Returns monthly average ratio grouped by month, with optional LOB filter
 * 13 months allows comparing same month year-over-year (e.g. Feb 2025 vs Feb 2026)
 * @param {string} lob - LOB filter: 'ALL', 'ETHICAL', 'OTC', 'GENERIK'
 * @returns {Object} Trend data with monthly averages
 */
async function getActualVsStandardTrend(lob = 'ALL') {
  try {
    const db = await connect();
    
    // Get data for the last 13 months (allows year-over-year comparison for current month)
    const today = new Date();
    const months = [];
    for (let i = 12; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push({
        year: d.getFullYear().toString(),
        month: d.getMonth() + 1,
        periode: `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      });
    }
    
    // Build LOB filter for the query
    const lobFilter = lob && lob !== 'ALL' ? `AND h.LOB = '${lob}'` : '';
    
    // Query to get actual batches with HPP data
    const query = `
      SELECT 
        h.Periode,
        h.DNc_ProductID as Product_ID,
        h.LOB,
        h.Output_Actual,
        h.Total_Cost_BB,
        h.Total_Cost_BK,
        -- Raw values for overhead calculation
        ISNULL(h.MH_Proses_Actual, h.MH_Proses_Std) as MH_Proses,
        ISNULL(h.MH_Kemas_Actual, h.MH_Kemas_Std) as MH_Kemas,
        ISNULL(h.MH_Timbang_BB, 0) as MH_Timbang_BB,
        ISNULL(h.MH_Timbang_BK, 0) as MH_Timbang_BK,
        ISNULL(h.MH_Analisa_Std, 0) as MH_Analisa,
        ISNULL(h.MH_Mesin_Std, 0) as MH_Mesin,
        ISNULL(h.Rate_MH_Proses, 0) as Rate_MH_Proses,
        ISNULL(h.Rate_MH_Kemas, 0) as Rate_MH_Kemas,
        ISNULL(h.Rate_MH_Timbang, 0) as Rate_MH_Timbang,
        ISNULL(h.Biaya_Analisa, 0) as Biaya_Analisa,
        ISNULL(h.Rate_PLN, 0) as Rate_PLN,
        ISNULL(h.Biaya_Reagen, 0) as Biaya_Reagen,
        ISNULL(h.Direct_Labor, 0) as Direct_Labor,
        ISNULL(h.Factory_Overhead, 0) as Factory_Overhead,
        ISNULL(h.Depresiasi, 0) as Depresiasi,
        ISNULL(h.Beban_Sisa_Bahan_Exp, 0) as Beban_Sisa_Bahan_Exp
      FROM t_COGS_HPP_Actual_Header h
      WHERE h.Calculation_Status = 'COMPLETED'
        AND h.LOB != 'GRANULATE'
        AND h.Periode IN (${months.map(m => `'${m.periode}'`).join(',')})
        AND ISNULL(h.Output_Actual, 0) > 0
        ${lobFilter}
    `;
    
    const actualResult = await db.request().query(query);
    const actualBatches = actualResult.recordset || [];
    
    // Get standard HPP for all products from the most recent year
    const latestYear = months[months.length - 1].year;
    const standardRequest = db.request().input('year', sql.VarChar(4), latestYear);
    const standardResult = await standardRequest.query(`exec sp_COGS_HPP_List @year`);
    
    const ethical = standardResult.recordsets[0] || [];
    const generik1 = standardResult.recordsets[1] || [];
    
    // Build standard HPP map (exclude products with margin/rounded)
    const standardHPPMap = {};
    const excludedProductIds = new Set();
    
    [...ethical, ...generik1].forEach(p => {
      const hpp = parseFloat(p.HPP) || 0;
      const margin = parseFloat(p.margin) || 0;
      const rounded = parseFloat(p.rounded) || 0;
      
      if (margin !== 0 || rounded !== 0) {
        excludedProductIds.add(p.Product_ID);
        return;
      }
      
      standardHPPMap[p.Product_ID] = {
        hppPerUnit: hpp
      };
    });
    
    // Helper functions for overhead calculation
    const isEthicalOrOTC = (l) => l === 'ETHICAL' || l === 'OTC';
    const isGeneric = (l) => l === 'GENERIK' || l === 'GENERIC';
    
    const calculateActualOverhead = (b) => {
      const l = b.LOB || '';
      
      if (isEthicalOrOTC(l)) {
        const biayaProses = b.MH_Proses * b.Rate_MH_Proses;
        const biayaKemas = b.MH_Kemas * b.Rate_MH_Kemas;
        return biayaProses + biayaKemas + b.Beban_Sisa_Bahan_Exp;
      } else if (isGeneric(l)) {
        const biayaTimbangBB = b.MH_Timbang_BB * (b.Rate_MH_Timbang || b.Rate_MH_Proses);
        const biayaTimbangBK = b.MH_Timbang_BK * (b.Rate_MH_Timbang || b.Rate_MH_Proses);
        const biayaProses = b.MH_Proses * b.Rate_MH_Proses;
        const biayaKemas = b.MH_Kemas * b.Rate_MH_Kemas;
        const biayaAnalisa = b.MH_Analisa * b.Biaya_Analisa;
        const biayaMesin = b.MH_Mesin * b.Rate_PLN;
        return biayaTimbangBB + biayaTimbangBK + biayaProses + biayaKemas + biayaAnalisa + biayaMesin + b.Biaya_Reagen + b.Beban_Sisa_Bahan_Exp;
      } else {
        const totalMH = b.MH_Proses + b.MH_Kemas;
        const directLabor = totalMH * b.Direct_Labor;
        const factoryOH = totalMH * b.Factory_Overhead;
        const depresiasi = totalMH * b.Depresiasi;
        return directLabor + factoryOH + depresiasi + b.Beban_Sisa_Bahan_Exp;
      }
    };
    
    // Group batches by period and calculate average ratio for each month
    const periodData = {};
    
    actualBatches.forEach(b => {
      if (excludedProductIds.has(b.Product_ID)) return;
      
      const standardData = standardHPPMap[b.Product_ID];
      if (!standardData || standardData.hppPerUnit <= 0) return;
      
      const overheadActual = calculateActualOverhead(b);
      const totalHPPActual = (b.Total_Cost_BB || 0) + (b.Total_Cost_BK || 0) + overheadActual;
      const hppActualPerUnit = b.Output_Actual > 0 ? totalHPPActual / b.Output_Actual : 0;
      
      if (hppActualPerUnit <= 0) return;
      
      const ratio = (hppActualPerUnit / standardData.hppPerUnit) * 100;
      const isLower = ratio < 100;
      const isHigher = ratio > 100;
      
      if (!periodData[b.Periode]) {
        periodData[b.Periode] = { ratios: [], batchCount: 0, lowerCount: 0, higherCount: 0 };
      }
      periodData[b.Periode].ratios.push(ratio);
      periodData[b.Periode].batchCount++;
      if (isLower) periodData[b.Periode].lowerCount++;
      if (isHigher) periodData[b.Periode].higherCount++;
    });
    
    // Build result array for all 13 months
    const trendData = months.map(m => {
      const data = periodData[m.periode];
      if (data && data.ratios.length > 0) {
        const avgRatio = data.ratios.reduce((a, b) => a + b, 0) / data.ratios.length;
        return {
          periode: m.periode,
          label: m.label,
          avgRatio: parseFloat(avgRatio.toFixed(2)),
          batchCount: data.batchCount,
          lowerCount: data.lowerCount,
          higherCount: data.higherCount
        };
      }
      return {
        periode: m.periode,
        label: m.label,
        avgRatio: null,
        batchCount: 0,
        lowerCount: 0,
        higherCount: 0
      };
    });
    
    // Calculate overall average (excluding null months)
    const validMonths = trendData.filter(t => t.avgRatio !== null);
    const overallAvg = validMonths.length > 0 
      ? validMonths.reduce((sum, t) => sum + t.avgRatio, 0) / validMonths.length
      : 100;
    
    return {
      lob: lob,
      trendData,
      overallAvgRatio: parseFloat(overallAvg.toFixed(2)),
      totalBatches: validMonths.reduce((sum, t) => sum + t.batchCount, 0)
    };
  } catch (error) {
    console.error("Error getting HPP Actual vs Standard trend:", error);
    throw error;
  }
}