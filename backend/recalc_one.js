require('dotenv').config();
const sql = require('mssql');

const periode = process.argv[2] || '202508';

async function run() {
    const config = {
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        server: process.env.SQL_HOST,
        database: process.env.SQL_DATABASE,
        options: { encrypt: false, trustServerCertificate: true, requestTimeout: 600000 }
    };
    
    await sql.connect(config);
    
    console.log(`Recalculating ${periode} with v11...`);
    const start = Date.now();
    await sql.query(`EXEC sp_COGS_Calculate_HPP_Actual @Periode = ${periode}, @RecalculateExisting = 1`);
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`Done ${periode} in ${duration}s`);
    
    await sql.close();
}

run().catch(err => { console.error(err); process.exit(1); });
