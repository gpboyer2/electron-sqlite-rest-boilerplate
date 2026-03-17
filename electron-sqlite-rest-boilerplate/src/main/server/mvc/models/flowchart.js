/**
 * @file       flowchart.js
 * @brief      流程图模型，处理流程图数据的CRUD操作，支持按架构节点ID和通信节点ID查询
 * @date       2025-11-28
 * @copyright  Copyright (c) 2025
 */

const { Flowchart } = require('../../database/models');

class FlowchartModel {
  /**
   * 查询所有流程图
   * @returns {Promise<Array>} 返回所有流程图对象的数组
   */
  static async findAll() {
    const flowcharts = await Flowchart.findAll();
    return flowcharts.map((f) => f.toJSON());
  }

  /**
   * 根据ID查询流程图
   * @param {number} id - 流程图ID
   * @returns {Promise<Object|null>} 返回流程图对象，不存在时返回null
   */
  static async findById(id) {
    const flowchart = await Flowchart.findByPk(id);
    return flowchart ? flowchart.toJSON() : null;
  }

  /**
   * 根据架构节点ID查询流程图
   * @param {number} archNodeId - 架构节点ID
   * @returns {Promise<Object|null>} 返回流程图对象，不存在时返回null
   */
  static async findByArchNodeId(archNodeId) {
    const flowchart = await Flowchart.findOne({ where: { arch_node_id: archNodeId } });
    return flowchart ? flowchart.toJSON() : null;
  }

  /**
   * 根据通信节点ID查询流程图
   * @param {number} communicationNodeId - 通信节点ID
   * @returns {Promise<Object|null>} 返回流程图对象，不存在时返回null
   */
  static async findByCommunicationNodeId(communicationNodeId) {
    const flowchart = await Flowchart.findOne({
      where: { communication_node_id: communicationNodeId }
    });
    return flowchart ? flowchart.toJSON() : null;
  }

  /**
   * 创建新的流程图
   * @param {Object} data - 流程图数据对象
   * @returns {Promise<Object>} 返回包含新创建流程图ID和变更数量的对象
   */
  static async create(data) {
    const flowchart = await Flowchart.create(data);
    return { lastID: flowchart.id, changes: 1 };
  }

  /**
   * 根据ID更新流程图
   * @param {number} id - 流程图ID
   * @param {Object} data - 要更新的数据对象
   * @returns {Promise<Object>} 返回包含变更数量的对象
   */
  static async update(id, data) {
    const [changes] = await Flowchart.update(data, { where: { id } });
    return { changes };
  }

  /**
   * 根据ID删除流程图
   * @param {number} id - 流程图ID
   * @returns {Promise<Object>} 返回包含删除数量的对象
   */
  static async delete(id) {
    const changes = await Flowchart.destroy({ where: { id } });
    return { changes };
  }

  /**
   * 根据通信节点ID删除流程图
   * @param {number} communicationNodeId - 通信节点ID
   * @returns {Promise<Object>} 返回包含删除数量的对象
   */
  static async deleteByCommunicationNodeId(communicationNodeId) {
    const changes = await Flowchart.destroy({
      where: { communication_node_id: communicationNodeId }
    });
    return { changes };
  }
}

module.exports = FlowchartModel;
