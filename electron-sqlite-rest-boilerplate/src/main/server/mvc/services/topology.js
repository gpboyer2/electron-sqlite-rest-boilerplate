/**
 * @file       topology.js
 * @brief      拓扑服务，纯展示用
 *             核心功能：根据体系配置和通信节点的 TCP IN/OUT 配置生成拓扑连线
 * @date       2025-11-28
 * @copyright  Copyright (c) 2025
 */
const SystemLevelDesignTreeModel = require('../models/systemLevelDesignTree');
const CommunicationNodeModel = require('../models/communicationNode');
const FlowchartModel = require('../models/flowchart');

class TopologyService {
  /**
   * 获取所有节点（包含动态生成的拓扑连线）
   *
   * 核心逻辑：
   * 1. 从体系配置获取所有节点
   * 2. 获取每个节点的通信节点
   * 3. 从通信节点的流程图中提取 TCP IN/OUT 配置
   * 4. 根据 TCP OUT 的目标地址匹配 TCP IN 的监听地址，生成连线
   */
  static async getAllTopologyNodes(query = {}) {
    try {
      // 获取体系配置的所有节点
      const archNodeList = await SystemLevelDesignTreeModel.findAll();
      // 获取所有通信节点
      const commNodeList = await CommunicationNodeModel.findAll();
      // 获取所有流程图
      const flowchartList = await FlowchartModel.findAll();

      // 构建通信节点到流程图的映射
      const commNodeFlowchartMap = new Map();
      for (const flowchart of flowchartList) {
        if (flowchart.communication_node_id) {
          commNodeFlowchartMap.set(flowchart.communication_node_id, flowchart);
        }
      }

      // 构建体系节点到通信节点的映射
      const archNodeCommMap = new Map();
      for (const commNode of commNodeList) {
        if (!archNodeCommMap.has(commNode.node_id)) {
          archNodeCommMap.set(commNode.node_id, []);
        }
        archNodeCommMap.get(commNode.node_id).push(commNode);
      }

      // 数据传输节点类型映射（IN 节点和 OUT 节点的对应关系）
      // 同一协议类型的 OUT 可以连接到同一协议类型的 IN
      const dataTransferNodeTypeList = [
        { protocol: 'tcp', inType: 'tcp-in-node', outType: 'tcp-out-node', label: 'TCP' },
        { protocol: 'udp', inType: 'udp-in-node', outType: 'udp-out-node', label: 'UDP' },
        { protocol: 'serial', inType: 'serial-node', outType: 'serial-node', label: 'Serial' }
      ];

      // 提取所有数据传输端点信息

      // 提取所有数据传输端点信息
      const inEndpointList = []; // { archNodeId, commNodeId, host, port, protocol, archNodeName, commNodeName }
      const outEndpointList = []; // { archNodeId, commNodeId, host, port, protocol, archNodeName, commNodeName }

      for (const archNode of archNodeList) {
        const commNodeListForArch = archNodeCommMap.get(archNode.id) || [];

        for (const commNode of commNodeListForArch) {
          const flowchart = commNodeFlowchartMap.get(commNode.id);
          if (!flowchart || !flowchart.nodes) continue;

          // 模型 getter 已自动解析 nodes
          const nodes = flowchart.nodes;

          // 提取所有数据传输节点
          for (const node of nodes) {
            for (const typeConfig of dataTransferNodeTypeList) {
              // 检查是否是 IN 节点
              if (node.type === typeConfig.inType) {
                const host = node.properties?.host || '0.0.0.0';
                const port = node.properties?.port;
                if (port) {
                  inEndpointList.push({
                    archNodeId: archNode.id,
                    archNodeName: archNode.name,
                    commNodeId: commNode.id,
                    commNodeName: commNode.name,
                    protocol: typeConfig.protocol,
                    protocolLabel: typeConfig.label,
                    host,
                    port: Number(port)
                  });
                }
              }
              // 检查是否是 OUT 节点
              if (node.type === typeConfig.outType && typeConfig.inType !== typeConfig.outType) {
                // IN 和 OUT 类型不同的情况（如 TCP、UDP）
                const host = node.properties?.host;
                const port = node.properties?.port;
                if (host && port) {
                  outEndpointList.push({
                    archNodeId: archNode.id,
                    archNodeName: archNode.name,
                    commNodeId: commNode.id,
                    commNodeName: commNode.name,
                    protocol: typeConfig.protocol,
                    protocolLabel: typeConfig.label,
                    host,
                    port: Number(port)
                  });
                }
              } else if (
                node.type === typeConfig.outType &&
                typeConfig.inType === typeConfig.outType
              ) {
                // IN 和 OUT 类型相同的情况（如 Serial），根据 mode 属性区分
                const mode = node.properties?.mode;
                const host = node.properties?.host || '';
                const port = node.properties?.port || 0;
                if (mode === 'in' || mode === 'receive') {
                  inEndpointList.push({
                    archNodeId: archNode.id,
                    archNodeName: archNode.name,
                    commNodeId: commNode.id,
                    commNodeName: commNode.name,
                    protocol: typeConfig.protocol,
                    protocolLabel: typeConfig.label,
                    host,
                    port: Number(port)
                  });
                } else if (mode === 'out' || mode === 'send') {
                  outEndpointList.push({
                    archNodeId: archNode.id,
                    archNodeName: archNode.name,
                    commNodeId: commNode.id,
                    commNodeName: commNode.name,
                    protocol: typeConfig.protocol,
                    protocolLabel: typeConfig.label,
                    host,
                    port: Number(port)
                  });
                }
              }
            }
          }
        }
      }

      // 生成拓扑节点
      // 注意：不再硬编码 type，改为使用 node_type_id 动态标识节点类型
      // 前端可根据 node_type_id 从层级配置中获取对应的样式和显示名称
      const topologyNodeList = archNodeList.map((node) => ({
        id: node.id,
        name: node.name,
        node_type_id: node.node_type_id,
        description: node.description,
        status: 'online',
        hasCommNode: archNodeCommMap.has(node.id),
        commNodeCount: (archNodeCommMap.get(node.id) || []).length
      }));

      // 生成拓扑连线（根据 OUT 目标地址匹配同协议类型的 IN 监听地址）
      const topologyEdgeList = [];
      const edgeIdSet = new Set(); // 防止重复连线

      for (const outEndpoint of outEndpointList) {
        // 查找匹配的 IN 端点（同协议类型 + 目标地址和端口匹配）
        for (const inEndpoint of inEndpointList) {
          // 跳过同一个体系节点内的连接
          if (outEndpoint.archNodeId === inEndpoint.archNodeId) continue;

          // 必须是同一协议类型
          if (outEndpoint.protocol !== inEndpoint.protocol) continue;

          // 匹配逻辑：OUT 的目标端口 === IN 的监听端口
          // 并且 OUT 的目标地址匹配 IN 的监听地址（0.0.0.0 表示接受任意地址）
          if (outEndpoint.port === inEndpoint.port) {
            const isHostMatch =
              inEndpoint.host === '0.0.0.0' || outEndpoint.host === inEndpoint.host;
            if (isHostMatch) {
              const edgeId = `${outEndpoint.archNodeId}-${inEndpoint.archNodeId}-${outEndpoint.protocol}-${outEndpoint.port}`;
              if (!edgeIdSet.has(edgeId)) {
                edgeIdSet.add(edgeId);
                topologyEdgeList.push({
                  id: edgeId,
                  from: outEndpoint.archNodeId,
                  to: inEndpoint.archNodeId,
                  // 连线文案：协议类型 + 端口，鼠标悬停显示详细信息
                  label: `${outEndpoint.protocolLabel} ${outEndpoint.port}`,
                  connectionType: outEndpoint.protocol,
                  fromCommNode: outEndpoint.commNodeName,
                  toCommNode: inEndpoint.commNodeName,
                  // 详细信息用于 tooltip
                  fromHost: outEndpoint.host,
                  toHost: inEndpoint.host,
                  port: outEndpoint.port
                });
              }
            }
          }
        }
      }

      return {
        nodes: topologyNodeList,
        edges: topologyEdgeList,
        inEndpointList,
        outEndpointList
      };
    } catch (error) {
      throw new Error('getAllTopologyNodes Failed: ' + error.message);
    }
  }
}

module.exports = TopologyService;
