const log4js = require('../../middleware/log4jsPlus');
const healthService = require('./service');

const logger = log4js.getLogger();

function getHealth(_req, res) {
  try {
    res.apiSuccess(healthService.getHealthStatus(), '服务正常');
  } catch (error) {
    logger.error('[Health] 健康检查失败:', error);
    res.status(503).apiError(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      },
      '服务异常'
    );
  }
}

module.exports = {
  getHealth
};
