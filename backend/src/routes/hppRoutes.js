const express = require('express');
const router = express.Router();
const HPPController = require('../controllers/hppController');

// GET /api/hpp/data - Get HPP data
router.get('/data', HPPController.getHPP);

// POST /api/hpp/generate - Generate HPP calculation using stored procedure
// Body: { periode: "2025" }
router.post('/generate', HPPController.generateHPPCalculation);

// POST /api/hpp/simulate-existing - Generate HPP simulation for existing product
// Body: { productId: "01", formulaString: "GLC#-#B#A" }
router.post('/simulate-existing', HPPController.generateHPPSimulation);

// GET /api/hpp/simulation/:simulasiId/header - Get simulation header details
router.get('/simulation/:simulasiId/header', HPPController.getSimulationHeader);

// GET /api/hpp/simulation/:simulasiId/detail-bahan - Get simulation detail materials
router.get('/simulation/:simulasiId/detail-bahan', HPPController.getSimulationDetailBahan);

module.exports = router;