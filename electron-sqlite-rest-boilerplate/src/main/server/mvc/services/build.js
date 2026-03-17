/**
 * 构建服务（Build Service）
 *
 * 职责：
 * - 创建构建任务（落库 build_tasks）
 * - 调度并执行任务（进程内单 worker，串行执行）
 * - 查询任务状态/列表
 * - 取消任务
 * - 下载构建产物（ZIP）
 *
 * 注意：
 * - 本项目采用 SQLite + 启动时增量 DDL，因此这里使用 sequelize.query 访问 build_tasks 表。
 * - 不定义外键，保持与现有项目一致的风格。
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const log4js = require('../../middleware/log4jsPlus');
const { sequelize } = require('../../database/sequelize');
const logger = log4js.getLogger('default');
const { v4: uuidv4 } = require('uuid');
const SystemLevelDesignTreeModel = require('../models/systemLevelDesignTree');
const CommunicationNodeModel = require('../models/communicationNode');
const PacketMessageModel = require('../models/packetMessage');
const PacketMessageCategoryModel = require('../models/packetMessageCategory');
const { PacketMessage } = require('../../database/models');
const { analyzeProtocolsForDispatcher } = require('../../plugins/dispatcher-analyzer');
const {
  sanitizeName,
  sanitizeId,
  normalizeFields,
  normalizeSoftwareConfig,
  validateSoftwareConfig,
  validateProtocolFields,
  convertSnakeToCamelDeep,
  zipDirectory
} = require('../../utils/codegenUtils');

// 产物目录：pkg 环境使用 DATA_DIR，开发环境使用相对路径
const BUILD_ARTIFACT_DIR =
  process.pkg && process.env.DATA_DIR
    ? path.join(process.env.DATA_DIR, 'build_tasks')
    : path.resolve(__dirname, '../../../generated_code/build_tasks');

// code_gen CLI 路径：pkg 环境不支持，返回友好错误；开发环境使用相对路径
const NODEGEN_MAIN_PATH = process.pkg
  ? null // pkg 环境下通过 runNodegen 内部判断返回友好错误
  : path.resolve(__dirname, '../../../code_gen/bin/cli.js');

// 任务状态常量（字符串，便于 DB 直接存储）
const BuildStatus = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  PARTIAL_COMPLETED: 'partial_completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// 进程内串行执行队列（单 worker）
let isWorkerRunning = false;
const taskQueue = [];

function ensureArtifactDir() {
  if (!fs.existsSync(BUILD_ARTIFACT_DIR)) {
    fs.mkdirSync(BUILD_ARTIFACT_DIR, { recursive: true });
  }
}

function nowMs() {
  return Date.now();
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function safeJsonStringify(obj) {
  try {
    return JSON.stringify(obj ?? null);
  } catch {
    return JSON.stringify(null);
  }
}

function safeJsonParse(text, fallback) {
  if (!text) return fallback;
  if (typeof text !== 'string') return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function getVersionString() {
  // 版本号：使用毫秒时间戳，便于排序且不要求语义化
  return `v${nowMs()}`;
}

function assertNonEmptyString(value, message) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) {
    throw new Error(message);
  }
  return s;
}

function canDownloadByStatus(status) {
  return status === BuildStatus.COMPLETED || status === BuildStatus.PARTIAL_COMPLETED;
}

function toErrorMessage(error) {
  if (!error) return '未知错误';
  if (typeof error === 'string') return error;
  if (error && typeof error.message === 'string' && error.message.trim())
    return error.message.trim();
  return '未知错误';
}

async function runNodegen({
  taskId,
  configObject,
  outputDir,
  tempDir,
  logDir,
  label,
  language,
  platform
}) {
  // pkg 环境判断：nodegen 功能需要开发环境支持
  if (process.pkg || !NODEGEN_MAIN_PATH) {
    const errorMsg = '构建功能在打包环境下暂不可用，请使用开发环境进行代码构建';
    logger.warn(`[BuildService][runNodegen] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  ensureDir(outputDir);
  ensureDir(tempDir);
  ensureDir(logDir);

  const safeLabel = typeof label === 'string' && label.trim() ? label.trim() : 'nodegen';
  const ts = nowMs();
  const configPath = path.join(tempDir, `${safeLabel}_${ts}.json`);
  const logFilePath = path.join(logDir, `${safeLabel}_${ts}.log`);

  logger.info('--------------------------------');
  logger.info(
    `[BuildService][runNodegen] 开始执行 nodegen，taskId=${taskId}，label=${safeLabel}，configPath=${configPath}，logFilePath=${logFilePath}`
  );
  logger.info(
    `[BuildService][runNodegen] 写入配置文件，configObject=${JSON.stringify(configObject)}`
  );
  logger.info('--------------------------------');
  console.log('--------------------------------');
  console.log(
    `[BuildService][runNodegen] 开始执行 nodegen，taskId=${taskId}，label=${safeLabel}，configPath=${configPath}，logFilePath=${logFilePath}`
  );
  console.log(
    `[BuildService][runNodegen] 写入配置文件，configObject=${JSON.stringify(configObject)}`
  );
  console.log('--------------------------------');
  writeJsonFile(configPath, configObject);

  return await new Promise((resolve, reject) => {
    // 主动创建日志文件（即便 nodegen 很早退出，也能保证文件存在）
    try {
      fs.writeFileSync(logFilePath, '', { flag: 'a' });
    } catch (e) {
      // 不影响后续执行，错误信息由 spawn/stderr 捕获
      logger.warn('[BuildService][runNodegen] 创建日志文件失败:', e?.message || e);
    }

    // VSCode Auto Attach / Debug 可能通过环境变量影响子进程，导致出现
    // "Debugger attached. Waiting for the debugger to disconnect..."
    // 这里显式清理相关环境变量，避免 nodegen 被调试器注入影响。
    const childEnv = { ...process.env };
    delete childEnv.NODE_OPTIONS;
    delete childEnv.VSCODE_INSPECTOR_OPTIONS;
    delete childEnv.VSCODE_NODE_OPTIONS;
    delete childEnv.VSCODE_NLS_CONFIG;

    const args = [NODEGEN_MAIN_PATH, '-i', configPath, '-o', outputDir];
    if (language) {
      args.push('-l', language);
    }
    if (platform) {
      args.push('-p', platform);
    }

    // 使用当前进程的 node 可执行路径，避免 PATH/别名造成的差异
    const child = spawn(process.execPath, args, {
      cwd: path.dirname(NODEGEN_MAIN_PATH),
      env: childEnv,
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';

    // 同步落盘 stdout/stderr，确保 logFile 一定有内容可排查
    const logStream = (() => {
      try {
        return fs.createWriteStream(logFilePath, { flags: 'a' });
      } catch (e) {
        logger.warn('[BuildService][runNodegen] 打开日志文件写入流失败:', e?.message || e);
        return null;
      }
    })();

    const writeRunnerLog = (line) => {
      if (!logStream) return;
      try {
        logStream.write(line);
      } catch {
        // ignore
      }
    };

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.stdout.on('data', (d) => {
      writeRunnerLog(`[stdout] ${d.toString()}`);
    });
    child.stderr.on('data', (d) => {
      writeRunnerLog(`[stderr] ${d.toString()}`);
    });

    child.on('error', (err) => {
      writeRunnerLog(`\n[spawn_error] ${toErrorMessage(err)}\n`);
      if (logStream) {
        try {
          logStream.end();
        } catch {
          /* ignore */
        }
      }
      reject(
        new Error(
          `nodegen 启动失败（taskId=${taskId}，label=${safeLabel}）：${toErrorMessage(err)}\nlogFile: ${logFilePath}`
        )
      );
    });

    child.on('close', (code) => {
      writeRunnerLog(`\n[exit] code=${code}\n`);
      if (logStream) {
        try {
          logStream.end();
        } catch {
          /* ignore */
        }
      }
      if (code === 0) {
        resolve({ configPath, logFilePath });
        return;
      }
      const msg = [
        `nodegen 执行失败（taskId=${taskId}，label=${safeLabel}，exit=${code}）`,
        stderr ? `stderr: ${stderr}` : '',
        stdout ? `stdout: ${stdout}` : '',
        `logFile: ${logFilePath}`
      ]
        .filter(Boolean)
        .join('\n');
      reject(new Error(msg));
    });
  });
}

async function resolveTargetList({ contextType, contextId }) {
  const ct = typeof contextType === 'string' ? contextType.trim() : '';
  const cid = typeof contextId === 'string' ? contextId.trim() : '';
  if (!ct) throw new Error('缺少参数 contextType');
  if (!cid) throw new Error('缺少参数 contextId');

  if (ct === 'hierarchy_node') {
    const nodeList = await SystemLevelDesignTreeModel.findAll();
    const nodeMap = new Map(nodeList.map((n) => [String(n.id), n]));

    const parentToChildIdListMap = new Map();
    for (const n of nodeList) {
      const pid = n.parent_id ? String(n.parent_id) : '';
      if (!pid) continue;
      const list = parentToChildIdListMap.get(pid) || [];
      list.push(String(n.id));
      parentToChildIdListMap.set(pid, list);
    }

    const commNodeList = await CommunicationNodeModel.findAll();
    const commEnabledNodeIdSet = new Set(commNodeList.map((n) => String(n.node_id)));

    const visited = new Set();
    const queue = [cid];
    while (queue.length > 0) {
      const cur = queue.shift();
      if (!cur || visited.has(cur)) continue;
      visited.add(cur);
      const children = parentToChildIdListMap.get(cur) || [];
      for (const childId of children) {
        if (!visited.has(childId)) queue.push(childId);
      }
    }

    const leafSoftwareNodeIdList = Array.from(visited).filter((id) => commEnabledNodeIdSet.has(id));
    if (leafSoftwareNodeIdList.length === 0) {
      throw new Error('该层级节点下没有启用通信节点的软件（无法构建）');
    }

    return leafSoftwareNodeIdList.map((id) => {
      const node = nodeMap.get(String(id));
      const name = node?.properties?.name || node?.description || String(id);
      return { type: 'software', id: String(id), name };
    });
  }

  if (ct === 'packet_message') {
    const id_number = parseInt(cid, 10);
    if (!Number.isFinite(id_number) || id_number <= 0) {
      throw new Error('协议ID无效');
    }
    // 允许构建任意版本/草稿（以当前 Tab 为准）
    const messageRow = await PacketMessage.findByPk(id_number);
    const packet = messageRow ? messageRow.toJSON() : null;
    if (!packet) throw new Error('协议不存在');
    return [{ type: 'protocol', id: String(cid), name: packet.name || String(cid) }];
  }

  if (ct === 'packet_category') {
    const categoryList = await PacketMessageCategoryModel.findAll();
    const parentToChildIdListMap = new Map();
    for (const c of categoryList) {
      const pid = c.parent_id ? String(c.parent_id) : '';
      if (!pid) continue;
      const list = parentToChildIdListMap.get(pid) || [];
      list.push(String(c.id));
      parentToChildIdListMap.set(pid, list);
    }

    const categoryIdSet = new Set();
    const queue = [cid];
    while (queue.length > 0) {
      const cur = queue.shift();
      if (!cur || categoryIdSet.has(cur)) continue;
      categoryIdSet.add(cur);
      const children = parentToChildIdListMap.get(cur) || [];
      for (const childId of children) {
        if (!categoryIdSet.has(childId)) queue.push(childId);
      }
    }

    const messageRowList = await PacketMessageModel.findAllSimple();
    const targetList = [];
    for (const row of messageRowList) {
      const catId = row.category_id ? String(row.category_id) : '';
      if (!catId || !categoryIdSet.has(catId)) continue;
      targetList.push({ type: 'protocol', id: String(row.id), name: row.name || String(row.id) });
    }

    const idSet = new Set();
    const uniqList = [];
    for (const t of targetList) {
      if (idSet.has(t.id)) continue;
      idSet.add(t.id);
      uniqList.push(t);
    }
    if (uniqList.length === 0) {
      throw new Error('该协议分类下没有可构建的协议（未发布或为空）');
    }
    return uniqList;
  }

  throw new Error(`不支持的 contextType: ${ct}`);
}

/**
 * 从协议字段列表中查找 MessageId 字段及其偏移量
 * 兼容 camelCase（前端/DB 格式）和 snake_case（nodegen 格式）属性名
 *
 * @param {Array} fields - 协议字段数组
 * @returns {Object|null} 包含 fieldName, byteLength, baseType, messageIdValue, offset；未找到返回 null
 */
function findMessageIdInFields(fields) {
  if (!Array.isArray(fields)) return null;
  let offset = 0;
  for (const field of fields) {
    if (!field || typeof field !== 'object') continue;
    if (field.type === 'MessageId') {
      return {
        fieldName: field.fieldName || field.field_name || 'messageId',
        byteLength: field.byteLength || field.byte_length || 0,
        baseType:
          field.baseType || field.base_type || field.valueType || field.value_type || 'UnsignedInt',
        messageIdValue: field.messageIdValue ?? field.message_id_value ?? null,
        offset
      };
    }
    const len = field.byteLength || field.byte_length || 0;
    if (typeof len === 'number' && len > 0) {
      offset += len;
    }
  }
  return null;
}

/**
 * 构造软件配置（供代码生成/构建任务使用）
 * - 返回：
 *   - softwareConfig：已转换为 nodegen 期望格式（softwareName + camelCase 字段）
 *   - validationErrorList：基于原始（snake_case）字段的结构化校验错误列表
 *   - nodeName：原始节点名称（用于展示）
 */
async function buildSoftwareConfig(nodeId) {
  // 1. 获取体系节点信息
  const archNode = await SystemLevelDesignTreeModel.findById(nodeId);
  if (!archNode) {
    throw new Error(`体系节点不存在: ${nodeId}`);
  }

  // 从 properties 中获取节点名称（展示用）
  const nodeName = archNode.properties?.name || archNode.id;
  logger.info(`[buildSoftwareConfig] 获取到节点信息: id=${nodeId}, name=${nodeName}`);

  // 2. 获取该节点下的"节点接口容器行"（接口列表存储在 endpoint_description 数组中）
  // 说明：当前阶段生成不依赖流程图，仅依赖通信接口（endpoint_description.packet_ref_list）
  const containerList = await CommunicationNodeModel.findByNodeId(nodeId);
  if (!containerList || containerList.length === 0) {
    throw new Error('该节点下没有通信接口配置（endpoint_description）');
  }

  const container =
    (Array.isArray(containerList) ? containerList : []).find((n) => {
      const cfg = n?.config;
      return cfg && typeof cfg === 'object' && cfg.is_node_interface_container === true;
    }) || containerList[0];

  const endpointList = Array.isArray(container?.endpoint_description)
    ? container.endpoint_description
    : [];
  if (endpointList.length === 0) {
    throw new Error('该节点下没有配置任何通信接口（endpoint_description 为空）');
  }

  // 3. 组装 raw SoftwareConfig（用于结构化校验，字段保持 snake_case）
  const rawName = nodeName || '';
  const sanitizedNodeName = sanitizeName(rawName, nodeId, {
    purpose: 'identifier',
    dialect: 'portable'
  });
  logger.info(`[buildSoftwareConfig] 软件名称: 原始="${rawName}", 处理后="${sanitizedNodeName}"`);

  const softwareConfigRaw = {
    softwareName: sanitizedNodeName,
    description: archNode.description || '',
    version: '1.0',
    connections: []
  };

  // 记录 packetName -> packet_id 的映射（仅用于日志定位，不回传前端）
  const packetNameToPacketIdMap = new Map();
  const interfaceIdToPacketIdListMap = new Map();
  const preValidationErrorList = [];

  // 4. 遍历通信接口（endpoint_description），从 packet_ref_list 读取协议引用并组装配置
  for (let i = 0; i < endpointList.length; i += 1) {
    const endpoint = endpointList[i] || {};
    const interface_id_raw =
      typeof endpoint.interface_id === 'string' ? endpoint.interface_id.trim() : '';
    const interface_id = interface_id_raw || `iface_${i + 1}`;

    const packetRefList = Array.isArray(endpoint.packet_ref_list) ? endpoint.packet_ref_list : [];
    if (packetRefList.length === 0) {
      logger.warn(`[buildSoftwareConfig] 接口 ${interface_id} 未配置 packet_ref_list，跳过`);
      continue;
    }

    // 收集 packet_id（去重，保序）
    const packetIdList = [];
    const packetIdSet = new Set();
    for (const ref of packetRefList) {
      const packet_id_num =
        typeof ref?.packet_id === 'number' ? ref.packet_id : Number(ref?.packet_id);
      if (!Number.isFinite(packet_id_num) || packet_id_num <= 0) continue;
      const key = String(packet_id_num);
      if (packetIdSet.has(key)) continue;
      packetIdSet.add(key);
      packetIdList.push(packet_id_num);
    }
    if (packetIdList.length === 0) {
      logger.warn(
        `[buildSoftwareConfig] 接口 ${interface_id} packet_ref_list 未包含有效 packet_id，跳过`
      );
      continue;
    }

    interfaceIdToPacketIdListMap.set(interface_id, packetIdList.slice(0));

    // 获取报文详情列表（允许任意版本/草稿：以 packet_messages 主键为准）
    const protocolList = [];
    for (const packet_id of packetIdList) {
      const row = await PacketMessage.findByPk(packet_id);
      const packetDetail = row ? row.toJSON() : null;
      if (!packetDetail) {
        logger.warn(`[buildSoftwareConfig] 报文 ${packet_id} 不存在，跳过`);
        continue;
      }

      const fields = packetDetail.fields || [];
      const sanitizedPacketName = sanitizeName(packetDetail.name, String(packetDetail.id), {
        purpose: 'identifier',
        dialect: 'portable'
      });
      packetNameToPacketIdMap.set(sanitizedPacketName, packet_id);
      preValidationErrorList.push(
        ...validateProtocolFields(fields, { packetName: sanitizedPacketName })
      );
      protocolList.push({
        name: sanitizedPacketName,
        version: packetDetail.version || '1.0',
        defaultByteOrder: packetDetail.default_byte_order || 'big',
        structAlignment: packetDetail.struct_alignment ?? 1,
        fields
      });
    }
    if (protocolList.length === 0) {
      continue;
    }

    // 构建扁平连接配置（v2.0 格式：Software -> Connection -> Protocol）
    const isSingleMode = protocolList.length === 1;
    const protocolNameRaw =
      typeof endpoint.name === 'string' && endpoint.name.trim()
        ? endpoint.name.trim()
        : protocolList[0].name;

    // 构建 dispatch 配置
    const dispatch = { mode: isSingleMode ? 'singleprotocal' : 'multiprotocal' };
    if (!isSingleMode) {
      const firstMsgId = findMessageIdInFields(protocolList[0].fields);
      dispatch.field = firstMsgId?.fieldName || 'messageId';
      dispatch.type = firstMsgId?.baseType || 'UnsignedInt';
      dispatch.byteOrder = protocolList[0].defaultByteOrder || 'big';
      dispatch.offset = firstMsgId?.offset ?? 0;
      dispatch.size = firstMsgId?.byteLength || 2;
    }

    // 构建 messages 映射（key 遵循 v2.0 规范）
    const messages = {};
    protocolList.forEach((protocol) => {
      if (isSingleMode) {
        // singleprotocal 模式：key 固定为 "0"
        messages['0'] = protocol;
      } else {
        // multiprotocal 模式：key 为 MessageId 字段的实际值
        const msgIdInfo = findMessageIdInFields(protocol.fields);
        const key =
          msgIdInfo?.messageIdValue != null
            ? String(msgIdInfo.messageIdValue)
            : String(Object.keys(messages).length + 1);
        messages[key] = protocol;
      }
    });

    const connectionConfig = {
      id: sanitizeId(interface_id),
      name: typeof endpoint.name === 'string' ? endpoint.name : interface_id,
      type: typeof endpoint.type === 'string' ? endpoint.type : 'Unknown',
      protocolName: sanitizeName(protocolNameRaw, interface_id, {
        purpose: 'identifier',
        dialect: 'portable'
      }),
      description: '',
      dispatch,
      messages
    };
    softwareConfigRaw.connections.push(connectionConfig);
  }

  if (softwareConfigRaw.connections.length === 0) {
    throw new Error(
      '没有有效的通信接口报文引用配置，请在通信接口中配置 packet_ref_list（并确保 packet_id 有效）'
    );
  }

  // 5. 规范化 + 结构化校验（snake_case）
  normalizeSoftwareConfig(softwareConfigRaw);
  const softValidationMessageList = validateSoftwareConfig(softwareConfigRaw);
  const softValidationErrorList = Array.isArray(softValidationMessageList)
    ? softValidationMessageList.map((msg) => ({
        packetName: '',
        fieldPath: 'root',
        message: typeof msg === 'string' ? msg : '软件配置校验失败'
      }))
    : [];

  const validationErrorList = [
    ...(Array.isArray(preValidationErrorList) ? preValidationErrorList : []),
    ...softValidationErrorList
  ];

  // 校验失败：仅打日志，附带 packet_id 便于定位（不进入返回结构，不展示给用户）
  if (Array.isArray(validationErrorList) && validationErrorList.length > 0) {
    const sampleList = validationErrorList.slice(0, 20).map((e) => {
      const packetName = typeof e?.packetName === 'string' ? e.packetName : '';
      const packetId = packetName ? packetNameToPacketIdMap.get(packetName) : undefined;
      return {
        packet_id: packetId,
        packetName,
        fieldPath: e?.fieldPath,
        message: e?.message
      };
    });

    logger.error('[buildSoftwareConfig] 报文配置校验失败（含 packet_id 定位信息）', {
      nodeId,
      nodeName,
      softwareName: sanitizedNodeName,
      interfaceIdToPacketIdListMap: Object.fromEntries(interfaceIdToPacketIdListMap.entries()),
      sampleErrorList: sampleList
    });
  }

  // 6. 转换为 nodegen 期望格式（camelCase 字段）
  const softwareConfig = convertSnakeToCamelDeep(softwareConfigRaw);

  return { softwareConfig, validationErrorList, nodeName };
}

async function insertTaskRow(row) {
  const sql = `
    INSERT INTO build_tasks (
      id, version, status, progress,
      context_type, context_id, context_name,
      options_json, target_list_json, result_list_json,
      zip_file_name, zip_file_path, zip_size,
      error_message,
      created_by,
      created_at, started_at, finished_at, updated_at
    ) VALUES (
      :id, :version, :status, :progress,
      :context_type, :context_id, :context_name,
      :options_json, :target_list_json, :result_list_json,
      :zip_file_name, :zip_file_path, :zip_size,
      :error_message,
      :created_by,
      :created_at, :started_at, :finished_at, :updated_at
    );
  `;
  await sequelize.query(sql, { replacements: row });
}

async function updateTaskRow(taskId, patch) {
  const keys = Object.keys(patch || {});
  if (keys.length === 0) return;
  const setClause = keys.map((k) => `${k} = :${k}`).join(', ');
  const sql = `UPDATE build_tasks SET ${setClause} WHERE id = :id;`;
  await sequelize.query(sql, { replacements: { id: taskId, ...patch } });
}

async function getTaskRowById(taskId) {
  const sql = `SELECT * FROM build_tasks WHERE id = :id LIMIT 1;`;
  const [rows] = await sequelize.query(sql, { replacements: { id: taskId } });
  const list = Array.isArray(rows) ? rows : [];
  return list[0] || null;
}

async function listTaskRows(params) {
  const { created_by, context_type, context_id, limit = 20, offset = 0 } = params || {};

  const whereClauseList = [];
  const replacements = {
    limit: Number(limit) || 20,
    offset: Number(offset) || 0
  };

  if (created_by !== undefined && created_by !== null) {
    whereClauseList.push('created_by = :created_by');
    replacements.created_by = created_by;
  }
  if (typeof context_type === 'string' && context_type.trim()) {
    whereClauseList.push('context_type = :context_type');
    replacements.context_type = context_type.trim();
  }
  if (typeof context_id === 'string' && context_id.trim()) {
    whereClauseList.push('context_id = :context_id');
    replacements.context_id = context_id.trim();
  }

  const whereSql = whereClauseList.length > 0 ? `WHERE ${whereClauseList.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(1) AS total FROM build_tasks ${whereSql};`;
  const listSql = `
    SELECT * FROM build_tasks
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT :limit OFFSET :offset;
  `;

  const [countRows] = await sequelize.query(countSql, { replacements });
  const total = Array.isArray(countRows) && countRows[0] ? Number(countRows[0].total) : 0;
  const [rows] = await sequelize.query(listSql, { replacements });
  const list = Array.isArray(rows) ? rows : [];

  return { total, list, limit: replacements.limit, offset: replacements.offset };
}

function toTaskDto(row) {
  if (!row) return null;
  const resultList = safeJsonParse(row.result_list_json, []);
  const resultSummary = (() => {
    if (!Array.isArray(resultList) || resultList.length === 0) {
      return { total: 0, successCount: 0, failedCount: 0 };
    }
    let successCount = 0;
    let failedCount = 0;
    for (const item of resultList) {
      if (item && item.success === true) successCount += 1;
      if (item && item.success === false) failedCount += 1;
    }
    return { total: resultList.length, successCount, failedCount };
  })();

  const errorDetailList = (() => {
    if (!Array.isArray(resultList) || resultList.length === 0) return [];
    const failedList = resultList.filter((r) => r && r.success === false);
    if (failedList.length === 0) return [];
    return failedList.slice(0, 5).map((r) => {
      const validationErrorList = Array.isArray(r.validationErrorList) ? r.validationErrorList : [];
      return {
        type: r.type,
        id: r.id,
        name: r.name,
        errorMessage: r.errorMessage,
        validationErrorList: validationErrorList.slice(0, 10)
      };
    });
  })();

  return {
    taskId: row.id,
    version: row.version,
    status: row.status,
    progress: row.progress,
    contextType: row.context_type,
    contextId: row.context_id,
    contextName: row.context_name,
    options: safeJsonParse(row.options_json, {}),
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    downloadable: canDownloadByStatus(row.status) && !!row.zip_file_path,
    downloadUrl: canDownloadByStatus(row.status)
      ? `/api/build/tasks/${row.id}/download`
      : undefined,
    errorMessage: row.error_message || undefined,
    errorDetailList,
    resultSummary
  };
}

function formatValidationErrorForMessage(err) {
  if (!err || typeof err !== 'object') return '';
  const packetName = typeof err.packetName === 'string' ? err.packetName : '';
  const fieldPath = typeof err.fieldPath === 'string' ? err.fieldPath : '';
  const message = typeof err.message === 'string' ? err.message : '';
  const parts = [];
  if (packetName) parts.push(packetName);
  if (fieldPath) parts.push(fieldPath);
  const prefix = parts.length > 0 ? `【${parts.join(' / ')}】` : '';
  return `${prefix}${message || '配置错误'}`.trim();
}

function summarizeResultListError(resultList, fallback) {
  if (!Array.isArray(resultList) || resultList.length === 0) return fallback;
  const firstFailed = resultList.find((r) => r && r.success === false);
  if (!firstFailed) return fallback;

  const name =
    typeof firstFailed.name === 'string' && firstFailed.name.trim() ? firstFailed.name.trim() : '';
  const errorMessage =
    typeof firstFailed.errorMessage === 'string' && firstFailed.errorMessage.trim()
      ? firstFailed.errorMessage.trim()
      : '';

  const validationErrorList = Array.isArray(firstFailed.validationErrorList)
    ? firstFailed.validationErrorList
    : [];
  const firstValidation =
    validationErrorList.length > 0 ? formatValidationErrorForMessage(validationErrorList[0]) : '';

  const head = name ? `目标【${name}】失败` : '构建失败';
  if (firstValidation) return `${head}：${errorMessage || '报文配置校验失败'}；${firstValidation}`;
  if (errorMessage) return `${head}：${errorMessage}`;
  return fallback;
}

async function workerLoop() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  try {
    while (taskQueue.length > 0) {
      const taskId = taskQueue.shift();
      if (!taskId) continue;
      try {
        await executeTask(taskId);
      } catch (e) {
        logger.error('[BuildService] executeTask failed:', e?.message || e);
      }
    }
  } finally {
    isWorkerRunning = false;
  }
}

async function enqueueTask(taskId) {
  taskQueue.push(taskId);
  // 异步触发 worker
  setTimeout(() => {
    workerLoop();
  }, 0);
}

/**
 * 执行任务（核心逻辑）
 * - 解析目标集合（叶子软件/分类协议聚合）
 * - 逐个运行 nodegen 生成到任务输出目录
 * - 写入 manifest.json 并打包 ZIP
 */
async function executeTask(taskId) {
  ensureArtifactDir();

  const row = await getTaskRowById(taskId);
  if (!row) {
    throw new Error('构建任务不存在');
  }

  // 已取消/已结束不再执行
  if (
    row.status === BuildStatus.CANCELLED ||
    row.status === BuildStatus.COMPLETED ||
    row.status === BuildStatus.FAILED ||
    row.status === BuildStatus.PARTIAL_COMPLETED
  ) {
    return;
  }

  const startedAt = row.started_at || nowMs();
  await updateTaskRow(taskId, {
    status: BuildStatus.RUNNING,
    started_at: startedAt,
    updated_at: nowMs(),
    progress: 1
  });

  const options = safeJsonParse(row.options_json, {});
  const language = options.language || undefined;
  const platform = options.platform || undefined;
  const contextType = row.context_type;
  const contextId = row.context_id;

  const workDir = path.join(BUILD_ARTIFACT_DIR, taskId);
  const outputDir = path.join(workDir, 'output');
  const tempDir = path.join(workDir, 'tmp');
  const logDir = path.join(workDir, 'logs');
  ensureDir(workDir);
  ensureDir(outputDir);
  ensureDir(tempDir);
  ensureDir(logDir);

  let targetList = [];
  try {
    targetList = await resolveTargetList({ contextType, contextId });
  } catch (e) {
    const errorMessage = toErrorMessage(e);
    await updateTaskRow(taskId, {
      status: BuildStatus.FAILED,
      progress: 100,
      error_message: errorMessage,
      result_list_json: safeJsonStringify([]),
      target_list_json: safeJsonStringify([]),
      finished_at: nowMs(),
      updated_at: nowMs()
    });
    return;
  }

  await updateTaskRow(taskId, {
    target_list_json: safeJsonStringify(targetList),
    updated_at: nowMs()
  });

  const resultList = [];
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < targetList.length; i += 1) {
    // 支持取消：每轮都检查一次 DB
    const currentRow = await getTaskRowById(taskId);
    if (currentRow && currentRow.status === BuildStatus.CANCELLED) {
      await updateTaskRow(taskId, {
        progress: 100,
        finished_at: currentRow.finished_at || nowMs(),
        updated_at: nowMs()
      });
      return;
    }

    const target = targetList[i];
    const progress = Math.min(95, Math.max(2, Math.floor(((i + 1) / targetList.length) * 90)));
    await updateTaskRow(taskId, { progress, updated_at: nowMs() });

    try {
      if (target.type === 'software') {
        const { softwareConfig, validationErrorList, nodeName } = await buildSoftwareConfig(
          target.id
        );
        if (validationErrorList && validationErrorList.length > 0) {
          const err = new Error('报文配置校验失败');
          err.validationErrorList = validationErrorList;
          throw err;
        }

        await runNodegen({
          taskId,
          configObject: softwareConfig,
          outputDir,
          tempDir,
          logDir,
          label: `software_${softwareConfig.softwareName}`,
          language,
          platform
        });

        successCount += 1;
        resultList.push({
          type: 'software',
          id: String(target.id),
          name: nodeName || softwareConfig.softwareName,
          success: true,
          outputDir: softwareConfig.softwareName
        });
        continue;
      }

      if (target.type === 'protocol') {
        const id_number = parseInt(String(target.id), 10);
        if (!Number.isFinite(id_number) || id_number <= 0) {
          throw new Error('协议ID无效');
        }
        // 允许构建任意版本/草稿（以当前 Tab 为准）
        const messageRow = await PacketMessage.findByPk(id_number);
        const packet = messageRow ? messageRow.toJSON() : null;
        if (!packet) throw new Error('协议不存在');

        // 协议配置（DB 为 snake_case，需转 camelCase 以适配 nodegen）
        const protocolName = sanitizeName(packet.name, String(packet.id), {
          purpose: 'identifier',
          dialect: 'portable'
        });
        const protocolConfigRaw = {
          name: protocolName,
          description: packet.description || '',
          version: packet.version || '1.0',
          defaultByteOrder: packet.default_byte_order || 'big',
          structAlignment: packet.struct_alignment ?? 1,
          fields: packet.fields || []
        };

        // 先做必要的规范化（保持与体系侧一致的 default_value 处理）
        normalizeFields(protocolConfigRaw.fields);

        const validationErrorList = validateProtocolFields(protocolConfigRaw.fields, {
          packetName: packet.name || protocolName
        });
        if (Array.isArray(validationErrorList) && validationErrorList.length > 0) {
          const err = new Error('报文配置校验失败');
          err.validationErrorList = validationErrorList;
          throw err;
        }

        const protocolConfig = convertSnakeToCamelDeep(protocolConfigRaw);
        await runNodegen({
          taskId,
          configObject: protocolConfig,
          outputDir,
          tempDir,
          logDir,
          label: `protocol_${protocolName}`,
          language,
          platform
        });

        successCount += 1;
        resultList.push({
          type: 'protocol',
          id: String(target.id),
          name: packet.name || protocolName,
          success: true,
          outputDir: protocolName
        });
        continue;
      }

      throw new Error(`不支持的 target.type: ${target.type}`);
    } catch (e) {
      failedCount += 1;
      const errMessage = toErrorMessage(e);
      const validationErrorList = e && e.validationErrorList ? e.validationErrorList : undefined;
      resultList.push({
        type: target.type,
        id: String(target.id),
        name: target.name || String(target.id),
        success: false,
        errorMessage: errMessage,
        validationErrorList
      });
      continue;
    }
  }

  // 写入 manifest（无论是否成功，都便于排查）
  const finishedAt = nowMs();
  const manifest = {
    taskId,
    version: row.version,
    contextType,
    contextId,
    contextName: row.context_name || '',
    options,
    createdAt: row.created_at,
    startedAt,
    finishedAt,
    targetList,
    resultList
  };
  writeJsonFile(path.join(outputDir, 'manifest.json'), manifest);

  // 仅当存在成功目标时产出 ZIP（支持 partial_completed）
  if (successCount > 0) {
    const zipFileName = `build_${row.version || 'v'}_${taskId}.zip`;
    const zipFilePath = path.join(BUILD_ARTIFACT_DIR, zipFileName);
    await zipDirectory(outputDir, zipFilePath);
    const stat = fs.existsSync(zipFilePath) ? fs.statSync(zipFilePath) : null;

    const status = failedCount > 0 ? BuildStatus.PARTIAL_COMPLETED : BuildStatus.COMPLETED;
    const errorMessage =
      failedCount > 0
        ? summarizeResultListError(
            resultList,
            `部分目标构建失败（成功 ${successCount} / 失败 ${failedCount}）`
          )
        : null;

    await updateTaskRow(taskId, {
      status,
      progress: 100,
      result_list_json: safeJsonStringify(resultList),
      zip_file_name: zipFileName,
      zip_file_path: zipFilePath,
      zip_size: stat ? stat.size : null,
      error_message: errorMessage,
      finished_at: finishedAt,
      updated_at: nowMs()
    });
    return;
  }

  // 全部失败：不产出 ZIP
  const summaryError = summarizeResultListError(
    resultList,
    failedCount > 0 ? `全部目标构建失败（失败 ${failedCount}）` : '构建失败'
  );
  await updateTaskRow(taskId, {
    status: BuildStatus.FAILED,
    progress: 100,
    result_list_json: safeJsonStringify(resultList),
    error_message: summaryError,
    finished_at: finishedAt,
    updated_at: nowMs()
  });
}

class BuildService {
  /**
   * 创建构建任务并入队执行
   */
  static async startBuild({ contextType, contextId, contextName, options, user }) {
    const userId = user?.id;
    if (!userId) {
      throw new Error('未认证');
    }

    const context_type = assertNonEmptyString(contextType, '缺少参数 contextType');
    const context_id = assertNonEmptyString(contextId, '缺少参数 contextId');

    const taskId = uuidv4();
    const version = getVersionString();
    const createdAt = nowMs();

    await insertTaskRow({
      id: taskId,
      version,
      status: BuildStatus.QUEUED,
      progress: 0,
      context_type,
      context_id,
      context_name: typeof contextName === 'string' ? contextName.trim() : '',
      options_json: safeJsonStringify(options || {}),
      target_list_json: safeJsonStringify([]),
      result_list_json: safeJsonStringify([]),
      zip_file_name: null,
      zip_file_path: null,
      zip_size: null,
      error_message: null,
      created_by: userId,
      created_at: createdAt,
      started_at: null,
      finished_at: null,
      updated_at: createdAt
    });

    await enqueueTask(taskId);

    const dto = toTaskDto(await getTaskRowById(taskId));
    return dto;
  }

  /**
   * 查询任务
   */
  static async getTask(taskId, user) {
    const userId = user?.id;
    if (!userId) throw new Error('未认证');

    const id = assertNonEmptyString(taskId, '缺少参数 taskId');
    const row = await getTaskRowById(id);
    if (!row) throw new Error('构建任务不存在');
    if (Number(row.created_by) !== Number(userId)) {
      throw new Error('权限不足');
    }
    return toTaskDto(row);
  }

  /**
   * 查询历史列表
   */
  static async listTasks({ contextType, contextId, limit, offset }, user) {
    const userId = user?.id;
    if (!userId) throw new Error('未认证');

    const {
      total,
      list,
      limit: l,
      offset: o
    } = await listTaskRows({
      created_by: userId,
      context_type: contextType,
      context_id: contextId,
      limit,
      offset
    });

    return {
      list: list.map(toTaskDto),
      pagination: { total, limit: l, offset: o }
    };
  }

  /**
   * 取消任务
   */
  static async cancelTask(taskId, user) {
    const userId = user?.id;
    if (!userId) throw new Error('未认证');

    const id = assertNonEmptyString(taskId, '缺少参数 taskId');
    const row = await getTaskRowById(id);
    if (!row) throw new Error('构建任务不存在');
    if (Number(row.created_by) !== Number(userId)) {
      throw new Error('权限不足');
    }

    if (
      row.status === BuildStatus.COMPLETED ||
      row.status === BuildStatus.FAILED ||
      row.status === BuildStatus.PARTIAL_COMPLETED
    ) {
      throw new Error('构建已结束，无法取消');
    }

    await updateTaskRow(id, {
      status: BuildStatus.CANCELLED,
      progress: 100,
      finished_at: row.finished_at || nowMs(),
      updated_at: nowMs()
    });

    return { taskId: id, status: BuildStatus.CANCELLED };
  }

  /**
   * 下载构建产物（ZIP）
   * - 直接写入响应流，不使用 res.apiSuccess
   */
  static async downloadArtifact(taskId, user, res) {
    const userId = user?.id;
    if (!userId) throw new Error('未认证');

    const id = assertNonEmptyString(taskId, '缺少参数 taskId');
    const row = await getTaskRowById(id);
    if (!row) throw new Error('构建任务不存在');
    if (Number(row.created_by) !== Number(userId)) {
      throw new Error('权限不足');
    }

    if (!canDownloadByStatus(row.status)) {
      throw new Error('构建尚未完成');
    }

    const filePath = typeof row.zip_file_path === 'string' ? row.zip_file_path : '';
    const fileName = typeof row.zip_file_name === 'string' ? row.zip_file_name : '';
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error('构建产物不存在或已过期');
    }

    const stat = fs.statSync(filePath);
    const downloadName = fileName || 'build_' + (row.version || 'artifact') + '.zip';

    res.setHeader('Content-Type', 'application/zip');
    // 兼容：filename + filename*（filename* 由后续前端解析处理）
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="' +
        encodeURIComponent(downloadName) +
        "\"; filename*=UTF-8''" +
        encodeURIComponent(downloadName)
    );
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
}

module.exports = {
  BuildService,
  BuildStatus
};
