const { getHPP, generateHPPCalculation, generateHPPSimulation } = require('../models/hppModel');

class HPPController {
  // Get all HPP records
  static async getHPP(req, res) {
    try {
      const hpp = await getHPP();
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
      
      console.log('Generating HPP simulation:', { productId, formulaString });
      
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
}

module.exports = HPPController;
