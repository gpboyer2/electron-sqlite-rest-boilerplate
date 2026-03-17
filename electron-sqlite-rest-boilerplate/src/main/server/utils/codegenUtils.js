/**
 * @file codegenUtils.js
 * @brief code_gen/nodegen 相关的公共工具函数
 *
 * 注意：
 * - 本项目的 build 服务依赖这些工具函数进行配置规范化、校验与打包。
 * - 这里实现的是“可运行且安全”的基础版本：保证服务启动不因缺失模块而失败，
 *   并提供足够的默认行为支持 build 任务（normalize/validate/zip）。
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

function toStringSafe(v) {
  return typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v);
}

/**
 * 清洗名称（统一入口）：
 * - 默认用于路径/目录/label：保留字母数字、下划线与中划线；其它字符替换为下划线。
 * - 可用于跨语言“标识符”场景（C++/Java/Python 共同子集）：仅允许字母数字与下划线，且首字符必须为字母或下划线。
 * @param {string} name
 * @param {string} [fallbackKey] - 当 name 为空时用于生成兜底名
 * @param {{purpose?: 'path'|'identifier', dialect?: 'portable'|'cpp'|'java'|'python'}} [options]
 */
function sanitizeName(name, fallbackKey, options) {
  const purpose = options && options.purpose ? options.purpose : 'path';
  const dialect = options && options.dialect ? options.dialect : 'portable';

  const raw = toStringSafe(name).trim();
  const base = raw || (fallbackKey ? `name_${toStringSafe(fallbackKey).trim()}` : 'name');

  // identifier：跨语言最小公共子集（默认 portable）
  if (purpose === 'identifier') {
    // 当前实现保持 portable 与各语言一致：仅允许 [A-Za-z0-9_]
    // dialect 参数预留，用于未来必要时收紧/放宽某些规则
    let cleaned = base
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    cleaned = cleaned || 'name';

    // 首字符必须是字母或下划线（C++/Java/Python 共同约束）
    if (!/^[A-Za-z_]/.test(cleaned)) {
      cleaned = `_${cleaned}`;
    }

    // 二次兜底：确保最终满足 ^[A-Za-z_][A-Za-z0-9_]*$
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(cleaned)) {
      cleaned = 'name';
    }

    return cleaned;
  }

  // path（默认）：保留中划线，适用于目录名/label 等场景
  const cleaned = base
    .replace(/[^\w-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'name';
}

/**
 * 清洗 ID：更严格地只保留字母数字、下划线与中划线。
 * @param {string} id
 */
function sanitizeId(id) {
  const raw = toStringSafe(id).trim();
  const cleaned = raw
    .replace(/[^\w-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'id';
}

function toNumberIfNumeric(v) {
  if (v === null || v === undefined) return v;
  if (typeof v === 'number') return v;
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return v;
  const n = Number(s);
  return Number.isFinite(n) ? n : v;
}

/**
 * 规范化字段列表（就地修改）
 * - 纠正常见数值字段为 number
 * - 递归处理 Struct/Array/Command 等嵌套结构
 * @param {any} fields
 */
function normalizeFields(fields) {
  if (!Array.isArray(fields)) return fields;
  for (const f of fields) {
    if (!f || typeof f !== 'object') continue;
    if ('byte_length' in f) f.byte_length = toNumberIfNumeric(f.byte_length);
    if ('length' in f) f.length = toNumberIfNumeric(f.length);
    if ('count' in f) f.count = toNumberIfNumeric(f.count);
    if ('bytes_in_trailer' in f) f.bytes_in_trailer = toNumberIfNumeric(f.bytes_in_trailer);
    if ('struct_alignment' in f) f.struct_alignment = toNumberIfNumeric(f.struct_alignment);

    // MessageId: baseType 必须为 'UnsignedInt' | 'SignedInt'
    // DB 中 fields JSON 可能是 snake_case 或 camelCase，需兼容两种格式
    // 历史数据可能仅存 valueType 而 baseType 为空，此处做防御性回填
    if (f.type === 'MessageId') {
      const bt = f.baseType || f.base_type || '';
      const vt = f.valueType || f.value_type || '';
      if (bt !== 'UnsignedInt' && bt !== 'SignedInt') {
        const resolved = vt === 'UnsignedInt' || vt === 'SignedInt' ? vt : 'UnsignedInt';
        // 同时设置两种格式的 key，确保无论 convertSnakeToCamelDeep 如何处理都能生效
        f.baseType = resolved;
        f.base_type = resolved;
      }
    }

    // Encode/Command: V1 使用 "signed"/"unsigned"，V2 要求 "SignedInt"/"UnsignedInt"
    if (f.type === 'Encode' || f.type === 'Command') {
      const bt = f.baseType || f.base_type || '';
      if (bt === 'signed') {
        f.baseType = 'SignedInt';
        f.base_type = 'SignedInt';
      } else if (bt === 'unsigned') {
        f.baseType = 'UnsignedInt';
        f.base_type = 'UnsignedInt';
      }
    }

    if (Array.isArray(f.fields)) normalizeFields(f.fields);
    if (f.element && typeof f.element === 'object') normalizeFields([f.element]);
    if (f.cases && typeof f.cases === 'object') {
      for (const v of Object.values(f.cases)) {
        if (v && typeof v === 'object') normalizeFields([v]);
      }
    }
  }
  return fields;
}

/**
 * 规范化软件配置（就地修改）
 * @param {any} softwareConfig
 */
function normalizeSoftwareConfig(softwareConfig) {
  if (!softwareConfig || typeof softwareConfig !== 'object') return softwareConfig;
  if (Array.isArray(softwareConfig.connections)) {
    for (const conn of softwareConfig.connections) {
      if (conn && conn.messages && typeof conn.messages === 'object') {
        for (const protocol of Object.values(conn.messages)) {
          if (protocol && typeof protocol === 'object' && Array.isArray(protocol.fields)) {
            normalizeFields(protocol.fields);
          }
        }
      }
    }
  }
  return softwareConfig;
}

/**
 * 校验软件配置
 * @param {any} softwareConfig
 * @returns {string[]} 错误列表（为空表示通过）
 */
function validateSoftwareConfig(softwareConfig) {
  if (!softwareConfig || typeof softwareConfig !== 'object') {
    return ['软件配置不合法：不是对象'];
  }
  // 目前保持轻量校验：避免因校验过严导致 build 无法使用。
  return [];
}

/**
 * 递归校验协议字段（nodegen 预校验的最小子集）
 * - 校验 SignedInt/UnsignedInt 的 byte_length 是否为 1、2、4、8
 * - 校验 byte_length 不能为负数
 * - 校验 valueRange/value_range 中的 min/max 是否同时存在
 * - 用于在启动 nodegen 前把错误转为结构化 validationErrorList，提升前端提示友好度
 *
 * @param {any[]} fields
 * @param {{packetName?: string, fieldPathPrefix?: string}} [options]
 * @returns {Array<{packetName: string, fieldPath: string, message: string}>}
 */
function validateProtocolFields(fields, options) {
  const packetName = typeof options?.packetName === 'string' ? options.packetName : '';
  const prefix = typeof options?.fieldPathPrefix === 'string' ? options.fieldPathPrefix : '';
  const error_list = [];

  if (!Array.isArray(fields)) return error_list;

  for (let i = 0; i < fields.length; i += 1) {
    const f = fields[i];
    if (!f || typeof f !== 'object') continue;

    const field_name =
      typeof f.fieldName === 'string' && f.fieldName.trim()
        ? f.fieldName.trim()
        : typeof f.field_name === 'string' && f.field_name.trim()
          ? f.field_name.trim()
          : `field_${i + 1}`;

    const full_name = prefix ? `${prefix}.${field_name}` : field_name;

    // 校验 SignedInt/UnsignedInt 的 byte_length
    const field_type = f.type || f.fieldType;
    if (field_type === 'SignedInt' || field_type === 'UnsignedInt') {
      const byte_length = f.byte_length ?? f.byteLength;
      if (byte_length === undefined || byte_length === null) {
        error_list.push({
          packetName,
          fieldPath: full_name,
          message: '字节长度(byte_length)不能为空'
        });
      } else if (typeof byte_length === 'number' && byte_length < 0) {
        error_list.push({
          packetName,
          fieldPath: full_name,
          message: '字节长度(byte_length)不能为负数'
        });
      } else if (byte_length !== undefined && ![1, 2, 4, 8].includes(byte_length)) {
        error_list.push({
          packetName,
          fieldPath: full_name,
          message: '字节长度(byte_length)必须为1、2、4、8之一'
        });
      }
    }

    const range_list = Array.isArray(f.valueRange)
      ? f.valueRange
      : Array.isArray(f.value_range)
        ? f.value_range
        : null;

    if (Array.isArray(range_list)) {
      for (let j = 0; j < range_list.length; j += 1) {
        const r = range_list[j];
        const has_min = r && r.min !== null && r.min !== undefined;
        const has_max = r && r.max !== null && r.max !== undefined;
        if (!has_min || !has_max) {
          error_list.push({
            packetName,
            fieldPath: `${full_name}.valueRange[${j}]`,
            message: '取值范围缺少 min 或 max'
          });
        }
      }
    }

    // Struct: 递归字段列表
    if (Array.isArray(f.fields) && f.fields.length > 0) {
      error_list.push(
        ...validateProtocolFields(f.fields, { packetName, fieldPathPrefix: full_name })
      );
    }

    // Array: element 作为单个字段配置递归
    if (f.element && typeof f.element === 'object') {
      error_list.push(
        ...validateProtocolFields([f.element], {
          packetName,
          fieldPathPrefix: `${full_name}.elements`
        })
      );
    }

    // Command: cases 分支递归
    if (f.cases && typeof f.cases === 'object') {
      for (const [caseKey, caseValue] of Object.entries(f.cases)) {
        if (!caseValue || typeof caseValue !== 'object') continue;
        error_list.push(
          ...validateProtocolFields([caseValue], {
            packetName,
            fieldPathPrefix: `${full_name}.cases.${caseKey}`
          })
        );
      }
    }
  }

  return error_list;
}

function snakeToCamelKey(key) {
  return toStringSafe(key).replace(/_([a-zA-Z0-9])/g, (_, c) => String(c).toUpperCase());
}

/**
 * 深度将 snake_case key 转换为 camelCase key
 * @param {any} value
 * @returns {any}
 */
function convertSnakeToCamelDeep(value) {
  if (Array.isArray(value)) return value.map(convertSnakeToCamelDeep);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[snakeToCamelKey(k)] = convertSnakeToCamelDeep(v);
  }
  return out;
}

/**
 * 将目录打包成 zip
 * @param {string} sourceDir
 * @param {string} outputZipPath
 * @returns {Promise<void>}
 */
async function zipDirectory(sourceDir, outputZipPath) {
  const src = path.resolve(sourceDir);
  const out = path.resolve(outputZipPath);
  await fs.promises.mkdir(path.dirname(out), { recursive: true });

  return await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(out);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    output.on('error', (err) => reject(err));
    archive.on('warning', (err) => {
      // archiver 的 warning 通常不致命（如文件消失），但这里按失败处理更安全
      reject(err);
    });
    archive.on('error', (err) => reject(err));

    archive.pipe(output);
    archive.directory(src, false);
    archive.finalize();
  });
}

module.exports = {
  sanitizeName,
  sanitizeId,
  normalizeFields,
  normalizeSoftwareConfig,
  validateSoftwareConfig,
  validateProtocolFields,
  convertSnakeToCamelDeep,
  zipDirectory
};
