const { connect } = require('../../config/sqlserver');
const sql = require('mssql');

// Get current datetime in WIB (GMT+7) for SQL Server storage
// The mssql driver serializes Date objects using UTC (getUTCHours, etc.),
// so we offset the epoch by +7h so the stored UTC value equals WIB time.
function getWIBDateTime() {
    const now = new Date();
    return new Date(now.getTime() + (7 * 60 * 60 * 1000));
}

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

async function getChosenFormula(periode = null) {
    try {
        const pool = await connect();
        let query = 'SELECT * FROM M_COGS_PRODUCT_FORMULA_FIX';
        
        if (periode) {
            query += ' WHERE Periode = @periode';
            const result = await pool.request()
                .input('periode', sql.VarChar, periode)
                .query(query);
            return result.recordset;
        }
        
        const result = await pool.request().query(query);
        return result.recordset;
    } catch (error) {
        console.error('Error fetching chosen formula:', error);
        throw error;
    }
}

// Get available years from formula assignments
async function getAvailableYears() {
    try {
        const pool = await connect();
        const result = await pool.request().query(
            'SELECT DISTINCT Periode FROM M_COGS_PRODUCT_FORMULA_FIX ORDER BY Periode DESC'
        );
        return result.recordset.map(row => row.Periode);
    } catch (error) {
        console.error('Error fetching available years:', error);
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
async function addChosenFormula(productId, pi, ps, kp, ks, stdOutput, userId, isManual, periode = null, delegatedTo = null) {
    try {
        const pool = await connect();
        const targetYear = periode || new Date().getFullYear().toString();
        const currentDateTime = getWIBDateTime();
        const finalUserId = userId || 'SYSTEM';
        const finalDelegatedTo = delegatedTo || null;
        
        const query = `
            INSERT INTO M_COGS_PRODUCT_FORMULA_FIX 
            (Periode, Product_ID, PI, PS, KP, KS, Std_Output, user_id, delegated_to, process_date, isManual)
            VALUES (@periode, @productId, @pi, @ps, @kp, @ks, @stdOutput, @userId, @delegatedTo, @processDate, @isManual)
        `;
        
        const result = await pool.request()
            .input('periode', sql.VarChar, targetYear)
            .input('productId', sql.VarChar, productId)
            .input('pi', sql.VarChar, pi === null ? null : (pi || ''))
            .input('ps', sql.VarChar, ps === null ? null : (ps || ''))
            .input('kp', sql.VarChar, kp === null ? null : (kp || ''))
            .input('ks', sql.VarChar, ks === null ? null : (ks || ''))
            .input('stdOutput', sql.Decimal(18,2), stdOutput || 0)
            .input('userId', sql.VarChar, finalUserId)
            .input('delegatedTo', sql.VarChar, finalDelegatedTo)
            .input('processDate', sql.DateTime, currentDateTime)
            .input('isManual', sql.Int, isManual)
            .query(query);
            
        return result;
    } catch (error) {
        console.error('Error adding chosen formula:', error);
        throw error;
    }
}

// Update chosen formula record
async function updateChosenFormula(productId, pi, ps, kp, ks, stdOutput, userId, isManual, periode = null, delegatedTo = null) {
    try {
        const pool = await connect();
        const targetYear = periode || new Date().getFullYear().toString();
        const currentDateTime = getWIBDateTime();
        const finalUserId = userId || 'SYSTEM';
        const finalDelegatedTo = delegatedTo || null;
        
        const query = `
            UPDATE M_COGS_PRODUCT_FORMULA_FIX 
            SET PI = @pi,
                PS = @ps,
                KP = @kp,
                KS = @ks,
                Std_Output = @stdOutput,
                user_id = @userId,
                delegated_to = @delegatedTo,
                process_date = @processDate,
                isManual = @isManual
            WHERE Product_ID = @productId AND Periode = @periode
        `;
        
        const result = await pool.request()
            .input('productId', sql.VarChar, productId)
            .input('periode', sql.VarChar, targetYear)
            .input('pi', sql.VarChar, pi === null ? null : (pi || ''))
            .input('ps', sql.VarChar, ps === null ? null : (ps || ''))
            .input('kp', sql.VarChar, kp === null ? null : (kp || ''))
            .input('ks', sql.VarChar, ks === null ? null : (ks || ''))
            .input('stdOutput', sql.Decimal(18,2), stdOutput || 0)
            .input('userId', sql.VarChar, finalUserId)
            .input('delegatedTo', sql.VarChar, finalDelegatedTo)
            .input('processDate', sql.DateTime, currentDateTime)
            .input('isManual', sql.Int, isManual)
            .query(query);
            
        return result;
    } catch (error) {
        console.error('Error updating chosen formula:', error);
        throw error;
    }
}

// Delete chosen formula record
async function deleteChosenFormula(productId, periode = null) {
    try {
        const pool = await connect();
        const targetYear = periode || new Date().getFullYear().toString();
        
        const result = await pool.request()
            .input('productId', sql.VarChar, productId)
            .input('periode', sql.VarChar, targetYear)
            .query('DELETE FROM M_COGS_PRODUCT_FORMULA_FIX WHERE Product_ID = @productId AND Periode = @periode');
            
        return result;
    } catch (error) {
        console.error('Error deleting chosen formula:', error);
        throw error;
    }
}

// periode (YYYY) prices the recipe at that year's material prices and marks the HPP formula from
// that year's Formula Assignment. Without it, the view's own year is used (latest unlocked periode).
async function findRecipe(productId, periode = null) {
    try {
        const pool = await connect();
        const query = periode
            ? `SELECT * FROM dbo.fn_COGS_FORMULA_List_detail_ByPeriode(@periode) WHERE Product_ID = @productId`
            : `SELECT * FROM vw_COGS_FORMULA_List_detail WHERE Product_ID = @productId`;
        const request = pool.request().input('productId', sql.VarChar, productId);
        if (periode) request.input('periode', sql.VarChar(4), String(periode));
        const result = await request.query(query);
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

// periode (YYYY): the formulas assigned in that year's Formula Assignment, priced at that year's
// material prices. Without it, the view's own year is used (latest periode with an unlocked row),
// which is not necessarily the year being validated or generated.
async function getActiveFormulaDetails(periode = null) {
    try {
        const pool = await connect();
        const request = pool.request();
        let query = "SELECT * FROM vw_COGS_FORMULA_List_detail WHERE DefaultCOGS = 'Aktif'";
        if (periode) {
            query = "SELECT * FROM dbo.fn_COGS_FORMULA_List_detail_ByPeriode(@periode) WHERE DefaultCOGS = 'Aktif'";
            request.input('periode', sql.VarChar(4), String(periode));
        }
        const result = await request.query(query);
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
            .query(`DELETE FROM M_COGS_PRODUCT_FORMULA_FIX WHERE Periode = @periode AND isnull(isManual, '') = ''`);
        
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
                    .input('processDate', sql.DateTime, getWIBDateTime())
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
        
        return recommendationArray;
        
    } catch (error) {
        console.error('Error getting formula recommendations:', error);
        throw error;
    }
};

// Bulk import formula assignments (similar to autoAssignFormulas but with provided data)
async function bulkImportFormulas(importData) {
    try {
        const pool = await connect();
        
        // Determine the target periode from the import data
        // All records in importData should have the same Periode
        const targetPeriode = importData.length > 0 ? importData[0].Periode : new Date().getFullYear().toString();

        // Guard: the delete below would also wipe locked rows, so refuse to import into a year
        // that has any locked product. The UI checks this too; this is the authoritative check.
        const lockCheck = await pool.request()
            .input('periode', sql.VarChar, targetPeriode)
            .query(`
                SELECT COUNT(*) AS LockedCount
                FROM M_COGS_PRODUCT_FORMULA_FIX
                WHERE Periode = @periode AND isLock = 1
            `);
        const lockedCount = lockCheck.recordset[0]?.LockedCount || 0;
        if (lockedCount > 0) {
            const lockError = new Error(`Year ${targetPeriode} has ${lockedCount} locked product(s). Unlock them before importing formula assignments for this year.`);
            lockError.code = 'PERIOD_LOCKED';
            throw lockError;
        }

        // Step 1: Clear existing assignments for the TARGET period only
        // IMPORTANT: Only delete products that have at least one non-NULL formula
        // This preserves products with entirely NULL assignments (PI=NULL, PS=NULL, KP=NULL, KS=NULL)
        await pool.request()
            .input('periode', sql.VarChar, targetPeriode)
            .query(`
                DELETE FROM M_COGS_PRODUCT_FORMULA_FIX 
                WHERE Periode = @periode 
                AND (PI IS NOT NULL OR PS IS NOT NULL OR KP IS NOT NULL OR KS IS NOT NULL)
            `);
        
        // Step 2: Bulk insert new assignments
        if (importData.length > 0) {
            const insertPromises = importData.map(assignment => {
                return pool.request()
                    .input('periode', sql.VarChar, assignment.Periode)
                    .input('productId', sql.VarChar, assignment.Product_ID)
                    .input('pi', sql.VarChar, assignment.PI === null ? null : assignment.PI)
                    .input('ps', sql.VarChar, assignment.PS === null ? null : assignment.PS)
                    .input('kp', sql.VarChar, assignment.KP === null ? null : assignment.KP)
                    .input('ks', sql.VarChar, assignment.KS === null ? null : assignment.KS)
                    .input('stdOutput', sql.Decimal(18,2), assignment.Std_Output || 0)
                    .input('isManual', sql.Bit, assignment.isManual)
                    .input('userId', sql.VarChar, assignment.user_id || 'AUTO_ASSIGN')
                    .input('delegatedTo', sql.VarChar, assignment.delegated_to || 'AUTO_ASSIGN')
                    .input('processDate', sql.DateTime, assignment.process_date ? new Date(assignment.process_date) : getWIBDateTime())
                    .input('flagUpdate', sql.VarChar, assignment.flag_update)
                    .input('fromUpdate', sql.VarChar, assignment.from_update)
                    .query(`
                        INSERT INTO M_COGS_PRODUCT_FORMULA_FIX 
                        (Periode, Product_ID, PI, PS, KP, KS, Std_Output, isManual, user_id, delegated_to, process_date, flag_update, from_update)
                        VALUES 
                        (@periode, @productId, @pi, @ps, @kp, @ks, @stdOutput, @isManual, @userId, @delegatedTo, @processDate, @flagUpdate, @fromUpdate)
                    `);
            });
            
            await Promise.all(insertPromises);
        }
        
        return {
            processed: importData.length,
            message: `Successfully imported ${importData.length} formula assignments`
        };
    } catch (error) {
        console.error('Error in bulkImportFormulas:', error);
        throw error;
    }
}

// Trigger an HPP generation from a single product's row.
//
// This used to call sp_COGS_GenerateHPP_perProduct, which has been dropped: its
// header INSERT cross-joined M_COGS_STD_HRG_PARAMETER, a table with no rows past
// 2025, so for any later period the INSERT returned nothing while the preceding
// DELETE still ran - silently destroying the product's header row. There is now
// one generator, sp_COGS_GenerateHPP, which regenerates every UNLOCKED product
// for the period and leaves locked ones untouched.
//
// Note this is no longer scoped to productId: it regenerates all unlocked
// products. productId only decides what we report back to the caller.
async function generateHPP(productId) {
    try {
        const pool = await connect();
        const currentYear = new Date().getFullYear().toString();

        // A locked product is skipped by the generator, so say so rather than
        // reporting a success that changed nothing for the product they clicked.
        const lockCheck = await pool.request()
            .input('periode', sql.VarChar(4), currentYear)
            .input('productId', sql.VarChar(50), productId)
            .query(`SELECT ISNULL(isLock, 0) AS isLock
                    FROM M_COGS_PRODUCT_FORMULA_FIX
                    WHERE product_id = @productId AND Periode = @periode`);

        if (lockCheck.recordset.length === 0) {
            return {
                success: false,
                message: `Product ${productId} has no formula assignment for ${currentYear}, so it cannot be generated.`,
                periode: currentYear,
                productId
            };
        }

        if (lockCheck.recordset[0].isLock) {
            return {
                success: false,
                message: `Product ${productId} is locked for ${currentYear} and was not regenerated. Unlock it first.`,
                periode: currentYear,
                productId
            };
        }

        // Intermediates without a price row would be dropped from their consumers' cost
        await ensureIntermediatePriceRows(currentYear);

        await pool.request()
            .input('periode', sql.VarChar(4), currentYear)
            .query(`exec sp_COGS_GenerateHPP @periode, '0', '1'`);

        return {
            success: true,
            message: `HPP regenerated for all unlocked products in ${currentYear}, including ${productId}.`,
            periode: currentYear,
            productId
        };
    } catch (error) {
        console.error('Error generating HPP:', error);
        throw error;
    }
}

// Lock/Unlock year - update isLock for all formulas in a specific periode
async function lockYear(periode, isLock, userId = null, delegatedTo = null) {
    try {
        const pool = await connect();
        const lockValue = isLock ? 1 : 0;
        const currentDateTime = getWIBDateTime();
        const finalUserId = userId || 'SYSTEM';
        const finalDelegatedTo = delegatedTo || null;
        
        const query = `
            UPDATE M_COGS_PRODUCT_FORMULA_FIX
            SET isLock = @isLock,
                user_id = @userId,
                delegated_to = @delegatedTo,
                process_date = @processDate
            WHERE Periode = @periode
        `;
        
        const result = await pool.request()
            .input('periode', sql.VarChar, periode)
            .input('isLock', sql.Int, lockValue)
            .input('userId', sql.VarChar, finalUserId)
            .input('delegatedTo', sql.VarChar, finalDelegatedTo)
            .input('processDate', sql.DateTime, currentDateTime)
            .query(query);
            
        return {
            success: true,
            rowsAffected: result.rowsAffected[0],
            periode: periode,
            locked: isLock
        };
    } catch (error) {
        console.error('Error locking/unlocking year:', error);
        throw error;
    }
}

// Lock/Unlock individual product - update isLock for a specific product in a periode
async function lockProduct(productId, periode, isLock, userId = null, delegatedTo = null) {
    try {
        const pool = await connect();
        const lockValue = isLock ? 1 : 0;
        const currentDateTime = getWIBDateTime();
        const finalUserId = userId || 'SYSTEM';
        const finalDelegatedTo = delegatedTo || null;
        
        const query = `
            UPDATE M_COGS_PRODUCT_FORMULA_FIX
            SET isLock = @isLock,
                user_id = @userId,
                delegated_to = @delegatedTo,
                process_date = @processDate
            WHERE Product_ID = @productId AND Periode = @periode
        `;
        
        const result = await pool.request()
            .input('productId', sql.VarChar, productId)
            .input('periode', sql.VarChar, periode)
            .input('isLock', sql.Int, lockValue)
            .input('userId', sql.VarChar, finalUserId)
            .input('delegatedTo', sql.VarChar, finalDelegatedTo)
            .input('processDate', sql.DateTime, currentDateTime)
            .query(query);
            
        return {
            success: true,
            rowsAffected: result.rowsAffected[0],
            productId: productId,
            periode: periode,
            locked: isLock
        };
    } catch (error) {
        console.error('Error locking/unlocking product:', error);
        throw error;
    }
}

// Get default year based on lock status
// Returns the oldest year that has at least one unlocked product
// If all years are fully locked or unlocked, returns the latest year
async function getDefaultYear() {
    try {
        const pool = await connect();
        
        // Get all distinct periods with their lock statistics
        const query = `
            SELECT 
                Periode,
                COUNT(*) as TotalProducts,
                SUM(CASE WHEN isLock = 1 THEN 1 ELSE 0 END) as LockedProducts,
                SUM(CASE WHEN isLock = 0 OR isLock IS NULL THEN 1 ELSE 0 END) as UnlockedProducts
            FROM M_COGS_PRODUCT_FORMULA_FIX
            GROUP BY Periode
            ORDER BY Periode ASC
        `;
        
        const result = await pool.request().query(query);
        const periodeStats = result.recordset;
        
        if (periodeStats.length === 0) {
            // No formula assignments exist, return current year
            return new Date().getFullYear().toString();
        }
        
        // Find the oldest year that has at least one unlocked product
        const oldestUnlockedYear = periodeStats.find(stat => stat.UnlockedProducts > 0);
        
        if (oldestUnlockedYear) {
            // Found a year with unlocked products
            return oldestUnlockedYear.Periode;
        }
        
        // All years are fully locked, return the latest year
        const latestYear = periodeStats[periodeStats.length - 1];
        return latestYear.Periode;
        
    } catch (error) {
        console.error('Error getting default year:', error);
        throw error;
    }
}

// Get locked products for a specific period
// Returns a lightweight list of just Product_IDs that are locked
async function getLockedProducts(periode) {
    try {
        const pool = await connect();
        
        const query = `
            SELECT Product_ID
            FROM M_COGS_PRODUCT_FORMULA_FIX
            WHERE Periode = @periode AND isLock = 1
        `;
        
        const result = await pool.request()
            .input('periode', sql.VarChar, periode)
            .query(query);
            
        // Return just an array of Product_IDs for lightweight response
        return result.recordset.map(row => row.Product_ID);
        
    } catch (error) {
        console.error('Error getting locked products:', error);
        throw error;
    }
}

// ---- Intermediates (granulat / pelarut / WFI) -------------------------------------------------
// Some materials are themselves products made in-house: e.g. FW "PELARUT ANFUROX INJEKSI" is a
// KS line of FP. sp_COGS_GenerateHPP costs them in the same run: after every unlocked product is
// costed, it writes each intermediate's HPP into (a) its M_COGS_STD_HRG_BAHAN row for the year and
// (b) the consuming products' t_COGS_HPP_Product_Detail_Formula lines (#tmp_utk_granul).
//
// Both writes are UPDATEs, and the line costing before them INNER JOINs the year's price table.
// So an intermediate with no price row for the year is silently DROPPED from its consumers'
// cost, and nobody can enter a "price" for it because its price is its own HPP.
// Fix: before generating, give such intermediates a 0-price placeholder row for the year, which
// the SP then overwrites with the computed HPP (what HO/FW had for 2026).
//
// INTERMEDIATE_RULE must stay identical to the #tmp_utk_granul filter in sp_COGS_GenerateHPP.
const INTERMEDIATE_RULE = `(p.Product_Name LIKE '%granulat%' OR p.Product_Name LIKE '%pelarut%' OR p.Product_ID IN ('H4','CQ'))`;

// Intermediates used by the year's UNLOCKED Formula Assignment (the products a generate recosts).
// One entry per intermediate material: itemId (as written in formulas), productId/Name,
// consumers, unit (the consumers' formula unit), itemType, assigned/locked (its own Formula
// Assignment for the year - it can only be costed when assigned and unlocked), hasPrice.
async function getIntermediatesInUse(periode) {
    try {
        const pool = await connect();
        const result = await pool.request()
            .input('periode', sql.VarChar(4), String(periode))
            .query(`
                SELECT d.PPI_ItemID AS Item_ID, p.Product_ID, p.Product_Name,
                       d.Product_ID AS Consumer_ID, d.TypeCode, d.PPI_UnitID,
                       CASE WHEN own.Product_ID IS NULL THEN 0 ELSE 1 END AS Assigned,
                       ISNULL(own.isLock, 0) AS Own_IsLock,
                       CASE WHEN price.ITEM_ID IS NULL THEN 0 ELSE 1 END AS Has_Price,
                       prev.ITEM_TYPE AS Prev_Item_Type
                FROM vw_COGS_FORMULA_List_detail d
                JOIN M_COGS_PRODUCT_FORMULA_FIX f
                  ON f.Product_ID = d.Product_ID AND f.Periode = @periode AND ISNULL(f.isLock, 0) = 0
                 AND (   (d.TypeCode = 'PI' AND d.PPI_SubID = f.PI) OR (d.TypeCode = 'PS' AND d.PPI_SubID = f.PS)
                      OR (d.TypeCode = 'KP' AND d.PPI_SubID = f.KP) OR (d.TypeCode = 'KS' AND d.PPI_SubID = f.KS))
                JOIN m_product p ON p.Product_ID = REPLACE(d.PPI_ItemID, ' ', '')
                LEFT JOIN M_COGS_PRODUCT_FORMULA_FIX own ON own.Product_ID = p.Product_ID AND own.Periode = @periode
                OUTER APPLY (SELECT TOP 1 h.ITEM_ID FROM M_COGS_STD_HRG_BAHAN h
                             WHERE h.ITEM_ID = d.PPI_ItemID AND h.Periode = @periode) price
                OUTER APPLY (SELECT TOP 1 h.ITEM_TYPE FROM M_COGS_STD_HRG_BAHAN h
                             WHERE h.ITEM_ID = d.PPI_ItemID AND h.Periode < @periode ORDER BY h.Periode DESC) prev
                WHERE ${INTERMEDIATE_RULE}
            `);

        const byItem = new Map();
        for (const r of result.recordset) {
            if (!byItem.has(r.Item_ID)) {
                byItem.set(r.Item_ID, {
                    itemId: r.Item_ID,
                    productId: r.Product_ID,
                    productName: r.Product_Name,
                    consumers: [],
                    unit: r.PPI_UnitID,
                    itemType: r.Prev_Item_Type || (['PI', 'PS'].includes(r.TypeCode) ? 'BB' : 'BK'),
                    assigned: r.Assigned === 1,
                    locked: r.Own_IsLock === 1 || r.Own_IsLock === true,
                    hasPrice: r.Has_Price === 1
                });
            }
            const entry = byItem.get(r.Item_ID);
            if (!entry.consumers.includes(r.Consumer_ID)) entry.consumers.push(r.Consumer_ID);
        }
        return [...byItem.values()];
    } catch (error) {
        console.error('Error getting intermediates in use:', error);
        throw error;
    }
}

// Create the 0-price placeholder rows described above, for intermediates that will be costed in
// this generate (assigned + unlocked) but have no price row for the year. Returns the item IDs created.
async function ensureIntermediatePriceRows(periode) {
    const pool = await connect();
    const missing = (await getIntermediatesInUse(periode))
        .filter(i => !i.hasPrice && i.assigned && !i.locked);
    const created = [];
    for (const i of missing) {
        const now = getWIBDateTime();
        const r = await pool.request()
            .input('itemId', sql.VarChar(50), i.itemId)
            .input('itemType', sql.VarChar(10), i.itemType)
            .input('unit', sql.VarChar(50), i.unit)
            .input('periode', sql.VarChar(4), String(periode))
            .input('now', sql.DateTime, now)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM M_COGS_STD_HRG_BAHAN WHERE ITEM_ID = @itemId AND Periode = @periode)
                INSERT INTO M_COGS_STD_HRG_BAHAN
                    (ITEM_ID, ITEM_TYPE, ITEM_PURCHASE_UNIT, ITEM_PURCHASE_STD_PRICE, ITEM_CURRENCY, Periode,
                     user_id, delegated_to, process_date, flag_update, from_update, createdAt, updatedAt)
                VALUES (@itemId, @itemType, @unit, 0, 'IDR', @periode,
                        'SYSTEM', 'AUTO_INTERMEDIATE', @now, NULL, NULL, @now, @now)
            `);
        if (r.rowsAffected[0] > 0) created.push(i.itemId);
    }
    if (created.length) {
        console.log(`[HPP ${periode}] created placeholder price rows for intermediates: ${created.join(', ')}`);
    }
    return created;
}

// Manhour & Yield check for the products a generate recosts (the year's UNLOCKED Formula Assignment).
// sp_COGS_GenerateHPP computes each intermediate's HPP as cost / (Batch_Size * Group_Rendemen / 100)
// with no zero guard, so ONE intermediate with rendemen 0 (or blank, the view turns NULL into 0) makes
// the whole generate fail with "Divide by zero". Other products don't crash it but get HPP 0 in
// sp_COGS_HPP_List, and products with no Manhour & Yield row for the year are left out entirely
// (the SP inner-joins vw_COGS_Product_Group).
async function getYieldCheck(periode) {
    try {
        const pool = await connect();
        const result = await pool.request()
            .input('periode', sql.VarChar(4), String(periode))
            .query(`
                SELECT f.Product_ID, p.Product_Name, f.Std_Output AS Batch_Size,
                       CASE WHEN ${INTERMEDIATE_RULE} THEN 1 ELSE 0 END AS Is_Intermediate,
                       CASE WHEN g.Group_ProductID IS NULL THEN 0 ELSE 1 END AS In_Yield,
                       g.Group_Rendemen
                FROM M_COGS_PRODUCT_FORMULA_FIX f
                JOIN m_product p ON p.Product_ID = f.Product_ID
                OUTER APPLY (SELECT TOP 1 v.Group_ProductID, v.Group_Rendemen FROM vw_COGS_Product_Group v
                             WHERE v.Group_ProductID = f.Product_ID AND v.Periode = @periode) g
                WHERE f.Periode = @periode AND ISNULL(f.isLock, 0) = 0
            `);
        return result.recordset.map(r => ({
            productId: r.Product_ID,
            productName: r.Product_Name,
            batchSize: r.Batch_Size === null ? null : Number(r.Batch_Size),
            isIntermediate: r.Is_Intermediate === 1,
            inYield: r.In_Yield === 1,
            rendemen: r.Group_Rendemen === null ? null : Number(r.Group_Rendemen)
        }));
    } catch (error) {
        console.error('Error getting yield check:', error);
        throw error;
    }
}

// Year readiness: row counts of every year-scoped dataset for one periode.
// Pages use this to explain WHY something is empty for a year (e.g. 2027 margins are saved
// but the Margin view only lists years that exist in Manhour & Yield).
// Keys must match YEAR_DATASETS in frontend/src/utils/yearReadiness.js.
async function getYearReadiness(periode) {
    try {
        const pool = await connect();
        const result = await pool.request()
            .input('periode', sql.VarChar(10), String(periode))
            .query(`
                SELECT
                    (SELECT COUNT(*) FROM vw_COGS_Product_Group           WHERE Periode = @periode)       AS manhourYield,
                    (SELECT COUNT(*) FROM M_COGS_STD_HRG_BAHAN            WHERE Periode = @periode)       AS materialPrices,
                    (SELECT COUNT(*) FROM vw_COGS_Currency_List           WHERE Periode = @periode)       AS exchangeRates,
                    (SELECT COUNT(*) FROM M_COGS_PRODUCT_FORMULA_FIX      WHERE Periode = @periode)       AS formulaAssignments,
                    (SELECT COUNT(*) FROM M_COGS_PEMBEBANAN               WHERE Group_Periode = @periode) AS rates,
                    (SELECT COUNT(*) FROM M_COGS_RATE_GENERAL_per_SEDIAAN WHERE Periode = @periode)       AS generalCosts,
                    (SELECT COUNT(*) FROM M_COGS_PEMBEBANAN_TollFee       WHERE Periode = @periode)       AS margins,
                    (SELECT COUNT(*) FROM M_COGS_PEMBEBANAN_Reagen        WHERE periode = @periode)       AS reagen,
                    (SELECT COUNT(*) FROM M_COGS_BEBAN_SISA_BAHAN_EXP     WHERE PERIODE = @periode)       AS expiredMaterials,
                    (SELECT COUNT(*) FROM t_COGS_HPP_Product_Header       WHERE Periode = @periode)       AS hppResults
            `);
        return result.recordset[0];
    } catch (error) {
        console.error('Error getting year readiness:', error);
        throw error;
    }
}

module.exports = {
    getYearReadiness,
    getIntermediatesInUse,
    ensureIntermediatePriceRows,
    getYieldCheck,
    getFormula,
    getChosenFormula,
    getAvailableYears,
    findFormula,
    addChosenFormula,
    updateChosenFormula,
    deleteChosenFormula,
    findRecipe,
    getAllFormulaDetails,
    getActiveFormulaDetails,
    getFormulaProductCost,
    autoAssignFormulas,
    getFormulaRecommendations,
    bulkImportFormulas,
    generateHPP,
    lockYear,
    lockProduct,
    getDefaultYear,
    getLockedProducts
};