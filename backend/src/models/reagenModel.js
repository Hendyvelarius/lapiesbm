const { connect } = require('../../config/sqlserver');
const sql = require('mssql');

// CRUD operations for M_COGS_PEMBEBANAN_REAGEN
class ReagenModel {
  
  // Get all reagen entries
  static async getAllReagen() {
    try {
      const pool = await connect();
      const query = `
        SELECT 
          pk_id,
          ProductID,
          Reagen_Rate,
          user_id,
          delegated_to,
          process_date,
          flag_update,
          from_update
        FROM M_COGS_PEMBEBANAN_REAGEN
        ORDER BY process_date DESC, pk_id DESC
      `;
      
      const result = await pool.request().query(query);
      return result.recordset;
    } catch (error) {
      console.error('Error getting reagen entries:', error);
      throw error;
    }
  }

  // Get reagen entry by ID
  static async getReagenById(id) {
    try {
      const pool = await connect();
      const query = `
        SELECT 
          pk_id,
          ProductID,
          Reagen_Rate,
          user_id,
          delegated_to,
          process_date,
          flag_update,
          from_update
        FROM M_COGS_PEMBEBANAN_REAGEN
        WHERE pk_id = @id
      `;
      
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query(query);
        
      return result.recordset[0];
    } catch (error) {
      console.error('Error getting reagen entry by ID:', error);
      throw error;
    }
  }

  // Get reagen entries with filters
  static async getReagenFiltered(filters = {}) {
    try {
      const pool = await connect();
      let query = `
        SELECT 
          pk_id,
          ProductID,
          Reagen_Rate,
          user_id,
          delegated_to,
          process_date,
          flag_update,
          from_update
        FROM M_COGS_PEMBEBANAN_REAGEN
        WHERE 1=1
      `;
      
      const request = pool.request();
      
      // Add filters
      if (filters.productId) {
        query += ` AND ProductID LIKE @productId`;
        request.input('productId', sql.NVarChar, `%${filters.productId}%`);
      }
      
      if (filters.userId) {
        query += ` AND user_id = @userId`;
        request.input('userId', sql.NVarChar, filters.userId);
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
      console.error('Error getting filtered reagen entries:', error);
      throw error;
    }
  }

  // Create new reagen entry
  static async createReagen(reagenData) {
    try {
      const pool = await connect();
      const query = `
        INSERT INTO M_COGS_PEMBEBANAN_REAGEN (
          ProductID,
          Reagen_Rate,
          user_id,
          delegated_to,
          process_date,
          flag_update,
          from_update
        )
        OUTPUT INSERTED.pk_id
        VALUES (
          @productId,
          @reagenRate,
          @userId,
          @delegatedTo,
          @processDate,
          @flagUpdate,
          @fromUpdate
        )
      `;
      
      const result = await pool.request()
        .input('productId', sql.NVarChar, reagenData.productId)
        .input('reagenRate', sql.Decimal(18,4), reagenData.reagenRate)
        .input('userId', sql.NVarChar, reagenData.userId)
        .input('delegatedTo', sql.NVarChar, reagenData.delegatedTo || null)
        .input('processDate', sql.DateTime, reagenData.processDate || new Date())
        .input('flagUpdate', sql.Bit, reagenData.flagUpdate || 0)
        .input('fromUpdate', sql.NVarChar, reagenData.fromUpdate || 'INSERT')
        .query(query);
        
      return { pk_id: result.recordset[0].pk_id, ...reagenData };
    } catch (error) {
      console.error('Error creating reagen entry:', error);
      throw error;
    }
  }

  // Update reagen entry
  static async updateReagen(id, reagenData) {
    try {
      const pool = await connect();
      
      // First check if record exists
      const existingRecord = await this.getReagenById(id);
      if (!existingRecord) {
        throw new Error('Reagen entry not found');
      }
      
      const query = `
        UPDATE M_COGS_PEMBEBANAN_REAGEN
        SET 
          ProductID = @productId,
          Reagen_Rate = @reagenRate,
          user_id = @userId,
          delegated_to = @delegatedTo,
          process_date = @processDate,
          flag_update = @flagUpdate,
          from_update = @fromUpdate
        WHERE pk_id = @id
      `;
      
      await pool.request()
        .input('id', sql.Int, id)
        .input('productId', sql.NVarChar, reagenData.productId)
        .input('reagenRate', sql.Decimal(18,4), reagenData.reagenRate)
        .input('userId', sql.NVarChar, reagenData.userId)
        .input('delegatedTo', sql.NVarChar, reagenData.delegatedTo || null)
        .input('processDate', sql.DateTime, reagenData.processDate || new Date())
        .input('flagUpdate', sql.Bit, reagenData.flagUpdate || 1)
        .input('fromUpdate', sql.NVarChar, reagenData.fromUpdate || 'UPDATE')
        .query(query);
        
      return { pk_id: id, ...reagenData };
    } catch (error) {
      console.error('Error updating reagen entry:', error);
      throw error;
    }
  }

  // Delete reagen entry
  static async deleteReagen(id) {
    try {
      const pool = await connect();
      
      // First check if record exists
      const existingRecord = await this.getReagenById(id);
      if (!existingRecord) {
        throw new Error('Reagen entry not found');
      }
      
      const query = `
        DELETE FROM M_COGS_PEMBEBANAN_REAGEN
        WHERE pk_id = @id
      `;
      
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query(query);
        
      return { deleted: true, pk_id: id };
    } catch (error) {
      console.error('Error deleting reagen entry:', error);
      throw error;
    }
  }

  // Bulk delete reagen entries
  static async bulkDeleteReagen(ids) {
    try {
      const pool = await connect();
      
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error('Invalid or empty ID array provided');
      }
      
      // Create parameter placeholders for IN clause
      const placeholders = ids.map((_, index) => `@id${index}`).join(',');
      const query = `
        DELETE FROM M_COGS_PEMBEBANAN_REAGEN
        WHERE pk_id IN (${placeholders})
      `;
      
      const request = pool.request();
      ids.forEach((id, index) => {
        request.input(`id${index}`, sql.Int, id);
      });
      
      const result = await request.query(query);
      
      return { 
        deleted: true, 
        deletedCount: result.rowsAffected[0],
        deletedIds: ids 
      };
    } catch (error) {
      console.error('Error bulk deleting reagen entries:', error);
      throw error;
    }
  }

  // Bulk insert reagen entries (for import)
  static async bulkInsertReagen(reagenEntries) {
    try {
      const pool = await connect();
      
      if (!Array.isArray(reagenEntries) || reagenEntries.length === 0) {
        throw new Error('Invalid or empty reagen entries array provided');
      }
      
      // Use table-valued parameter for efficient bulk insert
      const table = new sql.Table('M_COGS_PEMBEBANAN_REAGEN');
      table.create = false; // Don't create the table, it already exists
      
      // Define columns
      table.columns.add('ProductID', sql.NVarChar(50), { nullable: false });
      table.columns.add('Reagen_Rate', sql.Decimal(18,4), { nullable: false });
      table.columns.add('user_id', sql.NVarChar(50), { nullable: true });
      table.columns.add('delegated_to', sql.NVarChar(50), { nullable: true });
      table.columns.add('process_date', sql.DateTime, { nullable: true });
      table.columns.add('flag_update', sql.Bit, { nullable: true });
      table.columns.add('from_update', sql.NVarChar(50), { nullable: true });
      
      // Add rows to table
      reagenEntries.forEach(entry => {
        table.rows.add(
          entry.productId,
          entry.reagenRate || 0,
          entry.userId || 'SYSTEM',
          entry.delegatedTo || null,
          entry.processDate || new Date(),
          entry.flagUpdate || 0,
          entry.fromUpdate || 'BULK_INSERT'
        );
      });
      
      // Execute bulk insert
      const request = pool.request();
      const result = await request.bulk(table);
      
      return { 
        inserted: true, 
        insertedCount: result.rowsAffected,
        entries: reagenEntries 
      };
    } catch (error) {
      console.error('Error bulk inserting reagen entries:', error);
      throw error;
    }
  }

  // Get reagen entries with product information (if needed for joins)
  static async getReagenWithProductInfo() {
    try {
      const pool = await connect();
      const query = `
        SELECT 
          r.pk_id,
          r.ProductID,
          r.Reagen_Rate,
          r.user_id,
          r.delegated_to,
          r.process_date,
          r.flag_update,
          r.from_update,
          -- Add product name if available from other tables
          COALESCE(p.ProductName, 'Unknown Product') as ProductName
        FROM M_COGS_PEMBEBANAN_REAGEN r
        LEFT JOIN (
          -- This would be your product master table - adjust table name as needed
          SELECT DISTINCT ProductID, 
                 FIRST_VALUE(ProductName) OVER (PARTITION BY ProductID ORDER BY pk_id DESC) as ProductName
          FROM M_COGS_PRODUCT_GROUP_MANUAL
        ) p ON r.ProductID = p.ProductID
        ORDER BY r.process_date DESC, r.pk_id DESC
      `;
      
      const result = await pool.request().query(query);
      return result.recordset;
    } catch (error) {
      console.error('Error getting reagen entries with product info:', error);
      throw error;
    }
  }

  // Check if ProductID exists (for validation)
  static async validateProductId(productId) {
    try {
      const pool = await connect();
      const query = `
        SELECT COUNT(*) as count
        FROM M_COGS_PEMBEBANAN_REAGEN
        WHERE ProductID = @productId
      `;
      
      const result = await pool.request()
        .input('productId', sql.NVarChar, productId)
        .query(query);
        
      return result.recordset[0].count > 0;
    } catch (error) {
      console.error('Error validating product ID:', error);
      throw error;
    }
  }
}

module.exports = ReagenModel;