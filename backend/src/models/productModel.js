const { connect } = require('../../config/sqlserver');
const sql = require('mssql');

async function getFormula() {
    try {
        const pool = await connect();
        const result = await pool.request().query('SELECT * FROM vw_COGS_FORMULA_List');
        return result.recordset;
    } catch (error) {
        console.error('Error fetching formula:', error);
        throw error;
    }
}

async function getChosenFormula() {
    try {
        const pool = await connect();
        const result = await pool.request().query('SELECT * FROM M_COGS_PRODUCT_FORMULA_FIX');
        return result.recordset;
    } catch (error) {
        console.error('Error fetching chosen formula:', error);
        throw error;
    }
}

async function findFormula(id) {
    try {
        const pool = await connect();
        const result = await pool.request()
            .input('id', sql.VarChar, id)
            .query('SELECT * FROM vw_COGS_FORMULA_List WHERE Product_ID = @id');
        return result.recordset;
    } catch (error) {
        console.error('Error finding formula:', error);
        throw error;
    }
}

// Add chosen formula record
async function addChosenFormula(productId, pi, ps, kp, ks, stdOutput, userId) {
    try {
        const pool = await connect();
        const currentYear = new Date().getFullYear().toString();
        const currentDateTime = new Date();
        
        const query = `
            INSERT INTO M_COGS_PRODUCT_FORMULA_FIX 
            (Periode, Product_ID, PI, PS, KP, KS, Std_Output, user_id, delegated_to, process_date)
            VALUES (@periode, @productId, @pi, @ps, @kp, @ks, @stdOutput, @userId, @delegatedTo, @processDate)
        `;
        
        const result = await pool.request()
            .input('periode', sql.VarChar, currentYear)
            .input('productId', sql.VarChar, productId)
            .input('pi', sql.VarChar, pi === null ? null : (pi || ''))
            .input('ps', sql.VarChar, ps === null ? null : (ps || ''))
            .input('kp', sql.VarChar, kp === null ? null : (kp || ''))
            .input('ks', sql.VarChar, ks === null ? null : (ks || ''))
            .input('stdOutput', sql.Decimal(18,2), stdOutput || 0)
            .input('userId', sql.VarChar, userId || 'SYSTEM')
            .input('delegatedTo', sql.VarChar, userId || 'SYSTEM')
            .input('processDate', sql.DateTime, currentDateTime)
            .query(query);
            
        return result;
    } catch (error) {
        console.error('Error adding chosen formula:', error);
        throw error;
    }
}

// Update chosen formula record
async function updateChosenFormula(productId, pi, ps, kp, ks, stdOutput, userId) {
    try {
        const pool = await connect();
        const currentYear = new Date().getFullYear().toString();
        const currentDateTime = new Date();
        
        const query = `
            UPDATE M_COGS_PRODUCT_FORMULA_FIX 
            SET PI = @pi,
                PS = @ps,
                KP = @kp,
                KS = @ks,
                Std_Output = @stdOutput,
                user_id = @userId,
                delegated_to = @delegatedTo,
                process_date = @processDate
            WHERE Product_ID = @productId AND Periode = @periode
        `;
        
        const result = await pool.request()
            .input('productId', sql.VarChar, productId)
            .input('periode', sql.VarChar, currentYear)
            .input('pi', sql.VarChar, pi === null ? null : (pi || ''))
            .input('ps', sql.VarChar, ps === null ? null : (ps || ''))
            .input('kp', sql.VarChar, kp === null ? null : (kp || ''))
            .input('ks', sql.VarChar, ks === null ? null : (ks || ''))
            .input('stdOutput', sql.Decimal(18,2), stdOutput || 0)
            .input('userId', sql.VarChar, userId || 'SYSTEM')
            .input('delegatedTo', sql.VarChar, userId || 'SYSTEM')
            .input('processDate', sql.DateTime, currentDateTime)
            .query(query);
            
        return result;
    } catch (error) {
        console.error('Error updating chosen formula:', error);
        throw error;
    }
}

// Delete chosen formula record
async function deleteChosenFormula(productId) {
    try {
        const pool = await connect();
        const currentYear = new Date().getFullYear().toString();
        
        const result = await pool.request()
            .input('productId', sql.VarChar, productId)
            .input('periode', sql.VarChar, currentYear)
            .query('DELETE FROM M_COGS_PRODUCT_FORMULA_FIX WHERE Product_ID = @productId AND Periode = @periode');
            
        return result;
    } catch (error) {
        console.error('Error deleting chosen formula:', error);
        throw error;
    }
}

async function findRecipe(productId) {
    try {
        const pool = await connect();
        const query = `
            SELECT * FROM vw_COGS_FORMULA_List_detail WHERE Product_ID = @productId
        `;
        const result = await pool.request()
            .input('productId', sql.VarChar, productId)
            .query(query);
        return result.recordset;
    } catch (error) {
        console.error('Error retrieving recipe:', error);
        throw error;
    }
}

async function getAllFormulaDetails() {
    try {
        const pool = await connect();
        const result = await pool.request().query('SELECT * FROM vw_COGS_FORMULA_List_detail');
        return result.recordset;
    } catch (error) {
        console.error('Error fetching all formula details:', error);
        throw error;
    }
}

async function getActiveFormulaDetails() {
    try {
        const pool = await connect();
        const result = await pool.request()
            .query("SELECT * FROM vw_COGS_FORMULA_List_detail WHERE DefaultCOGS = 'Aktif'");
        return result.recordset;
    } catch (error) {
        console.error('Error fetching active formula details:', error);
        throw error;
    }
}

module.exports = {
    getFormula,
    getChosenFormula,
    findFormula,
    addChosenFormula,
    updateChosenFormula,
    deleteChosenFormula,
    findRecipe,
    getAllFormulaDetails,
    getActiveFormulaDetails
};