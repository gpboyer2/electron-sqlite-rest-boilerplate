/**
 * @file       hierarchy.js
 * @brief      层级结构控制器，负责处理层级类型和层级节点的管理HTTP请求
 * @date       2025-11-28
 * @copyright  Copyright (c) 2025
 */

const log4js = require('../../middleware/log4jsPlus');
const logger = log4js.getLogger('default');
const HierarchyService = require('../services/hierarchy');

class HierarchyController {
  /**
   * 获取所有层级类型
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @returns {Promise<void>}
   */
  static async getAllNodeTypes(req, res) {
    try {
      const nodeTypes = await HierarchyService.getAllNodeTypes();
      res.apiSuccess(nodeTypes);
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 获取单个层级类型
   * GET /api/hierarchy-levels/detail  params: { id }
   * @param {Object} req - 请求对象
   * @param {Object} req.query - 查询参数
   * @param {string} req.query.id - 层级类型ID
   * @param {Object} res - 响应对象
   * @returns {Promise<void>}
   */
  static async getNodeTypeById(req, res) {
    try {
      const { id } = req.query;
      if (!id) {
        return res.apiError(null, '缺少必填参数: id');
      }
      const nodeType = await HierarchyService.getNodeTypeById(id);
      if (!nodeType) {
        return res.apiError(null, '层级类型不存在');
      }
      res.apiSuccess(nodeType);
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 创建层级类型
   * @param {Object} req - 请求对象
   * @param {Object} req.body - 请求体
   * @param {Object} res - 响应对象
   * @returns {Promise<void>}
   */
  static async createNodeType(req, res) {
    try {
      const result = await HierarchyService.createNodeType(req.body);
      res.apiSuccess(result);
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 更新层级类型
   * POST /api/hierarchy-levels/update  body: { id, name, description, level, fields }
   * @param {Object} req - 请求对象
   * @param {Object} req.body - 请求体
   * @param {string} req.body.id - 层级类型ID
   * @param {string} req.body.name - 层级类型名称
   * @param {string} req.body.description - 层级类型描述
   * @param {number} req.body.level - 层级
   * @param {Array} req.body.fields - 字段列表
   * @param {Object} res - 响应对象
   * @returns {Promise<void>}
   */
  static async updateNodeType(req, res) {
    try {
      const { id } = req.body;
      if (!id) {
        return res.apiError(null, '缺少必填字段: id');
      }
      const result = await HierarchyService.updateNodeType(id, req.body);
      res.apiSuccess(result);
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 删除层级类型
   * POST /api/hierarchy-levels/delete  body: { id }
   * @param {Object} req - 请求对象
   * @param {Object} req.body - 请求体
   * @param {string} req.body.id - 层级类型ID
   * @param {Object} res - 响应对象
   * @returns {Promise<void>}
   */
  static async deleteNodeType(req, res) {
    try {
      const { id } = req.body;
      if (!id) {
        return res.apiError(null, '缺少必填字段: id');
      }
      await HierarchyService.deleteNodeType(id);
      res.apiSuccess({ message: '删除成功' });
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 为层级添加字段
   * POST /api/hierarchy-levels/add-field  body: { id, name, type, required, description }
   * @param {Object} req - 请求对象
   * @param {Object} req.body - 请求体
   * @param {string} req.body.id - 层级类型ID
   * @param {string} req.body.name - 字段名称
   * @param {string} req.body.type - 字段类型
   * @param {boolean} req.body.required - 是否必填
   * @param {string} req.body.description - 字段描述
   * @param {Object} res - 响应对象
   * @returns {Promise<void>}
   */
  static async createNodeTypeField(req, res) {
    try {
      const { id } = req.body;
      if (!id) {
        return res.apiError(null, '缺少必填字段: id');
      }
      const result = await HierarchyService.createNodeTypeField(id, req.body);
      res.apiSuccess(result);
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 更新层级字段
   * POST /api/hierarchy-levels/update-field  body: { id, field_id, name, type, required, description }
   * @param {Object} req - 请求对象
   * @param {Object} req.body - 请求体
   * @param {string} req.body.id - 层级类型ID
   * @param {string} req.body.field_id - 字段ID
   * @param {string} req.body.name - 字段名称
   * @param {string} req.body.type - 字段类型
   * @param {boolean} req.body.required - 是否必填
   * @param {string} req.body.description - 字段描述
   * @param {Object} res - 响应对象
   * @returns {Promise<void>}
   */
  static async updateNodeTypeField(req, res) {
    try {
      const { field_id } = req.body;
      if (!field_id) {
        return res.apiError(null, '缺少必填字段: field_id');
      }
      const result = await HierarchyService.updateNodeTypeField(field_id, req.body);
      res.apiSuccess(result);
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 删除层级字段
   * POST /api/hierarchy-levels/delete-field  body: { id, field_id }
   * @param {Object} req - 请求对象
   * @param {Object} req.body - 请求体
   * @param {string} req.body.id - 层级类型ID
   * @param {string} req.body.field_id - 字段ID
   * @param {Object} res - 响应对象
   * @returns {Promise<void>}
   */
  static async deleteNodeTypeField(req, res) {
    try {
      const { field_id } = req.body;
      if (!field_id) {
        return res.apiError(null, '缺少必填字段: field_id');
      }
      await HierarchyService.deleteNodeTypeField(field_id);
      res.apiSuccess({ message: '删除成功' });
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 获取层级节点树
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @returns {Promise<void>}
   */
  static async getHierarchyTree(req, res) {
    try {
      const tree = await HierarchyService.getHierarchyTree();
      res.apiSuccess(tree);
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 获取所有层级节点
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @returns {Promise<void>}
   */
  static async getAllHierarchyNodes(req, res) {
    try {
      const nodes = await HierarchyService.getAllHierarchyNodes();
      res.apiSuccess(nodes);
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 获取单个层级节点
   * GET /api/hierarchy-nodes/detail  params: { id }
   * @param {Object} req - 请求对象
   * @param {Object} req.query - 查询参数
   * @param {string} req.query.id - 层级节点ID
   * @param {Object} res - 响应对象
   * @returns {Promise<void>}
   */
  static async getHierarchyNodeById(req, res) {
    try {
      const { id } = req.query;
      if (!id) {
        return res.apiError(null, '缺少必填参数: id');
      }
      const node = await HierarchyService.getHierarchyNodeById(id);
      if (!node) {
        return res.apiError(null, '层级节点不存在');
      }
      res.apiSuccess(node);
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 创建层级节点
   * @param {Object} req - 请求对象
   * @param {Object} req.body - 请求体
   * @param {string} req.body.node_type_id - 节点类型ID
   * @param {string} req.body.name - 节点名称
   * @param {string} req.body.parent_id - 父节点ID
   * @param {Object} res - 响应对象
   * @returns {Promise<void>}
   */
  static async createHierarchyNode(req, res) {
    try {
      const { node_type_id, name, parent_id } = req.body;

      // 验证必填字段
      if (!node_type_id) {
        return res.apiError(null, '节点类型ID不能为空');
      }

      // 验证 name（如果提供）
      if (name !== undefined && name !== null) {
        if (typeof name !== 'string') {
          return res.apiError(null, '节点名称必须是字符串');
        }
        if (name === '') {
          return res.apiError(null, '节点名称不能为空字符串');
        }
        if (name.length > 100) {
          return res.apiError(null, '节点名称长度不能超过100个字符');
        }
      }

      // 验证 parent_id（如果提供）
      if (parent_id !== undefined && parent_id !== null && parent_id !== '') {
        if (typeof parent_id !== 'string') {
          return res.apiError(null, '父节点ID必须是字符串');
        }
      }

      const result = await HierarchyService.createHierarchyNode(req.body);
      res.apiSuccess(result);
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 更新层级节点
   * POST /api/hierarchy-nodes/update  body: { id, name, parent_id, data }
   * @param {Object} req - 请求对象
   * @param {Object} req.body - 请求体
   * @param {string} req.body.id - 节点ID
   * @param {string} req.body.name - 节点名称
   * @param {string} req.body.parent_id - 父节点ID
   * @param {Object} req.body.data - 节点数据
   * @param {Object} res - 响应对象
   * @returns {Promise<void>}
   */
  static async updateHierarchyNode(req, res) {
    try {
      const { id } = req.body;
      if (!id) {
        return res.apiError(null, '缺少必填字段: id');
      }
      const result = await HierarchyService.updateHierarchyNode(id, req.body);
      res.apiSuccess(result);
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 删除层级节点
   * POST /api/hierarchy-nodes/delete  body: { id }
   * @param {Object} req - 请求对象
   * @param {Object} req.body - 请求体
   * @param {string} req.body.id - 节点ID
   * @param {Object} res - 响应对象
   * @returns {Promise<void>}
   */
  static async deleteHierarchyNode(req, res) {
    try {
      const { id } = req.body;
      if (!id) {
        return res.apiError(null, '缺少必填字段: id');
      }
      await HierarchyService.deleteHierarchyNode(id);
      res.apiSuccess({ message: '删除成功' });
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }
}

module.exports = HierarchyController;
