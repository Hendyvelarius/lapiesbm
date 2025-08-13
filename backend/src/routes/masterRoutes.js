const express = require('express');
const router = express.Router();
const MasterController = require('../controllers/masterController');

// Currency routes
router.get('/currency', MasterController.getCurrency);

module.exports = router;
