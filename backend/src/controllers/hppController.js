const { getHPP, generateHPPCalculation } = require('../models/hppModel');

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
}

module.exports = HPPController;
