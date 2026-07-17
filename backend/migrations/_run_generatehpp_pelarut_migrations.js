/**
 * One-off runner for the Pelarut / half-manufactured costing migrations:
 *   019_sp_COGS_GenerateHPP_pelarut_whitelist.sql
 *   020_sp_COGS_GenerateHPP_perProduct_parity.sql
 *
 * Both migrations patch the LIVE procedure definition in place and verify the
 * expected text exists first, so they abort rather than corrupt if the
 * procedures have changed. Both are idempotent.
 *
 * Prints the relevant lines of each procedure before and after so the change
 * is auditable.
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
  requestTimeout: 120000,
};

const FILES = [
  '019_sp_COGS_GenerateHPP_pelarut_whitelist.sql',
  '020_sp_COGS_GenerateHPP_perProduct_parity.sql',
];

const PROCS = ['sp_COGS_GenerateHPP', 'sp_COGS_GenerateHPP_perProduct'];

function splitBatches(sqlText) {
  return sqlText
    .split(/^\s*GO\s*;?\s*$/gim)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

async function showRelevant(pool, label) {
  console.log(`\n=== ${label} ===`);
  for (const proc of PROCS) {
    const r = await pool.request().query(
      `SELECT definition FROM sys.sql_modules WHERE object_id = OBJECT_ID('dbo.${proc}')`
    );
    if (!r.recordset.length) { console.log(`  ${proc}: NOT FOUND`); continue; }
    console.log(`  --- ${proc} ---`);
    r.recordset[0].definition.split(/\r?\n/).forEach((l, i) => {
      if (/granulat%'|pelarut%'|fnConvertBJOpponent|delete t_COGS_HPP_Product_(Header|Detail_Formula)|where periode=@periode/i.test(l)) {
        console.log(`    L${i + 1}: ${l.trim().slice(0, 155)}`);
      }
    });
  }
}

async function run() {
  console.log(`Connecting to ${CONFIG.server}:${CONFIG.port}/${CONFIG.database} as ${CONFIG.user}...`);
  const pool = await sql.connect(CONFIG);
  console.log('Connected.');

  try {
    await showRelevant(pool, 'BEFORE');

    for (const file of FILES) {
      const text = fs.readFileSync(path.join(__dirname, file), 'utf8');
      const batches = splitBatches(text);
      console.log(`\n--- applying ${file} (${batches.length} batch${batches.length === 1 ? '' : 'es'}) ---`);
      for (let i = 0; i < batches.length; i++) {
        process.stdout.write(`  [${i + 1}/${batches.length}] ... `);
        try {
          const res = await pool.request().batch(batches[i]);
          const msgs = (res && res.output) || null;
          console.log('OK');
          if (msgs) console.log(msgs);
        } catch (err) {
          console.log('FAIL');
          console.error(`\nError in batch ${i + 1} of ${file}:\n${err.message}`);
          throw err;
        }
      }
    }

    await showRelevant(pool, 'AFTER');
    console.log('\nMigrations applied.');
  } finally {
    await pool.close();
  }
}

run().catch((err) => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
