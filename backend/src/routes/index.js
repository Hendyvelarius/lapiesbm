const express = require('express');
const router = express.Router();

// Import route modules
const productRoutes = require('./productRoutes');
const hppRoutes = require('./hppRoutes');
const masterRoutes = require('./masterRoutes');
const expiryCostRoutes = require('./expiryCostRoutes');
const reagenRoutes = require('./reagenRoutes');
const tollFeeRoutes = require('./tollFeeRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const dailyCurrencyRoutes = require('./dailyCurrencyRoutes');

// Use routes
router.use('/products', productRoutes);
router.use('/hpp', hppRoutes);
router.use('/master', masterRoutes);
router.use('/expiry-cost', expiryCostRoutes);
router.use('/reagen', reagenRoutes);
router.use('/toll-fee', tollFeeRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/daily-currency', dailyCurrencyRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler for undefined routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

module.exports = router;
