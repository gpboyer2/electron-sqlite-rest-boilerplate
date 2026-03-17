/**
 * 进程管理路由
 *
 * 提供进程管理相关的 REST API 接口
 * 包括进程列表的查询、创建、更新、删除操作
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
 * 获取进程列表
 * GET /api/process/query
 * body: { data: [...] }
 */
router.get('/query', (req, res) => {
  try {
    const status = req.query.status;
    const current_page = parseInt(req.query.current_page) || 1;
    const page_size = parseInt(req.query.page_size) || 20;
    const offset = (current_page - 1) * page_size;

    let whereClause = '';
    const params = [];
    if (status) {
      whereClause = 'WHERE status = ?';
      params.push(status);
    }

    const countResult = db
      .prepare(`SELECT COUNT(*) as total FROM process_info ${whereClause}`)
      .get(...params);
    const list = db
      .prepare(
        `
      SELECT * FROM process_info ${whereClause}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(...params, page_size, offset);

    res.apiSuccess({
      list,
      pagination: { current_page, page_size, total: countResult.total }
    });
  } catch (error) {
    logger.error('[Process] 获取进程列表失败:', error.message);
    res.apiError(null, '获取进程列表失败');
  }
});

// ===== CRUD: 创建 =====

/**
 * 创建进程记录
 * POST /api/process/create
 * body: { data: [...] }
 */
router.post('/create', (req, res) => {
  try {
    const data = req.body;
    const now = Math.floor(Date.now() / 1000);

    if (!data.pid || !data.name) {
      return res.apiError(null, '缺少必要参数');
    }

    const result = db
      .prepare(
        `
      INSERT INTO process_info (
        pid, name, status, cpu_usage, memory_usage, memory_bytes,
        started_at, command, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        data.pid,
        data.name,
        data.status || 'running',
        data.cpu_usage || 0,
        data.memory_usage || 0,
        data.memory_bytes || 0,
        data.started_at || null,
        data.command || null,
        now,
        now
      );

    res.apiSuccess({ id: result.lastInsertRowid }, '创建成功');
  } catch (error) {
    logger.error('[Process] 创建进程记录失败:', error.message);
    res.apiError(null, '创建失败');
  }
});

// ===== CRUD: 更新 =====

/**
 * 更新进程信息
 * POST /api/process/update
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

    if (data.pid !== undefined) {
      updates.push('pid = ?');
      params.push(data.pid);
    }
    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.cpu_usage !== undefined) {
      updates.push('cpu_usage = ?');
      params.push(data.cpu_usage);
    }
    if (data.memory_usage !== undefined) {
      updates.push('memory_usage = ?');
      params.push(data.memory_usage);
    }
    if (data.memory_bytes !== undefined) {
      updates.push('memory_bytes = ?');
      params.push(data.memory_bytes);
    }

    if (updates.length === 0) {
      return res.apiError(null, '无可更新字段');
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(data.id);

    const result = db
      .prepare(`UPDATE process_info SET ${updates.join(', ')} WHERE id = ?`)
      .run(...params);

    if (result.changes === 0) {
      return res.apiError(null, '记录不存在');
    }

    res.apiSuccess({ changes: result.changes }, '更新成功');
  } catch (error) {
    logger.error('[Process] 更新进程失败:', error.message);
    res.apiError(null, '更新失败');
  }
});

// ===== CRUD: 删除 =====

/**
 * 删除进程记录
 * POST /api/process/delete
 * body: { data: [id1, id2, ...] }
 */
router.post('/delete', (req, res) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.apiError(null, '缺少要删除的ID');
    }

    const placeholders = data.map(() => '?').join(',');
    const result = db.prepare(`DELETE FROM process_info WHERE id IN (${placeholders})`).run(...data);

    res.apiSuccess({ deleted: result.changes }, '删除成功');
  } catch (error) {
    logger.error('[Process] 删除进程失败:', error.message);
    res.apiError(null, '删除失败');
  }
});

module.exports = router;

/**
 * @swagger
 * tags:
 *   - name: process
 *     description: 进程管理接口
 *
 * /api/process/query:
 *   get:
 *     tags:
 *       - process
 *     summary: 获取进程列表
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: 进程状态过滤
 *       - in: query
 *         name: current_page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page_size
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 操作成功
 *
 * /api/process/create:
 *   post:
 *     tags:
 *       - process
 *     summary: 创建进程记录
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pid:
 *                 type: integer
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: 操作成功
 *
 * /api/process/update:
 *   post:
 *     tags:
 *       - process
 *     summary: 更新进程信息
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 操作成功
 *
 * /api/process/delete:
 *   post:
 *     tags:
 *       - process
 *     summary: 删除进程记录
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
