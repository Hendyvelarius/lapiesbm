/**
 * STEP 5 - restore FP's header row, and diagnose why perProduct failed to
 * reinsert it.
 *
 * sp_COGS_GenerateHPP_perProduct deleted FP's t_COGS_HPP_Product_Header row and
 * did not reinsert it, leaving FP with 12 correct detail rows but no header
 * (so it vanished from HPP Standard). The header's own fields (batch size,
 * rendemen, man-hours, formula) are unaffected by this work, so restoring the
 * pre-run header and keeping the newly generated detail gives the intended
 * result: FP costed with FW at 10553.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const sql = require('mssql');

const CONFIG = {
  user: process.env.SQL_USER, password: process.env.SQL_PASSWORD,
  server: process.env.SQL_HOST, port: parseInt(process.env.SQL_PORT, 10) || 1433,
  database: process.env.SQL_DATABASE,
  options: { encrypt: false, trustServerCertificate: true },
  connectionTimeout: 15000, requestTimeout: 600000,
};
const PERIODE = '2026';

(async () => {
  const pool = await sql.connect(CONFIG);
  console.log(`Connected to ${CONFIG.server}/${CONFIG.database}\n`);

  // ---- diagnose: which join kills FP's header insert? ----
  const d = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM vw_COGS_Product_Group WHERE periode='${PERIODE}' AND Group_ProductID='FP') AS in_product_group,
      (SELECT COUNT(*) FROM M_COGS_STD_PARAMETER WHERE Periode='${PERIODE}')                            AS std_parameter_rows,
      (SELECT COUNT(*) FROM vw_COGS_Pembebanan p
        JOIN vw_COGS_Product_Group g ON g.Group_PNCategory=p.Group_PNCategoryID
        WHERE g.periode='${PERIODE}' AND g.Group_ProductID='FP'
          AND p.group_periode='${PERIODE}' AND p.Group_ProductID IS NULL)                               AS category_default_pembebanan,
      (SELECT COUNT(*) FROM m_product WHERE Product_ID='FP')                                            AS in_m_product`);
  const x = d.recordset[0];
  console.log('perProduct header-insert join inputs for FP:');
  console.log(`  vw_COGS_Product_Group rows            : ${x.in_product_group}`);
  console.log(`  m_product rows                        : ${x.in_m_product}`);
  console.log(`  M_COGS_STD_PARAMETER rows (CROSS JOIN): ${x.std_parameter_rows}  ${x.std_parameter_rows === 0 ? '<-- ZERO: cross join wipes the insert' : ''}`);
  console.log(`  category-default vw_COGS_Pembebanan   : ${x.category_default_pembebanan}  ${x.category_default_pembebanan === 0 ? '<-- ZERO: inner join wipes the insert' : ''}`);

  // ---- restore ----
  const cols = (await pool.request().query(`
    SELECT c.COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS c
    WHERE c.TABLE_NAME='t_COGS_HPP_Product_Header'
      AND COLUMNPROPERTY(OBJECT_ID('t_COGS_HPP_Product_Header'), c.COLUMN_NAME,'IsIdentity')=0
      AND COLUMNPROPERTY(OBJECT_ID('t_COGS_HPP_Product_Header'), c.COLUMN_NAME,'IsComputed')=0
    ORDER BY c.ORDINAL_POSITION`)).recordset.map(r => `[${r.COLUMN_NAME}]`).join(', ');

  const before = (await pool.request().query(
    `SELECT COUNT(*) n FROM t_COGS_HPP_Product_Header WHERE Periode='${PERIODE}' AND Product_ID='FP'`)).recordset[0].n;
  console.log(`\nFP header rows before restore: ${before}`);

  if (before === 0) {
    const ins = await pool.request().query(`
      INSERT INTO t_COGS_HPP_Product_Header (${cols})
      SELECT ${cols} FROM t_COGS_HPP_Product_Header_bak_20260716
      WHERE Periode='${PERIODE}' AND Product_ID='FP'`);
    console.log(`restored FP header: ${ins.rowsAffected[0]} row`);
  } else {
    console.log('FP header already present - no restore needed');
  }

  // ---- verify final state ----
  const f = await pool.request().query(`
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
    WHERE h.Periode='${PERIODE}' AND h.Product_ID IN ('FP','FW')`);
  console.log('\nfinal state:');
  f.recordset.forEach(r =>
    console.log(`  ${r.Product_ID} ${String(r.Product_Name).padEnd(26)} BB=${Number(r.totalBB).toLocaleString().padStart(12)} BK=${Number(r.totalBK).toLocaleString().padStart(14)} HPP=${r.HPP}`));

  const counts = await pool.request().query(`
    SELECT (SELECT COUNT(*) FROM t_COGS_HPP_Product_Header WHERE Periode='${PERIODE}') hdr,
           (SELECT COUNT(*) FROM t_COGS_HPP_Product_Detail_Formula WHERE Periode='${PERIODE}') det`);
  console.log(`\nheader rows: ${counts.recordset[0].hdr} (expected 337)`);
  console.log(`detail rows: ${counts.recordset[0].det} (expected 5973)`);

  await pool.close();
})().catch(e => { console.error('\nFATAL:', e.message); process.exit(1); });
