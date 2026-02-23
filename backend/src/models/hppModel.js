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
async function generateHPPSimulation(productId, formulaString, userId = null) {
  try {
    const db = await connect();
    const query = `exec sp_generate_simulasi_cogs_product_existing @productId, @formulaString`;

    const result = await db
      .request()
      .input("productId", sql.VarChar(10), productId)
      .input("formulaString", sql.VarChar(50), formulaString)
      .query(query);

    // If userId is provided and we have results, update the user_id field
    if (userId && result.recordset && result.recordset.length > 0) {
      const simulasiId = result.recordset[0].Simulasi_ID;
      if (simulasiId) {
        await db.request()
          .input("simulasiId", sql.Int, simulasiId)
          .input("userId", sql.VarChar(50), userId)
          .query(`UPDATE t_COGS_HPP_Product_Header_Simulasi SET user_id = @userId, process_date = GETDATE() WHERE Simulasi_ID = @simulasiId`);
      }
    }

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

// Get distinct custom materials from all simulations (deduplicated by Item_Name, keeping latest Simulasi_ID)
async function getDistinctCustomMaterials() {
  try {
    const db = await connect();
    const query = `
      WITH RankedCustom AS (
        SELECT
          d.Item_Name,
          d.Item_Unit_Price,
          d.Item_Unit,
          d.Tipe_Bahan,
          d.Simulasi_ID,
          ROW_NUMBER() OVER (PARTITION BY d.Item_Name ORDER BY d.Simulasi_ID DESC) AS rn
        FROM dbo.t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan d
        WHERE d.Item_ID = 'CUSTOM'
          AND d.Item_Name IS NOT NULL
          AND LTRIM(RTRIM(d.Item_Name)) <> ''
      )
      SELECT Item_Name, Item_Unit_Price, Item_Unit, Tipe_Bahan, Simulasi_ID
      FROM RankedCustom
      WHERE rn = 1
      ORDER BY Item_Name
    `;

    const result = await db.request().query(query);
    return result.recordset || [];
  } catch (error) {
    console.error("Error fetching distinct custom materials:", error);
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
        Product_Name = COALESCE(@ProductName, Product_Name),
        Formula = COALESCE(@Formula, Formula),
        Group_PNCategory_Dept = COALESCE(@GroupPNCategoryDept, Group_PNCategory_Dept),
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
        Beban_Sisa_Bahan_Exp = @BebanSisaBahanExp,
        Margin = @Margin,
        HNA = @HNA,
        process_date = GETDATE()
      WHERE Simulasi_ID = @SimulasiId
    `;

    const result = await db
      .request()
      .input("SimulasiId", sql.Int, simulasiId)
      .input("ProductName", sql.VarChar(100), headerData.Product_Name || null)
      .input("Formula", sql.VarChar(100), headerData.Formula || null)
      .input("GroupPNCategoryDept", sql.VarChar(50), headerData.Group_PNCategory_Dept || null)
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
      .input("Margin", sql.Decimal(18, 6), headerData.Margin || null)
      .input("HNA", sql.Decimal(18, 4), headerData.HNA || null)
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
        Direct_Labor, Factory_Over_Head, Depresiasi, Beban_Sisa_Bahan_Exp, Margin, HNA,
        user_id, process_date, flag_delete
      ) 
      VALUES (
        @SimulasiID, @ProductID, @ProductName, @Formula, @GroupPNCategory, @GroupPNCategoryDept, @Periode,
        @SimulasiDeskripsi, @SimulasiDate, @SimulasiType, @GroupRendemen, @BatchSize, @LOB, @Versi,
        @MHProsesStd, @MHKemasStd, @MHAnalisaStd, @MHTimbangBB, @MHTimbangBK, @MHMesinStd,
        @BiayaProses, @BiayaKemas, @BiayaAnalisa, @BiayaGenerik, @BiayaReagen, @TollFee, @RatePLN,
        @DirectLabor, @FactoryOverHead, @Depresiasi, @BebanSisaBahanExp, @Margin, @HNA,
        @UserId, GETDATE(), 0
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
      .input("Margin", sql.Decimal(18, 6), headerData.Margin || null)
      .input("HNA", sql.Decimal(18, 4), headerData.HNA || null)
      .input("UserId", sql.VarChar(50), headerData.user_id || null)
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

// Get all simulation records from header table (exclude soft-deleted by default)
async function getSimulationList(includeDeleted = false) {
  try {
    const db = await connect();
    const query = `
      SELECT *
      FROM t_COGS_HPP_Product_Header_Simulasi 
      ${includeDeleted ? '' : 'WHERE ISNULL(flag_delete, 0) = 0'}
    `;

    const result = await db.request().query(query);
    return result.recordset;
  } catch (error) {
    console.error("Error executing getSimulationList query:", error);
    throw error;
  }
}

// Get simulations marked for deletion
async function getMarkedForDeleteList() {
  try {
    const db = await connect();
    const query = `
      SELECT *
      FROM t_COGS_HPP_Product_Header_Simulasi 
      WHERE flag_delete = 1
    `;

    const result = await db.request().query(query);
    return result.recordset;
  } catch (error) {
    console.error("Error executing getMarkedForDeleteList query:", error);
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

// Mark simulation for deletion (soft delete)
async function markSimulationForDelete(simulasiId, userId) {
  try {
    const db = await connect();
    
    const query = `
      UPDATE t_COGS_HPP_Product_Header_Simulasi 
      SET flag_delete = 1,
          process_date = GETDATE()
      WHERE Simulasi_ID = @SimulasiId
    `;

    const result = await db
      .request()
      .input("SimulasiId", sql.Int, simulasiId)
      .query(query);

    return {
      success: result.rowsAffected[0] > 0,
      affectedRows: result.rowsAffected[0] || 0,
    };
  } catch (error) {
    console.error("Error marking simulation for delete:", error);
    throw error;
  }
}

// Restore simulation from deletion (unmark)
async function restoreSimulation(simulasiId) {
  try {
    const db = await connect();
    
    const query = `
      UPDATE t_COGS_HPP_Product_Header_Simulasi 
      SET flag_delete = 0,
          process_date = GETDATE()
      WHERE Simulasi_ID = @SimulasiId
    `;

    const result = await db
      .request()
      .input("SimulasiId", sql.Int, simulasiId)
      .query(query);

    return {
      success: result.rowsAffected[0] > 0,
      affectedRows: result.rowsAffected[0] || 0,
    };
  } catch (error) {
    console.error("Error restoring simulation:", error);
    throw error;
  }
}

// Bulk mark simulations for deletion in a price change group
async function bulkMarkForDelete(description, formattedDate, simulationType = 'Price Changes') {
  try {
    const db = await connect();
    
    const query = `
      UPDATE t_COGS_HPP_Product_Header_Simulasi 
      SET flag_delete = 1,
          process_date = GETDATE()
      WHERE Simulasi_Deskripsi = @Description 
      AND CONVERT(varchar, Simulasi_Date, 121) = @FormattedDate
      AND Simulasi_Type = @SimulationType
    `;

    const result = await db
      .request()
      .input('Description', sql.VarChar(255), description)
      .input('FormattedDate', sql.VarChar(50), formattedDate)
      .input('SimulationType', sql.VarChar(50), simulationType)
      .query(query);

    return {
      success: true,
      markedCount: result.rowsAffected[0] || 0,
    };
  } catch (error) {
    console.error("Error bulk marking for delete:", error);
    throw error;
  }
}

// Permanently delete all simulations marked for deletion
async function permanentlyDeleteMarked() {
  try {
    const db = await connect();
    
    // First get the IDs that will be deleted
    const getIdsQuery = `
      SELECT Simulasi_ID 
      FROM t_COGS_HPP_Product_Header_Simulasi 
      WHERE flag_delete = 1
    `;
    const simulasiIds = await db.request().query(getIdsQuery);
    
    if (simulasiIds.recordset.length === 0) {
      return { success: true, deletedCount: 0, materialsDeleted: 0 };
    }
    
    // Delete detail records first
    const idList = simulasiIds.recordset.map(r => r.Simulasi_ID).join(',');
    const deleteDetailsQuery = `DELETE FROM t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan WHERE Simulasi_ID IN (${idList})`;
    const detailResult = await db.request().query(deleteDetailsQuery);
    
    // Then delete header records
    const deleteHeaderQuery = `
      DELETE FROM t_COGS_HPP_Product_Header_Simulasi 
      WHERE flag_delete = 1
    `;
    const headerResult = await db.request().query(deleteHeaderQuery);

    return {
      success: true,
      deletedCount: headerResult.rowsAffected[0] || 0,
      materialsDeleted: detailResult.rowsAffected[0] || 0,
    };
  } catch (error) {
    console.error("Error permanently deleting marked simulations:", error);
    throw error;
  }
}

// Get simulation owner (user_id) by Simulasi_ID
async function getSimulationOwner(simulasiId) {
  try {
    const db = await connect();
    
    const query = `
      SELECT user_id, Simulasi_ID, Simulasi_Deskripsi
      FROM t_COGS_HPP_Product_Header_Simulasi 
      WHERE Simulasi_ID = @SimulasiId
    `;

    const result = await db
      .request()
      .input("SimulasiId", sql.Int, simulasiId)
      .query(query);

    return result.recordset[0] || null;
  } catch (error) {
    console.error("Error getting simulation owner:", error);
    throw error;
  }
}

// Generate price change simulation using stored procedure
async function generatePriceChangeSimulation(parameterString, userId = null) {
  try {
    const db = await connect();

    // Get max Simulasi_ID before running the stored procedure
    let maxIdBefore = 0;
    if (userId) {
      const maxIdResult = await db.request().query(`SELECT ISNULL(MAX(Simulasi_ID), 0) as MaxId FROM t_COGS_HPP_Product_Header_Simulasi`);
      maxIdBefore = maxIdResult.recordset[0].MaxId;
    }

    const directQuery = `exec sp_generate_simulasi_cogs_price_changes '${parameterString}'`;
    const result = await db.request().query(directQuery);

    // If userId is provided, update only the newly created simulations (ID > maxIdBefore)
    if (userId && maxIdBefore >= 0) {
      await db.request()
        .input("userId", sql.VarChar(50), userId)
        .input("maxIdBefore", sql.Int, maxIdBefore)
        .query(`UPDATE t_COGS_HPP_Product_Header_Simulasi SET user_id = @userId, process_date = GETDATE() WHERE Simulasi_ID > @maxIdBefore`);
    }

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
async function generatePriceUpdateSimulation(parameterString, periode, userId = null) {
  try {
    const db = await connect();

    // Get max Simulasi_ID before running the stored procedure
    let maxIdBefore = 0;
    if (userId) {
      const maxIdResult = await db.request().query(`SELECT ISNULL(MAX(Simulasi_ID), 0) as MaxId FROM t_COGS_HPP_Product_Header_Simulasi`);
      maxIdBefore = maxIdResult.recordset[0].MaxId;
    }

    const directQuery = `exec sp_generate_simulasi_cogs_price_update '${parameterString}', '${periode}'`;
    const result = await db.request().query(directQuery);

    // If userId is provided, update only the newly created simulations (ID > maxIdBefore)
    if (userId && maxIdBefore >= 0) {
      await db.request()
        .input("userId", sql.VarChar(50), userId)
        .input("maxIdBefore", sql.Int, maxIdBefore)
        .query(`UPDATE t_COGS_HPP_Product_Header_Simulasi SET user_id = @userId, process_date = GETDATE() WHERE Simulasi_ID > @maxIdBefore`);
    }

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

// Bulk delete price change group - PERMANENTLY (only for PL/PL users)
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

// Bulk mark price change group for deletion (soft delete)
async function bulkMarkPriceChangeGroupForDelete(description, formattedDate) {
  try {
    const db = await connect();
    
    const query = `
      UPDATE t_COGS_HPP_Product_Header_Simulasi 
      SET flag_delete = 1,
          process_date = GETDATE()
      WHERE Simulasi_Deskripsi = @Description 
      AND CONVERT(varchar, Simulasi_Date, 121) = @FormattedDate
      AND Simulasi_Type = 'Price Changes'
    `;

    const result = await db
      .request()
      .input('Description', sql.VarChar(255), description)
      .input('FormattedDate', sql.VarChar(50), formattedDate)
      .query(query);

    return {
      markedCount: result.rowsAffected?.[0] || 0,
      success: true
    };

  } catch (error) {
    console.error('Error in bulkMarkPriceChangeGroupForDelete:', error.message);
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
async function cloneSimulation(originalSimulasiId, cloneDescription, userId = null) {
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
          Direct_Labor, Factory_Over_Head, Depresiasi, Beban_Sisa_Bahan_Exp,
          user_id, process_date, flag_delete
        )
        SELECT 
          @NewSimulasiId, Product_ID, Product_Name, Formula, Group_PNCategory, Group_PNCategory_Dept, Periode,
          @CloneDescription, GETDATE(), Simulasi_Type, Group_Rendemen, Batch_Size, LOB, Versi,
          MH_Proses_Std, MH_Kemas_Std, MH_Analisa_Std, MH_Timbang_BB, MH_Timbang_BK, MH_Mesin_Std,
          Biaya_Proses, Biaya_Kemas, Biaya_Analisa, Biaya_Generik, Biaya_Reagen, Toll_Fee, Rate_PLN,
          Direct_Labor, Factory_Over_Head, Depresiasi, Beban_Sisa_Bahan_Exp,
          @UserId, GETDATE(), 0
        FROM t_COGS_HPP_Product_Header_Simulasi 
        WHERE Simulasi_ID = @OriginalSimulasiId
      `;
      
      // Generate clone description if not provided
      const finalCloneDescription = cloneDescription || `Clone of Simulasi_ID ${originalSimulasiId}`;
      
      await transaction.request()
        .input('NewSimulasiId', sql.Int, newSimulasiId)
        .input('OriginalSimulasiId', sql.Int, originalSimulasiId)
        .input('CloneDescription', sql.VarChar(255), finalCloneDescription)
        .input('UserId', sql.VarChar(50), userId)
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

// =====================================================================
// HPP ACTUAL FUNCTIONS
// =====================================================================

/**
 * Get HPP Actual list for a given period
 * Returns calculated HPP values for each batch
 */
async function getHPPActualList(periode = null) {
  try {
    const db = await connect();
    
    // Build query to get all batches with calculated HPP
    // Join with m_Product to get HNA (Product_SalesHNA)
    let query = `
      SELECT 
        h.HPP_Actual_ID,
        h.DNc_No,
        h.DNc_ProductID as Product_ID,
        h.Product_Name,
        h.BatchNo,
        h.BatchDate,
        h.TempelLabel_Date,
        h.Periode,
        h.LOB,
        h.Group_PNCategory,
        h.Group_PNCategory_Name,
        h.Group_PNCategory_Dept,
        h.Batch_Size_Std,
        h.Output_Actual,
        h.Rendemen_Std,
        h.Rendemen_Actual,
        h.Total_Cost_BB,
        h.Total_Cost_BK,
        h.Total_Cost_Granulate,
        h.Granulate_Count,
        h.MH_Proses_Std,
        h.MH_Proses_Actual,
        h.Rate_MH_Proses,
        h.MH_Kemas_Std,
        h.MH_Kemas_Actual,
        h.Rate_MH_Kemas,
        h.MH_Timbang_BB,
        h.MH_Timbang_BK,
        h.Rate_MH_Timbang,
        h.Direct_Labor,
        h.Factory_Overhead,
        h.Depresiasi,
        h.MH_Analisa_Std,
        h.Biaya_Analisa,
        h.Biaya_Reagen,
        h.MH_Mesin_Std,
        h.Rate_PLN,
        h.Cost_Utility,
        h.Toll_Fee,
        h.Beban_Sisa_Bahan_Exp,
        h.Biaya_Lain,
        h.Calculation_Status,
        h.Calculation_Date,
        h.Count_Materials_PO,
        h.Count_Materials_MR,
        h.Count_Materials_STD,
        h.Count_Materials_UNLINKED,
        -- HNA from m_Product
        p.Product_SalesHNA as HNA,
        -- Calculate component costs
        -- For Ethical: Use Rate_MH_Proses/Rate_MH_Kemas (which is Biaya_Proses/Biaya_Kemas from standard HPP)
        ISNULL(h.MH_Proses_Actual, h.MH_Proses_Std) * ISNULL(h.Rate_MH_Proses, 0) as Biaya_Proses,
        ISNULL(h.MH_Kemas_Actual, h.MH_Kemas_Std) * ISNULL(h.Rate_MH_Kemas, 0) as Biaya_Kemas,
        ISNULL(h.MH_Timbang_BB, 0) * ISNULL(h.Rate_MH_Timbang, 0) as Biaya_Timbang_BB,
        ISNULL(h.MH_Timbang_BK, 0) * ISNULL(h.Rate_MH_Timbang, 0) as Biaya_Timbang_BK,
        -- Calculate Total HPP per Batch
        -- Ethical: BB + BK + Proses + Kemas + Expiry + Toll + Lain (NO FOH, NO Depresiasi)
        -- Generic: Full calculation including FOH and Depresiasi
        (
          ISNULL(h.Total_Cost_BB, 0) +
          ISNULL(h.Total_Cost_BK, 0) +
          (ISNULL(h.MH_Proses_Actual, h.MH_Proses_Std) * ISNULL(h.Rate_MH_Proses, 0)) +
          (ISNULL(h.MH_Kemas_Actual, h.MH_Kemas_Std) * ISNULL(h.Rate_MH_Kemas, 0)) +
          (ISNULL(h.MH_Timbang_BB, 0) * ISNULL(h.Rate_MH_Timbang, 0)) +
          (ISNULL(h.MH_Timbang_BK, 0) * ISNULL(h.Rate_MH_Timbang, 0)) +
          CASE WHEN h.LOB != 'ETHICAL' THEN (ISNULL(h.MH_Proses_Actual, h.MH_Proses_Std) * ISNULL(h.Factory_Overhead, 0)) ELSE 0 END +
          CASE WHEN h.LOB != 'ETHICAL' THEN (ISNULL(h.MH_Kemas_Actual, h.MH_Kemas_Std) * ISNULL(h.Factory_Overhead, 0)) ELSE 0 END +
          CASE WHEN h.LOB != 'ETHICAL' THEN (ISNULL(h.MH_Proses_Actual, h.MH_Proses_Std) * ISNULL(h.Depresiasi, 0)) ELSE 0 END +
          CASE WHEN h.LOB != 'ETHICAL' THEN (ISNULL(h.MH_Kemas_Actual, h.MH_Kemas_Std) * ISNULL(h.Depresiasi, 0)) ELSE 0 END +
          ISNULL(h.Biaya_Analisa, 0) +
          ISNULL(h.Biaya_Reagen, 0) +
          ISNULL(h.Cost_Utility, 0) +
          ISNULL(h.Toll_Fee, 0) +
          ISNULL(h.Beban_Sisa_Bahan_Exp, 0) +
          ISNULL(h.Biaya_Lain, 0)
        ) as Total_HPP_Batch,
        -- Calculate HPP per unit (Total HPP / Output)
        CASE 
          WHEN ISNULL(h.Output_Actual, 0) > 0 THEN
            (
              ISNULL(h.Total_Cost_BB, 0) +
              ISNULL(h.Total_Cost_BK, 0) +
              (ISNULL(h.MH_Proses_Actual, h.MH_Proses_Std) * ISNULL(h.Rate_MH_Proses, 0)) +
              (ISNULL(h.MH_Kemas_Actual, h.MH_Kemas_Std) * ISNULL(h.Rate_MH_Kemas, 0)) +
              (ISNULL(h.MH_Timbang_BB, 0) * ISNULL(h.Rate_MH_Timbang, 0)) +
              (ISNULL(h.MH_Timbang_BK, 0) * ISNULL(h.Rate_MH_Timbang, 0)) +
              CASE WHEN h.LOB != 'ETHICAL' THEN (ISNULL(h.MH_Proses_Actual, h.MH_Proses_Std) * ISNULL(h.Factory_Overhead, 0)) ELSE 0 END +
              CASE WHEN h.LOB != 'ETHICAL' THEN (ISNULL(h.MH_Kemas_Actual, h.MH_Kemas_Std) * ISNULL(h.Factory_Overhead, 0)) ELSE 0 END +
              CASE WHEN h.LOB != 'ETHICAL' THEN (ISNULL(h.MH_Proses_Actual, h.MH_Proses_Std) * ISNULL(h.Depresiasi, 0)) ELSE 0 END +
              CASE WHEN h.LOB != 'ETHICAL' THEN (ISNULL(h.MH_Kemas_Actual, h.MH_Kemas_Std) * ISNULL(h.Depresiasi, 0)) ELSE 0 END +
              ISNULL(h.Biaya_Analisa, 0) +
              ISNULL(h.Biaya_Reagen, 0) +
              ISNULL(h.Cost_Utility, 0) +
              ISNULL(h.Toll_Fee, 0) +
              ISNULL(h.Beban_Sisa_Bahan_Exp, 0) +
              ISNULL(h.Biaya_Lain, 0)
            ) / h.Output_Actual
          ELSE 0
        END as HPP_Per_Unit,
        -- Calculate HPP/HNA Ratio
        CASE 
          WHEN ISNULL(p.Product_SalesHNA, 0) > 0 AND ISNULL(h.Output_Actual, 0) > 0 THEN
            (
              (
                ISNULL(h.Total_Cost_BB, 0) +
                ISNULL(h.Total_Cost_BK, 0) +
                (ISNULL(h.MH_Proses_Actual, h.MH_Proses_Std) * ISNULL(h.Rate_MH_Proses, 0)) +
                (ISNULL(h.MH_Kemas_Actual, h.MH_Kemas_Std) * ISNULL(h.Rate_MH_Kemas, 0)) +
                (ISNULL(h.MH_Timbang_BB, 0) * ISNULL(h.Rate_MH_Timbang, 0)) +
                (ISNULL(h.MH_Timbang_BK, 0) * ISNULL(h.Rate_MH_Timbang, 0)) +
                CASE WHEN h.LOB != 'ETHICAL' THEN (ISNULL(h.MH_Proses_Actual, h.MH_Proses_Std) * ISNULL(h.Factory_Overhead, 0)) ELSE 0 END +
                CASE WHEN h.LOB != 'ETHICAL' THEN (ISNULL(h.MH_Kemas_Actual, h.MH_Kemas_Std) * ISNULL(h.Factory_Overhead, 0)) ELSE 0 END +
                CASE WHEN h.LOB != 'ETHICAL' THEN (ISNULL(h.MH_Proses_Actual, h.MH_Proses_Std) * ISNULL(h.Depresiasi, 0)) ELSE 0 END +
                CASE WHEN h.LOB != 'ETHICAL' THEN (ISNULL(h.MH_Kemas_Actual, h.MH_Kemas_Std) * ISNULL(h.Depresiasi, 0)) ELSE 0 END +
                ISNULL(h.Biaya_Analisa, 0) +
                ISNULL(h.Biaya_Reagen, 0) +
                ISNULL(h.Cost_Utility, 0) +
                ISNULL(h.Toll_Fee, 0) +
                ISNULL(h.Beban_Sisa_Bahan_Exp, 0) +
                ISNULL(h.Biaya_Lain, 0)
              ) / h.Output_Actual / p.Product_SalesHNA * 100
            )
          ELSE 0
        END as HPP_Ratio
      FROM t_COGS_HPP_Actual_Header h
      LEFT JOIN m_Product p ON p.Product_ID = h.DNc_ProductID
      WHERE h.LOB != 'GRANULATE'
        AND h.Calculation_Status = 'COMPLETED'
    `;
    
    let request = db.request();
    
    if (periode) {
      query += ` AND h.Periode = @periode`;
      request = request.input('periode', sql.VarChar(6), periode);
    }
    
    query += ` ORDER BY h.Periode DESC, h.DNc_ProductID, h.BatchNo`;
    
    const result = await request.query(query);
    return result.recordset || [];
    
  } catch (error) {
    console.error("Error in getHPPActualList:", error);
    throw error;
  }
}

/**
 * Get available periods for HPP Actual
 */
async function getHPPActualPeriods() {
  try {
    const db = await connect();
    
    const query = `
      SELECT DISTINCT Periode, 
             COUNT(*) as BatchCount,
             SUM(CASE WHEN LOB = 'GRANULATE' THEN 1 ELSE 0 END) as GranulateCount
      FROM t_COGS_HPP_Actual_Header
      WHERE Calculation_Status = 'COMPLETED'
      GROUP BY Periode
      ORDER BY Periode DESC
    `;
    
    const result = await db.request().query(query);
    return result.recordset || [];
    
  } catch (error) {
    console.error("Error in getHPPActualPeriods:", error);
    throw error;
  }
}

/**
 * Get HPP Actual detail (materials) for a specific batch
 */
async function getHPPActualDetail(hppActualId) {
  try {
    const db = await connect();
    
    const query = `
      SELECT 
        d.HPP_Detail_ID,
        d.HPP_Actual_ID,
        d.DNc_No,
        d.Item_ID,
        d.Item_Name,
        d.Item_Type,
        d.Item_Unit,
        d.Qty_Required,
        d.Qty_Used,
        d.Usage_Unit,
        d.PO_Unit,
        d.Unit_Conversion_Factor,
        d.Qty_In_PO_Unit,
        d.Unit_Price,
        d.Currency_Original,
        d.Exchange_Rate,
        d.Unit_Price_IDR,
        d.Price_Source,
        d.Price_Source_Level,
        d.MR_No,
        d.TTBA_No,
        d.PO_No,
        d.Is_Granulate,
        d.Granulate_Batch,
        d.Granulate_Cost_Per_Gram,
        -- Calculate total cost
        ISNULL(d.Qty_In_PO_Unit, d.Qty_Used) * ISNULL(d.Unit_Price_IDR, 0) as Total_Cost
      FROM t_COGS_HPP_Actual_Detail d
      WHERE d.HPP_Actual_ID = @hppActualId
      ORDER BY d.Item_Type, d.Item_ID
    `;
    
    const result = await db.request()
      .input('hppActualId', sql.Int, hppActualId)
      .query(query);
    
    return result.recordset || [];
    
  } catch (error) {
    console.error("Error in getHPPActualDetail:", error);
    throw error;
  }
}

/**
 * Get HPP Actual header for a specific batch
 */
async function getHPPActualHeader(hppActualId) {
  try {
    const db = await connect();
    
    const query = `
      SELECT *
      FROM t_COGS_HPP_Actual_Header
      WHERE HPP_Actual_ID = @hppActualId
    `;
    
    const result = await db.request()
      .input('hppActualId', sql.Int, hppActualId)
      .query(query);
    
    return result.recordset[0] || null;
    
  } catch (error) {
    console.error("Error in getHPPActualHeader:", error);
    throw error;
  }
}

/**
 * Get batches with calculation errors for a given period
 * @param {string} periode - Period in YYYYMM format
 * @returns {array} - List of batches with errors
 */
async function getErrorBatches(periode) {
  try {
    const db = await connect();
    
    const query = `
      SELECT 
        HPP_Actual_ID,
        DNc_ProductID,
        Product_Name,
        BatchNo,
        Calculation_Status,
        Error_Message,
        Calculation_Date
      FROM t_COGS_HPP_Actual_Header
      WHERE Periode = @periode
        AND Calculation_Status = 'ERROR'
      ORDER BY BatchNo
    `;
    
    const result = await db.request()
      .input('periode', sql.VarChar(6), periode)
      .query(query);
    
    return result.recordset || [];
    
  } catch (error) {
    console.error("Error in getErrorBatches:", error);
    throw error;
  }
}

/**
 * Calculate HPP Actual by calling the stored procedure
 * @param {string} periode - Period in YYYYMM format
 * @param {boolean} recalculateExisting - Whether to recalculate existing records
 * @returns {object} - Result from stored procedure with error details
 */
async function calculateHPPActual(periode, recalculateExisting = false) {
  try {
    const db = await connect();
    
    console.log(`Starting HPP Actual calculation for period ${periode}, recalculate: ${recalculateExisting}`);
    
    const result = await db.request()
      .input('Periode', sql.VarChar(6), periode)
      .input('RecalculateExisting', sql.Bit, recalculateExisting ? 1 : 0)
      .execute('sp_COGS_Calculate_HPP_Actual');
    
    const summary = result.recordset && result.recordset[0] ? result.recordset[0] : {};
    
    console.log(`HPP Actual calculation completed:`, summary);
    
    // If there were errors, fetch the error details
    let errorBatches = [];
    if (summary.Errors > 0) {
      errorBatches = await getErrorBatches(periode);
      console.log(`Found ${errorBatches.length} batches with errors`);
    }
    
    return {
      success: true,
      granulatesProcessed: summary.GranulatesProcessed || 0,
      totalProductBatches: summary.TotalProductBatches || 0,
      productsProcessed: summary.ProductsProcessed || 0,
      errors: summary.Errors || 0,
      durationSeconds: summary.DurationSeconds || 0,
      errorBatches: errorBatches
    };
    
  } catch (error) {
    console.error("Error in calculateHPPActual:", error);
    throw error;
  }
}

module.exports = {
  getHPP,
  generateHPPCalculation,
  generateHPPSimulation,
  getSimulationHeader,
  getSimulationDetailBahan,
  getDistinctCustomMaterials,
  createSimulationHeader,
  updateSimulationHeader,
  deleteSimulationMaterials,
  insertSimulationMaterials,
  getSimulationList,
  getMarkedForDeleteList,
  deleteSimulation,
  markSimulationForDelete,
  restoreSimulation,
  bulkMarkForDelete,
  permanentlyDeleteMarked,
  getSimulationOwner,
  cloneSimulation,
  generatePriceChangeSimulation,
  generatePriceUpdateSimulation,
  getPriceChangeAffectedProducts,
  getPriceUpdateAffectedProducts,
  bulkDeletePriceChangeGroup,
  bulkMarkPriceChangeGroupForDelete,
  getSimulationSummary,
  checkHPPDataExists,
  commitPriceUpdate,
  getSimulationsForPriceChangeGroup,
  updateSimulationVersionBulk,
  // HPP Actual exports
  getHPPActualList,
  getHPPActualPeriods,
  getHPPActualDetail,
  getHPPActualHeader,
  calculateHPPActual,
  getErrorBatches,
};
