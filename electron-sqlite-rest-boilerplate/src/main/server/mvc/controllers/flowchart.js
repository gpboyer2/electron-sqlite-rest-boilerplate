/**
 * @file       flowchart.js
 * @brief      流程图控制器，负责处理流程图保存、加载和通信节点管理的HTTP请求
 * @date       2025-11-28
 * @copyright  Copyright (c) 2025
 */
const log4js = require('../../middleware/log4jsPlus');
const logger = log4js.getLogger('default');
const FlowchartService = require('../services/flowchart');

class FlowchartController {
  /**
   * 保存流程图
   * @param {Object} req - Express请求对象
   * @param {Object} req.body - 请求体
   * @param {string} req.body.arch_node_id - 体系节点ID
   * @param {Object} res - Express响应对象
   * @returns {void} 返回保存结果
   */
  static async saveFlowchart(req, res) {
    try {
      const { arch_node_id } = req.body;
      if (!arch_node_id) {
        return res.apiError(null, '缺少必填参数: arch_node_id');
      }
      const result = await FlowchartService.saveFlowchart(req.body);
      res.apiSuccess(result);
    } catch (error) {
      logger.error(error);
      res.apiError(null, error.message || '服务器内部错误');
    }
  }

  /**
   * 根据体系节点ID加载流程图
   * @param {Object} req - Express请求对象
   * @param {Object} req.query - 查询参数
   * @param {string} req.query.arch_node_id - 体系节点ID
   * @param {Object} res - Express响应对象
   * @returns {void} 返回流程图数据
   */
  static async loadFlowchartByArchNodeId(req, res) {
    try {
      const { arch_node_id } = req.query;
      if (!arch_node_id) {
        return res.apiError(null, '缺少必填参数: arch_node_id');
      }
      const result = await FlowchartService.loadFlowchartByArchNodeId(arch_node_id);
      res.apiSuccess(result);
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 根据通信节点ID加载流程图
   * @param {Object} req - Express请求对象
   * @param {Object} req.query - 查询参数
   * @param {string} req.query.comm_node_id - 通信节点ID
   * @param {Object} res - Express响应对象
   * @returns {void} 返回流程图数据
   */
  static async loadFlowchartByCommNodeId(req, res) {
    try {
      const { comm_node_id } = req.query;
      if (!comm_node_id) {
        return res.apiError(null, '缺少必填参数: comm_node_id');
      }
      const result = await FlowchartService.loadFlowchartByCommNodeId(comm_node_id);
      res.apiSuccess(result);
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 根据体系节点ID获取通信节点列表
   * @param {Object} req - Express请求对象
   * @param {Object} req.query - 查询参数
   * @param {string} req.query.arch_node_id - 体系节点ID
   * @param {Object} res - Express响应对象
   * @returns {void} 返回通信节点列表
   */
  static async getCommNodeListByArchNodeId(req, res) {
    try {
      const { arch_node_id } = req.query;
      if (!arch_node_id) {
        return res.apiError(null, '缺少必填参数: arch_node_id');
      }
      const result = await FlowchartService.getCommNodeListByArchNodeId(arch_node_id);
      res.apiSuccess(result);
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }

  /**
   * 删除通信节点（同时删除关联的流程图）
   * @param {Object} req - Express请求对象
   * @param {Object} req.body - 请求体
   * @param {string} req.body.comm_node_id - 通信节点ID
   * @param {Object} res - Express响应对象
   * @returns {void} 返回删除结果
   */
  static async deleteCommNode(req, res) {
    try {
      const { comm_node_id } = req.body;
      if (!comm_node_id) {
        return res.apiError(null, '缺少必填字段: comm_node_id');
      }
      const result = await FlowchartService.deleteCommNode(comm_node_id);
      res.apiSuccess(result);
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }
}

module.exports = FlowchartController;
