const { getCurrencyList, getBahan, getHargaBahan, addHargaBahan, updateHargaBahan, deleteHargaBahan, bulkDeleteBBHargaBahan, bulkDeleteBKHargaBahan, bulkInsertHargaBahan, getUnit, getManufacturingItems, getParameter, updateParameter, getGeneralCostsPerSediaan, addGeneralCostPerSediaan, updateGeneralCostPerSediaan, deleteGeneralCostPerSediaan, bulkInsertGeneralCostsPerSediaan, getGroup, addGroup, updateGroup, deleteGroup, getGroupManual, bulkDeleteGenerikGroups, bulkInsertGenerikGroups, getPembebanan, getProductName, addPembebanan, updatePembebanan, deletePembebanan, bulkDeletePembebanانWithProductID, bulkInsertPembebanan, getMaterial, getMaterialUsage, getMaterialUsageByYear, exportAllFormulaDetail, exportAllFormulaDetailSumPerSubID, addFormulaManual, addBatchFormulaManual, updateFormulaManual, deleteFormulaManual, deleteEntireFormulaManual } = require('../models/sqlModel');

class MasterController {
    static async getCurrency(req, res) {
        try {
            const currencyData = await getCurrencyList();
            res.status(200).json(currencyData);
        } catch (error) {
            console.error('Error in currency endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve currency data',
                error: error.message
            });
        }
    }

    static async getBahan(req, res) {
        try {
            const bahanData = await getBahan();
            res.status(200).json(bahanData);
        } catch (error) {
            console.error('Error in bahan endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve bahan data',
                error: error.message
            });
        }
    }

    static async getUnit(req, res) {
        try {
            const unitData = await getUnit();
            res.status(200).json(unitData);
        } catch (error) {
            console.error('Error in unit endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve unit data',
                error: error.message
            });
        }
    }

    static async getManufacturingItems(req, res) {
        try {
            const manufacturingData = await getManufacturingItems();
            res.status(200).json(manufacturingData);
        } catch (error) {
            console.error('Error in manufacturing items endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve manufacturing items data',
                error: error.message
            });
        }
    }

    static async getHargaBahan(req, res) {
        try {
            const hargaBahanData = await getHargaBahan();
            res.status(200).json(hargaBahanData);
        } catch (error) {
            console.error('Error in hargaBahan endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve harga bahan data',
                error: error.message
            });
        }
    }

    static async addHargaBahan(req, res) {
        try {
            const { itemId, itemType, unit, price, currency, rate, userId } = req.body;
            
            // Validate required fields (note: price can be 0, so check for null/undefined specifically)
            if (!itemId || !itemType || !unit || price === null || price === undefined || !currency || !userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: itemId, itemType, unit, price, currency, userId'
                });
            }
            
            // Validate price is a valid number
            if (isNaN(parseFloat(price))) {
                return res.status(400).json({
                    success: false,
                    message: 'Price must be a valid number'
                });
            }
            
            const result = await addHargaBahan(itemId, itemType, unit, price, currency, rate || 1, userId);
            res.status(201).json({
                success: true,
                message: 'Harga bahan added successfully',
                data: result
            });
        } catch (error) {
            console.error('Error in addHargaBahan endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add harga bahan',
                error: error.message
            });
        }
    }

    static async updateHargaBahan(req, res) {
        try {
            const { id } = req.params;
            const { itemType, unit, price, currency, rate, userId } = req.body;
            
            // Validate required fields (note: price can be 0, so check for null/undefined specifically)
            if (!id || !itemType || !unit || price === null || price === undefined || !currency || !userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: id (in URL), itemType, unit, price, currency, userId'
                });
            }
            
            // Validate price is a valid number
            if (isNaN(parseFloat(price))) {
                return res.status(400).json({
                    success: false,
                    message: 'Price must be a valid number'
                });
            }
            
            // Validate ID is a number
            if (isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid ID format. ID must be a number.'
                });
            }
            
            const result = await updateHargaBahan(parseInt(id), itemType, unit, price, currency, rate || 1, userId);
            res.status(200).json({
                success: true,
                message: 'Harga bahan updated successfully',
                data: result
            });
        } catch (error) {
            console.error('Error in updateHargaBahan endpoint:', error);
            if (error.message === 'No record found with the provided ID') {
                return res.status(404).json({
                    success: false,
                    message: 'Harga bahan not found'
                });
            }
            res.status(500).json({
                success: false,
                message: 'Failed to update harga bahan',
                error: error.message
            });
        }
    }

    static async deleteHargaBahan(req, res) {
        try {
            const { id } = req.params;
            
            // Validate required fields
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required parameter: id'
                });
            }
            
            // Validate ID is a number
            if (isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid ID format. ID must be a number.'
                });
            }
            
            const result = await deleteHargaBahan(parseInt(id));
            res.status(200).json({
                success: true,
                message: 'Harga bahan deleted successfully',
                data: result
            });
        } catch (error) {
            console.error('Error in deleteHargaBahan endpoint:', error);
            if (error.message === 'No record found with the provided ID') {
                return res.status(404).json({
                    success: false,
                    message: 'Harga bahan not found'
                });
            }
            res.status(500).json({
                success: false,
                message: 'Failed to delete harga bahan',
                error: error.message
            });
        }
    }

    static async bulkImportBahanBaku(req, res) {
        try {
            const { items } = req.body;
            
            // Validate required fields
            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing or invalid items array'
                });
            }

            // Validate each item - only check for ITEM_ID and that ITEM_TYPE is 'BB'
            const validationErrors = [];
            items.forEach((item, index) => {
                console.log(`Validating item ${index + 1}:`, {
                    ITEM_ID: item.ITEM_ID,
                    ITEM_TYPE: item.ITEM_TYPE,
                    ITEM_PURCHASE_UNIT: item.ITEM_PURCHASE_UNIT,
                    ITEM_PURCHASE_STD_PRICE: item.ITEM_PURCHASE_STD_PRICE,
                    ITEM_CURRENCY: item.ITEM_CURRENCY,
                    ITEM_PRC_ID: item.ITEM_PRC_ID
                });
                
                // Only validate essential fields
                if (!item.ITEM_ID) {
                    validationErrors.push(`Item ${index + 1}: Missing ITEM_ID`);
                    console.log(`Item ${index + 1}: ITEM_ID is missing or empty`);
                }
                if (item.ITEM_TYPE !== 'BB') {
                    validationErrors.push(`Item ${index + 1}: ITEM_TYPE must be 'BB', got: ${item.ITEM_TYPE}`);
                    console.log(`Item ${index + 1}: ITEM_TYPE is not 'BB':`, item.ITEM_TYPE);
                }
                
                // Optional fields - just log for debugging but don't validate
                console.log(`Item ${index + 1} optional fields:`, {
                    hasPurchaseUnit: !!item.ITEM_PURCHASE_UNIT,
                    hasPrice: item.ITEM_PURCHASE_STD_PRICE !== null && item.ITEM_PURCHASE_STD_PRICE !== undefined,
                    hasCurrency: !!item.ITEM_CURRENCY,
                    hasPrcId: !!item.ITEM_PRC_ID
                });
            });

            if (validationErrors.length > 0) {
                console.log('=== VALIDATION ERRORS ===');
                console.log('Total errors:', validationErrors.length);
                validationErrors.forEach(error => console.log('- ' + error));
                console.log('========================');
                
                return res.status(400).json({
                    success: false,
                    message: 'Validation errors',
                    errors: validationErrors
                });
            }

            // Step 1: Bulk delete existing BB records
            const deleteResult = await bulkDeleteBBHargaBahan();
            
            // Step 2: Bulk insert new records
            const insertResult = await bulkInsertHargaBahan(items);
            
            res.status(200).json({
                success: true,
                message: `Successfully imported ${insertResult.rowsInserted} Bahan Baku items`,
                data: {
                    deletedRecords: deleteResult.rowsAffected,
                    insertedRecords: insertResult.rowsInserted
                }
            });
            
        } catch (error) {
            console.error('Error in bulkImportBahanBaku endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to import Bahan Baku data',
                error: error.message
            });
        }
    }

    static async bulkImportBahanKemas(req, res) {
        try {
            const { items } = req.body;
            
            // Validate required fields
            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing or invalid items array'
                });
            }

            // Validate each item - only check for ITEM_ID and that ITEM_TYPE is 'BK'
            const validationErrors = [];
            items.forEach((item, index) => {
                console.log(`Validating BK item ${index + 1}:`, {
                    ITEM_ID: item.ITEM_ID,
                    ITEM_TYPE: item.ITEM_TYPE,
                    ITEM_PURCHASE_UNIT: item.ITEM_PURCHASE_UNIT,
                    ITEM_PURCHASE_STD_PRICE: item.ITEM_PURCHASE_STD_PRICE,
                    ITEM_CURRENCY: item.ITEM_CURRENCY,
                    ITEM_PRC_ID: item.ITEM_PRC_ID
                });
                
                // Only validate essential fields
                if (!item.ITEM_ID) {
                    validationErrors.push(`Item ${index + 1}: Missing ITEM_ID`);
                    console.log(`Item ${index + 1}: ITEM_ID is missing or empty`);
                }
                if (item.ITEM_TYPE !== 'BK') {
                    validationErrors.push(`Item ${index + 1}: ITEM_TYPE must be 'BK', got: ${item.ITEM_TYPE}`);
                    console.log(`Item ${index + 1}: ITEM_TYPE is not 'BK':`, item.ITEM_TYPE);
                }
                
                // Optional fields - just log for debugging but don't validate
                console.log(`Item ${index + 1} optional fields:`, {
                    hasPurchaseUnit: !!item.ITEM_PURCHASE_UNIT,
                    hasPrice: item.ITEM_PURCHASE_STD_PRICE !== null && item.ITEM_PURCHASE_STD_PRICE !== undefined,
                    hasCurrency: !!item.ITEM_CURRENCY,
                    hasPrcId: !!item.ITEM_PRC_ID
                });
            });

            if (validationErrors.length > 0) {
                console.log('=== BK VALIDATION ERRORS ===');
                console.log('Total errors:', validationErrors.length);
                validationErrors.forEach(error => console.log('- ' + error));
                console.log('============================');
                
                return res.status(400).json({
                    success: false,
                    message: 'Validation errors',
                    errors: validationErrors
                });
            }

            // Step 1: Bulk delete existing BK records
            const deleteResult = await bulkDeleteBKHargaBahan();
            
            // Step 2: Bulk insert new records
            const insertResult = await bulkInsertHargaBahan(items);
            
            res.status(200).json({
                success: true,
                message: `Successfully imported ${insertResult.rowsInserted} Bahan Kemas items`,
                data: {
                    deletedRecords: deleteResult.rowsAffected,
                    insertedRecords: insertResult.rowsInserted
                }
            });
            
        } catch (error) {
            console.error('Error in bulkImportBahanKemas endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to import Bahan Kemas data',
                error: error.message
            });
        }
    }

    static async getParameter(req, res) {
        try {
            const parameters = await getParameter();
            res.status(200).json(parameters);
        } catch (error) {
            console.error('Error in getParameter endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve parameters',
                error: error.message
            });
        }
    }

    static async updateParameter(req, res) {
        try {
            const { 
                directLaborPN1, 
                directLaborPN2, 
                fohPN1, 
                fohPN2, 
                depresiasiPN1, 
                depresiasiPN2, 
                rateKwhMesin,
                userId = "system" // Default user if not provided
            } = req.body;
            
            // Validate required fields - all 7 new parameters must be provided
            if (directLaborPN1 === undefined || fohPN1 === undefined || depresiasiPN1 === undefined || 
                rateKwhMesin === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields. At minimum directLaborPN1, fohPN1, depresiasiPN1, and rateKwhMesin must be provided.'
                });
            }
            
            // Validate numeric values for required fields
            const numericFields = {
                directLaborPN1, 
                directLaborPN2, 
                fohPN1, 
                fohPN2, 
                depresiasiPN1, 
                depresiasiPN2, 
                rateKwhMesin
            };
            
            for (const [fieldName, value] of Object.entries(numericFields)) {
                if (value !== null && value !== undefined && isNaN(parseFloat(value))) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid numeric value for field: ${fieldName}`
                    });
                }
            }
            
            const result = await updateParameter(
                parseFloat(directLaborPN1) || 0,
                directLaborPN2 !== null && directLaborPN2 !== undefined ? parseFloat(directLaborPN2) : null,
                parseFloat(fohPN1) || 0,
                fohPN2 !== null && fohPN2 !== undefined ? parseFloat(fohPN2) : null,
                parseFloat(depresiasiPN1) || 0,
                depresiasiPN2 !== null && depresiasiPN2 !== undefined ? parseFloat(depresiasiPN2) : null,
                parseFloat(rateKwhMesin) || 0,
                userId
            );
            
            res.status(200).json({
                success: true,
                message: `Parameters updated successfully for year ${result.periode}`,
                data: result
            });
        } catch (error) {
            console.error('Error in updateParameter endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update parameters',
                error: error.message
            });
        }
    }

    // NEW CONTROLLER METHODS FOR M_COGS_RATE_GENERAL_per_SEDIAAN

    static async getGeneralCostsPerSediaan(req, res) {
        try {
            const generalCosts = await getGeneralCostsPerSediaan();
            res.status(200).json(generalCosts);
        } catch (error) {
            console.error('Error in getGeneralCostsPerSediaan endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve general costs per sediaan',
                error: error.message
            });
        }
    }

    static async addGeneralCostPerSediaan(req, res) {
        try {
            const { 
                periode, 
                directLabor, 
                factoryOverHead, 
                depresiasi, 
                lineProduction, 
                bentukSediaan 
            } = req.body;
            
            // Validate required fields
            if (!periode || !lineProduction || !bentukSediaan) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: periode, lineProduction, and bentukSediaan are required.'
                });
            }
            
            // Validate numeric values
            const numericFields = { directLabor, factoryOverHead, depresiasi };
            for (const [fieldName, value] of Object.entries(numericFields)) {
                if (value !== null && value !== undefined && isNaN(parseFloat(value))) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid numeric value for field: ${fieldName}`
                    });
                }
            }
            
            const result = await addGeneralCostPerSediaan(
                periode,
                parseFloat(directLabor) || 0,
                parseFloat(factoryOverHead) || 0,
                parseFloat(depresiasi) || 0,
                lineProduction,
                bentukSediaan
            );
            
            res.status(201).json({
                success: true,
                message: 'General cost per sediaan added successfully',
                data: result
            });
        } catch (error) {
            console.error('Error in addGeneralCostPerSediaan endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add general cost per sediaan',
                error: error.message
            });
        }
    }

    static async updateGeneralCostPerSediaan(req, res) {
        try {
            const { originalPeriode, originalLineProduction, originalBentukSediaan } = req.params;
            const { 
                periode, 
                directLabor, 
                factoryOverHead, 
                depresiasi, 
                lineProduction, 
                bentukSediaan 
            } = req.body;
            
            // Validate required fields
            if (!originalPeriode || !originalLineProduction || !originalBentukSediaan) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required original keys in params'
                });
            }
            
            if (!periode || !lineProduction || !bentukSediaan) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: periode, lineProduction, and bentukSediaan are required.'
                });
            }
            
            // Validate numeric values
            const numericFields = { directLabor, factoryOverHead, depresiasi };
            for (const [fieldName, value] of Object.entries(numericFields)) {
                if (value !== null && value !== undefined && isNaN(parseFloat(value))) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid numeric value for field: ${fieldName}`
                    });
                }
            }
            
            const originalKeys = {
                periode: originalPeriode,
                lineProduction: originalLineProduction,
                bentukSediaan: originalBentukSediaan
            };
            
            const updatedData = {
                periode,
                directLabor: parseFloat(directLabor) || 0,
                factoryOverHead: parseFloat(factoryOverHead) || 0,
                depresiasi: parseFloat(depresiasi) || 0,
                lineProduction,
                bentukSediaan
            };
            
            const result = await updateGeneralCostPerSediaan(originalKeys, updatedData);
            
            res.status(200).json({
                success: true,
                message: 'General cost per sediaan updated successfully',
                data: result
            });
        } catch (error) {
            console.error('Error in updateGeneralCostPerSediaan endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update general cost per sediaan',
                error: error.message
            });
        }
    }

    static async deleteGeneralCostPerSediaan(req, res) {
        try {
            const { periode, lineProduction, bentukSediaan } = req.params;
            
            if (!periode || !lineProduction || !bentukSediaan) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required parameters: periode, lineProduction, and bentukSediaan are required'
                });
            }
            
            const keys = { periode, lineProduction, bentukSediaan };
            const result = await deleteGeneralCostPerSediaan(keys);
            
            res.status(200).json({
                success: true,
                message: 'General cost per sediaan deleted successfully',
                data: result
            });
        } catch (error) {
            console.error('Error in deleteGeneralCostPerSediaan endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete general cost per sediaan',
                error: error.message
            });
        }
    }

    static async bulkImportGeneralCostsPerSediaan(req, res) {
        try {
            const { items } = req.body;
            
            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing or invalid items array in request body'
                });
            }
            
            // Validate each item
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (!item.periode || !item.lineProduction || !item.bentukSediaan) {
                    return res.status(400).json({
                        success: false,
                        message: `Item ${i + 1}: Missing required fields (periode, lineProduction, bentukSediaan)`
                    });
                }
            }
            
            const result = await bulkInsertGeneralCostsPerSediaan(items);
            
            res.status(200).json({
                success: true,
                message: `Bulk import completed successfully. Deleted: ${result.deleted}, Inserted: ${result.inserted}`,
                data: result
            });
        } catch (error) {
            console.error('Error in bulkImportGeneralCostsPerSediaan endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to bulk import general costs per sediaan',
                error: error.message
            });
        }
    }

    static async getGroup(req, res) {
        try {
            const { periode } = req.query;
            const groups = await getGroup(periode);
            res.status(200).json(groups);
        } catch (error) {
            console.error('Error in getGroup endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve groups',
                error: error.message
            });
        }
    }

    static async getGroupManual(req, res) {
        try {
            const groupManual = await getGroupManual();
            res.status(200).json(groupManual);
        } catch (error) {
            console.error('Error in getGroupManual endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve manual groups',
                error: error.message
            });
        }
    }

    static async addGroup(req, res) {
        try {
            const { 
                productId, 
                productName, 
                pnCategory, 
                pnCategoryName, 
                manHourPros, 
                manHourPack, 
                rendemen, 
                dept,
                mhtBB = 0,
                mhtBK = 0,
                mhAnalisa = 0,
                kwhMesin = 0,
                userId = "system"
            } = req.body;
            
            // Validate required fields - only core product info is required
            if (!productId || !productName || !pnCategory || !pnCategoryName) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: productId, productName, pnCategory, pnCategoryName'
                });
            }
            
            // Validate numeric values for required fields
            if (isNaN(parseInt(pnCategory))) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid numeric value for field: pnCategory'
                });
            }
            
            // Validate optional numeric fields if provided
            const optionalNumericFields = { 
                manHourPros, 
                manHourPack, 
                rendemen,
                mhtBB,
                mhtBK,
                mhAnalisa,
                kwhMesin
            };
            for (const [fieldName, value] of Object.entries(optionalNumericFields)) {
                if (value !== null && value !== undefined && isNaN(parseFloat(value))) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid numeric value for field: ${fieldName}`
                    });
                }
            }
            
            const result = await addGroup(
                productId,
                productName,
                parseInt(pnCategory),
                pnCategoryName,
                manHourPros !== null && manHourPros !== undefined ? parseFloat(manHourPros) : null,
                manHourPack !== null && manHourPack !== undefined ? parseFloat(manHourPack) : null,
                rendemen !== null && rendemen !== undefined ? parseFloat(rendemen) : null,
                dept || null,
                parseFloat(mhtBB),
                parseFloat(mhtBK),
                parseFloat(mhAnalisa),
                parseFloat(kwhMesin),
                userId
            );
            
            res.status(201).json({
                success: true,
                message: 'Group added successfully',
                data: result
            });
        } catch (error) {
            console.error('Error in addGroup endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add group',
                error: error.message
            });
        }
    }

    static async updateGroup(req, res) {
        try {
            const { id } = req.params;
            const { 
                productId, 
                productName, 
                pnCategory, 
                pnCategoryName, 
                manHourPros, 
                manHourPack, 
                rendemen, 
                dept,
                mhtBB = 0,
                mhtBK = 0,
                mhAnalisa = 0,
                kwhMesin = 0,
                userId = "system"
            } = req.body;
            
            // Validate required fields - only core product info and ID are required
            if (!id || !productId || !productName || !pnCategory || !pnCategoryName) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: id (in URL), productId, productName, pnCategory, pnCategoryName'
                });
            }
            
            // Validate ID is a number
            if (isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid ID format. ID must be a number.'
                });
            }
            
            // Validate required numeric value
            if (isNaN(parseInt(pnCategory))) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid numeric value for field: pnCategory'
                });
            }
            
            // Validate optional numeric fields if provided
            const optionalNumericFields = { 
                manHourPros, 
                manHourPack, 
                rendemen,
                mhtBB,
                mhtBK,
                mhAnalisa,
                kwhMesin
            };
            for (const [fieldName, value] of Object.entries(optionalNumericFields)) {
                if (value !== null && value !== undefined && isNaN(parseFloat(value))) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid numeric value for field: ${fieldName}`
                    });
                }
            }
            
            const result = await updateGroup(
                parseInt(id),
                productId,
                productName,
                parseInt(pnCategory),
                pnCategoryName,
                manHourPros !== null && manHourPros !== undefined ? parseFloat(manHourPros) : null,
                manHourPack !== null && manHourPack !== undefined ? parseFloat(manHourPack) : null,
                rendemen !== null && rendemen !== undefined ? parseFloat(rendemen) : null,
                dept || null,
                parseFloat(mhtBB),
                parseFloat(mhtBK),
                parseFloat(mhAnalisa),
                parseFloat(kwhMesin),
                userId
            );
            
            res.status(200).json({
                success: true,
                message: 'Group updated successfully',
                data: result
            });
        } catch (error) {
            console.error('Error in updateGroup endpoint:', error);
            if (error.message === 'No record found with the provided ID') {
                return res.status(404).json({
                    success: false,
                    message: 'Group not found'
                });
            }
            res.status(500).json({
                success: false,
                message: 'Failed to update group',
                error: error.message
            });
        }
    }

    static async deleteGroup(req, res) {
        try {
            const { id } = req.params;
            
            // Validate required fields
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required parameter: id'
                });
            }
            
            // No need to validate as number since we're using productId (string) as the identifier
            
            const result = await deleteGroup(id);
            
            res.status(200).json({
                success: true,
                message: 'Group deleted successfully',
                data: result
            });
        } catch (error) {
            console.error('Error in deleteGroup endpoint:', error);
            if (error.message === 'No record found with the provided ID') {
                return res.status(404).json({
                    success: false,
                    message: 'Group not found'
                });
            }
            res.status(500).json({
                success: false,
                message: 'Failed to delete group',
                error: error.message
            });
        }
    }

    static async bulkImportProductGroupAll(req, res) {
        try {
            const { productData, periode, userId = "SYSTEM" } = req.body;
            
            // Validate required fields
            if (!productData || !Array.isArray(productData) || productData.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required field: productData must be a non-empty array'
                });
            }
            
            if (!periode) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required field: periode (year)'
                });
            }
            
            // Validate each row in the data
            for (let i = 0; i < productData.length; i++) {
                const row = productData[i];
                
                // Check required fields
                if (!row.productId || !row.pnCategory || !row.pnCategoryName) {
                    return res.status(400).json({
                        success: false,
                        message: `Row ${i + 1}: Missing required fields (productId, pnCategory, pnCategoryName)`
                    });
                }
            }
            
            // Call model functions for bulk delete and insert
            const { bulkDeleteProductGroupByPeriode, bulkInsertProductGroup } = require('../models/sqlModel');
            
            // Delete existing data for this periode
            const deleteResult = await bulkDeleteProductGroupByPeriode(periode);
            
            // Insert new data with periode
            const insertResult = await bulkInsertProductGroup(productData, periode, userId);
            
            res.status(200).json({
                success: true,
                message: `Bulk import completed successfully for year ${periode}. Deleted ${deleteResult.rowsAffected} old records, inserted ${insertResult.rowsAffected} new records.`,
                rowsAffected: insertResult.rowsAffected,
                data: {
                    deleted: deleteResult.rowsAffected,
                    inserted: insertResult.rowsAffected,
                    processed: productData.length,
                    periode: periode
                }
            });
            
        } catch (error) {
            console.error('Error in bulkImportProductGroupAll endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to perform bulk import',
                error: error.message
            });
        }
    }

    static async getProductName(req, res) {
        try {
            const result = await getProductName();
            res.status(200).json({
                success: true,
                data: result,
                message: `Found ${result.length} product names`
            });
        } catch (error) {
            console.error('Error in getProductName endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve product name data',
                error: error.message
            });
        }
    }

    static async getPembebanan(req, res) {
        try {
            const result = await getPembebanan();
            res.status(200).json(result);
        } catch (error) {
            console.error('Error in getPembebanan endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve pembebanan data',
                error: error.message
            });
        }
    }

    static async addPembebanan(req, res) {
        try {
            const { 
                groupPNCategoryID, 
                groupPNCategoryName, 
                groupProductID, 
                groupProsesRate, 
                groupKemasRate,
                groupPLNRate,
                groupAnalisaRate,
                groupPNCategoryRateAs
            } = req.body;

            // Validate required fields
            if (!groupPNCategoryID || !groupPNCategoryName || 
                groupProsesRate === undefined || groupKemasRate === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: groupPNCategoryID, groupPNCategoryName, groupProsesRate, groupKemasRate'
                });
            }

            const result = await addPembebanan(
                groupPNCategoryID,
                groupPNCategoryName, 
                groupProductID,
                groupProsesRate,
                groupKemasRate,
                groupPLNRate || null,
                groupAnalisaRate || null,
                'GWN', // Default user for now
                groupPNCategoryRateAs || null
            );

            res.status(201).json({
                success: true,
                message: 'Pembebanan created successfully',
                data: result
            });
        } catch (error) {
            console.error('Error in addPembebanan endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create pembebanan',
                error: error.message
            });
        }
    }

    static async updatePembebanan(req, res) {
        try {
            const { id } = req.params;
            const { 
                groupPNCategoryID, 
                groupPNCategoryName, 
                groupProductID, 
                groupProsesRate, 
                groupKemasRate,
                groupPLNRate,
                groupAnalisaRate,
                groupPNCategoryRateAs
            } = req.body;

            // Validate required fields
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID parameter is required'
                });
            }

            if (!groupPNCategoryID || !groupPNCategoryName || 
                groupProsesRate === undefined || groupKemasRate === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: groupPNCategoryID, groupPNCategoryName, groupProsesRate, groupKemasRate'
                });
            }

            const result = await updatePembebanan(
                parseInt(id),
                groupPNCategoryID,
                groupPNCategoryName, 
                groupProductID,
                groupProsesRate,
                groupKemasRate,
                groupPLNRate || null,
                groupAnalisaRate || null,
                groupPNCategoryRateAs || null,
                'GWN' // Default user for now
            );

            if (result.rowsAffected[0] === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Pembebanan not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Pembebanan updated successfully',
                data: result
            });
        } catch (error) {
            console.error('Error in updatePembebanan endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update pembebanan',
                error: error.message
            });
        }
    }

    static async deletePembebanan(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID parameter is required'
                });
            }

            const result = await deletePembebanan(parseInt(id));

            if (result.rowsAffected[0] === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Pembebanan not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Pembebanan deleted successfully'
            });
        } catch (error) {
            console.error('Error in deletePembebanan endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete pembebanan',
                error: error.message
            });
        }
    }

    static async bulkImportPembebanan(req, res) {
        try {
            const { pembebanانData, userId = "system" } = req.body;
            
            // Validate required fields
            if (!pembebanانData || !Array.isArray(pembebanانData) || pembebanانData.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required field: pembebanانData must be a non-empty array'
                });
            }

            // Validate each row in the data
            for (let i = 0; i < pembebanانData.length; i++) {
                const row = pembebanانData[i];
                
                // Check required fields - groupProductID can be null for default rates
                if (!row.groupPNCategoryID || !row.groupPNCategoryName) {
                    return res.status(400).json({
                        success: false,
                        message: `Row ${i + 1}: Missing required fields (groupPNCategoryID, groupPNCategoryName)`
                    });
                }
                
                // For custom rates (non-default), groupProductID is required
                if (!row.isDefaultRate && !row.groupProductID) {
                    return res.status(400).json({
                        success: false,
                        message: `Row ${i + 1}: groupProductID is required for custom rates`
                    });
                }
                
                // For default rates, groupProductID should be null
                if (row.isDefaultRate && row.groupProductID) {
                    return res.status(400).json({
                        success: false,
                        message: `Row ${i + 1}: Default rates should not have groupProductID`
                    });
                }
                
                // Validate numeric fields
                const numericFields = ['groupProsesRate', 'groupKemasRate', 'groupGenerikRate', 'groupAnalisaRate', 'tollFee'];
                for (const field of numericFields) {
                    if (row[field] !== null && row[field] !== undefined && isNaN(parseFloat(row[field]))) {
                        return res.status(400).json({
                            success: false,
                            message: `Row ${i + 1}: Invalid numeric value for field ${field}`
                        });
                    }
                }
            }
            
            // Perform bulk delete first (now deletes ALL entries including defaults), then bulk insert
            const deleteResult = await bulkDeletePembebanانWithProductID(userId);
            
            // Transform data for bulk insert - handle both default rates and custom rates
            const insertData = pembebanانData.map(row => ({
                groupPNCategoryID: String(row.groupPNCategoryID),
                groupPNCategoryName: String(row.groupPNCategoryName),
                groupProductID: row.isDefaultRate ? null : String(row.groupProductID), // null for default rates
                groupProsesRate: parseFloat(row.groupProsesRate) || 0,
                groupKemasRate: parseFloat(row.groupKemasRate) || 0,
                groupGenerikRate: parseFloat(row.groupGenerikRate) || 0,
                groupAnalisaRate: parseFloat(row.groupAnalisaRate) || 0,
                tollFee: parseFloat(row.tollFee) || 0
            }));
            
            const insertResult = await bulkInsertPembebanan(insertData, userId);
            
            // Count default vs custom rates
            const defaultRatesCount = pembebanانData.filter(row => row.isDefaultRate).length;
            const customRatesCount = pembebanانData.filter(row => !row.isDefaultRate).length;
            
            res.status(200).json({
                success: true,
                message: `Bulk import completed successfully. Deleted ${deleteResult.rowsAffected} old records (including default rates), inserted ${insertResult.rowsAffected} new records (${defaultRatesCount} default rates, ${customRatesCount} custom rates).`,
                data: {
                    deleted: deleteResult.rowsAffected,
                    inserted: insertResult.rowsAffected,
                    processed: pembebanانData.length,
                    defaultRates: defaultRatesCount,
                    customRates: customRatesCount
                }
            });
            
        } catch (error) {
            console.error('Error in bulkImportPembebanan endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to perform bulk import',
                error: error.message
            });
        }
    }

    static async getMaterial(req, res) {
        try {
            const result = await getMaterial();
            res.status(200).json(result);
        } catch (error) {
            console.error('Error in getMaterial endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve material',
                error: error.message
            });
        }
    }

    static async getMaterialUsage(req, res) {
        try {
            const result = await getMaterialUsage();
            res.status(200).json(result);
        } catch (error) {
            console.error('Error in getMaterialUsage endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve material usage',
                error: error.message
            });
        }
    }

    static async getMaterialUsageByYear(req, res) {
        try {
            const { year } = req.params;
            
            if (!year) {
                return res.status(400).json({
                    success: false,
                    message: 'Year parameter is required'
                });
            }
            
            // Validate year format (4-digit year)
            if (!/^\d{4}$/.test(year)) {
                return res.status(400).json({
                    success: false,
                    message: 'Year must be a 4-digit year (e.g., 2025)'
                });
            }
            
            const result = await getMaterialUsageByYear(year);
            res.status(200).json(result);
        } catch (error) {
            console.error('Error in getMaterialUsageByYear endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve material usage for the specified year',
                error: error.message
            });
        }
    }

    // === FORMULA MANUAL CUD ENDPOINTS ===

    static async addFormulaManual(req, res) {
        try {
            const { 
                ppiType, 
                ppiSubId, 
                ppiProductId, 
                ppiBatchSize, 
                ppiSeqId, 
                ppiItemId, 
                ppiQty, 
                ppiUnitId,
                userId = "GWN"
            } = req.body;
            
            // Validate required fields
            if (!ppiType || !ppiSubId || !ppiProductId || !ppiBatchSize || 
                !ppiSeqId || !ppiItemId || !ppiQty || !ppiUnitId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: ppiType, ppiSubId, ppiProductId, ppiBatchSize, ppiSeqId, ppiItemId, ppiQty, ppiUnitId'
                });
            }
            
            // Validate numeric values
            const numericFields = { ppiBatchSize, ppiSeqId, ppiQty };
            for (const [fieldName, value] of Object.entries(numericFields)) {
                if (isNaN(parseFloat(value))) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid numeric value for field: ${fieldName}`
                    });
                }
            }
            
            const result = await addFormulaManual(
                ppiType,
                ppiSubId,
                ppiProductId,
                parseFloat(ppiBatchSize),
                parseInt(ppiSeqId),
                ppiItemId,
                ppiQty, // Keep as string to preserve decimal precision
                ppiUnitId,
                userId
            );
            
            res.status(201).json({
                success: true,
                message: 'Formula ingredient added successfully',
                data: result
            });
        } catch (error) {
            console.error('Error in addFormulaManual endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add formula ingredient',
                error: error.message
            });
        }
    }

    static async addBatchFormulaManual(req, res) {
        try {
            const { 
                ppiType, 
                ppiSubId, 
                ppiProductId, 
                ppiBatchSize, 
                ingredients,
                userId = "GWN"
            } = req.body;
            
            // Validate required fields
            if (!ppiType || !ppiSubId || !ppiProductId || !ppiBatchSize || !ingredients) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: ppiType, ppiSubId, ppiProductId, ppiBatchSize, ingredients'
                });
            }
            
            // Validate ingredients array
            if (!Array.isArray(ingredients) || ingredients.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Ingredients must be a non-empty array'
                });
            }
            
            // Validate each ingredient
            for (let i = 0; i < ingredients.length; i++) {
                const ingredient = ingredients[i];
                if (!ingredient.seqId || !ingredient.itemId || !ingredient.qty || !ingredient.unitId) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid ingredient at index ${i}: missing seqId, itemId, qty, or unitId`
                    });
                }
                
                if (isNaN(parseInt(ingredient.seqId)) || isNaN(parseFloat(ingredient.qty))) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid ingredient at index ${i}: seqId and qty must be numeric`
                    });
                }
            }
            
            // Validate numeric values
            if (isNaN(parseFloat(ppiBatchSize))) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid numeric value for field: ppiBatchSize'
                });
            }
            
            const result = await addBatchFormulaManual(
                ppiType,
                ppiSubId,
                ppiProductId,
                parseFloat(ppiBatchSize),
                ingredients,
                userId
            );
            
            res.status(201).json({
                success: true,
                message: `Complete formula added successfully with ${result.ingredientsAdded} ingredients`,
                data: result
            });
        } catch (error) {
            console.error('Error in addBatchFormulaManual endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add complete formula',
                error: error.message
            });
        }
    }

    static async updateFormulaManual(req, res) {
        try {
            const { 
                ppiType, 
                ppiSubId, 
                ppiProductId, 
                originalSeqId, 
                ppiSeqId, 
                ppiItemId, 
                ppiQty, 
                ppiUnitId,
                userId = "GWN"
            } = req.body;
            
            // Validate required fields
            if (!ppiType || !ppiSubId || !ppiProductId || !originalSeqId ||
                !ppiSeqId || !ppiItemId || !ppiQty || !ppiUnitId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: ppiType, ppiSubId, ppiProductId, originalSeqId, ppiSeqId, ppiItemId, ppiQty, ppiUnitId'
                });
            }
            
            // Validate numeric values
            const numericFields = { originalSeqId, ppiSeqId, ppiQty };
            for (const [fieldName, value] of Object.entries(numericFields)) {
                if (isNaN(parseFloat(value))) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid numeric value for field: ${fieldName}`
                    });
                }
            }
            
            const result = await updateFormulaManual(
                ppiType,
                ppiSubId,
                ppiProductId,
                parseInt(originalSeqId),
                parseInt(ppiSeqId),
                ppiItemId,
                ppiQty, // Keep as string to preserve decimal precision
                ppiUnitId,
                userId
            );
            
            res.status(200).json({
                success: true,
                message: 'Formula ingredient updated successfully',
                data: result
            });
        } catch (error) {
            console.error('Error in updateFormulaManual endpoint:', error);
            if (error.message === 'No record found with the provided identifiers') {
                return res.status(404).json({
                    success: false,
                    message: 'Formula ingredient not found'
                });
            }
            res.status(500).json({
                success: false,
                message: 'Failed to update formula ingredient',
                error: error.message
            });
        }
    }

    static async deleteFormulaManual(req, res) {
        try {
            const { ppiType, ppiSubId, ppiProductId, ppiSeqId } = req.body;
            
            // Validate required fields
            if (!ppiType || !ppiSubId || !ppiProductId || !ppiSeqId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: ppiType, ppiSubId, ppiProductId, ppiSeqId'
                });
            }
            
            // Validate numeric value
            if (isNaN(parseInt(ppiSeqId))) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid numeric value for field: ppiSeqId'
                });
            }
            
            const result = await deleteFormulaManual(
                ppiType,
                ppiSubId,
                ppiProductId,
                parseInt(ppiSeqId)
            );
            
            res.status(200).json({
                success: true,
                message: 'Formula ingredient deleted successfully',
                data: result
            });
        } catch (error) {
            console.error('Error in deleteFormulaManual endpoint:', error);
            if (error.message === 'No record found with the provided identifiers') {
                return res.status(404).json({
                    success: false,
                    message: 'Formula ingredient not found'
                });
            }
            res.status(500).json({
                success: false,
                message: 'Failed to delete formula ingredient',
                error: error.message
            });
        }
    }

    static async deleteEntireFormulaManual(req, res) {
        try {
            const { ppiType, ppiSubId, ppiProductId } = req.body;
            
            // Validate required fields
            if (!ppiType || !ppiSubId || !ppiProductId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: ppiType, ppiSubId, ppiProductId'
                });
            }
            
            const result = await deleteEntireFormulaManual(
                ppiType,
                ppiSubId,
                ppiProductId
            );
            
            res.status(200).json({
                success: true,
                message: `Entire formula deleted successfully. ${result.rowsAffected} ingredients removed.`,
                data: result
            });
        } catch (error) {
            console.error('Error in deleteEntireFormulaManual endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete entire formula',
                error: error.message
            });
        }
    }

    static async exportAllFormulaDetail(req, res) {
        try {
            const result = await exportAllFormulaDetail();
            res.status(200).json({
                success: true,
                message: 'Export all formula detail completed successfully',
                data: result
            });
        } catch (error) {
            console.error('Error in exportAllFormulaDetail endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to export all formula detail',
                error: error.message
            });
        }
    }

    static async exportAllFormulaDetailSumPerSubID(req, res) {
        try {
            const result = await exportAllFormulaDetailSumPerSubID();
            res.status(200).json({
                success: true,
                message: 'Export all formula detail sum per sub ID completed successfully',
                data: result
            });
        } catch (error) {
            console.error('Error in exportAllFormulaDetailSumPerSubID endpoint:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to export all formula detail sum per sub ID',
                error: error.message
            });
        }
    }
}
module.exports = MasterController;