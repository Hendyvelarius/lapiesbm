require('dotenv').config();
const sql = require('mssql');

const config = {
    server: process.env.SQL_HOST,
    port: parseInt(process.env.SQL_PORT),
    database: process.env.SQL_DATABASE,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true },
    requestTimeout: 600000  // 10 minutes timeout for large periods
};

async function runHPPActual(periode) {
    const pool = await sql.connect(config);
    
    console.log(`\n=== Running HPP Actual Calculation for ${periode} ===`);
    console.log('This may take several minutes...\n');
    
    const startTime = Date.now();
    
    try {
        const result = await pool.request()
            .input('Periode', sql.VarChar(6), periode)
            .input('RecalculateExisting', sql.Bit, 1)
            .input('Debug', sql.Bit, 1)
            .execute('sp_COGS_Calculate_HPP_Actual');
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        console.log('\n=== Calculation Results ===');
        if (result.recordset && result.recordset.length > 0) {
            console.table(result.recordset);
        }
        console.log(`Duration: ${duration}s`);
        
        // Check granulate results
        const granCheck = await pool.request().query(`
            SELECT 
                COUNT(*) as TotalBatches,
                SUM(Granulate_Count) as TotalGranulates,
                SUM(Total_Cost_Granulate) as TotalGranulateCost
            FROM t_COGS_HPP_Actual_Header
            WHERE Periode = '${periode}'
        `);
        console.log('\n=== Granulate Summary ===');
        console.table(granCheck.recordset);
        
        // Sample granulate details
        const granSample = await pool.request().query(`
            SELECT TOP 5
                d.Item_ID, d.Item_Name, d.Qty_Used, d.Unit_Price_IDR, d.Price_Source,
                d.Granulate_Batch, d.Granulate_Cost_Per_Gram
            FROM t_COGS_HPP_Actual_Detail d
            JOIN t_COGS_HPP_Actual_Header h ON d.HPP_Actual_ID = h.HPP_Actual_ID
            WHERE h.Periode = '${periode}' AND d.Is_Granulate = 1
            ORDER BY d.Unit_Price_IDR DESC
        `);
        if (granSample.recordset.length > 0) {
            console.log('\n=== Sample Granulate Details ===');
            console.table(granSample.recordset);
        }
        
    } catch (err) {
        console.error('Error during calculation:', err.message);
    }
    
    await pool.close();
}

// Run for both periods
async function main() {
    await runHPPActual('202601');
    await runHPPActual('202508');
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
