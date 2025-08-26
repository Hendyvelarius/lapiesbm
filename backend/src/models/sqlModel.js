const { connect } = require('../../config/sqlserver');
const sql = require('mssql');

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

async function getGroupManual(req, res) {
try {
    const db = await connect();
    const query = 'SELECT * FROM M_COGS_PRODUCT_GROUP_MANUAL';
    const result = await db.request().query(query);
    return result.recordset;
} catch (error) {
    console.error('Error executing getGroupManual query:', error);
    throw error;
}
}

async function addGroup(productId, productName, pnCategory, pnCategoryName, manHourPros, manHourPack, rendemen, dept, userId) {
  try {
    const db = await connect();
    
    const query = `
      INSERT INTO M_COGS_PRODUCT_GROUP_MANUAL (
        Group_ProductID,
        Group_PNCategory,
        Group_PNCategoryName,
        Group_ManHourPros,
        Group_ManHourPack,
        Group_Rendemen,
        Group_Dept,
        user_id
      ) VALUES (
        @productId,
        @pnCategory,
        @pnCategoryName,
        @manHourPros,
        @manHourPack,
        @rendemen,
        @dept,
        @userId
      )
    `;
    
    const result = await db.request()
      .input('productId', sql.NVarChar, productId)
      .input('pnCategory', sql.Int, pnCategory)
      .input('pnCategoryName', sql.NVarChar, pnCategoryName)
      .input('manHourPros', sql.Decimal(10,2), manHourPros)
      .input('manHourPack', sql.Decimal(10,2), manHourPack)
      .input('rendemen', sql.Decimal(10,2), rendemen)
      .input('dept', sql.NVarChar, dept)
      .input('userId', sql.NVarChar, userId || null)
      .query(query);
    
    return { success: true, message: 'Group added successfully' };
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
    
    // First check if the record exists using the correct column name
    const checkQuery = 'SELECT Group_ProductID FROM M_COGS_PRODUCT_GROUP_MANUAL WHERE Group_ProductID = @id';
    const checkResult = await db.request()
      .input('id', sql.NVarChar, id)
      .query(checkQuery);
    
    if (checkResult.recordset.length === 0) {
      throw new Error('No record found with the provided ID');
    }
    
    // Delete the record using ProductID as the key
    const deleteQuery = 'DELETE FROM M_COGS_PRODUCT_GROUP_MANUAL WHERE Group_ProductID = @id';
    const result = await db.request()
      .input('id', sql.NVarChar, id)
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

async function getProductName() {
  try {
    const db = await connect();
    const query = 'SELECT mp.Product_ID , mp.Product_Name FROM m_Product mp WHERE mp.isActive = 1';
    const result = await db.request().query(query);
    return result.recordset;
  } catch (error) {
    console.error('Error executing getProductName query:', error);
    throw error;
  }
}

async function getPembebanan() {
  try {
    const db = await connect();
    const query = 'SELECT * FROM M_COGS_PEMBEBANAN';
    const result = await db.request().query(query);
    return result.recordset;
  } catch (error) {
    console.error('Error executing getPembebanan query:', error);
    throw error;
  }
}

async function addPembebanan(groupPNCategoryID, groupPNCategoryName, groupProductID, groupProsesRate, groupKemasRate, userId) {
  try {
    const db = await connect();
    const currentYear = new Date().getFullYear().toString();
    const currentDateTime = new Date().toISOString();
    
    // Debug logging
    console.log('addPembebanan SQL function called with parameters:', {
      groupPNCategoryID,
      groupPNCategoryName,
      groupProductID,
      groupProsesRate,
      groupKemasRate,
      userId
    });
    
    // Ensure all string parameters are actually strings
    const categoryId = String(groupPNCategoryID || '');
    const categoryName = String(groupPNCategoryName || '');
    const productId = groupProductID ? String(groupProductID) : null;
    const userIdStr = String(userId || 'GWN');
    
    console.log('Converted parameters for SQL:', {
      categoryId,
      categoryName,
      productId,
      userIdStr,
      prosesRate: groupProsesRate,
      kemasRate: groupKemasRate
    });
    
    const query = `
      INSERT INTO M_COGS_PEMBEBANAN 
      (Group_Periode, Group_PNCategoryID, Group_PNCategory_Name, Group_ProductID, Group_Proses_Rate, Group_Kemas_Rate, user_id, delegated_to, process_date, flag_update, from_update)
      VALUES (@periode, @categoryId, @categoryName, @productId, @prosesRate, @kemasRate, @userId, @delegatedTo, @processDate, @flagUpdate, @fromUpdate)
    `;
    
    const result = await db.request()
      .input('periode', sql.VarChar, currentYear)
      .input('categoryId', sql.VarChar, categoryId)
      .input('categoryName', sql.VarChar, categoryName)
      .input('productId', sql.VarChar, productId)
      .input('prosesRate', sql.Decimal(18,2), groupProsesRate)
      .input('kemasRate', sql.Decimal(18,2), groupKemasRate)
      .input('userId', sql.VarChar, userIdStr)
      .input('delegatedTo', sql.VarChar, userIdStr)
      .input('processDate', sql.DateTime, currentDateTime)
      .input('flagUpdate', sql.VarChar, null)
      .input('fromUpdate', sql.VarChar, null)
      .query(query);
      
    return result;
  } catch (error) {
    console.error('Error executing addPembebanan query:', error);
    throw error;
  }
}

async function updatePembebanan(pkId, groupPNCategoryID, groupPNCategoryName, groupProductID, groupProsesRate, groupKemasRate, userId) {
  try {
    const db = await connect();
    const currentYear = new Date().getFullYear().toString();
    const currentDateTime = new Date().toISOString();
    
    // Debug logging
    console.log('updatePembebanan SQL function called with parameters:', {
      pkId,
      groupPNCategoryID,
      groupPNCategoryName,
      groupProductID,
      groupProsesRate,
      groupKemasRate,
      userId
    });
    
    // Ensure all string parameters are actually strings
    const categoryId = String(groupPNCategoryID || '');
    const categoryName = String(groupPNCategoryName || '');
    const productId = groupProductID ? String(groupProductID) : null;
    const userIdStr = String(userId || 'GWN');
    
    console.log('Converted parameters for SQL update:', {
      categoryId,
      categoryName,
      productId,
      userIdStr,
      prosesRate: groupProsesRate,
      kemasRate: groupKemasRate
    });
    
    const query = `
      UPDATE M_COGS_PEMBEBANAN 
      SET Group_Periode = @periode,
          Group_PNCategoryID = @categoryId,
          Group_PNCategory_Name = @categoryName,
          Group_ProductID = @productId,
          Group_Proses_Rate = @prosesRate,
          Group_Kemas_Rate = @kemasRate,
          user_id = @userId,
          delegated_to = @delegatedTo,
          process_date = @processDate,
          flag_update = @flagUpdate,
          from_update = @fromUpdate
      WHERE pk_id = @pkId
    `;
    
    const result = await db.request()
      .input('pkId', sql.Int, pkId)
      .input('periode', sql.VarChar, currentYear)
      .input('categoryId', sql.VarChar, categoryId)
      .input('categoryName', sql.VarChar, categoryName)
      .input('productId', sql.VarChar, productId)
      .input('prosesRate', sql.Decimal(18,2), groupProsesRate)
      .input('kemasRate', sql.Decimal(18,2), groupKemasRate)
      .input('userId', sql.VarChar, userIdStr)
      .input('delegatedTo', sql.VarChar, userIdStr)
      .input('processDate', sql.DateTime, currentDateTime)
      .input('flagUpdate', sql.VarChar, null)
      .input('fromUpdate', sql.VarChar, null)
      .query(query);
      
    return result;
  } catch (error) {
    console.error('Error executing updatePembebanan query:', error);
    throw error;
  }
}

async function deletePembebanan(pkId) {
  try {
    const db = await connect();
    const query = 'DELETE FROM M_COGS_PEMBEBANAN WHERE pk_id = @pkId';
    const result = await db.request()
      .input('pkId', sql.Int, pkId)
      .query(query);
      
    return result;
  } catch (error) {
    console.error('Error executing deletePembebanan query:', error);
    throw error;
  }
}

async function getMaterial() {
  try {
    const db = await connect();
    const query ='SELECT h.ITEM_ID, h.ITEM_TYPE,m.Item_Name FROM M_COGS_STD_HRG_BAHAN h INNER JOIN m_item_Manufacturing m ON h.ITEM_ID = m.Item_ID';
    const result = await db.request().query(query);
    return result.recordset;
  } catch (error) {
    console.error('Error executing getMaterial query:', error);
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
  getGroupManual,
  addGroup,
  updateGroup,
  deleteGroup,
  getProductName,
  getPembebanan,
  addPembebanan,
  updatePembebanan,
  deletePembebanan,
  getMaterial
};