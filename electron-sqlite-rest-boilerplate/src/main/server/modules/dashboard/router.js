const express = require('express');
const controller = require('./controller');

const router = express.Router();

router.get('/query', controller.queryDashboard);
router.get('/chart', controller.queryChart);

module.exports = router;
