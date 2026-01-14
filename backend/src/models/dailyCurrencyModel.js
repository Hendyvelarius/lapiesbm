const { connect } = require("../../config/sqlserver");
const sql = require("mssql");

/**
 * Daily Currency Model
 * Handles database operations for the m_COGS_Daily_Currency table
 */

// Helper function to safely parse date strings to Date objects
function parseDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return dateInput;
  
  // Handle string dates like "2025-12-14"
  if (typeof dateInput === 'string') {
    // Parse YYYY-MM-DD format explicitly to avoid timezone issues
    const parts = dateInput.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    // Fallback to standard parsing
    return new Date(dateInput);
  }
  
  return new Date(dateInput);
}

// Get all daily currency records
// Accepts either (startDate, endDate) or ({ startDate, endDate, limit, offset })
async function getAllDailyCurrency(startDateOrOptions = null, endDate = null) {
  try {
    // Handle both calling conventions
    let startDate, limit, offset;
    
    if (startDateOrOptions && typeof startDateOrOptions === 'object' && !(startDateOrOptions instanceof Date)) {
      // Called with options object
      startDate = startDateOrOptions.startDate;
      endDate = startDateOrOptions.endDate;
      limit = startDateOrOptions.limit;
      offset = startDateOrOptions.offset;
    } else {
      // Called with individual parameters
      startDate = startDateOrOptions;
    }
    
    const db = await connect();
    let query = `
      SELECT [date], USD, EUR, CHF, SGD, JPY, MYR, GBP, RMB, AUD, created_at, updated_at
      FROM m_COGS_Daily_Currency
    `;
    
    const conditions = [];
    const request = db.request();
    
    if (startDate) {
      conditions.push('[date] >= @startDate');
      const startDateObj = parseDate(startDate);
      request.input('startDate', sql.Date, startDateObj);
    }
    
    if (endDate) {
      conditions.push('[date] <= @endDate');
      const endDateObj = parseDate(endDate);
      request.input('endDate', sql.Date, endDateObj);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY [date] DESC';
    
    // Add pagination if specified
    if (limit) {
      query += ` OFFSET ${offset || 0} ROWS FETCH NEXT ${limit} ROWS ONLY`;
    }
    
    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error("Error fetching daily currency:", error);
    throw error;
  }
}

// Get currency for a specific date
async function getCurrencyByDate(date) {
  try {
    const db = await connect();
    const query = `
      SELECT [date], USD, EUR, CHF, SGD, JPY, MYR, GBP, RMB, AUD, created_at, updated_at
      FROM m_COGS_Daily_Currency
      WHERE [date] = @date
    `;
    
    const dateObj = parseDate(date);
    
    const result = await db.request()
      .input('date', sql.Date, dateObj)
      .query(query);
    
    return result.recordset[0] || null;
  } catch (error) {
    console.error("Error fetching currency by date:", error);
    throw error;
  }
}

// Get the latest available currency date in the database
async function getLatestCurrencyDate() {
  try {
    const db = await connect();
    const query = `
      SELECT TOP 1 [date]
      FROM m_COGS_Daily_Currency
      ORDER BY [date] DESC
    `;
    
    const result = await db.request().query(query);
    return result.recordset[0]?.date || null;
  } catch (error) {
    console.error("Error fetching latest currency date:", error);
    throw error;
  }
}

// Get the earliest available currency date in the database
async function getEarliestCurrencyDate() {
  try {
    const db = await connect();
    const query = `
      SELECT TOP 1 [date]
      FROM m_COGS_Daily_Currency
      ORDER BY [date] ASC
    `;
    
    const result = await db.request().query(query);
    return result.recordset[0]?.date || null;
  } catch (error) {
    console.error("Error fetching earliest currency date:", error);
    throw error;
  }
}

// Check if a date already exists in the database
async function dateExists(date) {
  try {
    const db = await connect();
    const query = `
      SELECT COUNT(*) as count
      FROM m_COGS_Daily_Currency
      WHERE [date] = @date
    `;
    
    const dateObj = parseDate(date);
    
    const result = await db.request()
      .input('date', sql.Date, dateObj)
      .query(query);
    
    return result.recordset[0].count > 0;
  } catch (error) {
    console.error("Error checking date existence:", error);
    throw error;
  }
}

// Get all existing dates in the database (for duplicate checking)
async function getExistingDates() {
  try {
    const db = await connect();
    const query = `
      SELECT [date]
      FROM m_COGS_Daily_Currency
      ORDER BY [date]
    `;
    
    const result = await db.request().query(query);
    return new Set(result.recordset.map(r => r.date.toISOString().split('T')[0]));
  } catch (error) {
    console.error("Error fetching existing dates:", error);
    throw error;
  }
}

// Insert a single currency record
async function insertCurrencyRecord(record) {
  try {
    const db = await connect();
    const query = `
      INSERT INTO m_COGS_Daily_Currency ([date], USD, EUR, CHF, SGD, JPY, MYR, GBP, RMB, AUD, created_at, updated_at)
      VALUES (@date, @USD, @EUR, @CHF, @SGD, @JPY, @MYR, @GBP, @RMB, @AUD, GETDATE(), GETDATE())
    `;
    
    const dateObj = parseDate(record.date);
    
    await db.request()
      .input('date', sql.Date, dateObj)
      .input('USD', sql.Float, record.USD || null)
      .input('EUR', sql.Float, record.EUR || null)
      .input('CHF', sql.Float, record.CHF || null)
      .input('SGD', sql.Float, record.SGD || null)
      .input('JPY', sql.Float, record.JPY || null)
      .input('MYR', sql.Float, record.MYR || null)
      .input('GBP', sql.Float, record.GBP || null)
      .input('RMB', sql.Float, record.RMB || null)
      .input('AUD', sql.Float, record.AUD || null)
      .query(query);
    
    return true;
  } catch (error) {
    console.error("Error inserting currency record:", error);
    throw error;
  }
}

// Bulk insert currency records (more efficient for large datasets)
async function bulkInsertCurrencyRecords(records) {
  try {
    const db = await connect();
    
    // Get existing dates to avoid duplicates
    const existingDates = await getExistingDates();
    
    // Filter out records that already exist
    const newRecords = records.filter(r => !existingDates.has(r.date));
    
    if (newRecords.length === 0) {
      console.log('No new records to insert - all dates already exist');
      return { inserted: 0, skipped: records.length };
    }
    
    console.log(`Inserting ${newRecords.length} new records (skipping ${records.length - newRecords.length} duplicates)`);
    
    // Create table type for bulk insert
    const table = new sql.Table('m_COGS_Daily_Currency');
    table.create = false;
    
    table.columns.add('date', sql.Date, { nullable: false });
    table.columns.add('USD', sql.Float, { nullable: true });
    table.columns.add('EUR', sql.Float, { nullable: true });
    table.columns.add('CHF', sql.Float, { nullable: true });
    table.columns.add('SGD', sql.Float, { nullable: true });
    table.columns.add('JPY', sql.Float, { nullable: true });
    table.columns.add('MYR', sql.Float, { nullable: true });
    table.columns.add('GBP', sql.Float, { nullable: true });
    table.columns.add('RMB', sql.Float, { nullable: true });
    table.columns.add('AUD', sql.Float, { nullable: true });
    table.columns.add('created_at', sql.DateTime, { nullable: true });
    table.columns.add('updated_at', sql.DateTime, { nullable: true });
    
    const now = new Date();
    
    for (const record of newRecords) {
      table.rows.add(
        new Date(record.date),
        record.USD || null,
        record.EUR || null,
        record.CHF || null,
        record.SGD || null,
        record.JPY || null,
        record.MYR || null,
        record.GBP || null,
        record.RMB || null,
        record.AUD || null,
        now,
        now
      );
    }
    
    await db.request().bulk(table);
    
    return { inserted: newRecords.length, skipped: records.length - newRecords.length };
  } catch (error) {
    console.error("Error bulk inserting currency records:", error);
    throw error;
  }
}

// Update a single currency record
async function updateCurrencyRecord(date, updates) {
  try {
    const db = await connect();
    
    const dateObj = parseDate(date);
    
    const setClauses = [];
    const request = db.request();
    request.input('date', sql.Date, dateObj);
    
    const columns = ['USD', 'EUR', 'CHF', 'SGD', 'JPY', 'MYR', 'GBP', 'RMB', 'AUD'];
    
    for (const col of columns) {
      if (updates[col] !== undefined) {
        setClauses.push(`${col} = @${col}`);
        request.input(col, sql.Float, updates[col]);
      }
    }
    
    if (setClauses.length === 0) {
      return 0;
    }
    
    setClauses.push('updated_at = GETDATE()');
    
    const query = `
      UPDATE m_COGS_Daily_Currency
      SET ${setClauses.join(', ')}
      WHERE [date] = @date
    `;
    
    const result = await request.query(query);
    return result.rowsAffected[0];
  } catch (error) {
    console.error("Error updating currency record:", error);
    throw error;
  }
}

// Delete currency records by date range
async function deleteCurrencyByDateRange(startDate, endDate) {
  try {
    const db = await connect();
    const query = `
      DELETE FROM m_COGS_Daily_Currency
      WHERE [date] >= @startDate AND [date] <= @endDate
    `;
    
    const startDateObj = parseDate(startDate);
    const endDateObj = parseDate(endDate);
    
    const result = await db.request()
      .input('startDate', sql.Date, startDateObj)
      .input('endDate', sql.Date, endDateObj)
      .query(query);
    
    return result.rowsAffected[0];
  } catch (error) {
    console.error("Error deleting currency records:", error);
    throw error;
  }
}

// Get currency count
async function getCurrencyCount() {
  try {
    const db = await connect();
    const query = `SELECT COUNT(*) as count FROM m_COGS_Daily_Currency`;
    
    const result = await db.request().query(query);
    return result.recordset[0].count;
  } catch (error) {
    console.error("Error fetching currency count:", error);
    throw error;
  }
}

// Get currency statistics (min, max, avg for each currency)
async function getCurrencyStats(startDate = null, endDate = null) {
  try {
    const db = await connect();
    let query = `
      SELECT 
        MIN([date]) as startDate,
        MAX([date]) as endDate,
        COUNT(*) as totalRecords,
        AVG(USD) as avgUSD, MIN(USD) as minUSD, MAX(USD) as maxUSD,
        AVG(EUR) as avgEUR, MIN(EUR) as minEUR, MAX(EUR) as maxEUR,
        AVG(CHF) as avgCHF, MIN(CHF) as minCHF, MAX(CHF) as maxCHF,
        AVG(SGD) as avgSGD, MIN(SGD) as minSGD, MAX(SGD) as maxSGD,
        AVG(JPY) as avgJPY, MIN(JPY) as minJPY, MAX(JPY) as maxJPY,
        AVG(MYR) as avgMYR, MIN(MYR) as minMYR, MAX(MYR) as maxMYR,
        AVG(GBP) as avgGBP, MIN(GBP) as minGBP, MAX(GBP) as maxGBP,
        AVG(RMB) as avgRMB, MIN(RMB) as minRMB, MAX(RMB) as maxRMB,
        AVG(AUD) as avgAUD, MIN(AUD) as minAUD, MAX(AUD) as maxAUD
      FROM m_COGS_Daily_Currency
    `;
    
    const conditions = [];
    const request = db.request();
    
    if (startDate) {
      conditions.push('[date] >= @startDate');
      const startDateObj = parseDate(startDate);
      request.input('startDate', sql.Date, startDateObj);
    }
    
    if (endDate) {
      conditions.push('[date] <= @endDate');
      const endDateObj = parseDate(endDate);
      request.input('endDate', sql.Date, endDateObj);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    const result = await request.query(query);
    return result.recordset[0];
  } catch (error) {
    console.error("Error fetching currency stats:", error);
    throw error;
  }
}

module.exports = {
  getAllDailyCurrency,
  getCurrencyByDate,
  getLatestCurrencyDate,
  getEarliestCurrencyDate,
  dateExists,
  getExistingDates,
  insertCurrencyRecord,
  bulkInsertCurrencyRecords,
  updateCurrencyRecord,
  deleteCurrencyByDateRange,
  getCurrencyCount,
  getCurrencyStats
};
