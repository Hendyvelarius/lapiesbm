const { getHPP, generateHPPCalculation, generateHPPSimulation, getSimulationHeader, getSimulationDetailBahan, updateSimulationHeader, deleteSimulationMaterials, insertSimulationMaterials, getSimulationList, getMarkedForDeleteList, deleteSimulation, markSimulationForDelete, restoreSimulation, bulkMarkForDelete, permanentlyDeleteMarked, getSimulationOwner, createSimulationHeader, generatePriceChangeSimulation, generatePriceUpdateSimulation, checkHPPDataExists, commitPriceUpdate, getSimulationsForPriceChangeGroup, updateSimulationVersionBulk, bulkMarkPriceChangeGroupForDelete, bulkDeletePriceChangeGroup } = require('../models/hppModel');

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
      const { productId, formulaString, userId } = req.body;
      
      // Validate required parameters
      if (!productId || !formulaString) {
        return res.status(400).json({
          success: false,
          message: 'Product ID and formula string are required'
        });
      }
      
      const result = await generateHPPSimulation(productId, formulaString, userId);
      
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

  // Clone simulation (duplicate header and materials)
  static async cloneSimulation(req, res) {
    try {
      const { simulasiId } = req.params;
      const { cloneDescription, userId } = req.body;
      
      // Validate required parameter
      if (!simulasiId) {
        return res.status(400).json({
          success: false,
          message: 'Simulasi ID is required'
        });
      }
      
      const { cloneSimulation } = require('../models/hppModel');
      const newSimulasiId = await cloneSimulation(simulasiId, cloneDescription, userId);
      
      res.status(201).json({
        success: true,
        message: `Simulation cloned successfully with new ID ${newSimulasiId}`,
        data: {
          originalSimulasiId: parseInt(simulasiId),
          newSimulasiId: newSimulasiId
        }
      });
    } catch (error) {
      console.error('Clone Simulation Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error cloning simulation',
        error: error.message
      });
    }
  }

  // Generate price change simulation using stored procedure
  static async generatePriceChangeSimulation(req, res) {
    try {
      console.log('=== Price Change Simulation Request ===');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      const { materialPriceChanges, userId } = req.body;
      
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
      const result = await generatePriceChangeSimulation(parameterString, userId);

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

  // Generate price update simulation (with Periode parameter)
  static async generatePriceUpdateSimulation(req, res) {
    try {
      console.log('=== Price Update Simulation Request ===');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      const { materialPriceChanges, periode, userId } = req.body;
      
      // Validate input
      if (!materialPriceChanges || !Array.isArray(materialPriceChanges) || materialPriceChanges.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'materialPriceChanges array is required and must contain at least one item'
        });
      }

      if (!periode) {
        return res.status(400).json({
          success: false,
          message: 'periode is required (e.g., "2026")'
        });
      }

      console.log('Received materialPriceChanges:', JSON.stringify(materialPriceChanges, null, 2));
      console.log('Received periode:', periode);

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
      console.log('Periode:', periode);

      // Execute the stored procedure
      const result = await generatePriceUpdateSimulation(parameterString, periode, userId);

      console.log('=== Stored Procedure Result ===');
      console.log('SP result:', JSON.stringify(result, null, 2));

      res.status(200).json({
        success: true,
        message: 'Price update simulation executed successfully',
        data: result
      });

    } catch (error) {
      console.error('Generate Price Update Simulation Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating price update simulation',
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

  // Get affected products for price update simulation (uses Simulasi_Date just like Price Change)
  static async getPriceUpdateAffectedProducts(req, res) {
    try {
      console.log('=== Get Price Update Affected Products Request ===');
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
      const { getPriceUpdateAffectedProducts } = require('../models/hppModel');
      const result = await getPriceUpdateAffectedProducts(description, formattedDate);

      console.log('=== Stored Procedure Result ===');
      console.log('Records returned:', result?.length || 0);

      res.status(200).json({
        success: true,
        message: 'Affected products retrieved successfully',
        data: result
      });

    } catch (error) {
      console.error('Get Price Update Affected Products Error:', error);
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

  // Commit Price Update - execute stored procedure to apply price changes
  static async commitPriceUpdate(req, res) {
    try {
      console.log('=== Commit Price Update Request ===');
      console.log('Request body:', req.body);

      const { materialPrices, periode } = req.body;

      // Validate required parameters
      if (!materialPrices) {
        return res.status(400).json({
          success: false,
          message: 'materialPrices parameter is required. Format: "itemId:newPrice#itemId2:newPrice2"'
        });
      }

      if (!periode) {
        return res.status(400).json({
          success: false,
          message: 'periode parameter is required. Format: "YYYY"'
        });
      }

      console.log('Material Prices:', materialPrices);
      console.log('Periode:', periode);

      // Call the model function to execute the stored procedure
      const result = await commitPriceUpdate(materialPrices, periode);

      console.log('=== Commit Price Update Success ===');
      console.log('Result:', result);

      res.status(200).json({
        success: true,
        message: 'Price update committed successfully',
        data: result
      });

    } catch (error) {
      console.error('=== Commit Price Update Error ===');
      console.error('Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error committing price update',
        error: error.message
      });
    }
  }

  // Get simulations for product selection in a price change group
  static async getSimulationsForPriceChangeGroup(req, res) {
    try {
      const { description, simulasiDate, simulationType } = req.body;

      if (!description || !simulasiDate) {
        return res.status(400).json({
          success: false,
          message: 'description and simulasiDate are required'
        });
      }

      // Format the date
      const date = new Date(simulasiDate);
      const formattedDate = date.toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);

      console.log('=== getSimulationsForPriceChangeGroup Controller ===');
      console.log('Description:', description);
      console.log('Formatted Date:', formattedDate);
      console.log('Simulation Type:', simulationType || 'Price Changes');

      const simulations = await getSimulationsForPriceChangeGroup(
        description, 
        formattedDate, 
        simulationType || 'Price Changes'
      );

      res.status(200).json({
        success: true,
        data: simulations
      });

    } catch (error) {
      console.error('Error getting simulations for price change group:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting simulations for product selection',
        error: error.message
      });
    }
  }

  // Bulk update Versi field for multiple simulations
  static async updateSimulationVersionBulk(req, res) {
    try {
      const { simulationVersions } = req.body;

      if (!simulationVersions || !Array.isArray(simulationVersions) || simulationVersions.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'simulationVersions array is required'
        });
      }

      console.log('=== updateSimulationVersionBulk Controller ===');
      console.log('Number of updates:', simulationVersions.length);

      const result = await updateSimulationVersionBulk(simulationVersions);

      res.status(200).json({
        success: true,
        message: `Successfully updated ${result.updatedCount} simulations`,
        data: result
      });

    } catch (error) {
      console.error('Error updating simulation versions:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating simulation versions',
        error: error.message
      });
    }
  }

  // Get simulations marked for deletion
  static async getMarkedForDeleteList(req, res) {
    try {
      const result = await getMarkedForDeleteList();
      
      res.status(200).json({
        success: true,
        message: 'Marked for deletion list retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Get Marked For Delete List Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving marked for deletion list',
        error: error.message
      });
    }
  }

  // Mark simulation for deletion (soft delete)
  static async markSimulationForDelete(req, res) {
    try {
      const { simulasiId } = req.params;
      const { userId, empDeptID, empJobLevelID } = req.body;
      
      if (!simulasiId) {
        return res.status(400).json({
          success: false,
          message: 'Simulasi ID is required'
        });
      }

      // Get simulation owner
      const simulation = await getSimulationOwner(simulasiId);
      
      if (!simulation) {
        return res.status(404).json({
          success: false,
          message: `Simulation with ID ${simulasiId} not found`
        });
      }

      // Check if user can mark this simulation for deletion
      // PL department with PL job level can mark any simulation
      // Others can only mark their own simulations
      const isPLAdmin = empDeptID === 'PL' && empJobLevelID === 'PL';
      const isOwner = simulation.user_id === userId || !simulation.user_id; // Allow if owner or if no owner set
      
      if (!isPLAdmin && !isOwner) {
        return res.status(403).json({
          success: false,
          message: 'You can only mark your own simulations for deletion'
        });
      }

      const result = await markSimulationForDelete(simulasiId, userId);

      res.status(200).json({
        success: true,
        message: `Simulation ${simulasiId} marked for deletion`,
        data: result
      });
    } catch (error) {
      console.error('Mark Simulation For Delete Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error marking simulation for deletion',
        error: error.message
      });
    }
  }

  // Restore simulation from deletion
  static async restoreSimulation(req, res) {
    try {
      const { simulasiId } = req.params;
      
      if (!simulasiId) {
        return res.status(400).json({
          success: false,
          message: 'Simulasi ID is required'
        });
      }

      const result = await restoreSimulation(simulasiId);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          message: `Simulation with ID ${simulasiId} not found`
        });
      }

      res.status(200).json({
        success: true,
        message: `Simulation ${simulasiId} restored successfully`,
        data: result
      });
    } catch (error) {
      console.error('Restore Simulation Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error restoring simulation',
        error: error.message
      });
    }
  }

  // Bulk mark price change group for deletion
  static async bulkMarkPriceChangeGroupForDelete(req, res) {
    try {
      const { description, simulasiDate, userId, empDeptID, empJobLevelID } = req.body;

      if (!description || !simulasiDate) {
        return res.status(400).json({
          success: false,
          message: 'description and simulasiDate are required'
        });
      }

      // Format the date
      const date = new Date(simulasiDate);
      const formattedDate = date.toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);

      // Get first simulation in the group to check ownership
      const { getSimulationsForPriceChangeGroup } = require('../models/hppModel');
      const simulations = await getSimulationsForPriceChangeGroup(description, formattedDate);
      
      if (!simulations || simulations.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No simulations found in this group'
        });
      }

      // Check permission - PL/PL can delete any, others can only delete their own or legacy (no user_id)
      const groupOwnerId = simulations[0]?.user_id;
      const isPLAdmin = empDeptID === 'PL' && empJobLevelID === 'PL';
      const isOwner = groupOwnerId === userId || !groupOwnerId; // Allow if owner or if no owner set (legacy)
      
      if (!isPLAdmin && !isOwner) {
        return res.status(403).json({
          success: false,
          message: 'You can only mark your own simulation groups for deletion'
        });
      }

      const result = await bulkMarkForDelete(description, formattedDate, 'Price Changes');

      res.status(200).json({
        success: true,
        message: `Successfully marked ${result.markedCount} simulations for deletion`,
        data: result
      });
    } catch (error) {
      console.error('Bulk Mark For Delete Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error marking simulations for deletion',
        error: error.message
      });
    }
  }

  // Permanently delete all marked simulations (only for PL/PL users)
  static async permanentlyDeleteMarked(req, res) {
    try {
      const { empDeptID, empJobLevelID } = req.body;

      // Check if user has permission - only PL department with PL job level can permanently delete
      if (empDeptID !== 'PL' || empJobLevelID !== 'PL') {
        return res.status(403).json({
          success: false,
          message: 'Only PL department administrators can permanently delete simulations'
        });
      }

      const result = await permanentlyDeleteMarked();

      res.status(200).json({
        success: true,
        message: `Permanently deleted ${result.deletedCount} simulations and ${result.materialsDeleted} material records`,
        data: result
      });
    } catch (error) {
      console.error('Permanently Delete Marked Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error permanently deleting simulations',
        error: error.message
      });
    }
  }

  // Permanently delete a single simulation (only for PL/PL users)
  static async permanentlyDeleteSimulation(req, res) {
    try {
      const { simulasiId } = req.params;
      const { empDeptID, empJobLevelID } = req.body;

      if (!simulasiId) {
        return res.status(400).json({
          success: false,
          message: 'Simulasi ID is required'
        });
      }

      // Check if user has permission - only PL department with PL job level can permanently delete
      if (empDeptID !== 'PL' || empJobLevelID !== 'PL') {
        return res.status(403).json({
          success: false,
          message: 'Only PL department administrators can permanently delete simulations'
        });
      }

      const result = await deleteSimulation(simulasiId);

      if (result.headerDeleted === 0) {
        return res.status(404).json({
          success: false,
          message: `Simulation with ID ${simulasiId} not found`
        });
      }

      res.status(200).json({
        success: true,
        message: `Simulation ${simulasiId} permanently deleted`,
        data: result
      });
    } catch (error) {
      console.error('Permanently Delete Simulation Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error permanently deleting simulation',
        error: error.message
      });
    }
  }

  // Get simulation owner info
  static async getSimulationOwner(req, res) {
    try {
      const { simulasiId } = req.params;

      if (!simulasiId) {
        return res.status(400).json({
          success: false,
          message: 'Simulasi ID is required'
        });
      }

      const result = await getSimulationOwner(simulasiId);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: `Simulation with ID ${simulasiId} not found`
        });
      }

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get Simulation Owner Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting simulation owner',
        error: error.message
      });
    }
  }
}

module.exports = HPPController;
