const express = require('express');
const router = express.Router();
const ReagenController = require('../controllers/reagenController');

// Get all reagen entries (with optional filters and product info)
// GET /api/reagen?productId=P001&userId=USER001&dateFrom=2024-01-01&dateTo=2024-12-31&withProductInfo=true
router.get('/', ReagenController.getAllReagen);

// Get reagen entry by ID
// GET /api/reagen/:id
router.get('/:id', ReagenController.getReagenById);

// Create new reagen entry
// POST /api/reagen
// Body: { productId, reagenRate, userId?, delegatedTo?, processDate? }
router.post('/', ReagenController.createReagen);

// Update reagen entry
// PUT /api/reagen/:id
// Body: { productId, reagenRate, userId?, delegatedTo?, processDate? }
router.put('/:id', ReagenController.updateReagen);

// Delete reagen entry
// DELETE /api/reagen/:id
router.delete('/:id', ReagenController.deleteReagen);

// Bulk delete reagen entries
// DELETE /api/reagen/bulk/delete
// Body: { ids: [1, 2, 3, 4] }
router.delete('/bulk/delete', ReagenController.bulkDeleteReagen);

// Bulk delete reagen entries by Periode
// DELETE /api/reagen/bulk/delete/periode/:periode
router.delete('/bulk/delete/periode/:periode', ReagenController.bulkDeleteReagenByPeriode);

// Bulk insert reagen entries (for import)
// POST /api/reagen/bulk/insert
// Body: { entries: [{productId, reagenRate, periode, userId?, delegatedTo?, processDate?}], userId? }
router.post('/bulk/insert', ReagenController.bulkInsertReagen);

// Validate Product ID (utility endpoint)
// GET /api/reagen/validate/:productId
router.get('/validate/:productId', ReagenController.validateProductId);

module.exports = router;