const express = require('express');
const controller = require('./controller');

const router = express.Router();

router.get('/query', controller.querySystemStats);
router.post('/create', controller.createSystemStat);
router.post('/update', controller.updateSystemStat);
router.post('/delete', controller.deleteSystemStats);

module.exports = router;
