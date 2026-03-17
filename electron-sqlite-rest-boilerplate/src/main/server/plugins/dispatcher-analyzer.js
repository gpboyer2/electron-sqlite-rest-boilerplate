/**
 * 协议分发器配置分析器
 *
 * 用于分析多个单协议JSON配置文件，自动生成dispatcher配置
 *
 * 当前代码生成逻辑当中没有用到这个文件
 *
 * @author AI Assistant
 * @date 2025-11-28
 */

const log4js = require('../middleware/log4jsPlus');
const logger = log4js.getLogger('default');

/**
 * 计算字段的字节长度
 * @param {Object} field - 字段对象
 * @returns {number} 字段的字节长度，-1表示动态长度无法确定
 */
function calculateFieldByteLength(field) {
  if (!field || !field.type) {
    return 0;
  }

  switch (field.type) {
    case 'UnsignedInt':
    case 'SignedInt':
    case 'MessageId':
    case 'Bitfield':
    case 'Bcd':
    case 'Checksum':
    case 'Timestamp':
    case 'Encode':
    case 'Command':
    case 'Padding':
      return field.byte_length || 0;

    case 'Float':
      if (field.precision === 'float') return 4;
      if (field.precision === 'double') return 8;
      return field.byte_length || 4;

    case 'String':
      // 如果length为0，表示变长字符串，无法确定长度
      if (field.length === 0 || field.length === undefined) {
        return -1; // 动态长度
      }
      return field.length;

    case 'Struct':
      // 递归计算结构体内所有字段的总长度
      if (field.fields && Array.isArray(field.fields)) {
        let totalLength = 0;
        for (const subField of field.fields) {
          const subLen = calculateFieldByteLength(subField);
          if (subLen === -1) {
            return -1; // 包含动态长度字段
          }
          totalLength += subLen;
        }
        return totalLength;
      }
      return 0;

    case 'Array':
      // 如果是动态数组（count_from_field），无法确定长度
      if (field.count_from_field) {
        return -1;
      }
      // 固定长度数组
      if (field.count !== undefined && field.element) {
        const elementLen = calculateFieldByteLength(field.element);
        if (elementLen === -1) {
          return -1;
        }
        return field.count * elementLen;
      }
      return -1;

    default:
      // 未知类型，尝试使用byte_length
      return field.byte_length || 0;
  }
}

/**
 * 在字段列表中递归查找MessageId字段及其偏移量
 * @param {Array<Object>} fields - 字段数组
 * @param {number} currentOffset - 当前偏移量
 * @returns {Object|null} 返回包含 field 和 offset 的对象，未找到返回 null
 */
function findMessageIdField(fields, currentOffset = 0) {
  if (!fields || !Array.isArray(fields)) {
    return null;
  }

  let offset = currentOffset;

  for (const field of fields) {
    // 检查当前字段是否是MessageId
    if (field.type === 'MessageId') {
      return {
        field: field,
        offset: offset
      };
    }

    // 如果是结构体，递归搜索
    if (field.type === 'Struct' && field.fields) {
      const result = findMessageIdField(field.fields, offset);
      if (result) {
        return result;
      }
    }

    // 计算当前字段的长度，累加到offset
    const fieldLength = calculateFieldByteLength(field);
    if (fieldLength === -1) {
      // 遇到动态长度字段，无法继续计算后续字段的精确offset
      // 但我们假设MessageId通常在动态字段之前
      // 继续搜索，但标记可能不准确
      logger.warn(`警告: 字段 "${field.field_name}" 是动态长度，后续offset计算可能不准确`);
      offset = -1; // 标记offset不确定
    } else if (offset !== -1) {
      offset += fieldLength;
    }
  }

  return null;
}

/**
 * 分析单个协议JSON，提取MessageId信息
 * @param {Object} protocol - 协议JSON对象
 * @param {string} protocolName - 协议名称，用于错误信息
 * @returns {Object} 返回分析结果，包含 found、field_name、offset、size 等字段
 */
function analyzeProtocol(protocol, protocolName = 'Unknown') {
  const result = {
    found: false,
    field_name: null,
    offset: -1,
    size: -1,
    value_type: null,
    byte_order: null,
    message_id_value: null,
    error: null
  };

  if (!protocol || !protocol.fields || !Array.isArray(protocol.fields)) {
    result.error = `协议 "${protocolName}" 没有有效的fields数组`;
    return result;
  }

  // 获取默认字节序
  const default_byte_order = protocol.default_byte_order || 'big';

  // 查找MessageId字段
  const messageIdResult = findMessageIdField(protocol.fields, 0);

  if (!messageIdResult) {
    result.error = `协议 "${protocolName}" 中未找到MessageId类型的字段`;
    return result;
  }

  const messageIdField = messageIdResult.field;

  result.found = true;
  result.field_name = messageIdField.field_name || 'messageId';
  result.offset = messageIdResult.offset;
  result.size = messageIdField.byte_length || 0;
  result.value_type = messageIdField.value_type || 'UnsignedInt';
  result.byte_order = messageIdField.byte_order || default_byte_order;
  result.message_id_value = messageIdField.message_id_value;

  // 验证必要属性
  if (result.offset === -1) {
    result.error = `协议 "${protocolName}" 的MessageId字段offset无法确定（之前存在动态长度字段）`;
    result.found = false;
  }

  if (result.size <= 0) {
    result.error = `协议 "${protocolName}" 的MessageId字段没有有效的byte_length`;
    result.found = false;
  }

  if (result.message_id_value === null || result.message_id_value === undefined) {
    result.error = `协议 "${protocolName}" 的MessageId字段没有设置message_id_value`;
    result.found = false;
  }

  return result;
}

/**
 * 将message_id_value转换为十进制字符串格式
 * @param {number|string} value - message_id_value值
 * @param {number} size - 字节长度（已忽略，仅为兼容原接口）
 * @returns {string} 十进制字符串，如 "256"
 */
function formatMessageIdKey(value, size) {
  let numValue;
  if (typeof value === 'string') {
    // 支持16进制字符串，同时支持10进制字符串
    if (value.startsWith('0x') || value.startsWith('0X')) {
      numValue = parseInt(value, 16);
    } else {
      numValue = parseInt(value, 10);
    }
  } else {
    numValue = value;
  }
  // 返回十进制字符串
  return String(numValue);
}

/**
 * 分析多个协议配置文件，生成dispatcher配置
 * @param {Array<Object>} protocols - 协议JSON对象数组
 * @returns {Object} 返回dispatcher配置结果，包含 dispatch、messages、status、error_messages 字段
 * @example
 * const protocols = [
 *     { name: "Protocol1", fields: [...], ... },
 *     { name: "Protocol2", fields: [...], ... }
 * ];
 * const result = analyzeProtocolsForDispatcher(protocols);
 * logger.info(result);
 * // {
 * //     dispatch: { field: "messageId", type: "UnsignedInt", byteOrder: "big", offset: 6, size: 2 },
 * //     messages: { "0x0100": {...}, "0x0101": {...} },
 * //     status: "1",
 * //     error_messages: ""
 * // }
 */
function analyzeProtocolsForDispatcher(protocols) {
  const result = {
    dispatch: {},
    messages: {},
    status: '1',
    error_messages: ''
  };

  // 输入验证
  if (!protocols || !Array.isArray(protocols)) {
    result.status = '2';
    result.error_messages = '输入参数必须是协议JSON对象数组';
    return result;
  }

  if (protocols.length === 0) {
    result.status = '2';
    result.error_messages = '协议数组为空，至少需要一个协议';
    return result;
  }

  const errors = [];
  const analysisResults = [];

  // 分析每个协议
  for (let i = 0; i < protocols.length; i++) {
    const protocol = protocols[i];
    const protocolName = protocol.name || `Protocol_${i + 1}`;

    const analysis = analyzeProtocol(protocol, protocolName);

    if (!analysis.found) {
      errors.push(analysis.error);
      continue;
    }

    analysisResults.push({
      protocol: protocol,
      protocolName: protocolName,
      analysis: analysis
    });
  }

  // 检查是否有成功分析的协议
  if (analysisResults.length === 0) {
    result.status = '2';
    result.error_messages = errors.join('; ');
    return result;
  }

  // 验证所有协议的MessageId offset和size是否一致
  const firstAnalysis = analysisResults[0].analysis;
  const referenceOffset = firstAnalysis.offset;
  const referenceSize = firstAnalysis.size;
  const referenceValueType = firstAnalysis.value_type;
  const referenceByteOrder = firstAnalysis.byte_order;
  const referenceFieldName = firstAnalysis.field_name;

  const inconsistencies = [];

  for (let i = 1; i < analysisResults.length; i++) {
    const { protocolName, analysis } = analysisResults[i];

    if (analysis.offset !== referenceOffset) {
      inconsistencies.push(
        `协议 "${protocolName}" 的MessageId offset (${analysis.offset}) 与第一个协议 (${referenceOffset}) 不一致`
      );
    }

    if (analysis.size !== referenceSize) {
      inconsistencies.push(
        `协议 "${protocolName}" 的MessageId size (${analysis.size}) 与第一个协议 (${referenceSize}) 不一致`
      );
    }
  }

  // 如果有不一致项，返回错误
  if (inconsistencies.length > 0) {
    result.status = '2';
    result.error_messages = inconsistencies.join('; ');
    // 即使有不一致，也尝试生成部分结果供参考
  }

  // 检查messageIdValue是否有重复
  const messageIdValues = new Map();
  const duplicates = [];

  for (const { protocolName, analysis } of analysisResults) {
    const key = formatMessageIdKey(analysis.messageIdValue, referenceSize);

    if (messageIdValues.has(key)) {
      duplicates.push(`MessageId值 ${key} 重复: "${messageIdValues.get(key)}" 和 "${protocolName}"`);
    } else {
      messageIdValues.set(key, protocolName);
    }
  }

  if (duplicates.length > 0) {
    const dupError = duplicates.join('; ');
    if (result.status === '2') {
      result.error_messages += '; ' + dupError;
    } else {
      result.status = '2';
      result.error_messages = dupError;
    }
  }

  // 生成dispatch配置
  result.dispatch = {
    field: referenceFieldName,
    type: referenceValueType,
    byteOrder: referenceByteOrder,
    offset: referenceOffset,
    size: referenceSize
  };

  // 生成messages映射
  for (const { protocol, analysis } of analysisResults) {
    const key = formatMessageIdKey(analysis.messageIdValue, referenceSize);
    result.messages[key] = protocol;
  }

  // 如果之前有分析错误但不影响生成，添加警告
  if (errors.length > 0 && result.status === '1') {
    result.error_messages = `警告: 部分协议分析失败 - ${errors.join('; ')}`;
  }

  return result;
}

// 导出函数（CommonJS 格式）
module.exports = { analyzeProtocolsForDispatcher };

// 如果直接运行此文件，执行示例测试
if (require.main === module) {
  // 示例测试
  logger.info('===== 测试协议分析 =====');
  const testProtocols = [
    {
      name: 'Protocol1',
      version: '1.0',
      default_byte_order: 'big',
      fields: [
        {
          type: 'UnsignedInt',
          field_name: 'header',
          byte_length: 2
        },
        {
          type: 'UnsignedInt',
          field_name: 'length',
          byte_length: 4
        },
        {
          type: 'MessageId',
          field_name: 'messageId',
          byte_length: 2,
          value_type: 'UnsignedInt',
          message_id_value: 256
        },
        {
          type: 'UnsignedInt',
          field_name: 'data',
          byte_length: 4
        }
      ]
    },
    {
      name: 'Protocol2',
      version: '1.0',
      default_byte_order: 'big',
      fields: [
        {
          type: 'UnsignedInt',
          field_name: 'header',
          byte_length: 2
        },
        {
          type: 'UnsignedInt',
          field_name: 'length',
          byte_length: 4
        },
        {
          type: 'String',
          field_name: 'message',
          length: 32
        },
        {
          type: 'MessageId',
          field_name: 'messageId',
          byte_length: 2,
          value_type: 'UnsignedInt',
          message_id_value: 257
        }
      ]
    },
    {
      name: 'Protocol3',
      version: '1.0',
      default_byte_order: 'big',
      fields: [
        {
          type: 'UnsignedInt',
          field_name: 'header',
          byte_length: 2
        },
        {
          type: 'UnsignedInt',
          field_name: 'length',
          byte_length: 4
        },
        {
          type: 'MessageId',
          field_name: 'messageId',
          byte_length: 2,
          value_type: 'UnsignedInt',
          message_id_value: 258
        },
        {
          type: 'Float',
          field_name: 'temperature',
          precision: 'float'
        }
      ]
    }
  ];

  const result = analyzeProtocolsForDispatcher(testProtocols);
  logger.info(JSON.stringify(result, null, 2));
}
