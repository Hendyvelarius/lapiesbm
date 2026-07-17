/**
 * STEP 1 of the FW (Pelarut Anfurox) costing fix - READ + BACKUP ONLY.
 *
 * Takes a full backup of the 2026 HPP tables and the standard price table
 * before the unlock -> full generate -> re-lock operation, and captures a
 * per-product HPP baseline to disk so the generate can be diffed afterwards.
 *
 * Makes no change to any existing row.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const sql = require('mssql');

const CONFIG = {
  user: process.env.SQL_USER, password: process.env.SQL_PASSWORD,
  server: process.env.SQL_HOST, port: parseInt(process.env.SQL_PORT, 10) || 1433,
  database: process.env.SQL_DATABASE,
  options: { encrypt: false, trustServerCertificate: true }, requestTimeout: 600000,
};

const STAMP = '20260716';
const PERIODE = '2026';
const OUT = require('path').join(__dirname, `_fw_baseline_${STAMP}.json`);

(async () => {
  const pool = await sql.connect(CONFIG);
  console.log(`Connected to ${CONFIG.server}/${CONFIG.database}\n`);

  // How much does a full generate actually touch?
  const locks = await pool.request().query(`
    SELECT isnull(isLock,0) AS isLock, COUNT(*) AS n
    FROM M_COGS_PRODUCT_FORMULA_FIX WHERE Periode='${PERIODE}' GROUP BY isnull(isLock,0)`);
  console.log('Products in M_COGS_PRODUCT_FORMULA_FIX for 2026:');
  locks.recordset.forEach(r =>
    console.log(`  isLock=${r.isLock}: ${r.n}  ${r.isLock === 0 ? '<-- these get deleted & regenerated' : '(protected)'}`));

  // Backups
  for (const [src, dst, where] of [
    ['t_COGS_HPP_Product_Header', `t_COGS_HPP_Product_Header_bak_${STAMP}`, `WHERE Periode='${PERIODE}'`],
    ['t_COGS_HPP_Product_Detail_Formula', `t_COGS_HPP_Product_Detail_Formula_bak_${STAMP}`, `WHERE Periode='${PERIODE}'`],
    ['M_COGS_STD_HRG_BAHAN', `M_COGS_STD_HRG_BAHAN_bak_${STAMP}`, `WHERE Periode='${PERIODE}'`],
    ['M_COGS_PRODUCT_FORMULA_FIX', `M_COGS_PRODUCT_FORMULA_FIX_bak_${STAMP}`, `WHERE Periode='${PERIODE}'`],
  ]) {
    const exists = await pool.request().query(`SELECT OBJECT_ID('${dst}') AS id`);
    if (exists.recordset[0].id) { console.log(`\nbackup ${dst} already exists - skipping`); continue; }
    await pool.request().query(`SELECT * INTO ${dst} FROM ${src} ${where}`);
    const n = await pool.request().query(`SELECT COUNT(*) n FROM ${dst}`);
    console.log(`\nbacked up ${src} -> ${dst}  (${n.recordset[0].n} rows)`);
  }

  // Per-product baseline: HPP as the app computes it
  const base = await pool.request().query(`
    SELECT h.Product_ID, p.Product_Name, h.Batch_Size, h.Group_Rendemen,
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
    WHERE h.Periode='${PERIODE}'`);

  fs.writeFileSync(OUT, JSON.stringify(base.recordset, null, 1));
  console.log(`\nbaseline captured: ${base.recordset.length} products -> ${OUT}`);

  const fp = base.recordset.find(r => r.Product_ID === 'FP');
  console.log(`\nFP baseline: HPP=${fp.HPP}  totalBB=${fp.totalBB}  totalBK=${fp.totalBK}`);
  const fw = base.recordset.find(r => r.Product_ID === 'FW');
  console.log(`FW baseline: HPP=${fw.HPP}  totalBB=${fw.totalBB}  totalBK=${fw.totalBK}`);

  await pool.close();
})();
