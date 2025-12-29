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
    const categorizedProducts = allProducts.map(p => {
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

    // Count products by toll category directly from HPP list data
    const tollCounts = {
      tollIn: categorizedProducts.filter(p => p.tollCategory === 'Toll In').length,
      tollOut: categorizedProducts.filter(p => p.tollCategory === 'Toll Out').length,
      import: categorizedProducts.filter(p => p.tollCategory === 'Import').length,
      lapi: categorizedProducts.filter(p => p.tollCategory === 'Lapi').length
    };

    // Debug: Log unique Category values to verify format
    const uniqueCategories = [...new Set(allProducts.map(p => p.Category))];
    console.log(`Dashboard HPP data for periode ${periode}: ${categorizedProducts.length} products (ethical: ${ethical.length}, generik1: ${generik1.length})`);
    console.log(`Unique Category values from HPP List:`, uniqueCategories);
    console.log(`Category counts:`, tollCounts);

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

    // Toll counts come from the authoritative view (vw_COGS_Pembebanan_TollFee)
    // These counts represent ALL products in each toll category, not just those with HPP
    const { tollIn: tollInCount, tollOut: tollOutCount, import: importCount, lapi: lapiCount } = tollCounts;

    // Calculate Cost Management (COGS) statistics
    // COGS = (Total HPP / HNA) * 100
    const validProducts = products.filter(p => 
      p.HPP && p.Product_SalesHNA && p.Product_SalesHNA > 0
    );

    const totalHPP = validProducts.reduce((sum, p) => sum + (parseFloat(p.HPP) || 0), 0);
    const totalHNA = validProducts.reduce((sum, p) => sum + (parseFloat(p.Product_SalesHNA) || 0), 0);
    const overallCOGS = totalHNA > 0 ? (totalHPP / totalHNA) * 100 : 0;

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

    // Toll category averages
    const avgCOGSTollIn = calculateAvgCOGS('Toll In', true);
    const avgCOGSTollOut = calculateAvgCOGS('Toll Out', true);
    const avgCOGSImport = calculateAvgCOGS('Import', true);
    const avgCOGSLapi = calculateAvgCOGS('Lapi', true);

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
        let marginCost = 0;
        if (p.margin && parseFloat(p.margin) > 0) {
          const marginPercent = parseFloat(p.margin);
          const subtotal = bb + bk + biayaProses + biayaKemas + expiryCost;
          marginCost = subtotal * marginPercent;
        } else if (p.toll_fee && parseFloat(p.toll_fee) > 0) {
          marginCost = parseFloat(p.toll_fee) || 0;
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
    
    // Cost distribution by Toll category
    const costDistributionTollIn = calculateCostDistribution(products.filter(p => p.tollCategory === 'Toll In'));
    const costDistributionTollOut = calculateCostDistribution(products.filter(p => p.tollCategory === 'Toll Out'));
    const costDistributionImport = calculateCostDistribution(products.filter(p => p.tollCategory === 'Import'));
    const costDistributionLapi = calculateCostDistribution(products.filter(p => p.tollCategory === 'Lapi'));

    // HPP info cards by LOB category
    const hppStatsAll = calculateCategoryStats('ALL');
    const hppStatsEthical = calculateCategoryStats('ETHICAL');
    const hppStatsOTC = calculateCategoryStats('OTC');
    const hppStatsGenerik = calculateCategoryStats('GENERIK');
    
    // HPP info cards by Toll category
    const hppStatsTollIn = calculateCategoryStats('Toll In', true);
    const hppStatsTollOut = calculateCategoryStats('Toll Out', true);
    const hppStatsImport = calculateCategoryStats('Import', true);
    const hppStatsLapi = calculateCategoryStats('Lapi', true);

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

    const heatMap = {
      lapi: {
        ethical: calculateHeatMapCell('ETHICAL', 'Lapi'),
        otc: calculateHeatMapCell('OTC', 'Lapi'),
        generik: calculateHeatMapCell('GENERIK', 'Lapi')
      },
      import: {
        ethical: calculateHeatMapCell('ETHICAL', 'Import'),
        otc: calculateHeatMapCell('OTC', 'Import'),
        generik: calculateHeatMapCell('GENERIK', 'Import')
      },
      tollIn: {
        ethical: calculateHeatMapCell('ETHICAL', 'Toll In'),
        otc: calculateHeatMapCell('OTC', 'Toll In'),
        generik: calculateHeatMapCell('GENERIK', 'Toll In')
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
        // Toll category counts
        tollIn: tollInCount,
        tollOut: tollOutCount,
        import: importCount,
        lapi: lapiCount
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
        // Toll categories
        tollIn: avgCOGSTollIn.toFixed(2),
        tollOut: avgCOGSTollOut.toFixed(2),
        import: avgCOGSImport.toFixed(2),
        lapi: avgCOGSLapi.toFixed(2)
      },
      costDistribution: {
        // LOB categories
        all: costDistributionAll,
        ethical: costDistributionEthical,
        otc: costDistributionOTC,
        generik: costDistributionGenerik,
        // Toll categories
        tollIn: costDistributionTollIn,
        tollOut: costDistributionTollOut,
        import: costDistributionImport,
        lapi: costDistributionLapi
      },
      hppStats: {
        // LOB categories
        all: hppStatsAll,
        ethical: hppStatsEthical,
        otc: hppStatsOTC,
        generik: hppStatsGenerik,
        // Toll categories
        tollIn: hppStatsTollIn,
        tollOut: hppStatsTollOut,
        import: hppStatsImport,
        lapi: hppStatsLapi
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
        
        let marginCost = 0;
        if (p.margin && parseFloat(p.margin) > 0) {
          const marginPercent = parseFloat(p.margin);
          const subtotal = bb + bk + biayaProses + biayaKemas + expiryCost;
          marginCost = subtotal * marginPercent;
        } else if (p.toll_fee && parseFloat(p.toll_fee) > 0) {
          marginCost = parseFloat(p.toll_fee) || 0;
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
          tollCategory: p.tollCategory,
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

module.exports = {
  getLatestPeriode,
  getDashboardHPPData,
  getDashboardStats,
  getAvailableYears
};
