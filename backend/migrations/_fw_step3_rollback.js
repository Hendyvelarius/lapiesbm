/**
 * STEP 3 - roll FP and FW back to the pre-run baseline.
 *
 * The unlock -> generate -> re-lock run regenerated FW, and the SP's INNER JOIN
 * to M_COGS_STD_HRG_BAHAN dropped three of FW's formula lines whose suffixed ids
 * (B 065.000 / E 181.000 / K 150.000) exist in the master only WITHOUT the
 * suffix. FW's BK total collapsed 17,999,220.8 -> 2,070 and its HPP fell
 * 10553 -> 8386, corrupting figures the isLock=1 flag existed to protect.
 *
 * This restores, from the _bak_20260716 snapshots taken in step 1:
 *   - t_COGS_HPP_Product_Header      rows for FP + FW, periode 2026
 *   - t_COGS_HPP_Product_Detail_Formula rows for FP + FW, periode 2026
 *   - M_COGS_STD_HRG_BAHAN.ITEM_PURCHASE_STD_PRICE for FW (8386 -> 0)
 *
 * Verifies every one of the 337 products matches the baseline afterwards.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const sql = require('mssql');

const CONFIG = {
  user: process.env.SQL_USER, password: process.env.SQL_PASSWORD,
  server: process.env.SQL_HOST, port: parseInt(process.env.SQL_PORT, 10) || 1433,
  database: process.env.SQL_DATABASE,
  options: { encrypt: false, trustServerCertificate: true },
  connectionTimeout: 15000, requestTimeout: 600000,
};

const STAMP = '20260716';
const PERIODE = '2026';
const PRODUCTS = "'FP','FW'";
const BASELINE = path.join(__dirname, `_fw_baseline_${STAMP}.json`);

async function insertableColumns(pool, table) {
  const r = await pool.request().query(`
    SELECT c.COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS c
    WHERE c.TABLE_NAME = '${table}'
      AND COLUMNPROPERTY(OBJECT_ID('${table}'), c.COLUMN_NAME, 'IsIdentity') = 0
      AND COLUMNPROPERTY(OBJECT_ID('${table}'), c.COLUMN_NAME, 'IsComputed') = 0
    ORDER BY c.ORDINAL_POSITION`);
  return r.recordset.map(x => `[${x.COLUMN_NAME}]`).join(', ');
}

(async () => {
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const baseMap = new Map(baseline.map(r => [r.Product_ID, r]));
  const pool = await sql.connect(CONFIG);
  console.log(`Connected to ${CONFIG.server}/${CONFIG.database}\n`);

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    for (const [live, bak] of [
      ['t_COGS_HPP_Product_Header', `t_COGS_HPP_Product_Header_bak_${STAMP}`],
      ['t_COGS_HPP_Product_Detail_Formula', `t_COGS_HPP_Product_Detail_Formula_bak_${STAMP}`],
    ]) {
      const cols = await insertableColumns(pool, live);
      const del = await new sql.Request(tx).query(
        `DELETE FROM ${live} WHERE Periode='${PERIODE}' AND Product_ID IN (${PRODUCTS})`);
      const ins = await new sql.Request(tx).query(
        `INSERT INTO ${live} (${cols}) SELECT ${cols} FROM ${bak} WHERE Periode='${PERIODE}' AND Product_ID IN (${PRODUCTS})`);
      console.log(`${live}: deleted ${del.rowsAffected[0]}, restored ${ins.rowsAffected[0]}`);
    }

    const p = await new sql.Request(tx).query(`
      UPDATE m SET m.ITEM_PURCHASE_STD_PRICE = b.ITEM_PURCHASE_STD_PRICE
      FROM M_COGS_STD_HRG_BAHAN m
      JOIN M_COGS_STD_HRG_BAHAN_bak_${STAMP} b ON b.ITEM_ID=m.ITEM_ID AND b.Periode=m.Periode
      WHERE m.ITEM_ID='FW' AND m.Periode='${PERIODE}'`);
    console.log(`M_COGS_STD_HRG_BAHAN: restored FW price (${p.rowsAffected[0]} row)`);

    await tx.commit();
    console.log('\ntransaction committed.');
  } catch (e) {
    await tx.rollback();
    console.error('rolled back transaction:', e.message);
    throw e;
  }

  // ---- verify we are exactly back to baseline ----
  const rows = (await pool.request().query(`
    SELECT h.Product_ID,
           ROUND(((ISNULL(bb.total,0)+ISNULL(bk.total,0)) + ISNULL(h.Beban_Sisa_Bahan_Exp,0)
                 + (ISNULL(h.MH_Proses_Std,0)*ISNULL(h.Biaya_Proses,0))
                 + (ISNULL(h.MH_Kemas_Std,0)*ISNULL(h.Biaya_Kemas,0)))
                 / NULLIF(h.Batch_Size*h.Group_Rendemen/100,0), 0) AS HPP
    FROM t_COGS_HPP_Product_Header h
    LEFT JOIN (SELECT Periode,Product_ID,SUM(total) total FROM t_COGS_HPP_Product_Detail_Formula
               WHERE ITEM_TYPE='BB' GROUP BY Periode,Product_ID) bb ON bb.Product_ID=h.Product_ID AND bb.Periode=h.Periode
    LEFT JOIN (SELECT Periode,Product_ID,SUM(total) total FROM t_COGS_HPP_Product_Detail_Formula
               WHERE ITEM_TYPE='BK' GROUP BY Periode,Product_ID) bk ON bk.Product_ID=h.Product_ID AND bk.Periode=h.Periode
    WHERE h.Periode='${PERIODE}'`)).recordset;

  const diffs = rows.filter(r => Number(baseMap.get(r.Product_ID)?.HPP) !== Number(r.HPP));
  console.log(`\nheader rows: ${rows.length} (baseline ${baseline.length})`);
  console.log(`products differing from baseline: ${diffs.length}  ${diffs.length === 0 ? '-> fully restored' : ''}`);
  diffs.forEach(d => console.log(`  ${d.Product_ID}: baseline ${baseMap.get(d.Product_ID)?.HPP} vs now ${d.HPP}`));

  const fw = await pool.request().query(
    `SELECT ITEM_PURCHASE_STD_PRICE FROM M_COGS_STD_HRG_BAHAN WHERE ITEM_ID='FW' AND Periode='${PERIODE}'`);
  const lock = await pool.request().query(
    `SELECT isnull(isLock,0) isLock FROM M_COGS_PRODUCT_FORMULA_FIX WHERE product_id='FW' AND Periode='${PERIODE}'`);
  const lines = await pool.request().query(
    `SELECT COUNT(*) n FROM t_COGS_HPP_Product_Detail_Formula WHERE Product_ID='FW' AND Periode='${PERIODE}'`);
  console.log(`\nFW std price: ${fw.recordset[0].ITEM_PURCHASE_STD_PRICE} (baseline 0)`);
  console.log(`FW isLock   : ${lock.recordset[0].isLock} (must be 1)`);
  console.log(`FW detail lines restored: ${lines.recordset[0].n} (baseline 5)`);

  await pool.close();
})().catch(e => { console.error('\nFATAL:', e.message); process.exit(1); });
