/**
 * @file communicationNode.js
 * @brief 通信节点服务，处理通信节点的业务逻辑，包括接口连接信息（endpoint_description）的管理
 * @date 2025-12-25
 */

const { v4: uuidv4 } = require('uuid');
const CommunicationNodeModel = require('../models/communicationNode');
const { connectionManager, ConnectionStatus } = require('./connectionManager');
const PacketMessageModel = require('../models/packetMessage');
const { isValidValue } = require('../../utils/string');

class CommunicationNodeService {
  /**
   * 根据ID获取通信节点
   * @param {string} id 通信节点ID
   * @returns {object|null} 通信节点数据，不存在时返回 null
   */
  static async getCommunicationNodeById(id) {
    try {
      return await CommunicationNodeModel.findById(id);
    } catch (error) {
      throw new Error('getCommunicationNodeById Failed: ' + error.message);
    }
  }

  /**
   * 创建通信节点
   * @param {object} data 节点数据
   * @returns {object} 创建的节点数据
   */
  static async createNode(data) {
    try {
      // id 是 STRING 类型主键，需要显式生成 UUID
      const node_id = uuidv4();
      await CommunicationNodeModel.create({ ...data, id: node_id });
      // 创建后用生成的 id 直接查询获取完整数据
      return await CommunicationNodeModel.findById(node_id);
    } catch (error) {
      throw new Error('createNode Failed: ' + error.message);
    }
  }

  /**
   * 确保"节点接口容器行"存在（一行对应一个层级节点）
   * - communication_nodes.node_id = 层级节点ID
   * - endpoint_description 数组中每个元素代表一个接口
   * @param {string} nodeId 层级节点ID
   */
  static async ensureNodeInterfaceContainer(nodeId) {
    const node_id = typeof nodeId === 'string' ? nodeId.trim() : '';
    if (!isValidValue(node_id)) {
      throw new Error('缺少必填参数: node_id');
    }

    const nodeList = await CommunicationNodeModel.findByNodeId(nodeId);
    const existing = (Array.isArray(nodeList) ? nodeList : []).find((n) => {
      const cfg = n?.config;
      return cfg && typeof cfg === 'object' && cfg.is_node_interface_container === true;
    });
    if (existing) {
      // 兼容旧数据：如果 id 为 null，生成新的 id 并更新数据库
      if (!existing.id) {
        const newId = uuidv4();
        // 用 node_id 和 name 定位记录并更新 id（通过 Model 层）
        await CommunicationNodeModel.updateByNodeIdAndName(node_id, existing.name, { id: newId });
        existing.id = newId;
      }
      // 过滤掉已删除报文的引用
      return await this._filterDeletedPacketRefs(existing);
    }

    // 创建容器行：name 仅用于满足非空约束与唯一索引
    const created = await this.createNode({
      node_id,
      name: `节点接口列表_${node_id}`,
      endpoint_description: [],
      config: { is_node_interface_container: true }
    });
    return created;
  }

  /**
   * 过滤掉已删除报文的引用
   * @param {object} node 通信节点数据
   * @returns {object} 过滤后的节点数据
   */
  static async _filterDeletedPacketRefs(node) {
    const endpoint_list = node.endpoint_description || [];
    if (!Array.isArray(endpoint_list) || endpoint_list.length === 0) {
      return node;
    }

    // 收集所有引用的 packet_id
    const all_packet_ids = new Set();
    for (const endpoint of endpoint_list) {
      const packet_ref_list = endpoint.packet_ref_list || [];
      if (Array.isArray(packet_ref_list)) {
        for (const ref of packet_ref_list) {
          const packet_id = ref.packet_id == null ? null : Number(ref.packet_id);
          // 只添加有效的正整数 ID
          if (packet_id != null && Number.isFinite(packet_id) && packet_id > 0) {
            all_packet_ids.add(packet_id);
          }
        }
      }
    }

    // 如果没有报文引用，直接返回
    if (all_packet_ids.size === 0) {
      return node;
    }

    // 查询哪些报文还存在（使用 findByIds 方法）
    const existing_packets = await PacketMessageModel.findByIds(Array.from(all_packet_ids));
    const existing_packet_id_set = new Set(existing_packets.map((p) => Number(p.id)));

    // 过滤 packet_ref_list，只保留存在的报文
    let has_changes = false;
    for (const endpoint of endpoint_list) {
      const packet_ref_list = endpoint.packet_ref_list || [];
      if (Array.isArray(packet_ref_list)) {
        const original_length = packet_ref_list.length;
        endpoint.packet_ref_list = packet_ref_list.filter((ref) =>
          existing_packet_id_set.has(Number(ref.packet_id))
        );
        if (original_length !== endpoint.packet_ref_list.length) {
          has_changes = true;
        }
      }
    }

    // 如果有变化，更新数据库
    if (has_changes) {
      await CommunicationNodeModel.update(node.id, { endpoint_description: endpoint_list });
      // 更新内存中的数据
      node.endpoint_description = endpoint_list;
    }

    return node;
  }

  /**
   * 查询通信节点（支持过滤）
   * GET /api/communication-nodes/query
   * @param {object} options 查询选项 { node_id, include_endpoints }
   */
  static async queryNodes(options = {}) {
    try {
      const { node_id, include_endpoints = true } = options;
      let nodeList = await CommunicationNodeModel.findAll();

      // 过滤 node_id
      if (node_id) {
        nodeList = nodeList.filter((n) => n.node_id === node_id);
      }

      // 默认只返回节点接口容器行（config.is_node_interface_container === true）
      const filteredList = nodeList.filter((n) => {
        const cfg = n?.config;
        return cfg && typeof cfg === 'object' && cfg.is_node_interface_container === true;
      });

      // 如果不需要返回 endpoint_detail，清理掉大字段
      if (!include_endpoints) {
        return filteredList.map((n) => ({
          ...n,
          endpoint_description: undefined
        }));
      }

      return filteredList;
    } catch (error) {
      throw new Error('queryNodes Failed: ' + error.message);
    }
  }

  /**
   * 根据层级节点ID获取通信节点列表
   * @param {string} nodeId 层级节点ID（arch_tree_nodes.id）
   */
  static async getNodeListByNodeId(nodeId) {
    try {
      // 新语义：一个层级节点一行（容器行），接口列表存储在 endpoint_description 数组中
      const container = await this.ensureNodeInterfaceContainer(nodeId);
      return container ? [container] : [];
    } catch (error) {
      throw new Error('getNodeListByNodeId Failed: ' + error.message);
    }
  }

  /**
   * 更新通信节点
   * @param {string} id 通信节点ID
   * @param {object} data 更新数据
   */
  static async updateNode(id, data) {
    try {
      const now = Date.now();
      const updateData = {
        updated_at: now
      };

      if (data.name !== undefined) {
        updateData.name = data.name;
      }
      if (data.endpoint_description !== undefined) {
        updateData.endpoint_description = data.endpoint_description;
      }
      if (data.status !== undefined) {
        updateData.status = data.status;
      }
      if (data.config !== undefined) {
        updateData.config = data.config;
      }
      if (data.flow_version !== undefined) {
        updateData.flow_version = data.flow_version;
      }

      await CommunicationNodeModel.update(id, updateData);
      return this.getCommunicationNodeById(id);
    } catch (error) {
      throw new Error('updateNode Failed: ' + error.message);
    }
  }

  /**
   * 更新通信节点的接口连接信息
   * @param {string} id 通信节点ID
   * @param {Array} endpointList 端点描述数组
   */
  static async updateEndpointDescription(id, endpointList) {
    try {
      const now = Date.now();
      // 调试日志：验证后端接收到的数据
      console.log(
        '[updateEndpointDescription] Saving endpoint_description:',
        JSON.stringify(endpointList, null, 2)
      );
      await CommunicationNodeModel.update(id, {
        endpoint_description: endpointList,
        updated_at: now
      });
      const result = await this.getCommunicationNodeById(id);
      console.log(
        '[updateEndpointDescription] Saved result:',
        JSON.stringify(result?.endpoint_description, null, 2)
      );
      return result;
    } catch (error) {
      throw new Error('updateEndpointDescription Failed: ' + error.message);
    }
  }

  /**
   * 删除通信节点
   * @param {Array<string>} idList 通信节点ID数组，入参为数组，天然支持批量操作
   */
  static async delete(idList) {
    try {
      if (!Array.isArray(idList) || idList.length === 0) {
        throw new Error('idList 必须是非空数组');
      }

      const result = await CommunicationNodeModel.delete(idList);
      return {
        success: true,
        count: result.changes,
        deleted_count: result.changes
      };
    } catch (error) {
      throw new Error('delete Failed: ' + error.message);
    }
  }

  /**
   * 建立通信节点连接
   * @param {string} id 通信节点ID
   */
  static async connectNode(id) {
    try {
      const node = await this.getCommunicationNodeById(id);
      if (!node) {
        throw new Error('通信节点不存在');
      }

      const endpointList = node.endpoint_description;

      if (!endpointList || endpointList.length === 0) {
        throw new Error('通信节点没有配置端点信息，请先配置连接参数');
      }

      const results = [];
      for (const endpoint of endpointList) {
        try {
          const result = await connectionManager.connect(id, endpoint);
          results.push({
            endpoint: endpoint.type,
            success: true,
            message: result.message
          });
        } catch (err) {
          results.push({
            endpoint: endpoint.type,
            success: false,
            message: err.message
          });
        }
      }

      const allSuccess = results.every((r) => r.success);
      await CommunicationNodeModel.update(id, {
        status: allSuccess ? 'active' : 'error',
        updated_at: Date.now()
      });

      return {
        node_id: id,
        node_name: node.name,
        status: allSuccess ? ConnectionStatus.CONNECTED : ConnectionStatus.ERROR,
        results
      };
    } catch (error) {
      throw new Error('connectNode Failed: ' + error.message);
    }
  }

  /**
   * 断开通信节点连接
   * @param {string} id 通信节点ID
   */
  static async disconnectNode(id) {
    try {
      const node = await this.getCommunicationNodeById(id);
      if (!node) {
        throw new Error('通信节点不存在');
      }

      const result = await connectionManager.disconnect(id);

      await CommunicationNodeModel.update(id, {
        status: 'inactive',
        updated_at: Date.now()
      });

      return {
        node_id: id,
        ...result
      };
    } catch (error) {
      throw new Error('disconnectNode Failed: ' + error.message);
    }
  }

  /**
   * 获取通信节点连接状态
   * @param {string} id 通信节点ID
   */
  static async getConnectionStatus(id) {
    try {
      const node = await this.getCommunicationNodeById(id);
      if (!node) {
        throw new Error('通信节点不存在');
      }

      const connectionStatus = connectionManager.getStatus(id);

      return {
        node_id: id,
        node_name: node.name,
        db_status: node.status,
        ...connectionStatus
      };
    } catch (error) {
      throw new Error('getConnectionStatus Failed: ' + error.message);
    }
  }

  /**
   * 添加报文关联到接口
   * @param {string} nodeId 层级节点ID（systemNodeId）
   * @param {string} interfaceId 接口ID
   * @param {number} packetId 报文ID
   * @param {string} direction 方向（input/output）
   */
  static async createPacketRef(nodeId, interfaceId, packetId, direction) {
    try {
      const node = await this.ensureNodeInterfaceContainer(nodeId);
      if (!node) {
        throw new Error('节点不存在');
      }

      const endpointList = Array.isArray(node.endpoint_description) ? node.endpoint_description : [];
      const endpoint = endpointList.find(
        (e) => String(e?.interface_id || '').trim() === String(interfaceId)
      );

      // 接口不存在则报错
      if (!endpoint) {
        throw new Error(`接口 ${interfaceId} 不存在，请先创建接口`);
      }

      // 初始化 packet_ref_list
      if (!Array.isArray(endpoint.packet_ref_list)) {
        endpoint.packet_ref_list = [];
      }

      // 检查是否已存在
      const existedIndex = endpoint.packet_ref_list.findIndex((r) => r.packet_id === packetId);
      if (existedIndex >= 0) {
        // 已存在，更新方向
        endpoint.packet_ref_list[existedIndex].direction = direction;
      } else {
        // 不存在，添加
        endpoint.packet_ref_list.push({ packet_id: packetId, direction });
      }

      // 保存到数据库
      await this.updateEndpointDescription(node.id, endpointList);

      return {
        success: true,
        packet_ref_list: endpoint.packet_ref_list
      };
    } catch (error) {
      throw new Error('createPacketRef Failed: ' + error.message);
    }
  }

  /**
   * 从接口移除报文关联
   * @param {string} nodeId 层级节点ID（systemNodeId）
   * @param {string} interfaceId 接口ID
   * @param {number} packetId 报文ID
   */
  static async deletePacketRef(nodeId, interfaceId, packetId) {
    try {
      const node = await this.ensureNodeInterfaceContainer(nodeId);
      if (!node) {
        throw new Error('节点不存在');
      }

      const endpointList = Array.isArray(node.endpoint_description) ? node.endpoint_description : [];
      const endpoint = endpointList.find(
        (e) => String(e?.interface_id || '').trim() === String(interfaceId)
      );

      if (!endpoint) {
        throw new Error('接口不存在');
      }

      if (!Array.isArray(endpoint.packet_ref_list)) {
        throw new Error('报文列表为空');
      }

      // 过滤掉要删除的报文
      const originalLength = endpoint.packet_ref_list.length;
      endpoint.packet_ref_list = endpoint.packet_ref_list.filter((r) => r.packet_id !== packetId);

      if (endpoint.packet_ref_list.length === originalLength) {
        throw new Error('报文不存在于列表中');
      }

      // 保存到数据库
      await this.updateEndpointDescription(node.id, endpointList);

      return {
        success: true,
        packet_ref_list: endpoint.packet_ref_list
      };
    } catch (error) {
      throw new Error('deletePacketRef Failed: ' + error.message);
    }
  }

  /**
   * 根据接口ID获取报文引用列表
   * @param {string} nodeId 层级节点ID（systemNodeId）
   * @param {string} interfaceId 接口ID
   * @returns {Promise<Array>} 报文引用列表，格式：[{ packet_id, direction, message_id, topic_name, reliability, durability, ... }]
   */
  static async queryPacketRefsByInterface(nodeId, interfaceId) {
    try {
      const node_id = typeof nodeId === 'string' ? nodeId.trim() : '';
      const interface_id = typeof interfaceId === 'string' ? interfaceId.trim() : '';

      if (!node_id) {
        throw new Error('缺少必填参数: node_id');
      }
      if (!interface_id) {
        throw new Error('缺少必填参数: interface_id');
      }

      const node = await this.ensureNodeInterfaceContainer(node_id);
      if (!node) {
        throw new Error('节点不存在');
      }

      const endpointList = Array.isArray(node.endpoint_description) ? node.endpoint_description : [];
      const endpoint = endpointList.find(
        (e) => String(e?.interface_id || '').trim() === interface_id
      );

      if (!endpoint) {
        throw new Error('接口不存在');
      }

      const packetRefList = Array.isArray(endpoint.packet_ref_list) ? endpoint.packet_ref_list : [];
      return packetRefList;
    } catch (error) {
      throw new Error('queryPacketRefsByInterface Failed: ' + error.message);
    }
  }
}

module.exports = CommunicationNodeService;
