/**
 * @file       hierarchy.js
 * @brief      层级结构模型，处理节点类型和系统级设计树节点的CRUD操作，支持树形结构构建
 * @date       2025-11-28
 * @copyright  Copyright (c) 2025
 */

const { NodeType, SystemLevelDesignTreeNode } = require('../../database/models');
const { Op } = require('sequelize');

class HierarchyModel {
  /**
   * 查询所有节点类型
   * @returns {Promise<Array>} 节点类型列表，按 order 和 created_at 排序
   */
  static async findAllNodeTypes() {
    const nodeTypes = await NodeType.findAll({
      order: [
        ['order', 'ASC'],
        ['created_at', 'ASC']
      ]
    });
    return nodeTypes.map((nt) => nt.toJSON());
  }

  /**
   * 根据 ID 查询节点类型
   * @param {number} id - 节点类型 ID
   * @returns {Promise<Object|null>} 节点类型对象，不存在时返回 null
   */
  static async findNodeTypeById(id) {
    const nodeType = await NodeType.findByPk(id);
    return nodeType ? nodeType.toJSON() : null;
  }

  /**
   * 创建节点类型
   * @param {Object} data - 节点类型数据
   * @returns {Promise<Object>} 包含 lastID 和 changes 的操作结果
   */
  static async createNodeType(data) {
    const nodeType = await NodeType.create(data);
    return { lastID: nodeType.id, changes: 1 };
  }

  /**
   * 更新节点类型
   * @param {number} id - 节点类型 ID
   * @param {Object} data - 更新的节点类型数据
   * @returns {Promise<Object>} 包含 changes 的操作结果
   */
  static async updateNodeType(id, data) {
    const [changes] = await NodeType.update(data, { where: { id } });
    return { changes };
  }

  /**
   * 删除节点类型
   * @param {number} id - 节点类型 ID
   * @returns {Promise<Object>} 包含 changes 的操作结果
   */
  static async deleteNodeType(id) {
    const changes = await NodeType.destroy({ where: { id } });
    return { changes };
  }

  /**
   * 查询所有层级节点
   * @returns {Promise<Array>} 层级节点列表，按 parent_id 和 created_at 排序
   */
  static async findAllHierarchyNodes() {
    const nodes = await SystemLevelDesignTreeNode.findAll({
      order: [
        ['parent_id', 'ASC'],
        ['created_at', 'ASC']
      ]
    });
    return nodes.map((n) => n.toJSON());
  }

  /**
   * 根据 ID 查询层级节点
   * @param {number} id - 层级节点 ID
   * @returns {Promise<Object|null>} 层级节点对象，不存在时返回 null
   */
  static async findHierarchyNodeById(id) {
    const node = await SystemLevelDesignTreeNode.findByPk(id);
    return node ? node.toJSON() : null;
  }

  /**
   * 根据父节点 ID 查询子节点
   * @param {number|null} parentId - 父节点 ID，null 或空字符串时查询根节点
   * @returns {Promise<Array>} 子节点列表
   */
  static async findHierarchyNodesByParentId(parentId) {
    const where = parentId
      ? { parent_id: parentId }
      : { [Op.or]: [{ parent_id: null }, { parent_id: '' }] };
    const nodes = await SystemLevelDesignTreeNode.findAll({ where, order: [['created_at', 'ASC']] });
    return nodes.map((n) => n.toJSON());
  }

  /**
   * 创建层级节点
   * @param {Object} data - 层级节点数据
   * @returns {Promise<Object>} 包含 lastID 和 changes 的操作结果
   */
  static async createHierarchyNode(data) {
    const node = await SystemLevelDesignTreeNode.create(data);
    return { lastID: node.id, changes: 1 };
  }

  /**
   * 更新层级节点
   * @param {number} id - 层级节点 ID
   * @param {Object} data - 更新的层级节点数据
   * @returns {Promise<Object>} 包含 changes 的操作结果
   */
  static async updateHierarchyNode(id, data) {
    const [changes] = await SystemLevelDesignTreeNode.update(data, { where: { id } });
    return { changes };
  }

  /**
   * 删除层级节点（递归删除所有子节点）
   * @param {number} id - 层级节点 ID
   * @returns {Promise<Object>} 包含 changes 的操作结果
   */
  static async deleteHierarchyNode(id) {
    const children = await this.findHierarchyNodesByParentId(id);
    for (const child of children) {
      await this.deleteHierarchyNode(child.id);
    }
    const changes = await SystemLevelDesignTreeNode.destroy({ where: { id } });
    return { changes };
  }

  /**
   * 构建层级树结构
   * @returns {Promise<Array>} 树形结构的根节点列表，每个节点包含 children、type 和 properties
   * @throws {Error} 查询或构建过程中发生的错误
   */
  static async buildHierarchyTree() {
    try {
      const allNodes = await this.findAllHierarchyNodes();
      const nodeTypes = await this.findAllNodeTypes();

      const nodeTypeMap = {};
      nodeTypes.forEach((type) => {
        nodeTypeMap[type.id] = type;
      });

      const nodeMap = {};
      const roots = [];

      allNodes.forEach((node) => {
        node.children = [];
        node.type = nodeTypeMap[node.node_type_id];
        node.properties = node.properties || {};
        nodeMap[node.id] = node;
      });

      allNodes.forEach((node) => {
        if (node.parent_id && nodeMap[node.parent_id]) {
          nodeMap[node.parent_id].children.push(node);
        } else {
          roots.push(node);
        }
      });

      return roots;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = HierarchyModel;
