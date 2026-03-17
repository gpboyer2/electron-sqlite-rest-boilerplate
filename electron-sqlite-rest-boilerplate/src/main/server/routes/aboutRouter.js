/**
 * 关于路由
 *
 * 提供应用信息相关的 REST API 接口
 * 包括版本信息、作者信息等的查询和更新操作
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
 * 获取关于信息
 * GET /api/about/query
 * body: { data: [...] }
 */
router.get('/query', (req, res) => {
  try {
    const aboutInfo = db.prepare('SELECT * FROM about_info ORDER BY id DESC LIMIT 1').get();

    if (aboutInfo) {
      res.apiSuccess(aboutInfo);
    } else {
      res.apiSuccess({
        app_name: 'Electron Boilerplate',
        version: '1.0.0',
        description: 'Electron + SQLite + REST API Desktop Application',
        author: '开发者',
        license: 'AGPL-3.0'
      });
    }
  } catch (error) {
    logger.error('[About] 获取关于信息失败:', error.message);
    res.apiError(null, '获取关于信息失败');
  }
});

// ===== CRUD: 更新 =====

/**
 * 更新关于信息
 * POST /api/about/update
 * body: { data: [...] }
 */
router.post('/update', (req, res) => {
  try {
    const data = req.body;
    const now = Math.floor(Date.now() / 1000);

    const existing = db.prepare('SELECT id FROM about_info ORDER BY id DESC LIMIT 1').get();

    if (existing) {
      const result = db
        .prepare(
          `
        UPDATE about_info SET
          app_name = COALESCE(?, app_name),
          version = COALESCE(?, version),
          description = COALESCE(?, description),
          author = COALESCE(?, author),
          license = COALESCE(?, license),
          updated_at = ?
        WHERE id = ?
      `
        )
        .run(
          data.app_name || null,
          data.version || null,
          data.description || null,
          data.author || null,
          data.license || null,
          now,
          existing.id
        );

      res.apiSuccess({ changes: result.changes }, '更新成功');
    } else {
      const result = db
        .prepare(
          `
        INSERT INTO about_info (app_name, version, description, author, license, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          data.app_name || 'Electron Boilerplate',
          data.version || '1.0.0',
          data.description || '',
          data.author || '开发者',
          data.license || 'AGPL-3.0',
          now
        );

      res.apiSuccess({ id: result.lastInsertRowid }, '创建成功');
    }
  } catch (error) {
    logger.error('[About] 更新关于信息失败:', error.message);
    res.apiError(null, '更新失败');
  }
});

module.exports = router;

/**
 * @swagger
 * tags:
 *   - name: about
 *     description: 关于接口
 *
 * /api/about/query:
 *   get:
 *     tags:
 *       - about
 *     summary: 获取关于信息
 *     responses:
 *       200:
 *         description: 操作成功
 *
 * /api/about/update:
 *   post:
 *     tags:
 *       - about
 *     summary: 更新关于信息
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               app_name:
 *                 type: string
 *               version:
 *                 type: string
 *               description:
 *                 type: string
 *               author:
 *                 type: string
 *               license:
 *                 type: string
 *     responses:
 *       200:
 *         description: 操作成功
 */
