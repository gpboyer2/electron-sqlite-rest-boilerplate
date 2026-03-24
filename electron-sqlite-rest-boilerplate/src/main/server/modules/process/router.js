const express = require('express');
const controller = require('./controller');

const router = express.Router();

router.get('/query', controller.queryProcesses);
router.post('/create', controller.createProcess);
router.post('/update', controller.updateProcess);
router.post('/delete', controller.deleteProcesses);

module.exports = router;
