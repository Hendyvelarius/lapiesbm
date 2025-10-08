const { getHPP, generateHPPCalculation, generateHPPSimulation, getSimulationHeader, getSimulationDetailBahan, updateSimulationHeader, deleteSimulationMaterials, insertSimulationMaterials, getSimulationList, deleteSimulation, createSimulationHeader, generatePriceChangeSimulation, checkHPPDataExists } = require('../models/hppModel');

class HPPController {
  // Get all HPP records
  static async getHPP(req, res) {
    try {
      const { year } = req.query;
      const hpp = await getHPP(year);
      res.status(200).json(hpp);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving HPP data',
        error: error.message
      });
    }
  }

  // Generate HPP calculation using stored procedure
  static async generateHPPCalculation(req, res) {
    try {
      const { periode } = req.body;
      
      // Default periode to current year if not provided
      const calculationPeriode = periode || new Date().getFullYear().toString();
      
      // Validate period format
      if (!/^\d{4}$/.test(calculationPeriode)) {
        return res.status(400).json({
          success: false,
          message: 'Period must be a 4-digit year (e.g., 2025)'
        });
      }
      
      const result = await generateHPPCalculation(calculationPeriode);
      
      res.status(200).json({
        success: true,
        message: `HPP calculation completed successfully for period ${calculationPeriode}`,
        data: {
          periode: calculationPeriode,
          processedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error generating HPP calculation',
        error: error.message
      });
    }
  }

  // Check if HPP data exists for a given year
  static async checkHPPDataExists(req, res) {
    try {
      const { year } = req.query;
      
      if (!year) {
        return res.status(400).json({
          success: false,
          message: 'Year parameter is required'
        });
      }
      
      // Validate year format
      if (!/^\d{4}$/.test(year)) {
        return res.status(400).json({
          success: false,
          message: 'Year must be a 4-digit year (e.g., 2025)'
        });
      }
      
      const result = await checkHPPDataExists(year);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error checking HPP data existence',
        error: error.message
      });
    }
  }

  // Generate HPP simulation for existing product
  static async generateHPPSimulation(req, res) {
    try {
      const { productId, formulaString } = req.body;
      
      // Validate required parameters
      if (!productId || !formulaString) {
        return res.status(400).json({
          success: false,
          message: 'Product ID and formula string are required'
        });
      }
      
      const result = await generateHPPSimulation(productId, formulaString);
      
      res.status(200).json({
        success: true,
        message: `HPP simulation completed successfully for product ${productId}`,
        data: result
      });
    } catch (error) {
      console.error('HPP Simulation Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating HPP simulation',
        error: error.message
      });
    }
  }

  // Get simulation header details by Simulasi_ID
  static async getSimulationHeader(req, res) {
    try {
      const { simulasiId } = req.params;
      
      // Validate required parameter
      if (!simulasiId) {
        return res.status(400).json({
          success: false,
          message: 'Simulasi ID is required'
        });
      }
      
      const result = await getSimulationHeader(simulasiId);
      
      res.status(200).json({
        success: true,
        message: `Simulation header retrieved successfully for Simulasi_ID ${simulasiId}`,
        data: result
      });
    } catch (error) {
      console.error('Get Simulation Header Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving simulation header',
        error: error.message
      });
    }
  }

  // Get simulation detail materials by Simulasi_ID
  static async getSimulationDetailBahan(req, res) {
    try {
      const { simulasiId } = req.params;
      
      // Validate required parameter
      if (!simulasiId) {
        return res.status(400).json({
          success: false,
          message: 'Simulasi ID is required'
        });
      }
      
      const result = await getSimulationDetailBahan(simulasiId);
      
      res.status(200).json({
        success: true,
        message: `Simulation detail bahan retrieved successfully for Simulasi_ID ${simulasiId}`,
        data: result
      });
    } catch (error) {
      console.error('Get Simulation Detail Bahan Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving simulation detail bahan',
        error: error.message
      });
    }
  }

  // Save simulation (update header and replace materials)
  static async saveSimulation(req, res) {
    try {
      const { simulasiId, headerData, materials } = req.body;
      
      // Validate required parameters
      if (!simulasiId || !headerData || !Array.isArray(materials)) {
        return res.status(400).json({
          success: false,
          message: 'Simulasi ID, header data, and materials array are required'
        });
      }
      
      // Start transaction-like operations
      // 1. Update header
      const headerUpdateResult = await updateSimulationHeader(simulasiId, headerData);
      
      // 2. Delete existing materials
      const deleteResult = await deleteSimulationMaterials(simulasiId);
      
      // 3. Insert new materials
      const insertResult = await insertSimulationMaterials(simulasiId, materials, headerData.Periode || '2025');
      
      res.status(200).json({
        success: true,
        message: `Simulation saved successfully for Simulasi_ID ${simulasiId}`,
        data: {
          simulasiId,
          headerUpdated: headerUpdateResult > 0,
          materialsDeleted: deleteResult,
          materialsInserted: insertResult
        }
      });
    } catch (error) {
      console.error('Save Simulation Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error saving simulation',
        error: error.message
      });
    }
  }

  // Get list of all simulation records
  static async getSimulationList(req, res) {
    try {
      const result = await getSimulationList();
      
      res.status(200).json({
        success: true,
        message: 'Simulation list retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Get Simulation List Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving simulation list',
        error: error.message
      });
    }
  }

  // Delete simulation by Simulasi_ID
  static async deleteSimulation(req, res) {
    try {
      const { simulasiId } = req.params;
      
      // Validate required parameter
      if (!simulasiId) {
        return res.status(400).json({
          success: false,
          message: 'Simulasi ID is required'
        });
      }
      
      const result = await deleteSimulation(simulasiId);
      
      // Check if anything was actually deleted
      if (result.headerDeleted === 0) {
        return res.status(404).json({
          success: false,
          message: `Simulation with ID ${simulasiId} not found`
        });
      }
      
      res.status(200).json({
        success: true,
        message: `Simulation deleted successfully for Simulasi_ID ${simulasiId}`,
        data: {
          simulasiId: parseInt(simulasiId),
          materialsDeleted: result.materialsDeleted,
          headerDeleted: result.headerDeleted
        }
      });
    } catch (error) {
      console.error('Delete Simulation Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting simulation',
        error: error.message
      });
    }
  }

  // Create custom simulation (for custom formulas)
  static async createCustomSimulation(req, res) {
    try {
      const { headerData, materials } = req.body;
      
      // Validate required parameters
      if (!headerData || !Array.isArray(materials)) {
        return res.status(400).json({
          success: false,
          message: 'Header data and materials array are required'
        });
      }
      
      // Create the header and get the new Simulasi_ID
      const simulasiId = await createSimulationHeader(headerData);
      
      // Insert materials for the new simulation
      const insertResult = await insertSimulationMaterials(simulasiId, materials, headerData.Periode || '2025');
      
      res.status(201).json({
        success: true,
        message: `Custom simulation created successfully with ID ${simulasiId}`,
        data: {
          simulasiId,
          materialsInserted: insertResult
        }
      });
    } catch (error) {
      console.error('Create Custom Simulation Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating custom simulation',
        error: error.message
      });
    }
  }

  // Generate price change simulation using stored procedure
  static async generatePriceChangeSimulation(req, res) {
    try {
      console.log('=== Price Change Simulation Request ===');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      const { materialPriceChanges } = req.body;
      
      // Validate input
      if (!materialPriceChanges || !Array.isArray(materialPriceChanges) || materialPriceChanges.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'materialPriceChanges array is required and must contain at least one item'
        });
      }

      console.log('Received materialPriceChanges:', JSON.stringify(materialPriceChanges, null, 2));

      // Validate each material price change
      for (const change of materialPriceChanges) {
        console.log('Validating change:', JSON.stringify(change, null, 2));
        if (!change.materialId || change.newPrice === undefined || change.newPrice === null) {
          return res.status(400).json({
            success: false,
            message: 'Each material price change must have materialId and newPrice'
          });
        }
      }

      // Format the parameter string for stored procedure
      // Format: 'materialId1:newPrice1#materialId2:newPrice2'
      const parameterString = materialPriceChanges
        .map(change => `${change.materialId}:${change.newPrice}`)
        .join('#');

      console.log('=== Formatted Parameter String ===');
      console.log('Parameter string for SP:', parameterString);
      console.log('Parameter string length:', parameterString.length);

      // Execute the stored procedure
      const result = await generatePriceChangeSimulation(parameterString);

      console.log('=== Stored Procedure Result ===');
      console.log('SP result:', JSON.stringify(result, null, 2));

      res.status(200).json({
        success: true,
        message: 'Price change simulation executed successfully',
        data: result
      });

    } catch (error) {
      console.error('Generate Price Change Simulation Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating price change simulation',
        error: error.message
      });
    }
  }

  // Get affected products for price change simulation
  static async getPriceChangeAffectedProducts(req, res) {
    try {
      console.log('=== Get Price Change Affected Products Request ===');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      const { description, simulasiDate } = req.body;
      
      // Validate input
      if (!description || !simulasiDate) {
        return res.status(400).json({
          success: false,
          message: 'Both description and simulasiDate are required'
        });
      }

      // Format the date - replace 'T' with space and remove 'Z'
      // From: "2025-09-24T00:27:38.087Z" 
      // To: "2025-09-24 00:27:38.087"
      const formattedDate = simulasiDate.replace('T', ' ').replace('Z', '');

      console.log('=== Formatted Parameters ===');
      console.log('Description:', description);
      console.log('Original Date:', simulasiDate);
      console.log('Formatted Date:', formattedDate);

      // Execute the stored procedure
      const { getPriceChangeAffectedProducts } = require('../models/hppModel');
      const result = await getPriceChangeAffectedProducts(description, formattedDate);

      console.log('=== Stored Procedure Result ===');
      console.log('Records returned:', result?.length || 0);

      res.status(200).json({
        success: true,
        message: 'Affected products retrieved successfully',
        data: result
      });

    } catch (error) {
      console.error('Get Price Change Affected Products Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving affected products',
        error: error.message
      });
    }
  }

  // Bulk delete price change group (all simulations with matching description and date)
  static async bulkDeletePriceChangeGroup(req, res) {
    try {
      console.log('=== Bulk Delete Price Change Group ===');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      const { description, simulasiDate } = req.body;
      
      // Validate input
      if (!description || !simulasiDate) {
        return res.status(400).json({
          success: false,
          message: 'Both description and simulasiDate are required'
        });
      }

      // Format the date - replace 'T' with space and remove 'Z'
      // From: "2025-09-24T00:27:38.087Z" 
      // To: "2025-09-24 00:27:38.087"
      const formattedDate = simulasiDate.replace('T', ' ').replace('Z', '');

      console.log('=== Bulk Delete Parameters ===');
      console.log('Description:', description);
      console.log('Original Date:', simulasiDate);
      console.log('Formatted Date:', formattedDate);

      // Execute the bulk delete
      const { bulkDeletePriceChangeGroup } = require('../models/hppModel');
      const result = await bulkDeletePriceChangeGroup(description, formattedDate);

      console.log('=== Bulk Delete Result ===');
      console.log('Deleted records:', result?.deletedCount || 0);

      res.status(200).json({
        success: true,
        message: `Successfully deleted ${result?.deletedCount || 0} price change simulations`,
        data: {
          deletedCount: result?.deletedCount || 0,
          description: description,
          simulasiDate: simulasiDate
        }
      });

    } catch (error) {
      console.error('Bulk Delete Price Change Group Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting price change group',
        error: error.message
      });
    }
  }

  static async getSimulationSummary(req, res) {
    try {
      console.log('=== Get Simulation Summary Request ===');
      console.log('Simulasi ID:', req.params.simulasiId);
      
      const simulasiId = req.params.simulasiId;
      
      if (!simulasiId) {
        return res.status(400).json({
          success: false,
          message: 'Simulasi ID is required'
        });
      }

      const { getSimulationSummary } = require('../models/hppModel');
      const result = await getSimulationSummary(simulasiId);

      console.log('=== Controller Response ===');
      console.log('Records returned:', result?.length || 0);

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('=== getSimulationSummary Controller Error ===');
      console.error('Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching simulation summary',
        error: error.message
      });
    }
  }
}

module.exports = HPPController;
