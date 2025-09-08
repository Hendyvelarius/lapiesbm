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

async function getFormulaProductCost() {
    try {
        const pool = await connect();
        const result = await pool.request().execute('sp_COGS_get_formula_product_cost');
        return result.recordset;
    } catch (error) {
        console.error('Error executing sp_COGS_get_formula_product_cost:', error);
        throw error;
    }
}

async function autoAssignFormulas() {
    try {
        const pool = await connect();
        
        // Step 1: Get formula cost data
        const costData = await getFormulaProductCost();
        
        // Step 2: Process the data to select the best assignments
        const processedAssignments = processFormulaAssignments(costData);
        
        // Step 3: Clear existing assignments for the current period
        const currentYear = new Date().getFullYear().toString();
        await pool.request()
            .input('periode', sql.VarChar, currentYear)
            .query('DELETE FROM M_COGS_PRODUCT_FORMULA_FIX WHERE Periode = @periode');
        
        // Step 4: Bulk insert new assignments
        if (processedAssignments.length > 0) {
            const insertPromises = processedAssignments.map(assignment => {
                return pool.request()
                    .input('periode', sql.VarChar, currentYear)
                    .input('productId', sql.VarChar, assignment.Product_ID)
                    .input('pi', sql.VarChar, assignment.PI === null ? null : (assignment.PI || ''))
                    .input('ps', sql.VarChar, assignment.PS === null ? null : (assignment.PS || ''))
                    .input('kp', sql.VarChar, assignment.KP === null ? null : (assignment.KP || ''))
                    .input('ks', sql.VarChar, assignment.KS === null ? null : (assignment.KS || ''))
                    .input('stdOutput', sql.Decimal(18,2), assignment.Std_Output || 0)
                    .input('userId', sql.VarChar, 'AUTO_ASSIGN')
                    .input('delegatedTo', sql.VarChar, 'AUTO_ASSIGN')
                    .input('processDate', sql.DateTime, new Date())
                    .query(`
                        INSERT INTO M_COGS_PRODUCT_FORMULA_FIX 
                        (Periode, Product_ID, PI, PS, KP, KS, Std_Output, user_id, delegated_to, process_date)
                        VALUES (@periode, @productId, @pi, @ps, @kp, @ks, @stdOutput, @userId, @delegatedTo, @processDate)
                    `);
            });
            
            await Promise.all(insertPromises);
        }
        
        return {
            processed: processedAssignments.length,
            assignments: processedAssignments
        };
        
    } catch (error) {
        console.error('Error in auto assign formulas:', error);
        throw error;
    }
}

// Helper function to process formula assignments
function processFormulaAssignments(costData) {
    // Group by Product_ID
    const productGroups = {};
    
    costData.forEach(item => {
        if (!productGroups[item.Product_ID]) {
            productGroups[item.Product_ID] = [];
        }
        productGroups[item.Product_ID].push(item);
    });
    
    const finalAssignments = [];
    
    // Process each product group
    for (const [productId, combinations] of Object.entries(productGroups)) {
        // Filter to find the most complete combinations
        const completeCombinations = findMostCompleteCombinations(combinations);
        
        if (completeCombinations.length > 0) {
            // If multiple complete combinations exist, choose the one with highest total value
            const bestCombination = completeCombinations.reduce((best, current) => {
                const bestTotal = calculateTotalValue(best);
                const currentTotal = calculateTotalValue(current);
                return currentTotal > bestTotal ? current : best;
            });
            
            finalAssignments.push(bestCombination);
        }
    }
    
    return finalAssignments;
}

// Helper function to find most complete combinations
function findMostCompleteCombinations(combinations) {
    // Calculate completeness score for each combination
    const scored = combinations.map(combo => ({
        ...combo,
        completeness: calculateCompleteness(combo)
    }));
    
    // Find the maximum completeness score
    const maxCompleteness = Math.max(...scored.map(s => s.completeness));
    
    // Return all combinations with the maximum completeness
    return scored.filter(s => s.completeness === maxCompleteness);
}

// Helper function to calculate completeness (PI, KP, KS are required)
function calculateCompleteness(combination) {
    let score = 0;
    // A formula is valid if it's not null - empty string ("") is a valid formula
    if (combination.PI !== null) score += 1;
    if (combination.KP !== null) score += 1;
    if (combination.KS !== null) score += 1;
    // PS is optional, but we can count it as bonus
    if (combination.PS !== null) score += 0.5;
    return score;
}

// Helper function to calculate total value
function calculateTotalValue(combination) {
    const pi = parseFloat(combination.PI_Val) || 0;
    const ps = parseFloat(combination.PS_Val) || 0;
    const kp = parseFloat(combination.KP_Val) || 0;
    const ks = parseFloat(combination.KS_Val) || 0;
    return pi + ps + kp + ks;
}

// Get formula recommendations for a specific product using stored procedure
const getFormulaRecommendations = async (productId) => {
    const request = new sql.Request();
    
    try {
        // Execute the stored procedure with the specific product ID
        const result = await request.query(`exec sp_COGS_get_formula_product_cost '${productId}'`);
        
        console.log('Formula recommendations result:', result.recordset);
        
        // Group by standard output to create recommendation sets
        const recommendations = {};
        
        result.recordset.forEach(row => {
            const stdOutput = row.Std_Output;
            const key = `batch_${stdOutput}`;
            
            if (!recommendations[key]) {
                recommendations[key] = {
                    stdOutput: stdOutput,
                    productId: row.Product_ID,
                    formulas: {
                        PI: null,
                        PS: null,
                        KP: null,
                        KS: null
                    },
                    totalCost: 0
                };
            }
            
            // Map the formulas based on type - preserve empty strings as valid formulas
            if (row.PI !== null && row.PI !== undefined) recommendations[key].formulas.PI = row.PI;
            if (row.PS !== null && row.PS !== undefined) recommendations[key].formulas.PS = row.PS;
            if (row.KP !== null && row.KP !== undefined) recommendations[key].formulas.KP = row.KP;
            if (row.KS !== null && row.KS !== undefined) recommendations[key].formulas.KS = row.KS;
            
            // Calculate total cost (sum of all type values)
            recommendations[key].totalCost = 
                (parseFloat(row.PI_Val) || 0) +
                (parseFloat(row.PS_Val) || 0) +
                (parseFloat(row.KP_Val) || 0) +
                (parseFloat(row.KS_Val) || 0);
        });
        
        // Convert to array and sort by standard output
        const recommendationArray = Object.values(recommendations).sort((a, b) => a.stdOutput - b.stdOutput);
        
        console.log('Processed recommendations:', recommendationArray);
        return recommendationArray;
        
    } catch (error) {
        console.error('Error getting formula recommendations:', error);
        throw error;
    }
};

module.exports = {
    getFormula,
    getChosenFormula,
    findFormula,
    addChosenFormula,
    updateChosenFormula,
    deleteChosenFormula,
    findRecipe,
    getAllFormulaDetails,
    getActiveFormulaDetails,
    getFormulaProductCost,
    autoAssignFormulas,
    getFormulaRecommendations
};