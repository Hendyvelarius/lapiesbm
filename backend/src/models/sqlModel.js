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

async function getUnit() {
  try {
    const db = await connect();
    const result = await db.request().query("select unit_id, unit_description from m_Unit where isActive=1 AND unit_id NOT LIKE '(NONE)'");
    return result.recordset;
  } catch (error) {
    console.error('Error executing getUnit query:', error);
    throw error;
  }
}

async function getBahan() {
  try {
    const db = await connect();
    const result = await db.request().query("SELECT Item_ID, Item_Name, Item_LastPurchaseUnit, Item_LastPriceCurrency, Item_LastPrice FROM m_Item_Manufacturing WHERE isActive = '1'");
    return result.recordset;
  } catch (error) {
    console.error('Error executing getBahan query:', error);
    throw error;
  }
}

async function getHargaBahan() {
  try {
    const db = await connect();
    const result = await db.request().query('SELECT * FROM M_COGS_STD_HRG_BAHAN');
    return result.recordset;
  } catch (error) {
    console.error('Error executing getHargaBahan query:', error);
    throw error;
  }
}

async function addHargaBahan(itemId, itemType, unit, price, currency, rate, userId) {
  try {
    const db = await connect();
    const currentDateTime = new Date().toISOString();
    
    const query = `
      INSERT INTO M_COGS_STD_HRG_BAHAN (
        ITEM_ID,
        ITEM_TYPE,
        ITEM_PURCHASE_UNIT,
        ITEM_PURCHASE_STD_PRICE,
        ITEM_CURRENCY,
        user_id,
        delegated_to,
        process_date,
        flag_update,
        from_update,
        createdAt,
        updatedAt
      ) VALUES (
        @itemId,
        @itemType,
        @unit,
        @price,
        @currency,
        @userId,
        @userId,
        @processDate,
        NULL,
        NULL,
        @createdAt,
        @updatedAt
      )
    `;
    
    const result = await db.request()
      .input('itemId', itemId)
      .input('itemType', itemType)
      .input('unit', unit)
      .input('price', price)
      .input('currency', currency)
      .input('userId', userId)
      .input('processDate', currentDateTime)
      .input('createdAt', currentDateTime)
      .input('updatedAt', currentDateTime)
      .query(query);
      
    return {
      success: true,
      rowsAffected: result.rowsAffected[0],
      insertedAt: currentDateTime
    };
  } catch (error) {
    console.error('Error executing addHargaBahan query:', error);
    throw error;
  }
}

async function updateHargaBahan(pkId, itemType, unit, price, currency, rate, userId) {
  try {
    const db = await connect();
    const currentDateTime = new Date().toISOString();
    
    const query = `
      UPDATE M_COGS_STD_HRG_BAHAN 
      SET 
        ITEM_TYPE = @itemType,
        ITEM_PURCHASE_UNIT = @unit,
        ITEM_PURCHASE_STD_PRICE = @price,
        ITEM_CURRENCY = @currency,
        user_id = @userId,
        delegated_to = @userId,
        process_date = @processDate,
        flag_update = 'Y',
        from_update = @userId,
        updatedAt = @updatedAt
      WHERE pk_id = @pkId
    `;
    
    const result = await db.request()
      .input('pkId', pkId)
      .input('itemType', itemType)
      .input('unit', unit)
      .input('price', price)
      .input('currency', currency)
      .input('userId', userId)
      .input('processDate', currentDateTime)
      .input('updatedAt', currentDateTime)
      .query(query);
      
    if (result.rowsAffected[0] === 0) {
      throw new Error('No record found with the provided ID');
    }
      
    return {
      success: true,
      rowsAffected: result.rowsAffected[0],
      updatedAt: currentDateTime
    };
  } catch (error) {
    console.error('Error executing updateHargaBahan query:', error);
    throw error;
  }
}

async function deleteHargaBahan(pkId) {
  try {
    const db = await connect();
    
    // First check if the record exists
    const checkQuery = 'SELECT pk_id, ITEM_ID FROM M_COGS_STD_HRG_BAHAN WHERE pk_id = @pkId';
    const checkResult = await db.request()
      .input('pkId', pkId)
      .query(checkQuery);
    
    if (checkResult.recordset.length === 0) {
      throw new Error('No record found with the provided ID');
    }
    
    // Delete the record
    const deleteQuery = 'DELETE FROM M_COGS_STD_HRG_BAHAN WHERE pk_id = @pkId';
    const result = await db.request()
      .input('pkId', pkId)
      .query(deleteQuery);
      
    return {
      success: true,
      rowsAffected: result.rowsAffected[0],
      deletedRecord: checkResult.recordset[0]
    };
  } catch (error) {
    console.error('Error executing deleteHargaBahan query:', error);
    throw error;
  }
}

module.exports = { 
  getCurrencyList,
  getBahan,
  getHargaBahan,
  addHargaBahan,
  updateHargaBahan,
  deleteHargaBahan,
  getUnit
};