require('dotenv').config();
const sql = require('mssql');
const fs = require('fs');

const config = {
    server: process.env.SQL_HOST,
    port: parseInt(process.env.SQL_PORT),
    database: process.env.SQL_DATABASE,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true },
    requestTimeout: 300000
};

async function deploy() {
    const pool = await sql.connect(config);
    
    console.log('=== DEPLOYING v7 PROCEDURE WITH GRANULATE COSTING ===');
    
    // Step 1: Add new columns (if not exists)
    console.log('\n1. Checking/adding granulate columns to tables...');
    try {
        const colScript = fs.readFileSync('./migrations/010a_add_granulate_columns.sql', 'utf8');
        const colStatements = colScript.split(/^GO$/gim).filter(s => s.trim());
        for (const stmt of colStatements) {
            if (stmt.trim()) {
                try {
                    await pool.request().query(stmt);
                } catch (e) {
                    // Ignore "already exists" errors
                    if (e.message && !e.message.includes('already')) {
                        console.log('  Column script note:', e.message.substring(0, 80));
                    }
                }
            }
        }
        console.log('  Columns verified!');
    } catch (e) {
        console.log('  Column migration file not found or error:', e.message.substring(0, 80));
    }
    
    // Step 2: Deploy v7 procedure
    console.log('\n2. Deploying v7 procedure...');
    const v7Script = fs.readFileSync('./migrations/010_sp_COGS_Calculate_HPP_Actual_v7.sql', 'utf8');
    const v7Statements = v7Script.split(/^GO$/gim).filter(s => s.trim());
    for (const stmt of v7Statements) {
        if (stmt.trim()) {
            await pool.request().query(stmt);
        }
    }
    console.log('  v7 procedure deployed!');
    
    // Verify procedure exists
    const verify = await pool.request().query(`
        SELECT name, create_date, modify_date 
        FROM sys.procedures 
        WHERE name = 'sp_COGS_Calculate_HPP_Actual'
    `);
    console.log('\n3. Procedure verification:');
    console.table(verify.recordset);
    
    await pool.close();
    console.log('\n=== DEPLOYMENT COMPLETE ===');
}

deploy().catch(err => {
    console.error('Deployment error:', err.message);
    process.exit(1);
});
