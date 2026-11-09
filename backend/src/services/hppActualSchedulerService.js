/**
 * HPP Actual Scheduler Service
 * Automatically calculates HPP Actual for uncalculated batches daily at 22:00 WIB.
 * Retries every 10 minutes until 00:00 if the process fails.
 * Gives up at midnight and tries again the next day.
 */

const cron = require('node-cron');
const hppModel = require('../models/hppModel');

// Configuration
const SCHEDULED_HOUR = 22;  // 10 PM
const SCHEDULED_MINUTE = 0;
const RETRY_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes in milliseconds
const MAX_RETRY_HOUR = 0;   // Stop retrying at midnight (00:xx)

let retryTimeoutId = null;
let isRunning = false;
let scheduledTask = null;
let lastRunResult = null;

/**
 * Get the current period in YYYYMM format
 */
function getCurrentPeriode() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

/**
 * Get the previous period in YYYYMM format
 */
function getPreviousPeriode() {
  const now = new Date();
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${previous.getFullYear()}${String(previous.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Pick up actual manhours reported after a batch was calculated.
 * Covers the previous month too, since month-end batches get their hours in the next month.
 * A failure here is only logged: the calculation succeeded and tomorrow's run will catch up.
 */
async function refreshRecentManhours() {
  const from = getPreviousPeriode();
  const to = getCurrentPeriode();
  try {
    const updated = await hppModel.refreshHPPActualManhours(from, to);
    console.log(`[HPP Actual Scheduler] Manhours refreshed for ${from}-${to}: ${updated} batches updated`);
    return updated;
  } catch (error) {
    console.error(`[HPP Actual Scheduler] Manhour refresh failed: ${error.message}`);
    return null;
  }
}

/**
 * Check if current time is past midnight (retry window expired)
 */
function isPastMidnight() {
  const now = new Date();
  const hour = now.getHours();
  // Past midnight but before next scheduled run (22:00)
  return hour >= MAX_RETRY_HOUR && hour < SCHEDULED_HOUR;
}

/**
 * Main function to calculate HPP Actual for the current period.
 * The previous period is included so batches labelled after the last run of a month are not missed.
 */
async function calculateHPPActualDaily() {
  if (isRunning) {
    console.log('[HPP Actual Scheduler] Already running, skipping...');
    return { success: false, message: 'Already running' };
  }

  isRunning = true;
  const startTime = new Date();
  const periodes = [getPreviousPeriode(), getCurrentPeriode()];
  const periode = periodes.join('-');

  console.log(`[HPP Actual Scheduler] Starting HPP Actual calculation for periods ${periode} at ${startTime.toISOString()}`);

  try {
    // Calculate HPP Actual for uncalculated batches only (recalculateExisting = false),
    // so a retry after a partial failure does not repeat finished work
    const results = [];
    for (const period of periodes) {
      results.push(await hppModel.calculateHPPActual(period, false));
    }
    const total = (field) => results.reduce((sum, item) => sum + (item[field] || 0), 0);
    const result = {
      productsProcessed: total('productsProcessed'),
      totalProductBatches: total('totalProductBatches'),
      granulatesProcessed: total('granulatesProcessed'),
      errors: total('errors'),
      durationSeconds: total('durationSeconds'),
      errorBatches: results.flatMap((item) => item.errorBatches || []),
    };

    const endTime = new Date();
    const durationMs = endTime - startTime;

    console.log(`[HPP Actual Scheduler] Calculation completed in ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`[HPP Actual Scheduler] Results: ${result.productsProcessed} products processed, ${result.totalProductBatches} batches, ${result.granulatesProcessed} granulates, ${result.errors} errors`);

    const manhoursRefreshed = await refreshRecentManhours();

    // Clear retries on success
    clearRetryTimeout();
    isRunning = false;

    lastRunResult = {
      success: true,
      timestamp: endTime.toISOString(),
      periode,
      productsProcessed: result.productsProcessed,
      totalProductBatches: result.totalProductBatches,
      granulatesProcessed: result.granulatesProcessed,
      errors: result.errors,
      durationSeconds: result.durationSeconds,
      errorBatches: result.errorBatches || [],
      manhoursRefreshed
    };

    return lastRunResult;

  } catch (error) {
    console.error(`[HPP Actual Scheduler] Error: ${error.message}`);
    isRunning = false;

    lastRunResult = {
      success: false,
      timestamp: new Date().toISOString(),
      periode,
      message: error.message
    };

    // Check if we should retry
    if (!isPastMidnight()) {
      scheduleRetry();
      lastRunResult.willRetry = true;
      lastRunResult.retryIn = '10 minutes';
      return lastRunResult;
    } else {
      console.log('[HPP Actual Scheduler] Past midnight, stopping retries until next scheduled run');
      clearRetryTimeout();
      lastRunResult.willRetry = false;
      lastRunResult.reason = 'Past retry window (midnight)';
      return lastRunResult;
    }
  }
}

/**
 * Schedule a retry in 10 minutes
 */
function scheduleRetry() {
  clearRetryTimeout();

  console.log('[HPP Actual Scheduler] Scheduling retry in 10 minutes...');
  retryTimeoutId = setTimeout(async () => {
    console.log('[HPP Actual Scheduler] Executing scheduled retry...');
    await calculateHPPActualDaily();
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
 * Runs daily at 22:00 WIB
 */
function startScheduler() {
  if (scheduledTask) {
    console.log('[HPP Actual Scheduler] Scheduler already running');
    return;
  }

  // Cron expression: '0 22 * * *' = At 22:00 every day
  const cronExpression = `${SCHEDULED_MINUTE} ${SCHEDULED_HOUR} * * *`;

  scheduledTask = cron.schedule(cronExpression, async () => {
    console.log('[HPP Actual Scheduler] Cron trigger: Starting scheduled HPP Actual calculation');
    await calculateHPPActualDaily();
  }, {
    timezone: 'Asia/Jakarta' // WIB timezone
  });

  console.log(`[HPP Actual Scheduler] Started! Will run daily at ${SCHEDULED_HOUR}:${String(SCHEDULED_MINUTE).padStart(2, '0')} WIB`);
}

/**
 * Stop the cron scheduler
 */
function stopScheduler() {
  clearRetryTimeout();

  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[HPP Actual Scheduler] Stopped');
  }
}

/**
 * Get scheduler status
 */
function getSchedulerStatus() {
  return {
    isSchedulerRunning: scheduledTask !== null,
    isCalculationRunning: isRunning,
    hasPendingRetry: retryTimeoutId !== null,
    scheduledTime: `${SCHEDULED_HOUR}:${String(SCHEDULED_MINUTE).padStart(2, '0')} WIB`,
    retryIntervalMinutes: RETRY_INTERVAL_MS / 60000,
    lastRunResult
  };
}

/**
 * Manually trigger the calculation (for testing)
 */
async function manualTrigger(periode = null) {
  console.log('[HPP Actual Scheduler] Manual trigger initiated');
  if (periode) {
    // Override period for manual runs
    if (isRunning) {
      return { success: false, message: 'Already running' };
    }
    isRunning = true;
    try {
      const result = await hppModel.calculateHPPActual(periode, false);
      isRunning = false;
      lastRunResult = {
        success: true,
        timestamp: new Date().toISOString(),
        periode,
        productsProcessed: result.productsProcessed,
        totalProductBatches: result.totalProductBatches,
        granulatesProcessed: result.granulatesProcessed,
        errors: result.errors,
        durationSeconds: result.durationSeconds,
        manual: true
      };
      return lastRunResult;
    } catch (error) {
      isRunning = false;
      lastRunResult = { success: false, timestamp: new Date().toISOString(), periode, message: error.message, manual: true };
      throw error;
    }
  }
  return await calculateHPPActualDaily();
}

module.exports = {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  manualTrigger,
  calculateHPPActualDaily
};
