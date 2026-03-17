/**
 * @file       communicationNode.js
 * @brief      通信节点控制器，处理通信节点相关的HTTP请求
 * @date       2025-12-25
 */

const CommunicationNodeService = require('../services/communicationNode');
const { isValidValue } = require('../../utils/string');

class CommunicationNodeController {
  /**
   * 查询通信节点（支持过滤）
   * @param {Object} req - Express请求对象
   * @param {Object} req.query - 查询参数
   * @param {string} [req.query.node_id] - 节点ID（可选）
   * @param {string} [req.query.include_endpoints] - 是否包含接口端点信息（可选）
   * @param {Object} res - Express响应对象
   * @returns {void} 返回通信节点列表
   */
  static async queryNodes(req, res) {
    try {
      const { node_id, include_endpoints } = req.query;
      const options = {
        node_id,
        include_endpoints: include_endpoints !== 'false'
      };
      const nodeList = await CommunicationNodeService.queryNodes(options);
      res.apiSuccess(nodeList);
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 根据层级节点ID获取通信节点列表
   * @param {Object} req - Express请求对象
   * @param {Object} req.query - 查询参数
   * @param {string} req.query.node_id - 层级节点ID
   * @param {Object} res - Express响应对象
   * @returns {void} 返回通信节点列表
   */
  static async getNodeListByNodeId(req, res) {
    try {
      const { node_id } = req.query;
      if (!node_id) {
        return res.apiError(null, '缺少必填参数: node_id');
      }
      // 校验 node_id 不是 NaN 或无效值
      if (!isValidValue(node_id)) {
        return res.apiSuccess([]); // 返回空数组而不是报错
      }
      const nodeList = await CommunicationNodeService.getNodeListByNodeId(node_id);
      res.apiSuccess(nodeList);
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 确保"节点接口容器行"存在
   * @param {Object} req - Express请求对象
   * @param {Object} req.body - 请求体
   * @param {string} req.body.node_id - 层级节点ID
   * @param {Object} res - Express响应对象
   * @returns {void} 返回创建或获取的节点接口容器
   */
  static async ensureNodeInterfaceContainer(req, res) {
    try {
      const { node_id } = req.body;
      if (!node_id) {
        return res.apiError(null, '缺少必填参数: node_id');
      }
      // 校验 node_id 不是 NaN 或无效值
      if (!isValidValue(node_id)) {
        return res.apiError(null, '无效的 node_id 参数: 不能为 NaN');
      }
      const result = await CommunicationNodeService.ensureNodeInterfaceContainer(node_id);
      res.apiSuccess(result);
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 更新通信节点
   * @param {Object} req - Express请求对象
   * @param {Object} req.body - 请求体
   * @param {number} req.body.id - 节点ID
   * @param {string} [req.body.name] - 节点名称（可选）
   * @param {Object} res - Express响应对象
   * @returns {void} 返回更新后的通信节点
   */
  static async updateNode(req, res) {
    try {
      const { id } = req.body;
      if (!id) {
        return res.apiError(null, '缺少必填字段: id');
      }
      const data = req.body;

      // 检查节点是否存在
      const existing = await CommunicationNodeService.getCommunicationNodeById(id);
      if (!existing) {
        return res.apiError(null, '通信节点不存在');
      }

      const node = await CommunicationNodeService.updateNode(id, data);
      res.apiSuccess(node);
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 更新通信节点的接口连接信息
   * @param {Object} req - Express请求对象
   * @param {Object} req.body - 请求体
   * @param {number} req.body.id - 节点ID
   * @param {Array|null} req.body.endpoint_description - 接口连接描述数组或null
   * @param {Object} res - Express响应对象
   * @returns {void} 返回更新后的通信节点
   */
  static async updateEndpointDescription(req, res) {
    try {
      const { id, endpoint_description } = req.body;
      if (!id) {
        return res.apiError(null, '缺少必填字段: id');
      }

      // 检查节点是否存在
      const existing = await CommunicationNodeService.getCommunicationNodeById(id);
      if (!existing) {
        return res.apiError(null, '通信节点不存在');
      }

      // 校验 endpoint_description 格式
      if (endpoint_description !== null && !Array.isArray(endpoint_description)) {
        return res.apiError(null, 'endpoint_description 必须是数组格式');
      }

      const node = await CommunicationNodeService.updateEndpointDescription(
        id,
        endpoint_description
      );
      res.apiSuccess(node);
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 删除通信节点
   * @param {Object} req - Express请求对象
   * @param {Object} req.body - 请求体
   * @param {number[]} req.body.data - 节点ID数组（支持批量删除）
   * @param {Object} res - Express响应对象
   * @returns {void} 返回删除结果
   */
  static async delete(req, res) {
    try {
      const { data } = req.body;

      if (!Array.isArray(data) || data.length === 0) {
        return res.apiError(null, '缺少必填字段: data（必须是非空数组）');
      }

      const result = await CommunicationNodeService.delete(data);
      res.apiSuccess(result);
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 建立通信节点连接
   * @param {Object} req - Express请求对象
   * @param {Object} req.body - 请求体
   * @param {number} req.body.id - 节点ID
   * @param {Object} res - Express响应对象
   * @returns {void} 返回连接结果
   */
  static async connectNode(req, res) {
    try {
      const { id } = req.body;
      if (!id) {
        return res.apiError(null, '缺少必填字段: id');
      }
      const result = await CommunicationNodeService.connectNode(id);
      res.apiSuccess(result);
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 断开通信节点连接
   * @param {Object} req - Express请求对象
   * @param {Object} req.body - 请求体
   * @param {number} req.body.id - 节点ID
   * @param {Object} res - Express响应对象
   * @returns {void} 返回断开连接结果
   */
  static async disconnectNode(req, res) {
    try {
      const { id } = req.body;
      if (!id) {
        return res.apiError(null, '缺少必填字段: id');
      }
      const result = await CommunicationNodeService.disconnectNode(id);
      res.apiSuccess(result);
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 获取通信节点连接状态
   * @param {Object} req - Express请求对象
   * @param {Object} req.query - 查询参数
   * @param {string} req.query.id - 节点ID
   * @param {Object} res - Express响应对象
   * @returns {void} 返回连接状态信息
   */
  static async getConnectionStatus(req, res) {
    try {
      const { id } = req.query;
      if (!id) {
        return res.apiError(null, '缺少必填参数: id');
      }
      const status = await CommunicationNodeService.getConnectionStatus(id);
      res.apiSuccess(status);
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 添加报文关联到接口
   * @param {Object} req - Express请求对象
   * @param {Object} req.body - 请求体
   * @param {string} req.body.node_id - 节点ID
   * @param {string} req.body.interface_id - 接口ID
   * @param {number} req.body.packet_id - 报文ID
   * @param {string} [req.body.direction] - 方向（input/output，默认input）
   * @param {Object} res - Express响应对象
   * @returns {void} 返回创建的报文关联
   */
  static async createPacketRef(req, res) {
    try {
      const { node_id, interface_id, packet_id, direction } = req.body;
      if (!node_id) {
        return res.apiError(null, '缺少必填参数: node_id');
      }
      // 校验 node_id 不是 NaN 或无效值
      if (!isValidValue(node_id)) {
        return res.apiError(null, '无效的 node_id 参数: 不能为 NaN');
      }
      if (!interface_id) {
        return res.apiError(null, '缺少必填参数: interface_id');
      }
      if (packet_id === undefined || packet_id === null) {
        return res.apiError(null, '缺少必填参数: packet_id');
      }

      const result = await CommunicationNodeService.createPacketRef(
        node_id,
        interface_id,
        Number(packet_id),
        direction || 'input'
      );
      res.apiSuccess(result);
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 从接口移除报文关联
   * @param {Object} req - Express请求对象
   * @param {Object} req.body - 请求体
   * @param {string} req.body.node_id - 节点ID
   * @param {string} req.body.interface_id - 接口ID
   * @param {number} req.body.packet_id - 报文ID
   * @param {Object} res - Express响应对象
   * @returns {void} 返回删除结果
   */
  static async deletePacketRef(req, res) {
    try {
      const { node_id, interface_id, packet_id } = req.body;
      if (!node_id) {
        return res.apiError(null, '缺少必填参数: node_id');
      }
      // 校验 node_id 不是 NaN 或无效值
      if (!isValidValue(node_id)) {
        return res.apiError(null, '无效的 node_id 参数: 不能为 NaN');
      }
      if (!interface_id) {
        return res.apiError(null, '缺少必填参数: interface_id');
      }
      if (packet_id === undefined || packet_id === null) {
        return res.apiError(null, '缺少必填参数: packet_id');
      }

      const result = await CommunicationNodeService.deletePacketRef(
        node_id,
        interface_id,
        Number(packet_id)
      );
      res.apiSuccess(result);
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 根据接口ID获取报文引用列表
   * @param {Object} req - Express请求对象
   * @param {Object} req.query - 查询参数
   * @param {string} req.query.node_id - 节点ID
   * @param {string} req.query.interface_id - 接口ID
   * @param {Object} res - Express响应对象
   * @returns {void} 返回报文引用列表
   */
  static async queryPacketRefsByInterface(req, res) {
    try {
      const { node_id, interface_id } = req.query;
      if (!node_id) {
        return res.apiError(null, '缺少必填参数: node_id');
      }
      // 校验 node_id 不是 NaN 或无效值
      if (!isValidValue(node_id)) {
        return res.apiSuccess([]); // 返回空数组而不是报错
      }
      if (!interface_id) {
        return res.apiError(null, '缺少必填参数: interface_id');
      }

      const packetRefList = await CommunicationNodeService.queryPacketRefsByInterface(
        node_id,
        interface_id
      );
      res.apiSuccess(packetRefList);
    } catch (error) {
      res.apiError(null, error.message);
    }
  }
}

module.exports = CommunicationNodeController;
