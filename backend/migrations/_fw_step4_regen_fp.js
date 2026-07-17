/**
 * STEP 4 - regenerate FP (ANFUROX INJEKSI) only, now that FW's standard price
 * has been set to 10553 in M_COGS_STD_HRG_BAHAN.
 *
 * FW stays locked and untouched: its price is read from the master table, so FP
 * picks it up without FW ever being regenerated. Prechecked: all 12 of FP's
 * active formula lines (PI:A, KP:B, KS:C) have exact master matches, so nothing
 * is dropped by the SP's inner join.
 *
 * Expected: FP KS line FW  0 -> 96,813,222 ; FP HPP 25,167 -> 36,275
 * Rollback: t_COGS_HPP_Product_{Header,Detail_Formula}_bak_20260716
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
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const baseMap = new Map(baseline.map(r => [r.Product_ID, r]));
  const pool = await sql.connect(CONFIG);
  console.log(`Connected to ${CONFIG.server}/${CONFIG.database}\n`);

  const fwBefore = (await pool.request().query(
    `SELECT COUNT(*) n FROM t_COGS_HPP_Product_Detail_Formula WHERE Product_ID='FW' AND Periode='${PERIODE}'`)).recordset[0].n;

  console.log(`running: EXEC sp_COGS_GenerateHPP_perProduct '${PERIODE}','0','1','FP' ...`);
  const t0 = Date.now();
  await pool.request().query(`EXEC sp_COGS_GenerateHPP_perProduct '${PERIODE}','0','1','FP'`);
  console.log(`  finished in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  const line = await pool.request().query(`
    SELECT PPI_ItemID, PPI_QTY, PPI_UnitID, ITEM_PURCHASE_STD_PRICE, total
    FROM t_COGS_HPP_Product_Detail_Formula WHERE Product_ID='FP' AND Periode='${PERIODE}' AND PPI_ItemID='FW'`);
  console.log("FP's FW line now:");
  line.recordset.forEach(r =>
    console.log(`  ${r.PPI_ItemID} qty=${r.PPI_QTY} ${r.PPI_UnitID} price=${r.ITEM_PURCHASE_STD_PRICE} total=${Number(r.total).toLocaleString()}   (expected 96,813,222)`));

  const n = (await pool.request().query(
    `SELECT COUNT(*) n FROM t_COGS_HPP_Product_Detail_Formula WHERE Product_ID='FP' AND Periode='${PERIODE}'`)).recordset[0].n;
  console.log(`\nFP detail lines: ${n} (expected 12, baseline had 12)`);

  const rows = (await pool.request().query(HPP_QUERY)).recordset;
  console.log(`header rows: ${rows.length} (baseline ${baseline.length})`);

  const changed = rows.filter(r => Number(baseMap.get(r.Product_ID)?.HPP) !== Number(r.HPP));
  console.log(`\nproducts whose HPP changed vs baseline: ${changed.length}`);
  changed.forEach(r => {
    const b = baseMap.get(r.Product_ID);
    console.log(`  ${r.Product_ID.padEnd(6)} ${String(r.Product_Name).slice(0, 40).padEnd(42)} ${String(b.HPP).padStart(8)} -> ${String(r.HPP).padStart(8)}  (+${(Number(r.HPP) - Number(b.HPP)).toLocaleString()})`);
  });

  // FW must be completely untouched
  const fwAfter = (await pool.request().query(
    `SELECT COUNT(*) n FROM t_COGS_HPP_Product_Detail_Formula WHERE Product_ID='FW' AND Periode='${PERIODE}'`)).recordset[0].n;
  const fwLock = (await pool.request().query(
    `SELECT isnull(isLock,0) l FROM M_COGS_PRODUCT_FORMULA_FIX WHERE product_id='FW' AND Periode='${PERIODE}'`)).recordset[0].l;
  const fwHpp = rows.find(r => r.Product_ID === 'FW');
  console.log(`\nFW untouched check: detail lines ${fwBefore} -> ${fwAfter} | isLock=${fwLock} | HPP=${fwHpp?.HPP} (baseline ${baseMap.get('FW').HPP})`);

  await pool.close();
})().catch(e => { console.error('\nFATAL:', e.message); process.exit(1); });
