const express = require('express');
const controller = require('./controller');
const {
  authenticateTemplateUser,
  requireTemplatePermission
} = require('../../middleware/templateAuth');

const router = express.Router();

router.get('/public-summary', controller.getPublicSummary);
router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', authenticateTemplateUser, controller.logout);
router.get('/me', authenticateTemplateUser, controller.me);
router.get(
  '/protected-example',
  authenticateTemplateUser,
  requireTemplatePermission('template.example.access'),
  controller.protectedExample
);

module.exports = router;
