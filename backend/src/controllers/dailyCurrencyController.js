/**
 * Daily Currency Controller
 * Handles API endpoints for currency data scraping and retrieval
 */

const dailyCurrencyModel = require('../models/dailyCurrencyModel');
const currencyScraperService = require('../services/currencyScraperService');
const currencyScheduler = require('../services/currencySchedulerService');

/**
 * Get all daily currency records
 */
const getAllDailyCurrency = async (req, res) => {
  try {
    const { startDate, endDate, limit, offset } = req.query;
    
    const result = await dailyCurrencyModel.getAllDailyCurrency({
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    });
    
    res.status(200).json({
      success: true,
      data: result,
      count: result.length
    });
  } catch (error) {
    console.error('Error getting daily currency data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve daily currency data',
      error: error.message
    });
  }
};

/**
 * Get currency data for a specific date
 */
const getCurrencyByDate = async (req, res) => {
  try {
    const { date } = req.params;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required'
      });
    }
    
    const result = await dailyCurrencyModel.getCurrencyByDate(date);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: `No currency data found for date: ${date}`
      });
    }
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting currency by date:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve currency data',
      error: error.message
    });
  }
};

/**
 * Get currency statistics (count, date range)
 */
const getCurrencyStats = async (req, res) => {
  try {
    const stats = await dailyCurrencyModel.getCurrencyStats();
    const supportedCurrencies = currencyScraperService.getSupportedCurrencies();
    
    res.status(200).json({
      success: true,
      data: {
        ...stats,
        supportedCurrencies
      }
    });
  } catch (error) {
    console.error('Error getting currency stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve currency statistics',
      error: error.message
    });
  }
};

/**
 * Scrape currency data for a specific month
 */
const scrapeCurrencyForMonth = async (req, res) => {
  try {
    const { year, month } = req.params;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        message: 'Invalid year or month parameter'
      });
    }
    
    console.log(`Starting currency scrape for ${yearNum}-${String(monthNum).padStart(2, '0')}`);
    
    // Fetch data from Frankfurter API
    const records = await currencyScraperService.fetchCurrenciesForMonth(yearNum, monthNum);
    
    if (records.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No data available for the specified period',
        data: {
          fetched: 0,
          inserted: 0,
          skipped: 0
        }
      });
    }
    
    // Get existing dates to avoid duplicates
    const existingDates = await dailyCurrencyModel.getExistingDates(
      records[0].date,
      records[records.length - 1].date
    );
    const existingDateSet = new Set(existingDates);
    
    // Filter out records that already exist
    const newRecords = records.filter(r => !existingDateSet.has(r.date));
    
    // Insert new records
    let insertedCount = 0;
    if (newRecords.length > 0) {
      const insertResult = await dailyCurrencyModel.bulkInsertCurrencyRecords(newRecords);
      insertedCount = insertResult.insertedCount;
    }
    
    res.status(200).json({
      success: true,
      message: `Currency scrape completed for ${yearNum}-${String(monthNum).padStart(2, '0')}`,
      data: {
        fetched: records.length,
        inserted: insertedCount,
        skipped: records.length - newRecords.length
      }
    });
  } catch (error) {
    console.error('Error scraping currency data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to scrape currency data',
      error: error.message
    });
  }
};

/**
 * Scrape currency data for a date range
 */
const scrapeCurrencyForRange = async (req, res) => {
  try {
    const { startYear, startMonth, endYear, endMonth } = req.body;
    
    // Validate parameters
    if (!startYear || !startMonth || !endYear || !endMonth) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: startYear, startMonth, endYear, endMonth'
      });
    }
    
    const startYearNum = parseInt(startYear);
    const startMonthNum = parseInt(startMonth);
    const endYearNum = parseInt(endYear);
    const endMonthNum = parseInt(endMonth);
    
    if (
      isNaN(startYearNum) || isNaN(startMonthNum) || 
      isNaN(endYearNum) || isNaN(endMonthNum) ||
      startMonthNum < 1 || startMonthNum > 12 ||
      endMonthNum < 1 || endMonthNum > 12
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid year or month parameters'
      });
    }
    
    // Check if end date is before start date
    if (
      endYearNum < startYearNum || 
      (endYearNum === startYearNum && endMonthNum < startMonthNum)
    ) {
      return res.status(400).json({
        success: false,
        message: 'End date cannot be before start date'
      });
    }
    
    console.log(`Starting currency scrape for ${startYearNum}-${String(startMonthNum).padStart(2, '0')} to ${endYearNum}-${String(endMonthNum).padStart(2, '0')}`);
    
    // Fetch data from Frankfurter API
    const records = await currencyScraperService.fetchCurrenciesForDateRange(
      startYearNum, startMonthNum, endYearNum, endMonthNum
    );
    
    if (records.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No data available for the specified period',
        data: {
          fetched: 0,
          inserted: 0,
          skipped: 0
        }
      });
    }
    
    // Get existing dates to avoid duplicates
    const existingDates = await dailyCurrencyModel.getExistingDates(
      records[0].date,
      records[records.length - 1].date
    );
    const existingDateSet = new Set(existingDates);
    
    // Filter out records that already exist
    const newRecords = records.filter(r => !existingDateSet.has(r.date));
    
    // Insert new records
    let insertedCount = 0;
    if (newRecords.length > 0) {
      const insertResult = await dailyCurrencyModel.bulkInsertCurrencyRecords(newRecords);
      insertedCount = insertResult.insertedCount;
    }
    
    res.status(200).json({
      success: true,
      message: `Currency scrape completed for ${startYearNum}-${String(startMonthNum).padStart(2, '0')} to ${endYearNum}-${String(endMonthNum).padStart(2, '0')}`,
      data: {
        fetched: records.length,
        inserted: insertedCount,
        skipped: records.length - newRecords.length,
        dateRange: {
          start: records[0]?.date,
          end: records[records.length - 1]?.date
        }
      }
    });
  } catch (error) {
    console.error('Error scraping currency data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to scrape currency data',
      error: error.message
    });
  }
};

/**
 * Delete currency data for a date range
 */
const deleteCurrencyByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: startDate, endDate'
      });
    }
    
    const result = await dailyCurrencyModel.deleteCurrencyByDateRange(startDate, endDate);
    
    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} currency records`,
      data: result
    });
  } catch (error) {
    console.error('Error deleting currency data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete currency data',
      error: error.message
    });
  }
};

/**
 * Get scheduler status
 */
const getSchedulerStatus = async (req, res) => {
  try {
    const status = currencyScheduler.getSchedulerStatus();
    
    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get scheduler status',
      error: error.message
    });
  }
};

/**
 * Manually trigger the daily currency fetch
 */
const triggerScheduler = async (req, res) => {
  try {
    console.log('Manual trigger request received');
    
    const result = await currencyScheduler.manualTrigger();
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.skipped ? 'Date already exists, skipped' : 'Currency rates fetched and saved',
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        willRetry: result.willRetry,
        retryIn: result.retryIn
      });
    }
  } catch (error) {
    console.error('Error triggering scheduler:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger scheduler',
      error: error.message
    });
  }
};

/**
 * Start the scheduler (if stopped)
 */
const startScheduler = async (req, res) => {
  try {
    currencyScheduler.startScheduler();
    const status = currencyScheduler.getSchedulerStatus();
    
    res.status(200).json({
      success: true,
      message: 'Scheduler started',
      data: status
    });
  } catch (error) {
    console.error('Error starting scheduler:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start scheduler',
      error: error.message
    });
  }
};

/**
 * Stop the scheduler
 */
const stopScheduler = async (req, res) => {
  try {
    currencyScheduler.stopScheduler();
    const status = currencyScheduler.getSchedulerStatus();
    
    res.status(200).json({
      success: true,
      message: 'Scheduler stopped',
      data: status
    });
  } catch (error) {
    console.error('Error stopping scheduler:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop scheduler',
      error: error.message
    });
  }
};

module.exports = {
  getAllDailyCurrency,
  getCurrencyByDate,
  getCurrencyStats,
  scrapeCurrencyForMonth,
  scrapeCurrencyForRange,
  deleteCurrencyByDateRange,
  getSchedulerStatus,
  triggerScheduler,
  startScheduler,
  stopScheduler
};
