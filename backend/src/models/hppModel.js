const { connect } = require('../../config/sqlserver');
const sql = require('mssql');

async function getHPP() {
  try {
    const db = await connect();
    const result = await db.request().query(`exec sp_COGS_GenerateHPP '2025','1','0'`);
    
    // The stored procedure returns multiple result sets
    // result.recordsets is an array containing all result sets
    return {
      ethical: result.recordsets[0] || [],
      generik1: result.recordsets[1] || [],
      generik2: result.recordsets[2] || []
    };
  } catch (error) {
    console.error('Error executing getHPP query:', error);
    throw error;
  }
}

module.exports = {
  getHPP,
};