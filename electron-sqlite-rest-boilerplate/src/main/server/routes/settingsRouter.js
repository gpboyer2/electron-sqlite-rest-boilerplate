/**
 * 设置路由
 *
 * 提供系统设置相关的 REST API 接口
 * 包括设置的查询、更新、删除操作
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
 * 获取设置列表
 * GET /api/settings/query
 * body: { data: [...] }
 */
router.get('/query', (req, res) => {
  try {
    const key = req.query.key;

    if (key) {
      const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
      if (!setting) {
        return res.apiError(null, '设置不存在');
      }
      res.apiSuccess(setting);
    } else {
      const list = db.prepare('SELECT * FROM settings ORDER BY id ASC').all();
      const settingsMap = {};
      for (const item of list) {
        settingsMap[item.key] = item.value;
      }
      res.apiSuccess({
        list,
        map: settingsMap,
        pagination: { current_page: 1, page_size: list.length, total: list.length }
      });
    }
  } catch (error) {
    logger.error('[Settings] 获取设置失败:', error.message);
    res.apiError(null, '获取设置失败');
  }
});

// ===== CRUD: 创建 =====

/**
 * 创建设置
 * POST /api/settings/create
 * body: { data: [...] }
 */
router.post('/create', (req, res) => {
  try {
    const data = req.body;

    if (!data.key) {
      return res.apiError(null, '缺少设置键');
    }

    const now = Math.floor(Date.now() / 1000);
    const result = db
      .prepare(
        `
      INSERT INTO settings (key, value, description, updated_at)
      VALUES (?, ?, ?, ?)
    `
      )
      .run(data.key, data.value || '', data.description || '', now);

    res.apiSuccess({ id: result.lastInsertRowid }, '创建成功');
  } catch (error) {
    logger.error('[Settings] 创建设置失败:', error.message);
    res.apiError(null, '创建失败');
  }
});

// ===== CRUD: 更新 =====

/**
 * 更新设置
 * POST /api/settings/update
 * body: { data: [...] }
 */
router.post('/update', (req, res) => {
  try {
    const data = req.body;

    if (!data.key) {
      return res.apiError(null, '缺少设置键');
    }

    const now = Math.floor(Date.now() / 1000);
    const existing = db.prepare('SELECT id FROM settings WHERE key = ?').get(data.key);

    if (existing) {
      const result = db
        .prepare(
          `
        UPDATE settings SET value = ?, description = ?, updated_at = ? WHERE key = ?
      `
        )
        .run(data.value || '', data.description || '', now, data.key);

      res.apiSuccess({ changes: result.changes }, '更新成功');
    } else {
      const result = db
        .prepare(
          `
        INSERT INTO settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)
      `
        )
        .run(data.key, data.value || '', data.description || '', now);

      res.apiSuccess({ id: result.lastInsertRowid }, '创建成功');
    }
  } catch (error) {
    logger.error('[Settings] 更新设置失败:', error.message);
    res.apiError(null, '更新失败');
  }
});

// ===== CRUD: 删除 =====

/**
 * 删除设置
 * POST /api/settings/delete
 * body: { data: [key1, key2, ...] }
 */
router.post('/delete', (req, res) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.apiError(null, '缺少要删除的设置键');
    }

    const placeholders = data.map(() => '?').join(',');
    const result = db.prepare(`DELETE FROM settings WHERE key IN (${placeholders})`).run(...data);

    res.apiSuccess({ deleted: result.changes }, '删除成功');
  } catch (error) {
    logger.error('[Settings] 删除设置失败:', error.message);
    res.apiError(null, '删除失败');
  }
});

module.exports = router;

/**
 * @swagger
 * tags:
 *   - name: settings
 *     description: 设置接口
 *
 * /api/settings/query:
 *   get:
 *     tags:
 *       - settings
 *     summary: 获取设置
 *     parameters:
 *       - in: query
 *         name: key
 *         schema:
 *           type: string
 *         description: 设置键
 *     responses:
 *       200:
 *         description: 操作成功
 *
 * /api/settings/create:
 *   post:
 *     tags:
 *       - settings
 *     summary: 创建设置
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *               value:
 *                 type: string
 *     responses:
 *       200:
 *         description: 操作成功
 *
 * /api/settings/update:
 *   post:
 *     tags:
 *       - settings
 *     summary: 更新设置
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *               value:
 *                 type: string
 *     responses:
 *       200:
 *         description: 操作成功
 *
 * /api/settings/delete:
 *   post:
 *     tags:
 *       - settings
 *     summary: 删除设置
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
 *                   type: string
 *     responses:
 *       200:
 *         description: 操作成功
 */
