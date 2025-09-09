const express = require('express');
const router = express.Router();
const HPPController = require('../controllers/hppController');

router.get('/data', HPPController.getHPP);

// POST /api/hpp/generate - Generate HPP calculation using stored procedure
// Body: { periode: "2025", ethical: "0", generik: "1" }
router.post('/generate', HPPController.generateHPPCalculation);

// GET /api/hpp - Get all HPP records with filtering and pagination
router.get('/', HPPController.getAllHPP);

// GET /api/hpp/:id - Get HPP by ID
router.get('/:id', HPPController.getHPPById);

// POST /api/hpp - Create new HPP with ingredients
router.post('/', HPPController.createHPP);

// PATCH /api/hpp/:id/status - Update HPP status
router.patch('/:id/status', HPPController.updateHPPStatus);

// DELETE /api/hpp/:id - Delete HPP (draft only)
router.delete('/:id', HPPController.deleteHPP);

module.exports = router;