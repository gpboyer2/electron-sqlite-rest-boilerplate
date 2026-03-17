/**
 * @file       flowchart.js
 * @brief      流程图服务，处理流程图保存/加载的业务逻辑
 * @date       2025-11-28
 * @copyright  Copyright (c) 2025
 */
const FlowchartModel = require('../models/flowchart');
const CommunicationNodeModel = require('../models/communicationNode');
const PacketMessageModel = require('../models/packetMessage');
const { analyzeProtocolsForDispatcher } = require('../../plugins/dispatcher-analyzer');

class FlowchartService {
  /**
   * 校验协议节点的报文配置
   * - 节点内只有1个报文：single 模式，不需要 MessageId
   * - 节点内有多个报文：multiple 模式，需要 MessageId 区分报文
   */
  static async validateProtocolNodes(nodes) {
    // 找出协议解析和协议序列化节点
    const protocolNodeList = nodes.filter(
      (node) => node.type === 'parse-node' || node.type === 'serialize-node'
    );

    if (protocolNodeList.length === 0) {
      return { valid: true };
    }

    // 遍历每个协议节点，独立校验
    for (const node of protocolNodeList) {
      const packetIdList = node.properties?.packetIdList || [];

      // 检查节点是否配置了报文
      if (packetIdList.length === 0) {
        const nodeLabel = node.type === 'parse-node' ? '协议解析' : '协议序列化';
        return { valid: false, error: `${nodeLabel}节点未配置报文` };
      }

      // 如果这个节点只有1个报文，走 single 模式，跳过 MessageId 校验
      if (packetIdList.length === 1) {
        continue;
      }

      // 如果这个节点有多个报文，走 multiple 模式，需要校验 MessageId
      const protocolList = [];
      for (const packetId of packetIdList) {
        const packetDetail = await PacketMessageModel.findByIdField(packetId);
        if (!packetDetail) {
          return { valid: false, error: `报文ID "${packetId}" 不存在` };
        }
        protocolList.push({
          name: packetDetail.name,
          defaultByteOrder: packetDetail.defaultByteOrder || 'big',
          fields: packetDetail.fields || []
        });
      }

      // 调用 dispatcher-analyzer 校验 MessageId 配置
      const result = analyzeProtocolsForDispatcher(protocolList);
      if (result.status !== '1') {
        const nodeLabel = node.type === 'parse-node' ? '协议解析' : '协议序列化';
        return {
          valid: false,
          error: `${nodeLabel}节点（包含${packetIdList.length}个报文）需要 MessageId 字段来区分不同报文，但检测到：${result.error_messages}`
        };
      }
    }

    return { valid: true };
  }

  /**
   * 保存流程图
   * - 新增模式（无 comm_node_id）：创建新通信节点 + 新流程图
   * - 编辑模式（有 comm_node_id）：更新已有通信节点的流程图
   */
  static async saveFlowchart(data) {
    try {
      const { arch_node_id, comm_node_id, name, nodes, edges } = data;

      // 校验协议节点配置
      const validation = await this.validateProtocolNodes(nodes || []);
      if (!validation.valid) {
        throw new Error('协议配置校验失败: ' + validation.error);
      }
      const now = Date.now();
      const flowchartName = name || '未命名流程图';

      if (comm_node_id) {
        // 编辑模式：更新已有通信节点的流程图
        const existing = await FlowchartModel.findByCommunicationNodeId(comm_node_id);
        if (existing) {
          await FlowchartModel.update(existing.id, {
            name: flowchartName,
            nodes: nodes || [],
            edges: edges || [],
            updated_at: now
          });
          // 同步更新通信节点名称
          await CommunicationNodeModel.update(comm_node_id, {
            name: flowchartName,
            updated_at: now
          });
          const updated = await FlowchartModel.findById(existing.id);
          return {
            ...updated,
            communication_node_id: comm_node_id,
            nodes: nodes || [],
            edges: edges || []
          };
        }
      }

      // 新增模式：创建新通信节点 + 新流程图
      const flowchartId = `flowchart-${now}-${Math.random().toString(36).substr(2, 9)}`;
      const newCommNodeId = `comm-${now}-${Math.random().toString(36).substr(2, 9)}`;

      // 检查同名通信节点是否已存在，如果存在则添加时间戳后缀
      let uniqueName = flowchartName;
      const existingNode = await CommunicationNodeModel.findByNodeIdAndName(
        arch_node_id,
        flowchartName
      );
      if (existingNode) {
        uniqueName = `${flowchartName}_${now}`;
      }

      // 先创建通信节点
      await CommunicationNodeModel.create({
        id: newCommNodeId,
        node_id: arch_node_id,
        name: uniqueName,
        status: 'active',
        flow_version: '1.0.0',
        created_at: now,
        updated_at: now
      });

      // 再创建流程图，关联通信节点
      await FlowchartModel.create({
        id: flowchartId,
        arch_node_id,
        communication_node_id: newCommNodeId,
        name: flowchartName,
        nodes: nodes || [],
        edges: edges || [],
        created_at: now,
        updated_at: now
      });

      const created = await FlowchartModel.findById(flowchartId);
      return {
        ...created,
        communication_node_id: newCommNodeId,
        nodes: nodes || [],
        edges: edges || []
      };
    } catch (error) {
      throw new Error('saveFlowchart Failed: ' + error.message);
    }
  }

  /**
   * 根据体系节点ID加载流程图
   */
  static async loadFlowchartByArchNodeId(archNodeId) {
    try {
      const flowchart = await FlowchartModel.findByArchNodeId(archNodeId);
      if (!flowchart) return null;

      return {
        ...flowchart,
        nodes: flowchart.nodes || [],
        edges: flowchart.edges || []
      };
    } catch (error) {
      throw new Error('loadFlowchartByArchNodeId Failed: ' + error.message);
    }
  }

  /**
   * 根据通信节点ID加载流程图
   */
  static async loadFlowchartByCommNodeId(commNodeId) {
    try {
      const flowchart = await FlowchartModel.findByCommunicationNodeId(commNodeId);
      if (!flowchart) return null;

      // 同时获取通信节点信息，返回通信节点名称
      const commNode = await CommunicationNodeModel.findById(commNodeId);

      return {
        ...flowchart,
        nodes: flowchart.nodes || [],
        edges: flowchart.edges || [],
        comm_node_name: commNode?.name || '未命名节点'
      };
    } catch (error) {
      throw new Error('loadFlowchartByCommNodeId Failed: ' + error.message);
    }
  }

  /**
   * 根据体系节点ID获取通信节点列表
   */
  static async getCommNodeListByArchNodeId(archNodeId) {
    try {
      const commNodeList = await CommunicationNodeModel.findByNodeId(archNodeId);
      return commNodeList || [];
    } catch (error) {
      throw new Error('getCommNodeListByArchNodeId Failed: ' + error.message);
    }
  }

  /**
   * 删除通信节点（同时删除关联的流程图）
   */
  static async deleteCommNode(commNodeId) {
    try {
      // 先删除关联的流程图
      await FlowchartModel.deleteByCommunicationNodeId(commNodeId);
      // 再删除通信节点
      await CommunicationNodeModel.delete(commNodeId);
      return { success: true };
    } catch (error) {
      throw new Error('deleteCommNode Failed: ' + error.message);
    }
  }
}

module.exports = FlowchartService;
