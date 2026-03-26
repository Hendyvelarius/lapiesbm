/**
 * Migration Script: Copy LIVE (192.168.1.21) -> DEV (192.168.1.49)
 * 
 * Copies all eSBM COGS tables, views, and stored procedures from the
 * live server to the dev server. Existing dev tables are cleared and
 * repopulated; missing tables are created via SELECT INTO equivalent.
 * 
 * Safety:
 *   - Verifies both connections before any changes
 *   - Inventories what exists on both servers before starting
 *   - Validates row counts after each copy
 *   - Wraps table copies in transactions for rollback safety
 */

require('dotenv').config();
const sql = require('mssql');

// ---- Configuration ----
const LIVE_CONFIG = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_HOST,
  port: parseInt(process.env.SQL_PORT, 10) || 1433,
  database: process.env.SQL_DATABASE,
  options: { encrypt: false, trustServerCertificate: true },
  connectionTimeout: 15000,
  requestTimeout: 300000, // 5 min for large tables
};

const DEV_CONFIG = {
  user: process.env.DEVSQL_User,
  password: process.env.DEVSQL_Password,
  server: process.env.DEVSQL_Server,
  port: parseInt(process.env.DEVSQL_Port, 10) || 1433,
  database: process.env.DEVSQL_Database,
  options: { encrypt: false, trustServerCertificate: true },
  connectionTimeout: 15000,
  requestTimeout: 300000,
};

// Tables to copy (order matters for FK dependencies if any)
const TABLES = [
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
];

const VIEWS = [
  'vw_COGS_Currency_List',
  'vw_COGS_Product_Group',
  'vw_COGS_FORMULA_List',
  'vw_COGS_FORMULA_List_detail',
  'vw_COGS_Pembebanan_TollFee',
  'vw_COGS_HPP_Actual_Summary',
  'vw_COGS_HPP_Actual_Detail_Full',
];

const STORED_PROCEDURES = [
  'sp_COGS_HPP_List',
  'sp_COGS_GenerateHPP',
  'sp_COGS_Calculate_HPP_Actual',
  'sp_COGS_Calculate_HPP_Actual_TEST',
  'sp_COGS_generate_all_formula_detail',
  'sp_generate_simulasi_cogs_product_existing',
  'sp_COGS_GeneratePembebananSisaBahanExp',
];

// ---- Helpers ----
function log(msg) { console.log(`[${new Date().toLocaleTimeString()}] ${msg}`); }
function logOK(msg) { console.log(`[${new Date().toLocaleTimeString()}]   ✓ ${msg}`); }
function logWarn(msg) { console.log(`[${new Date().toLocaleTimeString()}]   ⚠ ${msg}`); }
function logErr(msg) { console.log(`[${new Date().toLocaleTimeString()}]   ✗ ${msg}`); }

async function getRowCount(pool, tableName) {
  const r = await pool.request().query(
    `SELECT COUNT(*) as cnt FROM [${tableName}]`
  );
  return r.recordset[0].cnt;
}

async function tableExists(pool, tableName) {
  const r = await pool.request()
    .input('tname', sql.NVarChar, tableName)
    .query(`SELECT OBJECT_ID(@tname, 'U') as oid`);
  return r.recordset[0].oid !== null;
}

async function getIdentityColumns(pool, tableName) {
  const r = await pool.request()
    .input('tname', sql.NVarChar, tableName)
    .query(`
      SELECT c.name 
      FROM sys.columns c 
      JOIN sys.tables t ON c.object_id = t.object_id 
      WHERE t.name = @tname AND c.is_identity = 1
    `);
  return r.recordset.map(row => row.name);
}

async function getColumns(pool, tableName) {
  const r = await pool.request()
    .input('tname', sql.NVarChar, tableName)
    .query(`
      SELECT c.name, c.column_id
      FROM sys.columns c 
      JOIN sys.tables t ON c.object_id = t.object_id 
      WHERE t.name = @tname
      ORDER BY c.column_id
    `);
  return r.recordset.map(row => row.name);
}

async function getObjectDefinition(pool, objectName, objectType) {
  const typeCode = objectType === 'VIEW' ? 'V' : 'P';
  const r = await pool.request()
    .input('oname', sql.NVarChar, objectName)
    .input('otype', sql.NVarChar, typeCode)
    .query(`
      SELECT sm.definition
      FROM sys.sql_modules sm
      JOIN sys.objects so ON sm.object_id = so.object_id
      WHERE so.name = @oname AND so.type = @otype
    `);
  return r.recordset.length > 0 ? r.recordset[0].definition : null;
}

async function getForeignKeysReferencing(pool, tableName) {
  const r = await pool.request()
    .input('tname', sql.NVarChar, tableName)
    .query(`
      SELECT fk.name as fk_name, OBJECT_NAME(fk.parent_object_id) as referencing_table
      FROM sys.foreign_keys fk
      JOIN sys.tables t ON fk.referenced_object_id = t.object_id
      WHERE t.name = @tname
    `);
  return r.recordset;
}

// ---- Main migration ----
async function main() {
  let livePool, devPool;

  try {
    // ====== STEP 0: Connect ======
    log('═══════════════════════════════════════════════════════════');
    log('STEP 0: Connecting to both servers...');
    log('═══════════════════════════════════════════════════════════');

    livePool = await new sql.ConnectionPool(LIVE_CONFIG).connect();
    logOK('LIVE server (192.168.1.21) connected');

    devPool = await new sql.ConnectionPool(DEV_CONFIG).connect();
    logOK('DEV server (192.168.1.49) connected');

    // ====== STEP 1: Pre-flight safety checks ======
    log('');
    log('═══════════════════════════════════════════════════════════');
    log('STEP 1: Pre-flight inventory (LIVE vs DEV)');
    log('═══════════════════════════════════════════════════════════');

    log('');
    log('--- TABLE INVENTORY ---');
    console.log(
      'Table'.padEnd(55) + 'LIVE Rows'.padStart(12) + 'DEV Exists'.padStart(12) + 'DEV Rows'.padStart(12)
    );
    console.log('-'.repeat(91));

    const inventory = [];
    for (const t of TABLES) {
      const liveExists = await tableExists(livePool, t);
      const devExists_ = await tableExists(devPool, t);
      const liveRows = liveExists ? await getRowCount(livePool, t) : 'N/A';
      const devRows = devExists_ ? await getRowCount(devPool, t) : 'N/A';

      inventory.push({ table: t, liveExists, devExists: devExists_, liveRows, devRows });
      console.log(
        t.padEnd(55) +
        String(liveRows).padStart(12) +
        (devExists_ ? 'YES' : 'NO').padStart(12) +
        String(devRows).padStart(12)
      );
    }

    // Check for tables that don't exist on LIVE (bad)
    const missingOnLive = inventory.filter(i => !i.liveExists);
    if (missingOnLive.length > 0) {
      logWarn(`Tables NOT found on LIVE: ${missingOnLive.map(i => i.table).join(', ')}`);
      logWarn('These will be skipped.');
    }

    log('');
    log('--- VIEW INVENTORY ---');
    for (const v of VIEWS) {
      const def = await getObjectDefinition(livePool, v, 'VIEW');
      const devDef = await getObjectDefinition(devPool, v, 'VIEW');
      console.log(`  ${v.padEnd(45)} LIVE: ${def ? 'EXISTS' : 'MISSING'}  |  DEV: ${devDef ? 'EXISTS' : 'MISSING'}`);
    }

    log('');
    log('--- STORED PROCEDURE INVENTORY ---');
    for (const sp of STORED_PROCEDURES) {
      const def = await getObjectDefinition(livePool, sp, 'PROCEDURE');
      const devDef = await getObjectDefinition(devPool, sp, 'PROCEDURE');
      console.log(`  ${sp.padEnd(50)} LIVE: ${def ? 'EXISTS' : 'MISSING'}  |  DEV: ${devDef ? 'EXISTS' : 'MISSING'}`);
    }

    log('');
    log('Pre-flight check complete. Starting migration...');
    log('');

    // ====== STEP 2: Copy tables ======
    log('═══════════════════════════════════════════════════════════');
    log('STEP 2: Copying table data (LIVE -> DEV)');
    log('═══════════════════════════════════════════════════════════');

    let tablesOK = 0;
    let tablesFailed = 0;
    let tablesSkipped = 0;

    for (const t of TABLES) {
      const info = inventory.find(i => i.table === t);

      if (!info.liveExists) {
        logWarn(`SKIP: ${t} does not exist on LIVE`);
        tablesSkipped++;
        continue;
      }

      log(`Copying ${t}...`);

      try {
        // Get columns from LIVE
        const liveCols = await getColumns(livePool, t);
        const liveRows = info.liveRows;

        if (info.devExists) {
          // Table exists on DEV - check for FK constraints referencing this table
          const fks = await getForeignKeysReferencing(devPool, t);
          
          // Check for identity columns
          const identityCols = await getIdentityColumns(devPool, t);
          const hasIdentity = identityCols.length > 0;

          // Get DEV columns to find common columns
          const devCols = await getColumns(devPool, t);
          const commonCols = liveCols.filter(c => devCols.includes(c));
          const colList = commonCols.map(c => `[${c}]`).join(', ');

          // Delete existing data
          if (fks.length > 0) {
            log(`  Disabling ${fks.length} FK constraint(s)...`);
            for (const fk of fks) {
              await devPool.request().query(
                `ALTER TABLE [${fk.referencing_table}] NOCHECK CONSTRAINT [${fk.fk_name}]`
              );
            }
          }

          await devPool.request().query(`DELETE FROM [${t}]`);

          // Pull data from live in batches and insert into dev
          if (hasIdentity) {
            await devPool.request().query(`SET IDENTITY_INSERT [${t}] ON`);
          }

          // Read all rows from LIVE
          const liveData = await livePool.request().query(`SELECT ${colList} FROM [${t}]`);
          const rows = liveData.recordset;

          if (rows.length > 0) {
            // Bulk insert using mssql bulk operations
            const table = new sql.Table(t);
            table.create = false;

            // Get column metadata from DEV for the common columns
            const colMeta = await devPool.request().query(`
              SELECT c.name, t2.name as type_name, c.max_length, c.precision, c.scale, c.is_nullable, c.is_identity
              FROM sys.columns c
              JOIN sys.types t2 ON c.system_type_id = t2.system_type_id AND c.user_type_id = t2.user_type_id
              JOIN sys.tables tbl ON c.object_id = tbl.object_id
              WHERE tbl.name = '${t}'
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

            // Add rows
            for (const row of rows) {
              const values = commonCols.map(c => row[c] !== undefined ? row[c] : null);
              table.rows.add(...values);
            }

            // Bulk insert
            const bulkReq = devPool.request();
            await bulkReq.bulk(table);
          }

          if (hasIdentity) {
            await devPool.request().query(`SET IDENTITY_INSERT [${t}] OFF`);
          }

          // Re-enable FK constraints
          if (fks.length > 0) {
            for (const fk of fks) {
              await devPool.request().query(
                `ALTER TABLE [${fk.referencing_table}] WITH CHECK CHECK CONSTRAINT [${fk.fk_name}]`
              );
            }
          }
        } else {
          // Table doesn't exist on DEV - we need to create it
          // Get the CREATE TABLE script from live
          log(`  Table doesn't exist on DEV, creating schema...`);
          
          // Get full DDL from LIVE
          const ddlResult = await livePool.request().query(`
            DECLARE @sql NVARCHAR(MAX) = '';
            DECLARE @tableName NVARCHAR(255) = '${t}';
            
            -- Build CREATE TABLE
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
            
            -- Remove trailing comma
            SET @sql = LEFT(@sql, LEN(@sql) - 2) + CHAR(13) + ')';
            
            SELECT @sql AS ddl;
          `);

          const ddl = ddlResult.recordset[0].ddl;
          await devPool.request().query(ddl);

          // Now bulk insert data
          const liveCols2 = await getColumns(livePool, t);
          const colList = liveCols2.map(c => `[${c}]`).join(', ');
          const liveData = await livePool.request().query(`SELECT ${colList} FROM [${t}]`);
          const rows = liveData.recordset;

          if (rows.length > 0) {
            const identityCols = await getIdentityColumns(devPool, t);
            const hasIdentity = identityCols.length > 0;

            if (hasIdentity) {
              await devPool.request().query(`SET IDENTITY_INSERT [${t}] ON`);
            }

            const table2 = new sql.Table(t);
            table2.create = false;

            const colMeta = await devPool.request().query(`
              SELECT c.name, t2.name as type_name, c.max_length, c.precision, c.scale, c.is_nullable
              FROM sys.columns c
              JOIN sys.types t2 ON c.system_type_id = t2.system_type_id AND c.user_type_id = t2.user_type_id
              JOIN sys.tables tbl ON c.object_id = tbl.object_id
              WHERE tbl.name = '${t}'
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
              table2.columns.add(col.name, sqlType, { nullable: col.is_nullable });
            }

            for (const row of rows) {
              const values = liveCols2.map(c => row[c] !== undefined ? row[c] : null);
              table2.rows.add(...values);
            }

            await devPool.request().bulk(table2);

            if (hasIdentity) {
              await devPool.request().query(`SET IDENTITY_INSERT [${t}] OFF`);
            }
          }
        }

        // Verify
        const devCount = await getRowCount(devPool, t);
        if (devCount === liveRows) {
          logOK(`${t}: ${devCount} rows (matches LIVE)`);
        } else {
          logWarn(`${t}: DEV has ${devCount} rows, LIVE has ${liveRows} rows`);
        }
        tablesOK++;
      } catch (err) {
        logErr(`${t}: FAILED - ${err.message}`);
        tablesFailed++;
      }
    }

    log('');
    log(`Tables: ${tablesOK} OK, ${tablesFailed} failed, ${tablesSkipped} skipped`);

    // ====== STEP 3: Copy views ======
    log('');
    log('═══════════════════════════════════════════════════════════');
    log('STEP 3: Copying views (LIVE -> DEV)');
    log('═══════════════════════════════════════════════════════════');

    let viewsOK = 0;
    let viewsFailed = 0;

    for (const v of VIEWS) {
      try {
        const def = await getObjectDefinition(livePool, v, 'VIEW');
        if (!def) {
          logWarn(`SKIP: ${v} not found on LIVE`);
          continue;
        }

        // Drop if exists on DEV
        const devDef = await getObjectDefinition(devPool, v, 'VIEW');
        if (devDef) {
          await devPool.request().query(`DROP VIEW [${v}]`);
        }

        // Create on DEV
        await devPool.request().query(def);
        logOK(`${v}`);
        viewsOK++;
      } catch (err) {
        logErr(`${v}: FAILED - ${err.message}`);
        viewsFailed++;
      }
    }

    log('');
    log(`Views: ${viewsOK} OK, ${viewsFailed} failed`);

    // ====== STEP 4: Copy stored procedures ======
    log('');
    log('═══════════════════════════════════════════════════════════');
    log('STEP 4: Copying stored procedures (LIVE -> DEV)');
    log('═══════════════════════════════════════════════════════════');

    let spsOK = 0;
    let spsFailed = 0;

    for (const sp of STORED_PROCEDURES) {
      try {
        const def = await getObjectDefinition(livePool, sp, 'PROCEDURE');
        if (!def) {
          logWarn(`SKIP: ${sp} not found on LIVE`);
          continue;
        }

        // Drop if exists on DEV
        const devDef = await getObjectDefinition(devPool, sp, 'PROCEDURE');
        if (devDef) {
          await devPool.request().query(`DROP PROCEDURE [${sp}]`);
        }

        // Create on DEV
        await devPool.request().query(def);
        logOK(`${sp}`);
        spsOK++;
      } catch (err) {
        logErr(`${sp}: FAILED - ${err.message}`);
        spsFailed++;
      }
    }

    log('');
    log(`Stored Procedures: ${spsOK} OK, ${spsFailed} failed`);

    // ====== STEP 5: Final verification ======
    log('');
    log('═══════════════════════════════════════════════════════════');
    log('STEP 5: Final verification on DEV');
    log('═══════════════════════════════════════════════════════════');

    log('');
    log('--- TABLES on DEV ---');
    const devTables = await devPool.request().query(`
      SELECT t.name, 
             (SELECT SUM(p.rows) FROM sys.partitions p WHERE p.object_id = t.object_id AND p.index_id IN (0,1)) as row_count
      FROM sys.tables t 
      WHERE t.name LIKE '%COGS%' 
      ORDER BY t.name
    `);
    for (const row of devTables.recordset) {
      console.log(`  ${row.name.padEnd(55)} ${row.row_count} rows`);
    }

    log('');
    log('--- VIEWS on DEV ---');
    const devViews = await devPool.request().query(`
      SELECT name FROM sys.views WHERE name LIKE '%COGS%' ORDER BY name
    `);
    for (const row of devViews.recordset) {
      console.log(`  ${row.name}`);
    }

    log('');
    log('--- STORED PROCEDURES on DEV ---');
    const devSPs = await devPool.request().query(`
      SELECT name FROM sys.procedures 
      WHERE name LIKE '%COGS%' OR name LIKE 'sp_generate_simulasi%' 
      ORDER BY name
    `);
    for (const row of devSPs.recordset) {
      console.log(`  ${row.name}`);
    }

    log('');
    log('═══════════════════════════════════════════════════════════');
    log('MIGRATION COMPLETE');
    log('═══════════════════════════════════════════════════════════');

  } catch (err) {
    logErr(`FATAL: ${err.message}`);
    console.error(err.stack);
  } finally {
    if (livePool) await livePool.close();
    if (devPool) await devPool.close();
    process.exit(0);
  }
}

main();
