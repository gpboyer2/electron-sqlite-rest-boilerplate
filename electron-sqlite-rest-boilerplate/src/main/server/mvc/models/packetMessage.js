/**
 * @file       packetMessage.js
 * @brief      报文配置模型，处理报文的CRUD操作，支持报文复制和批量操作
 * @date       2025-11-28
 * @copyright  Copyright (c) 2025
 */

const { PacketMessage } = require('../../database/models');
const { Op } = require('sequelize');
const { isValidValue } = require('../../utils/string');

// 字段名常量
const HIERARCHY_NODE_ID_FIELD = 'hierarchy_node_id';

// 公共视角：仅允许读取"最新已发布"的报文
const PUBLIC_LATEST_PUBLISHED_WHERE = {
  publish_status: 1,
  latest_key: { [Op.not]: null }
};

/**
 * 规范化状态值
 * @param {string|number|undefined} status - 状态值
 * @returns {number|undefined} 规范化后的状态值（0/1/undefined）
 */
function normalizeStatusValue(status) {
  if (status === undefined || status === null) return undefined;
  const raw = String(status).trim();
  if (!raw) return undefined;
  if (raw === 'enabled') return 1;
  if (raw === 'disabled') return 0;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? undefined : n;
}

class PacketMessageModel {
  /**
   * 分页查询报文列表
   * @param {number} [current_page=1] - 当前页码
   * @param {number} [page_size=10] - 每页数量
   * @param {string} [id=''] - 报文ID
   * @param {string} [updated_at=''] - 更新时间
   * @param {string} [field_count=''] - 字段数量
   * @param {string} [keyword=''] - 关键词（搜索名称和描述）
   * @param {string} [hierarchy_node_id=''] - 层级节点ID
   * @param {string} [protocol=''] - 协议类型
   * @param {string} [status=''] - 状态（enabled/disabled）
   * @param {Array} [fields=[]] - 字段数组
   * @param {string} [category_id=''] - 分类ID
   * @returns {Object} 包含 list 和 pagination 的对象
   */
  static async findAll(
    current_page = 1,
    page_size = 10,
    id = '',
    updated_at = '',
    field_count = '',
    keyword = '',
    hierarchy_node_id = '',
    protocol = '',
    status = '',
    fields = [],
    category_id = ''
  ) {
    const where = { ...PUBLIC_LATEST_PUBLISHED_WHERE };
    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } }
      ];
    }
    if (hierarchy_node_id && isValidValue(hierarchy_node_id))
      where[HIERARCHY_NODE_ID_FIELD] = hierarchy_node_id;
    if (protocol) where.protocol = protocol;
    if (updated_at) where.updated_at = updated_at;
    if (field_count) where.field_count = field_count;
    if (fields && fields.length > 0) {
      where.fields = {
        [Op.ne]: '[]'
      };
    }
    if (category_id) where.category_id = category_id;

    const normalizedStatus = normalizeStatusValue(status);
    if (normalizedStatus !== undefined) where.status = normalizedStatus;

    const { count, rows } = await PacketMessage.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: page_size,
      offset: (current_page - 1) * page_size
    });

    return {
      list: rows.map((r) => r.toJSON()),
      pagination: { current_page, page_size, total: count }
    };
  }

  /**
   * 根据 ID 查询报文详情
   * @param {number|string} id - 报文ID
   * @returns {Object|null} 报文对象，不存在时返回 null
   */
  static async findById(id) {
    // 验证 ID 是否为有效数字
    const numId = parseInt(id);
    if (Number.isNaN(numId)) {
      return null;
    }
    const packet = await PacketMessage.findOne({
      where: { ...PUBLIC_LATEST_PUBLISHED_WHERE, id: numId }
    });
    return packet ? packet.toJSON() : null;
  }

  /**
   * 按 id 字段查询报文详情，返回解析后的数据（fields 会自动解析为数组）
   * @param {number|string} id - 报文ID
   * @returns {Object|null} 报文对象，不存在时返回 null
   */
  static async findByIdField(id) {
    // 验证 ID 是否为有效数字
    const numId = parseInt(id);
    if (Number.isNaN(numId)) {
      return null;
    }
    const message = await PacketMessage.findOne({
      where: { ...PUBLIC_LATEST_PUBLISHED_WHERE, id: numId }
    });
    if (!message) return null;
    return message.toJSON();
  }

  /**
   * 根据 ID 列表查询报文
   * @param {Array<number>} idList - 报文ID数组
   * @returns {Array<Object>} 报文对象数组
   */
  static async findByIds(idList) {
    if (!idList || idList.length === 0) return [];
    const messages = await PacketMessage.findAll({
      where: { id: idList, ...PUBLIC_LATEST_PUBLISHED_WHERE },
      raw: true
    });
    return messages;
  }

  /**
   * 获取报文详情（fields 字段会自动解析为数组）
   * @param {number|string} id - 报文ID
   * @returns {Object|null} 报文对象，不存在时返回 null
   */
  static async getPacketMessageDetail(id) {
    // 验证 ID 是否为有效数字
    const numId = parseInt(id);
    if (Number.isNaN(numId)) {
      return null;
    }
    // 直接从packet_messages表读取，fields字段已经是JSON格式
    const message = await PacketMessage.findOne({
      where: { ...PUBLIC_LATEST_PUBLISHED_WHERE, id: numId }
    });
    if (!message) return null;

    // fields字段在模型中定义了getter，会自动将JSON字符串解析为数组
    return message.toJSON();
  }

  /**
   * 创建报文
   * @param {Object} messageData - 报文数据
   * @param {string} messageData.name - 报文名称
   * @param {string} [messageData.description] - 报文描述
   * @param {number} [messageData.status] - 状态，默认为 1
   * @param {Array} [messageData.fields] - 字段数组
   * @returns {Object} 包含 insertId 的对象
   */
  static async create(messageData) {
    // Sequelize 的 setter 会自动序列化 fields 数组，不需要手动序列化
    const message = await PacketMessage.create({
      ...messageData,
      created_at: Date.now(),
      status: messageData.status || 1
    });
    return { insertId: message.id };
  }

  /**
   * 更新报文
   * @param {number} id - 报文ID
   * @param {Object} data - 更新数据
   * @returns {Object} 包含 changes 的对象
   */
  static async update(id, data) {
    const [changes] = await PacketMessage.update(
      { ...data, updated_at: Date.now() },
      { where: { id } }
    );
    return { changes };
  }

  /**
   * 删除报文
   * @param {number} id - 报文ID
   * @returns {Object} 包含 changes 的对象
   */
  static async delete(id) {
    const changes = await PacketMessage.destroy({ where: { id } });
    return { changes };
  }

  /**
   * 复制报文
   * @param {number} id - 原报文ID
   * @param {string} newName - 新报文名称
   * @returns {number} 新报文的ID
   * @throws {Error} 原报文不存在时抛出异常
   */
  static async duplicate(id, newName) {
    // 使用 getPacketMessageDetail 方法获取完整数据（fields 会被正确解析为数组）
    const originalMessage = await this.getPacketMessageDetail(id);
    if (!originalMessage) throw new Error('原报文不存在');

    // 完整复制所有字段，版本设置为 1.0
    const newMessage = await PacketMessage.create({
      name: newName,
      description: originalMessage.description || '',
      hierarchy_node_id: originalMessage.hierarchy_node_id || '',
      protocol: originalMessage.protocol,
      version: '1.0',
      default_byte_order: originalMessage.default_byte_order,
      struct_alignment: originalMessage.struct_alignment,
      field_count: originalMessage.field_count,
      fields: originalMessage.fields,
      status: 1,
      created_at: Date.now(),
      updated_at: Date.now()
    });

    return newMessage.id;
  }

  /**
   * 按 packet_messages.id 读取任意"已发布"版本（不要求 latest_key）
   * 用于接口引用旧版本协议报文的只读展示
   * @param {number} id - 报文ID
   * @returns {Object|null} 报文对象，不存在时返回 null
   */
  static async findPublishedById(id) {
    const message = await PacketMessage.findOne({
      where: { id, publish_status: 1 }
    });
    return message ? message.toJSON() : null;
  }

  /**
   * 更新报文列表（支持批量）
   * @param {Array<number>} id_list - 报文ID数组
   * @param {Object} data - 更新数据
   * @returns {Object} 包含 changes 的对象
   */
  static async updateList(id_list, data) {
    const [changes] = await PacketMessage.update(
      { ...data, updated_at: Date.now() },
      { where: { id: { [Op.in]: id_list } } }
    );
    return { changes };
  }

  /**
   * 删除报文列表（支持批量）
   * @param {Array<number>} id_list - 报文ID数组
   * @param {Object} transaction - 事务对象
   * @returns {Object} 包含 changes 的对象
   */
  static async deleteList(id_list, transaction) {
    const changes = await PacketMessage.destroy({
      where: { id: { [Op.in]: id_list } },
      transaction
    });
    return { changes };
  }

  /**
   * 获取层级节点列表
   * @returns {Array<Object>} 层级节点数组
   */
  static async getHierarchyNodeList() {
    const nodes = await PacketMessage.findAll({
      attributes: [
        [HIERARCHY_NODE_ID_FIELD, 'name'],
        [HIERARCHY_NODE_ID_FIELD, 'value']
      ],
      where: {
        ...PUBLIC_LATEST_PUBLISHED_WHERE,
        [HIERARCHY_NODE_ID_FIELD]: { [Op.notIn]: [null, ''] }
      },
      group: [[HIERARCHY_NODE_ID_FIELD]],
      order: [[HIERARCHY_NODE_ID_FIELD, 'ASC']],
      raw: true
    });
    return nodes;
  }

  /**
   * 获取协议列表
   * @returns {Array<Object>} 协议数组
   */
  static async getProtocolList() {
    const protocols = await PacketMessage.findAll({
      attributes: [
        ['protocol', 'name'],
        ['protocol', 'value']
      ],
      where: {
        ...PUBLIC_LATEST_PUBLISHED_WHERE,
        protocol: { [Op.notIn]: [null, ''] }
      },
      group: ['protocol'],
      order: [['protocol', 'ASC']],
      raw: true
    });
    return protocols;
  }

  /**
   * 获取所有报文（不分页，用于构建分类树）
   * 返回：最新已发布版本 + 所有草稿版本
   * @returns {Array<Object>} 报文对象数组
   */
  static async findAllSimple() {
    return await PacketMessage.findAll({
      where: {
        // 要么是最新已发布版本，要么是草稿
        [Op.or]: [{ ...PUBLIC_LATEST_PUBLISHED_WHERE }, { publish_status: 0 }]
      },
      order: [['created_at', 'DESC']],
      raw: true
    });
  }

  /**
   * 根据分类 ID 更新报文
   * @param {number} category_id - 分类ID
   * @param {Object} data - 更新数据
   * @returns {Object} 包含 changes 的对象
   */
  static async updateByCategoryId(category_id, data) {
    const [changes] = await PacketMessage.update(
      { ...data, updated_at: Date.now() },
      { where: { category_id } }
    );
    return { changes };
  }

  /**
   * 分页查询草稿报文列表
   * 查询条件：publish_status = 0 AND draft_key IS NOT NULL
   * @param {number} [current_page=1] - 当前页码
   * @param {number} [page_size=10] - 每页数量
   * @param {string} [id=''] - 报文ID
   * @param {string} [updated_at=''] - 更新时间
   * @param {string} [field_count=''] - 字段数量
   * @param {string} [keyword=''] - 关键词（搜索名称和描述）
   * @param {string} [hierarchy_node_id=''] - 层级节点ID
   * @param {string} [protocol=''] - 协议类型
   * @param {string} [status=''] - 状态（enabled/disabled）
   * @param {Array} [fields=[]] - 字段数组
   * @param {string} [category_id=''] - 分类ID
   * @returns {Object} 包含 list 和 pagination 的对象
   */
  static async findAllDrafts(
    current_page = 1,
    page_size = 10,
    id = '',
    updated_at = '',
    field_count = '',
    keyword = '',
    hierarchy_node_id = '',
    protocol = '',
    status = '',
    fields = [],
    category_id = ''
  ) {
    const where = {
      publish_status: 0,
      draft_key: { [Op.not]: null }
    };
    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } }
      ];
    }
    if (hierarchy_node_id && isValidValue(hierarchy_node_id))
      where[HIERARCHY_NODE_ID_FIELD] = hierarchy_node_id;
    if (protocol) where.protocol = protocol;
    if (updated_at) where.updated_at = updated_at;
    if (field_count) where.field_count = field_count;
    if (fields && fields.length > 0) {
      where.fields = {
        [Op.ne]: '[]'
      };
    }
    if (category_id) where.category_id = category_id;

    const normalizedStatus = normalizeStatusValue(status);
    if (normalizedStatus !== undefined) where.status = normalizedStatus;

    const { count, rows } = await PacketMessage.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: page_size,
      offset: (current_page - 1) * page_size
    });

    return {
      list: rows.map((r) => r.toJSON()),
      pagination: { current_page, page_size, total: count }
    };
  }
}

module.exports = PacketMessageModel;
