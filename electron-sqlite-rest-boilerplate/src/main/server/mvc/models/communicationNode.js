/**
 * @file       communicationNode.js
 * @brief      通信节点模型，处理通信节点的数据访问层，负责与数据库交互，支持节点管理和关联流程图查询
 * @date       2025-11-28
 * @copyright  Copyright (c) 2025
 */

const { CommunicationNode, Flowchart } = require('../../database/models');
const { isValidValue } = require('../../utils/string');

class CommunicationNodeModel {
  /**
   * 获取所有通信节点
   * @param {Object} options - 查询选项（如 transaction）
   * @returns {Promise<Array>} 通信节点列表，按创建时间倒序排列
   */
  static async findAll(options = {}) {
    const nodes = await CommunicationNode.findAll({
      order: [['created_at', 'DESC']],
      ...options
    });
    return nodes.map((n) => n.toJSON());
  }

  /**
   * 根据ID获取通信节点
   * @param {number} id - 通信节点ID
   * @returns {Promise<Object|null>} 通信节点对象，不存在时返回 null
   */
  static async findById(id) {
    const node = await CommunicationNode.findByPk(id);
    return node ? node.toJSON() : null;
  }

  /**
   * 根据层级节点ID获取通信节点列表
   * @param {number} nodeId - 层级节点ID
   * @returns {Promise<Array>} 通信节点列表，按创建时间倒序排列
   */
  static async findByNodeId(nodeId) {
    // 参数校验：防止 NaN 导致 SQL 错误
    const node_id = String(nodeId || '').trim();
    if (!isValidValue(node_id)) {
      return []; // 返回空数组而不是执行查询
    }

    const nodes = await CommunicationNode.findAll({
      where: { node_id: nodeId },
      order: [['created_at', 'DESC']]
    });
    return nodes.map((n) => n.toJSON());
  }

  /**
   * 根据层级节点ID和名称获取通信节点
   * @param {number} nodeId - 层级节点ID
   * @param {string} name - 通信节点名称
   * @returns {Promise<Object|null>} 通信节点对象，不存在时返回 null
   */
  static async findByNodeIdAndName(nodeId, name) {
    const node = await CommunicationNode.findOne({
      where: { node_id: nodeId, name }
    });
    return node ? node.toJSON() : null;
  }

  /**
   * 获取通信节点及其关联的流程图
   * @param {number} id - 通信节点ID
   * @returns {Promise<Object|null>} 包含流程图信息的通信节点对象，不存在时返回 null
   */
  static async findByIdWithFlowchart(id) {
    const node = await CommunicationNode.findByPk(id);
    if (!node) return null;

    const nodeData = node.toJSON();

    /** 单独查询关联的流程图 */
    const flowchart = await Flowchart.findOne({
      where: { communication_node_id: id }
    });

    return { ...nodeData, flowchart: flowchart ? flowchart.toJSON() : null };
  }

  /**
   * 创建通信节点
   * @param {Object} data - 通信节点数据
   * @returns {Promise<Object>} 包含 lastID 和 changes 的操作结果
   */
  static async create(data) {
    const node = await CommunicationNode.create(data);
    return { lastID: node.id, changes: 1 };
  }

  /**
   * 更新通信节点
   * @param {number} id - 通信节点ID
   * @param {Object} data - 更新的数据
   * @param {Object} options - Sequelize 选项（如 transaction）
   * @returns {Promise<Object>} 包含 changes 的操作结果
   */
  static async update(id, data, options = {}) {
    const [changes] = await CommunicationNode.update(data, { where: { id }, ...options });
    return { changes };
  }

  /**
   * 删除通信节点，入参为数组，天然支持批量操作
   * @param {Array<number>} idList - 通信节点ID数组
   * @returns {Promise<Object>} 包含 changes 的操作结果
   */
  static async delete(idList) {
    const changes = await CommunicationNode.destroy({
      where: { id: idList }
    });
    return { changes };
  }

  /**
   * 根据层级节点ID删除所有通信节点
   * @param {number} nodeId - 层级节点ID
   * @returns {Promise<Object>} 包含 changes 的操作结果
   */
  static async deleteByNodeId(nodeId) {
    const changes = await CommunicationNode.destroy({ where: { node_id: nodeId } });
    return { changes };
  }

  /**
   * 根据层级节点ID和名称更新通信节点（用于兼容旧数据修复 id 为 null 的情况）
   * @param {number} nodeId - 层级节点ID
   * @param {string} name - 通信节点名称
   * @param {Object} data - 更新的数据
   * @returns {Promise<Object>} 包含 changes 的操作结果
   */
  static async updateByNodeIdAndName(nodeId, name, data) {
    const [changes] = await CommunicationNode.update(data, { where: { node_id: nodeId, name } });
    return { changes };
  }
}

module.exports = CommunicationNodeModel;
