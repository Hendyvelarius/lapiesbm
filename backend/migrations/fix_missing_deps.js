require('dotenv').config();
const sql = require('mssql');

const LIVE_CONFIG = {
  user: 'sa', password: 'ygi_dny_jny_0902_apl',
  server: '192.168.1.21', port: 1433,
  database: 'lapifactory',
  options: { encrypt: false, trustServerCertificate: true },
  connectionTimeout: 15000, requestTimeout: 300000,
};

const DEV_CONFIG = {
  user: 'sa', password: 'ygi_dny_jny_0902_apl',
  server: '192.168.1.49', port: 1433,
  database: 'lapifactory',
  options: { encrypt: false, trustServerCertificate: true },
  connectionTimeout: 15000, requestTimeout: 300000,
};

function log(msg) { console.log(`[${new Date().toLocaleTimeString()}] ${msg}`); }

async function getColumns(pool, tableName) {
  const r = await pool.request().query(`
    SELECT c.name FROM sys.columns c 
    JOIN sys.tables t ON c.object_id = t.object_id 
    WHERE t.name = '${tableName}' ORDER BY c.column_id
  `);
  return r.recordset.map(row => row.name);
}

async function copyTable(livePool, devPool, tableName) {
  log(`Copying ${tableName}...`);

  // Check if exists on LIVE
  const liveCheck = await livePool.request().query(
    `SELECT OBJECT_ID('${tableName}', 'U') as oid`
  );
  if (liveCheck.recordset[0].oid === null) {
    log(`  SKIP: ${tableName} not found on LIVE`);
    return false;
  }

  // Get row count on LIVE
  const liveCount = await livePool.request().query(`SELECT COUNT(*) as cnt FROM [${tableName}]`);
  const liveRows = liveCount.recordset[0].cnt;

  // Check if exists on DEV
  const devCheck = await devPool.request().query(
    `SELECT OBJECT_ID('${tableName}', 'U') as oid`
  );
  const existsOnDev = devCheck.recordset[0].oid !== null;

  if (existsOnDev) {
    // Delete existing data
    await devPool.request().query(`DELETE FROM [${tableName}]`);
  } else {
    // Create table from DDL
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
  }

  // Get columns
  const cols = await getColumns(livePool, tableName);
  const colList = cols.map(c => `[${c}]`).join(', ');

  // Read data from LIVE
  const liveData = await livePool.request().query(`SELECT ${colList} FROM [${tableName}]`);
  const rows = liveData.recordset;

  if (rows.length > 0) {
    // Check for identity columns
    const idResult = await devPool.request().query(`
      SELECT c.name FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id 
      WHERE t.name = '${tableName}' AND c.is_identity = 1
    `);
    const hasIdentity = idResult.recordset.length > 0;

    if (hasIdentity) {
      await devPool.request().query(`SET IDENTITY_INSERT [${tableName}] ON`);
    }

    // Build bulk table
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

    const devCols = colMeta.recordset.map(c => c.name);
    for (const row of rows) {
      const values = devCols.map(c => row[c] !== undefined ? row[c] : null);
      table.rows.add(...values);
    }

    await devPool.request().bulk(table);

    if (hasIdentity) {
      await devPool.request().query(`SET IDENTITY_INSERT [${tableName}] OFF`);
    }
  }

  // Verify
  const devCount = await devPool.request().query(`SELECT COUNT(*) as cnt FROM [${tableName}]`);
  const devRows = devCount.recordset[0].cnt;
  if (devRows === liveRows) {
    log(`  ✓ ${tableName}: ${devRows} rows (matches LIVE)`);
  } else {
    log(`  ⚠ ${tableName}: DEV=${devRows}, LIVE=${liveRows}`);
  }
  return true;
}

async function main() {
  let livePool, devPool;
  try {
    livePool = await new sql.ConnectionPool(LIVE_CONFIG).connect();
    devPool = await new sql.ConnectionPool(DEV_CONFIG).connect();
    log('Both servers connected.');

    // Step 1: Find all objects referenced by our SPs that are missing on DEV
    log('');
    log('=== Finding missing SP dependencies ===');
    const deps = await livePool.request().query(`
      SELECT DISTINCT ref.referenced_entity_name AS obj_name
      FROM sys.sql_expression_dependencies ref
      JOIN sys.objects so ON ref.referencing_id = so.object_id
      WHERE so.type = 'P' 
        AND (so.name LIKE '%COGS%' OR so.name LIKE 'sp_generate_simulasi%')
        AND ref.referenced_entity_name NOT LIKE 'sys%'
    `);

    const missingTables = [];
    for (const row of deps.recordset) {
      const name = row.obj_name;
      // Check if exists on DEV
      const devCheck = await devPool.request().query(
        `SELECT OBJECT_ID('${name}') as oid`
      );
      if (devCheck.recordset[0].oid === null) {
        // Check type on LIVE
        const liveCheck = await livePool.request().query(
          `SELECT type_desc FROM sys.objects WHERE name = '${name}'`
        );
        if (liveCheck.recordset.length > 0) {
          const type = liveCheck.recordset[0].type_desc;
          log(`  MISSING on DEV: ${name} (${type})`);
          if (type === 'USER_TABLE') {
            missingTables.push(name);
          }
        }
      }
    }

    // Also check view dependencies 
    const viewDeps = await livePool.request().query(`
      SELECT DISTINCT ref.referenced_entity_name AS obj_name
      FROM sys.sql_expression_dependencies ref
      JOIN sys.objects so ON ref.referencing_id = so.object_id
      WHERE so.type = 'V' 
        AND so.name LIKE '%COGS%'
        AND ref.referenced_entity_name NOT LIKE 'sys%'
    `);

    for (const row of viewDeps.recordset) {
      const name = row.obj_name;
      const devCheck = await devPool.request().query(
        `SELECT OBJECT_ID('${name}') as oid`
      );
      if (devCheck.recordset[0].oid === null) {
        const liveCheck = await livePool.request().query(
          `SELECT type_desc FROM sys.objects WHERE name = '${name}'`
        );
        if (liveCheck.recordset.length > 0 && liveCheck.recordset[0].type_desc === 'USER_TABLE') {
          if (missingTables.indexOf(name) === -1) {
            log(`  MISSING on DEV (view dep): ${name}`);
            missingTables.push(name);
          }
        }
      }
    }

    if (missingTables.length === 0) {
      log('No missing tables found!');
    } else {
      log('');
      log(`=== Copying ${missingTables.length} missing table(s) ===`);
      for (const t of missingTables) {
        try {
          await copyTable(livePool, devPool, t);
        } catch (err) {
          log(`  ✗ ${t}: ${err.message}`);
        }
      }
    }

    // Step 2: Verify the SP works now
    log('');
    log('=== Testing sp_COGS_HPP_List on DEV ===');
    try {
      const r = await devPool.request()
        .input('category', sql.NVarChar, 'ethical')
        .execute('sp_COGS_HPP_List');
      log(`  ✓ sp_COGS_HPP_List works! Returned ${r.recordset.length} rows`);
    } catch (err) {
      log(`  ✗ sp_COGS_HPP_List failed: ${err.message}`);
    }

    // Final table count
    log('');
    log('=== All COGS tables on DEV ===');
    const allTables = await devPool.request().query(`
      SELECT t.name, 
        (SELECT SUM(p.rows) FROM sys.partitions p WHERE p.object_id = t.object_id AND p.index_id IN (0,1)) as rows
      FROM sys.tables t 
      WHERE t.name LIKE '%COGS%' OR t.name LIKE '%Product%Header%'
      ORDER BY t.name
    `);
    for (const row of allTables.recordset) {
      console.log(`  ${row.name.padEnd(55)} ${row.rows} rows`);
    }

  } catch (err) {
    log(`FATAL: ${err.message}`);
    console.error(err.stack);
  } finally {
    if (livePool) await livePool.close();
    if (devPool) await devPool.close();
    process.exit(0);
  }
}

main();
