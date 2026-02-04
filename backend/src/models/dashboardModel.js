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
      
      // Exclude products that have margin or rounded set
      if (margin !== 0 || rounded !== 0) {
        excludedProductIds.add(p.Product_ID);
      }
      
      standardHPPMap[p.Product_ID] = {
        hppPerUnit: hpp,
        batchSize: parseFloat(p.Batch_Size) || 0
      };
    });
    
    // Query to get actual batches with calculated Total HPP
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
        p.Product_SalesHNA as HNA,
        -- Calculate Total HPP per Batch (same calculation as HPP Actual List)
        (
          ISNULL(h.Total_Cost_BB, 0) +
          ISNULL(h.Total_Cost_BK, 0) +
          (ISNULL(h.MH_Proses_Actual, h.MH_Proses_Std) * ISNULL(h.Rate_MH_Proses, 0)) +
          (ISNULL(h.MH_Kemas_Actual, h.MH_Kemas_Std) * ISNULL(h.Rate_MH_Kemas, 0)) +
          (ISNULL(h.MH_Timbang_BB, 0) * ISNULL(h.Rate_MH_Timbang, 0)) +
          (ISNULL(h.MH_Timbang_BK, 0) * ISNULL(h.Rate_MH_Timbang, 0)) +
          (ISNULL(h.MH_Proses_Actual, h.MH_Proses_Std) * ISNULL(h.Factory_Overhead, 0)) +
          (ISNULL(h.MH_Kemas_Actual, h.MH_Kemas_Std) * ISNULL(h.Factory_Overhead, 0)) +
          (ISNULL(h.MH_Proses_Actual, h.MH_Proses_Std) * ISNULL(h.Depresiasi, 0)) +
          (ISNULL(h.MH_Kemas_Actual, h.MH_Kemas_Std) * ISNULL(h.Depresiasi, 0)) +
          ISNULL(h.Biaya_Analisa, 0) +
          ISNULL(h.Biaya_Reagen, 0) +
          ISNULL(h.Cost_Utility, 0) +
          ISNULL(h.Toll_Fee, 0) +
          ISNULL(h.Beban_Sisa_Bahan_Exp, 0) +
          ISNULL(h.Biaya_Lain, 0)
        ) as Total_HPP_Actual
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
    
    // Filter out products with margin/rounded, then calculate HPP per unit
    const batches = actualBatches
      .filter(b => !excludedProductIds.has(b.Product_ID)) // Exclude margin/rounded products
      .map(b => {
      const hppActualPerUnit = b.Output_Actual > 0 ? b.Total_HPP_Actual / b.Output_Actual : 0;
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
        batchSizeStd: standardData.batchSize || b.Batch_Size_Std || 0,
        hppActualTotal: b.Total_HPP_Actual,
        hppActualPerUnit: hppActualPerUnit,
        hppStandardPerUnit: hppStandardPerUnit,
        hppStandardTotal: hppStandardPerUnit * b.Output_Actual,
        variancePercent: variancePercent,
        hna: b.HNA,
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

module.exports = {
  getLatestPeriode,
  getDashboardHPPData,
  getDashboardStats,
  getAvailableYears,
  getHPPActualVsStandard
};
