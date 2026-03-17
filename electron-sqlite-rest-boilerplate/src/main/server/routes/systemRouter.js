/**
 * 系统监控路由
 *
 * 提供系统资源监控相关的 REST API 接口
 * 包括系统统计的查询、创建、更新、删除操作
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
 * 获取系统统计列表
 * GET /api/system/query
 * body: { data: [...] }
 */
router.get('/query', (req, res) => {
  try {
    const page = parseInt(req.query.current_page) || 1;
    const page_size = parseInt(req.query.page_size) || 20;
    const offset = (page - 1) * page_size;

    const countResult = db.prepare('SELECT COUNT(*) as total FROM system_stats').get();
    const list = db
      .prepare(
        `
      SELECT * FROM system_stats
      ORDER BY recorded_at DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(page_size, offset);

    res.apiSuccess({
      list,
      pagination: {
        current_page: page,
        page_size,
        total: countResult.total
      }
    });
  } catch (error) {
    logger.error('[System] 获取系统统计列表失败:', error.message);
    res.apiError(null, '获取系统统计列表失败');
  }
});

// ===== CRUD: 创建 =====

/**
 * 创建系统统计记录
 * POST /api/system/create
 * body: { data: [...] }
 */
router.post('/create', (req, res) => {
  try {
    // 直接透传 req.body，不做冗余解构
    const data = req.body;
    const now = Math.floor(Date.now() / 1000);

    const result = db
      .prepare(
        `
      INSERT INTO system_stats (
        cpu_usage, memory_usage, memory_total, memory_used,
        disk_usage, disk_total, disk_used, network_rx, network_tx, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        data.cpu_usage || 0,
        data.memory_usage || 0,
        data.memory_total || 0,
        data.memory_used || 0,
        data.disk_usage || 0,
        data.disk_total || 0,
        data.disk_used || 0,
        data.network_rx || 0,
        data.network_tx || 0,
        data.recorded_at || now
      );

    res.apiSuccess({ id: result.lastInsertRowid }, '创建成功');
  } catch (error) {
    logger.error('[System] 创建系统统计失败:', error.message);
    res.apiError(null, '创建失败');
  }
});

// ===== CRUD: 更新 =====

/**
 * 更新系统统计记录
 * POST /api/system/update
 * body: { data: [...] }
 */
router.post('/update', (req, res) => {
  try {
    const data = req.body;
    const now = Math.floor(Date.now() / 1000);

    if (!data.id) {
      return res.apiError(null, '缺少ID');
    }

    const updates = [];
    const params = [];

    // 直接透传 data 对象中的字段
    if (data.cpu_usage !== undefined) {
      updates.push('cpu_usage = ?');
      params.push(data.cpu_usage);
    }
    if (data.memory_usage !== undefined) {
      updates.push('memory_usage = ?');
      params.push(data.memory_usage);
    }
    if (data.memory_total !== undefined) {
      updates.push('memory_total = ?');
      params.push(data.memory_total);
    }
    if (data.memory_used !== undefined) {
      updates.push('memory_used = ?');
      params.push(data.memory_used);
    }
    if (data.disk_usage !== undefined) {
      updates.push('disk_usage = ?');
      params.push(data.disk_usage);
    }
    if (data.disk_total !== undefined) {
      updates.push('disk_total = ?');
      params.push(data.disk_total);
    }
    if (data.disk_used !== undefined) {
      updates.push('disk_used = ?');
      params.push(data.disk_used);
    }
    if (data.network_rx !== undefined) {
      updates.push('network_rx = ?');
      params.push(data.network_rx);
    }
    if (data.network_tx !== undefined) {
      updates.push('network_tx = ?');
      params.push(data.network_tx);
    }

    if (updates.length === 0) {
      return res.apiError(null, '无可更新字段');
    }

    params.push(data.id);
    const result = db
      .prepare(`UPDATE system_stats SET ${updates.join(', ')} WHERE id = ?`)
      .run(...params);

    if (result.changes === 0) {
      return res.apiError(null, '记录不存在');
    }

    res.apiSuccess({ changes: result.changes }, '更新成功');
  } catch (error) {
    logger.error('[System] 更新系统统计失败:', error.message);
    res.apiError(null, '更新失败');
  }
});

// ===== CRUD: 删除 =====

/**
 * 删除系统统计记录
 * POST /api/system/delete
 * body: { data: [id1, id2, ...] }
 */
router.post('/delete', (req, res) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.apiError(null, '缺少要删除的ID');
    }

    const placeholders = data.map(() => '?').join(',');
    const result = db.prepare(`DELETE FROM system_stats WHERE id IN (${placeholders})`).run(...data);

    res.apiSuccess({ deleted: result.changes }, '删除成功');
  } catch (error) {
    logger.error('[System] 删除系统统计失败:', error.message);
    res.apiError(null, '删除失败');
  }
});

module.exports = router;

/**
 * @swagger
 * tags:
 *   - name: system
 *     description: 系统监控接口
 *
 * /api/system/query:
 *   get:
 *     tags:
 *       - system
 *     summary: 获取系统统计列表
 *     parameters:
 *       - in: query
 *         name: current_page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: page_size
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 每页数量
 *     responses:
 *       200:
 *         description: 操作成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 datum:
 *                   type: object
 *                   properties:
 *                     list:
 *                       type: array
 *                     pagination:
 *                       type: object
 *
 * /api/system/create:
 *   post:
 *     tags:
 *       - system
 *     summary: 创建系统统计记录
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cpu_usage:
 *                 type: number
 *               memory_usage:
 *                 type: number
 *     responses:
 *       200:
 *         description: 操作成功
 *
 * /api/system/update:
 *   post:
 *     tags:
 *       - system
 *     summary: 更新系统统计记录
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               cpu_usage:
 *                 type: number
 *     responses:
 *       200:
 *         description: 操作成功
 *
 * /api/system/delete:
 *   post:
 *     tags:
 *       - system
 *     summary: 删除系统统计记录
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: 操作成功
 */
