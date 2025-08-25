const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/productController');

// GET /api/products - Get all products with filtering and pagination
router.get('/', ProductController.getAllProducts);

// GET /api/products/formula - Get all existing formulas for all products
router.get('/formula', ProductController.getFormula);
router.get('/formula/:id', ProductController.findFormula);
router.get('/chosenformula', ProductController.getChosenFormula);

// Chosen formula CRUD operations
router.post('/chosenformula', ProductController.addChosenFormula);
router.put('/chosenformula/:productId', ProductController.updateChosenFormula);
router.delete('/chosenformula/:productId', ProductController.deleteChosenFormula);

// POST /api/products - Create new product
router.post('/', ProductController.createProduct);

// GET /api/products/:id - Get product by ID
router.get('/:id', ProductController.getProductById);

// PUT /api/products/:id - Update product
router.put('/:id', ProductController.updateProduct);

// DELETE /api/products/:id - Delete product
router.delete('/:id', ProductController.deleteProduct);

module.exports = router;
