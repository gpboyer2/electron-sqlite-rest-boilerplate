const log4js = require('../../middleware/log4jsPlus');
const settingsService = require('./service');

const logger = log4js.getLogger('httpApi');

function querySettings(req, res) {
  try {
    res.apiSuccess(settingsService.querySettings(req.query));
  } catch (error) {
    logger.error('[Settings] 获取设置失败:', error.message);
    res.apiError(null, error.message || '获取设置失败');
  }
}

function createSetting(req, res) {
  try {
    res.apiSuccess(settingsService.createSetting(req.body), '创建成功');
  } catch (error) {
    logger.error('[Settings] 创建设置失败:', error.message);
    res.apiError(null, error.message || '创建失败');
  }
}

function updateSetting(req, res) {
  try {
    res.apiSuccess(settingsService.updateSetting(req.body), '更新成功');
  } catch (error) {
    logger.error('[Settings] 更新设置失败:', error.message);
    res.apiError(null, error.message || '更新失败');
  }
}

function deleteSettings(req, res) {
  try {
    res.apiSuccess(settingsService.deleteSettings(req.body), '删除成功');
  } catch (error) {
    logger.error('[Settings] 删除设置失败:', error.message);
    res.apiError(null, error.message || '删除失败');
  }
}

module.exports = {
  querySettings,
  createSetting,
  updateSetting,
  deleteSettings
};
