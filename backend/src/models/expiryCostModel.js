const { connect } = require('../../config/sqlserver');
const sql = require('mssql');

// CRUD operations for M_COGS_BEBAN_SISA_BAHAN_EXP
class ExpiryCostModel {
  
  // Get all expired material entries
  static async getAllExpiredMaterials() {
    try {
      const pool = await connect();
      const query = `
        SELECT 
          pk_id,
          PERIODE,
          ITEM_ID,
          ITEM_UNIT,
          ITEM_QTY,
          user_id,
          delegated_to,
          process_date,
          flag_update,
          from_update,
          createdAt,
          updatedAt
        FROM M_COGS_BEBAN_SISA_BAHAN_EXP
        ORDER BY process_date DESC, pk_id DESC
      `;
      
      const result = await pool.request().query(query);
      return result.recordset;
    } catch (error) {
      console.error('Error getting expired materials:', error);
      throw error;
    }
  }

  // Get expired material by ID
  static async getExpiredMaterialById(id) {
    try {
      const pool = await connect();
      const query = `
        SELECT 
          pk_id,
          PERIODE,
          ITEM_ID,
          ITEM_UNIT,
          ITEM_QTY,
          user_id,
          delegated_to,
          process_date,
          flag_update,
          from_update,
          createdAt,
          updatedAt
        FROM M_COGS_BEBAN_SISA_BAHAN_EXP
        WHERE pk_id = @id
      `;
      
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query(query);
      
      return result.recordset[0];
    } catch (error) {
      console.error('Error getting expired material by ID:', error);
      throw error;
    }
  }

  // Create new expired material entry
  static async createExpiredMaterial(data) {
    try {
      const pool = await connect();
      const currentDateTime = new Date();
      
      const query = `
        INSERT INTO M_COGS_BEBAN_SISA_BAHAN_EXP 
        (PERIODE, ITEM_ID, ITEM_UNIT, ITEM_QTY, user_id, delegated_to, process_date, flag_update, from_update)
        VALUES (@periode, @itemId, @itemUnit, @itemQty, @userId, @delegatedTo, @processDate, @flagUpdate, @fromUpdate);
        
        SELECT SCOPE_IDENTITY() AS pk_id;
      `;
      
      const result = await pool.request()
        .input('periode', sql.VarChar(10), data.periode || new Date().getFullYear().toString())
        .input('itemId', sql.VarChar(50), data.itemId)
        .input('itemUnit', sql.VarChar(10), data.itemUnit)
        .input('itemQty', sql.Decimal(18, 2), data.itemQty)
        .input('userId', sql.VarChar(50), data.userId || 'SYSTEM')
        .input('delegatedTo', sql.VarChar(50), data.delegatedTo || data.userId || 'SYSTEM')
        .input('processDate', sql.DateTime, data.processDate || currentDateTime)
        .input('flagUpdate', sql.VarChar(10), data.flagUpdate || null)
        .input('fromUpdate', sql.VarChar(50), data.fromUpdate || null)
        .query(query);
      
      const newId = result.recordset[0].pk_id;
      return await this.getExpiredMaterialById(newId);
    } catch (error) {
      console.error('Error creating expired material:', error);
      throw error;
    }
  }

  // Update expired material entry
  static async updateExpiredMaterial(id, data) {
    try {
      const pool = await connect();
      const currentDateTime = new Date();
      
      const query = `
        UPDATE M_COGS_BEBAN_SISA_BAHAN_EXP 
        SET 
          PERIODE = @periode,
          ITEM_ID = @itemId,
          ITEM_UNIT = @itemUnit,
          ITEM_QTY = @itemQty,
          user_id = @userId,
          delegated_to = @delegatedTo,
          process_date = @processDate,
          flag_update = @flagUpdate,
          from_update = @fromUpdate,
          updatedAt = @updatedAt
        WHERE pk_id = @id
      `;
      
      const result = await pool.request()
        .input('id', sql.Int, id)
        .input('periode', sql.VarChar(10), data.periode)
        .input('itemId', sql.VarChar(50), data.itemId)
        .input('itemUnit', sql.VarChar(10), data.itemUnit)
        .input('itemQty', sql.Decimal(18, 2), data.itemQty)
        .input('userId', sql.VarChar(50), data.userId)
        .input('delegatedTo', sql.VarChar(50), data.delegatedTo || data.userId)
        .input('processDate', sql.DateTime, data.processDate || currentDateTime)
        .input('flagUpdate', sql.VarChar(10), data.flagUpdate || null)
        .input('fromUpdate', sql.VarChar(50), data.fromUpdate || null)
        .input('updatedAt', sql.DateTime, currentDateTime)
        .query(query);
      
      return await this.getExpiredMaterialById(id);
    } catch (error) {
      console.error('Error updating expired material:', error);
      throw error;
    }
  }

  // Delete expired material entry
  static async deleteExpiredMaterial(id) {
    try {
      const pool = await connect();
      const query = `DELETE FROM M_COGS_BEBAN_SISA_BAHAN_EXP WHERE pk_id = @id`;
      
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query(query);
      
      return result.rowsAffected[0] > 0;
    } catch (error) {
      console.error('Error deleting expired material:', error);
      throw error;
    }
  }

  // Get expired cost allocation (read-only view)
  static async getExpiredCostAllocation() {
    try {
      const pool = await connect();
      const query = `
        SELECT * FROM M_COGS_PEMBEBANAN_EXPIRED
        ORDER BY periode DESC, item_id
      `;
      
      const result = await pool.request().query(query);
      return result.recordset;
    } catch (error) {
      console.error('Error getting expired cost allocation:', error);
      throw error;
    }
  }

  // Generate expiry cost allocation by executing stored procedure
  static async generateExpiryCostAllocation(periode) {
    try {
      const pool = await connect();
      const query = `EXEC sp_COGS_GeneratePembebananSisaBahanExp @periode`;
      
      await pool.request()
        .input('periode', sql.VarChar(10), periode)
        .query(query);
        
      return { success: true, message: `Expiry cost allocation generated for period ${periode}` };
    } catch (error) {
      console.error('Error generating expiry cost allocation:', error);
      throw error;
    }
  }

  // Filter expired materials by criteria
  static async getExpiredMaterialsFiltered(filters = {}) {
    try {
      const pool = await connect();
      let query = `
        SELECT 
          pk_id,
          PERIODE,
          ITEM_ID,
          ITEM_UNIT,
          ITEM_QTY,
          user_id,
          delegated_to,
          process_date,
          flag_update,
          from_update,
          createdAt,
          updatedAt
        FROM M_COGS_BEBAN_SISA_BAHAN_EXP
        WHERE 1=1
      `;
      
      const request = pool.request();
      
      if (filters.periode) {
        query += ` AND PERIODE = @periode`;
        request.input('periode', sql.VarChar(10), filters.periode);
      }
      
      if (filters.itemId) {
        query += ` AND ITEM_ID LIKE @itemId`;
        request.input('itemId', sql.VarChar(50), `%${filters.itemId}%`);
      }
      
      if (filters.userId) {
        query += ` AND user_id = @userId`;
        request.input('userId', sql.VarChar(50), filters.userId);
      }
      
      if (filters.dateFrom) {
        query += ` AND process_date >= @dateFrom`;
        request.input('dateFrom', sql.DateTime, filters.dateFrom);
      }
      
      if (filters.dateTo) {
        query += ` AND process_date <= @dateTo`;
        request.input('dateTo', sql.DateTime, filters.dateTo);
      }
      
      query += ` ORDER BY process_date DESC, pk_id DESC`;
      
      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      console.error('Error filtering expired materials:', error);
      throw error;
    }
  }
}

module.exports = ExpiryCostModel;
