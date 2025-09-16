const { connect } = require('../../config/sqlserver');
const sql = require('mssql');

async function getHPP() {
  try {
    const db = await connect();
    const result = await db.request().query(`exec sp_COGS_HPP_List`);
    
    // The stored procedure returns multiple result sets
    return {
      ethical: result.recordsets[0] || [],
      generik1: result.recordsets[1] || [],
      generik2: result.recordsets[2] || []
    };
  } catch (error) {
    console.error('Error executing getHPP query:', error);
    throw error;
  }
}

// Generate HPP calculation using stored procedure
async function generateHPPCalculation(periode = '2025') {
  try {
    const db = await connect();
    // Hardcoded parameters: ethical = '0', generik = '1'
    const query = `exec sp_COGS_GenerateHPP @periode, '0', '1'`;
    
    await db.request()
      .input('periode', sql.VarChar(4), periode)
      .query(query);
    
    return { 
      success: true, 
      message: `HPP calculation completed for period ${periode}` 
    };
  } catch (error) {
    console.error('Error executing HPP calculation:', error);
    throw error;
  }
}

// Generate HPP simulation for existing product with selected formulas
async function generateHPPSimulation(productId, formulaString) {
  try {
    const db = await connect();
    const query = `exec sp_generate_simulasi_cogs_product_existing @productId, @formulaString`;
    
    const result = await db.request()
      .input('productId', sql.VarChar(10), productId)
      .input('formulaString', sql.VarChar(50), formulaString)
      .query(query);
    
    // Return the first recordset from the stored procedure
    return result.recordset || [];
  } catch (error) {
    console.error('Error executing HPP simulation:', error);
    throw error;
  }
}

// Get simulation header details by Simulasi_ID
async function getSimulationHeader(simulasiId) {
  try {
    const db = await connect();
    const query = `SELECT * FROM t_COGS_HPP_Product_Header_Simulasi WHERE Simulasi_ID = @simulasiId`;
    
    const result = await db.request()
      .input('simulasiId', sql.VarChar(20), simulasiId)
      .query(query);
    
    return result.recordset || [];
  } catch (error) {
    console.error('Error fetching simulation header:', error);
    throw error;
  }
}

// Get simulation detail materials by Simulasi_ID  
async function getSimulationDetailBahan(simulasiId) {
  try {
    const db = await connect();
    const query = `SELECT * FROM dbo.t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan WHERE Simulasi_ID = @simulasiId`;
    
    const result = await db.request()
      .input('simulasiId', sql.VarChar(20), simulasiId)
      .query(query);
    
    return result.recordset || [];
  } catch (error) {
    console.error('Error fetching simulation detail bahan:', error);
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
    
    const result = await db.request()
      .input('SimulasiId', sql.Int, simulasiId)
      .input('SimulasiDeskripsi', sql.VarChar(255), headerData.Simulasi_Deskripsi || '')
      .input('GroupRendemen', sql.Decimal(10, 2), headerData.Group_Rendemen || 100)
      .input('BatchSize', sql.Int, headerData.Batch_Size || 1)
      .input('LOB', sql.VarChar(20), headerData.LOB || 'ETHICAL')
      .input('Versi', sql.VarChar(10), headerData.Versi || '1')
      .input('MHProsesStd', sql.Decimal(10, 2), headerData.MH_Proses_Std || 0)
      .input('MHKemasStd', sql.Decimal(10, 2), headerData.MH_Kemas_Std || 0)
      .input('MHAnalisaStd', sql.Decimal(10, 2), headerData.MH_Analisa_Std || 0)
      .input('MHTimbangBB', sql.Decimal(10, 2), headerData.MH_Timbang_BB || 0)
      .input('MHTimbangBK', sql.Decimal(10, 2), headerData.MH_Timbang_BK || 0)
      .input('MHMesinStd', sql.Decimal(10, 2), headerData.MH_Mesin_Std || 0)
      .input('BiayaProses', sql.Decimal(18, 2), headerData.Biaya_Proses || 0)
      .input('BiayaKemas', sql.Decimal(18, 2), headerData.Biaya_Kemas || 0)
      .input('BiayaGenerik', sql.Decimal(18, 2), headerData.Biaya_Generik || null)
      .input('BiayaReagen', sql.Decimal(18, 2), headerData.Biaya_Reagen || null)
      .input('TollFee', sql.Decimal(18, 2), headerData.Toll_Fee || null)
      .input('RatePLN', sql.Decimal(18, 2), headerData.Rate_PLN || 0)
      .input('DirectLabor', sql.Decimal(18, 2), headerData.Direct_Labor || 0)
      .input('FactoryOverHead', sql.Decimal(18, 2), headerData.Factory_Over_Head || 0)
      .input('Depresiasi', sql.Decimal(18, 2), headerData.Depresiasi || 0)
      .input('BebanSisaBahanExp', sql.Decimal(18, 2), headerData.Beban_Sisa_Bahan_Exp || null)
      .query(query);
    
    return result.rowsAffected[0];
  } catch (error) {
    console.error('Error updating simulation header:', error);
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
    
    console.log('Generated Simulasi_ID:', nextSimulasiId);
    
    const query = `
      INSERT INTO t_COGS_HPP_Product_Header_Simulasi (
        Simulasi_ID, Product_ID, Product_Name, Formula, Group_PNCategory, Group_PNCategory_Dept, Periode,
        Simulasi_Deskripsi, Simulasi_Date, Simulasi_Type, Group_Rendemen, Batch_Size, LOB, Versi,
        MH_Proses_Std, MH_Kemas_Std, MH_Analisa_Std, MH_Timbang_BB, MH_Timbang_BK, MH_Mesin_Std,
        Biaya_Proses, Biaya_Kemas, Biaya_Generik, Biaya_Reagen, Toll_Fee, Rate_PLN,
        Direct_Labor, Factory_Over_Head, Depresiasi, Beban_Sisa_Bahan_Exp
      ) 
      VALUES (
        @SimulasiID, @ProductID, @ProductName, @Formula, @GroupPNCategory, @GroupPNCategoryDept, @Periode,
        @SimulasiDeskripsi, @SimulasiDate, @SimulasiType, @GroupRendemen, @BatchSize, @LOB, @Versi,
        @MHProsesStd, @MHKemasStd, @MHAnalisaStd, @MHTimbangBB, @MHTimbangBK, @MHMesinStd,
        @BiayaProses, @BiayaKemas, @BiayaGenerik, @BiayaReagen, @TollFee, @RatePLN,
        @DirectLabor, @FactoryOverHead, @Depresiasi, @BebanSisaBahanExp
      )
    `;
    
    await db.request()
      .input('SimulasiID', sql.Int, nextSimulasiId)
      .input('ProductID', sql.VarChar(10), headerData.Product_ID || null)
      .input('ProductName', sql.VarChar(100), headerData.Product_Name || '')
      .input('Formula', sql.VarChar(100), headerData.Formula || '')
      .input('GroupPNCategory', sql.VarChar(10), headerData.Group_PNCategory || null)
      .input('GroupPNCategoryDept', sql.VarChar(50), headerData.Group_PNCategory_Dept || '')
      .input('Periode', sql.VarChar(4), headerData.Periode || '2025')
      .input('SimulasiDeskripsi', sql.VarChar(255), headerData.Simulasi_Deskripsi || '')
      .input('SimulasiDate', sql.DateTime, new Date())
      .input('SimulasiType', sql.VarChar(50), 'Custom Formula')
      .input('GroupRendemen', sql.Decimal(10, 2), headerData.Group_Rendemen || 100)
      .input('BatchSize', sql.Int, headerData.Batch_Size || 1)
      .input('LOB', sql.VarChar(20), headerData.LOB || 'ETHICAL')
      .input('Versi', sql.VarChar(10), headerData.Versi || '1')
      .input('MHProsesStd', sql.Decimal(10, 2), headerData.MH_Proses_Std || 0)
      .input('MHKemasStd', sql.Decimal(10, 2), headerData.MH_Kemas_Std || 0)
      .input('MHAnalisaStd', sql.Decimal(10, 2), headerData.MH_Analisa_Std || 0)
      .input('MHTimbangBB', sql.Decimal(10, 2), headerData.MH_Timbang_BB || 0)
      .input('MHTimbangBK', sql.Decimal(10, 2), headerData.MH_Timbang_BK || 0)
      .input('MHMesinStd', sql.Decimal(10, 2), headerData.MH_Mesin_Std || 0)
      .input('BiayaProses', sql.Decimal(18, 2), headerData.Biaya_Proses || 0)
      .input('BiayaKemas', sql.Decimal(18, 2), headerData.Biaya_Kemas || 0)
      .input('BiayaGenerik', sql.Decimal(18, 2), headerData.Biaya_Generik || null)
      .input('BiayaReagen', sql.Decimal(18, 2), headerData.Biaya_Reagen || null)
      .input('TollFee', sql.Decimal(18, 2), headerData.Toll_Fee || null)
      .input('RatePLN', sql.Decimal(18, 2), headerData.Rate_PLN || 0)
      .input('DirectLabor', sql.Decimal(18, 2), headerData.Direct_Labor || 0)
      .input('FactoryOverHead', sql.Decimal(18, 2), headerData.Factory_Over_Head || 0)
      .input('Depresiasi', sql.Decimal(18, 2), headerData.Depresiasi || 0)
      .input('BebanSisaBahanExp', sql.Decimal(18, 2), headerData.Beban_Sisa_Bahan_Exp || null)
      .query(query);
    
    return nextSimulasiId;
  } catch (error) {
    console.error('Error creating simulation header:', error);
    throw error;
  }
}

// Delete all materials for a simulation
async function deleteSimulationMaterials(simulasiId) {
  try {
    const db = await connect();
    const query = `DELETE FROM t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan WHERE Simulasi_ID = @SimulasiId`;
    
    const result = await db.request()
      .input('SimulasiId', sql.Int, simulasiId)
      .query(query);
    
    return result.rowsAffected[0];
  } catch (error) {
    console.error('Error deleting simulation materials:', error);
    throw error;
  }
}

// Bulk insert materials for a simulation
async function insertSimulationMaterials(simulasiId, materials, periode = '2025') {
  try {
    const db = await connect();
    
    if (!materials || materials.length === 0) {
      return 0;
    }
    
    // Use parameterized queries to prevent SQL injection
    const insertPromises = materials.map((material, index) => {
      return db.request()
        .input('periode', sql.VarChar(4), periode)
        .input('simulasiId', sql.Int, simulasiId)
        .input('seqId', sql.Int, index + 1)
        .input('tipeBahan', sql.VarChar(10), material.Tipe_Bahan)
        .input('itemId', sql.VarChar(20), material.Item_ID)
        .input('itemName', sql.VarChar(255), material.Item_Name)
        .input('itemQty', sql.Decimal(18, 4), material.Item_QTY)
        .input('itemUnit', sql.VarChar(10), material.Item_Unit)
        .input('itemUnitPrice', sql.Decimal(18, 4), material.Item_Unit_Price)
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
    console.error('Error inserting simulation materials:', error);
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
    console.error('Error executing getSimulationList query:', error);
    throw error;
  }
}

// Delete simulation record and its related materials
async function deleteSimulation(simulasiId) {
  try {
    const db = await connect();
    
    // First delete related materials
    const deleteMaterialsQuery = `DELETE FROM t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan WHERE Simulasi_ID = @SimulasiId`;
    const materialsResult = await db.request()
      .input('SimulasiId', sql.Int, simulasiId)
      .query(deleteMaterialsQuery);
    
    // Then delete the header
    const deleteHeaderQuery = `DELETE FROM t_COGS_HPP_Product_Header_Simulasi WHERE Simulasi_ID = @SimulasiId`;
    const headerResult = await db.request()
      .input('SimulasiId', sql.Int, simulasiId)
      .query(deleteHeaderQuery);
    
    return {
      materialsDeleted: materialsResult.rowsAffected[0] || 0,
      headerDeleted: headerResult.rowsAffected[0] || 0
    };
  } catch (error) {
    console.error('Error executing deleteSimulation query:', error);
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
};