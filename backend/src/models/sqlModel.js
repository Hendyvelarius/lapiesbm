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
    const result = await db.request().query(`SELECT Item_ID, Item_Name, Item_LastPurchaseUnit, Item_LastPriceCurrency, Item_LastPrice FROM m_Item_Manufacturing WHERE isActive = '1'
      union all select Item_Code, Item_Name,  ud.Code, cur.Curr_Code, Item_LastPrice
      from lapi_gi..v_Item join lapi_gi..m_Unit_Detail ud on ud.PK_ID = Item_LastPriceUnit_Detail_ID
      join lapi_gi..m_currency cur on cur.PK_ID = Item_LastPriceCurrency_ID where len(item_code)=2
      union all select Product_ID, Product_Name, Product_Unit,'IDR',0  
      from m_product where Product_ID in (select PPI_ItemID from vw_COGS_FORMULA_List_detail)
      and Product_ID not in (select Item_Code from lapi_gi..v_Item where LEN(Item_Code)=2)`);
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

async function updateParameter(directLaborPN1, directLaborPN2, fohPN1, fohPN2, depresiasiPN1, depresiasiPN2, rateKwhMesin, userId) {
  try {
    const db = await connect();
    const currentYear = new Date().getFullYear().toString();
    
    // Update the parameter record with new structure - only updating the 7 parameters that will remain
    const updateQuery = `
      UPDATE M_COGS_STD_PARAMETER 
      SET 
        Periode = @periode,
        Direct_Labor_PN1 = @directLaborPN1,
        Direct_Labor_PN2 = @directLaborPN2,
        Factory_Over_Head_PN1 = @fohPN1,
        Factory_Over_Head_PN2 = @fohPN2,
        Depresiasi_PN1 = @depresiasiPN1,
        Depresiasi_PN2 = @depresiasiPN2,
        Rate_KWH_Mesin = @rateKwhMesin
    `;
    
    const result = await db.request()
      .input('periode', currentYear)
      .input('directLaborPN1', directLaborPN1)
      .input('directLaborPN2', directLaborPN2)
      .input('fohPN1', fohPN1)
      .input('fohPN2', fohPN2)
      .input('depresiasiPN1', depresiasiPN1)
      .input('depresiasiPN2', depresiasiPN2)
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

async function addGroup(productId, productName, pnCategory, pnCategoryName, manHourPros, manHourPack, rendemen, dept, mhtBB = 0, mhtBK = 0, mhAnalisa = 0, kwhMesin = 0, userId) {
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
        Group_MHT_BB,
        Group_MHT_BK,
        Group_MH_Analisa,
        Group_KWH_Mesin,
        user_id
      ) VALUES (
        @productId,
        @pnCategory,
        @pnCategoryName,
        @manHourPros,
        @manHourPack,
        @rendemen,
        @dept,
        @mhtBB,
        @mhtBK,
        @mhAnalisa,
        @kwhMesin,
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
      .input('mhtBB', sql.Decimal(10,2), mhtBB)
      .input('mhtBK', sql.Decimal(10,2), mhtBK)
      .input('mhAnalisa', sql.Decimal(10,2), mhAnalisa)
      .input('kwhMesin', sql.Decimal(10,2), kwhMesin)
      .input('userId', sql.NVarChar, userId || null)
      .query(query);
    
    return { success: true, message: 'Group added successfully' };
  } catch (error) {
    console.error('Error executing addGroup query:', error);
    throw error;
  }
}

async function updateGroup(id, productId, productName, pnCategory, pnCategoryName, manHourPros, manHourPack, rendemen, dept, mhtBB = 0, mhtBK = 0, mhAnalisa = 0, kwhMesin = 0, userId) {
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
        Group_Dept = @dept,
        Group_MHT_BB = @mhtBB,
        Group_MHT_BK = @mhtBK,
        Group_MH_Analisa = @mhAnalisa,
        Group_KWH_Mesin = @kwhMesin
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
      .input('mhtBB', mhtBB)
      .input('mhtBK', mhtBK)
      .input('mhAnalisa', mhAnalisa)
      .input('kwhMesin', kwhMesin)
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

async function addPembebanan(groupPNCategoryID, groupPNCategoryName, groupProductID, groupProsesRate, groupKemasRate, groupGenerikRate, groupAnalisaRate, tollFee, userId) {
  try {
    const db = await connect();
    const currentYear = new Date().getFullYear().toString();
    const currentDateTime = new Date().toISOString();
    
    // Ensure all string parameters are actually strings
    const categoryId = String(groupPNCategoryID || '');
    const categoryName = String(groupPNCategoryName || '');
    const productId = groupProductID ? String(groupProductID) : null;
    const userIdStr = String(userId || 'GWN');
    
    const query = `
      INSERT INTO M_COGS_PEMBEBANAN 
      (Group_Periode, Group_PNCategoryID, Group_PNCategory_Name, Group_ProductID, Group_Proses_Rate, Group_Kemas_Rate, Group_Generik_Rate, Group_Analisa_Rate, Toll_Fee, user_id, delegated_to, process_date, flag_update, from_update)
      VALUES (@periode, @categoryId, @categoryName, @productId, @prosesRate, @kemasRate, @generikRate, @analisaRate, @tollFee, @userId, @delegatedTo, @processDate, @flagUpdate, @fromUpdate)
    `;
    
    const result = await db.request()
      .input('periode', sql.VarChar, currentYear)
      .input('categoryId', sql.VarChar, categoryId)
      .input('categoryName', sql.VarChar, categoryName)
      .input('productId', sql.VarChar, productId)
      .input('prosesRate', sql.Decimal(18,2), groupProsesRate)
      .input('kemasRate', sql.Decimal(18,2), groupKemasRate)
      .input('generikRate', sql.Decimal(18,2), groupGenerikRate)
      .input('analisaRate', sql.Decimal(18,2), groupAnalisaRate)
      .input('tollFee', sql.Decimal(18,2), tollFee)
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

async function updatePembebanan(pkId, groupPNCategoryID, groupPNCategoryName, groupProductID, groupProsesRate, groupKemasRate, groupGenerikRate, groupAnalisaRate, tollFee, userId) {
  try {
    const db = await connect();
    const currentYear = new Date().getFullYear().toString();
    const currentDateTime = new Date().toISOString();
    
    // Ensure all string parameters are actually strings
    const categoryId = String(groupPNCategoryID || '');
    const categoryName = String(groupPNCategoryName || '');
    const productId = groupProductID ? String(groupProductID) : null;
    const userIdStr = String(userId || 'GWN');
    
    const query = `
      UPDATE M_COGS_PEMBEBANAN 
      SET Group_Periode = @periode,
          Group_PNCategoryID = @categoryId,
          Group_PNCategory_Name = @categoryName,
          Group_ProductID = @productId,
          Group_Proses_Rate = @prosesRate,
          Group_Kemas_Rate = @kemasRate,
          Group_Generik_Rate = @generikRate,
          Group_Analisa_Rate = @analisaRate,
          Toll_Fee = @tollFee,
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
      .input('generikRate', sql.Decimal(18,2), groupGenerikRate)
      .input('analisaRate', sql.Decimal(18,2), groupAnalisaRate)
      .input('tollFee', sql.Decimal(18,2), tollFee)
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
    const query = 'SELECT h.ITEM_ID, h.ITEM_TYPE, m.Item_Name, m.Item_Unit, dbo.fnConvertBJ(h.ITEM_ID,1,item_purchase_unit, m.Item_Unit)*h.ITEM_PURCHASE_STD_PRICE Unit_Price FROM M_COGS_STD_HRG_BAHAN h INNER JOIN m_item_Manufacturing m ON h.ITEM_ID = m.Item_ID WHERE h.ITEM_ID NOT LIKE \'(NONE)\'';
    const result = await db.request().query(query);
    return result.recordset;
  } catch (error) {
    console.error('Error executing getMaterial query:', error);
    throw error;
  }
}

async function getMaterialUsage() {
  try {
    const db = await connect();
    const query = `
      SELECT 
        d.product_id,
        d.item_type,
        d.PPI_ItemID,
        m.Item_Name,
        d.PPI_QTY,
        d.PPI_UnitID,
        ROUND(d.total / d.ppi_qty, 3) AS Item_unit,
        d.total
      FROM t_COGS_HPP_Product_Detail_Formula d
      INNER JOIN m_item_Manufacturing m 
        ON d.PPI_ItemID = m.Item_ID
      ORDER BY d.product_id, d.ITEM_TYPE, d.PPI_ItemID
    `;
    const result = await db.request().query(query);
    return result.recordset;
  } catch (error) {
    console.error('Error executing getMaterialUsage query:', error);
    throw error;
  }
}

async function exportAllFormulaDetail() {
  try {
    const db = await connect();
    const result = await db.request().query('EXEC sp_COGS_generate_all_formula_detail');
    return result.recordset;
  } catch (error) {
    console.error('Error executing exportAllFormulaDetail query:', error);
    throw error;
  }
}

async function exportAllFormulaDetailSumPerSubID() {
  try {
    const db = await connect();
    const result = await db.request().query("EXEC sp_COGS_generate_all_formula_detail 'SumPerSubID'");
    return result.recordset;
  } catch (error) {
    console.error('Error executing exportAllFormulaDetailSumPerSubID query:', error);
    throw error;
  }
}

// === FORMULA MANUAL CUD OPERATIONS ===

async function addFormulaManual(ppiType, ppiSubId, ppiProductId, ppiBatchSize, ppiSeqId, ppiItemId, ppiQty, ppiUnitId, userId) {
  try {
    const db = await connect();
    const currentDateTime = new Date().toISOString();
    
    const query = `
      INSERT INTO M_COGS_FORMULA_MANUAL (
        PPI_Type,
        PPI_SubID,
        PPI_ProductID,
        PPI_BatchSize,
        PPI_SeqID,
        PPI_ItemID,
        PPI_QTY,
        PPI_UnitID,
        user_id,
        delegated_to,
        process_date,
        flag_update,
        from_update
      ) VALUES (
        @ppiType,
        @ppiSubId,
        @ppiProductId,
        @ppiBatchSize,
        @ppiSeqId,
        @ppiItemId,
        @ppiQty,
        @ppiUnitId,
        @userId,
        @userId,
        @processDate,
        NULL,
        NULL
      )
    `;
    
    const result = await db.request()
      .input('ppiType', ppiType)
      .input('ppiSubId', ppiSubId)
      .input('ppiProductId', ppiProductId)
      .input('ppiBatchSize', ppiBatchSize)
      .input('ppiSeqId', ppiSeqId)
      .input('ppiItemId', ppiItemId)
      .input('ppiQty', ppiQty)
      .input('ppiUnitId', ppiUnitId)
      .input('userId', userId)
      .input('processDate', currentDateTime)
      .query(query);
      
    return {
      success: true,
      rowsAffected: result.rowsAffected[0],
      insertedAt: currentDateTime
    };
  } catch (error) {
    console.error('Error executing addFormulaManual query:', error);
    throw error;
  }
}

async function addBatchFormulaManual(ppiType, ppiSubId, ppiProductId, ppiBatchSize, ingredients, userId) {
  try {
    const db = await connect();
    const currentDateTime = new Date().toISOString();
    
    // Build the VALUES clause for multiple ingredients
    const valuesClauses = ingredients.map((_, index) => `(
      @ppiType,
      @ppiSubId,
      @ppiProductId,
      @ppiBatchSize,
      @ppiSeqId${index},
      @ppiItemId${index},
      @ppiQty${index},
      @ppiUnitId${index},
      @userId,
      @userId,
      @processDate,
      NULL,
      NULL
    )`).join(',');
    
    const query = `
      INSERT INTO M_COGS_FORMULA_MANUAL (
        PPI_Type,
        PPI_SubID,
        PPI_ProductID,
        PPI_BatchSize,
        PPI_SeqID,
        PPI_ItemID,
        PPI_QTY,
        PPI_UnitID,
        user_id,
        delegated_to,
        process_date,
        flag_update,
        from_update
      ) VALUES ${valuesClauses}
    `;
    
    const request = db.request()
      .input('ppiType', ppiType)
      .input('ppiSubId', ppiSubId)
      .input('ppiProductId', ppiProductId)
      .input('ppiBatchSize', ppiBatchSize)
      .input('userId', userId)
      .input('processDate', currentDateTime);
    
    // Add parameters for each ingredient
    ingredients.forEach((ingredient, index) => {
      request
        .input(`ppiSeqId${index}`, ingredient.seqId)
        .input(`ppiItemId${index}`, ingredient.itemId)
        .input(`ppiQty${index}`, ingredient.qty)
        .input(`ppiUnitId${index}`, ingredient.unitId);
    });
    
    const result = await request.query(query);
      
    return {
      success: true,
      rowsAffected: result.rowsAffected[0],
      ingredientsAdded: ingredients.length,
      insertedAt: currentDateTime
    };
  } catch (error) {
    console.error('Error executing addBatchFormulaManual query:', error);
    throw error;
  }
}

async function updateFormulaManual(ppiType, ppiSubId, ppiProductId, originalSeqId, ppiSeqId, ppiItemId, ppiQty, ppiUnitId, userId) {
  try {
    const db = await connect();
    const currentDateTime = new Date().toISOString();
    
    const query = `
      UPDATE M_COGS_FORMULA_MANUAL 
      SET 
        PPI_SeqID = @ppiSeqId,
        PPI_ItemID = @ppiItemId,
        PPI_QTY = @ppiQty,
        PPI_UnitID = @ppiUnitId,
        user_id = @userId,
        delegated_to = @userId,
        process_date = @processDate,
        flag_update = 1,
        from_update = 'MANUAL'
      WHERE PPI_Type = @ppiType 
        AND PPI_SubID = @ppiSubId 
        AND PPI_ProductID = @ppiProductId 
        AND PPI_SeqID = @originalSeqId
    `;
    
    const result = await db.request()
      .input('ppiType', ppiType)
      .input('ppiSubId', ppiSubId)
      .input('ppiProductId', ppiProductId)
      .input('originalSeqId', originalSeqId)
      .input('ppiSeqId', ppiSeqId)
      .input('ppiItemId', ppiItemId)
      .input('ppiQty', ppiQty)
      .input('ppiUnitId', ppiUnitId)
      .input('userId', userId)
      .input('processDate', currentDateTime)
      .query(query);
    
    if (result.rowsAffected[0] === 0) {
      throw new Error('No record found with the provided identifiers');
    }
      
    return {
      success: true,
      rowsAffected: result.rowsAffected[0],
      updatedAt: currentDateTime
    };
  } catch (error) {
    console.error('Error executing updateFormulaManual query:', error);
    throw error;
  }
}

async function deleteFormulaManual(ppiType, ppiSubId, ppiProductId, ppiSeqId) {
  try {
    const db = await connect();
    
    const query = `
      DELETE FROM M_COGS_FORMULA_MANUAL 
      WHERE PPI_Type = @ppiType 
        AND PPI_SubID = @ppiSubId 
        AND PPI_ProductID = @ppiProductId 
        AND PPI_SeqID = @ppiSeqId
    `;
    
    const result = await db.request()
      .input('ppiType', ppiType)
      .input('ppiSubId', ppiSubId)
      .input('ppiProductId', ppiProductId)
      .input('ppiSeqId', ppiSeqId)
      .query(query);
    
    if (result.rowsAffected[0] === 0) {
      throw new Error('No record found with the provided identifiers');
    }
      
    return {
      success: true,
      rowsAffected: result.rowsAffected[0]
    };
  } catch (error) {
    console.error('Error executing deleteFormulaManual query:', error);
    throw error;
  }
}

async function deleteEntireFormulaManual(ppiType, ppiSubId, ppiProductId) {
  try {
    const db = await connect();
    
    const query = `
      DELETE FROM M_COGS_FORMULA_MANUAL 
      WHERE PPI_Type = @ppiType 
        AND PPI_SubID = @ppiSubId 
        AND PPI_ProductID = @ppiProductId
    `;
    
    const result = await db.request()
      .input('ppiType', ppiType)
      .input('ppiSubId', ppiSubId)
      .input('ppiProductId', ppiProductId)
      .query(query);
      
    return {
      success: true,
      rowsAffected: result.rowsAffected[0]
    };
  } catch (error) {
    console.error('Error executing deleteEntireFormulaManual query:', error);
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
  getMaterial,
  getMaterialUsage,
  exportAllFormulaDetail,
  exportAllFormulaDetailSumPerSubID,
  addFormulaManual,
  addBatchFormulaManual,
  updateFormulaManual,
  deleteFormulaManual,
  deleteEntireFormulaManual
};