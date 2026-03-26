/**
 * Refresh stale non-COGS master tables on DEV.
 * Uses row-by-row INSERT (DEV SQL Server doesn't support OFFSET FETCH).
 */
const sql = require('mssql');

const LIVE = {
  user: 'sa', password: 'ygi_dny_jny_0902_apl',
  server: '192.168.1.21', port: 1433, database: 'lapifactory',
  options: { encrypt: false, trustServerCertificate: true },
  connectionTimeout: 15000, requestTimeout: 300000,
};

const DEV = {
  user: 'sa', password: 'ygi_dny_jny_0902_apl',
  server: '192.168.1.49', port: 1433, database: 'lapifactory',
  options: { encrypt: false, trustServerCertificate: true },
  connectionTimeout: 15000, requestTimeout: 600000,
};

function log(msg) { console.log(`[${new Date().toLocaleTimeString()}] ${msg}`); }

// Tables to refresh (small-medium master data tables that are stale)
const TABLES_TO_REFRESH = [
  'm_product_sediaan_produksi',   // 285 vs 280
  'm_ppi_detail',                 // 14778 vs 14564
  'm_ppi_header',                 // 2003 vs 1985
  'm_PPI_Status',                 // 2431 vs 2371
  'm_Product_pn_group',           // 52241 vs 51806
];

async function refreshTable(livePool, devPool, tableName) {
  log(`\n━━━ Refreshing ${tableName} ━━━`);

  // Get common columns
  const liveCols = (await livePool.request().query(`
    SELECT c.name FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id 
    WHERE t.name = '${tableName}' ORDER BY c.column_id
  `)).recordset.map(r => r.name);

  const devCols = (await devPool.request().query(`
    SELECT c.name FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id 
    WHERE t.name = '${tableName}' ORDER BY c.column_id
  `)).recordset.map(r => r.name);

  const commonCols = liveCols.filter(c => devCols.includes(c));

  // Check identity
  const idResult = await devPool.request().query(`
    SELECT c.name FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id 
    WHERE t.name = '${tableName}' AND c.is_identity = 1
  `);
  const hasIdentity = idResult.recordset.length > 0;

  // Get row counts
  const liveCount = (await livePool.request().query(`SELECT COUNT(*) as cnt FROM [${tableName}]`)).recordset[0].cnt;
  const devCount = (await devPool.request().query(`SELECT COUNT(*) as cnt FROM [${tableName}]`)).recordset[0].cnt;
  log(`  Before — LIVE: ${liveCount}, DEV: ${devCount}`);

  // Disable FK constraints referencing this table
  const fks = await devPool.request().query(`
    SELECT fk.name as fk_name, OBJECT_NAME(fk.parent_object_id) as ref_table
    FROM sys.foreign_keys fk
    JOIN sys.tables t ON fk.referenced_object_id = t.object_id
    WHERE t.name = '${tableName}'
  `);
  for (const fk of fks.recordset) {
    try { await devPool.request().query(`ALTER TABLE [${fk.ref_table}] NOCHECK CONSTRAINT [${fk.fk_name}]`); } catch(e) {}
  }

  // Clear DEV table
  await devPool.request().query(`DELETE FROM [${tableName}]`);

  // Read all from LIVE
  const colList = commonCols.map(c => `[${c}]`).join(', ');
  const allData = await livePool.request().query(`SELECT ${colList} FROM [${tableName}]`);

  if (hasIdentity) await devPool.request().query(`SET IDENTITY_INSERT [${tableName}] ON`);

  let copied = 0;
  let errors = 0;

  for (const row of allData.recordset) {
    const values = commonCols.map(c => {
      const v = row[c];
      if (v === null || v === undefined) return 'NULL';
      if (v instanceof Date) return `'${v.toISOString()}'`;
      if (typeof v === 'number') return String(v);
      if (typeof v === 'boolean') return v ? '1' : '0';
      if (Buffer.isBuffer(v)) return `0x${v.toString('hex')}`;
      return `N'${String(v).replace(/'/g, "''")}'`;
    });

    try {
      await devPool.request().query(`INSERT INTO [${tableName}] (${colList}) VALUES (${values.join(', ')})`);
      copied++;
    } catch (e) {
      errors++;
      if (errors <= 3) log(`  ERROR: ${e.message}`);
    }

    if (copied % 5000 === 0 && copied > 0) log(`  ... ${copied} / ${liveCount}`);
  }

  if (hasIdentity) await devPool.request().query(`SET IDENTITY_INSERT [${tableName}] OFF`);

  // Re-enable FK constraints
  for (const fk of fks.recordset) {
    try { await devPool.request().query(`ALTER TABLE [${fk.ref_table}] WITH CHECK CHECK CONSTRAINT [${fk.fk_name}]`); } catch(e) {}
  }

  const finalCount = (await devPool.request().query(`SELECT COUNT(*) as cnt FROM [${tableName}]`)).recordset[0].cnt;
  const status = errors === 0 ? '✓' : '⚠';
  log(`  ${status} Done — DEV: ${finalCount} rows (LIVE: ${liveCount})${errors > 0 ? `, ${errors} errors` : ''}`);
  return { tableName, liveCount, devCount: finalCount, errors };
}

async function main() {
  const livePool = await new sql.ConnectionPool(LIVE).connect();
  const devPool = await new sql.ConnectionPool(DEV).connect();
  log('Both servers connected.');

  const results = [];
  for (const table of TABLES_TO_REFRESH) {
    const r = await refreshTable(livePool, devPool, table);
    results.push(r);
  }

  log('\n════════════════════════════════════════════════════════════════');
  log('SUMMARY');
  log('════════════════════════════════════════════════════════════════');
  for (const r of results) {
    log(`  ${r.errors === 0 ? '✓' : '✗'} ${r.tableName.padEnd(40)} ${r.devCount} rows (LIVE: ${r.liveCount})`);
  }

  await livePool.close();
  await devPool.close();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
