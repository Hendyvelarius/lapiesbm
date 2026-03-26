/**
 * Compare table structures (columns, types, nullability, identity) between LIVE and DEV
 * for the 12 large transaction tables.
 */
const sql = require('mssql');

const LIVE = {
  user: 'sa', password: 'ygi_dny_jny_0902_apl',
  server: '192.168.1.21', port: 1433, database: 'lapifactory',
  options: { encrypt: false, trustServerCertificate: true },
  connectionTimeout: 15000, requestTimeout: 60000,
};

const DEV = {
  user: 'sa', password: 'ygi_dny_jny_0902_apl',
  server: '192.168.1.49', port: 1433, database: 'lapifactory',
  options: { encrypt: false, trustServerCertificate: true },
  connectionTimeout: 15000, requestTimeout: 60000,
};

const TABLES = [
  't_Bon_Keluar_Bahan_Awal_Detail',
  't_Bon_Keluar_Bahan_Awal_DNc',
  't_Bon_Keluar_Bahan_Awal_Header',
  't_Bon_Pengembalian_Bahan_Awal_Detail',
  't_Bon_Pengembalian_Bahan_Awal_header',
  't_DNc_Manufacturing',
  't_dnc_product',
  't_PO_Manufacturing_Detail',
  't_PO_Manufacturing_Header',
  't_rencanaproduksitahunan',
  't_ttba_manufacturing_detail',
  'tmp_spLapProduksi_GWN_ReleaseQA',
];

async function getColumns(pool, tableName) {
  const result = await pool.request().query(`
    SELECT
      c.column_id,
      c.name                                      AS col_name,
      tp.name                                     AS type_name,
      CASE
        WHEN tp.name IN ('varchar','nvarchar','char','nchar','varbinary','binary')
          THEN '(' + CASE WHEN c.max_length = -1 THEN 'MAX'
                         WHEN tp.name IN ('nvarchar','nchar') THEN CAST(c.max_length/2 AS VARCHAR)
                         ELSE CAST(c.max_length AS VARCHAR) END + ')'
        WHEN tp.name IN ('decimal','numeric')
          THEN '(' + CAST(c.precision AS VARCHAR) + ',' + CAST(c.scale AS VARCHAR) + ')'
        WHEN tp.name IN ('datetime2','time','datetimeoffset')
          THEN '(' + CAST(c.scale AS VARCHAR) + ')'
        ELSE ''
      END                                         AS type_params,
      c.is_nullable,
      c.is_identity,
      CASE WHEN c.is_identity = 1
        THEN CAST(IDENT_SEED('${tableName}') AS VARCHAR) + ',' + CAST(IDENT_INCR('${tableName}') AS VARCHAR)
        ELSE NULL
      END                                         AS identity_spec
    FROM sys.columns c
    JOIN sys.types tp ON c.system_type_id = tp.system_type_id AND c.user_type_id = tp.user_type_id
    JOIN sys.tables t ON c.object_id = t.object_id
    WHERE t.name = '${tableName}'
    ORDER BY c.column_id
  `);
  return result.recordset;
}

async function main() {
  const livePool = await new sql.ConnectionPool(LIVE).connect();
  const devPool  = await new sql.ConnectionPool(DEV).connect();
  console.log('Both servers connected.\n');

  const allDiffs = [];
  const identityReport = [];

  for (const tableName of TABLES) {
    console.log(`${'═'.repeat(72)}`);
    console.log(`TABLE: ${tableName}`);
    console.log(`${'═'.repeat(72)}`);

    const liveCols = await getColumns(livePool, tableName);
    const devCols  = await getColumns(devPool,  tableName);

    if (liveCols.length === 0 && devCols.length === 0) {
      console.log('  ✗ Table does NOT exist on either server!\n');
      allDiffs.push({ tableName, issue: 'Missing on both servers' });
      continue;
    }
    if (liveCols.length === 0) {
      console.log('  ✗ Table does NOT exist on LIVE!\n');
      allDiffs.push({ tableName, issue: 'Missing on LIVE' });
      continue;
    }
    if (devCols.length === 0) {
      console.log('  ✗ Table does NOT exist on DEV!\n');
      allDiffs.push({ tableName, issue: 'Missing on DEV' });
      continue;
    }

    // Print column list with LIVE / DEV comparison
    const liveByName = Object.fromEntries(liveCols.map(c => [c.col_name.toLowerCase(), c]));
    const devByName  = Object.fromEntries(devCols.map(c => [c.col_name.toLowerCase(), c]));
    const allColNames = [...new Set([
      ...liveCols.map(c => c.col_name),
      ...devCols.map(c => c.col_name),
    ])];

    let tableDiffs = 0;
    const identityCols = [];

    // Header
    console.log(`  ${'Column'.padEnd(42)} ${'LIVE Type'.padEnd(26)} ${'DEV Type'.padEnd(26)} Match`);
    console.log(`  ${'─'.repeat(42)} ${'─'.repeat(26)} ${'─'.repeat(26)} ─────`);

    for (const colName of allColNames) {
      const lc = liveByName[colName.toLowerCase()];
      const dc = devByName[colName.toLowerCase()];

      const liveType = lc ? `${lc.type_name}${lc.type_params}${lc.is_nullable ? '' : ' NOT NULL'}` : '(missing)';
      const devType  = dc ? `${dc.type_name}${dc.type_params}${dc.is_nullable ? '' : ' NOT NULL'}` : '(missing)';
      const match = lc && dc &&
        lc.type_name === dc.type_name &&
        lc.type_params === dc.type_params &&
        lc.is_nullable === dc.is_nullable;

      const flag = !lc || !dc ? '✗ MISSING' : match ? '✓' : '✗ DIFF';
      console.log(`  ${colName.padEnd(42)} ${liveType.padEnd(26)} ${devType.padEnd(26)} ${flag}`);

      if (!match || !lc || !dc) tableDiffs++;

      // Collect identity columns
      if (lc && lc.is_identity) {
        identityCols.push({ col: colName, spec: lc.identity_spec, server: 'LIVE' });
      }
      if (dc && dc.is_identity && (!lc || !lc.is_identity)) {
        identityCols.push({ col: colName, spec: dc.identity_spec, server: 'DEV only' });
      }
    }

    console.log();
    if (tableDiffs === 0) {
      console.log(`  ✓ Structures are IDENTICAL (${liveCols.length} columns)\n`);
    } else {
      console.log(`  ✗ ${tableDiffs} difference(s) found!\n`);
      allDiffs.push({ tableName, diffs: tableDiffs });
    }

    if (identityCols.length > 0) {
      for (const ic of identityCols) {
        const note = `  ⚡ IDENTITY column: [${ic.col}]  seed,increment = ${ic.spec}`;
        console.log(note);
        identityReport.push({ tableName, col: ic.col, spec: ic.spec });
      }
      console.log();
    }
  }

  // ─── SUMMARY ────────────────────────────────────────────────────────────────
  console.log(`${'═'.repeat(72)}`);
  console.log('SUMMARY');
  console.log(`${'═'.repeat(72)}`);

  if (allDiffs.length === 0) {
    console.log('✓ All 12 tables have IDENTICAL structures on LIVE and DEV.');
  } else {
    console.log(`✗ ${allDiffs.length} table(s) have structural differences:`);
    for (const d of allDiffs) console.log(`  - ${d.tableName}: ${d.issue || d.diffs + ' diff(s)'}`);
  }

  console.log();
  if (identityReport.length === 0) {
    console.log('No IDENTITY (auto-number) columns found in any of these tables.');
  } else {
    console.log(`IDENTITY (auto-number) columns found:`);
    for (const r of identityReport) {
      console.log(`  ${r.tableName}.${r.col}  (seed=${r.spec.split(',')[0]}, increment=${r.spec.split(',')[1]})`);
    }
    console.log('\n  ⚠  When copying these tables, use SET IDENTITY_INSERT [table] ON/OFF');
    console.log('     or use a tool that handles identity columns (e.g. SSMS Import/Export,');
    console.log('     BCP, or SQL Server Agent with IDENTITY INSERT enabled).');
  }

  await livePool.close();
  await devPool.close();
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
