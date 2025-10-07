const express = require('express');
const router = express.Router();
const TollFeeController = require('../controllers/tollFeeController');

// Get all toll fee entries (with optional filters and product info)
// GET /api/toll-fee?productId=P001&userId=USER001&dateFrom=2024-01-01&dateTo=2024-12-31&withProductInfo=true
router.get('/', TollFeeController.getAllTollFee);

// Get toll fee statistics (bonus endpoint for reporting)
// GET /api/toll-fee/stats
router.get('/stats', TollFeeController.getTollFeeStats);

// Get toll fee entry by ID
// GET /api/toll-fee/:id
router.get('/:id', TollFeeController.getTollFeeById);

// Create new toll fee entry
// POST /api/toll-fee
// Body: { productId, tollFeeRate, userId?, delegatedTo?, processDate? }
router.post('/', TollFeeController.createTollFee);

// Update toll fee entry
// PUT /api/toll-fee/:id
// Body: { productId, tollFeeRate, userId?, delegatedTo?, processDate? }
router.put('/:id', TollFeeController.updateTollFee);

// Delete toll fee entry
// DELETE /api/toll-fee/:id
router.delete('/:id', TollFeeController.deleteTollFee);

// Bulk delete toll fee entries
// DELETE /api/toll-fee/bulk/delete
// Body: { ids: [1, 2, 3, 4] }
router.delete('/bulk/delete', TollFeeController.bulkDeleteTollFee);

// Bulk insert toll fee entries (for import)
// POST /api/toll-fee/bulk/insert
// Body: { entries: [{productId, tollFeeRate, userId?, delegatedTo?, processDate?}], userId? }
router.post('/bulk/insert', TollFeeController.bulkInsertTollFee);

// Validate Product ID (utility endpoint)
// GET /api/toll-fee/validate/:productId
router.get('/validate/:productId', TollFeeController.validateProductId);

module.exports = router;