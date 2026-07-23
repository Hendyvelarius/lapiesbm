require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs'); const path = require('path'); const sql = require('mssql');
const CONFIG = { user: process.env.SQL_USER, password: process.env.SQL_PASSWORD, server: process.env.SQL_HOST,
  port: parseInt(process.env.SQL_PORT,10)||1433, database: process.env.SQL_DATABASE,
  options:{encrypt:false,trustServerCertificate:true}, connectionTimeout:15000, requestTimeout:60000 };
const FILE='023_price_change_simulation_include_toll_fee.sql';
const split=(t)=>t.split(/^\s*GO\s*;?\s*$/gim).map(b=>b.trim()).filter(Boolean);
(async()=>{const pool=await sql.connect(CONFIG);
  const batches=split(fs.readFileSync(path.join(__dirname,FILE),'utf8'));
  console.log(`${FILE}: ${batches.length} batch(es)`);
  for(let i=0;i<batches.length;i++){const nm=(batches[i].match(/ALTER PROCEDURE\s+\[?dbo\]?\.\[?(\w+)\]?/i)||[])[1]||'header';
    await pool.request().batch(batches[i]); console.log(`  [${i+1}/${batches.length}] ${nm} -> OK`);}
  await pool.close(); console.log('Done.');})().catch(e=>{console.error('FAILED:',e.message);process.exit(1);});
