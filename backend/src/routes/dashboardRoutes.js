const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');

// GET /api/dashboard/stats - Get comprehensive dashboard statistics
// Query: ?year=2025 (optional, defaults to latest year)
router.get('/stats', DashboardController.getStats);

// GET /api/dashboard/years - Get available years for dashboard selection
router.get('/years', DashboardController.getYears);

// GET /api/dashboard/actual-vs-standard - Get HPP Actual vs Standard comparison
// Query: ?year=2026&mode=YTD&month=1 (month only used when mode=MTD)
router.get('/actual-vs-standard', DashboardController.getActualVsStandard);

module.exports = router;
