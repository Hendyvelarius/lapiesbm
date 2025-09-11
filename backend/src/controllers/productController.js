const { getChosenFormula, getFormula, findFormula, addChosenFormula, updateChosenFormula, deleteChosenFormula, findRecipe, getAllFormulaDetails, getActiveFormulaDetails, getFormulaProductCost } = require('../models/productModel');

class ProductController {
  static async getFormula(req, res) {
    try {
      const formulas = await getFormula();
      res.status(200).json(formulas);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving formulas',
        error: error.message
      });
    }
  }

  static async findFormula(req, res) {
    try {
      const { id } = req.params;
      const formula = await findFormula(id);
      if (!formula) {
        return res.status(404).json('Formula not found');
      }
      res.status(200).json(formula);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving formula',
        error: error.message
      });
    }
  }

  static async getChosenFormula(req, res) {
    try {
      const formulas = await getChosenFormula();
      res.status(200).json(formulas);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving chosen formulas',
        error: error.message
      });
    }
  }

  static async addChosenFormula(req, res) {
    try {
      const { productId, pi, ps, kp, ks, stdOutput, isManual } = req.body;
      
      // Validate required field
      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
      }

      const result = await addChosenFormula(
        productId,
        pi,
        ps,
        kp,
        ks,
        stdOutput,
        'SYSTEM', // Default user
        isManual
      );

      res.status(201).json({
        success: true,
        message: 'Chosen formula created successfully',
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating chosen formula',
        error: error.message
      });
    }
  }

  static async updateChosenFormula(req, res) {
    try {
      const { productId } = req.params;
      const { pi, ps, kp, ks, stdOutput, isManual } = req.body;

      const result = await updateChosenFormula(
        productId,
        pi,
        ps,
        kp,
        ks,
        stdOutput,
        'SYSTEM', // Default user
        isManual
      );

      if (result.rowsAffected[0] === 0) {
        return res.status(404).json({
          success: false,
          message: 'Chosen formula not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Chosen formula updated successfully',
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating chosen formula',
        error: error.message
      });
    }
  }

  static async deleteChosenFormula(req, res) {
    try {
      const { productId } = req.params;

      const result = await deleteChosenFormula(productId);

      if (result.rowsAffected[0] === 0) {
        return res.status(404).json({
          success: false,
          message: 'Chosen formula not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Chosen formula deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting chosen formula',
        error: error.message
      });
    }
  }
  
  static async findRecipe(req, res) {
    try {
      const { productId } = req.params;
      const recipe = await findRecipe(productId);
      if (!recipe) {
        return res.status(404).json('Recipe not found');
      }
      res.status(200).json(recipe);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving recipe',
        error: error.message
      });
    }
  }

  static async getAllFormulaDetails(req, res) {
    try {
      const formulaDetails = await getAllFormulaDetails();
      res.status(200).json(formulaDetails);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving all formula details',
        error: error.message
      });
    }
  }

  static async getActiveFormulaDetails(req, res) {
    try {
      const activeFormulaDetails = await getActiveFormulaDetails();
      res.status(200).json(activeFormulaDetails);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving active formula details',
        error: error.message
      });
    }
  }

  static async getFormulaProductCost(req, res) {
    try {
      const formulaProductCost = await getFormulaProductCost();
      res.status(200).json(formulaProductCost);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving formula product cost',
        error: error.message
      });
    }
  }

  static async autoAssignFormulas(req, res) {
    try {
      const { autoAssignFormulas } = require('../models/productModel');
      const result = await autoAssignFormulas();
      res.status(200).json({
        success: true,
        message: 'Auto assignment completed successfully',
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error during auto assignment',
        error: error.message
      });
    }
  }

  static async getFormulaRecommendations(req, res) {
    try {
      const { productId } = req.params;
      const { getFormulaRecommendations } = require('../models/productModel');
      const recommendations = await getFormulaRecommendations(productId);
      res.status(200).json({
        success: true,
        data: recommendations
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving formula recommendations',
        error: error.message
      });
    }
  }
}

module.exports = ProductController;
