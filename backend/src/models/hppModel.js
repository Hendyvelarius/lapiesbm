const { connect } = require("../../config/sqlserver");
const sql = require("mssql");

async function getHPP(year = null) {
  try {
    const db = await connect();
    let query;
    let request = db.request();
    
    if (year) {
      query = `exec sp_COGS_HPP_List @year`;
      request = request.input('year', sql.VarChar(4), year);
    } else {
      query = `exec sp_COGS_HPP_List`;
    }
    
    const result = await request.query(query);

    // The stored procedure returns multiple result sets
    return {
      ethical: result.recordsets[0] || [],
      generik1: result.recordsets[1] || [],
      generik2: result.recordsets[2] || [],
    };
  } catch (error) {
    console.error("Error executing getHPP query:", error);
    throw error;
  }
}

// Generate HPP calculation using stored procedure
async function generateHPPCalculation(periode = "2025") {
  try {
    const db = await connect();
    // Generate for ALL product types: '0' and '1' is the hardcoded password to execute the procedure.
    const query = `exec sp_COGS_GenerateHPP @periode, '0', '1'`;

    await db.request().input("periode", sql.VarChar(4), periode).query(query);

    return {
      success: true,
      message: `HPP calculation completed for period ${periode}`,
    };
  } catch (error) {
    console.error("Error executing HPP calculation:", error);
    throw error;
  }
}

// Check if HPP data exists for a given year
async function checkHPPDataExists(year) {
  try {
    const db = await connect();
    let query;
    let request = db.request();
    
    if (year) {
      query = `exec sp_COGS_HPP_List @year`;
      request = request.input('year', sql.VarChar(4), year);
    } else {
      query = `exec sp_COGS_HPP_List`;
    }
    
    const result = await request.query(query);

    // Check if any recordset has data
    const hasData = result.recordsets.some(recordset => recordset && recordset.length > 0);
    
    return {
      hasData,
      totalRecords: result.recordsets.reduce((sum, recordset) => sum + (recordset ? recordset.length : 0), 0)
    };
  } catch (error) {
    console.error("Error checking HPP data existence:", error);
    throw error;
  }
}

// Generate HPP simulation for existing product with selected formulas
async function generateHPPSimulation(productId, formulaString) {
  try {
    const db = await connect();
    const query = `exec sp_generate_simulasi_cogs_product_existing @productId, @formulaString`;

    const result = await db
      .request()
      .input("productId", sql.VarChar(10), productId)
      .input("formulaString", sql.VarChar(50), formulaString)
      .query(query);

    // Return the first recordset from the stored procedure
    return result.recordset || [];
  } catch (error) {
    console.error("Error executing HPP simulation:", error);
    throw error;
  }
}

// Get simulation header details by Simulasi_ID
async function getSimulationHeader(simulasiId) {
  try {
    const db = await connect();
    const query = `SELECT * FROM t_COGS_HPP_Product_Header_Simulasi WHERE Simulasi_ID = @simulasiId`;

    const result = await db
      .request()
      .input("simulasiId", sql.VarChar(20), simulasiId)
      .query(query);

    return result.recordset || [];
  } catch (error) {
    console.error("Error fetching simulation header:", error);
    throw error;
  }
}

// Get simulation detail materials by Simulasi_ID
async function getSimulationDetailBahan(simulasiId) {
  try {
    const db = await connect();
    const query = `SELECT * FROM dbo.t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan WHERE Simulasi_ID = @simulasiId`;

    const result = await db
      .request()
      .input("simulasiId", sql.VarChar(20), simulasiId)
      .query(query);

    return result.recordset || [];
  } catch (error) {
    console.error("Error fetching simulation detail bahan:", error);
    throw error;
  }
}

// Update simulation header
async function updateSimulationHeader(simulasiId, headerData) {
  try {
    const db = await connect();

    const query = `
      UPDATE t_COGS_HPP_Product_Header_Simulasi 
      SET 
        Simulasi_Deskripsi = @SimulasiDeskripsi,
        Group_Rendemen = @GroupRendemen,
        Batch_Size = @BatchSize,
        LOB = @LOB,
        Versi = @Versi,
        MH_Proses_Std = @MHProsesStd,
        MH_Kemas_Std = @MHKemasStd,
        MH_Analisa_Std = @MHAnalisaStd,
        MH_Timbang_BB = @MHTimbangBB,
        MH_Timbang_BK = @MHTimbangBK,
        MH_Mesin_Std = @MHMesinStd,
        Biaya_Proses = @BiayaProses,
        Biaya_Kemas = @BiayaKemas,
        Biaya_Analisa = @BiayaAnalisa,
        Biaya_Generik = @BiayaGenerik,
        Biaya_Reagen = @BiayaReagen,
        Toll_Fee = @TollFee,
        Rate_PLN = @RatePLN,
        Direct_Labor = @DirectLabor,
        Factory_Over_Head = @FactoryOverHead,
        Depresiasi = @Depresiasi,
        Beban_Sisa_Bahan_Exp = @BebanSisaBahanExp
      WHERE Simulasi_ID = @SimulasiId
    `;

    const result = await db
      .request()
      .input("SimulasiId", sql.Int, simulasiId)
      .input(
        "SimulasiDeskripsi",
        sql.VarChar(255),
        headerData.Simulasi_Deskripsi || ""
      )
      .input(
        "GroupRendemen",
        sql.Decimal(10, 2),
        headerData.Group_Rendemen || 100
      )
      .input("BatchSize", sql.Int, headerData.Batch_Size || 1)
      .input("LOB", sql.VarChar(20), headerData.LOB || "ETHICAL")
      .input("Versi", sql.VarChar(10), headerData.Versi || "1")
      .input("MHProsesStd", sql.Decimal(10, 2), headerData.MH_Proses_Std || 0)
      .input("MHKemasStd", sql.Decimal(10, 2), headerData.MH_Kemas_Std || 0)
      .input("MHAnalisaStd", sql.Decimal(10, 2), headerData.MH_Analisa_Std || 0)
      .input("MHTimbangBB", sql.Decimal(10, 2), headerData.MH_Timbang_BB || 0)
      .input("MHTimbangBK", sql.Decimal(10, 2), headerData.MH_Timbang_BK || 0)
      .input("MHMesinStd", sql.Decimal(10, 2), headerData.MH_Mesin_Std || 0)
      .input("BiayaProses", sql.Decimal(18, 2), headerData.Biaya_Proses || 0)
      .input("BiayaKemas", sql.Decimal(18, 2), headerData.Biaya_Kemas || 0)
      .input("BiayaAnalisa", sql.Decimal(18, 2), headerData.Biaya_Analisa || 0)
      .input(
        "BiayaGenerik",
        sql.Decimal(18, 2),
        headerData.Biaya_Generik || null
      )
      .input("BiayaReagen", sql.Decimal(18, 2), headerData.Biaya_Reagen || null)
      .input("TollFee", sql.Decimal(18, 2), headerData.Toll_Fee || null)
      .input("RatePLN", sql.Decimal(18, 2), headerData.Rate_PLN || 0)
      .input("DirectLabor", sql.Decimal(18, 2), headerData.Direct_Labor || 0)
      .input(
        "FactoryOverHead",
        sql.Decimal(18, 2),
        headerData.Factory_Over_Head || 0
      )
      .input("Depresiasi", sql.Decimal(18, 2), headerData.Depresiasi || 0)
      .input(
        "BebanSisaBahanExp",
        sql.Decimal(18, 2),
        headerData.Beban_Sisa_Bahan_Exp || null
      )
      .query(query);

    return result.rowsAffected[0];
  } catch (error) {
    console.error("Error updating simulation header:", error);
    throw error;
  }
}

// Create new simulation header (for custom formulas)
async function createSimulationHeader(headerData) {
  try {
    const db = await connect();

    // First, get the next Simulasi_ID
    const maxIdQuery = `SELECT ISNULL(MAX(Simulasi_ID), 0) + 1 as NextId FROM t_COGS_HPP_Product_Header_Simulasi`;
    const maxIdResult = await db.request().query(maxIdQuery);
    const nextSimulasiId = maxIdResult.recordset[0].NextId;

    const query = `
      INSERT INTO t_COGS_HPP_Product_Header_Simulasi (
        Simulasi_ID, Product_ID, Product_Name, Formula, Group_PNCategory, Group_PNCategory_Dept, Periode,
        Simulasi_Deskripsi, Simulasi_Date, Simulasi_Type, Group_Rendemen, Batch_Size, LOB, Versi,
        MH_Proses_Std, MH_Kemas_Std, MH_Analisa_Std, MH_Timbang_BB, MH_Timbang_BK, MH_Mesin_Std,
        Biaya_Proses, Biaya_Kemas, Biaya_Analisa, Biaya_Generik, Biaya_Reagen, Toll_Fee, Rate_PLN,
        Direct_Labor, Factory_Over_Head, Depresiasi, Beban_Sisa_Bahan_Exp
      ) 
      VALUES (
        @SimulasiID, @ProductID, @ProductName, @Formula, @GroupPNCategory, @GroupPNCategoryDept, @Periode,
        @SimulasiDeskripsi, @SimulasiDate, @SimulasiType, @GroupRendemen, @BatchSize, @LOB, @Versi,
        @MHProsesStd, @MHKemasStd, @MHAnalisaStd, @MHTimbangBB, @MHTimbangBK, @MHMesinStd,
        @BiayaProses, @BiayaKemas, @BiayaAnalisa, @BiayaGenerik, @BiayaReagen, @TollFee, @RatePLN,
        @DirectLabor, @FactoryOverHead, @Depresiasi, @BebanSisaBahanExp
      )
    `;

    await db
      .request()
      .input("SimulasiID", sql.Int, nextSimulasiId)
      .input("ProductID", sql.VarChar(10), headerData.Product_ID || null)
      .input("ProductName", sql.VarChar(100), headerData.Product_Name || "")
      .input("Formula", sql.VarChar(100), headerData.Formula || "")
      .input(
        "GroupPNCategory",
        sql.VarChar(10),
        headerData.Group_PNCategory || null
      )
      .input(
        "GroupPNCategoryDept",
        sql.VarChar(50),
        headerData.Group_PNCategory_Dept || ""
      )
      .input("Periode", sql.VarChar(4), headerData.Periode || "2025")
      .input(
        "SimulasiDeskripsi",
        sql.VarChar(255),
        headerData.Simulasi_Deskripsi || ""
      )
      .input("SimulasiDate", sql.DateTime, new Date())
      .input("SimulasiType", sql.VarChar(50), "Product Custom")
      .input(
        "GroupRendemen",
        sql.Decimal(10, 2),
        headerData.Group_Rendemen || 100
      )
      .input("BatchSize", sql.Int, headerData.Batch_Size || 1)
      .input("LOB", sql.VarChar(20), headerData.LOB || "ETHICAL")
      .input("Versi", sql.VarChar(10), headerData.Versi || "1")
      .input("MHProsesStd", sql.Decimal(10, 2), headerData.MH_Proses_Std || 0)
      .input("MHKemasStd", sql.Decimal(10, 2), headerData.MH_Kemas_Std || 0)
      .input("MHAnalisaStd", sql.Decimal(10, 2), headerData.MH_Analisa_Std || 0)
      .input("MHTimbangBB", sql.Decimal(10, 2), headerData.MH_Timbang_BB || 0)
      .input("MHTimbangBK", sql.Decimal(10, 2), headerData.MH_Timbang_BK || 0)
      .input("MHMesinStd", sql.Decimal(10, 2), headerData.MH_Mesin_Std || 0)
      .input("BiayaProses", sql.Decimal(18, 2), headerData.Biaya_Proses || 0)
      .input("BiayaKemas", sql.Decimal(18, 2), headerData.Biaya_Kemas || 0)
      .input("BiayaAnalisa", sql.Decimal(18, 2), headerData.Biaya_Analisa || 0)
      .input(
        "BiayaGenerik",
        sql.Decimal(18, 2),
        headerData.Biaya_Generik || null
      )
      .input("BiayaReagen", sql.Decimal(18, 2), headerData.Biaya_Reagen || null)
      .input("TollFee", sql.Decimal(18, 2), headerData.Toll_Fee || null)
      .input("RatePLN", sql.Decimal(18, 2), headerData.Rate_PLN || 0)
      .input("DirectLabor", sql.Decimal(18, 2), headerData.Direct_Labor || 0)
      .input(
        "FactoryOverHead",
        sql.Decimal(18, 2),
        headerData.Factory_Over_Head || 0
      )
      .input("Depresiasi", sql.Decimal(18, 2), headerData.Depresiasi || 0)
      .input(
        "BebanSisaBahanExp",
        sql.Decimal(18, 2),
        headerData.Beban_Sisa_Bahan_Exp || null
      )
      .query(query);

    return nextSimulasiId;
  } catch (error) {
    console.error("Error creating simulation header:", error);
    throw error;
  }
}

// Delete all materials for a simulation
async function deleteSimulationMaterials(simulasiId) {
  try {
    const db = await connect();
    const query = `DELETE FROM t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan WHERE Simulasi_ID = @SimulasiId`;

    const result = await db
      .request()
      .input("SimulasiId", sql.Int, simulasiId)
      .query(query);

    return result.rowsAffected[0];
  } catch (error) {
    console.error("Error deleting simulation materials:", error);
    throw error;
  }
}

// Bulk insert materials for a simulation
async function insertSimulationMaterials(
  simulasiId,
  materials,
  periode = "2025"
) {
  try {
    const db = await connect();

    if (!materials || materials.length === 0) {
      return 0;
    }

    // Use parameterized queries to prevent SQL injection
    const insertPromises = materials.map((material, index) => {
      return db
        .request()
        .input("periode", sql.VarChar(4), periode)
        .input("simulasiId", sql.Int, simulasiId)
        .input("seqId", sql.Int, index + 1)
        .input("tipeBahan", sql.VarChar(10), material.Tipe_Bahan)
        .input("itemId", sql.VarChar(20), material.Item_ID)
        .input("itemName", sql.VarChar(255), material.Item_Name)
        .input("itemQty", sql.Decimal(18, 4), material.Item_QTY)
        .input("itemUnit", sql.VarChar(10), material.Item_Unit)
        .input("itemUnitPrice", sql.Decimal(18, 4), material.Item_Unit_Price)
        .query(`
          INSERT INTO t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan 
          (Periode, Simulasi_ID, Seq_ID, Tipe_Bahan, Item_ID, Item_Name, Item_QTY, Item_Unit, Item_Unit_Price) 
          VALUES (@periode, @simulasiId, @seqId, @tipeBahan, @itemId, @itemName, @itemQty, @itemUnit, @itemUnitPrice)
        `);
    });

    // Execute all insert operations
    await Promise.all(insertPromises);

    return materials.length;
  } catch (error) {
    console.error("Error inserting simulation materials:", error);
    throw error;
  }
}

// Get all simulation records from header table
async function getSimulationList() {
  try {
    const db = await connect();
    const query = `
      SELECT *
      FROM t_COGS_HPP_Product_Header_Simulasi 
    `;

    const result = await db.request().query(query);
    return result.recordset;
  } catch (error) {
    console.error("Error executing getSimulationList query:", error);
    throw error;
  }
}

// Delete simulation record and its related materials
async function deleteSimulation(simulasiId) {
  try {
    const db = await connect();

    // First delete related materials
    const deleteMaterialsQuery = `DELETE FROM t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan WHERE Simulasi_ID = @SimulasiId`;
    const materialsResult = await db
      .request()
      .input("SimulasiId", sql.Int, simulasiId)
      .query(deleteMaterialsQuery);

    // Then delete the header
    const deleteHeaderQuery = `DELETE FROM t_COGS_HPP_Product_Header_Simulasi WHERE Simulasi_ID = @SimulasiId`;
    const headerResult = await db
      .request()
      .input("SimulasiId", sql.Int, simulasiId)
      .query(deleteHeaderQuery);

    return {
      materialsDeleted: materialsResult.rowsAffected[0] || 0,
      headerDeleted: headerResult.rowsAffected[0] || 0,
    };
  } catch (error) {
    console.error("Error executing deleteSimulation query:", error);
    throw error;
  }
}

// Generate price change simulation using stored procedure
async function generatePriceChangeSimulation(parameterString) {
  try {
    const db = await connect();

    const directQuery = `exec sp_generate_simulasi_cogs_price_changes '${parameterString}'`;
    const result = await db.request().query(directQuery);

    return {
      recordsets: result.recordsets,
      rowsAffected: result.rowsAffected,
      returnValue: result.returnValue,
    };
  } catch (error) {
    console.error("Error in generatePriceChangeSimulation:", error.message);
    throw error;
  }
}

// Generate price update simulation (with Periode parameter)
async function generatePriceUpdateSimulation(parameterString, periode) {
  try {
    const db = await connect();

    const directQuery = `exec sp_generate_simulasi_cogs_price_update '${parameterString}', '${periode}'`;
    const result = await db.request().query(directQuery);

    return {
      recordsets: result.recordsets,
      rowsAffected: result.rowsAffected,
      returnValue: result.returnValue,
    };
  } catch (error) {
    console.error("Error in generatePriceUpdateSimulation:", error.message);
    throw error;
  }
}

// Get affected products for price change simulation
async function getPriceChangeAffectedProducts(description, formattedDate) {
  try {
    const db = await connect();
    
    // First, get the list of selected Simulasi_IDs (Versi = '1')
    const selectedIdsQuery = `
      SELECT Simulasi_ID, Product_ID
      FROM t_COGS_HPP_Product_Header_Simulasi 
      WHERE Simulasi_Deskripsi = @Description 
      AND CONVERT(varchar, Simulasi_Date, 121) = @FormattedDate
      AND Simulasi_Type = 'Price Changes'
      AND Versi = '1'
    `;
    
    const selectedIds = await db
      .request()
      .input('Description', sql.VarChar(255), description)
      .input('FormattedDate', sql.VarChar(50), formattedDate)
      .query(selectedIdsQuery);
    
    const selectedProductIds = new Set(selectedIds.recordset.map(r => r.Product_ID));
    
    // Execute the stored procedure
    const query = `EXEC [sp_COGS_HPP_List_Simulasi_PriceChange] @Description, @FormattedDate`;
    
    const result = await db
      .request()
      .input('Description', sql.VarChar(255), description)
      .input('FormattedDate', sql.VarChar(50), formattedDate)
      .query(query);

    // Filter results to only include selected products (Versi = '1')
    // If no products have Versi = '1', return all (for backwards compatibility)
    let filteredResults = result.recordset || [];
    if (selectedProductIds.size > 0) {
      filteredResults = filteredResults.filter(record => selectedProductIds.has(record.Product_ID));
    }

    return filteredResults;

  } catch (error) {
    console.error('Error in getPriceChangeAffectedProducts:', error.message);
    throw error;
  }
}

// Get affected products for price update simulation (uses Simulasi_Date just like Price Change)
async function getPriceUpdateAffectedProducts(description, formattedDate) {
  try {
    const db = await connect();
    
    // First, get the list of selected products (Versi = '1')
    const selectedProductsQuery = `
      SELECT DISTINCT Product_ID 
      FROM t_COGS_HPP_Product_Header_Simulasi 
      WHERE Simulasi_Deskripsi = @Description 
      AND CONVERT(varchar, Simulasi_Date, 121) = @FormattedDate
      AND Simulasi_Type = 'Price Update'
      AND Versi = '1'
    `;
    
    const selectedProductsResult = await db
      .request()
      .input('Description', sql.VarChar(255), description)
      .input('FormattedDate', sql.VarChar(50), formattedDate)
      .query(selectedProductsQuery);
    
    const selectedProductIds = new Set(
      selectedProductsResult.recordset.map(row => row.Product_ID)
    );
    
    // Execute the stored procedure - same pattern as Price Change
    const query = `EXEC [sp_COGS_HPP_List_Simulasi_PriceUpdate] @Description, @FormattedDate`;
    
    const result = await db
      .request()
      .input('Description', sql.VarChar(255), description)
      .input('FormattedDate', sql.VarChar(50), formattedDate)
      .query(query);

    // Filter to only include selected products (Versi = '1')
    // If no products are explicitly selected (all have default Versi), return all
    let filteredResults = result.recordset || [];
    if (selectedProductIds.size > 0) {
      filteredResults = filteredResults.filter(record => 
        selectedProductIds.has(record.Product_ID)
      );
    }

    return filteredResults;

  } catch (error) {
    console.error('Error in getPriceUpdateAffectedProducts:', error.message);
    throw error;
  }
}

// Bulk delete price change group (all simulations with matching description and date)
async function bulkDeletePriceChangeGroup(description, formattedDate) {
  try {
    const db = await connect();
    
    // First, get the Simulasi_IDs that will be deleted (for deleting detail records)
    const getIdsQuery = `
      SELECT Simulasi_ID 
      FROM t_COGS_HPP_Product_Header_Simulasi 
      WHERE Simulasi_Deskripsi = @Description 
      AND CONVERT(varchar, Simulasi_Date, 121) = @FormattedDate
      AND Simulasi_Type = 'Price Changes'
    `;

    const simulasiIds = await db
      .request()
      .input('Description', sql.VarChar(255), description)
      .input('FormattedDate', sql.VarChar(50), formattedDate)
      .query(getIdsQuery);

    // Delete detail records first (to maintain referential integrity)
    if (simulasiIds.recordset.length > 0) {
      const idList = simulasiIds.recordset.map(r => r.Simulasi_ID).join(',');
      const deleteDetailsQuery = `DELETE FROM t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan WHERE Simulasi_ID IN (${idList})`;
      await db.request().query(deleteDetailsQuery);
    }

    // Then delete header records
    const deleteHeaderQuery = `
      DELETE FROM t_COGS_HPP_Product_Header_Simulasi 
      WHERE Simulasi_Deskripsi = @Description 
      AND CONVERT(varchar, Simulasi_Date, 121) = @FormattedDate
      AND Simulasi_Type = 'Price Changes'
    `;

    const result = await db
      .request()
      .input('Description', sql.VarChar(255), description)
      .input('FormattedDate', sql.VarChar(50), formattedDate)
      .query(deleteHeaderQuery);

    return {
      deletedCount: result.rowsAffected?.[0] || 0,
      success: true
    };

  } catch (error) {
    console.error('Error in bulkDeletePriceChangeGroup:', error.message);
    throw error;
  }
}

// Get simulation summary with HNA data using stored procedure
async function getSimulationSummary(simulasiId) {
  try {
    const db = await connect();
    
    // Execute the stored procedure
    const query = `EXEC [sp_COGS_HPP_List_Simulasi] @SimulasiId`;
    
    const result = await db
      .request()
      .input('SimulasiId', sql.VarChar(20), simulasiId)
      .query(query);

    return result.recordset || [];

  } catch (error) {
    console.error('Error in getSimulationSummary:', error.message);
    throw error;
  }
}

// Clone simulation (duplicate all data)
async function cloneSimulation(originalSimulasiId, cloneDescription) {
  try {
    const db = await connect();
    
    // Start a transaction
    const transaction = new sql.Transaction(db);
    await transaction.begin();
    
    try {
      // Get the next Simulasi_ID
      const maxIdQuery = `SELECT ISNULL(MAX(Simulasi_ID), 0) + 1 as NextId FROM t_COGS_HPP_Product_Header_Simulasi`;
      const maxIdResult = await transaction.request().query(maxIdQuery);
      const newSimulasiId = maxIdResult.recordset[0].NextId;
      
      // Clone the header - copy ALL columns except Simulasi_ID and update description and date
      const cloneHeaderQuery = `
        INSERT INTO t_COGS_HPP_Product_Header_Simulasi (
          Simulasi_ID, Product_ID, Product_Name, Formula, Group_PNCategory, Group_PNCategory_Dept, Periode,
          Simulasi_Deskripsi, Simulasi_Date, Simulasi_Type, Group_Rendemen, Batch_Size, LOB, Versi,
          MH_Proses_Std, MH_Kemas_Std, MH_Analisa_Std, MH_Timbang_BB, MH_Timbang_BK, MH_Mesin_Std,
          Biaya_Proses, Biaya_Kemas, Biaya_Analisa, Biaya_Generik, Biaya_Reagen, Toll_Fee, Rate_PLN,
          Direct_Labor, Factory_Over_Head, Depresiasi, Beban_Sisa_Bahan_Exp
        )
        SELECT 
          @NewSimulasiId, Product_ID, Product_Name, Formula, Group_PNCategory, Group_PNCategory_Dept, Periode,
          @CloneDescription, GETDATE(), Simulasi_Type, Group_Rendemen, Batch_Size, LOB, Versi,
          MH_Proses_Std, MH_Kemas_Std, MH_Analisa_Std, MH_Timbang_BB, MH_Timbang_BK, MH_Mesin_Std,
          Biaya_Proses, Biaya_Kemas, Biaya_Analisa, Biaya_Generik, Biaya_Reagen, Toll_Fee, Rate_PLN,
          Direct_Labor, Factory_Over_Head, Depresiasi, Beban_Sisa_Bahan_Exp
        FROM t_COGS_HPP_Product_Header_Simulasi 
        WHERE Simulasi_ID = @OriginalSimulasiId
      `;
      
      // Generate clone description if not provided
      const finalCloneDescription = cloneDescription || `Clone of Simulasi_ID ${originalSimulasiId}`;
      
      await transaction.request()
        .input('NewSimulasiId', sql.Int, newSimulasiId)
        .input('OriginalSimulasiId', sql.Int, originalSimulasiId)
        .input('CloneDescription', sql.VarChar(255), finalCloneDescription)
        .query(cloneHeaderQuery);
      
      // Clone the materials - copy ALL columns except change Simulasi_ID and generate new Seq_ID
      const cloneMaterialsQuery = `
        INSERT INTO t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan (
          Periode, Simulasi_ID, Seq_ID, Tipe_Bahan, Item_ID, Item_Name, Item_QTY, Item_Unit, Item_Unit_Price
        )
        SELECT 
          Periode, @NewSimulasiId, ROW_NUMBER() OVER (ORDER BY Seq_ID), Tipe_Bahan, Item_ID, Item_Name, Item_QTY, Item_Unit, Item_Unit_Price
        FROM t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan 
        WHERE Simulasi_ID = @OriginalSimulasiId
        ORDER BY Seq_ID
      `;
      
      await transaction.request()
        .input('NewSimulasiId', sql.Int, newSimulasiId)
        .input('OriginalSimulasiId', sql.Int, originalSimulasiId)
        .query(cloneMaterialsQuery);
      
      // Commit the transaction
      await transaction.commit();
      
      return newSimulasiId;
      
    } catch (error) {
      // Rollback the transaction on error
      await transaction.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error("Error cloning simulation:", error);
    throw error;
  }
}

// Commit price update - execute sp_generate_simulasi_cogs_price_update_commit
async function commitPriceUpdate(parameterString, periode) {
  try {
    const db = await connect();

    const directQuery = `exec sp_generate_simulasi_cogs_price_update_commit '${parameterString}', '${periode}'`;
    const result = await db.request().query(directQuery);

    return {
      success: true,
      recordsets: result.recordsets,
      rowsAffected: result.rowsAffected,
      returnValue: result.returnValue,
    };
  } catch (error) {
    console.error("Error in commitPriceUpdate:", error.message);
    throw error;
  }
}

// Get all simulations in a price change group for product selection
async function getSimulationsForPriceChangeGroup(description, formattedDate, simulationType = 'Price Changes') {
  try {
    const db = await connect();
    
    const query = `
      SELECT 
        Simulasi_ID,
        Product_ID,
        Product_Name,
        Versi,
        Simulasi_Type
      FROM t_COGS_HPP_Product_Header_Simulasi 
      WHERE Simulasi_Deskripsi = @Description 
      AND CONVERT(varchar, Simulasi_Date, 121) = @FormattedDate
      AND Simulasi_Type = @SimulationType
      ORDER BY Product_Name
    `;

    const result = await db
      .request()
      .input('Description', sql.VarChar(255), description)
      .input('FormattedDate', sql.VarChar(50), formattedDate)
      .input('SimulationType', sql.VarChar(50), simulationType)
      .query(query);

    console.log('Records found:', result.recordset?.length || 0);

    return result.recordset || [];

  } catch (error) {
    console.error('=== getSimulationsForPriceChangeGroup Error ===');
    console.error('Error message:', error.message);
    throw error;
  }
}

// Bulk update Versi field for multiple simulations
async function updateSimulationVersionBulk(simulationVersions) {
  try {
    console.log('=== updateSimulationVersionBulk ===');
    console.log('Updates to apply:', simulationVersions.length);

    const db = await connect();
    
    // Build and execute individual updates for each simulation
    let updatedCount = 0;
    
    for (const item of simulationVersions) {
      const query = `
        UPDATE t_COGS_HPP_Product_Header_Simulasi 
        SET Versi = @Versi
        WHERE Simulasi_ID = @SimulasiId
      `;
      
      await db
        .request()
        .input('Versi', sql.VarChar(10), item.versi)
        .input('SimulasiId', sql.Int, item.simulasiId)
        .query(query);
      
      updatedCount++;
    }

    console.log('Successfully updated:', updatedCount, 'simulations');

    return {
      success: true,
      updatedCount
    };

  } catch (error) {
    console.error('=== updateSimulationVersionBulk Error ===');
    console.error('Error message:', error.message);
    throw error;
  }
}

module.exports = {
  getHPP,
  generateHPPCalculation,
  generateHPPSimulation,
  getSimulationHeader,
  getSimulationDetailBahan,
  createSimulationHeader,
  updateSimulationHeader,
  deleteSimulationMaterials,
  insertSimulationMaterials,
  getSimulationList,
  deleteSimulation,
  cloneSimulation,
  generatePriceChangeSimulation,
  generatePriceUpdateSimulation,
  getPriceChangeAffectedProducts,
  getPriceUpdateAffectedProducts,
  bulkDeletePriceChangeGroup,
  getSimulationSummary,
  checkHPPDataExists,
  commitPriceUpdate,
  getSimulationsForPriceChangeGroup,
  updateSimulationVersionBulk,
};
