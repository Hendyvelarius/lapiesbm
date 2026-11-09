/**
 * One-time repair for HPP Actual batches calculated before their product had a product group.
 * They have no LOB, group, standard manhours or rates, so their HPP holds material cost only.
 *
 * - Batches whose product now has a group: fill the empty fields from the same sources
 *   sp_COGS_Calculate_HPP_Actual uses.
 * - All no-LOB batches: copy actual manhours from the production report where they are empty.
 *
 * Only empty fields are written. Material rows and intermediates are not touched.
 *
 * Dry run (default):  node migrations/_fill_no_lob_hpp_actual_20261109.js
 * Apply:              node migrations/_fill_no_lob_hpp_actual_20261109.js --apply
 *
 * --apply first saves every no-LOB header to a JSON file next to this script, and refuses to run
 * twice over the same backup. Writes happen in one transaction that rolls back if a check fails.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { connect, sql } = require('../config/sqlserver');

const BACKUP_FILE = path.join(__dirname, '_fill_no_lob_hpp_actual_20261109_backup.json');
const MODIFIED_BY = 'NOLOB_FILL';
const NO_LOB = `h.LOB IS NULL AND h.Calculation_Status = 'COMPLETED'`;

// The procedure tries the batch's year, then the year before
const inGroupYears = (alias) => `${alias}.Periode IN (LEFT(h.Periode, 4), CAST(CAST(LEFT(h.Periode, 4) AS INT) - 1 AS VARCHAR))`;

const FILL_SOURCES = `
  FROM t_COGS_HPP_Actual_Header h
  CROSS APPLY (
    SELECT TOP 1 v.LOB FROM vw_COGS_Product_Group v
    WHERE v.Group_ProductID = h.DNc_ProductID AND ${inGroupYears('v')} ORDER BY v.Periode DESC
  ) grp
  OUTER APPLY (
    SELECT TOP 1 g.* FROM M_COGS_PRODUCT_GROUP_MANUAL g
    WHERE g.Group_ProductID = h.DNc_ProductID AND ${inGroupYears('g')} ORDER BY g.Periode DESC
  ) g
  OUTER APPLY (
    SELECT TOP 1 f.Std_Output FROM M_COGS_PRODUCT_FORMULA_FIX f
    WHERE f.Product_ID = h.DNc_ProductID AND ${inGroupYears('f')} ORDER BY f.Periode DESC
  ) f
  LEFT JOIN t_COGS_HPP_Product_Header std
    ON std.Product_ID = h.DNc_ProductID AND std.Periode = LEFT(h.Periode, 4)
  WHERE ${NO_LOB}
`;

// Same priority as the procedure: the standard HPP value wins over the product group value
const FILL_COLUMNS = {
  Group_PNCategory: 'g.Group_PNCategory',
  Group_PNCategory_Name: 'g.Group_PNCategoryName',
  Group_PNCategory_Dept: 'g.Group_Dept',
  Batch_Size_Std: 'f.Std_Output',
  Rendemen_Std: 'g.Group_Rendemen',
  MH_Proses_Std: 'g.Group_ManHourPros',
  MH_Kemas_Std: 'g.Group_ManHourPack',
  MH_Timbang_BB: 'ISNULL(std.MH_Timbang_BB, g.Group_MHT_BB)',
  MH_Timbang_BK: 'ISNULL(std.MH_Timbang_BK, g.Group_MHT_BK)',
  MH_Analisa_Std: 'ISNULL(std.MH_Analisa_Std, g.Group_MH_Analisa)',
  MH_Mesin_Std: 'ISNULL(std.MH_Mesin_Std, g.Group_KWH_Mesin)',
  Rate_MH_Proses: 'std.Biaya_Proses',
  Rate_MH_Kemas: 'std.Biaya_Kemas',
  Rate_MH_Timbang: 'std.Biaya_Proses',
  Direct_Labor: 'std.Direct_Labor',
  Factory_Overhead: 'std.Factory_Over_Head',
  Depresiasi: 'std.Depresiasi',
  Biaya_Analisa: 'std.Biaya_Analisa',
  Biaya_Reagen: 'std.Biaya_Reagen',
  Rate_PLN: 'std.Rate_PLN',
};

const MANHOUR_SOURCES = `
  FROM t_COGS_HPP_Actual_Header h
  JOIN (
    SELECT Reg_BatchNo, REPLACE(Periode, ' ', '') AS Periode, Group_productid,
           CAST(MIN(MH_NyataProses) AS DECIMAL(18,4)) AS MH_Proses,
           CAST(MIN(MH_NyataKemas) AS DECIMAL(18,4)) AS MH_Kemas
    FROM tmp_spLapProduksi_GWN_ReleaseQA
    GROUP BY Reg_BatchNo, REPLACE(Periode, ' ', ''), Group_productid
    HAVING MIN(MH_NyataProses) = MAX(MH_NyataProses)
       AND MIN(MH_NyataKemas) = MAX(MH_NyataKemas)
  ) src ON src.Reg_BatchNo = h.BatchNo AND src.Periode = h.Periode AND src.Group_productid = h.DNc_ProductID
  WHERE ${NO_LOB} AND (h.MH_Proses_Actual IS NULL OR h.MH_Kemas_Actual IS NULL)
`;

const MATERIAL_TOTALS = `
  SELECT (SELECT SUM(ISNULL(Total_Cost_BB, 0) + ISNULL(Total_Cost_BK, 0)) FROM t_COGS_HPP_Actual_Header) AS headerCost,
         (SELECT SUM(ISNULL(Qty_In_PO_Unit, 0) * ISNULL(Unit_Price_IDR, 0)) FROM t_COGS_HPP_Actual_Detail) AS detailCost,
         (SELECT COUNT(*) FROM t_COGS_HPP_Actual_Detail) AS detailRows,
         (SELECT COUNT(*) FROM t_COGS_HPP_Actual_Header) AS headerRows
`;

const single = async (request, query) => (await request.query(query)).recordset[0];

(async () => {
  const apply = process.argv.includes('--apply');
  const pool = await connect();

  const { total } = await single(pool.request(), `SELECT COUNT(*) AS total FROM t_COGS_HPP_Actual_Header h WHERE ${NO_LOB}`);
  const counts = Object.entries(FILL_COLUMNS)
    .map(([column, source]) => `SUM(CASE WHEN h.${column} IS NULL AND ${source} IS NOT NULL THEN 1 ELSE 0 END) AS ${column}`)
    .join(', ');
  const fill = await single(pool.request(), `SELECT COUNT(*) AS batches, COUNT(DISTINCT h.HPP_Actual_ID) AS distinctBatches, ${counts} ${FILL_SOURCES}`);
  const { batches, distinctBatches, ...filledByColumn } = fill;
  const { withStandard } = await single(pool.request(), `SELECT SUM(CASE WHEN std.Product_ID IS NOT NULL THEN 1 ELSE 0 END) AS withStandard ${FILL_SOURCES}`);
  const { manhours } = await single(pool.request(), `SELECT COUNT(*) AS manhours ${MANHOUR_SOURCES}`);

  console.log(`No-LOB batches: ${total}`);
  console.log(`To fill from product group: ${batches} (distinct ${distinctBatches}), with a standard HPP row: ${withStandard}`);
  console.log(`Empty fields that would be filled: ${JSON.stringify(filledByColumn)}`);
  console.log(`Batches receiving actual manhours: ${manhours}`);
  if (batches !== distinctBatches) throw new Error('A batch matches more than one standard HPP row');

  if (!apply) {
    console.log('Dry run only. Nothing was changed. Use --apply to write.');
    process.exit(0);
  }
  if (fs.existsSync(BACKUP_FILE)) throw new Error(`Backup already exists, refusing to overwrite: ${BACKUP_FILE}`);

  const backup = (await pool.request().query(`SELECT h.* FROM t_COGS_HPP_Actual_Header h WHERE ${NO_LOB}`)).recordset;
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 1));
  console.log(`Backup written: ${BACKUP_FILE} (${backup.length} rows)`);

  const before = await single(pool.request(), MATERIAL_TOTALS);
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const request = () => new sql.Request(transaction);

    // Manhours first, while every target batch still has no LOB
    const manhourResult = await request().query(`
      UPDATE h
      SET MH_Proses_Actual = ISNULL(h.MH_Proses_Actual, src.MH_Proses),
          MH_Kemas_Actual = ISNULL(h.MH_Kemas_Actual, src.MH_Kemas),
          Modified_Date = GETDATE(), Modified_By = '${MODIFIED_BY}'
      ${MANHOUR_SOURCES}
    `);

    const assignments = Object.entries(FILL_COLUMNS)
      .map(([column, source]) => `${column} = ISNULL(h.${column}, ${source})`)
      .join(',\n          ');
    const fillResult = await request().query(`
      UPDATE h
      SET LOB = grp.LOB,
          ${assignments},
          Rendemen_Actual = ISNULL(h.Rendemen_Actual,
            CASE WHEN ISNULL(h.Batch_Size_Std, f.Std_Output) > 0
                 THEN h.Output_Actual * 100.0 / ISNULL(h.Batch_Size_Std, f.Std_Output) END),
          Cost_Utility = CASE WHEN ISNULL(h.Cost_Utility, 0) = 0
                              THEN ISNULL(std.MH_Mesin_Std, 0) * ISNULL(std.Rate_PLN, 0)
                              ELSE h.Cost_Utility END,
          Modified_Date = GETDATE(), Modified_By = '${MODIFIED_BY}'
      ${FILL_SOURCES}
    `);

    const after = await single(request(), MATERIAL_TOTALS);
    const { remaining } = await single(request(), `SELECT COUNT(*) AS remaining FROM t_COGS_HPP_Actual_Header h WHERE ${NO_LOB}`);
    const checks = {
      manhours: manhourResult.rowsAffected[0] === manhours,
      filled: fillResult.rowsAffected[0] === batches,
      remaining: remaining === total - batches,
      materialsUnchanged: JSON.stringify(before) === JSON.stringify(after),
    };
    console.log('Checks:', JSON.stringify(checks));
    if (Object.values(checks).includes(false)) throw new Error('A check failed');

    await transaction.commit();
    console.log(`Committed. Manhours: ${manhourResult.rowsAffected[0]}. Filled: ${fillResult.rowsAffected[0]}. Still no LOB: ${remaining}.`);
    process.exit(0);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
})().catch((error) => {
  console.error('FAILED, nothing was written to the table:', error.message);
  process.exit(1);
});
