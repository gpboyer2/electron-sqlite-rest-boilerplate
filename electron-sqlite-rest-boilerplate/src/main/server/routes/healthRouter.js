/**
 * 健康检查路由
 *
 * 用于 Docker 容器健康检查和负载均衡器探测
 *
 * 【强制约束】本项目必须使用 better-sqlite3，禁止使用 Sequelize 或其他 ORM
 */

const express = require('express');
const router = express.Router();
const { testConnection } = require('../database/database');
const log4js = require('../middleware/log4jsPlus');
const logger = log4js.getLogger();

/**
 * 健康检查接口
 * GET /api/health
 * 返回服务状态，用于容器健康检查
 */
router.get('/', (req, res) => {
  try {
    // 使用 better-sqlite3 测试数据库连接
    testConnection();

    res.apiSuccess(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected'
      },
      '服务正常'
    );
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
});

module.exports = router;

/**
 * @swagger
 * tags:
 *   - name: health
 *     description: 健康检查接口
 *
 * /api/health:
 *   get:
 *     tags:
 *       - health
 *     summary: 健康检查
 *     responses:
 *       200:
 *         description: 服务正常
 *       503:
 *         description: 服务异常
 */
