// 报文层级分类模型，处理报文分类的 CRUD 操作
const { PacketMessageCategory } = require('../../database/models');
const log4js = require('../../middleware/log4jsPlus');
const logger = log4js.getLogger();

class PacketMessageCategoryModel {
  /**
   * 查询所有报文层级分类记录
   * @returns {Promise<Array>} 返回按 sort_order 升序排列的所有分类记录
   */
  static async findAll() {
    return await PacketMessageCategory.findAll({ raw: true, order: [['sort_order', 'ASC']] });
  }

  /**
   * 根据 ID 查询单个报文层级分类记录
   * @param {number} id - 分类记录 ID
   * @returns {Promise<Object|null>} 返回分类记录对象，不存在时返回 null
   */
  static async findById(id) {
    return await PacketMessageCategory.findByPk(id, { raw: true });
  }

  /**
   * 根据父级 ID 查询报文层级分类记录
   * @param {number|null} parent_id - 父级分类 ID，null 或 undefined 表示查询顶级分类
   * @returns {Promise<Array>} 返回按 sort_order 升序排列的分类记录列表
   */
  static async findByParentId(parent_id) {
    const where = parent_id ? { parent_id } : { parent_id: null };
    return await PacketMessageCategory.findAll({ where, raw: true, order: [['sort_order', 'ASC']] });
  }

  /**
   * 根据 ID 列表批量查询报文层级分类记录
   * @param {Array<number>} idList - 分类记录 ID 列表
   * @returns {Promise<Array>} 返回按 sort_order 升序排列的分类记录列表，空数组或无匹配时返回空数组
   */
  static async findByIds(idList) {
    if (!idList || idList.length === 0) return [];
    return await PacketMessageCategory.findAll({
      where: { id: idList },
      raw: true,
      order: [['sort_order', 'ASC']]
    });
  }

  /**
   * 创建单个报文层级分类记录
   * @param {Object} data - 分类记录数据
   * @returns {Promise<Object>} 返回包含新建记录 ID 和影响行数的对象 { last_id, changes }
   */
  static async create(data) {
    const now = Math.floor(Date.now() / 1000);
    const node = await PacketMessageCategory.create({
      ...data,
      created_at: now,
      updated_at: now
    });
    return { last_id: node.id, changes: 1 };
  }

  /**
   * 批量创建报文层级分类记录
   * @param {Array<Object>} data_list - 分类记录数据列表
   * @returns {Promise<Object>} 返回包含新建记录 ID 数组和影响行数的对象 { created, changes }
   */
  static async createBatch(data_list) {
    const now = Math.floor(Date.now() / 1000);
    const node_list = await PacketMessageCategory.bulkCreate(
      data_list.map((item) => ({
        ...item,
        created_at: now,
        updated_at: now
      }))
    );
    return { created: node_list.map((n) => n.id), changes: node_list.length };
  }

  /**
   * 更新单个报文层级分类记录
   * @param {number} id - 分类记录 ID
   * @param {Object} data - 要更新的数据
   * @returns {Promise<Object>} 返回包含影响行数的对象 { changes }
   */
  static async update(id, data) {
    const now = Math.floor(Date.now() / 1000);
    const [changes] = await PacketMessageCategory.update(
      { ...data, updated_at: now },
      { where: { id } }
    );
    return { changes };
  }

  /**
   * 批量更新报文层级分类记录
   * @param {Array<Object>} data_list - 要更新的数据列表，每项需包含 id 和要更新的字段
   * @returns {Promise<Object>} 返回包含更新成功列表、失败列表和计数的对象 { updated, failed, success_count, failed_count }
   */
  static async updateBatch(data_list) {
    const now = Math.floor(Date.now() / 1000);
    const result_list = [];
    const failed_list = [];
    for (const item of data_list) {
      const { id, ...data } = item;
      const [changes] = await PacketMessageCategory.update(
        { ...data, updated_at: now },
        { where: { id } }
      );
      if (changes === 0) {
        failed_list.push({ id, reason: '记录不存在或数据未变化' });
      } else {
        result_list.push({ id, changes });
      }
    }
    return {
      updated: result_list,
      failed: failed_list,
      success_count: result_list.length,
      failed_count: failed_list.length
    };
  }

  /**
   * 删除单个报文层级分类记录
   * @param {number} id - 分类记录 ID
   * @returns {Promise<Object>} 返回包含影响行数的对象 { changes }
   */
  static async delete(id) {
    const changes = await PacketMessageCategory.destroy({ where: { id } });
    return { changes };
  }

  /**
   * 批量删除报文层级分类记录
   * @param {Array<number>} id_list - 分类记录 ID 列表
   * @returns {Promise<Object>} 返回包含已删除 ID 数组和影响行数的对象 { deleted, changes }
   */
  static async deleteBatch(id_list) {
    const changes = await PacketMessageCategory.destroy({ where: { id: id_list } });
    return { deleted: id_list, changes };
  }
}

module.exports = PacketMessageCategoryModel;
