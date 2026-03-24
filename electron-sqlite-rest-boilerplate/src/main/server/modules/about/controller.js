const log4js = require('../../middleware/log4jsPlus');
const aboutService = require('./service');

const logger = log4js.getLogger('httpApi');

function queryAbout(_req, res) {
  try {
    res.apiSuccess(aboutService.getAboutInfo());
  } catch (error) {
    logger.error('[About] 获取关于信息失败:', error.message);
    res.apiError(null, '获取关于信息失败');
  }
}

function updateAbout(req, res) {
  try {
    res.apiSuccess(aboutService.updateAboutInfo(req.body), '更新成功');
  } catch (error) {
    logger.error('[About] 更新关于信息失败:', error.message);
    res.apiError(null, '更新失败');
  }
}

module.exports = {
  queryAbout,
  updateAbout
};
