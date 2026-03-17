/**
 * @file       systemLevelDesignTree.js
 * @brief      系统级设计树模型，处理系统级设计树节点的CRUD操作，支持按父节点查询和批量操作
 * @date       2025-11-28
 * @copyright  Copyright (c) 2025
 */

const { SystemLevelDesignTreeNode } = require('../../database/models');
const log4js = require('../../middleware/log4jsPlus');
const logger = log4js.getLogger();

class SystemLevelDesignTreeModel {
  /**
   * 查询所有系统级设计树节点
   * @returns {Promise<Array<Object>>} 返回所有节点的 JSON 数组
   */
  static async findAll() {
    const nodes = await SystemLevelDesignTreeNode.findAll();
    return nodes.map((n) => n.toJSON());
  }

  /**
   * 根据 ID 查询单个系统级设计树节点
   * @param {string|number} id - 节点 ID
   * @returns {Promise<Object|null>} 返回找到的节点对象，未找到时返回 null
   */
  static async findById(id) {
    logger.info('[Model.findById] 查询 id:', id);
    const node = await SystemLevelDesignTreeNode.findByPk(id);
    logger.info('[Model.findById] 查询结果:', node ? '找到' : '未找到');
    if (!node) {
      const allNodes = await SystemLevelDesignTreeNode.findAll({ attributes: ['id'] });
      logger.info('[Model.findById] 数据库中所有的 ID:', allNodes.map((n) => n.id).join(', '));
    }
    return node ? node.toJSON() : null;
  }

  /**
   * 根据父节点 ID 查询子节点列表
   * @param {string|number} parentId - 父节点 ID
   * @returns {Promise<Array<Object>>} 返回子节点的 JSON 数组
   */
  static async findByParentId(parentId) {
    const nodes = await SystemLevelDesignTreeNode.findAll({ where: { parent_id: parentId } });
    return nodes.map((n) => n.toJSON());
  }

  /**
   * 根据 ID 列表批量查询节点
   * @param {Array<string|number>} idList - 节点 ID 数组
   * @returns {Promise<Array<Object>>} 返回找到的节点的 JSON 数组，空数组时返回空数组
   */
  static async findByIds(idList) {
    if (!idList || idList.length === 0) return [];
    const nodes = await SystemLevelDesignTreeNode.findAll({
      where: { id: idList }
    });
    return nodes.map((n) => n.toJSON());
  }

  /**
   * 创建单个系统级设计树节点
   * @param {Object} data - 节点数据对象
   * @returns {Promise<Object>} 返回包含 lastID（新节点 ID）和 changes（影响行数）的对象
   */
  static async create(data) {
    const node = await SystemLevelDesignTreeNode.create(data);
    return { lastID: node.id, changes: 1 };
  }

  /**
   * 批量创建系统级设计树节点
   * @param {Array<Object>} dataList - 节点数据对象数组
   * @returns {Promise<Object>} 返回包含 created（创建的节点 ID 数组）和 changes（创建数量）的对象
   */
  static async createBatch(dataList) {
    const nodes = await SystemLevelDesignTreeNode.bulkCreate(dataList);
    return { created: nodes.map((n) => n.id), changes: nodes.length };
  }

  /**
   * 更新单个系统级设计树节点
   * @param {string|number} id - 节点 ID
   * @param {Object} data - 要更新的字段对象
   * @returns {Promise<Object>} 返回包含 changes（影响行数）的对象
   */
  static async update(id, data) {
    const [changes] = await SystemLevelDesignTreeNode.update(data, { where: { id } });
    return { changes };
  }

  /**
   * 批量更新系统级设计树节点
   * @param {Array<Object>} dataList - 包含 id 和更新字段的对象数组，每个对象格式为 { id, ...fields }
   * @returns {Promise<Object>} 返回包含 updated（成功更新的节点数组）、failed（失败的节点数组）、successCount（成功数量）、failedCount（失败数量）的对象
   */
  static async updateBatch(dataList) {
    logger.info('[updateBatch] 收到更新请求，数据条数:', dataList.length);
    logger.info('[updateBatch] 数据详情:', JSON.stringify(dataList, null, 2));
    const resultList = [];
    const failedList = [];
    for (const item of dataList) {
      const { id, ...data } = item;
      logger.info(`[updateBatch] 正在更新 id=${id}, data=`, JSON.stringify(data));
      const [changes] = await SystemLevelDesignTreeNode.update(data, { where: { id } });
      logger.info(`[updateBatch] 更新结果: id=${id}, changes=${changes}`);
      if (changes === 0) {
        failedList.push({ id, reason: '记录不存在或数据未变化' });
      } else {
        resultList.push({ id, changes });
      }
    }
    const result = {
      updated: Array.from(resultList),
      failed: Array.from(failedList),
      successCount: resultList.length,
      failedCount: failedList.length
    };
    logger.info('[updateBatch] 最终返回结果:', JSON.stringify(result));
    logger.info(
      '[updateBatch] resultList 类型:',
      Array.isArray(resultList) ? 'Array' : typeof resultList
    );
    logger.info(
      '[updateBatch] result.updated 类型:',
      Array.isArray(result.updated) ? 'Array' : typeof result.updated
    );
    return result;
  }

  /**
   * 删除单个系统级设计树节点
   * @param {string|number} id - 节点 ID
   * @returns {Promise<Object>} 返回包含 changes（影响行数）的对象
   */
  static async delete(id) {
    const changes = await SystemLevelDesignTreeNode.destroy({ where: { id } });
    return { changes };
  }

  /**
   * 批量删除系统级设计树节点（级联删除子节点）
   * @param {Array<string|number>} idList - 要删除的节点 ID 数组
   * @returns {Promise<Object>} 返回包含 deleted（实际删除的所有节点 ID 数组，包括子节点）和 changes（影响行数）的对象
   */
  static async deleteBatch(idList) {
    if (!idList || idList.length === 0) {
      return { deleted: [], changes: 0 };
    }
    const allIdsToDelete = await this._collectAllChildNodes(idList);
    logger.info('[deleteBatch] 级联删除节点:', allIdsToDelete);

    const changes = await SystemLevelDesignTreeNode.destroy({ where: { id: allIdsToDelete } });
    return { deleted: allIdsToDelete, changes };
  }

  /**
   * 递归收集所有子节点 ID（私有方法）
   * @param {Array<string|number>} idList - 初始节点 ID 数组
   * @returns {Promise<Array<string|number>>} 返回包含所有子节点 ID 的数组
   */
  static async _collectAllChildNodes(idList) {
    const allIds = new Set(idList);
    const toProcess = [...idList];

    while (toProcess.length > 0) {
      const parentId = toProcess.pop();
      const children = await SystemLevelDesignTreeNode.findAll({
        attributes: ['id'],
        where: { parent_id: parentId }
      });

      for (const child of children) {
        const childId = child.id;
        if (!allIds.has(childId)) {
          allIds.add(childId);
          toProcess.push(childId);
        }
      }
    }

    return Array.from(allIds);
  }
}

module.exports = SystemLevelDesignTreeModel;
