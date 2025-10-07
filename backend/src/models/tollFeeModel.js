const { connect } = require('../../config/sqlserver');
const sql = require('mssql');

// CRUD operations for M_COGS_PEMBEBANAN_TollFee
class TollFeeModel {
  
  // Get all toll fee entries
  static async getAllTollFee() {
    try {
      const pool = await connect();
      const query = `
        SELECT 
          pk_id,
          ProductID,
          Toll_Fee,
          user_id,
          delegated_to,
          process_date,
          flag_update,
          from_update
        FROM M_COGS_PEMBEBANAN_TollFee
        ORDER BY process_date DESC, pk_id DESC
      `;
      
      const result = await pool.request().query(query);
      return result.recordset;
    } catch (error) {
      console.error('Error getting toll fee entries:', error);
      throw error;
    }
  }

  // Get toll fee entry by ID
  static async getTollFeeById(id) {
    try {
      const pool = await connect();
      const query = `
        SELECT 
          pk_id,
          ProductID,
          Toll_Fee,
          user_id,
          delegated_to,
          process_date,
          flag_update,
          from_update
        FROM M_COGS_PEMBEBANAN_TollFee
        WHERE pk_id = @id
      `;
      
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query(query);
        
      return result.recordset[0];
    } catch (error) {
      console.error('Error getting toll fee entry by ID:', error);
      throw error;
    }
  }

  // Get toll fee entries with filters
  static async getTollFeeFiltered(filters = {}) {
    try {
      const pool = await connect();
      let query = `
        SELECT 
          pk_id,
          ProductID,
          Toll_Fee,
          user_id,
          delegated_to,
          process_date,
          flag_update,
          from_update
        FROM M_COGS_PEMBEBANAN_TollFee
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
      console.error('Error getting filtered toll fee entries:', error);
      throw error;
    }
  }

  // Create new toll fee entry
  static async createTollFee(tollFeeData) {
    try {
      const pool = await connect();
      const query = `
        INSERT INTO M_COGS_PEMBEBANAN_TollFee (
          ProductID,
          Toll_Fee,
          user_id,
          delegated_to,
          process_date,
          flag_update,
          from_update
        )
        OUTPUT INSERTED.pk_id
        VALUES (
          @productId,
          @tollFee,
          @userId,
          @delegatedTo,
          @processDate,
          @flagUpdate,
          @fromUpdate
        )
      `;
      
      const result = await pool.request()
        .input('productId', sql.NVarChar, tollFeeData.productId)
        .input('tollFee', sql.Decimal(18,2), tollFeeData.tollFeeRate)
        .input('userId', sql.NVarChar, tollFeeData.userId)
        .input('delegatedTo', sql.NVarChar, tollFeeData.delegatedTo || null)
        .input('processDate', sql.DateTime, tollFeeData.processDate || new Date())
        .input('flagUpdate', sql.NVarChar, tollFeeData.flagUpdate || '0')
        .input('fromUpdate', sql.NVarChar, tollFeeData.fromUpdate || 'INSERT')
        .query(query);
        
      return { pk_id: result.recordset[0].pk_id, ...tollFeeData };
    } catch (error) {
      console.error('Error creating toll fee entry:', error);
      throw error;
    }
  }

  // Update toll fee entry
  static async updateTollFee(id, tollFeeData) {
    try {
      const pool = await connect();
      
      // First check if record exists
      const existingRecord = await this.getTollFeeById(id);
      if (!existingRecord) {
        throw new Error('Toll fee entry not found');
      }
      
      const query = `
        UPDATE M_COGS_PEMBEBANAN_TollFee
        SET 
          ProductID = @productId,
          Toll_Fee = @tollFee,
          user_id = @userId,
          delegated_to = @delegatedTo,
          process_date = @processDate,
          flag_update = @flagUpdate,
          from_update = @fromUpdate
        WHERE pk_id = @id
      `;
      
      await pool.request()
        .input('id', sql.Int, id)
        .input('productId', sql.NVarChar, tollFeeData.productId)
        .input('tollFee', sql.Decimal(18,2), tollFeeData.tollFeeRate)
        .input('userId', sql.NVarChar, tollFeeData.userId)
        .input('delegatedTo', sql.NVarChar, tollFeeData.delegatedTo || null)
        .input('processDate', sql.DateTime, tollFeeData.processDate || new Date())
        .input('flagUpdate', sql.NVarChar, tollFeeData.flagUpdate || '1')
        .input('fromUpdate', sql.NVarChar, tollFeeData.fromUpdate || 'UPDATE')
        .query(query);
        
      return { pk_id: id, ...tollFeeData };
    } catch (error) {
      console.error('Error updating toll fee entry:', error);
      throw error;
    }
  }

  // Delete toll fee entry
  static async deleteTollFee(id) {
    try {
      const pool = await connect();
      
      // First check if record exists
      const existingRecord = await this.getTollFeeById(id);
      if (!existingRecord) {
        throw new Error('Toll fee entry not found');
      }
      
      const query = `
        DELETE FROM M_COGS_PEMBEBANAN_TollFee
        WHERE pk_id = @id
      `;
      
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query(query);
        
      return { deleted: true, pk_id: id };
    } catch (error) {
      console.error('Error deleting toll fee entry:', error);
      throw error;
    }
  }

  // Bulk delete toll fee entries
  static async bulkDeleteTollFee(ids) {
    try {
      const pool = await connect();
      
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error('Invalid or empty ID array provided');
      }
      
      // Create parameter placeholders for IN clause
      const placeholders = ids.map((_, index) => `@id${index}`).join(',');
      const query = `
        DELETE FROM M_COGS_PEMBEBANAN_TollFee
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
      console.error('Error bulk deleting toll fee entries:', error);
      throw error;
    }
  }

  // Bulk insert toll fee entries (for import)
  static async bulkInsertTollFee(tollFeeEntries) {
    try {
      const pool = await connect();
      
      if (!Array.isArray(tollFeeEntries) || tollFeeEntries.length === 0) {
        throw new Error('Invalid or empty toll fee entries array provided');
      }
      
      // Use table-valued parameter for efficient bulk insert
      const table = new sql.Table('M_COGS_PEMBEBANAN_TollFee');
      table.create = false; // Don't create the table, it already exists
      
      // Define columns (excluding pk_id as it's identity)
      table.columns.add('ProductID', sql.NVarChar(50), { nullable: true });
      table.columns.add('Toll_Fee', sql.Decimal(18,2), { nullable: true });
      table.columns.add('user_id', sql.NVarChar(50), { nullable: true });
      table.columns.add('delegated_to', sql.NVarChar(50), { nullable: true });
      table.columns.add('process_date', sql.DateTime, { nullable: true });
      table.columns.add('flag_update', sql.NVarChar(50), { nullable: true });
      table.columns.add('from_update', sql.NVarChar(50), { nullable: true });
      
      // Add rows to table
      tollFeeEntries.forEach(entry => {
        table.rows.add(
          entry.productId || null,
          parseFloat(entry.tollFeeRate) || 0,
          entry.userId || 'SYSTEM',
          entry.delegatedTo || null,
          entry.processDate || new Date(),
          entry.flagUpdate || '0',
          entry.fromUpdate || 'BULK_INSERT'
        );
      });
      
      // Execute bulk insert
      const request = pool.request();
      const result = await request.bulk(table);
      
      return { 
        inserted: true, 
        insertedCount: result.rowsAffected,
        entries: tollFeeEntries 
      };
    } catch (error) {
      console.error('Error bulk inserting toll fee entries:', error);
      throw error;
    }
  }

  // Get toll fee entries with product information (if needed for joins)
  static async getTollFeeWithProductInfo() {
    try {
      const pool = await connect();
      const query = `
        SELECT 
          t.pk_id,
          t.ProductID,
          t.Toll_Fee,
          t.user_id,
          t.delegated_to,
          t.process_date,
          t.flag_update,
          t.from_update,
          -- Add product name if available from other tables
          COALESCE(p.ProductName, 'Unknown Product') as ProductName
        FROM M_COGS_PEMBEBANAN_TollFee t
        LEFT JOIN (
          -- This would be your product master table - adjust table name as needed
          SELECT DISTINCT ProductID, 
                 FIRST_VALUE(ProductName) OVER (PARTITION BY ProductID ORDER BY pk_id DESC) as ProductName
          FROM M_COGS_PRODUCT_GROUP_MANUAL
        ) p ON t.ProductID = p.ProductID
        ORDER BY t.process_date DESC, t.pk_id DESC
      `;
      
      const result = await pool.request().query(query);
      return result.recordset;
    } catch (error) {
      console.error('Error getting toll fee entries with product info:', error);
      throw error;
    }
  }

  // Check if ProductID exists (for validation)
  static async validateProductId(productId) {
    try {
      const pool = await connect();
      const query = `
        SELECT COUNT(*) as count
        FROM M_COGS_PEMBEBANAN_TollFee
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

  // Get toll fee statistics (for dashboard/reporting if needed)
  static async getTollFeeStats() {
    try {
      const pool = await connect();
      const query = `
        SELECT 
          COUNT(*) as totalEntries,
          AVG(Toll_Fee) as averageTollFee,
          MIN(Toll_Fee) as minTollFee,
          MAX(Toll_Fee) as maxTollFee,
          SUM(Toll_Fee) as totalTollFee,
          COUNT(DISTINCT ProductID) as uniqueProducts,
          COUNT(DISTINCT user_id) as uniqueUsers
        FROM M_COGS_PEMBEBANAN_TollFee
      `;
      
      const result = await pool.request().query(query);
      return result.recordset[0];
    } catch (error) {
      console.error('Error getting toll fee statistics:', error);
      throw error;
    }
  }
}

module.exports = TollFeeModel;