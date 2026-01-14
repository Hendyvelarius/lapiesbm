/**
 * Daily Currency Routes
 * API endpoints for daily currency data management
 */

const express = require('express');
const router = express.Router();
const dailyCurrencyController = require('../controllers/dailyCurrencyController');

/**
 * GET /api/daily-currency
 * Get all daily currency records
 * Query params: startDate, endDate, limit, offset
 */
router.get('/', dailyCurrencyController.getAllDailyCurrency);

/**
 * GET /api/daily-currency/stats
 * Get currency statistics (count, date range, supported currencies)
 */
router.get('/stats', dailyCurrencyController.getCurrencyStats);

/**
 * GET /api/daily-currency/scheduler/status
 * Get the status of the automatic daily currency scheduler
 */
router.get('/scheduler/status', dailyCurrencyController.getSchedulerStatus);

/**
 * POST /api/daily-currency/scheduler/trigger
 * Manually trigger the daily currency fetch
 */
router.post('/scheduler/trigger', dailyCurrencyController.triggerScheduler);

/**
 * POST /api/daily-currency/scheduler/start
 * Start the scheduler (if stopped)
 */
router.post('/scheduler/start', dailyCurrencyController.startScheduler);

/**
 * POST /api/daily-currency/scheduler/stop
 * Stop the scheduler
 */
router.post('/scheduler/stop', dailyCurrencyController.stopScheduler);

/**
 * GET /api/daily-currency/:date
 * Get currency data for a specific date
 * Param: date (YYYY-MM-DD format)
 */
router.get('/:date', dailyCurrencyController.getCurrencyByDate);

/**
 * POST /api/daily-currency/scrape/:year/:month
 * Scrape currency data for a specific month
 * Params: year, month (1-12)
 */
router.post('/scrape/:year/:month', dailyCurrencyController.scrapeCurrencyForMonth);

/**
 * POST /api/daily-currency/scrape-range
 * Scrape currency data for a date range
 * Body: { startYear, startMonth, endYear, endMonth }
 */
router.post('/scrape-range', dailyCurrencyController.scrapeCurrencyForRange);

/**
 * DELETE /api/daily-currency
 * Delete currency data for a date range
 * Body: { startDate, endDate }
 */
router.delete('/', dailyCurrencyController.deleteCurrencyByDateRange);

module.exports = router;
