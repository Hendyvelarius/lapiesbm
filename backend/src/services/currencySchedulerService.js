/**
 * Currency Scheduler Service
 * Automatically fetches and saves daily currency rates at 11 PM
 * Retries every 5 minutes until midnight if fails
 */

const cron = require('node-cron');
const { fetchAllLatestCurrencyRates } = require('./currencyScraperService');
const dailyCurrencyModel = require('../models/dailyCurrencyModel');

// Configuration
const SCHEDULED_HOUR = 23; // 11 PM
const SCHEDULED_MINUTE = 0;
const RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_RETRY_HOUR = 0; // Stop retrying at midnight (00:xx)

let retryTimeoutId = null;
let isRunning = false;
let scheduledTask = null;

/**
 * Check if current time is past midnight (retry window expired)
 */
function isPastMidnight() {
  const now = new Date();
  const hour = now.getHours();
  // Past midnight but before next scheduled run (11 PM)
  return hour >= MAX_RETRY_HOUR && hour < SCHEDULED_HOUR;
}

/**
 * Main function to fetch and save daily currency rates
 */
async function fetchAndSaveDailyCurrency() {
  if (isRunning) {
    console.log('[Currency Scheduler] Already running, skipping...');
    return { success: false, message: 'Already running' };
  }

  isRunning = true;
  const startTime = new Date();
  console.log(`[Currency Scheduler] Starting daily currency fetch at ${startTime.toISOString()}`);

  try {
    // Fetch latest rates from API
    const latestRates = await fetchAllLatestCurrencyRates();

    if (!latestRates.date) {
      throw new Error('No date returned from API');
    }

    // Check if this date already exists in database
    const existingRecord = await dailyCurrencyModel.getCurrencyByDate(latestRates.date);

    if (existingRecord) {
      console.log(`[Currency Scheduler] Date ${latestRates.date} already exists in database, skipping...`);
      clearRetryTimeout();
      isRunning = false;
      return { 
        success: true, 
        message: 'Date already exists', 
        date: latestRates.date,
        skipped: true 
      };
    }

    // Prepare the record for insertion
    const currencyRecord = {
      Tanggal: latestRates.date,
      ...latestRates.rates
    };

    // Insert into database
    await dailyCurrencyModel.create(currencyRecord);

    console.log(`[Currency Scheduler] Successfully saved currency rates for ${latestRates.date}`);
    clearRetryTimeout();
    isRunning = false;

    return {
      success: true,
      message: 'Currency rates saved successfully',
      date: latestRates.date,
      rates: latestRates.rates
    };

  } catch (error) {
    console.error(`[Currency Scheduler] Error: ${error.message}`);
    isRunning = false;

    // Check if we should retry
    if (!isPastMidnight()) {
      scheduleRetry();
      return {
        success: false,
        message: error.message,
        willRetry: true,
        retryIn: '5 minutes'
      };
    } else {
      console.log('[Currency Scheduler] Past midnight, stopping retries until next scheduled run');
      clearRetryTimeout();
      return {
        success: false,
        message: error.message,
        willRetry: false,
        reason: 'Past retry window (midnight)'
      };
    }
  }
}

/**
 * Schedule a retry in 5 minutes
 */
function scheduleRetry() {
  clearRetryTimeout();
  
  console.log(`[Currency Scheduler] Scheduling retry in 5 minutes...`);
  retryTimeoutId = setTimeout(async () => {
    console.log('[Currency Scheduler] Executing scheduled retry...');
    await fetchAndSaveDailyCurrency();
  }, RETRY_INTERVAL_MS);
}

/**
 * Clear any pending retry timeout
 */
function clearRetryTimeout() {
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }
}

/**
 * Start the cron scheduler
 * Runs daily at 11 PM (23:00)
 */
function startScheduler() {
  if (scheduledTask) {
    console.log('[Currency Scheduler] Scheduler already running');
    return;
  }

  // Cron expression: minute hour day-of-month month day-of-week
  // '0 23 * * *' = At 23:00 (11 PM) every day
  const cronExpression = `${SCHEDULED_MINUTE} ${SCHEDULED_HOUR} * * *`;

  scheduledTask = cron.schedule(cronExpression, async () => {
    console.log('[Currency Scheduler] Cron trigger: Starting scheduled currency fetch');
    await fetchAndSaveDailyCurrency();
  }, {
    timezone: 'Asia/Jakarta' // WIB timezone
  });

  console.log(`[Currency Scheduler] Started! Will run daily at ${SCHEDULED_HOUR}:${String(SCHEDULED_MINUTE).padStart(2, '0')} WIB`);
}

/**
 * Stop the cron scheduler
 */
function stopScheduler() {
  clearRetryTimeout();
  
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[Currency Scheduler] Stopped');
  }
}

/**
 * Get scheduler status
 */
function getSchedulerStatus() {
  return {
    isSchedulerRunning: scheduledTask !== null,
    isFetchRunning: isRunning,
    hasPendingRetry: retryTimeoutId !== null,
    scheduledTime: `${SCHEDULED_HOUR}:${String(SCHEDULED_MINUTE).padStart(2, '0')} WIB`,
    retryIntervalMinutes: RETRY_INTERVAL_MS / 60000
  };
}

/**
 * Manually trigger the fetch (for testing)
 */
async function manualTrigger() {
  console.log('[Currency Scheduler] Manual trigger initiated');
  return await fetchAndSaveDailyCurrency();
}

module.exports = {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  manualTrigger,
  fetchAndSaveDailyCurrency
};
