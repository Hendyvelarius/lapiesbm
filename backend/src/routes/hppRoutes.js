const express = require('express');
const router = express.Router();
const HPPController = require('../controllers/hppController');

// GET /api/hpp/data - Get HPP data
router.get('/data', HPPController.getHPP);

// POST /api/hpp/generate - Generate HPP calculation using stored procedure
// Body: { periode: "2025" }
router.post('/generate', HPPController.generateHPPCalculation);

// GET /api/hpp/check-data-exists - Check if HPP data exists for a given year
// Query: ?year=2025
router.get('/check-data-exists', HPPController.checkHPPDataExists);

// POST /api/hpp/simulate-existing - Generate HPP simulation for existing product
// Body: { productId: "01", formulaString: "GLC#-#B#A" }
router.post('/simulate-existing', HPPController.generateHPPSimulation);

// GET /api/hpp/simulation/:simulasiId/header - Get simulation header details
router.get('/simulation/:simulasiId/header', HPPController.getSimulationHeader);

// GET /api/hpp/simulation/:simulasiId/detail-bahan - Get simulation detail materials
router.get('/simulation/:simulasiId/detail-bahan', HPPController.getSimulationDetailBahan);

// PUT /api/hpp/simulation/save - Save simulation (update header and replace materials)
// Body: { simulasiId: 10, headerData: {...}, materials: [...] }
router.put('/simulation/save', HPPController.saveSimulation);

// POST /api/hpp/simulation/create-custom - Create custom simulation (for custom formulas)
// Body: { headerData: {...}, materials: [...] }
router.post('/simulation/create-custom', HPPController.createCustomSimulation);

// POST /api/hpp/simulation/clone/:simulasiId - Clone simulation (duplicate header and materials)
// Body: { cloneDescription?: "Custom description for the clone" }
router.post('/simulation/clone/:simulasiId', HPPController.cloneSimulation);

// GET /api/hpp/simulation/list - Get list of all simulation records
router.get('/simulation/list', HPPController.getSimulationList);

// DELETE /api/hpp/simulation/bulk-delete-price-change-group - Bulk delete price change group
// Body: { description: "Price Changes : AC 014B: 22 -> 31; ", simulasiDate: "2025-09-24T00:27:38.087Z" }
router.delete('/simulation/bulk-delete-price-change-group', HPPController.bulkDeletePriceChangeGroup);

// DELETE /api/hpp/simulation/:simulasiId - Delete simulation by ID
router.delete('/simulation/:simulasiId', HPPController.deleteSimulation);

// POST /api/hpp/generate-price-change-simulation - Generate price change simulation using stored procedure
// Body: { materialPriceChanges: [{ materialId: "AC 209A", newPrice: 50.4 }, { materialId: "IN 003", newPrice: 45000 }] }
router.post('/generate-price-change-simulation', HPPController.generatePriceChangeSimulation);

// POST /api/hpp/generate-price-update-simulation - Generate price update simulation with Periode
// Body: { materialPriceChanges: [{ materialId: "AC 075D", newPrice: 500 }], periode: "2026" }
router.post('/generate-price-update-simulation', HPPController.generatePriceUpdateSimulation);

// POST /api/hpp/price-change-affected-products - Get affected products for price change simulation
// Body: { description: "Price Changes : AC 014B: 22 -> 31; ", simulasiDate: "2025-09-24T00:27:38.087Z" }
router.post('/price-change-affected-products', HPPController.getPriceChangeAffectedProducts);

// POST /api/hpp/price-update-affected-products - Get affected products for price update simulation
// Body: { description: "Price Update: ...", simulasiDate: "2025-09-24T00:27:38.087Z" }
router.post('/price-update-affected-products', HPPController.getPriceUpdateAffectedProducts);

// POST /api/hpp/commit-price-update - Commit price update to update material prices
// Body: { materialPrices: "IN 009:30#IN 010:31", periode: "2026" }
router.post('/commit-price-update', HPPController.commitPriceUpdate);

// GET /api/hpp/simulation/:simulasiId/summary - Get simulation summary with HNA and HPP ratio
router.get('/simulation/:simulasiId/summary', HPPController.getSimulationSummary);

module.exports = router;