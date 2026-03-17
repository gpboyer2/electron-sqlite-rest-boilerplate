/**
 * @file       systemLevelDesignTree.js
 * @brief      系统级设计树控制器，负责处理系统级设计树节点的管理的HTTP请求
 * @date       2025-11-28
 * @copyright  Copyright (c) 2025
 */

const SystemLevelDesignTreeService = require('../services/systemLevelDesignTree');
const log4js = require('../../middleware/log4jsPlus');
const logger = log4js.getLogger('httpApi');

class SystemLevelDesignTreeController {
  /**
   * 获取所有节点
   * @param {Object} req - Express 请求对象
   * @param {Object} res - Express 响应对象
   * @returns {Promise<void>} 返回所有节点列表
   */
  static async getAllSystemLevelDesignNodes(req, res) {
    try {
      const nodes = await SystemLevelDesignTreeService.getAllSystemLevelDesignNodes();
      res.apiSuccess(nodes);
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 获取节点详情
   * GET /nodes/detail?id=xxx
   * @param {Object} req - Express 请求对象
   * @param {Object} req.query - 查询参数
   * @param {string} req.query.id - 节点ID
   * @param {Object} res - Express 响应对象
   * @returns {Promise<void>} 返回节点详情
   */
  static async getSystemLevelDesignNodeById(req, res) {
    try {
      const { id } = req.query;
      logger.info('[Controller.getSystemLevelDesignNodeById] 收到请求，id:', id);
      if (!id) {
        return res.apiError(null, '缺少参数 id');
      }
      const node = await SystemLevelDesignTreeService.getSystemLevelDesignNodeById(id);
      logger.info(
        '[Controller.getSystemLevelDesignNodeById] 查询结果:',
        node ? '找到节点' : '节点不存在'
      );
      // 查询操作：节点不存在时返回 success，datum 为 null
      // 符合测试架构规范：查询类操作查不到数据 = success
      res.apiSuccess(node);
    } catch (error) {
      logger.error('[Controller.getSystemLevelDesignNodeById] 错误:', error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 获取子节点
   * GET /nodes/children?parentId=xxx
   * @param {Object} req - Express 请求对象
   * @param {Object} req.query - 查询参数
   * @param {string|null} req.query.parentId - 父节点ID，null、undefined 或空字符串表示查询根节点
   * @param {Object} res - Express 响应对象
   * @returns {Promise<void>} 返回子节点列表
   */
  static async getChildNodes(req, res) {
    try {
      const { parentId } = req.query;
      // 允许 null、undefined 或空字符串表示查询根节点
      const parent_id =
        parentId === 'null' || parentId === '' || parentId === null || parentId === undefined
          ? null
          : parentId;
      const children = await SystemLevelDesignTreeService.getChildNodes(parent_id);
      res.apiSuccess(children);
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 创建节点（支持单个和批量，入参统一为数组）
   * @param {Object} req - Express 请求对象
   * @param {Object|Array} req.body - 节点数据或节点数据数组
   * @param {Object} res - Express 响应对象
   * @returns {Promise<void>} 返回创建结果
   */
  static async createNodeList(req, res) {
    try {
      const dataList = Array.isArray(req.body) ? req.body : [req.body];

      // 验证 data_list
      if (!Array.isArray(dataList) || dataList.length === 0) {
        return res.apiError(null, '参数必须是非空数组');
      }

      // 验证每个节点项
      for (const item of dataList) {
        // 验证必填字段
        if (!item.node_type_id) {
          return res.apiError(null, '节点类型ID不能为空');
        }
        if (!item.properties || typeof item.properties !== 'object') {
          return res.apiError(null, '节点属性不能为空且必须是对象');
        }
        if (Object.keys(item.properties).length === 0) {
          return res.apiError(null, '节点属性不能为空对象');
        }

        // 验证 description 长度（如果提供）
        if (item.description !== undefined && item.description !== null) {
          if (typeof item.description !== 'string') {
            return res.apiError(null, '节点描述必须是字符串');
          }
          if (item.description.length > 500) {
            return res.apiError(null, '节点描述长度不能超过500个字符');
          }
        }
      }

      const result = await SystemLevelDesignTreeService.createNodeList(dataList);
      res.apiSuccess(result);
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 更新节点（支持单个和批量，入参统一为数组）
   * PUT /nodes/update
   * @param {Object} req - Express 请求对象
   * @param {Object|Array} req.body - 节点数据或节点数据数组
   * @param {Object} res - Express 响应对象
   * @returns {Promise<void>} 返回更新结果
   */
  static async updateNodeList(req, res) {
    logger.info('[Controller.updateNodeList] 收到请求，req.body:', JSON.stringify(req.body));
    try {
      const dataList = Array.isArray(req.body) ? req.body : [req.body];
      logger.info('[Controller.updateNodeList] dataList:', JSON.stringify(dataList));
      const result = await SystemLevelDesignTreeService.updateNodeList(dataList);
      logger.info('[Controller.updateNodeList] Service 返回 result:', JSON.stringify(result));
      res.apiSuccess(result);
    } catch (error) {
      logger.error('[Controller.updateNodeList] 错误:', error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 删除节点（支持单个和批量，入参为 { ids: [...] }）
   * @param {Object} req - Express 请求对象
   * @param {Object} req.body - 请求体
   * @param {string|Array} req.body.ids - 节点ID或节点ID数组
   * @param {Object} res - Express 响应对象
   * @returns {Promise<void>} 返回删除结果
   */
  static async deleteNodeList(req, res) {
    try {
      const { ids } = req.body;

      // 验证 ids 参数
      if (!ids) {
        return res.apiError(null, '缺少必填参数: ids');
      }
      const idList = Array.isArray(ids) ? ids : [ids];
      // 允许空数组（幂等删除）

      const result = await SystemLevelDesignTreeService.deleteNodeList(idList);
      res.apiSuccess(result);
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }
}

module.exports = SystemLevelDesignTreeController;
