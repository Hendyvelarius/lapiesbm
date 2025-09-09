const ExpiryCostModel = require('../models/expiryCostModel');

class ExpiryCostController {
  
  // Get all expired materials
  static async getAllExpiredMaterials(req, res) {
    try {
      const { periode, itemId, userId, dateFrom, dateTo } = req.query;
      
      // If there are filters, use filtered method
      if (periode || itemId || userId || dateFrom || dateTo) {
        const filters = {
          periode,
          itemId,
          userId,
          dateFrom: dateFrom ? new Date(dateFrom) : null,
          dateTo: dateTo ? new Date(dateTo) : null
        };
        
        const expiredMaterials = await ExpiryCostModel.getExpiredMaterialsFiltered(filters);
        
        res.status(200).json({
          success: true,
          data: expiredMaterials,
          message: `Found ${expiredMaterials.length} expired material records with filters`
        });
      } else {
        const expiredMaterials = await ExpiryCostModel.getAllExpiredMaterials();
        
        res.status(200).json({
          success: true,
          data: expiredMaterials,
          message: `Found ${expiredMaterials.length} expired material records`
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving expired materials',
        error: error.message
      });
    }
  }

  // Get expired material by ID
  static async getExpiredMaterialById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Valid ID is required'
        });
      }
      
      const expiredMaterial = await ExpiryCostModel.getExpiredMaterialById(parseInt(id));
      
      if (!expiredMaterial) {
        return res.status(404).json({
          success: false,
          message: 'Expired material record not found'
        });
      }
      
      res.status(200).json({
        success: true,
        data: expiredMaterial
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving expired material',
        error: error.message
      });
    }
  }

  // Create new expired material
  static async createExpiredMaterial(req, res) {
    try {
      const { itemId, itemUnit, itemQty, periode, userId, processDate } = req.body;
      
      // Validation
      if (!itemId || !itemUnit || !itemQty) {
        return res.status(400).json({
          success: false,
          message: 'Required fields: itemId, itemUnit, itemQty'
        });
      }
      
      if (isNaN(itemQty) || parseFloat(itemQty) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Item quantity must be a positive number'
        });
      }
      
      const expiredMaterialData = {
        itemId: itemId.trim(),
        itemUnit: itemUnit.trim(),
        itemQty: parseFloat(itemQty),
        periode: periode || new Date().getFullYear().toString(),
        userId: userId || 'SYSTEM',
        processDate: processDate ? new Date(processDate) : new Date()
      };
      
      const newExpiredMaterial = await ExpiryCostModel.createExpiredMaterial(expiredMaterialData);
      
      res.status(201).json({
        success: true,
        data: newExpiredMaterial,
        message: 'Expired material record created successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating expired material record',
        error: error.message
      });
    }
  }

  // Update expired material
  static async updateExpiredMaterial(req, res) {
    try {
      const { id } = req.params;
      const { itemId, itemUnit, itemQty, periode, userId, processDate } = req.body;
      
      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Valid ID is required'
        });
      }
      
      // Check if record exists
      const existingRecord = await ExpiryCostModel.getExpiredMaterialById(parseInt(id));
      if (!existingRecord) {
        return res.status(404).json({
          success: false,
          message: 'Expired material record not found'
        });
      }
      
      // Validation
      if (!itemId || !itemUnit || !itemQty) {
        return res.status(400).json({
          success: false,
          message: 'Required fields: itemId, itemUnit, itemQty'
        });
      }
      
      if (isNaN(itemQty) || parseFloat(itemQty) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Item quantity must be a positive number'
        });
      }
      
      const updateData = {
        itemId: itemId.trim(),
        itemUnit: itemUnit.trim(),
        itemQty: parseFloat(itemQty),
        periode: periode || existingRecord.PERIODE,
        userId: userId || existingRecord.user_id,
        processDate: processDate ? new Date(processDate) : existingRecord.process_date
      };
      
      const updatedExpiredMaterial = await ExpiryCostModel.updateExpiredMaterial(parseInt(id), updateData);
      
      res.status(200).json({
        success: true,
        data: updatedExpiredMaterial,
        message: 'Expired material record updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating expired material record',
        error: error.message
      });
    }
  }

  // Delete expired material
  static async deleteExpiredMaterial(req, res) {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Valid ID is required'
        });
      }
      
      // Check if record exists
      const existingRecord = await ExpiryCostModel.getExpiredMaterialById(parseInt(id));
      if (!existingRecord) {
        return res.status(404).json({
          success: false,
          message: 'Expired material record not found'
        });
      }
      
      const deleted = await ExpiryCostModel.deleteExpiredMaterial(parseInt(id));
      
      if (deleted) {
        res.status(200).json({
          success: true,
          message: 'Expired material record deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete expired material record'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting expired material record',
        error: error.message
      });
    }
  }

  // Get expired cost allocation (read-only)
  static async getExpiredCostAllocation(req, res) {
    try {
      const expiredCostAllocation = await ExpiryCostModel.getExpiredCostAllocation();
      
      res.status(200).json({
        success: true,
        data: expiredCostAllocation,
        message: `Found ${expiredCostAllocation.length} expired cost allocation records`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving expired cost allocation',
        error: error.message
      });
    }
  }

  // Generate expiry cost allocation
  static async generateExpiryCostAllocation(req, res) {
    try {
      const { periode } = req.body;
      
      if (!periode) {
        return res.status(400).json({
          success: false,
          message: 'Period is required'
        });
      }
      
      // Validate period format (should be 4-digit year)
      if (!/^\d{4}$/.test(periode)) {
        return res.status(400).json({
          success: false,
          message: 'Period must be a 4-digit year (e.g., 2025)'
        });
      }
      
      const result = await ExpiryCostModel.generateExpiryCostAllocation(periode);
      
      res.status(200).json({
        success: true,
        message: `Expiry cost allocation generated successfully for period ${periode}`,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error generating expiry cost allocation',
        error: error.message
      });
    }
  }
}

module.exports = ExpiryCostController;
