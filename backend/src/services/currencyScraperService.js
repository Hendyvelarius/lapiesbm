/**
 * Currency Scraper Service
 * Fetches daily exchange rates from Frankfurter API and prepares them for database storage
 * 
 * API Documentation: https://www.frankfurter.app/docs/
 * 
 * Supported currencies (converted to IDR):
 * - USD (US Dollar)
 * - EUR (Euro)
 * - CHF (Swiss Franc)
 * - SGD (Singapore Dollar)
 * - JPY (Japanese Yen)
 * - MYR (Malaysian Ringgit)
 * - GBP (British Pound)
 * - CNY (Chinese Yuan - stored as RMB)
 * - AUD (Australian Dollar)
 */

const https = require('https');
const http = require('http');

// Currency mapping: API code -> Database column name
const CURRENCY_MAPPING = {
  'USD': 'USD',
  'EUR': 'EUR',
  'CHF': 'CHF',
  'SGD': 'SGD',
  'JPY': 'JPY',
  'MYR': 'MYR',
  'GBP': 'GBP',
  'CNY': 'RMB',  // Chinese Yuan is CNY in API, but we store as RMB
  'AUD': 'AUD'
};

// List of currencies to fetch
const CURRENCIES = Object.keys(CURRENCY_MAPPING);

// Base URL for Frankfurter API
const API_BASE_URL = 'api.frankfurter.app';

// Delay between API calls (in ms) to be respectful to the API
const API_DELAY = 500;

/**
 * Sleep function for adding delays between API calls
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make an HTTP GET request to the Frankfurter API
 */
function fetchFromAPI(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_BASE_URL,
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'eSBM-CurrencyScraper/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Failed to parse API response: ${e.message}`));
          }
        } else {
          reject(new Error(`API returned status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`API request failed: ${e.message}`));
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('API request timed out'));
    });

    req.end();
  });
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get the first day of a month
 */
function getFirstDayOfMonth(year, month) {
  return new Date(year, month - 1, 1);
}

/**
 * Get the first day of the next month
 */
function getFirstDayOfNextMonth(year, month) {
  if (month === 12) {
    return new Date(year + 1, 0, 1);
  }
  return new Date(year, month, 1);
}

/**
 * Fetch currency data for a single currency for a given month
 * @param {string} currency - Currency code (e.g., 'USD')
 * @param {number} year - Year (e.g., 2025)
 * @param {number} month - Month (1-12)
 * @returns {Object} - Object with dates as keys and rates as values
 */
async function fetchCurrencyForMonth(currency, year, month) {
  const startDate = formatDate(getFirstDayOfMonth(year, month));
  const endDate = formatDate(getFirstDayOfNextMonth(year, month));
  
  const path = `/${startDate}..${endDate}?from=${currency}&to=IDR`;
  
  console.log(`  Fetching ${currency} for ${year}-${String(month).padStart(2, '0')}: ${path}`);
  
  try {
    const response = await fetchFromAPI(path);
    
    if (!response.rates) {
      console.log(`  No rates found for ${currency} ${year}-${month}`);
      return {};
    }
    
    // Extract and transform the rates
    const rates = {};
    for (const [date, rateData] of Object.entries(response.rates)) {
      if (rateData.IDR) {
        rates[date] = rateData.IDR;
      }
    }
    
    console.log(`  Found ${Object.keys(rates).length} rates for ${currency}`);
    return rates;
  } catch (error) {
    console.error(`  Error fetching ${currency} for ${year}-${month}: ${error.message}`);
    return {};
  }
}

/**
 * Fetch all currencies for a given month and combine them by date
 * @param {number} year - Year (e.g., 2025)
 * @param {number} month - Month (1-12)
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Array} - Array of currency records ready for database insert
 */
async function fetchAllCurrenciesForMonth(year, month, progressCallback = null) {
  console.log(`\nFetching all currencies for ${year}-${String(month).padStart(2, '0')}...`);
  
  // Object to collect rates by date
  const ratesByDate = {};
  
  // Fetch each currency one by one
  for (let i = 0; i < CURRENCIES.length; i++) {
    const currency = CURRENCIES[i];
    const dbColumn = CURRENCY_MAPPING[currency];
    
    if (progressCallback) {
      progressCallback({
        currency,
        index: i + 1,
        total: CURRENCIES.length,
        year,
        month
      });
    }
    
    const rates = await fetchCurrencyForMonth(currency, year, month);
    
    // Merge rates into ratesByDate
    for (const [date, rate] of Object.entries(rates)) {
      if (!ratesByDate[date]) {
        ratesByDate[date] = { date };
      }
      ratesByDate[date][dbColumn] = rate;
    }
    
    // Add delay between API calls to be respectful
    if (i < CURRENCIES.length - 1) {
      await sleep(API_DELAY);
    }
  }
  
  // Convert to array and sort by date
  const records = Object.values(ratesByDate).sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  );
  
  console.log(`Collected ${records.length} unique dates for ${year}-${String(month).padStart(2, '0')}`);
  
  return records;
}

/**
 * Fetch currency data for a date range (multiple months)
 * @param {number} startYear - Start year
 * @param {number} startMonth - Start month (1-12)
 * @param {number} endYear - End year
 * @param {number} endMonth - End month (1-12)
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Array} - Array of all currency records
 */
async function fetchCurrenciesForDateRange(startYear, startMonth, endYear, endMonth, progressCallback = null) {
  console.log(`\n========================================`);
  console.log(`Starting currency data fetch`);
  console.log(`Date range: ${startYear}-${String(startMonth).padStart(2, '0')} to ${endYear}-${String(endMonth).padStart(2, '0')}`);
  console.log(`Currencies: ${CURRENCIES.join(', ')}`);
  console.log(`========================================\n`);
  
  const allRecords = [];
  const seenDates = new Set();
  
  let currentYear = startYear;
  let currentMonth = startMonth;
  
  // Calculate total months for progress
  const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
  let monthsProcessed = 0;
  
  while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
    monthsProcessed++;
    
    if (progressCallback) {
      progressCallback({
        type: 'month',
        year: currentYear,
        month: currentMonth,
        monthsProcessed,
        totalMonths
      });
    }
    
    const monthRecords = await fetchAllCurrenciesForMonth(currentYear, currentMonth, progressCallback);
    
    // Add only records with dates we haven't seen yet (handle overlap at month boundaries)
    for (const record of monthRecords) {
      if (!seenDates.has(record.date)) {
        seenDates.add(record.date);
        allRecords.push(record);
      }
    }
    
    // Move to next month
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    
    // Add delay between months
    if (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
      await sleep(1000); // 1 second delay between months
    }
  }
  
  // Sort all records by date
  allRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  console.log(`\n========================================`);
  console.log(`Fetch complete!`);
  console.log(`Total unique dates: ${allRecords.length}`);
  console.log(`Date range in data: ${allRecords[0]?.date || 'N/A'} to ${allRecords[allRecords.length - 1]?.date || 'N/A'}`);
  console.log(`========================================\n`);
  
  return allRecords;
}

/**
 * Fetch currency data for a single month (convenience function)
 */
async function fetchCurrenciesForMonth(year, month, progressCallback = null) {
  return fetchCurrenciesForDateRange(year, month, year, month, progressCallback);
}

/**
 * Fetch currency data for an entire year (convenience function)
 */
async function fetchCurrenciesForYear(year, progressCallback = null) {
  return fetchCurrenciesForDateRange(year, 1, year, 12, progressCallback);
}

/**
 * Get the list of supported currencies
 */
function getSupportedCurrencies() {
  return CURRENCIES.map(code => ({
    apiCode: code,
    dbColumn: CURRENCY_MAPPING[code]
  }));
}

/**
 * Fetch the latest currency rate for a single currency to IDR
 * Uses: https://api.frankfurter.app/latest?from=USD&to=IDR
 */
async function fetchLatestCurrencyRate(currencyCode) {
  const path = `/latest?from=${currencyCode}&to=IDR`;
  
  try {
    const data = await fetchFromAPI(path);
    
    if (data && data.rates && data.rates.IDR) {
      return {
        currency: currencyCode,
        dbColumn: CURRENCY_MAPPING[currencyCode],
        date: data.date,
        rate: data.rates.IDR
      };
    }
    
    throw new Error(`Invalid response structure for ${currencyCode}`);
  } catch (error) {
    console.error(`Error fetching latest rate for ${currencyCode}:`, error.message);
    throw error;
  }
}

/**
 * Fetch latest rates for all supported currencies
 * Returns an object with date and all currency rates mapped to DB columns
 */
async function fetchAllLatestCurrencyRates() {
  const results = {
    date: null,
    rates: {}
  };
  
  console.log('Fetching latest currency rates for all currencies...');
  
  for (let i = 0; i < CURRENCIES.length; i++) {
    const currency = CURRENCIES[i];
    
    try {
      console.log(`  Fetching ${currency} (${i + 1}/${CURRENCIES.length})...`);
      const result = await fetchLatestCurrencyRate(currency);
      
      // Set the date from the first successful response
      if (!results.date) {
        results.date = result.date;
      }
      
      // Map to DB column name
      results.rates[result.dbColumn] = result.rate;
      
      // Add delay between API calls (except for the last one)
      if (i < CURRENCIES.length - 1) {
        await sleep(API_DELAY);
      }
    } catch (error) {
      console.error(`  Failed to fetch ${currency}: ${error.message}`);
      // Continue with other currencies even if one fails
    }
  }
  
  console.log(`Completed fetching latest rates. Date: ${results.date}`);
  return results;
}

module.exports = {
  fetchCurrencyForMonth,
  fetchAllCurrenciesForMonth,
  fetchCurrenciesForDateRange,
  fetchCurrenciesForMonth,
  fetchCurrenciesForYear,
  getSupportedCurrencies,
  fetchLatestCurrencyRate,
  fetchAllLatestCurrencyRates,
  CURRENCY_MAPPING,
  CURRENCIES
};
