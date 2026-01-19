const fs = require('fs');
const { connect } = require('./config/sqlserver');

async function main() {
    const db = await connect();
    
    const file = process.argv[2] || 'migrations/004_sp_COGS_Calculate_HPP_Actual.sql';
    console.log('Executing:', file);
    
    let sql = fs.readFileSync(file, 'utf8');
    
    // Split by GO and execute each part
    const parts = sql.split(/^GO$/gm);
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (part && part.length > 10) {
            try {
                await db.request().query(part);
                console.log('Part ' + (i + 1) + ' executed successfully');
            } catch (err) {
                console.error('Part ' + (i + 1) + ' error:', err.message);
            }
        }
    }
    
    console.log('\nDone!');
    process.exit(0);
}

main().catch(err => {
    console.error(err.message);
    process.exit(1);
});
