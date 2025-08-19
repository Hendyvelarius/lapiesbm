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

async function getParameter(req, res) {
  try {
    const db = await connect();
    const query = 'SELECT * FROM M_COGS_STD_PARAMETER';
    const result = await db.request().query(query);
    return result.recordset;
  } catch (error) {
    console.error('Error executing getParameter query:', error);
    throw error;
  }
}

async function updateParameter(directLabour, foh, depresiasi, mhTimbangBB, mhTimbangBK, mhAnalisa, biayaAnalisa, kwhMesin, rateKwhMesin, userId) {
  try {
    const db = await connect();
    const currentYear = new Date().getFullYear().toString();
    
    // Update the single parameter record with current year as Periode
    const updateQuery = `
      UPDATE M_COGS_STD_PARAMETER 
      SET 
        Periode = @periode,
        Direct_Labor = @directLabour,
        Factory_Over_Head = @foh,
        Depresiasi = @depresiasi,
        MH_Timbang_BB = @mhTimbangBB,
        MH_Timbang_BK = @mhTimbangBK,
        MH_Analisa = @mhAnalisa,
        Biaya_Analisa = @biayaAnalisa,
        Jam_KWH_Mesin_Utama = @kwhMesin,
        Rate_KWH_Mesin = @rateKwhMesin
    `;
    
    const result = await db.request()
      .input('periode', currentYear)
      .input('directLabour', directLabour)
      .input('foh', foh)
      .input('depresiasi', depresiasi)
      .input('mhTimbangBB', mhTimbangBB)
      .input('mhTimbangBK', mhTimbangBK)
      .input('mhAnalisa', mhAnalisa)
      .input('biayaAnalisa', biayaAnalisa)
      .input('kwhMesin', kwhMesin)
      .input('rateKwhMesin', rateKwhMesin)
      .query(updateQuery);
      
    return {
      success: true,
      operation: 'update',
      rowsAffected: result.rowsAffected[0],
      periode: currentYear
    };
  } catch (error) {
    console.error('Error executing updateParameter query:', error);
    throw error;
  }
}

async function getGroup(req, res) {
  try {
    const db = await connect();
    const query = 'SELECT * FROM vw_COGS_Product_Group';
    const result = await db.request().query(query);
    return result.recordset;
  } catch (error) {
    console.error('Error executing getGroup query:', error);
    throw error;
  }
}

async function addGroup(productId, productName, pnCategory, pnCategoryName, manHourPros, manHourPack, rendemen, dept, userId) {
  try {
    const db = await connect();
    const currentDate = new Date();
    const periode = `${currentDate.getFullYear()}${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    const query = `
      INSERT INTO M_COGS_PRODUCT_GROUP_MANUAL (
        Periode,
        Group_ProductID,
        Product_Name,
        Group_PNCategory,
        Group_PNCategoryName,
        Group_ManHourPros,
        Group_ManHourPack,
        Group_Rendemen,
        Group_Dept
      ) VALUES (
        @periode,
        @productId,
        @productName,
        @pnCategory,
        @pnCategoryName,
        @manHourPros,
        @manHourPack,
        @rendemen,
        @dept
      )
    `;
    
    const result = await db.request()
      .input('periode', periode)
      .input('productId', productId)
      .input('productName', productName)
      .input('pnCategory', pnCategory)
      .input('pnCategoryName', pnCategoryName)
      .input('manHourPros', manHourPros)
      .input('manHourPack', manHourPack)
      .input('rendemen', rendemen)
      .input('dept', dept)
      .query(query);
      
    return {
      success: true,
      rowsAffected: result.rowsAffected[0],
      periode: periode
    };
  } catch (error) {
    console.error('Error executing addGroup query:', error);
    throw error;
  }
}

async function updateGroup(id, productId, productName, pnCategory, pnCategoryName, manHourPros, manHourPack, rendemen, dept, userId) {
  try {
    const db = await connect();
    const currentDate = new Date();
    const periode = `${currentDate.getFullYear()}${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    const query = `
      UPDATE M_COGS_PRODUCT_GROUP_MANUAL 
      SET 
        Periode = @periode,
        Group_ProductID = @productId,
        Product_Name = @productName,
        Group_PNCategory = @pnCategory,
        Group_PNCategoryName = @pnCategoryName,
        Group_ManHourPros = @manHourPros,
        Group_ManHourPack = @manHourPack,
        Group_Rendemen = @rendemen,
        Group_Dept = @dept
      WHERE pk_id = @id
    `;
    
    const result = await db.request()
      .input('id', id)
      .input('periode', periode)
      .input('productId', productId)
      .input('productName', productName)
      .input('pnCategory', pnCategory)
      .input('pnCategoryName', pnCategoryName)
      .input('manHourPros', manHourPros)
      .input('manHourPack', manHourPack)
      .input('rendemen', rendemen)
      .input('dept', dept)
      .query(query);
      
    if (result.rowsAffected[0] === 0) {
      throw new Error('No record found with the provided ID');
    }
      
    return {
      success: true,
      rowsAffected: result.rowsAffected[0],
      periode: periode
    };
  } catch (error) {
    console.error('Error executing updateGroup query:', error);
    throw error;
  }
}

async function deleteGroup(id) {
  try {
    const db = await connect();
    
    // First check if the record exists
    const checkQuery = 'SELECT pk_id, Group_ProductID, Product_Name FROM M_COGS_PRODUCT_GROUP_MANUAL WHERE pk_id = @id';
    const checkResult = await db.request()
      .input('id', id)
      .query(checkQuery);
    
    if (checkResult.recordset.length === 0) {
      throw new Error('No record found with the provided ID');
    }
    
    // Delete the record
    const deleteQuery = 'DELETE FROM M_COGS_PRODUCT_GROUP_MANUAL WHERE pk_id = @id';
    const result = await db.request()
      .input('id', id)
      .query(deleteQuery);
      
    return {
      success: true,
      rowsAffected: result.rowsAffected[0],
      deletedRecord: checkResult.recordset[0]
    };
  } catch (error) {
    console.error('Error executing deleteGroup query:', error);
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
  getUnit,
  getParameter,
  updateParameter,
  getGroup,
  addGroup,
  updateGroup,
  deleteGroup
};