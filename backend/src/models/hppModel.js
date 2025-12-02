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
    console.log("=== Price Change Simulation Debug ===");
    console.log("Parameter string:", parameterString);

    const db = await connect();

    // First, let's check the connection context and settings
    const contextResult = await db.request().query(`
      SELECT 
        DB_NAME() as current_database,
        SYSTEM_USER as [current_user],
        @@SPID as session_id,
        @@TRANCOUNT as transaction_count
    `);
    console.log("Connection context:", contextResult.recordset[0]);

    // Check if the material exists
    const materialId = parameterString.split(":")[0];
    const newPrice = parameterString.split(":")[1];

    const materialCheck = await db.request().query(`
      SELECT 
        h.ITEM_ID,
        m.Item_Name,
        h.ITEM_PURCHASE_STD_PRICE,
        h.ITEM_CURRENCY,
        h.ITEM_PURCHASE_UNIT,
        m.Item_Unit,
        dbo.fnConvertBJ(h.ITEM_ID, 1, h.ITEM_PURCHASE_UNIT, m.Item_Unit) as conversion_factor,
        dbo.fnConvertBJ(h.ITEM_ID, 1, h.ITEM_PURCHASE_UNIT, m.Item_Unit) * h.ITEM_PURCHASE_STD_PRICE as calculated_unit_price
      FROM M_COGS_STD_HRG_BAHAN h
      INNER JOIN m_item_Manufacturing m ON h.ITEM_ID = m.Item_ID
      WHERE h.ITEM_ID = '${materialId}'
    `);
    console.log("Material exists:", materialCheck.recordset);
    console.log("New price to set:", newPrice);

    // Check if we have valid unit conversion data
    if (materialCheck.recordset.length > 0) {
      const material = materialCheck.recordset[0];
      console.log("=== Material Unit Conversion Analysis ===");
      console.log("Purchase Unit:", material.ITEM_PURCHASE_UNIT);
      console.log("Manufacturing Unit:", material.Item_Unit);
      console.log("Conversion Factor:", material.conversion_factor);
      console.log(
        "Current Calculated Unit Price:",
        material.calculated_unit_price
      );
      console.log("New Price (raw):", newPrice);
      console.log(
        "Expected New Unit Price:",
        parseFloat(newPrice) * (material.conversion_factor || 1)
      );
    }

    // Now try the stored procedure
    console.log("Executing stored procedure...");

    // Try different parameter formats - the stored procedure might expect different input
    console.log("=== Testing Different Parameter Formats ===");

    // Option 1: Original format
    const directQuery = `exec sp_generate_simulasi_cogs_price_changes '${parameterString}'`;
    console.log("SQL:", directQuery);

    const result = await db.request().query(directQuery);

    console.log("SUCCESS! Stored procedure executed");
    console.log("Recordsets:", result.recordsets?.length || 0);
    console.log("Rows affected:", result.rowsAffected);

    return {
      recordsets: result.recordsets,
      rowsAffected: result.rowsAffected,
      returnValue: result.returnValue,
    };
  } catch (error) {
    console.error("=== Stored Procedure Error Details ===");
    console.error("Error message:", error.message);
    console.error("Error number:", error.number);
    console.error("Line number:", error.lineNumber);
    console.error("Procedure name:", error.procName);

    // The error suggests the SP is trying to insert NULL into Item_Unit_Price
    // Let's provide more context about what this means
    console.error("=== Analysis ===");
    console.error(
      "The stored procedure is trying to insert NULL values into Item_Unit_Price column."
    );
    console.error("This suggests either:");
    console.error(
      "1. The parameter format is not being parsed correctly by the SP"
    );
    console.error("2. The SP has a bug in how it processes the parameter");
    console.error("3. There are missing required parameters or context");
    console.error("Parameter we sent:", parameterString);
    console.error('Expected format: materialId:newPrice (e.g., "IN 009:25")');

    throw error;
  }
}

// Generate price update simulation (with Periode parameter)
async function generatePriceUpdateSimulation(parameterString, periode) {
  try {
    console.log("=== Price Update Simulation Debug ===");
    console.log("Parameter string:", parameterString);
    console.log("Periode:", periode);

    const db = await connect();

    // Execute the stored procedure with periode parameter
    const directQuery = `exec sp_generate_simulasi_cogs_price_update '${parameterString}', '${periode}'`;
    console.log("SQL:", directQuery);

    const result = await db.request().query(directQuery);

    console.log("SUCCESS! Stored procedure executed");
    console.log("Recordsets:", result.recordsets?.length || 0);
    console.log("Rows affected:", result.rowsAffected);

    return {
      recordsets: result.recordsets,
      rowsAffected: result.rowsAffected,
      returnValue: result.returnValue,
    };
  } catch (error) {
    console.error("=== Stored Procedure Error Details ===");
    console.error("Error message:", error.message);
    console.error("Error number:", error.number);
    console.error("Line number:", error.lineNumber);
    console.error("Procedure name:", error.procName);
    console.error("Parameter we sent:", parameterString);
    console.error("Periode:", periode);
    console.error('Expected format: materialId:newPrice#materialId2:newPrice2, YYYY');

    throw error;
  }
}

// Get affected products for price change simulation
async function getPriceChangeAffectedProducts(description, formattedDate) {
  try {
    console.log('=== Executing getPriceChangeAffectedProducts ===');
    console.log('Description:', description);
    console.log('Formatted Date:', formattedDate);

    const db = await connect();
    
    // Execute the stored procedure
    const query = `EXEC [sp_COGS_HPP_List_Simulasi_PriceChange] @Description, @FormattedDate`;
    
    const result = await db
      .request()
      .input('Description', sql.VarChar(255), description)
      .input('FormattedDate', sql.VarChar(50), formattedDate)
      .query(query);

    console.log('=== Stored Procedure Result ===');
    console.log('Records returned:', result.recordset?.length || 0);
    if (result.recordset?.length > 0) {
      console.log('Sample record:', JSON.stringify(result.recordset[0], null, 2));
    }

    return result.recordset || [];

  } catch (error) {
    console.error('=== getPriceChangeAffectedProducts Error ===');
    console.error('Error message:', error.message);
    console.error('Error number:', error.number);
    console.error('Line number:', error.lineNumber);
    console.error('Procedure name:', error.procName);
    console.error('Parameters sent:');
    console.error('- Description:', description);
    console.error('- FormattedDate:', formattedDate);
    
    throw error;
  }
}

// Get affected products for price update simulation (uses Simulasi_Date just like Price Change)
async function getPriceUpdateAffectedProducts(description, formattedDate) {
  try {
    console.log('=== Executing getPriceUpdateAffectedProducts ===');
    console.log('Description:', description);
    console.log('Formatted Date:', formattedDate);

    const db = await connect();
    
    // Execute the stored procedure - same pattern as Price Change
    const query = `EXEC [sp_COGS_HPP_List_Simulasi_PriceUpdate] @Description, @FormattedDate`;
    
    const result = await db
      .request()
      .input('Description', sql.VarChar(255), description)
      .input('FormattedDate', sql.VarChar(50), formattedDate)
      .query(query);

    console.log('=== Stored Procedure Result ===');
    console.log('Records returned:', result.recordset?.length || 0);
    if (result.recordset?.length > 0) {
      console.log('Sample record:', JSON.stringify(result.recordset[0], null, 2));
    }

    return result.recordset || [];

  } catch (error) {
    console.error('=== getPriceUpdateAffectedProducts Error ===');
    console.error('Error message:', error.message);
    console.error('Error number:', error.number);
    console.error('Line number:', error.lineNumber);
    console.error('Procedure name:', error.procName);
    console.error('Parameters sent:');
    console.error('- Description:', description);
    console.error('- FormattedDate:', formattedDate);
    
    throw error;
  }
}

// Bulk delete price change group (all simulations with matching description and date)
async function bulkDeletePriceChangeGroup(description, formattedDate) {
  try {
    console.log('=== bulkDeletePriceChangeGroup Model Function ===');
    console.log('Parameters received:');
    console.log('- Description:', description);
    console.log('- FormattedDate:', formattedDate);

    const db = await connect();
    
    // First, get the Simulasi_IDs that will be deleted (for deleting detail records)
    const getIdsQuery = `
      SELECT Simulasi_ID 
      FROM t_COGS_HPP_Product_Header_Simulasi 
      WHERE Simulasi_Deskripsi = @Description 
      AND CONVERT(varchar, Simulasi_Date, 121) = @FormattedDate
      AND Simulasi_Type = 'Price Changes'
    `;

    console.log('=== Getting Simulasi_IDs ===');
    console.log('Query:', getIdsQuery.replace(/\s+/g, ' ').trim());

    const simulasiIds = await db
      .request()
      .input('Description', sql.VarChar(255), description)
      .input('FormattedDate', sql.VarChar(50), formattedDate)
      .query(getIdsQuery);

    console.log('Found Simulasi_IDs to delete:', simulasiIds.recordset.map(r => r.Simulasi_ID));

    // Delete detail records first (to maintain referential integrity)
    if (simulasiIds.recordset.length > 0) {
      const idList = simulasiIds.recordset.map(r => r.Simulasi_ID).join(',');
      const deleteDetailsQuery = `DELETE FROM t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan WHERE Simulasi_ID IN (${idList})`;
      
      console.log('=== Deleting Detail Records ===');
      console.log('Query:', deleteDetailsQuery);
      
      const detailResult = await db.request().query(deleteDetailsQuery);
      console.log('Detail records deleted:', detailResult.rowsAffected?.[0] || 0);
    }

    // Then delete header records
    const deleteHeaderQuery = `
      DELETE FROM t_COGS_HPP_Product_Header_Simulasi 
      WHERE Simulasi_Deskripsi = @Description 
      AND CONVERT(varchar, Simulasi_Date, 121) = @FormattedDate
      AND Simulasi_Type = 'Price Changes'
    `;

    console.log('=== Deleting Header Records ===');
    console.log('Query:', deleteHeaderQuery.replace(/\s+/g, ' ').trim());

    const result = await db
      .request()
      .input('Description', sql.VarChar(255), description)
      .input('FormattedDate', sql.VarChar(50), formattedDate)
      .query(deleteHeaderQuery);

    console.log('=== Bulk Delete Result ===');
    console.log('Header rows affected:', result.rowsAffected?.[0] || 0);

    return {
      deletedCount: result.rowsAffected?.[0] || 0,
      success: true
    };

  } catch (error) {
    console.error('=== bulkDeletePriceChangeGroup Error ===');
    console.error('Error message:', error.message);
    console.error('Error number:', error.number);
    console.error('Line number:', error.lineNumber);
    console.error('Parameters sent:');
    console.error('- Description:', description);
    console.error('- FormattedDate:', formattedDate);
    
    throw error;
  }
}

// Get simulation summary with HNA data using stored procedure
async function getSimulationSummary(simulasiId) {
  try {
    console.log('=== Executing getSimulationSummary ===');
    console.log('Simulasi ID:', simulasiId);

    const db = await connect();
    
    // Execute the stored procedure
    const query = `EXEC [sp_COGS_HPP_List_Simulasi] @SimulasiId`;
    
    const result = await db
      .request()
      .input('SimulasiId', sql.VarChar(20), simulasiId)
      .query(query);

    console.log('=== Stored Procedure Result ===');
    console.log('Records returned:', result.recordset?.length || 0);
    if (result.recordset?.length > 0) {
      console.log('Sample record:', JSON.stringify(result.recordset[0], null, 2));
    }

    return result.recordset || [];

  } catch (error) {
    console.error('=== getSimulationSummary Error ===');
    console.error('Error message:', error.message);
    console.error('Error number:', error.number);
    console.error('Line number:', error.lineNumber);
    console.error('Procedure name:', error.procName);
    console.error('Parameters sent:');
    console.error('- SimulasiId:', simulasiId);
    
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
};
