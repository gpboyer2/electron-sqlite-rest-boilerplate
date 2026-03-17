/**
 * @file       topology.js
 * @brief      拓扑展示控制器，纯展示用，基于体系配置和通信节点动态组装数据
 * @date       2025-11-28
 * @copyright  Copyright (c) 2025
 */

const log4js = require('../../middleware/log4jsPlus');
const logger = log4js.getLogger('default');
const TopologyService = require('../services/topology');

class TopologyController {
  /**
   * 获取所有节点（含动态生成的拓扑连线）
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @returns {void}
   */
  static async getAllTopologyNodes(req, res) {
    try {
      const result = await TopologyService.getAllTopologyNodes();
      res.apiSuccess(result);
    } catch (error) {
      logger.error(error);
      res.apiError(null, '服务器内部错误');
    }
  }
}

module.exports = TopologyController;
