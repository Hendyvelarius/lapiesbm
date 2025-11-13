const TollFeeModel = require('../models/tollFeeModel');

class TollFeeController {
  
  // Get all toll fee entries
  static async getAllTollFee(req, res) {
    try {
      const { productId, userId, dateFrom, dateTo, withProductInfo } = req.query;
      
      // If there are filters, use filtered method
      if (productId || userId || dateFrom || dateTo) {
        const filters = {
          productId,
          userId,
          dateFrom: dateFrom ? new Date(dateFrom) : null,
          dateTo: dateTo ? new Date(dateTo) : null
        };
        
        const tollFeeEntries = await TollFeeModel.getTollFeeFiltered(filters);
        
        res.status(200).json({
          success: true,
          data: tollFeeEntries,
          message: `Found ${tollFeeEntries.length} toll fee entries with filters`
        });
      } else if (withProductInfo === 'true') {
        // Get entries with product information
        const tollFeeEntries = await TollFeeModel.getTollFeeWithProductInfo();
        
        res.status(200).json({
          success: true,
          data: tollFeeEntries,
          message: `Found ${tollFeeEntries.length} toll fee entries with product info`
        });
      } else {
        // Get all entries without filters
        const tollFeeEntries = await TollFeeModel.getAllTollFee();
        
        res.status(200).json({
          success: true,
          data: tollFeeEntries,
          message: `Found ${tollFeeEntries.length} toll fee entries`
        });
      }
    } catch (error) {
      console.error('Error in getAllTollFee controller:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving toll fee entries',
        error: error.message
      });
    }
  }

  // Get toll fee entry by ID
  static async getTollFeeById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or missing toll fee entry ID'
        });
      }
      
      const tollFeeEntry = await TollFeeModel.getTollFeeById(parseInt(id));
      
      if (!tollFeeEntry) {
        return res.status(404).json({
          success: false,
          message: 'Toll fee entry not found'
        });
      }
      
      res.status(200).json({
        success: true,
        data: tollFeeEntry,
        message: 'Toll fee entry retrieved successfully'
      });
    } catch (error) {
      console.error('Error in getTollFeeById controller:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving toll fee entry',
        error: error.message
      });
    }
  }

  // Create new toll fee entry
  static async createTollFee(req, res) {
    try {
      const { productId, tollFeeRate, rounded, userId, delegatedTo, processDate } = req.body;
      
      // Validation
      if (!productId || productId.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
      }
      
      // Toll fee rate is now varchar (supports percentages like "10%")
      // No longer validate as numeric
      
      // Prepare data
      const tollFeeData = {
        productId: productId.trim(),
        tollFeeRate: tollFeeRate || '',
        rounded: rounded || '',
        userId: userId || 'SYSTEM',
        delegatedTo: delegatedTo || null,
        processDate: processDate ? new Date(processDate) : new Date(),
        flagUpdate: '0',
        fromUpdate: 'INSERT'
      };
      
      const newTollFeeEntry = await TollFeeModel.createTollFee(tollFeeData);
      
      res.status(201).json({
        success: true,
        data: newTollFeeEntry,
        message: 'Toll fee entry created successfully'
      });
    } catch (error) {
      console.error('Error in createTollFee controller:', error);
      
      // Handle specific database errors
      if (error.message.includes('duplicate') || error.message.includes('UNIQUE')) {
        return res.status(409).json({
          success: false,
          message: 'A toll fee entry with this Product ID already exists',
          error: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error creating toll fee entry',
        error: error.message
      });
    }
  }

  // Update toll fee entry
  static async updateTollFee(req, res) {
    try {
      const { id } = req.params;
      const { productId, tollFeeRate, rounded, userId, delegatedTo, processDate } = req.body;
      
      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or missing toll fee entry ID'
        });
      }
      
      // Validation
      if (!productId || productId.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
      }
      
      // Toll fee rate is now varchar (supports percentages like "10%")
      // No longer validate as numeric
      
      // Prepare data
      const tollFeeData = {
        productId: productId.trim(),
        tollFeeRate: tollFeeRate || '',
        rounded: rounded || '',
        userId: userId || 'SYSTEM',
        delegatedTo: delegatedTo || null,
        processDate: processDate ? new Date(processDate) : new Date(),
        flagUpdate: '1',
        fromUpdate: 'UPDATE'
      };
      
      const updatedTollFeeEntry = await TollFeeModel.updateTollFee(parseInt(id), tollFeeData);
      
      res.status(200).json({
        success: true,
        data: updatedTollFeeEntry,
        message: 'Toll fee entry updated successfully'
      });
    } catch (error) {
      console.error('Error in updateTollFee controller:', error);
      
      if (error.message === 'Toll fee entry not found') {
        return res.status(404).json({
          success: false,
          message: 'Toll fee entry not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error updating toll fee entry',
        error: error.message
      });
    }
  }

  // Delete toll fee entry
  static async deleteTollFee(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or missing toll fee entry ID'
        });
      }
      
      const result = await TollFeeModel.deleteTollFee(parseInt(id));
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'Toll fee entry deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteTollFee controller:', error);
      
      if (error.message === 'Toll fee entry not found') {
        return res.status(404).json({
          success: false,
          message: 'Toll fee entry not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error deleting toll fee entry',
        error: error.message
      });
    }
  }

  // Bulk delete toll fee entries
  static async bulkDeleteTollFee(req, res) {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or empty ID array provided'
        });
      }
      
      // Validate all IDs are numbers
      const invalidIds = ids.filter(id => isNaN(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'All IDs must be valid numbers',
          invalidIds
        });
      }
      
      const result = await TollFeeModel.bulkDeleteTollFee(ids.map(id => parseInt(id)));
      
      res.status(200).json({
        success: true,
        data: result,
        message: `Successfully deleted ${result.deletedCount} toll fee entries`
      });
    } catch (error) {
      console.error('Error in bulkDeleteTollFee controller:', error);
      res.status(500).json({
        success: false,
        message: 'Error bulk deleting toll fee entries',
        error: error.message
      });
    }
  }

  // Bulk insert toll fee entries (for import)
  static async bulkInsertTollFee(req, res) {
    try {
      const { entries, userId } = req.body;
      
      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or empty entries array provided'
        });
      }
      
      // Validate each entry
      const validationErrors = [];
      const processedEntries = [];
      
      entries.forEach((entry, index) => {
        const errors = [];
        
        if (!entry.productId || entry.productId.trim() === '') {
          errors.push(`Entry ${index + 1}: Product ID is required`);
        }
        
        // Toll fee rate is now varchar (supports percentages like "10%")
        // No longer validate as numeric
        
        if (errors.length > 0) {
          validationErrors.push(...errors);
        } else {
          processedEntries.push({
            productId: entry.productId.trim(),
            tollFeeRate: entry.tollFeeRate || '',
            rounded: entry.rounded || '',
            userId: userId || entry.userId || 'SYSTEM',
            delegatedTo: entry.delegatedTo || null,
            processDate: entry.processDate ? new Date(entry.processDate) : new Date(),
            flagUpdate: '0',
            fromUpdate: 'BULK_INSERT'
          });
        }
      });
      
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors found',
          errors: validationErrors
        });
      }
      
      const result = await TollFeeModel.bulkInsertTollFee(processedEntries);
      
      res.status(201).json({
        success: true,
        data: result,
        message: `Successfully imported ${result.insertedCount} toll fee entries`
      });
    } catch (error) {
      console.error('Error in bulkInsertTollFee controller:', error);
      res.status(500).json({
        success: false,
        message: 'Error bulk inserting toll fee entries',
        error: error.message
      });
    }
  }

  // Validate Product ID (utility endpoint)
  static async validateProductId(req, res) {
    try {
      const { productId } = req.params;
      
      if (!productId || productId.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
      }
      
      const exists = await TollFeeModel.validateProductId(productId.trim());
      
      res.status(200).json({
        success: true,
        data: {
          productId: productId.trim(),
          exists: exists
        },
        message: exists ? 'Product ID exists' : 'Product ID not found'
      });
    } catch (error) {
      console.error('Error in validateProductId controller:', error);
      res.status(500).json({
        success: false,
        message: 'Error validating product ID',
        error: error.message
      });
    }
  }

  // Get toll fee statistics (bonus endpoint for reporting)
  static async getTollFeeStats(req, res) {
    try {
      const stats = await TollFeeModel.getTollFeeStats();
      
      res.status(200).json({
        success: true,
        data: stats,
        message: 'Toll fee statistics retrieved successfully'
      });
    } catch (error) {
      console.error('Error in getTollFeeStats controller:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving toll fee statistics',
        error: error.message
      });
    }
  }
}

module.exports = TollFeeController;