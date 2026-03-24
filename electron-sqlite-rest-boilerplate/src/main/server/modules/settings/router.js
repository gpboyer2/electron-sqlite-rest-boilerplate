const express = require('express');
const controller = require('./controller');

const router = express.Router();

router.get('/query', controller.querySettings);
router.post('/create', controller.createSetting);
router.post('/update', controller.updateSetting);
router.post('/delete', controller.deleteSettings);

module.exports = router;
