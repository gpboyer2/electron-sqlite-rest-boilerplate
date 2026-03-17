/**
 * @file systemLevelDesignTree.js
 * @brief 系统层级设计树服务，处理系统层级设计节点的相关业务逻辑
 * @date 2025-11-28
 * @copyright Copyright (c) 2025
 */
const SystemLevelDesignTreeModel = require('../models/systemLevelDesignTree');
const HierarchyService = require('./hierarchy');
const logger = require('../../middleware/log4jsPlus').getLogger();

// 环境变量配置
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDev = NODE_ENV !== 'production';

// 加载种子数据（仅开发模式）
// pkg 环境和开发环境的路径不同
let seedData = { node_types: [], nodes: [] };
if (isDev) {
  if (process.pkg) {
    // pkg 打包后：从 /release-build/pkg/source/server/data/ 读取
    const path = require('path');
    const dataPath = path.join(__dirname, '../../../data/mock-system-level-design.json');
    seedData = require(dataPath);
  } else {
    // 开发环境：从 server/data/ 读取
    seedData = require('../../data/mock-system-level-design.json');
  }
}
const seedNodeList = seedData.nodes || [];
const seedNodeTypeList = seedData.node_types || [];

// 种子数据初始化状态
let seedInitialized = false;

class SystemLevelDesignTreeService {
  // 前端虚拟根节点 ID 列表，用于将前端的虚拟节点 ID 转换为后端的 null
  static VIRTUAL_ROOT_IDS = ['system-hierarchy'];

  /**
   * 检查节点名称是否重复（仅用于创建时检查，同级节点内检查）
   * @param {string} name - 节点名称（已去空格）
   * @param {string|null} parentId - 父节点ID（用于检查同级节点）
   * @returns {Promise<boolean>} 是否重复
   */
  static async isNameDuplicate(name, parentId) {
    try {
      // 获取同级节点
      const siblingList = await SystemLevelDesignTreeModel.findByParentId(parentId);
      return siblingList.some((node) => String(node.name || '').trim() === name);
    } catch (error) {
      throw new Error('检查节点名称重复失败: ' + error.message);
    }
  }

  /**
   * 初始化种子数据（仅开发模式，数据库为空时注入）
   */
  static async initSeedData() {
    if (seedInitialized || !isDev) return;
    try {
      // 先确保层级类型已初始化（外键依赖）
      await HierarchyService.getAllNodeTypes();

      const dbNodeList = await SystemLevelDesignTreeModel.findAll();
      if (dbNodeList.length === 0 && seedNodeList.length > 0) {
        logger.info('[SystemLevelDesign] 数据库为空，开始注入种子数据...');
        // 移除 _mock 标记，批量插入
        const cleanedList = seedNodeList.map(({ _mock, ...node }) => node);
        await SystemLevelDesignTreeModel.createBatch(cleanedList);
        logger.info(`[SystemLevelDesign] 种子数据注入完成，共 ${seedNodeList.length} 条`);
      }
      seedInitialized = true;
    } catch (error) {
      logger.error('[SystemLevelDesign] 种子数据初始化失败:', error.message);
    }
  }

  /**
   * 获取所有节点
   */
  static async getAllSystemLevelDesignNodes() {
    try {
      // 首次访问时初始化种子数据
      await this.initSeedData();
      const result = await SystemLevelDesignTreeModel.findAll();
      logger.info('[Service.getAllSystemLevelDesignNodes] 返回节点数量:', result.length);

      // 清理每个节点的 properties 字段，移除可能干扰前端树构建的字段
      const cleanedResult = result.map((node) => {
        if (node.properties) {
          const { children, expanded, ...cleanedProperties } = node.properties;
          return {
            ...node,
            properties: cleanedProperties
          };
        }
        return node;
      });

      return cleanedResult;
    } catch (error) {
      throw new Error('getAllSystemLevelDesignNodes Failed: ' + error.message);
    }
  }

  /**
   * 获取单个节点
   * @param {string} id - 节点ID
   */
  static async getSystemLevelDesignNodeById(id) {
    try {
      logger.info('[Service.getSystemLevelDesignNodeById] 查询节点 id:', id);
      const result = await SystemLevelDesignTreeModel.findById(id);
      logger.info(
        '[Service.getSystemLevelDesignNodeById] 查询结果:',
        result ? JSON.stringify(result) : 'null'
      );
      // 查询操作：节点不存在时返回 null，而不是抛出异常
      // 符合测试架构规范：查询类操作查不到数据 = success
      return result;
    } catch (error) {
      throw new Error('getSystemLevelDesignNodeById Failed: ' + error.message);
    }
  }

  /**
   * 获取子节点
   * @param {string} parentId - 父节点ID
   */
  static async getChildNodes(parentId) {
    try {
      return await SystemLevelDesignTreeModel.findByParentId(parentId);
    } catch (error) {
      throw new Error('getChildNodes Failed: ' + error.message);
    }
  }

  /**
   * 创建节点
   * @param {Object} data - 节点数据
   */
  static async createNode(data) {
    try {
      return await SystemLevelDesignTreeModel.create(data);
    } catch (error) {
      throw new Error('createNode Failed: ' + error.message);
    }
  }

  /**
   * 批量创建节点
   * @param {Array<Object>} dataList - 节点数据列表
   */
  static async createNodeList(dataList) {
    try {
      // 校验空数组
      if (!dataList || dataList.length === 0) {
        throw new Error('创建节点失败: 参数不能为空数组');
      }

      // 获取有效的 node_type_id 列表
      const nodeTypeList = await HierarchyService.getAllNodeTypes();
      const validNodeTypeIds = new Set(nodeTypeList.map((nt) => nt.id));

      // 构建 node_type_id -> node_type 的映射
      const nodeTypeMap = {};
      nodeTypeList.forEach((nt) => {
        nodeTypeMap[nt.id] = nt;
      });

      // 校验每个节点的 node_type_id 和层级关系
      for (const item of dataList) {
        // 将前端虚拟根节点 ID 转换为 null
        if (this.VIRTUAL_ROOT_IDS.includes(item.parent_id)) {
          item.parent_id = null;
        }
        // 检查名称是否重复（同级节点内检查）
        if (item.name !== undefined && item.name !== null) {
          const trimmedName = String(item.name || '').trim();
          const isDuplicate = await this.isNameDuplicate(trimmedName, item.parent_id);
          if (isDuplicate) {
            throw new Error(`节点名称"${trimmedName}"已存在，请使用其他名称`);
          }
        }
        if (!item.node_type_id) {
          throw new Error('创建节点失败: 缺少参数 node_type_id');
        }
        if (!validNodeTypeIds.has(item.node_type_id)) {
          throw new Error('创建节点失败: 无效的 node_type_id');
        }

        // 验证层级关系：如果指定了 parent_id，则需要验证父节点的 node_type_id 是否是当前节点 node_type_id 的父层级
        if (item.parent_id) {
          const childNodeType = nodeTypeMap[item.node_type_id];
          const expectedParentTypeId = childNodeType.parent_id;

          // 获取父节点的 node_type_id
          const parentNode = await SystemLevelDesignTreeModel.findById(item.parent_id);
          if (!parentNode) {
            throw new Error('创建节点失败: 父节点不存在');
          }

          const parentNodeType = nodeTypeMap[parentNode.node_type_id];
          if (!parentNodeType) {
            throw new Error('创建节点失败: 父节点的节点类型无效');
          }

          // 验证层级关系：父节点的 node_type_id 必须等于子节点类型的 parent_id
          if (parentNodeType.id !== expectedParentTypeId) {
            throw new Error(
              `创建节点失败: 层级关系不正确，节点类型 "${childNodeType.display_name}" 不能添加到 "${parentNodeType.display_name}" 下`
            );
          }
        } else {
          // 如果没有 parent_id，则必须是根层级（parent_id 为 null 的层级类型）
          const childNodeType = nodeTypeMap[item.node_type_id];
          if (childNodeType.parent_id !== null) {
            // 找到该层级的根层级路径，获取最顶层的父层级名称
            const rootParentName = this.getRootParentName(childNodeType.id, nodeTypeMap);
            throw new Error(
              `创建节点失败: 节点类型 "${childNodeType.display_name}" 必须添加到 "${rootParentName}" 层级下`
            );
          }
        }
      }

      const now = Date.now();
      const preparedList = dataList.map((item) => ({
        ...item,
        created_at: item.created_at || now,
        updated_at: item.updated_at || now
      }));
      return await SystemLevelDesignTreeModel.createBatch(preparedList);
    } catch (error) {
      throw new Error('createNodeList Failed: ' + error.message);
    }
  }

  /**
   * 获取节点类型的根父节点名称（递归查找最顶层的父层级）
   * @param {string} nodeTypeId - 节点类型 ID
   * @param {Object} nodeTypeMap - 节点类型映射
   * @returns {string} 根父节点名称
   */
  static getRootParentName(nodeTypeId, nodeTypeMap) {
    const nodeType = nodeTypeMap[nodeTypeId];
    if (!nodeType) return '未知';

    if (nodeType.parent_id === null) {
      return nodeType.display_name;
    }

    return this.getRootParentName(nodeType.parent_id, nodeTypeMap);
  }

  /**
   * 更新节点
   * @param {string} id - 节点ID
   * @param {Object} data - 更新数据
   */
  static async updateNode(id, data) {
    try {
      data.updated_at = Date.now();
      await SystemLevelDesignTreeModel.update(id, data);
      return await this.getSystemLevelDesignNodeById(id);
    } catch (error) {
      throw new Error('updateNode Failed: ' + error.message);
    }
  }

  /**
   * 批量更新节点
   * @param {Array<Object>} dataList - 节点数据列表
   */
  static async updateNodeList(dataList) {
    logger.info('[updateNodeList] Service 收到请求，dataList:', JSON.stringify(dataList));
    try {
      // 获取所有节点（用于名称重复校验）
      const allNodes = await SystemLevelDesignTreeModel.findAll();

      // 校验每个节点
      for (const item of dataList) {
        if (!item.id) {
          throw new Error('更新节点失败: 缺少参数 id');
        }
        // 检查节点是否存在
        const exists = await SystemLevelDesignTreeModel.findById(item.id);
        if (!exists) {
          throw new Error('更新节点失败: 节点不存在');
        }

        // 检查名称是否重复（排除自己，同级节点内检查）
        if (
          item.name !== undefined &&
          item.name !== null &&
          item.properties &&
          item.properties.name !== undefined
        ) {
          const trimmedName = String(item.properties.name || item.name || '').trim();
          const parentId = item.parent_id || null;
          const isDuplicate = allNodes.some((node) => {
            if (node.id === item.id) return false; // 排除自己
            if (node.parent_id !== parentId) return false; // 只检查同级节点
            const nodeName = String(node.properties?.name || node.name || '').trim();
            return nodeName === trimmedName;
          });
          if (isDuplicate) {
            throw new Error(`节点名称"${trimmedName}"已存在，请使用其他名称`);
          }
        }
      }

      const now = Date.now();
      const preparedList = dataList.map((item) => {
        const updated = { ...item, updated_at: now };
        // 将前端虚拟根节点 ID 转换为 null
        if (this.VIRTUAL_ROOT_IDS.includes(updated.parent_id)) {
          updated.parent_id = null;
        }
        return updated;
      });
      logger.info('[updateNodeList] 准备调用 Model.updateBatch');
      const result = await SystemLevelDesignTreeModel.updateBatch(preparedList);
      logger.info('[updateNodeList] Model 返回结果:', JSON.stringify(result));

      // 修正返回格式：updated 和 failed 应该是数组，不是对象
      const formattedResult = {
        updated: result.updated || [],
        failed: result.failed || [],
        successCount: result.successCount || 0,
        failedCount: result.failedCount || 0
      };
      logger.info('[updateNodeList] 格式化后的返回结果:', JSON.stringify(formattedResult));

      // 如果全部失败，抛出错误
      if (formattedResult.successCount === 0 && formattedResult.failedCount > 0) {
        const failedIdList = formattedResult.failed.map((f) => f.id).join(', ');
        throw new Error(`更新失败: 记录不存在或数据未变化 (id: ${failedIdList})`);
      }
      return formattedResult;
    } catch (error) {
      logger.error('[updateNodeList] 发生错误:', error.message);
      throw new Error(
        error.message.startsWith('更新失败')
          ? error.message
          : 'updateNodeList Failed: ' + error.message
      );
    }
  }

  /**
   * 删除节点
   * @param {string} id - 节点ID
   */
  static async deleteNode(id) {
    try {
      return await SystemLevelDesignTreeModel.delete(id);
    } catch (error) {
      throw new Error('deleteNode Failed: ' + error.message);
    }
  }

  /**
   * 批量删除节点
   * @param {Array<string>} idList - 节点ID列表
   */
  static async deleteNodeList(idList) {
    try {
      return await SystemLevelDesignTreeModel.deleteBatch(idList);
    } catch (error) {
      throw new Error('deleteNodeList Failed: ' + error.message);
    }
  }
}

module.exports = SystemLevelDesignTreeService;
