// 报文层级分类服务，处理报文分类的业务逻辑
const PacketMessageCategoryModel = require('../models/packetMessageCategory');
const PacketMessageModel = require('../models/packetMessage');
const logger = require('../../middleware/log4jsPlus').getLogger();
const { dedupePacketsByMessageId } = require('../../utils/packet-messages');

class PacketMessageCategoryService {
  /**
   * 检查分类名称是否重复（仅用于创建时检查）
   * @param {string} name - 分类名称（已去空格）
   * @returns {Promise<boolean>} 是否重复
   */
  static async isNameDuplicate(name) {
    try {
      const category_list = await PacketMessageCategoryModel.findAll();
      return category_list.some((cat) => String(cat.name || '').trim() === name);
    } catch (error) {
      throw new Error('检查分类名称重复失败: ' + error.message);
    }
  }

  /**
   * 获取所有分类（平铺列表）
   * @returns {Promise<Array>} 分类列表
   */
  static async getAllCategories() {
    try {
      return await PacketMessageCategoryModel.findAll();
    } catch (error) {
      throw new Error('获取分类列表失败: ' + error.message);
    }
  }

  /**
   * 获取分类树（包含报文）
   * @returns {Promise<Array>} 分类树
   */
  static async getCategoryTree() {
    try {
      // 获取所有分类
      const category_list = await PacketMessageCategoryModel.findAll();
      // 获取所有报文（不分页）
      const packet_list = await PacketMessageModel.findAllSimple();

      // 构建树结构
      const tree = this.buildTree(category_list, packet_list);
      return tree;
    } catch (error) {
      throw new Error('获取分类树失败: ' + error.message);
    }
  }

  /**
   * 构建树结构
   * @param {Array} category_list - 分类列表
   * @param {Array} packet_list - 报文列表
   * @returns {Array} 树结构
   */
  static buildTree(category_list, packet_list) {
    // 创建分类 map
    const category_map = {};
    category_list.forEach((cat) => {
      category_map[cat.id] = {
        ...cat,
        type: 'category',
        children: []
      };
    });

    // 按 message_id 去重报文，每个 message_id 只保留一个显示版本
    const filtered_packet_list = dedupePacketsByMessageId(packet_list);

    // 将报文挂载到对应分类下
    const uncategorized_packet_list = [];
    filtered_packet_list.forEach((packet) => {
      const packet_node = {
        id: `packet-${packet.id}`,
        packet_id: packet.id,
        message_id: packet.message_id,
        name: packet.name,
        type: 'packet',
        description: packet.description,
        version: packet.version || '1.0',
        field_count: packet.field_count || 0,
        is_draft: packet.publish_status === 0,
        children: []
      };

      if (packet.category_id && category_map[packet.category_id]) {
        category_map[packet.category_id].children.push(packet_node);
      } else {
        uncategorized_packet_list.push(packet_node);
      }
    });

    // 构建分类树（父子关系）
    const root_list = [];
    category_list.forEach((cat) => {
      const node = category_map[cat.id];
      if (cat.parent_id && category_map[cat.parent_id]) {
        category_map[cat.parent_id].children.push(node);
      } else {
        root_list.push(node);
      }
    });

    // 将未分类的报文放在根级别
    return [...root_list, ...uncategorized_packet_list];
  }

  /**
   * 获取单个分类
   * @param {string} id - 分类ID
   * @returns {Promise<Object>} 分类对象
   */
  static async getCategoryById(id) {
    try {
      return await PacketMessageCategoryModel.findById(id);
    } catch (error) {
      throw new Error('获取分类详情失败: ' + error.message);
    }
  }

  /**
   * 创建分类（支持批量）
   * @param {Array} data_list - 分类数据列表
   * @param {string} data_list.name - 分类名称
   * @param {string} data_list.parent_id - 父分类ID
   * @param {string} data_list.description - 描述
   * @returns {Promise<Object|Array>} 创建的分类对象或列表
   */
  static async createCategoryList(data_list) {
    try {
      // 校验空数组
      if (!data_list || data_list.length === 0) {
        throw new Error('创建分类失败: 参数不能为空数组');
      }

      // 校验每个分类项
      for (const item of data_list) {
        // 校验 name 是否为空字符串
        if (item.name !== undefined && item.name !== null && item.name.trim() === '') {
          throw new Error('创建分类失败: name 不能为空字符串');
        }
        // 检查名称是否重复
        const trimmedName = String(item.name || '').trim();
        const isDuplicate = await this.isNameDuplicate(trimmedName);
        if (isDuplicate) {
          throw new Error(`分类名称"${trimmedName}"已存在，请使用其他名称`);
        }
      }

      if (data_list.length === 1) {
        return await PacketMessageCategoryModel.create(data_list[0]);
      }
      return await PacketMessageCategoryModel.createBatch(data_list);
    } catch (error) {
      throw new Error('创建分类失败: ' + error.message);
    }
  }

  /**
   * 更新分类（支持批量）
   * @param {Array} data_list - 更新数据列表
   * @param {string} data_list.id - 分类ID
   * @param {string} data_list.name - 分类名称
   * @param {string} data_list.parent_id - 父分类ID
   * @param {string} data_list.description - 描述
   * @returns {Promise<Object|Array>} 更新后的分类对象或列表
   */
  static async updateCategoryList(data_list) {
    try {
      // 校验空数组
      if (!data_list || data_list.length === 0) {
        throw new Error('更新分类失败: 参数不能为空数组');
      }

      // 校验每个分类项是否存在
      for (const item of data_list) {
        if (!item.id) {
          throw new Error('更新分类失败: 缺少参数 id');
        }
        // 检查分类是否存在
        const exists = await PacketMessageCategoryModel.findById(item.id);
        if (!exists) {
          throw new Error('更新分类失败: 分类不存在');
        }

        // 检查名称是否重复（排除自己）
        if (item.name !== undefined && item.name !== null) {
          const trimmedName = String(item.name || '').trim();
          const category_list = await PacketMessageCategoryModel.findAll();
          const isDuplicate = category_list.some(
            (cat) => String(cat.name || '').trim() === trimmedName && cat.id !== item.id
          );
          if (isDuplicate) {
            throw new Error(`分类名称"${trimmedName}"已存在，请使用其他名称`);
          }
        }
      }

      if (data_list.length === 1) {
        const { id, ...data } = data_list[0];
        return await PacketMessageCategoryModel.update(id, data);
      }
      return await PacketMessageCategoryModel.updateBatch(data_list);
    } catch (error) {
      throw new Error('更新分类失败: ' + error.message);
    }
  }

  /**
   * 删除分类（支持批量）
   * @param {Array} id_list - 分类ID列表
   * @returns {Promise<number>} 删除的分类数量
   */
  static async deleteCategoryList(id_list) {
    try {
      // 校验空数组
      if (!id_list || id_list.length === 0) {
        throw new Error('删除分类失败: ids 不能为空数组');
      }

      // 删除分类前，将该分类下的报文的 category_id 设为 null
      for (const id of id_list) {
        await PacketMessageModel.updateByCategoryId(id, { category_id: null });
      }
      return await PacketMessageCategoryModel.deleteBatch(id_list);
    } catch (error) {
      throw new Error('删除分类失败: ' + error.message);
    }
  }
}

module.exports = PacketMessageCategoryService;
