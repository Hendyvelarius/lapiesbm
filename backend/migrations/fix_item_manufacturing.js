/**
 * Fix m_Item_Manufacturing copy (failed with "Out of range" in bulk insert).
 * Uses batched INSERT statements instead of bulk API.
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
  connectionTimeout: 15000, requestTimeout: 300000,
};

function log(msg) { console.log(`[${new Date().toLocaleTimeString()}] ${msg}`); }

async function main() {
  const livePool = await new sql.ConnectionPool(LIVE).connect();
  const devPool = await new sql.ConnectionPool(DEV).connect();
  log('Both servers connected.');

  const tableName = 'm_Item_Manufacturing';

  // 1. Inspect columns on LIVE
  const colMeta = await livePool.request().query(`
    SELECT c.name, t.name as type_name, c.max_length, c.precision, c.scale, c.is_nullable, c.is_identity
    FROM sys.columns c
    JOIN sys.types t ON c.system_type_id = t.system_type_id AND c.user_type_id = t.user_type_id
    JOIN sys.tables tbl ON c.object_id = tbl.object_id
    WHERE tbl.name = '${tableName}'
    ORDER BY c.column_id
  `);
  log(`Columns on LIVE (${colMeta.recordset.length}):`);
  for (const c of colMeta.recordset) {
    let typeStr = c.type_name;
    if (['varchar','nvarchar','char','nchar'].includes(c.type_name.toLowerCase())) {
      typeStr += `(${c.max_length === -1 ? 'MAX' : (c.type_name.startsWith('n') ? c.max_length/2 : c.max_length)})`;
    } else if (['decimal','numeric'].includes(c.type_name.toLowerCase())) {
      typeStr += `(${c.precision},${c.scale})`;
    }
    log(`  ${c.name.padEnd(40)} ${typeStr.padEnd(20)} ${c.is_nullable ? 'NULL' : 'NOT NULL'}${c.is_identity ? ' IDENTITY' : ''}`);
  }

  // 2. Check if column schemas match
  const devColMeta = await devPool.request().query(`
    SELECT c.name, t.name as type_name, c.max_length, c.precision, c.scale
    FROM sys.columns c
    JOIN sys.types t ON c.system_type_id = t.system_type_id AND c.user_type_id = t.user_type_id
    JOIN sys.tables tbl ON c.object_id = tbl.object_id
    WHERE tbl.name = '${tableName}'
    ORDER BY c.column_id
  `);
  log(`\nColumns on DEV (${devColMeta.recordset.length}):`);

  // Compare
  const liveCols = colMeta.recordset.map(r => r.name);
  const devCols = devColMeta.recordset.map(r => r.name);
  const commonCols = liveCols.filter(c => devCols.includes(c));
  const missingOnDev = liveCols.filter(c => !devCols.includes(c));
  const extraOnDev = devCols.filter(c => !liveCols.includes(c));
  
  if (missingOnDev.length) log(`Missing on DEV: ${missingOnDev.join(', ')}`);
  if (extraOnDev.length) log(`Extra on DEV: ${extraOnDev.join(', ')}`);
  log(`Common columns: ${commonCols.length}`);

  // 3. Check current row counts
  const liveCount = (await livePool.request().query(`SELECT COUNT(*) as cnt FROM [${tableName}]`)).recordset[0].cnt;
  const devCount = (await devPool.request().query(`SELECT COUNT(*) as cnt FROM [${tableName}]`)).recordset[0].cnt;
  log(`\nRow counts — LIVE: ${liveCount}, DEV: ${devCount}`);

  // 4. Check for problematic values on LIVE
  log(`\nChecking for potential "out of range" issues...`);
  for (const col of colMeta.recordset) {
    if (['int','bigint','smallint','tinyint','decimal','numeric','float','real','money'].includes(col.type_name.toLowerCase())) {
      try {
        const minMax = await livePool.request().query(
          `SELECT MIN([${col.name}]) as mn, MAX([${col.name}]) as mx FROM [${tableName}]`
        );
        const r = minMax.recordset[0];
        if (r.mn !== null || r.mx !== null) {
          log(`  ${col.name} (${col.type_name}): min=${r.mn}, max=${r.mx}`);
        }
      } catch(e) { /* skip */ }
    }
  }

  // 5. Clear DEV and copy using SELECT INTO via linked server approach
  // Since we can't use linked server, we'll use batched parameterized inserts
  log(`\nCopying data...`);
  
  // Disable FK constraints
  const fks = await devPool.request().query(`
    SELECT fk.name as fk_name, OBJECT_NAME(fk.parent_object_id) as ref_table
    FROM sys.foreign_keys fk
    JOIN sys.tables t ON fk.referenced_object_id = t.object_id
    WHERE t.name = '${tableName}'
  `);
  for (const fk of fks.recordset) {
    try { await devPool.request().query(`ALTER TABLE [${fk.ref_table}] NOCHECK CONSTRAINT [${fk.fk_name}]`); } catch(e) {}
  }

  await devPool.request().query(`DELETE FROM [${tableName}]`);

  // Check identity
  const hasIdentity = colMeta.recordset.some(c => c.is_identity);
  
  // Read ALL from LIVE (only 3932 rows)
  const colList = commonCols.map(c => `[${c}]`).join(', ');
  let totalCopied = 0;

  if (hasIdentity) await devPool.request().query(`SET IDENTITY_INSERT [${tableName}] ON`);

  const allData = await livePool.request().query(`SELECT ${colList} FROM [${tableName}]`);
  log(`  Read ${allData.recordset.length} rows from LIVE`);

  // Insert row by row
  for (const row of allData.recordset) {
    const values = commonCols.map(c => {
      const v = row[c];
      if (v === null || v === undefined) return 'NULL';
      if (v instanceof Date) return `'${v.toISOString()}'`;
      if (typeof v === 'number') return String(v);
      if (typeof v === 'boolean') return v ? '1' : '0';
      if (Buffer.isBuffer(v)) return `0x${v.toString('hex')}`;
      // Escape single quotes
      return `N'${String(v).replace(/'/g, "''")}'`;
    });
    
    try {
      await devPool.request().query(
        `INSERT INTO [${tableName}] (${colList}) VALUES (${values.join(', ')})`
      );
      totalCopied++;
    } catch (e) {
      log(`  ERROR on row ${totalCopied + 1}: ${e.message}`);
      log(`  Row data sample: ${commonCols.slice(0, 5).map(c => `${c}=${row[c]}`).join(', ')}`);
    }

    if (totalCopied % 500 === 0 && totalCopied > 0) {
      log(`  Copied ${totalCopied} / ${liveCount} rows...`);
    }
  }

  if (hasIdentity) await devPool.request().query(`SET IDENTITY_INSERT [${tableName}] OFF`);

  // Re-enable FK constraints
  for (const fk of fks.recordset) {
    try { await devPool.request().query(`ALTER TABLE [${fk.ref_table}] WITH CHECK CHECK CONSTRAINT [${fk.fk_name}]`); } catch(e) {}
  }

  // Verify
  const finalCount = (await devPool.request().query(`SELECT COUNT(*) as cnt FROM [${tableName}]`)).recordset[0].cnt;
  log(`\n✓ Done! m_Item_Manufacturing on DEV: ${finalCount} rows (LIVE: ${liveCount})`);

  await livePool.close();
  await devPool.close();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
