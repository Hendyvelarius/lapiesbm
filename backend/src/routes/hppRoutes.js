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

// GET /api/hpp/simulation/list - Get list of all simulation records (excludes soft-deleted)
router.get('/simulation/list', HPPController.getSimulationList);

// GET /api/hpp/simulation/marked-for-delete - Get list of simulations marked for deletion
router.get('/simulation/marked-for-delete', HPPController.getMarkedForDeleteList);

// PUT /api/hpp/simulation/:simulasiId/mark-delete - Mark simulation for deletion (soft delete)
// Body: { userId: "ABC123", empDeptID: "PL", empJobLevelID: "PL" }
router.put('/simulation/:simulasiId/mark-delete', HPPController.markSimulationForDelete);

// PUT /api/hpp/simulation/:simulasiId/restore - Restore simulation from deletion
router.put('/simulation/:simulasiId/restore', HPPController.restoreSimulation);

// PUT /api/hpp/simulation/bulk-mark-delete - Bulk mark price change group for deletion
// Body: { description: "Price Changes : ...", simulasiDate: "2025-09-24T00:27:38.087Z", userId: "ABC", empDeptID: "PL", empJobLevelID: "PL" }
router.put('/simulation/bulk-mark-delete', HPPController.bulkMarkPriceChangeGroupForDelete);

// DELETE /api/hpp/simulation/permanently-delete-marked - Permanently delete all marked simulations (PL/PL only)
// Body: { empDeptID: "PL", empJobLevelID: "PL" }
router.delete('/simulation/permanently-delete-marked', HPPController.permanentlyDeleteMarked);

// DELETE /api/hpp/simulation/:simulasiId/permanent - Permanently delete a single simulation (PL/PL only)
// Body: { empDeptID: "PL", empJobLevelID: "PL" }
router.delete('/simulation/:simulasiId/permanent', HPPController.permanentlyDeleteSimulation);

// GET /api/hpp/simulation/:simulasiId/owner - Get simulation owner info
router.get('/simulation/:simulasiId/owner', HPPController.getSimulationOwner);

// DELETE /api/hpp/simulation/bulk-delete-price-change-group - Bulk delete price change group (PERMANENT - PL/PL only)
// Body: { description: "Price Changes : AC 014B: 22 -> 31; ", simulasiDate: "2025-09-24T00:27:38.087Z" }
router.delete('/simulation/bulk-delete-price-change-group', HPPController.bulkDeletePriceChangeGroup);

// DELETE /api/hpp/simulation/:simulasiId - Delete simulation by ID (kept for backwards compatibility, but should use mark-delete)
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

// POST /api/hpp/simulations-for-group - Get simulations for product selection in a price change group
// Body: { description: "Price Changes : ...", simulasiDate: "2025-09-24T00:27:38.087Z", simulationType?: "Price Changes" }
router.post('/simulations-for-group', HPPController.getSimulationsForPriceChangeGroup);

// PUT /api/hpp/simulation/version-bulk - Bulk update Versi field for multiple simulations
// Body: { simulationVersions: [{ simulasiId: 1, versi: "1" }, { simulasiId: 2, versi: "0" }] }
router.put('/simulation/version-bulk', HPPController.updateSimulationVersionBulk);

// =====================================================================
// HPP ACTUAL ROUTES
// =====================================================================

// GET /api/hpp/actual/list - Get HPP Actual list for a period
// Query: ?periode=202601
router.get('/actual/list', HPPController.getHPPActualListData);

// GET /api/hpp/actual/periods - Get available periods for HPP Actual
router.get('/actual/periods', HPPController.getHPPActualPeriodsData);

// GET /api/hpp/actual/:hppActualId - Get HPP Actual detail (header + materials)
router.get('/actual/:hppActualId', HPPController.getHPPActualDetailData);

module.exports = router;