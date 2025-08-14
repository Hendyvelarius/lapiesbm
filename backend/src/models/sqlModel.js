const { connect } = require('../../config/sqlserver');

async function getCurrencyList() {
  try {
    const db = await connect();
    const result = await db.request().query('SELECT * FROM vw_COGS_Currency_List');
    return result.recordset;
  } catch (error) {
    console.error('Error executing getCurrencyList query:', error);
    throw error;
  }
}

module.exports = { 
  getCurrencyList 
};