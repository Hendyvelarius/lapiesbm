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
 */
async function getDashboardHPPData(year = null) {
  try {
    const db = await connect();
    const periode = year || await getLatestPeriode();
    
    const request = db.request().input('year', sql.VarChar(4), periode);
    const result = await request.query(`exec sp_COGS_HPP_List @year`);

    // The stored procedure returns three recordsets: ethical, generik1, generik2
    const ethical = result.recordsets[0] || [];
    const generik1 = result.recordsets[1] || [];
    const generik2 = result.recordsets[2] || [];

    // Combine all products with category info
    const allProducts = [
      ...ethical.map(p => ({ ...p, category: 'ETHICAL' })),
      ...generik1.map(p => ({ ...p, category: 'GENERIK' })),
      ...generik2.map(p => ({ ...p, category: 'GENERIK' }))
    ];

    // Separate OTC from ETHICAL based on LOB field
    const categorizedProducts = allProducts.map(p => {
      // Determine actual category based on LOB field
      let actualCategory = p.category;
      if (p.LOB) {
        const lob = p.LOB.toUpperCase();
        if (lob === 'OTC') actualCategory = 'OTC';
        else if (lob === 'ETHICAL') actualCategory = 'ETHICAL';
        else if (lob.includes('GENERIC') || lob.includes('GENERIK')) actualCategory = 'GENERIK';
      }
      return { ...p, actualCategory };
    });

    return {
      periode,
      products: categorizedProducts,
      rawData: { ethical, generik1, generik2 }
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
    const { periode, products, rawData } = await getDashboardHPPData(year);

    // Count products by category
    const ethicalCount = products.filter(p => p.actualCategory === 'ETHICAL').length;
    const otcCount = products.filter(p => p.actualCategory === 'OTC').length;
    const generikCount = products.filter(p => p.actualCategory === 'GENERIK').length;
    const totalProducts = products.length;

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
    const calculateAvgCOGS = (category) => {
      const categoryProducts = validProducts.filter(p => p.actualCategory === category);
      if (categoryProducts.length === 0) return 0;
      const totalCOGS = categoryProducts.reduce((sum, p) => {
        return sum + ((parseFloat(p.HPP) / parseFloat(p.Product_SalesHNA)) * 100);
      }, 0);
      return totalCOGS / categoryProducts.length;
    };

    const avgCOGSEthical = calculateAvgCOGS('ETHICAL');
    const avgCOGSOTC = calculateAvgCOGS('OTC');
    const avgCOGSGenerik = calculateAvgCOGS('GENERIK');

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
    const calculateCategoryStats = (category) => {
      const categoryProducts = category === 'ALL' 
        ? validProducts 
        : validProducts.filter(p => p.actualCategory === category);
      
      const count = categoryProducts.length;
      const highCOGS = categoryProducts.filter(p => {
        const cogs = (parseFloat(p.HPP) / parseFloat(p.Product_SalesHNA)) * 100;
        return cogs >= 30;
      }).length;
      const lowCOGS = count - highCOGS;
      
      return { count, highCOGS, lowCOGS };
    };

    // Cost distribution by category
    const costDistributionAll = calculateCostDistribution(products);
    const costDistributionEthical = calculateCostDistribution(products.filter(p => p.actualCategory === 'ETHICAL'));
    const costDistributionOTC = calculateCostDistribution(products.filter(p => p.actualCategory === 'OTC'));
    const costDistributionGenerik = calculateCostDistribution(products.filter(p => p.actualCategory === 'GENERIK'));

    // HPP info cards by category
    const hppStatsAll = calculateCategoryStats('ALL');
    const hppStatsEthical = calculateCategoryStats('ETHICAL');
    const hppStatsOTC = calculateCategoryStats('OTC');
    const hppStatsGenerik = calculateCategoryStats('GENERIK');

    return {
      periode,
      productCounts: {
        total: totalProducts,
        ethical: ethicalCount,
        otc: otcCount,
        generik: generikCount
      },
      costManagement: {
        totalHPP,
        totalHNA,
        overallCOGS: overallCOGS.toFixed(2),
        productsWithData: validProducts.length
      },
      pricingRiskIndicator: {
        ethical: avgCOGSEthical.toFixed(2),
        otc: avgCOGSOTC.toFixed(2),
        generik: avgCOGSGenerik.toFixed(2)
      },
      costDistribution: {
        all: costDistributionAll,
        ethical: costDistributionEthical,
        otc: costDistributionOTC,
        generik: costDistributionGenerik
      },
      hppStats: {
        all: hppStatsAll,
        ethical: hppStatsEthical,
        otc: hppStatsOTC,
        generik: hppStatsGenerik
      },
      // Include raw products for detailed view with full cost breakdown
      products: validProducts.map(p => {
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
