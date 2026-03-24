const log4js = require('../../middleware/log4jsPlus');
const systemService = require('./service');

const logger = log4js.getLogger('httpApi');

function querySystemStats(req, res) {
  try {
    res.apiSuccess(systemService.querySystemStats(req.query));
  } catch (error) {
    logger.error('[System] 获取系统统计列表失败:', error.message);
    res.apiError(null, '获取系统统计列表失败');
  }
}

function createSystemStat(req, res) {
  try {
    res.apiSuccess(systemService.createSystemStat(req.body), '创建成功');
  } catch (error) {
    logger.error('[System] 创建系统统计失败:', error.message);
    res.apiError(null, error.message || '创建失败');
  }
}

function updateSystemStat(req, res) {
  try {
    res.apiSuccess(systemService.updateSystemStat(req.body), '更新成功');
  } catch (error) {
    logger.error('[System] 更新系统统计失败:', error.message);
    res.apiError(null, error.message || '更新失败');
  }
}

function deleteSystemStats(req, res) {
  try {
    res.apiSuccess(systemService.deleteSystemStats(req.body), '删除成功');
  } catch (error) {
    logger.error('[System] 删除系统统计失败:', error.message);
    res.apiError(null, error.message || '删除失败');
  }
}

module.exports = {
  querySystemStats,
  createSystemStat,
  updateSystemStat,
  deleteSystemStats
};
