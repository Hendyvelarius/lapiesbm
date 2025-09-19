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
router.get('/group', MasterController.getGroup);
router.get('/groupManual', MasterController.getGroupManual);
router.post('/group', MasterController.addGroup);
router.put('/group/:id', MasterController.updateGroup);
router.delete('/group/:id', MasterController.deleteGroup);
router.get('/productName', MasterController.getProductName);
router.get('/pembebanan', MasterController.getPembebanan);
router.post('/pembebanan', MasterController.addPembebanan);
router.put('/pembebanan/:id', MasterController.updatePembebanan);
router.delete('/pembebanan/:id', MasterController.deletePembebanan);
router.get('/material', MasterController.getMaterial);
router.get('/materialUsage', MasterController.getMaterialUsage);

// Formula manual routes
router.post('/formula', MasterController.addFormulaManual);
router.post('/formula/batch', MasterController.addBatchFormulaManual);
router.put('/formula', MasterController.updateFormulaManual);
router.delete('/formula', MasterController.deleteFormulaManual);
router.delete('/formula/entire', MasterController.deleteEntireFormulaManual);
router.get('/export-all-formula', MasterController.exportAllFormulaDetail);
router.get('/export-all-formula-sum-per-subid', MasterController.exportAllFormulaDetailSumPerSubID);

module.exports = router;