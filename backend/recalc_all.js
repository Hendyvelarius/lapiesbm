require('dotenv').config();
const sql = require('mssql');

async function run() {
    const config = {
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        server: process.env.SQL_HOST,
        database: process.env.SQL_DATABASE,
        options: { encrypt: false, trustServerCertificate: true, requestTimeout: 120000 }
    };
    
    await sql.connect(config);
    
    console.log('Recalculating 202506...');
    await sql.query('EXEC sp_COGS_Calculate_HPP_Actual @Periode = 202506, @RecalculateExisting = 1');
    console.log('Done 202506');
    
    console.log('Recalculating 202508...');
    await sql.query('EXEC sp_COGS_Calculate_HPP_Actual @Periode = 202508, @RecalculateExisting = 1');
    console.log('Done 202508');
    
    await sql.close();
    console.log('All periods recalculated with v10!');
}

run().catch(err => { console.error(err); process.exit(1); });
