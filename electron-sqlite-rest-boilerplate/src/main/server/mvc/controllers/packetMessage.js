/**
 * @file       packetMessage.js
 * @brief      报文配置控制器，负责处理报文的增删改查、字段管理、批量操作和导入导出的HTTP请求
 * @date       2025-11-28
 * @copyright  Copyright (c) 2025
 */

const PacketMessageService = require('../services/packetMessage');
const log4js = require('../../middleware/log4jsPlus');
const logger = log4js.getLogger('httpApi');

class PacketMessageController {
  /**
   * 获取报文列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @returns {Promise<void>}
   */
  static async list(req, res) {
    try {
      const {
        current_page = 1,
        page_size = 10,
        keyword = '',
        hierarchy_node_id = '',
        protocol = '',
        status = '',
        field_count = '',
        updated_at = '',
        id = '',
        fields = [],
        category_id = ''
      } = req.query;

      const result = await PacketMessageService.list(
        parseInt(current_page),
        parseInt(page_size),
        keyword,
        hierarchy_node_id,
        protocol,
        status,
        field_count,
        updated_at,
        id,
        fields,
        category_id
      );

      res.apiSuccess(result);
    } catch (error) {
      logger.error('获取报文列表失败:', error);
      res.apiError(null, error.message || '获取报文列表失败');
    }
  }

  /**
   * 获取草稿报文列表
   * GET /api/packet-messages/draft/list
   */
  static async draftList(req, res) {
    try {
      const {
        current_page = 1,
        page_size = 10,
        keyword = '',
        hierarchy_node_id = '',
        protocol = '',
        status = '',
        field_count = '',
        updated_at = '',
        id = '',
        fields = [],
        category_id = ''
      } = req.query;

      const result = await PacketMessageService.draftList(
        parseInt(current_page),
        parseInt(page_size),
        keyword,
        hierarchy_node_id,
        protocol,
        status,
        field_count,
        updated_at,
        id,
        fields,
        category_id
      );

      res.apiSuccess(result);
    } catch (error) {
      logger.error('获取草稿报文列表失败:', error);
      res.apiError(null, error.message || '获取草稿报文列表失败');
    }
  }

  /**
   * 获取报文详情
   * GET /api/packet-messages/detail  params: { id }
   */
  static async detail(req, res) {
    try {
      const { id } = req.query;
      if (!id) {
        return res.apiError(null, '缺少必填参数: id');
      }
      // 支持数字ID（message_id）和字符串ID（id字段）
      const message = await PacketMessageService.detail(id);

      if (!message) {
        return res.apiError(null, '报文不存在');
      }

      res.apiSuccess(message);
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 获取"已发布"的指定版本报文详情（按 packet_messages.id）
   * GET /api/packet-messages/published  params: { id }
   */
  static async publishedDetail(req, res) {
    try {
      const { id } = req.query;
      if (!id) {
        return res.apiError(null, '缺少必填参数: id');
      }
      const message = await PacketMessageService.publishedDetail(id);
      if (!message) {
        return res.apiError(null, '报文不存在或未发布');
      }
      res.apiSuccess(message);
    } catch (error) {
      logger.error('[PacketMessage] publishedDetail error:', error);
      res.apiError(null, error.message || '获取报文详情失败');
    }
  }

  /**
   * 创建草稿（未发布修订）
   * POST /api/packet-messages/draft/create
   */
  static async draftCreate(req, res) {
    try {
      const draft = await PacketMessageService.draftCreate(req.body || {});
      res.apiSuccess(draft, '草稿已创建');
    } catch (error) {
      logger.error('[PacketMessage] draftCreate error:', error);
      res.apiError(null, error.message);
    }
  }

  /**
   * 保存草稿（未发布修订）
   * PUT /api/packet-messages/draft/update  body: { draft_id, ... }
   */
  static async draftUpdate(req, res) {
    try {
      const draft_id = req.body?.draft_id;
      const draft = await PacketMessageService.draftUpdate(draft_id, req.body || {});
      res.apiSuccess(draft, '草稿已保存');
    } catch (error) {
      logger.error('[PacketMessage] draftUpdate error:', error);
      res.apiError(null, error.message);
    }
  }

  /**
   * 获取草稿详情（未发布修订）
   * GET /api/packet-messages/draft/detail?draft_id=...
   */
  static async draftDetail(req, res) {
    try {
      const { draft_id } = req.query;
      const draft = await PacketMessageService.draftDetail(draft_id);
      if (!draft) return res.apiError(null, '草稿不存在');
      res.apiSuccess(draft);
    } catch (error) {
      logger.error('[PacketMessage] draftDetail error:', error);
      res.apiError(null, error.message);
    }
  }

  /**
   * 检查草稿是否存在
   * GET 支持单个（query: message_id），POST 支持批量（body: message_ids）
   */
  static async draftCheck(req, res) {
    try {
      // POST 请求：批量检查
      if (req.method === 'POST' && req.body?.message_ids) {
        const result = await PacketMessageService.checkDraftByIds(req.body.message_ids);
        res.apiSuccess(result);
        return;
      }
      // GET 请求：单个检查
      const { message_id } = req.query;
      const result = await PacketMessageService.checkDraft(message_id);
      res.apiSuccess(result);
    } catch (error) {
      logger.error('[PacketMessage] draftCheck error:', error);
      res.apiError(null, error.message);
    }
  }

  /**
   * 确保草稿存在：若不存在则从最新已发布复制一份
   * POST /api/packet-messages/draft/ensure  body: { message_id }
   */
  static async draftEnsure(req, res) {
    try {
      const message_id = req.body?.message_id;
      const draft = await PacketMessageService.draftEnsure(message_id);
      res.apiSuccess(draft);
    } catch (error) {
      logger.error('[PacketMessage] draftEnsure error:', error);
      res.apiError(null, error.message);
    }
  }

  /**
   * 草稿复制：从某条报文复制出一个新的协议草稿
   * POST /api/packet-messages/draft/duplicate  body: { source_id, name }
   */
  static async draftDuplicate(req, res) {
    try {
      const { source_id, name } = req.body || {};
      const draft = await PacketMessageService.draftDuplicate(source_id, name);
      res.apiSuccess(draft, '草稿已创建');
    } catch (error) {
      logger.error('[PacketMessage] draftDuplicate error:', error);
      res.apiError(null, error.message);
    }
  }

  /**
   * 发布草稿（自动 +1.0）
   * POST /api/packet-messages/draft/publish  body: { draft_id }
   */
  static async draftPublish(req, res) {
    try {
      const draft_id = req.body?.draft_id;
      const published = await PacketMessageService.draftPublish(draft_id);
      res.apiSuccess(published, '发布成功');
    } catch (error) {
      logger.error('[PacketMessage] draftPublish error:', error);
      res.apiError(null, error.message);
    }
  }

  /**
   * 版本列表（仅已发布版本）
   * GET /api/packet-messages/versions?message_id=...
   */
  static async versionList(req, res) {
    try {
      const { message_id } = req.query;
      const versionList = await PacketMessageService.versionList(message_id);
      res.apiSuccess(versionList);
    } catch (error) {
      logger.error('[PacketMessage] versionList error:', error);
      res.apiError(null, error.message);
    }
  }

  /**
   * 创建报文
   */
  static async create(req, res) {
    try {
      logger.info('========== 创建报文请求 ==========');
      logger.info('请求体:', JSON.stringify(req.body, null, 2));

      const result = await PacketMessageService.createPacketMessage(req.body);

      // 返回新创建的报文完整信息（包括message_id和id字段）
      const newMessage = await PacketMessageService.detail(result.insertId);
      res.apiSuccess(newMessage, '报文创建成功');
    } catch (error) {
      logger.error('创建报文失败:', error);
      logger.error('错误堆栈:', error.stack);
      res.apiError(null, error.message);
    }
  }

  /**
   * 更新报文
   * POST /api/packet-messages/update  body: { id, name, hierarchy_node_id, protocol, ... }
   */
  static async update(req, res) {
    try {
      logger.info('========== 更新报文请求 ==========');

      const { id } = req.body;
      if (!id) {
        return res.apiError(null, '缺少必填字段: id');
      }

      const updateData = req.body;

      logger.info('ID:', id);
      logger.info('请求体:', JSON.stringify(req.body, null, 2));
      logger.info('提取的字段:');
      logger.info('  FIELDS:', updateData.FIELDS || updateData.fields);
      logger.info(
        '  FIELDS类型:',
        typeof (updateData.FIELDS || updateData.fields),
        Array.isArray(updateData.FIELDS || updateData.fields)
      );

      await PacketMessageService.updatePacketMessage(id, updateData);
      res.apiSuccess(null, '报文更新成功');
    } catch (error) {
      logger.error('更新报文失败:', error);
      logger.error('错误堆栈:', error.stack);
      res.apiError(null, error.message);
    }
  }

  /**
   * 复制报文
   * POST /api/packet-messages/duplicate  body: { id, name }
   */
  static async duplicate(req, res) {
    try {
      const { id, name } = req.body;

      if (!id) {
        return res.apiError(null, '缺少必填字段: id');
      }
      if (!name) {
        return res.apiError(null, '新报文名称不能为空');
      }

      // 兼容旧接口：复制后生成"新的协议草稿"（不影响现有协议版本链）
      const draft = await PacketMessageService.draftDuplicate(id, name);
      res.apiSuccess(draft, '草稿已创建');
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 导出报文（单个）
   * POST /api/packet-messages/export-single  body: { id }
   */
  static async export(req, res) {
    try {
      const { id } = req.body;
      if (!id) {
        return res.apiError(null, '缺少必填字段: id');
      }

      const message = await PacketMessageService.detail(parseInt(id));

      if (!message) {
        return res.apiError(null, '报文不存在');
      }

      // 设置下载响应头
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="message_${id}.json"`);

      res.apiSuccess(message, '导出成功');
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 生成代码（预览）
   * POST /api/packet-messages/generate-code  body: { id }
   */
  static async generateCode(req, res) {
    try {
      const { id } = req.body;
      if (!id) {
        return res.apiError(null, '缺少必填字段: id');
      }

      const result = await PacketMessageService.generateCode(parseInt(id));
      res.apiSuccess(result, '代码生成成功');
    } catch (error) {
      if (error.validationErrorList) {
        // 返回校验错误列表
        return res.apiError({ errorList: error.validationErrorList }, '报文配置校验失败');
      }
      res.apiError(null, error.message);
    }
  }

  /**
   * 启用报文（支持批量）
   * POST /api/packet-messages/enable  body: { ids }
   */
  static async enable(req, res) {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.apiError(null, '请选择要启用的报文');
      }

      await PacketMessageService.enable(ids);
      res.apiSuccess(null, '启用成功');
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 禁用报文（支持批量）
   * POST /api/packet-messages/disable  body: { ids }
   */
  static async disable(req, res) {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.apiError(null, '请选择要禁用的报文');
      }

      await PacketMessageService.disable(ids);
      res.apiSuccess(null, '禁用成功');
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 批量删除报文
   * POST /api/packet-messages/delete  body: { ids }
   */
  static async deleteList(req, res) {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.apiError(null, '请选择要删除的报文');
      }

      await PacketMessageService.deleteList(ids);
      res.apiSuccess(null, '删除成功');
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 批量导出报文
   * POST /api/packet-messages/export  body: { ids }
   */
  static async batchExport(req, res) {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.apiError(null, '请选择要导出的报文');
      }

      const messages = [];
      for (const id of ids) {
        const message = await PacketMessageService.detail(parseInt(id));
        if (message) {
          messages.push(message);
        }
      }

      // 设置下载响应头
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="messages_${Date.now()}.json"`);

      res.apiSuccess(messages, '批量导出成功');
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 导入报文
   */
  static async import(req, res) {
    try {
      const messageData = req.body;

      if (!messageData || !messageData.name) {
        return res.apiError(null, '报文数据格式错误');
      }

      await PacketMessageService.createPacketMessage(messageData);

      res.apiSuccess(null, '导入成功');
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  // 字段管理接口

  /**
   * 获取字段类型列表
   */
  static async getFieldTypes(req, res) {
    try {
      const fieldTypes = [
        { type: 'UnsignedInt', name: '无符号整数', description: '32位无符号整数' },
        { type: 'Int8', name: '8位整数', description: '8位有符号整数' },
        { type: 'Int16', name: '16位整数', description: '16位有符号整数' },
        { type: 'Int32', name: '32位整数', description: '32位有符号整数' },
        { type: 'Int64', name: '64位整数', description: '64位有符号整数' },
        { type: 'Uint8', name: '8位无符号整数', description: '8位无符号整数' },
        { type: 'Uint16', name: '16位无符号整数', description: '16位无符号整数' },
        { type: 'Uint32', name: '32位无符号整数', description: '32位无符号整数' },
        { type: 'Uint64', name: '64位无符号整数', description: '64位无符号整数' },
        { type: 'Float', name: '单精度浮点数', description: '32位浮点数' },
        { type: 'Double', name: '双精度浮点数', description: '64位浮点数' },
        { type: 'Bool', name: '布尔值', description: 'true/false' },
        { type: 'String', name: '字符串', description: '文本字符串' },
        { type: 'Struct', name: '结构体', description: '复合类型，可包含子字段' },
        { type: 'Array', name: '数组', description: '数组类型，可包含子字段' },
        { type: 'Bit', name: '位字段', description: '位操作字段' },
        { type: 'Enum', name: '枚举', description: '枚举类型' }
      ];

      res.apiSuccess(fieldTypes);
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 获取字段类型配置
   * GET /api/packet-messages/field-types/config  params: { type }
   */
  static async getFieldTypeConfig(req, res) {
    try {
      const { type } = req.query;
      if (!type) {
        return res.apiError(null, '缺少必填参数: type');
      }

      const typeConfigs = {
        UnsignedInt: { min: 0, max: 4294967295, defaultValue: 0 },
        Int8: { min: -128, max: 127, defaultValue: 0 },
        Int16: { min: -32768, max: 32767, defaultValue: 0 },
        Int32: { min: -2147483648, max: 2147483647, defaultValue: 0 },
        Int64: { min: -9223372036854775808, max: 9223372036854775807, defaultValue: 0 },
        Uint8: { min: 0, max: 255, defaultValue: 0 },
        Uint16: { min: 0, max: 65535, defaultValue: 0 },
        Uint32: { min: 0, max: 4294967295, defaultValue: 0 },
        Uint64: { min: 0, max: 18446744073709551615, defaultValue: 0 },
        Float: { min: -3.4e38, max: 3.4e38, defaultValue: 0.0 },
        Double: { min: -1.7e308, max: 1.7e308, defaultValue: 0.0 },
        Bool: { values: [true, false], defaultValue: false },
        String: { minLength: 0, maxLength: 65535, defaultValue: '' },
        Struct: { canHaveChildren: true, description: '结构体类型，可以包含多个子字段' },
        Array: { canHaveChildren: true, description: '数组类型，可以包含多个相同类型的子字段' },
        Bit: { bitLength: 1, defaultValue: 0 },
        Enum: { values: [], defaultValue: '', description: '枚举值需要在使用时定义' }
      };

      const config = typeConfigs[type];
      if (!config) {
        return res.apiError(null, '字段类型不存在');
      }

      res.apiSuccess({ type, ...config });
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 获取层级节点列表
   */
  static async getHierarchyNodeList(req, res) {
    try {
      const nodes = await PacketMessageService.getHierarchyNodeList();
      res.apiSuccess(nodes);
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 获取报文引用关系
   * GET /api/packet-messages/references  params: { id }
   */
  static async getPacketReferences(req, res) {
    try {
      const { id } = req.query;
      if (!id) {
        return res.apiError(null, '缺少必填参数: id');
      }
      const result = await PacketMessageService.getPacketReferences(id);
      res.apiSuccess(result);
    } catch (error) {
      logger.error('[PacketMessage] getPacketReferences error:', error);
      res.apiError(null, error.message || '获取报文引用关系失败');
    }
  }

  /**
   * 批量查询报文基本信息（按 ID 列表）
   * POST /api/packet-messages/query-by-ids  body: { ids }
   */
  static async queryByIds(req, res) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.apiError(null, '请提供要查询的报文ID列表');
      }
      const result = await PacketMessageService.queryByIds(ids);
      res.apiSuccess(result);
    } catch (error) {
      logger.error('[PacketMessage] queryByIds error:', error);
      res.apiError(null, error.message || '批量查询报文失败');
    }
  }
}

module.exports = PacketMessageController;
