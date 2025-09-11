const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/productController');

// GET /api/products/formula - Get all existing formulas for all products
router.get('/formula', ProductController.getFormula);
router.get('/formula/:id', ProductController.findFormula);

// GET /api/products/formula-recommendations/:productId - Get recommended formula sets for a specific product
router.get('/formula-recommendations/:productId', ProductController.getFormulaRecommendations);

// GET /api/products/formula-details - Get all formula details from vw_COGS_FORMULA_List_detail
router.get('/formula-details', ProductController.getAllFormulaDetails);

// GET /api/products/formula-details/active - Get active formula details (DefaultCOGS = 'Aktif')
router.get('/formula-details/active', ProductController.getActiveFormulaDetails);

// GET /api/products/formula-cost - Get formula product cost for auto assignment
router.get('/formula-cost', ProductController.getFormulaProductCost);

// POST /api/products/auto-assign-formulas - Auto assign formulas based on cost analysis
router.post('/auto-assign-formulas', ProductController.autoAssignFormulas);

// Chosen formula CRUD operations
router.get('/chosenformula', ProductController.getChosenFormula);
router.post('/chosenformula', ProductController.addChosenFormula);
router.put('/chosenformula/:productId', ProductController.updateChosenFormula);
router.delete('/chosenformula/:productId', ProductController.deleteChosenFormula);

// Recipe operations
router.get('/recipe/:productId', ProductController.findRecipe);

module.exports = router;

module.exports = router;
