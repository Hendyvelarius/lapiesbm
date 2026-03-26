/**
 * Deep dependency scanner + copier
 * 
 * Finds ALL tables/views referenced by:
 *   1. Our stored procedures (recursively — SPs calling other SPs/views/tables)
 *   2. Our views (recursively — views referencing other views/tables)
 *   3. Direct SQL in the Node.js backend code
 * 
 * Then checks what's missing on DEV and copies it.
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

  // =========================================================
  // PHASE 1: Collect ALL referenced objects recursively
  // =========================================================
  log('');
  log('════════════════════════════════════════════════════════════════');
  log('PHASE 1: Deep dependency scan on LIVE server');
  log('════════════════════════════════════════════════════════════════');

  // Get all our COGS stored procedures
  const spResult = await livePool.request().query(`
    SELECT name FROM sys.procedures 
    WHERE name LIKE '%COGS%' OR name LIKE 'sp_generate_simulasi%'
  `);
  const ourSPs = spResult.recordset.map(r => r.name);
  log(`Our stored procedures (${ourSPs.length}): ${ourSPs.join(', ')}`);

  // Get all our COGS views
  const viewResult = await livePool.request().query(`
    SELECT name FROM sys.views WHERE name LIKE '%COGS%'
  `);
  const ourViews = viewResult.recordset.map(r => r.name);
  log(`Our views (${ourViews.length}): ${ourViews.join(', ')}`);

  // Recursive dependency resolution: find ALL objects referenced by our SPs and views
  // Use sys.sql_expression_dependencies recursively
  const allDeps = new Map(); // name -> { type, referencedBy }

  async function resolveDeps(objectName, depth = 0) {
    if (depth > 10) return; // prevent infinite recursion
    
    const deps = await livePool.request()
      .input('oname', sql.NVarChar, objectName)
      .query(`
        SELECT DISTINCT 
          ref.referenced_entity_name AS dep_name
        FROM sys.sql_expression_dependencies ref
        JOIN sys.objects so ON ref.referencing_id = so.object_id
        WHERE so.name = @oname
          AND ref.referenced_entity_name IS NOT NULL
          AND ref.referenced_entity_name NOT LIKE 'sys%'
          AND ref.referenced_entity_name NOT LIKE '#%'
      `);

    for (const row of deps.recordset) {
      const depName = row.dep_name;
      const already = allDeps.has(depName);
      
      if (!already) {
        // Get type on LIVE
        const typeResult = await livePool.request().query(
          `SELECT type_desc, type FROM sys.objects WHERE name = '${depName.replace(/'/g, "''")}'`
        );
        const typeInfo = typeResult.recordset.length > 0 
          ? typeResult.recordset[0].type_desc 
          : 'UNKNOWN';
        
        allDeps.set(depName, { type: typeInfo, referencedBy: new Set([objectName]) });
        
        // Recurse into views and SPs (they can reference other objects)
        if (typeInfo === 'VIEW' || typeInfo === 'SQL_STORED_PROCEDURE') {
          await resolveDeps(depName, depth + 1);
        }
      } else {
        allDeps.get(depName).referencedBy.add(objectName);
      }
    }
  }

  // Resolve all SP dependencies
  log('');
  log('Resolving stored procedure dependencies...');
  for (const sp of ourSPs) {
    await resolveDeps(sp);
  }

  // Resolve all view dependencies
  log('Resolving view dependencies...');
  for (const v of ourViews) {
    await resolveDeps(v);
  }

  // Also add the explicitly known tables from Node.js code
  const codeReferencedTables = [
    'm_Item_Manufacturing',
    'm_Product',
    'M_COGS_STD_HRG_BAHAN',
    'M_COGS_STD_PARAMETER',
    'M_COGS_PRODUCT_GROUP_MANUAL',
    'M_COGS_RATE_GENERAL_per_SEDIAAN',
    'M_COGS_PEMBEBANAN',
    'M_COGS_PEMBEBANAN_REAGEN',
    'M_COGS_PEMBEBANAN_TollFee',
    'M_COGS_BEBAN_SISA_BAHAN_EXP',
    'M_COGS_PRODUCT_FORMULA_FIX',
    'M_COGS_FORMULA_MANUAL',
    'M_COGS_Unit_Conversion',
    'm_COGS_Daily_Currency',
    't_COGS_HPP_Actual_Header',
    't_COGS_HPP_Actual_Detail',
    't_COGS_HPP_Product_Header_Simulasi',
    't_COGS_HPP_Product_Header_Simulasi_Detail_Bahan',
    't_COGS_HPP_Product_Detail_Formula',
    'm_product_sediaan_produksi',
  ];

  for (const t of codeReferencedTables) {
    if (!allDeps.has(t)) {
      const typeResult = await livePool.request().query(
        `SELECT type_desc FROM sys.objects WHERE name = '${t}'`
      );
      const typeInfo = typeResult.recordset.length > 0 ? typeResult.recordset[0].type_desc : 'UNKNOWN';
      allDeps.set(t, { type: typeInfo, referencedBy: new Set(['Node.js code']) });
    } else {
      allDeps.get(t).referencedBy.add('Node.js code');
    }
  }

  // Print full dependency tree
  log('');
  log('═══ COMPLETE DEPENDENCY MAP ═══');
  log('');

  const tables = [];
  const views = [];
  const procs = [];
  const other = [];

  for (const [name, info] of [...allDeps.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const refs = [...info.referencedBy].join(', ');
    const entry = { name, type: info.type, refs };
    
    if (info.type === 'USER_TABLE') tables.push(entry);
    else if (info.type === 'VIEW') views.push(entry);
    else if (info.type === 'SQL_STORED_PROCEDURE') procs.push(entry);
    else other.push(entry);
  }

  log(`--- TABLES (${tables.length}) ---`);
  for (const t of tables) {
    const isCogs = t.name.toLowerCase().includes('cogs');
    console.log(`  ${isCogs ? '  ' : '* '} ${t.name.padEnd(55)} referenced by: ${t.refs}`);
  }

  log('');
  log(`--- VIEWS (${views.length}) ---`);
  for (const v of views) {
    console.log(`    ${v.name.padEnd(55)} referenced by: ${v.refs}`);
  }

  log('');
  log(`--- STORED PROCEDURES (${procs.length}) ---`);
  for (const p of procs) {
    console.log(`    ${p.name.padEnd(55)} referenced by: ${p.refs}`);
  }

  if (other.length > 0) {
    log('');
    log(`--- OTHER/UNKNOWN (${other.length}) ---`);
    for (const o of other) {
      console.log(`    ${o.name.padEnd(55)} [${o.type}] referenced by: ${o.refs}`);
    }
  }

  // =========================================================
  // PHASE 2: Check what's missing on DEV
  // =========================================================
  log('');
  log('════════════════════════════════════════════════════════════════');
  log('PHASE 2: Checking what exists/missing on DEV');
  log('════════════════════════════════════════════════════════════════');

  const missingTables = [];
  const existingTables = [];

  for (const t of tables) {
    const devCheck = await devPool.request().query(
      `SELECT OBJECT_ID('${t.name.replace(/'/g, "''")}', 'U') as oid`
    );
    const exists = devCheck.recordset[0].oid !== null;
    
    // Get LIVE row count
    let liveRows = 0;
    try {
      const cnt = await livePool.request().query(`SELECT COUNT(*) as cnt FROM [${t.name}]`);
      liveRows = cnt.recordset[0].cnt;
    } catch(e) {}

    let devRows = 'N/A';
    if (exists) {
      try {
        const cnt = await devPool.request().query(`SELECT COUNT(*) as cnt FROM [${t.name}]`);
        devRows = cnt.recordset[0].cnt;
      } catch(e) {}
    }

    const isCogs = t.name.toLowerCase().includes('cogs');
    const status = exists ? 'EXISTS' : 'MISSING';
    
    console.log(
      `  ${status === 'MISSING' ? '✗' : '✓'} ${t.name.padEnd(55)} ${status.padEnd(8)} LIVE:${String(liveRows).padStart(8)}  DEV:${String(devRows).padStart(8)}  ${isCogs ? '' : '[NON-COGS]'}`
    );

    if (!exists) {
      missingTables.push({ name: t.name, liveRows, refs: t.refs });
    } else {
      existingTables.push({ name: t.name, liveRows, devRows, refs: t.refs });
    }
  }

  // =========================================================
  // PHASE 3: Copy missing tables + refresh m_Item_Manufacturing & m_Product
  // =========================================================
  log('');
  log('════════════════════════════════════════════════════════════════');
  log(`PHASE 3: Copying ${missingTables.length} missing tables + refreshing m_Item_Manufacturing & m_Product`);
  log('════════════════════════════════════════════════════════════════');

  // Tables to force-refresh (exist but need fresh data)
  const forceRefresh = ['m_Item_Manufacturing', 'm_Product'];
  
  // Combine: missing tables + force refresh tables
  const tablesToCopy = [
    ...missingTables.map(t => t.name),
    ...forceRefresh.filter(t => !missingTables.find(m => m.name === t)),
  ];

  for (const tableName of tablesToCopy) {
    log(`Copying ${tableName}...`);
    try {
      // Check if exists on LIVE
      const liveCheck = await livePool.request().query(`SELECT OBJECT_ID('${tableName}', 'U') as oid`);
      if (liveCheck.recordset[0].oid === null) {
        log(`  SKIP: not found on LIVE`);
        continue;
      }

      const liveCountR = await livePool.request().query(`SELECT COUNT(*) as cnt FROM [${tableName}]`);
      const liveRows = liveCountR.recordset[0].cnt;

      // Check if exists on DEV
      const devCheck = await devPool.request().query(`SELECT OBJECT_ID('${tableName}', 'U') as oid`);
      const existsOnDev = devCheck.recordset[0].oid !== null;

      if (existsOnDev) {
        // Disable FK constraints referencing this table
        const fks = await devPool.request().query(`
          SELECT fk.name as fk_name, OBJECT_NAME(fk.parent_object_id) as ref_table
          FROM sys.foreign_keys fk
          JOIN sys.tables t ON fk.referenced_object_id = t.object_id
          WHERE t.name = '${tableName}'
        `);
        for (const fk of fks.recordset) {
          try {
            await devPool.request().query(`ALTER TABLE [${fk.ref_table}] NOCHECK CONSTRAINT [${fk.fk_name}]`);
          } catch(e) {}
        }

        await devPool.request().query(`DELETE FROM [${tableName}]`);

        // Get columns from both sides to find common ones
        const liveCols = await livePool.request().query(`
          SELECT c.name FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id 
          WHERE t.name = '${tableName}' ORDER BY c.column_id
        `);
        const devCols = await devPool.request().query(`
          SELECT c.name FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id 
          WHERE t.name = '${tableName}' ORDER BY c.column_id
        `);
        const liveColNames = liveCols.recordset.map(r => r.name);
        const devColNames = devCols.recordset.map(r => r.name);
        const commonCols = liveColNames.filter(c => devColNames.includes(c));

        // Check identity
        const idResult = await devPool.request().query(`
          SELECT c.name FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id 
          WHERE t.name = '${tableName}' AND c.is_identity = 1
        `);
        const hasIdentity = idResult.recordset.length > 0;

        if (hasIdentity) await devPool.request().query(`SET IDENTITY_INSERT [${tableName}] ON`);

        // Read from LIVE
        const colList = commonCols.map(c => `[${c}]`).join(', ');
        const liveData = await livePool.request().query(`SELECT ${colList} FROM [${tableName}]`);

        if (liveData.recordset.length > 0) {
          const table = new sql.Table(tableName);
          table.create = false;

          const colMeta = await devPool.request().query(`
            SELECT c.name, t2.name as type_name, c.max_length, c.precision, c.scale, c.is_nullable
            FROM sys.columns c
            JOIN sys.types t2 ON c.system_type_id = t2.system_type_id AND c.user_type_id = t2.user_type_id
            JOIN sys.tables tbl ON c.object_id = tbl.object_id
            WHERE tbl.name = '${tableName}'
            ORDER BY c.column_id
          `);

          for (const col of colMeta.recordset) {
            if (!commonCols.includes(col.name)) continue;
            let sqlType;
            switch (col.type_name.toLowerCase()) {
              case 'int': sqlType = sql.Int; break;
              case 'bigint': sqlType = sql.BigInt; break;
              case 'smallint': sqlType = sql.SmallInt; break;
              case 'tinyint': sqlType = sql.TinyInt; break;
              case 'bit': sqlType = sql.Bit; break;
              case 'decimal': case 'numeric': sqlType = sql.Decimal(col.precision, col.scale); break;
              case 'float': sqlType = sql.Float; break;
              case 'real': sqlType = sql.Real; break;
              case 'money': sqlType = sql.Money; break;
              case 'smallmoney': sqlType = sql.SmallMoney; break;
              case 'varchar': sqlType = sql.VarChar(col.max_length === -1 ? sql.MAX : col.max_length); break;
              case 'nvarchar': sqlType = sql.NVarChar(col.max_length === -1 ? sql.MAX : col.max_length / 2); break;
              case 'char': sqlType = sql.Char(col.max_length); break;
              case 'nchar': sqlType = sql.NChar(col.max_length / 2); break;
              case 'text': sqlType = sql.Text; break;
              case 'ntext': sqlType = sql.NText; break;
              case 'datetime': sqlType = sql.DateTime; break;
              case 'datetime2': sqlType = sql.DateTime2(col.scale); break;
              case 'date': sqlType = sql.Date; break;
              case 'time': sqlType = sql.Time(col.scale); break;
              case 'datetimeoffset': sqlType = sql.DateTimeOffset(col.scale); break;
              case 'smalldatetime': sqlType = sql.SmallDateTime; break;
              case 'uniqueidentifier': sqlType = sql.UniqueIdentifier; break;
              case 'binary': sqlType = sql.Binary(col.max_length); break;
              case 'varbinary': sqlType = sql.VarBinary(col.max_length === -1 ? sql.MAX : col.max_length); break;
              case 'image': sqlType = sql.Image; break;
              case 'xml': sqlType = sql.Xml; break;
              default: sqlType = sql.NVarChar(sql.MAX); break;
            }
            table.columns.add(col.name, sqlType, { nullable: col.is_nullable });
          }

          for (const row of liveData.recordset) {
            const values = commonCols.map(c => row[c] !== undefined ? row[c] : null);
            table.rows.add(...values);
          }

          await devPool.request().bulk(table);
        }

        if (hasIdentity) await devPool.request().query(`SET IDENTITY_INSERT [${tableName}] OFF`);

        // Re-enable FK constraints
        for (const fk of fks.recordset) {
          try {
            await devPool.request().query(`ALTER TABLE [${fk.ref_table}] WITH CHECK CHECK CONSTRAINT [${fk.fk_name}]`);
          } catch(e) {}
        }

      } else {
        // Create from DDL
        log(`  Creating table schema...`);
        const ddlResult = await livePool.request().query(`
          DECLARE @sql NVARCHAR(MAX) = '';
          DECLARE @tableName NVARCHAR(255) = '${tableName}';
          SET @sql = 'CREATE TABLE [' + @tableName + '] (' + CHAR(13);
          SELECT @sql = @sql + '  [' + c.name + '] ' + 
            tp.name + 
            CASE 
              WHEN tp.name IN ('varchar','nvarchar','char','nchar','varbinary','binary') 
                THEN '(' + CASE WHEN c.max_length = -1 THEN 'MAX' ELSE CAST(
                  CASE WHEN tp.name IN ('nvarchar','nchar') THEN c.max_length/2 ELSE c.max_length END AS VARCHAR) END + ')'
              WHEN tp.name IN ('decimal','numeric') 
                THEN '(' + CAST(c.precision AS VARCHAR) + ',' + CAST(c.scale AS VARCHAR) + ')'
              WHEN tp.name IN ('datetime2','time','datetimeoffset') 
                THEN '(' + CAST(c.scale AS VARCHAR) + ')'
              ELSE '' 
            END +
            CASE WHEN c.is_identity = 1 
              THEN ' IDENTITY(' + CAST(IDENT_SEED(@tableName) AS VARCHAR) + ',' + CAST(IDENT_INCR(@tableName) AS VARCHAR) + ')' 
              ELSE '' END +
            CASE WHEN c.is_nullable = 0 THEN ' NOT NULL' ELSE ' NULL' END + 
            ',' + CHAR(13)
          FROM sys.columns c
          JOIN sys.types tp ON c.system_type_id = tp.system_type_id AND c.user_type_id = tp.user_type_id
          WHERE c.object_id = OBJECT_ID(@tableName)
          ORDER BY c.column_id;
          SET @sql = LEFT(@sql, LEN(@sql) - 2) + CHAR(13) + ')';
          SELECT @sql AS ddl;
        `);
        await devPool.request().query(ddlResult.recordset[0].ddl);

        // Bulk insert
        const cols = await livePool.request().query(`
          SELECT c.name FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id 
          WHERE t.name = '${tableName}' ORDER BY c.column_id
        `);
        const colNames = cols.recordset.map(r => r.name);
        const colList = colNames.map(c => `[${c}]`).join(', ');
        const liveData = await livePool.request().query(`SELECT ${colList} FROM [${tableName}]`);

        if (liveData.recordset.length > 0) {
          const idResult = await devPool.request().query(`
            SELECT c.name FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id 
            WHERE t.name = '${tableName}' AND c.is_identity = 1
          `);
          const hasIdentity = idResult.recordset.length > 0;

          if (hasIdentity) await devPool.request().query(`SET IDENTITY_INSERT [${tableName}] ON`);

          const table = new sql.Table(tableName);
          table.create = false;

          const colMeta = await devPool.request().query(`
            SELECT c.name, t2.name as type_name, c.max_length, c.precision, c.scale, c.is_nullable
            FROM sys.columns c
            JOIN sys.types t2 ON c.system_type_id = t2.system_type_id AND c.user_type_id = t2.user_type_id
            JOIN sys.tables tbl ON c.object_id = tbl.object_id
            WHERE tbl.name = '${tableName}'
            ORDER BY c.column_id
          `);

          for (const col of colMeta.recordset) {
            let sqlType;
            switch (col.type_name.toLowerCase()) {
              case 'int': sqlType = sql.Int; break;
              case 'bigint': sqlType = sql.BigInt; break;
              case 'smallint': sqlType = sql.SmallInt; break;
              case 'tinyint': sqlType = sql.TinyInt; break;
              case 'bit': sqlType = sql.Bit; break;
              case 'decimal': case 'numeric': sqlType = sql.Decimal(col.precision, col.scale); break;
              case 'float': sqlType = sql.Float; break;
              case 'real': sqlType = sql.Real; break;
              case 'money': sqlType = sql.Money; break;
              case 'smallmoney': sqlType = sql.SmallMoney; break;
              case 'varchar': sqlType = sql.VarChar(col.max_length === -1 ? sql.MAX : col.max_length); break;
              case 'nvarchar': sqlType = sql.NVarChar(col.max_length === -1 ? sql.MAX : col.max_length / 2); break;
              case 'char': sqlType = sql.Char(col.max_length); break;
              case 'nchar': sqlType = sql.NChar(col.max_length / 2); break;
              case 'text': sqlType = sql.Text; break;
              case 'ntext': sqlType = sql.NText; break;
              case 'datetime': sqlType = sql.DateTime; break;
              case 'datetime2': sqlType = sql.DateTime2(col.scale); break;
              case 'date': sqlType = sql.Date; break;
              case 'time': sqlType = sql.Time(col.scale); break;
              case 'datetimeoffset': sqlType = sql.DateTimeOffset(col.scale); break;
              case 'smalldatetime': sqlType = sql.SmallDateTime; break;
              case 'uniqueidentifier': sqlType = sql.UniqueIdentifier; break;
              case 'binary': sqlType = sql.Binary(col.max_length); break;
              case 'varbinary': sqlType = sql.VarBinary(col.max_length === -1 ? sql.MAX : col.max_length); break;
              case 'image': sqlType = sql.Image; break;
              case 'xml': sqlType = sql.Xml; break;
              default: sqlType = sql.NVarChar(sql.MAX); break;
            }
            table.columns.add(col.name, sqlType, { nullable: col.is_nullable });
          }

          for (const row of liveData.recordset) {
            const values = colNames.map(c => row[c] !== undefined ? row[c] : null);
            table.rows.add(...values);
          }

          await devPool.request().bulk(table);
          if (hasIdentity) await devPool.request().query(`SET IDENTITY_INSERT [${tableName}] OFF`);
        }
      }

      // Verify
      const devCount = await devPool.request().query(`SELECT COUNT(*) as cnt FROM [${tableName}]`);
      log(`  ✓ ${tableName}: ${devCount.recordset[0].cnt} rows on DEV (LIVE: ${liveRows})`);
    } catch (err) {
      log(`  ✗ ${tableName}: FAILED - ${err.message}`);
    }
  }

  // =========================================================
  // PHASE 4: Summary of all non-COGS tables
  // =========================================================
  log('');
  log('════════════════════════════════════════════════════════════════');
  log('PHASE 4: NON-COGS tables used by this application');
  log('════════════════════════════════════════════════════════════════');
  log('');

  const nonCogsTables = tables.filter(t => !t.name.toLowerCase().includes('cogs'));
  console.log('Table'.padEnd(55) + 'Referenced By');
  console.log('─'.repeat(120));
  for (const t of nonCogsTables) {
    console.log(`${t.name.padEnd(55)} ${t.refs}`);
  }

  log('');
  log(`Total tables in dependency tree: ${tables.length}`);
  log(`  COGS tables: ${tables.length - nonCogsTables.length}`);
  log(`  Non-COGS tables: ${nonCogsTables.length}`);

  await livePool.close();
  await devPool.close();
  process.exit(0);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
