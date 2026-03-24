const log4js = require('../../middleware/log4jsPlus');
const dashboardService = require('./service');

const logger = log4js.getLogger('httpApi');

function queryDashboard(_req, res) {
  try {
    res.apiSuccess(dashboardService.getDashboardData());
  } catch (error) {
    logger.error('[Dashboard] 获取仪表盘数据失败:', error.message);
    res.apiError(null, '获取仪表盘数据失败');
  }
}

function queryChart(req, res) {
  try {
    res.apiSuccess(dashboardService.getDashboardChart(req.query));
  } catch (error) {
    logger.error('[Dashboard] 获取图表数据失败:', error.message);
    res.apiError(null, '获取图表数据失败');
  }
}

module.exports = {
  queryDashboard,
  queryChart
};
