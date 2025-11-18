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

// POST /api/products/bulk-import-formulas - Bulk import formula assignments from Excel
router.post('/bulk-import-formulas', ProductController.bulkImportFormulas);

// POST /api/products/generate-hpp/:productId - Generate HPP for a specific product
router.post('/generate-hpp/:productId', ProductController.generateHPP);

// Chosen formula CRUD operations
router.get('/chosenformula', ProductController.getChosenFormula);
router.get('/available-years', ProductController.getAvailableYears);
router.post('/chosenformula', ProductController.addChosenFormula);
router.put('/chosenformula/:productId', ProductController.updateChosenFormula);
router.delete('/chosenformula/:productId', ProductController.deleteChosenFormula);

// Recipe operations
router.get('/recipe/:productId', ProductController.findRecipe);

// Lock year operations
router.post('/lock-year', ProductController.lockYear);
router.post('/lock-product', ProductController.lockProduct);

module.exports = router;
