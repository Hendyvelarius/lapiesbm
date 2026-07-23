const { connect } = require("../../config/sqlserver");
const sql = require("mssql");

// Get current datetime in WIB (GMT+7) for SQL Server storage
function getWIBDateTime() {
    const now = new Date();
    return new Date(now.getTime() + (7 * 60 * 60 * 1000));
}

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

// Get list of Product_IDs that have been generated (exist in HPP Standard data) for a given year
async function getGeneratedProductIds(year) {
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

    // Collect unique Product_IDs from all 3 recordsets (ethical, generik1, generik2)
    const productIds = new Set();
    for (const recordset of result.recordsets) {
      if (recordset) {
        for (const row of recordset) {
          if (row.Product_ID) {
            productIds.add(row.Product_ID);
          }
        }
      }
    }

    return Array.from(productIds);
  } catch (error) {
    console.error("Error getting generated product IDs:", error);
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
    // Without an ORDER BY, SQL Server returns rows in arbitrary order which
    // can change between calls and makes the materials grid "scramble"
    // every time the user reopens the simulation. Sort by the same key the
    // SP populates from PPI_SeqID + ITEM_TYPE so the order matches the
    // standard formula view.
    const query = `
      SELECT *
      FROM dbo.t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
      WHERE Simulasi_ID = @simulasiId
      ORDER BY Tipe_Bahan, Seq_ID, Item_ID
    `;

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
        Group_PNCategory = COALESCE(@GroupPNCategory, Group_PNCategory),
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
      .input("GroupPNCategory", sql.VarChar(10), headerData.Group_PNCategory || null)
      .input("GroupPNCategoryDept", sql.VarChar(50), headerData.Group_PNCategory_Dept || null)
      .input(
        "SimulasiDeskripsi",
        sql.VarChar(4000),
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
        sql.VarChar(4000),
        headerData.Simulasi_Deskripsi || ""
      )
      .input("SimulasiDate", sql.DateTime, getWIBDateTime())
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
          user_id = @UserId,
          process_date = GETDATE()
      WHERE Simulasi_ID = @SimulasiId
    `;

    const result = await db
      .request()
      .input("SimulasiId", sql.Int, simulasiId)
      .input("UserId", sql.VarChar(50), userId || 'SYSTEM')
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
async function restoreSimulation(simulasiId, userId) {
  try {
    const db = await connect();
    
    const query = `
      UPDATE t_COGS_HPP_Product_Header_Simulasi 
      SET flag_delete = 0,
          user_id = @UserId,
          process_date = GETDATE()
      WHERE Simulasi_ID = @SimulasiId
    `;

    const result = await db
      .request()
      .input("SimulasiId", sql.Int, simulasiId)
      .input("UserId", sql.VarChar(50), userId || 'SYSTEM')
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
async function bulkMarkForDelete(description, formattedDate, simulationType = null) {
  try {
    const db = await connect();

    // simulationType is now optional. When omitted, the bulk op matches any
    // simulation-group type (Price Changes or Currency Changes) — safe because
    // description + date uniquely identifies a group and the two types use
    // distinct description prefixes.
    const typeFilter = simulationType ? 'AND Simulasi_Type = @SimulationType' : '';
    const query = `
      UPDATE t_COGS_HPP_Product_Header_Simulasi
      SET flag_delete = 1,
          process_date = GETDATE()
      WHERE Simulasi_Deskripsi = @Description
      AND CONVERT(varchar, Simulasi_Date, 121) = @FormattedDate
      ${typeFilter}
    `;

    const request = db.request()
      .input('Description', sql.VarChar(4000), description)
      .input('FormattedDate', sql.VarChar(50), formattedDate);
    if (simulationType) {
      request.input('SimulationType', sql.VarChar(50), simulationType);
    }
    const result = await request.query(query);

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

    // Always capture max Simulasi_ID before running the SP so we can identify exactly
    // which simulation rows this run created (the SP writes one row per affected product,
    // or none at all when no product uses the changed material).
    const maxIdResult = await db.request().query(`SELECT ISNULL(MAX(Simulasi_ID), 0) as MaxId FROM t_COGS_HPP_Product_Header_Simulasi`);
    const maxIdBefore = maxIdResult.recordset[0].MaxId;

    const directQuery = `exec sp_generate_simulasi_cogs_price_changes '${parameterString}'`;
    const result = await db.request().query(directQuery);

    // If userId is provided, update only the newly created simulations (ID > maxIdBefore)
    if (userId) {
      await db.request()
        .input("userId", sql.VarChar(50), userId)
        .input("maxIdBefore", sql.Int, maxIdBefore)
        .query(`UPDATE t_COGS_HPP_Product_Header_Simulasi SET user_id = @userId, process_date = GETDATE() WHERE Simulasi_ID > @maxIdBefore`);
    }

    // Return the exact rows this run created. The frontend relies on this instead of
    // fuzzy-matching descriptions, which previously let a single-material run with no
    // affected products "snap" onto an older simulation that shared the material.
    const newSimsResult = await db.request()
      .input("maxIdBefore", sql.Int, maxIdBefore)
      .query(`
        SELECT Simulasi_ID, Simulasi_Deskripsi, Simulasi_Date, Product_ID, Product_Name
        FROM t_COGS_HPP_Product_Header_Simulasi
        WHERE Simulasi_ID > @maxIdBefore
        ORDER BY Simulasi_ID`);
    const newSimulations = newSimsResult.recordset;

    return {
      recordsets: result.recordsets,
      rowsAffected: result.rowsAffected,
      returnValue: result.returnValue,
      newSimulations,
      affectedProductCount: newSimulations.length,
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
      .input('Description', sql.VarChar(4000), description)
      .input('FormattedDate', sql.VarChar(50), formattedDate)
      .query(selectedIdsQuery);
    
    const selectedProductIds = new Set(selectedIds.recordset.map(r => r.Product_ID));
    
    // Execute the stored procedure
    const query = `EXEC [sp_COGS_HPP_List_Simulasi_PriceChange] @Description, @FormattedDate`;
    
    const result = await db
      .request()
      .input('Description', sql.VarChar(4000), description)
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
      .input('Description', sql.VarChar(4000), description)
      .input('FormattedDate', sql.VarChar(50), formattedDate)
      .query(selectedProductsQuery);
    
    const selectedProductIds = new Set(
      selectedProductsResult.recordset.map(row => row.Product_ID)
    );
    
    // Execute the stored procedure - same pattern as Price Change
    const query = `EXEC [sp_COGS_HPP_List_Simulasi_PriceUpdate] @Description, @FormattedDate`;
    
    const result = await db
      .request()
      .input('Description', sql.VarChar(4000), description)
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

    // Matches both Price Changes and Currency Changes groups — the two share
    // the same group-by-(description, date) shape and distinct description
    // prefixes prevent collisions.
    const getIdsQuery = `
      SELECT Simulasi_ID
      FROM t_COGS_HPP_Product_Header_Simulasi
      WHERE Simulasi_Deskripsi = @Description
      AND CONVERT(varchar, Simulasi_Date, 121) = @FormattedDate
      AND Simulasi_Type IN ('Price Changes', 'Currency Changes')
    `;

    const simulasiIds = await db
      .request()
      .input('Description', sql.VarChar(4000), description)
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
      AND Simulasi_Type IN ('Price Changes', 'Currency Changes')
    `;

    const result = await db
      .request()
      .input('Description', sql.VarChar(4000), description)
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

// Bulk mark price change / currency change group for deletion (soft delete)
async function bulkMarkPriceChangeGroupForDelete(description, formattedDate) {
  try {
    const db = await connect();

    const query = `
      UPDATE t_COGS_HPP_Product_Header_Simulasi
      SET flag_delete = 1,
          process_date = GETDATE()
      WHERE Simulasi_Deskripsi = @Description
      AND CONVERT(varchar, Simulasi_Date, 121) = @FormattedDate
      AND Simulasi_Type IN ('Price Changes', 'Currency Changes')
    `;

    const result = await db
      .request()
      .input('Description', sql.VarChar(4000), description)
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
        .input('CloneDescription', sql.VarChar(4000), finalCloneDescription)
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

    // When the caller passes 'ALL' (or null), match both Price Changes and
    // Currency Changes — used by bulk-delete discovery where we don't know
    // ahead of time which group type the user clicked.
    const matchAny = !simulationType || simulationType === 'ALL';
    const typeFilter = matchAny
      ? `AND Simulasi_Type IN ('Price Changes', 'Currency Changes')`
      : `AND Simulasi_Type = @SimulationType`;

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
      ${typeFilter}
      ORDER BY Product_Name
    `;

    const request = db.request()
      .input('Description', sql.VarChar(4000), description)
      .input('FormattedDate', sql.VarChar(50), formattedDate);
    if (!matchAny) {
      request.input('SimulationType', sql.VarChar(50), simulationType);
    }
    const result = await request.query(query);

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
 * @param {string} periode - Period filter (optional)
 * @param {boolean} useTestTable - If true, reads from _TEST tables
 */
async function getHPPActualList(periode = null, useTestTable = false) {
  try {
    const db = await connect();
    
    // Determine table name based on test mode
    const headerTable = useTestTable ? 't_COGS_HPP_Actual_Header_TEST' : 't_COGS_HPP_Actual_Header';
    
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
        h.Total_Cost_Returned,
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
      FROM ${headerTable} h
      LEFT JOIN m_Product p ON p.Product_ID = h.DNc_ProductID
      WHERE h.LOB NOT IN ('GRANULATE', 'FG')
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
 * @param {boolean} useTestTable - If true, reads from _TEST tables
 */
async function getHPPActualPeriods(useTestTable = false) {
  try {
    const db = await connect();
    
    const headerTable = useTestTable ? 't_COGS_HPP_Actual_Header_TEST' : 't_COGS_HPP_Actual_Header';
    
    const query = `
      SELECT DISTINCT Periode, 
             COUNT(*) as BatchCount,
             SUM(CASE WHEN LOB IN ('GRANULATE', 'FG') THEN 1 ELSE 0 END) as GranulateCount
      FROM ${headerTable}
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
 * Get HPP Actual granulate batches for a period
 * @param {string} periode - YYYYMM format
 * @param {boolean} useTestTable - If true, reads from _TEST tables
 */
async function getHPPActualGranulateList(periode = null, useTestTable = false) {
  try {
    const db = await connect();
    const headerTable = useTestTable ? 't_COGS_HPP_Actual_Header_TEST' : 't_COGS_HPP_Actual_Header';

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
        h.MH_Proses_Std,
        h.MH_Proses_Actual,
        h.Rate_MH_Proses,
        h.MH_Kemas_Std,
        h.MH_Kemas_Actual,
        h.Rate_MH_Kemas,
        h.Cost_Utility,
        h.Biaya_Analisa,
        h.Biaya_Reagen,
        h.MH_Mesin_Std,
        h.Rate_PLN,
        h.Cost_Per_Unit,
        h.Calculation_Status,
        h.Calculation_Date,
        h.Count_Materials_PO,
        h.Count_Materials_UNLINKED,
        -- Calculated costs
        ISNULL(h.MH_Proses_Actual, h.MH_Proses_Std) * ISNULL(h.Rate_MH_Proses, 0) as Biaya_Proses,
        ISNULL(h.MH_Kemas_Actual, h.MH_Kemas_Std) * ISNULL(h.Rate_MH_Kemas, 0) as Biaya_Kemas,
        -- Total production cost
        (
          ISNULL(h.Total_Cost_BB, 0) +
          ISNULL(h.MH_Proses_Actual, h.MH_Proses_Std) * ISNULL(h.Rate_MH_Proses, 0) +
          ISNULL(h.MH_Kemas_Actual, h.MH_Kemas_Std) * ISNULL(h.Rate_MH_Kemas, 0) +
          ISNULL(h.Cost_Utility, 0) +
          ISNULL(h.Biaya_Analisa, 0) +
          ISNULL(h.Biaya_Reagen, 0)
        ) as Total_Production_Cost
      FROM ${headerTable} h
      WHERE h.LOB IN ('GRANULATE', 'FG')
        AND h.Calculation_Status = 'COMPLETED'
    `;

    let request = db.request();
    if (periode) {
      // Filter by TempelLabel_Date (production/release date) within the period month
      // (Periode is set to the consumer's period, not production date;
      //  BatchDate is batch creation date which can be months earlier)
      query += ` AND CONVERT(VARCHAR(6), h.TempelLabel_Date, 112) = @periode`;
      request = request.input('periode', sql.VarChar(6), periode);
    }
    query += ` ORDER BY h.Periode DESC, h.DNc_ProductID, h.BatchNo`;

    const result = await request.query(query);
    return result.recordset || [];
  } catch (error) {
    console.error("Error in getHPPActualGranulateList:", error);
    throw error;
  }
}

/**
 * Get HPP Actual detail (materials) for a specific batch
 * @param {number} hppActualId - HPP Actual ID
 * @param {boolean} useTestTable - If true, reads from _TEST tables
 */
async function getHPPActualDetail(hppActualId, useTestTable = false) {
  try {
    const db = await connect();
    
    const detailTable = useTestTable ? 't_COGS_HPP_Actual_Detail_TEST' : 't_COGS_HPP_Actual_Detail';
    
    const query = `
      SELECT 
        d.HPP_Detail_ID,
        d.HPP_Actual_ID,
        d.DNc_No,
        d.Item_ID,
        CASE WHEN d.Is_Granulate = 1 AND d.Granulate_Batch IS NOT NULL 
          THEN d.Granulate_Batch + ' - ' + ISNULL(d.Item_Name, ISNULL((
            SELECT TOP 1 ih.Product_Name FROM ${useTestTable ? 't_COGS_HPP_Actual_Header_TEST' : 't_COGS_HPP_Actual_Header'} ih 
            WHERE REPLACE(ih.DNc_ProductID, ' ', '') = REPLACE(d.Item_ID, ' ', '') AND ih.BatchNo = d.Granulate_Batch 
              AND ih.LOB IN ('GRANULATE', 'FG') AND ih.Calculation_Status = 'COMPLETED'
          ), d.Item_ID))
          ELSE d.Item_Name END as Item_Name,
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
        d.Qty_Returned,
        -- Calculate total cost
        ISNULL(d.Qty_In_PO_Unit, d.Qty_Used) * ISNULL(d.Unit_Price_IDR, 0) as Total_Cost
      FROM ${detailTable} d
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
 * @param {number} hppActualId - HPP Actual ID
 * @param {boolean} useTestTable - If true, reads from _TEST tables
 */
async function getHPPActualHeader(hppActualId, useTestTable = false) {
  try {
    const db = await connect();
    
    const headerTable = useTestTable ? 't_COGS_HPP_Actual_Header_TEST' : 't_COGS_HPP_Actual_Header';
    
    const query = `
      SELECT *, DNc_ProductID as Product_ID
      FROM ${headerTable}
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
 * Get all HPP Actual details for a period (for export)
 * @param {string} periode - Period in YYYYMM format
 * @param {boolean} useTestTable - If true, reads from _TEST tables
 * @returns {array} - All material details for the period
 */
async function getHPPActualAllDetails(periode, useTestTable = false) {
  try {
    const db = await connect();
    
    const headerTable = useTestTable ? 't_COGS_HPP_Actual_Header_TEST' : 't_COGS_HPP_Actual_Header';
    const detailTable = useTestTable ? 't_COGS_HPP_Actual_Detail_TEST' : 't_COGS_HPP_Actual_Detail';
    
    const query = `
      SELECT 
        h.DNc_No,
        h.Product_Name,
        h.BatchNo,
        h.Periode,
        h.LOB,
        d.Item_ID as Material_Code,
        CASE WHEN d.Is_Granulate = 1 AND d.Granulate_Batch IS NOT NULL 
          THEN d.Granulate_Batch + ' - ' + ISNULL(d.Item_Name, ISNULL((
            SELECT TOP 1 ih.Product_Name FROM ${headerTable} ih 
            WHERE REPLACE(ih.DNc_ProductID, ' ', '') = REPLACE(d.Item_ID, ' ', '') AND ih.BatchNo = d.Granulate_Batch 
              AND ih.LOB IN ('GRANULATE', 'FG') AND ih.Calculation_Status = 'COMPLETED'
          ), d.Item_ID))
          ELSE d.Item_Name END as Material_Name,
        d.Item_Type,
        d.Item_Unit,
        d.Qty_Required,
        d.Qty_Used,
        d.Qty_Returned,
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
        -- Calculate total cost (Net quantity * price)
        d.Qty_In_PO_Unit * ISNULL(d.Unit_Price_IDR, 0) as Total_Cost
      FROM ${detailTable} d
      JOIN ${headerTable} h ON d.HPP_Actual_ID = h.HPP_Actual_ID
      WHERE h.Periode = @periode
        AND h.LOB NOT IN ('GRANULATE', 'FG')
        AND h.Calculation_Status = 'COMPLETED'
      ORDER BY h.Product_Name, h.BatchNo, d.Item_Type, d.Item_ID
    `;
    
    const result = await db.request()
      .input('periode', sql.VarChar(6), periode)
      .query(query);
    
    return result.recordset || [];
    
  } catch (error) {
    console.error("Error in getHPPActualAllDetails:", error);
    throw error;
  }
}

/**
 * Get intermediate usage - intermediates consumed by products in a given period
 * Shows which granulate/FG batches were used as materials by products in the period
 * @param {string} periode - Period in YYYYMM format
 * @param {boolean} useTestTable - If true, reads from _TEST tables
 * @returns {array} - List of intermediate usage records
 */
async function getHPPActualIntermediateUsage(periode = null, useTestTable = false) {
  try {
    const db = await connect();
    const headerTable = useTestTable ? 't_COGS_HPP_Actual_Header_TEST' : 't_COGS_HPP_Actual_Header';
    const detailTable = useTestTable ? 't_COGS_HPP_Actual_Detail_TEST' : 't_COGS_HPP_Actual_Detail';

    let query = `
      SELECT 
        d.Item_ID as Intermediate_ID,
        d.Item_Name as Intermediate_Name,
        d.Granulate_Batch as BatchNo,
        d.Granulate_Cost_Per_Gram as Cost_Per_Unit,
        -- Aggregate usage across all products in this period
        COUNT(DISTINCT h.DNc_ProductID + h.BatchNo) as Used_By_Count,
        SUM(d.Qty_Used) as Total_Qty_Used,
        SUM(ISNULL(d.Qty_In_PO_Unit, d.Qty_Used) * ISNULL(d.Unit_Price_IDR, 0)) as Total_Cost,
        -- Lookup intermediate's own header info
        ih.LOB as Intermediate_LOB,
        ih.Product_Name as Intermediate_Product_Name,
        ih.Output_Actual as Intermediate_Output,
        ih.Periode as Produced_Periode,
        ih.BatchDate as Intermediate_BatchDate,
        ih.HPP_Actual_ID as Intermediate_HPP_ID,
        ih.Total_Cost_BB as Intermediate_Total_BB,
        (
          ISNULL(ih.Total_Cost_BB, 0) +
          ISNULL(ih.MH_Proses_Actual, ih.MH_Proses_Std) * ISNULL(ih.Rate_MH_Proses, 0) +
          ISNULL(ih.MH_Kemas_Actual, ih.MH_Kemas_Std) * ISNULL(ih.Rate_MH_Kemas, 0) +
          ISNULL(ih.Cost_Utility, 0) +
          ISNULL(ih.Biaya_Analisa, 0) +
          ISNULL(ih.Biaya_Reagen, 0)
        ) as Intermediate_Total_Cost,
        -- List of products using this intermediate (comma-separated)
        STUFF((
          SELECT DISTINCT ', ' + h2.BatchNo
          FROM ${detailTable} d2
          JOIN ${headerTable} h2 ON d2.HPP_Actual_ID = h2.HPP_Actual_ID
          WHERE d2.Is_Granulate = 1
            AND d2.Item_ID = d.Item_ID
            AND d2.Granulate_Batch = d.Granulate_Batch
            AND h2.Periode = @periode
            AND h2.LOB NOT IN ('GRANULATE', 'FG')
            AND h2.Calculation_Status = 'COMPLETED'
          FOR XML PATH('')
        ), 1, 2, '') as Used_By_Batches
      FROM ${detailTable} d
      JOIN ${headerTable} h ON d.HPP_Actual_ID = h.HPP_Actual_ID
      LEFT JOIN ${headerTable} ih ON REPLACE(ih.DNc_ProductID, ' ', '') = REPLACE(d.Item_ID, ' ', '') 
                                  AND ih.BatchNo = d.Granulate_Batch
                                  AND ih.LOB IN ('GRANULATE', 'FG')
                                  AND ih.Calculation_Status = 'COMPLETED'
      WHERE d.Is_Granulate = 1
        AND h.LOB NOT IN ('GRANULATE', 'FG')
        AND h.Calculation_Status = 'COMPLETED'
    `;

    let request = db.request();
    if (periode) {
      query += ` AND h.Periode = @periode`;
      request = request.input('periode', sql.VarChar(6), periode);
    }
    query += ` GROUP BY d.Item_ID, d.Item_Name, d.Granulate_Batch, d.Granulate_Cost_Per_Gram,
                ih.LOB, ih.Product_Name, ih.Output_Actual, ih.Periode, ih.BatchDate,
                ih.HPP_Actual_ID, ih.Total_Cost_BB,
                ih.MH_Proses_Actual, ih.MH_Proses_Std, ih.Rate_MH_Proses,
                ih.MH_Kemas_Actual, ih.MH_Kemas_Std, ih.Rate_MH_Kemas,
                ih.Cost_Utility, ih.Biaya_Analisa, ih.Biaya_Reagen
              ORDER BY d.Item_ID, d.Granulate_Batch`;

    const result = await request.query(query);
    return result.recordset || [];
  } catch (error) {
    console.error("Error in getHPPActualIntermediateUsage:", error);
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
      fgProcessed: summary.FGProcessed || 0,
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
  getGeneratedProductIds,
  commitPriceUpdate,
  getSimulationsForPriceChangeGroup,
  updateSimulationVersionBulk,
  // Currency Changes simulation exports
  getForeignCurrencies,
  scanCurrencyImpact,
  generateCurrencyChangeSimulation,
  getCurrencyChangeAffectedProducts,
  // HPP Actual exports
  getHPPActualList,
  getHPPActualGranulateList,
  getHPPActualPeriods,
  getHPPActualDetail,
  getHPPActualHeader,
  getHPPActualAllDetails,
  getHPPActualIntermediateUsage,
  calculateHPPActual,
  getErrorBatches,
};

// ============================================================================
// Currency Changes Simulation
// ============================================================================

/**
 * List foreign currencies (everything except IDR) with their current rate for
 * the requested year, so the user can choose which to simulate.
 */
async function getForeignCurrencies(year = null) {
  try {
    const db = await connect();
    const targetYear = year || new Date().getFullYear().toString();
    const result = await db.request()
      .input('year', sql.VarChar(4), targetYear)
      .query(`
        SELECT Curr_Code, Curr_Description AS Curr_Name, Kurs, Periode
        FROM vw_COGS_Currency_List
        WHERE Periode = @year
          AND Curr_Code <> 'IDR'
        ORDER BY Curr_Code
      `);
    return result.recordset || [];
  } catch (error) {
    console.error('Error in getForeignCurrencies:', error.message);
    throw error;
  }
}

/**
 * Given a set of foreign currency codes, return:
 *   - the materials that use those currencies (latest harga record per material)
 *   - the products that use those materials in their current-period formula
 * The frontend uses this to preview impact + drive product selection BEFORE
 * the generation SP is run.
 */
async function scanCurrencyImpact(currencyCodes) {
  try {
    if (!Array.isArray(currencyCodes) || currencyCodes.length === 0) {
      return { materials: [], products: [] };
    }

    const db = await connect();

    // Build a VALUES list for the currency filter; the SP-side code is fine with
    // simple interpolation because we validate inputs in the controller, but
    // here we use a parameterized table-valued approach via STRING_SPLIT to be safe.
    const cleanedCodes = currencyCodes
      .map(c => String(c).trim().toUpperCase())
      .filter(c => c && c !== 'IDR');

    if (cleanedCodes.length === 0) {
      return { materials: [], products: [] };
    }

    // Use the existing dbo.Split helper (STRING_SPLIT isn't available on this
    // DB's compatibility level). Hash-separator matches what the SPs use.
    const currencyList = cleanedCodes.join('#');
    const currentYear = new Date().getFullYear().toString();

    // Affected materials — the CURRENT (latest periode) row of each material
    // must be in one of the selected currencies. We pick the latest row per
    // material FIRST and only then filter by currency, so a material that
    // used to be in a foreign currency but has since switched to IDR is
    // correctly excluded (otherwise the old row would resurface and look
    // like it's still that currency).
    const materialsResult = await db.request()
      .input('codes', sql.VarChar(4000), currencyList)
      .input('year', sql.VarChar(4), currentYear)
      .query(`
        WITH latest AS (
          SELECT b.ITEM_ID,
                 b.ITEM_TYPE,
                 b.ITEM_PURCHASE_UNIT,
                 b.ITEM_PURCHASE_STD_PRICE,
                 b.ITEM_CURRENCY,
                 b.Periode,
                 ROW_NUMBER() OVER (PARTITION BY b.ITEM_ID ORDER BY b.Periode DESC) AS rn
          FROM M_COGS_STD_HRG_BAHAN b
        )
        SELECT l.ITEM_ID,
               COALESCE(m.Item_Name, l.ITEM_ID)         AS Item_Name,
               l.ITEM_TYPE,
               l.ITEM_PURCHASE_UNIT,
               l.ITEM_PURCHASE_STD_PRICE,
               l.ITEM_CURRENCY,
               c.Kurs                                   AS CurrentKurs,
               COALESCE(m.Item_Unit, l.ITEM_PURCHASE_UNIT) AS Item_Unit
        FROM latest l
        LEFT JOIN m_item_manufacturing m ON m.Item_ID = l.ITEM_ID
        LEFT JOIN vw_COGS_Currency_List c
               ON c.Curr_Code = l.ITEM_CURRENCY
              AND c.Periode = @year
        WHERE l.rn = 1
          AND l.ITEM_CURRENCY IN (SELECT LTRIM(RTRIM(items)) FROM dbo.Split(@codes, '#'))
        ORDER BY l.ITEM_CURRENCY, l.ITEM_ID
      `);
    const materials = materialsResult.recordset || [];

    if (materials.length === 0) {
      return { materials: [], products: [] };
    }

    // Affected products (current periode in t_COGS_HPP_Product_Header).
    // Use # as separator to be safe (some material IDs contain spaces / pipes).
    const materialIdList = materials.map(m => m.ITEM_ID).join('#');
    const productsResult = await db.request()
      .input('mats', sql.VarChar(sql.MAX), materialIdList)
      .query(`
        DECLARE @currentPeriode AS varchar(4);
        SELECT @currentPeriode = MAX(periode) FROM t_COGS_HPP_Product_Header;

        SELECT DISTINCT a.Product_ID, p.Product_Name, a.LOB
        FROM t_COGS_HPP_Product_Header a
        JOIN t_COGS_HPP_Product_Detail_Formula b ON a.Product_ID = b.Product_ID
        JOIN m_product p                         ON p.Product_ID = a.Product_ID
        WHERE a.Periode = @currentPeriode
          AND b.PPI_ItemID IN (SELECT LTRIM(RTRIM(items)) FROM dbo.Split(@mats, '#'))
        ORDER BY p.Product_Name
      `);
    const products = productsResult.recordset || [];

    return { materials, products };
  } catch (error) {
    console.error('Error in scanCurrencyImpact:', error.message);
    throw error;
  }
}

/**
 * Run the currency-changes generation stored procedure. Accepts:
 *   currencyChanges : [{ currCode, newKurs }, ...]
 *   productIds      : optional array of Product_IDs to include (others skipped)
 *   userId          : owner stamp written onto the newly created rows
 * Returns the SP's recordsets (before/after impact rows in the last recordset).
 */
async function generateCurrencyChangeSimulation(currencyChanges, productIds = null, userId = null) {
  try {
    const db = await connect();

    if (!Array.isArray(currencyChanges) || currencyChanges.length === 0) {
      throw new Error('currencyChanges must be a non-empty array');
    }

    const parameterString = currencyChanges
      .map(c => `${String(c.currCode).trim().toUpperCase()}:${Number(c.newKurs)}`)
      .join('#');

    // Product filter format expected by SP: '#PROD1#PROD2#' (or NULL)
    let productFilter = null;
    if (Array.isArray(productIds) && productIds.length > 0) {
      productFilter = '#' + productIds.map(p => String(p).trim()).filter(Boolean).join('#') + '#';
    }

    // Capture max id beforehand so we can stamp user_id onto the new rows.
    let maxIdBefore = 0;
    if (userId) {
      const maxIdResult = await db.request().query(
        `SELECT ISNULL(MAX(Simulasi_ID), 0) AS MaxId FROM t_COGS_HPP_Product_Header_Simulasi`
      );
      maxIdBefore = maxIdResult.recordset[0].MaxId;
    }

    const request = db.request()
      .input('var_data_perubahanCurrency', sql.NVarChar(4000), parameterString)
      .input('var_product_filter', sql.NVarChar(sql.MAX), productFilter);

    const result = await request.execute('sp_generate_simulasi_cogs_currency_changes');

    if (userId && maxIdBefore >= 0) {
      await db.request()
        .input('userId', sql.VarChar(50), userId)
        .input('maxIdBefore', sql.Int, maxIdBefore)
        .query(`UPDATE t_COGS_HPP_Product_Header_Simulasi
                SET user_id = @userId, process_date = GETDATE()
                WHERE Simulasi_ID > @maxIdBefore`);
    }

    return {
      recordsets: result.recordsets,
      rowsAffected: result.rowsAffected,
      returnValue: result.returnValue,
    };
  } catch (error) {
    console.error('Error in generateCurrencyChangeSimulation:', error.message);
    throw error;
  }
}

/**
 * Get before/after HPP impact rows for an already-generated Currency Changes
 * simulation group. Mirrors getPriceChangeAffectedProducts but filtered to the
 * 'Currency Changes' simulasi_type via the dedicated listing SP.
 */
async function getCurrencyChangeAffectedProducts(description, formattedDate) {
  try {
    const db = await connect();

    // Honor the Versi=1 selection state (set by the SP at generation time;
    // can later be edited via the existing select-products modal).
    const selectedIds = await db.request()
      .input('Description', sql.NVarChar(4000), description)
      .input('FormattedDate', sql.VarChar(50), formattedDate)
      .query(`
        SELECT Simulasi_ID, Product_ID
        FROM t_COGS_HPP_Product_Header_Simulasi
        WHERE Simulasi_Deskripsi = @Description
          AND CONVERT(varchar, Simulasi_Date, 121) = @FormattedDate
          AND Simulasi_Type = 'Currency Changes'
          AND Versi = '1'
      `);

    const selectedProductIds = new Set(selectedIds.recordset.map(r => r.Product_ID));

    const result = await db.request()
      .input('Simulasi_Deskripsi', sql.NVarChar(4000), description)
      .input('Simulasi_Date',      sql.VarChar(50),    formattedDate)
      .execute('sp_COGS_HPP_List_Simulasi_CurrencyChange');

    let rows = result.recordset || [];
    if (selectedProductIds.size > 0) {
      rows = rows.filter(r => selectedProductIds.has(r.Product_ID));
    }
    return rows;
  } catch (error) {
    console.error('Error in getCurrencyChangeAffectedProducts:', error.message);
    throw error;
  }
}
