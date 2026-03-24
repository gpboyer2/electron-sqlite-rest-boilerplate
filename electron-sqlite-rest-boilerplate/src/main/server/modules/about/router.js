const express = require('express');
const controller = require('./controller');

const router = express.Router();

router.get('/query', controller.queryAbout);
router.post('/update', controller.updateAbout);

module.exports = router;
