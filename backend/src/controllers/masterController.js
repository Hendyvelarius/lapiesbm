const { getCurrencyList, getBahan, getHargaBahan, addHargaBahan, updateHargaBahan, deleteHargaBahan, getUnit, getParameter, updateParameter } = require('../models/sqlModel');

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
            
            // Validate required fields
            if (!itemId || !itemType || !unit || !price || !currency || !userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: itemId, itemType, unit, price, currency, userId'
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
            
            // Validate required fields
            if (!id || !itemType || !unit || !price || !currency || !userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: id (in URL), itemType, unit, price, currency, userId'
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
                directLabour, 
                foh, 
                depresiasi, 
                mhTimbangBB, 
                mhTimbangBK, 
                mhAnalisa, 
                biayaAnalisa, 
                kwhMesin, 
                rateKwhMesin,
                userId = "system" // Default user if not provided
            } = req.body;
            
            // Validate required fields
            if (!directLabour || !foh || !depresiasi || !mhTimbangBB || !mhTimbangBK || 
                !mhAnalisa || !biayaAnalisa || !kwhMesin || !rateKwhMesin) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields. All parameter values must be provided.'
                });
            }
            
            // Validate numeric values
            const numericFields = {
                directLabour, foh, depresiasi, mhTimbangBB, mhTimbangBK, 
                mhAnalisa, biayaAnalisa, kwhMesin, rateKwhMesin
            };
            
            for (const [fieldName, value] of Object.entries(numericFields)) {
                if (isNaN(parseFloat(value))) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid numeric value for field: ${fieldName}`
                    });
                }
            }
            
            const result = await updateParameter(
                parseFloat(directLabour),
                parseFloat(foh),
                parseFloat(depresiasi),
                parseFloat(mhTimbangBB),
                parseFloat(mhTimbangBK),
                parseFloat(mhAnalisa),
                parseFloat(biayaAnalisa),
                parseFloat(kwhMesin),
                parseFloat(rateKwhMesin),
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
}

module.exports = MasterController;