/**
 * One-off data script (2026-07-22): add suffixed (.xxx) material codes to
 * M_COGS_STD_HRG_BAHAN for the current period.
 *
 * Requested by users via David Sanjaya: these packaging codes are used on formulas
 * but have no standard-price row, so they never resolve in the HPP simulation.
 * Each new row clones the parameters (type / purchase unit / std price / currency /
 * price-list id) of its non-suffixed base code, e.g. "D 300.000" copies "D 300".
 *
 * Rules:
 *   - a code that already has a row for the current period is left untouched
 *   - a code whose base has no row for the current period is skipped and reported
 *
 * Idempotent: existence is re-checked inside the transaction, so re-running inserts
 * nothing. Dry-run by default; pass --apply to write.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
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

const RAW = `
D 300.000, E 123.000, BR 155.000.
E 126.000, BR 163.000, D 317.000.
D 430.000, BR 233.001.
BA 126.000.
BR 255.000, D 462.000.
D 352.000, BR 165.000.
A 209.000.
K 148.000, BR 256.000, E 182.001, D 463.001.
D 464.001, E 183.001, BR 256.000, K 154.000.
E 179.000, BR 250.000, D 455.000.
D 454.000, BR 249.000, E 178.000.
BA 124.000.
D 457.000, BR 251.000.
BA 131.000.
D 469.000, BR 260.000
BA 130.000.
D 468.001, BR 260.000
L 101.000.
BR 253.000, K 141.000, D 460.000
BA 125.000.
BR 254.000, D 461.000.
BR 261.000, E 033.001, D 057.002, K 157.000.
E 143.002, BR 187.000, D 366.003
`;

const APPLY = process.argv.includes('--apply');
const CODES = [...new Set(RAW.match(/[A-Z]+\s+\d+\.\d{3}/g) || [])].sort();
const baseOf = (c) => c.slice(0, c.lastIndexOf('.'));

async function run() {
  console.log(`Connecting to ${CONFIG.server}:${CONFIG.port}/${CONFIG.database}...`);
  const pool = await sql.connect(CONFIG);

  const periode = (await pool.request().query(
    `select MAX(periode) p from t_COGS_HPP_Product_Header`)).recordset[0].p;
  console.log(`Current period: ${periode}`);
  console.log(`Distinct codes requested: ${CODES.length}\n`);

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const quoted = CODES.concat(CODES.map(baseOf))
      .map((c) => `'${c.replace(/'/g, "''")}'`).join(',');

    // Re-read inside the transaction so the decision and the write are consistent
    const rows = (await new sql.Request(tx).query(`
      select ITEM_ID, ITEM_TYPE, ITEM_PURCHASE_UNIT, ITEM_PURCHASE_STD_PRICE,
             ITEM_CURRENCY, ITEM_PRC_ID
      from M_COGS_STD_HRG_BAHAN with (UPDLOCK, HOLDLOCK)
      where Periode='${periode}' and ITEM_ID in (${quoted})`)).recordset;
    const byId = new Map(rows.map((r) => [r.ITEM_ID, r]));

    const skippedExisting = [], skippedNoBase = [], planned = [];
    for (const code of CODES) {
      if (byId.has(code)) { skippedExisting.push(code); continue; }
      const base = byId.get(baseOf(code));
      if (!base) { skippedNoBase.push(code); continue; }
      planned.push({ code, base });
    }

    console.log(`Already present, skipped : ${skippedExisting.length}`);
    console.log(`Base row missing, skipped: ${skippedNoBase.length}` +
      (skippedNoBase.length ? ` -> ${skippedNoBase.join(', ')}` : ''));
    console.log(`To insert                : ${planned.length}\n`);

    if (!APPLY) {
      await tx.rollback();
      console.log('DRY RUN - nothing written. Re-run with --apply to insert.');
      await pool.close();
      return;
    }

    let inserted = 0;
    for (const { code, base } of planned) {
      const r = await new sql.Request(tx)
        .input('periode', sql.NVarChar(8), periode)
        .input('itemId', sql.NVarChar(100), code)
        .input('itemType', sql.NVarChar(100), base.ITEM_TYPE)
        .input('unit', sql.NVarChar(100), base.ITEM_PURCHASE_UNIT)
        .input('price', sql.Float, base.ITEM_PURCHASE_STD_PRICE)
        .input('currency', sql.NVarChar(100), base.ITEM_CURRENCY)
        .input('prcId', sql.NVarChar(100), base.ITEM_PRC_ID)
        .query(`
          insert into M_COGS_STD_HRG_BAHAN
            (Periode, ITEM_ID, ITEM_TYPE, ITEM_PURCHASE_UNIT, ITEM_PURCHASE_STD_PRICE,
             ITEM_CURRENCY, ITEM_PRC_ID, user_id, delegated_to, process_date,
             flag_update, from_update, createdAt, updatedAt)
          values
            (@periode, @itemId, @itemType, @unit, @price,
             @currency, @prcId, 'SYSTEM', 'SYSTEM', GETDATE(),
             null, null, GETDATE(), GETDATE())`);
      inserted += r.rowsAffected[0];
    }

    if (inserted !== planned.length) {
      throw new Error(`expected ${planned.length} inserts, got ${inserted} - rolling back`);
    }

    await tx.commit();
    console.log(`Committed. Inserted ${inserted} rows for period ${periode}.`);
  } catch (err) {
    try { await tx.rollback(); } catch { /* already rolled back */ }
    throw err;
  }

  await pool.close();
}

run().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
