/**
 * 仪表盘路由
 *
 * 提供仪表盘相关的 REST API 接口
 * 包括系统概览、实时监控数据等
 *
 * 【强制约束】本项目必须使用 better-sqlite3，禁止使用 Sequelize 或其他 ORM
 */

const express = require('express');
const router = express.Router();
const { db } = require('../database/database');
const log4js = require('../middleware/log4jsPlus');
const logger = log4js.getLogger('httpApi');

// ===== CRUD: 查询 =====

/**
 * 获取仪表盘数据
 * GET /api/dashboard/query
 * body: { data: [...] }
 */
router.get('/query', (req, res) => {
  try {
    // 获取最新系统统计
    const latestStats = db
      .prepare(
        `
      SELECT * FROM system_stats ORDER BY recorded_at DESC LIMIT 1
    `
      )
      .get();

    // 获取进程统计
    const processStats = db
      .prepare(
        `
      SELECT
        COUNT(*) as total_processes,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running_processes,
        SUM(CASE WHEN status = 'stopped' THEN 1 ELSE 0 END) as stopped_processes
      FROM process_info
    `
      )
      .get();

    // 获取设置信息
    const settings = db.prepare(`SELECT key, value FROM settings`).all();

    const settingsMap = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    // 构建返回数据
    const dashboardData = {
      system: {
        cpu: { usage: latestStats?.cpu_usage || 0 },
        memory: {
          usage: latestStats?.memory_usage || 0,
          total: latestStats?.memory_total || 0,
          used: latestStats?.memory_used || 0
        },
        disk: {
          usage: latestStats?.disk_usage || 0,
          total: latestStats?.disk_total || 0,
          used: latestStats?.disk_used || 0
        },
        network: { rx: latestStats?.network_rx || 0, tx: latestStats?.network_tx || 0 }
      },
      process: {
        total: processStats?.total_processes || 0,
        running: processStats?.running_processes || 0,
        stopped: processStats?.stopped_processes || 0
      },
      settings: settingsMap,
      last_updated: latestStats?.recorded_at || null
    };

    res.apiSuccess(dashboardData);
  } catch (error) {
    logger.error('[Dashboard] 获取仪表盘数据失败:', error.message);
    res.apiError(null, '获取仪表盘数据失败');
  }
});

/**
 * 获取仪表盘图表数据
 * GET /api/dashboard/query
 * body: { data: [...] }
 *
 * 通过 query 参数区分：metric, time_range
 */
router.get('/chart', (req, res) => {
  try {
    const metric = req.query.metric || 'all';
    const time_range = parseInt(req.query.time_range) || 60;
    const since = Math.floor(Date.now() / 1000) - time_range * 60;

    let fields = [];
    switch (metric) {
      case 'cpu':
        fields = ['recorded_at', 'cpu_usage'];
        break;
      case 'memory':
        fields = ['recorded_at', 'memory_usage', 'memory_used', 'memory_total'];
        break;
      case 'disk':
        fields = ['recorded_at', 'disk_usage', 'disk_used', 'disk_total'];
        break;
      case 'network':
        fields = ['recorded_at', 'network_rx', 'network_tx'];
        break;
      default:
        fields = ['recorded_at', 'cpu_usage', 'memory_usage', 'disk_usage'];
    }

    const selectedFields = fields.join(', ');
    const list = db
      .prepare(
        `
      SELECT ${selectedFields} FROM system_stats
      WHERE recorded_at >= ?
      ORDER BY recorded_at ASC
    `
      )
      .all(since);

    res.apiSuccess({
      metric,
      time_range,
      list,
      pagination: { current_page: 1, page_size: list.length, total: list.length }
    });
  } catch (error) {
    logger.error('[Dashboard] 获取图表数据失败:', error.message);
    res.apiError(null, '获取图表数据失败');
  }
});

module.exports = router;

/**
 * @swagger
 * tags:
 *   - name: dashboard
 *     description: 仪表盘接口
 *
 * /api/dashboard/query:
 *   get:
 *     tags:
 *       - dashboard
 *     summary: 获取仪表盘数据
 *     responses:
 *       200:
 *         description: 操作成功
 *
 * /api/dashboard/chart:
 *   get:
 *     tags:
 *       - dashboard
 *     summary: 获取仪表盘图表数据
 *     parameters:
 *       - in: query
 *         name: metric
 *         schema:
 *           type: string
 *           enum: [cpu, memory, disk, network, all]
 *         description: 指标类型
 *       - in: query
 *         name: time_range
 *         schema:
 *           type: integer
 *           default: 60
 *         description: 时间范围（分钟）
 *     responses:
 *       200:
 *         description: 操作成功
 */
