const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');

// GET /api/dashboard/stats - Get comprehensive dashboard statistics
// Query: ?year=2025 (optional, defaults to latest year)
router.get('/stats', DashboardController.getStats);

// GET /api/dashboard/stats/actual - Get dashboard stats from HPP Actual batches
// Query: ?year=2026 (optional, defaults to current year)
router.get('/stats/actual', DashboardController.getActualStats);

// GET /api/dashboard/years - Get available years for dashboard selection
router.get('/years', DashboardController.getYears);

// GET /api/dashboard/actual-vs-standard - Get HPP Actual vs Standard comparison
// Query: ?year=2026&mode=YTD&month=1 (month only used when mode=MTD)
router.get('/actual-vs-standard', DashboardController.getActualVsStandard);

// GET /api/dashboard/actual-vs-standard/trend - Get 13-month trend data
// Query: ?lob=ALL (optional: ALL, ETHICAL, OTC, GENERIK)
router.get('/actual-vs-standard/trend', DashboardController.getActualVsStandardTrend);

// GET /api/dashboard/actual-vs-standard/by-periode - Get batch data for a specific periode
// Query: ?periode=202601&lob=ALL (lob optional: ALL, ETHICAL, OTC, GENERIK)
router.get('/actual-vs-standard/by-periode', DashboardController.getActualVsStandardByPeriode);

module.exports = router;
