const ReagenModel = require('../models/reagenModel');

class ReagenController {
  
  // Get all reagen entries
  static async getAllReagen(req, res) {
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
        
        const reagenEntries = await ReagenModel.getReagenFiltered(filters);
        
        res.status(200).json({
          success: true,
          data: reagenEntries,
          message: `Found ${reagenEntries.length} reagen entries with filters`
        });
      } else if (withProductInfo === 'true') {
        // Get entries with product information
        const reagenEntries = await ReagenModel.getReagenWithProductInfo();
        
        res.status(200).json({
          success: true,
          data: reagenEntries,
          message: `Found ${reagenEntries.length} reagen entries with product info`
        });
      } else {
        // Get all entries without filters
        const reagenEntries = await ReagenModel.getAllReagen();
        
        res.status(200).json({
          success: true,
          data: reagenEntries,
          message: `Found ${reagenEntries.length} reagen entries`
        });
      }
    } catch (error) {
      console.error('Error in getAllReagen controller:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving reagen entries',
        error: error.message
      });
    }
  }

  // Get reagen entry by ID
  static async getReagenById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or missing reagen entry ID'
        });
      }
      
      const reagenEntry = await ReagenModel.getReagenById(parseInt(id));
      
      if (!reagenEntry) {
        return res.status(404).json({
          success: false,
          message: 'Reagen entry not found'
        });
      }
      
      res.status(200).json({
        success: true,
        data: reagenEntry,
        message: 'Reagen entry retrieved successfully'
      });
    } catch (error) {
      console.error('Error in getReagenById controller:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving reagen entry',
        error: error.message
      });
    }
  }

  // Create new reagen entry
  static async createReagen(req, res) {
    try {
      const { productId, reagenRate, userId, delegatedTo, processDate } = req.body;
      
      // Validation
      if (!productId || productId.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
      }
      
      if (reagenRate === undefined || reagenRate === null || isNaN(reagenRate)) {
        return res.status(400).json({
          success: false,
          message: 'Valid reagen rate is required'
        });
      }
      
      if (parseFloat(reagenRate) < 0) {
        return res.status(400).json({
          success: false,
          message: 'Reagen rate must be 0 or greater'
        });
      }
      
      // Prepare data
      const reagenData = {
        productId: productId.trim(),
        reagenRate: parseFloat(reagenRate),
        userId: userId || 'SYSTEM',
        delegatedTo: delegatedTo || null,
        processDate: processDate ? new Date(processDate) : new Date(),
        flagUpdate: 0,
        fromUpdate: 'INSERT'
      };
      
      const newReagenEntry = await ReagenModel.createReagen(reagenData);
      
      res.status(201).json({
        success: true,
        data: newReagenEntry,
        message: 'Reagen entry created successfully'
      });
    } catch (error) {
      console.error('Error in createReagen controller:', error);
      
      // Handle specific database errors
      if (error.message.includes('duplicate') || error.message.includes('UNIQUE')) {
        return res.status(409).json({
          success: false,
          message: 'A reagen entry with this Product ID already exists',
          error: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error creating reagen entry',
        error: error.message
      });
    }
  }

  // Update reagen entry
  static async updateReagen(req, res) {
    try {
      const { id } = req.params;
      const { productId, reagenRate, userId, delegatedTo, processDate } = req.body;
      
      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or missing reagen entry ID'
        });
      }
      
      // Validation
      if (!productId || productId.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
      }
      
      if (reagenRate === undefined || reagenRate === null || isNaN(reagenRate)) {
        return res.status(400).json({
          success: false,
          message: 'Valid reagen rate is required'
        });
      }
      
      if (parseFloat(reagenRate) < 0) {
        return res.status(400).json({
          success: false,
          message: 'Reagen rate must be 0 or greater'
        });
      }
      
      // Prepare data
      const reagenData = {
        productId: productId.trim(),
        reagenRate: parseFloat(reagenRate),
        userId: userId || 'SYSTEM',
        delegatedTo: delegatedTo || null,
        processDate: processDate ? new Date(processDate) : new Date(),
        flagUpdate: 1,
        fromUpdate: 'UPDATE'
      };
      
      const updatedReagenEntry = await ReagenModel.updateReagen(parseInt(id), reagenData);
      
      res.status(200).json({
        success: true,
        data: updatedReagenEntry,
        message: 'Reagen entry updated successfully'
      });
    } catch (error) {
      console.error('Error in updateReagen controller:', error);
      
      if (error.message === 'Reagen entry not found') {
        return res.status(404).json({
          success: false,
          message: 'Reagen entry not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error updating reagen entry',
        error: error.message
      });
    }
  }

  // Delete reagen entry
  static async deleteReagen(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or missing reagen entry ID'
        });
      }
      
      const result = await ReagenModel.deleteReagen(parseInt(id));
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'Reagen entry deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteReagen controller:', error);
      
      if (error.message === 'Reagen entry not found') {
        return res.status(404).json({
          success: false,
          message: 'Reagen entry not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error deleting reagen entry',
        error: error.message
      });
    }
  }

  // Bulk delete reagen entries by Periode (with optional locked product exclusion)
  static async bulkDeleteReagenByPeriode(req, res) {
    try {
      const { periode } = req.params;
      const { lockedProductIds } = req.body || {};
      
      if (!periode || periode.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Periode is required'
        });
      }
      
      const result = await ReagenModel.bulkDeleteReagenByPeriode(periode.trim(), lockedProductIds || []);
      
      let message = `Successfully deleted ${result.deletedCount} reagen entries for year ${periode}`;
      if (result.excludedLocked > 0) {
        message += ` (${result.excludedLocked} locked products preserved)`;
      }
      
      res.status(200).json({
        success: true,
        data: result,
        message
      });
    } catch (error) {
      console.error('Error in bulkDeleteReagenByPeriode controller:', error);
      res.status(500).json({
        success: false,
        message: 'Error bulk deleting reagen entries by periode',
        error: error.message
      });
    }
  }

  // Bulk delete reagen entries
  static async bulkDeleteReagen(req, res) {
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
      
      const result = await ReagenModel.bulkDeleteReagen(ids.map(id => parseInt(id)));
      
      res.status(200).json({
        success: true,
        data: result,
        message: `Successfully deleted ${result.deletedCount} reagen entries`
      });
    } catch (error) {
      console.error('Error in bulkDeleteReagen controller:', error);
      res.status(500).json({
        success: false,
        message: 'Error bulk deleting reagen entries',
        error: error.message
      });
    }
  }

  // Bulk insert reagen entries (for import)
  static async bulkInsertReagen(req, res) {
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
        
        if (entry.reagenRate === undefined || entry.reagenRate === null || isNaN(entry.reagenRate)) {
          errors.push(`Entry ${index + 1}: Valid reagen rate is required`);
        }
        
        if (parseFloat(entry.reagenRate) < 0) {
          errors.push(`Entry ${index + 1}: Reagen rate must be 0 or greater`);
        }
        
        if (errors.length > 0) {
          validationErrors.push(...errors);
        } else {
          processedEntries.push({
            productId: entry.productId.trim(),
            reagenRate: parseFloat(entry.reagenRate),
            periode: entry.periode || null,
            userId: userId || entry.userId || 'SYSTEM',
            delegatedTo: entry.delegatedTo || null,
            processDate: entry.processDate ? new Date(entry.processDate) : new Date(),
            flagUpdate: 0,
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
      
      const result = await ReagenModel.bulkInsertReagen(processedEntries);
      
      res.status(201).json({
        success: true,
        data: result,
        message: `Successfully imported ${result.insertedCount} reagen entries`
      });
    } catch (error) {
      console.error('Error in bulkInsertReagen controller:', error);
      res.status(500).json({
        success: false,
        message: 'Error bulk inserting reagen entries',
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
      
      const exists = await ReagenModel.validateProductId(productId.trim());
      
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
}

module.exports = ReagenController;