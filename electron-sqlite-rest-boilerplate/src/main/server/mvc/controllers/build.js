/**
 * 构建控制器，负责处理构建任务相关的HTTP请求
 */

const log4js = require('../../middleware/log4jsPlus');
const logger = log4js.getLogger('default');
const { BuildService } = require('../services/build');

class BuildController {
  /**
   * 创建构建任务
   * POST /api/build/tasks
   */
  static async createTask(req, res) {
    try {
      const { contextType, contextId, contextName, options } = req.body || {};
      const task = await BuildService.startBuild({
        contextType,
        contextId,
        contextName,
        options,
        user: req.user
      });
      res.apiSuccess(task, '构建任务已创建');
    } catch (error) {
      logger.error('创建构建任务失败:', error);
      res.apiError(null, error.message || '创建构建任务失败');
    }
  }

  /**
   * 查询任务详情
   * GET /api/build/tasks/:taskId
   */
  static async getTask(req, res) {
    try {
      const { taskId } = req.params;
      const task = await BuildService.getTask(taskId, req.user);
      res.apiSuccess(task, '查询成功');
    } catch (error) {
      logger.error('查询构建任务失败:', error);
      res.apiError(null, error.message || '查询失败');
    }
  }

  /**
   * 获取构建历史
   * GET /api/build/tasks?contextType=&contextId=&limit=&offset=
   */
  static async listTasks(req, res) {
    try {
      const { contextType, contextId, limit, offset } = req.query || {};
      const result = await BuildService.listTasks(
        { contextType, contextId, limit, offset },
        req.user
      );
      res.apiSuccess(result, '查询成功');
    } catch (error) {
      logger.error('获取构建历史失败:', error);
      res.apiError(null, error.message || '获取构建历史失败');
    }
  }

  /**
   * 下载构建产物
   * GET /api/build/tasks/:taskId/download
   */
  static async downloadTask(req, res) {
    try {
      const { taskId } = req.params;
      await BuildService.downloadArtifact(taskId, req.user, res);
    } catch (error) {
      logger.error('下载构建产物失败:', error);
      if (!res.headersSent) {
        res.apiError(null, error.message || '下载构建产物失败');
      }
    }
  }

  /**
   * 取消构建任务
   * POST /api/build/tasks/:taskId/cancel
   */
  static async cancelTask(req, res) {
    try {
      const { taskId } = req.params;
      const result = await BuildService.cancelTask(taskId, req.user);
      res.apiSuccess(result, '构建任务已取消');
    } catch (error) {
      logger.error('取消构建任务失败:', error);
      res.apiError(null, error.message || '取消构建任务失败');
    }
  }
}

module.exports = BuildController;
