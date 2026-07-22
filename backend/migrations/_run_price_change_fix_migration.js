/**
 * One-off runner for:
 *   021_fix_price_change_simulation_period_and_bb_join.sql
 *
 * Splits the file on `GO` batch separators (which the mssql node driver
 * doesn't handle natively) and executes the batches sequentially.
 *
 * Safe to re-run: the file contains only ALTER PROCEDURE statements.
 * Pre-change definitions are archived in
 * backend/stored_procedures_backup/pre_fix_20260722/.
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

const FILE = '021_fix_price_change_simulation_period_and_bb_join.sql';

function splitBatches(sqlText) {
  return sqlText
    .split(/^\s*GO\s*;?\s*$/gim)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

async function run() {
  console.log(`Connecting to ${CONFIG.server}:${CONFIG.port}/${CONFIG.database} as ${CONFIG.user}...`);
  const pool = await sql.connect(CONFIG);
  console.log('Connected.\n');

  const text = fs.readFileSync(path.join(__dirname, FILE), 'utf8');
  const batches = splitBatches(text);
  console.log(`${FILE}: ${batches.length} batch(es)`);

  for (let i = 0; i < batches.length; i++) {
    const preview = (batches[i].match(/ALTER PROCEDURE\s+\[?dbo\]?\.\[?(\w+)\]?/i) || [])[1] || 'batch';
    await pool.request().batch(batches[i]);
    console.log(`  [${i + 1}/${batches.length}] ${preview} -> OK`);
  }

  console.log('\nDone.');
  await pool.close();
}

run().catch((err) => {
  console.error('MIGRATION FAILED:', err.message);
  process.exit(1);
});
