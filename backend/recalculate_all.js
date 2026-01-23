const { connect } = require('./config/sqlserver');

async function main() {
    const db = await connect();
    
    console.log('=== Recalculating ALL HPP Actual with v2 procedure ===\n');
    
    // Get all periods that have data
    const periods = await db.request().query(`
        SELECT DISTINCT Periode FROM t_COGS_HPP_Actual_Header ORDER BY Periode
    `);
    
    console.log('Periods to recalculate:', periods.recordset.map(p => p.Periode));
    
    for (const p of periods.recordset) {
        console.log(`\nRecalculating period ${p.Periode}...`);
        const result = await db.request().query(`
            EXEC sp_COGS_Calculate_HPP_Actual @Periode = '${p.Periode}', @RecalculateExisting = 1
        `);
        console.log('Result:', result.recordset[0]);
    }
    
    console.log('\n=== Summary ===');
    const summary = await db.request().query(`
        SELECT 
            COUNT(*) as TotalBatches,
            SUM(Total_Cost_BB) as Total_BB,
            SUM(Total_Cost_BK) as Total_BK,
            SUM(Count_Materials_PO) as PO_Count,
            SUM(Count_Materials_UNLINKED) as Unlinked_Count
        FROM t_COGS_HPP_Actual_Header
    `);
    console.log(summary.recordset[0]);
    
    process.exit(0);
}

main().catch(err => {
    console.error(err.message);
    process.exit(1);
});
