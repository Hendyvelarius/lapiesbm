/**
 * STEP 2 of the FW (Pelarut Anfurox) costing fix.
 *
 *   1. temporarily unlock FW for 2026
 *   2. run sp_COGS_GenerateHPP '2026','0','1'  (full generate; only unlocked
 *      products are deleted/regenerated - 6 existing + FW = 7)
 *   3. re-lock FW  (in a finally, so it is restored even if the generate fails)
 *   4. verify FP + diff every product against the STEP 1 baseline
 *
 * Run _fw_step1_backup_baseline.js first - it takes the backups this relies on.
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

const PERIODE = '2026';
const BASELINE = path.join(__dirname, '_fw_baseline_20260716.json');

const HPP_QUERY = `
    SELECT h.Product_ID, p.Product_Name,
           ISNULL(bb.total,0) AS totalBB, ISNULL(bk.total,0) AS totalBK,
           ROUND(((ISNULL(bb.total,0)+ISNULL(bk.total,0)) + ISNULL(h.Beban_Sisa_Bahan_Exp,0)
                 + (ISNULL(h.MH_Proses_Std,0)*ISNULL(h.Biaya_Proses,0))
                 + (ISNULL(h.MH_Kemas_Std,0)*ISNULL(h.Biaya_Kemas,0)))
                 / NULLIF(h.Batch_Size*h.Group_Rendemen/100,0), 0) AS HPP
    FROM t_COGS_HPP_Product_Header h
    JOIN m_product p ON p.Product_ID=h.Product_ID
    LEFT JOIN (SELECT Periode,Product_ID,SUM(total) total FROM t_COGS_HPP_Product_Detail_Formula
               WHERE ITEM_TYPE='BB' GROUP BY Periode,Product_ID) bb ON bb.Product_ID=h.Product_ID AND bb.Periode=h.Periode
    LEFT JOIN (SELECT Periode,Product_ID,SUM(total) total FROM t_COGS_HPP_Product_Detail_Formula
               WHERE ITEM_TYPE='BK' GROUP BY Periode,Product_ID) bk ON bk.Product_ID=h.Product_ID AND bk.Periode=h.Periode
    WHERE h.Periode='${PERIODE}'`;

(async () => {
  if (!fs.existsSync(BASELINE)) throw new Error(`baseline not found: ${BASELINE} - run step 1 first`);
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const baseMap = new Map(baseline.map(r => [r.Product_ID, r]));

  const pool = await sql.connect(CONFIG);
  console.log(`Connected to ${CONFIG.server}/${CONFIG.database}\n`);

  let unlocked = false;
  try {
    const before = await pool.request().query(
      `SELECT isnull(isLock,0) isLock FROM M_COGS_PRODUCT_FORMULA_FIX WHERE product_id='FW' AND Periode='${PERIODE}'`);
    console.log(`FW isLock before: ${before.recordset[0].isLock}`);

    console.log('unlocking FW ...');
    const u = await pool.request().query(
      `UPDATE M_COGS_PRODUCT_FORMULA_FIX SET isLock=0 WHERE product_id='FW' AND Periode='${PERIODE}'`);
    if (u.rowsAffected[0] !== 1) throw new Error(`expected to unlock exactly 1 row, got ${u.rowsAffected[0]}`);
    unlocked = true;
    console.log('  FW unlocked (1 row)\n');

    console.log(`running: EXEC sp_COGS_GenerateHPP '${PERIODE}','0','1'  ...`);
    const t0 = Date.now();
    await pool.request().query(`EXEC sp_COGS_GenerateHPP '${PERIODE}','0','1'`);
    console.log(`  generate finished in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
  } finally {
    if (unlocked) {
      const r = await pool.request().query(
        `UPDATE M_COGS_PRODUCT_FORMULA_FIX SET isLock=1 WHERE product_id='FW' AND Periode='${PERIODE}'`);
      const chk = await pool.request().query(
        `SELECT isnull(isLock,0) isLock FROM M_COGS_PRODUCT_FORMULA_FIX WHERE product_id='FW' AND Periode='${PERIODE}'`);
      console.log(`re-locked FW (${r.rowsAffected[0]} row); isLock now = ${chk.recordset[0].isLock}\n`);
    }
  }

  // ---- verification ----
  const price = await pool.request().query(
    `SELECT ITEM_PURCHASE_STD_PRICE, ITEM_PURCHASE_UNIT FROM M_COGS_STD_HRG_BAHAN WHERE ITEM_ID='FW' AND Periode='${PERIODE}'`);
  console.log(`FW standard price now: ${price.recordset[0]?.ITEM_PURCHASE_STD_PRICE} per ${price.recordset[0]?.ITEM_PURCHASE_UNIT}   (expected 10553)`);

  const fwLine = await pool.request().query(
    `SELECT Product_ID, PPI_ItemID, PPI_QTY, PPI_UnitID, ITEM_PURCHASE_STD_PRICE, total
     FROM t_COGS_HPP_Product_Detail_Formula WHERE Periode='${PERIODE}' AND PPI_ItemID='FW'`);
  console.log('\nFP\'s FW line now:');
  fwLine.recordset.forEach(r =>
    console.log(`  ${r.Product_ID} ${r.PPI_ItemID} qty=${r.PPI_QTY} ${r.PPI_UnitID} price=${r.ITEM_PURCHASE_STD_PRICE} total=${r.total}   (expected total 96,813,222)`));

  const rows = (await pool.request().query(HPP_QUERY)).recordset;
  console.log(`\nheader rows now: ${rows.length}  (baseline had ${baseline.length})`);

  const changed = [];
  rows.forEach(r => {
    const b = baseMap.get(r.Product_ID);
    if (!b) { changed.push(`  + NEW ${r.Product_ID} ${r.Product_Name} HPP=${r.HPP}`); return; }
    if (Number(b.HPP) !== Number(r.HPP))
      changed.push(`  ~ ${r.Product_ID.padEnd(6)} ${String(r.Product_Name).slice(0, 44).padEnd(46)} HPP ${String(b.HPP).padStart(9)} -> ${String(r.HPP).padStart(9)}  (${Number(r.HPP) - Number(b.HPP) > 0 ? '+' : ''}${(Number(r.HPP) - Number(b.HPP)).toLocaleString()})`);
  });
  baseline.forEach(b => { if (!rows.find(r => r.Product_ID === b.Product_ID)) changed.push(`  - MISSING ${b.Product_ID} ${b.Product_Name} (was HPP=${b.HPP})`); });

  console.log(`\nproducts whose HPP changed: ${changed.length}`);
  changed.forEach(c => console.log(c));

  await pool.close();
})().catch(e => { console.error('\nFATAL:', e.message); process.exit(1); });
