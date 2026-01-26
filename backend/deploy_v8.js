require('dotenv').config();
const sql = require('mssql');
const fs = require('fs');

const config = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_HOST,
    database: process.env.SQL_DATABASE,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

async function deploy() {
    try {
        console.log('Connecting to database...');
        await sql.connect(config);
        
        // Deploy migration first
        console.log('Running migration 011...');
        const migration = fs.readFileSync('./migrations/011_add_cost_per_unit_to_hpp_actual_header.sql', 'utf8');
        const migBatches = migration.split(/\nGO\s*\n/i).filter(b => b.trim());
        for (const batch of migBatches) {
            if (batch.trim()) await sql.query(batch);
        }
        
        // Deploy v10 procedure
        console.log('Reading v10 script...');
        const script = fs.readFileSync('./migrations/010_sp_COGS_Calculate_HPP_Actual_v10.sql', 'utf8');
        
        // Split by GO and execute each batch
        const batches = script.split(/\nGO\s*\n/i).filter(b => b.trim());
        
        console.log(`Deploying sp_COGS_Calculate_HPP_Actual v10 (${batches.length} batches)...`);
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i].trim();
            if (batch) {
                console.log(`  Executing batch ${i + 1}...`);
                await sql.query(batch);
            }
        }
        
        console.log('v10 deployed successfully');
        await sql.close();
    } catch (err) {
        console.error('Deploy failed:', err.message);
        process.exit(1);
    }
}

deploy();
