const express = require('express');
const router = express.Router();
const ExpiryCostController = require('../controllers/expiryCostController');

// Get expired cost allocation (read-only)
// GET /api/expiry-cost/allocation/data
router.get('/allocation/data', ExpiryCostController.getExpiredCostAllocation);

// Generate expiry cost allocation
// POST /api/expiry-cost/generate
// Body: { periode: "2025" }
router.post('/generate', ExpiryCostController.generateExpiryCostAllocation);

// Get all expired materials (with optional filters)
// GET /api/expiry-cost?periode=2024&itemId=ITEM001&userId=USER001&dateFrom=2024-01-01&dateTo=2024-12-31
router.get('/', ExpiryCostController.getAllExpiredMaterials);

// Get expired material by ID
// GET /api/expiry-cost/:id
router.get('/:id', ExpiryCostController.getExpiredMaterialById);

// Create new expired material
// POST /api/expiry-cost
// Body: { itemId, itemUnit, itemQty, periode?, userId?, processDate? }
router.post('/', ExpiryCostController.createExpiredMaterial);

// Update expired material
// PUT /api/expiry-cost/:id
// Body: { itemId, itemUnit, itemQty, periode?, userId?, processDate? }
router.put('/:id', ExpiryCostController.updateExpiredMaterial);

// Delete expired material
// DELETE /api/expiry-cost/:id
router.delete('/:id', ExpiryCostController.deleteExpiredMaterial);

module.exports = router;
