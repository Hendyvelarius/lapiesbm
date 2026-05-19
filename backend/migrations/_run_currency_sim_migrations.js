/**
 * One-off runner for the Currency Simulation migrations:
 *   017_sp_generate_simulasi_cogs_currency_changes.sql
 *   018_sp_COGS_HPP_List_Simulasi_CurrencyChange.sql
 *
 * Splits each file on `GO` batch separators (which the mssql node driver
 * doesn't handle natively) and executes the batches sequentially.
 *
 * Safe to re-run: both SP files start with `IF OBJECT_ID(...) ... DROP PROCEDURE`.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const sql = require('mssql');

const CONFIG = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_HOST,
  port: parseInt(process.env.SQL_PORT, 10) || 1433,
  database: process.env.SQL_DATABASE,
  options: { encrypt: false, trustServerCertificate: true },
  connectionTimeout: 15000,
  requestTimeout: 60000,
};

const FILES = [
  '017_sp_generate_simulasi_cogs_currency_changes.sql',
  '018_sp_COGS_HPP_List_Simulasi_CurrencyChange.sql',
];

function splitBatches(sqlText) {
  // Split on lines that are exactly `GO` (case-insensitive, optional whitespace/semicolon)
  return sqlText
    .split(/^\s*GO\s*;?\s*$/gim)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

async function run() {
  console.log(`Connecting to ${CONFIG.server}:${CONFIG.port}/${CONFIG.database} as ${CONFIG.user}...`);
  const pool = await sql.connect(CONFIG);
  console.log('Connected.\n');

  try {
    for (const file of FILES) {
      const filePath = path.join(__dirname, file);
      const text = fs.readFileSync(filePath, 'utf8');
      const batches = splitBatches(text);
      console.log(`--- ${file} (${batches.length} batch${batches.length === 1 ? '' : 'es'}) ---`);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const preview = batch.split('\n')[0].slice(0, 80);
        process.stdout.write(`  [${i + 1}/${batches.length}] ${preview} ... `);
        try {
          await pool.request().batch(batch);
          console.log('OK');
        } catch (err) {
          console.log('FAIL');
          console.error(`\nError running batch ${i + 1} of ${file}:`);
          console.error(err.message);
          throw err;
        }
      }
      console.log('');
    }

    // Verify
    console.log('--- Verifying objects exist ---');
    for (const procName of [
      'sp_generate_simulasi_cogs_currency_changes',
      'sp_COGS_HPP_List_Simulasi_CurrencyChange',
    ]) {
      const r = await pool.request().query(
        `SELECT name, create_date, modify_date
         FROM sys.objects
         WHERE type = 'P' AND name = '${procName}'`
      );
      if (r.recordset.length > 0) {
        const row = r.recordset[0];
        console.log(`  ✓ ${procName}  (modified: ${row.modify_date.toISOString()})`);
      } else {
        console.log(`  ✗ ${procName} NOT FOUND`);
      }
    }

    console.log('\nMigrations applied successfully.');
  } finally {
    await pool.close();
  }
}

run().catch((err) => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
