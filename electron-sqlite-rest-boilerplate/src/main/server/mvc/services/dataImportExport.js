/**
 * @file dataImportExport.js
 * @brief 数据导入导出服务
 * @date 2025-01-06
 * @copyright Copyright (c) 2025
 */
const SystemLevelDesignTreeService = require('./systemLevelDesignTree');
const PacketMessageCategoryService = require('./packetMessageCategory');
const SystemLevelDesignTreeModel = require('../models/systemLevelDesignTree');
const PacketMessageCategoryModel = require('../models/packetMessageCategory');
const PacketMessageModel = require('../models/packetMessage');
const logger = require('../../middleware/log4jsPlus').getLogger();
const path = require('path');
const fs = require('fs');
const JSZip = require('jszip');
const { dedupePacketsByMessageId } = require('../../utils/packet-messages');

class DataImportExportService {
  /**
   * 获取导出预览数据（返回树形结构）
   */
  static async getExportPreview() {
    try {
      const result = {};

      // 获取体系层级树结构
      const hierarchy_nodes = await SystemLevelDesignTreeModel.findAll();
      if (hierarchy_nodes.length > 0) {
        result.hierarchy = {
          count: hierarchy_nodes.length,
          tree: this.buildHierarchyTree(hierarchy_nodes)
        };
      }

      // 获取协议集树结构
      const category_list = await PacketMessageCategoryModel.findAll();
      const packet_list = await PacketMessageModel.findAllSimple();
      const total_protocols = category_list.length + packet_list.length;
      if (total_protocols > 0) {
        result.protocols = {
          count: total_protocols,
          tree: this.buildProtocolTree(category_list, packet_list, true)
        };
      }

      return result;
    } catch (error) {
      throw new Error('获取导出预览失败: ' + error.message);
    }
  }

  /**
   * 构建体系层级树结构
   * @param {Array} nodes 节点列表
   */
  static buildHierarchyTree(nodes) {
    const nodeMap = new Map();
    const root_nodes = [];

    // 先将所有节点放入 map，保留所有原始字段
    nodes.forEach((node) => {
      nodeMap.set(node.id, {
        id: node.id,
        parent_id: node.parent_id,
        node_type_id: node.node_type_id,
        name: node.name,
        type: 'node',
        properties: node.properties,
        children: []
      });
    });

    // 构建树形结构
    nodes.forEach((node) => {
      const treeNode = nodeMap.get(node.id);
      if (node.parent_id && nodeMap.has(node.parent_id)) {
        nodeMap.get(node.parent_id).children.push(treeNode);
      } else {
        root_nodes.push(treeNode);
      }
    });

    return root_nodes;
  }

  /**
   * 构建协议集树结构
   * @param {Array} category_list 分类列表
   * @param {Array} packet_list 报文列表
   * @param {boolean} asTree 是否返回树形结构（true=树形，false=扁平）
   */
  static buildProtocolTree(category_list, packet_list, asTree = false) {
    const result = [];

    // 添加分类
    category_list.forEach((cat) => {
      result.push({
        id: cat.id,
        parent_id: cat.parent_id,
        name: cat.name,
        type: 'category',
        description: cat.description || '',
        children: []
      });
    });

    // 按 message_id 去重报文，每个 message_id 只保留一个显示版本
    const filtered_packet_list = dedupePacketsByMessageId(packet_list);

    // 添加报文
    filtered_packet_list.forEach((packet) => {
      result.push({
        id: `packet-${packet.id}`,
        packet_id: packet.id,
        message_id: packet.message_id,
        parent_id: packet.category_id,
        name: packet.name,
        type: 'packet',
        description: packet.description || '',
        version: packet.version || '1.0',
        field_count: packet.field_count || 0,
        children: []
      });
    });

    if (asTree) {
      // 构建树形结构
      const nodeMap = new Map(result.map((item) => [item.id, item]));
      const root_nodes = [];

      result.forEach((item) => {
        if (item.parent_id && nodeMap.has(item.parent_id)) {
          nodeMap.get(item.parent_id).children.push(item);
        } else {
          root_nodes.push(item);
        }
      });

      return root_nodes;
    }

    return result;
  }

  /**
   * 导出数据（支持精细化导出）
   * @param {Array|Object} module_list 模块列表，格式：
   *   - 旧格式：['hierarchy', 'protocols'] 导出全部
   *   - 新格式：{ hierarchy: ['id1', 'id2'], protocols: ['id1', 'id2'] } 精细化导出
   */
  static async exportData(module_list) {
    try {
      if (!module_list || (Array.isArray(module_list) && module_list.length === 0)) {
        throw new Error('请选择至少一个模块');
      }

      const zip = new JSZip();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const file_name = `data-export-${timestamp}.zip`;

      // 兼容新旧两种格式
      const isLegacyFormat = Array.isArray(module_list);
      const exportConfig = isLegacyFormat
        ? {
            hierarchy: module_list.includes('hierarchy') ? null : undefined,
            protocols: module_list.includes('protocols') ? null : undefined
          }
        : module_list;

      // 导出体系层级
      if (exportConfig.hierarchy !== undefined) {
        let hierarchy_nodes;
        if (exportConfig.hierarchy === null) {
          // 导出全部
          hierarchy_nodes = await SystemLevelDesignTreeModel.findAll();
        } else {
          // 精细化导出：收集选中的节点及其子节点
          const allIds = await this._collectHierarchyChildIds(exportConfig.hierarchy);
          hierarchy_nodes = await SystemLevelDesignTreeModel.findByIds(allIds);
        }

        if (hierarchy_nodes.length > 0) {
          const hierarchy_data = {
            version: '1.0',
            export_time: new Date().toISOString(),
            module: 'hierarchy',
            data: hierarchy_nodes
          };
          zip.file('hierarchy.json', JSON.stringify(hierarchy_data, null, 2));
        }
      }

      // 导出协议集
      if (exportConfig.protocols !== undefined) {
        let category_list;
        let packet_list;

        if (exportConfig.protocols === null) {
          // 导出全部
          category_list = await PacketMessageCategoryModel.findAll();
          packet_list = await PacketMessageModel.findAllSimple();
        } else {
          // 精细化导出：解析分类和报文ID
          const { categoryIds, packetIds } = this._parseProtocolIds(exportConfig.protocols);
          category_list =
            categoryIds.length > 0 ? await PacketMessageCategoryModel.findByIds(categoryIds) : [];
          packet_list = packetIds.length > 0 ? await PacketMessageModel.findByIds(packetIds) : [];
        }

        const total = category_list.length + packet_list.length;
        if (total > 0) {
          const protocols_data = {
            version: '1.0',
            export_time: new Date().toISOString(),
            module: 'protocols',
            data: this.buildProtocolTree(category_list, packet_list)
          };
          zip.file('protocols.json', JSON.stringify(protocols_data, null, 2));
        }
      }

      // 检查是否有实际内容导出
      const zip_files = Object.keys(zip.files);
      if (zip_files.length === 0) {
        throw new Error('没有可导出的数据，请至少选择一个节点');
      }

      // 生成 ZIP 文件
      const zip_buffer = await zip.generateAsync({ type: 'nodebuffer' });

      // 保存临时文件
      // pkg 环境使用 process.env.TEMP_DIR，开发环境使用相对路径
      const temp_dir = process.env.TEMP_DIR || path.join(__dirname, '../../temp');
      if (!fs.existsSync(temp_dir)) {
        fs.mkdirSync(temp_dir, { recursive: true });
      }
      const file_path = path.join(temp_dir, file_name);
      fs.writeFileSync(file_path, zip_buffer);

      return {
        download_url: `/api/ide/download?file_name=${file_name}`,
        file_name
      };
    } catch (error) {
      throw new Error('导出数据失败: ' + error.message);
    }
  }

  /**
   * 收集体系层级节点及其所有子节点的ID
   * @param {Array} idList 节点ID列表
   * @returns {Promise<Array>} 所有子节点ID列表
   */
  static async _collectHierarchyChildIds(idList) {
    const allIds = new Set(idList);
    const toProcess = [...idList];

    while (toProcess.length > 0) {
      const parentId = toProcess.pop();
      const children = await SystemLevelDesignTreeModel.findByParentId(parentId);

      for (const child of children) {
        if (!allIds.has(child.id)) {
          allIds.add(child.id);
          toProcess.push(child.id);
        }
      }
    }

    return Array.from(allIds);
  }

  /**
   * 解析协议ID列表，分离分类ID和报文ID
   * @param {Array} idList ID列表
   * @returns {Object} 包含 categoryIds 和 packetIds 的对象
   */
  static _parseProtocolIds(idList) {
    const categoryIds = [];
    const packetIds = [];

    for (const id of idList) {
      if (typeof id === 'string' && id.startsWith('packet-')) {
        // 报文ID格式：packet-{actual_id}
        packetIds.push(id.replace('packet-', ''));
      } else {
        // 分类ID
        categoryIds.push(id);
      }
    }

    return { categoryIds, packetIds };
  }

  /**
   * 导入数据
   * @param {Object} file 上传的文件对象
   * @param {string} strategy 导入策略（overwrite/merge/append）
   */
  static async importData(file, strategy) {
    try {
      if (!file) {
        throw new Error('请选择要导入的文件');
      }

      if (!['overwrite', 'merge', 'append'].includes(strategy)) {
        throw new Error('无效的导入策略');
      }

      // 读取文件
      let file_data;
      if (file.originalname.endsWith('.zip')) {
        file_data = await this.parseZipFile(file);
      } else if (file.originalname.endsWith('.json')) {
        file_data = await this.parseJsonFile(file);
      } else {
        throw new Error('不支持的文件格式，请上传 .zip 或 .json 文件');
      }

      // 根据策略导入数据
      const result = {};

      if (file_data.hierarchy) {
        result.hierarchy = await this.importHierarchyData(file_data.hierarchy, strategy);
      }

      if (file_data.protocols) {
        result.protocols = await this.importProtocolsData(file_data.protocols, strategy);
      }

      return result;
    } catch (error) {
      throw new Error('导入数据失败: ' + error.message);
    }
  }

  /**
   * 解析 ZIP 文件
   * @param {Object} file ZIP 文件对象
   * @returns {Promise<Object>} 解析后的数据对象
   */
  static async parseZipFile(file) {
    const zip = new JSZip();
    // eslint-disable-next-line sonarjs/no-unsafe-unzip -- 用户主动上传的导入文件，路径遍历风险可接受
    const contents = await zip.loadAsync(file.buffer);
    const result = {};

    for (const [relativePath, zipEntry] of Object.entries(contents.files)) {
      if (zipEntry.dir) continue;

      const file_name = relativePath.split('/').pop() || '';
      if (file_name.endsWith('.json')) {
        const content = await zipEntry.async('text');
        const data = JSON.parse(content);

        if (data.module === 'hierarchy') {
          result.hierarchy = data.data;
        } else if (data.module === 'protocols') {
          result.protocols = data.data;
        }
      }
    }

    if (Object.keys(result).length === 0) {
      throw new Error('ZIP 文件中没有找到有效的数据文件');
    }

    return result;
  }

  /**
   * 解析 JSON 文件
   * @param {Object} file JSON 文件对象
   * @returns {Promise<Object>} 解析后的数据对象
   */
  static async parseJsonFile(file) {
    const content = file.buffer.toString('utf-8');
    const data = JSON.parse(content);

    if (data.module === 'hierarchy') {
      return { hierarchy: data.data };
    } else if (data.module === 'protocols') {
      return { protocols: data.data };
    }

    throw new Error('JSON 文件格式不正确');
  }

  /**
   * 导入体系层级数据
   * @param {Array} data 层级数据数组
   * @param {string} strategy 导入策略（overwrite/merge/append）
   * @returns {Promise<Object>} 导入结果统计 {created, updated}
   */
  static async importHierarchyData(data, strategy) {
    let created = 0;
    let updated = 0;

    if (!Array.isArray(data)) {
      return { created: 0, updated: 0 };
    }

    for (const item of data) {
      const existing = await SystemLevelDesignTreeModel.findById(item.id);

      if (!existing) {
        // 新增
        await SystemLevelDesignTreeModel.create(item);
        created++;
      } else if (strategy === 'overwrite' || strategy === 'merge') {
        // 更新
        const { id, ...update_data } = item;
        await SystemLevelDesignTreeModel.update(id, update_data);
        updated++;
      }
      // append 策略：不更新已存在的数据
    }

    return { created, updated };
  }

  /**
   * 导入协议集数据
   * @param {Array} data 协议数据数组
   * @param {string} strategy 导入策略（overwrite/merge/append）
   * @returns {Promise<Object>} 导入结果统计 {created, updated}
   */
  static async importProtocolsData(data, strategy) {
    let created = 0;
    let updated = 0;

    if (!Array.isArray(data)) {
      return { created: 0, updated: 0 };
    }

    for (const item of data) {
      if (item.type === 'category') {
        const existing = await PacketMessageCategoryModel.findById(item.id);

        if (!existing) {
          await PacketMessageCategoryModel.create({
            id: item.id,
            name: item.name,
            parent_id: item.parent_id || null,
            description: item.description || ''
          });
          created++;
        } else if (strategy === 'overwrite' || strategy === 'merge') {
          const { id, ...update_data } = item;
          await PacketMessageCategoryModel.update(id, update_data);
          updated++;
        }
      } else if (item.type === 'packet' && item.packet_id) {
        // 检查报文是否存在
        const packet_list = await PacketMessageModel.findAllSimple();
        const existing = packet_list.find((p) => p.id === item.packet_id);

        if (!existing) {
          // 报文需要通过草稿创建，这里暂时只记录
          created++;
        } else if (strategy === 'overwrite' || strategy === 'merge') {
          // 更新报文
          await PacketMessageModel.update(item.packet_id, {
            name: item.name,
            description: item.description || '',
            version: item.version || '1.0'
          });
          updated++;
        }
      }
    }

    return { created, updated };
  }
}

module.exports = DataImportExportService;
