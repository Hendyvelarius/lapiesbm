const express = require('express');
const router = express.Router();
const MasterController = require('../controllers/masterController');

// Currency routes
router.get('/currency', MasterController.getCurrency);
router.get('/bahan', MasterController.getBahan);
router.get('/unit', MasterController.getUnit);  
router.get('/hargaBahan', MasterController.getHargaBahan);
router.post('/hargaBahan', MasterController.addHargaBahan);
router.put('/hargaBahan/:id', MasterController.updateHargaBahan);
router.delete('/hargaBahan/:id', MasterController.deleteHargaBahan);
router.get('/parameter', MasterController.getParameter);
router.put('/parameter', MasterController.updateParameter);

module.exports = router;