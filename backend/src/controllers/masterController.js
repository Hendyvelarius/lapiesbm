const { getCurrencyList } = require('../models/sqlModel');

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
}

module.exports = MasterController;