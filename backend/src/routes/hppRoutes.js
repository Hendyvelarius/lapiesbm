const express = require('express');
const router = express.Router();
const HPPController = require('../controllers/hppController');

// GET /api/hpp/data - Get HPP data
router.get('/data', HPPController.getHPP);

// POST /api/hpp/generate - Generate HPP calculation using stored procedure
// Body: { periode: "2025" }
router.post('/generate', HPPController.generateHPPCalculation);

module.exports = router;

module.exports = router;