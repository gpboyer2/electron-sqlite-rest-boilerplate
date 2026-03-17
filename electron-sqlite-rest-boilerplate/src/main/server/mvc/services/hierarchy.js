/**
 * @file       hierarchy.js
 * @brief      层级服务，处理层级类型、字段和节点的相关业务逻辑
 * @date       2025-11-28
 * @copyright  Copyright (c) 2025
 */
const HierarchyModel = require('../models/hierarchy');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../../database/sequelize');
const { NodeType } = require('../../database/models');

// ==================== 默认数据配置 ====================

// 默认层级类型
// 注意：这是系统首次安装时的默认配置，仅用于初始化
// 用户可以在层级设置页面 (#/hierarchy-settings) 自定义节点类型和层级结构
const DEFAULT_NODE_TYPES = [
  {
    id: 'default-1',
    type_name: 'LEVEL_1',
    display_name: '系统',
    icon_class: 'Folder',
    order: 1,
    parent_id: null,
    enable_comm_node_list: 0,
    description: '用户可通过层级设置页面自定义名称和属性'
  },
  {
    id: 'default-2',
    type_name: 'LEVEL_2',
    display_name: '硬件',
    icon_class: 'Monitor',
    order: 2,
    parent_id: 'default-1',
    enable_comm_node_list: 0,
    description: '用户可通过层级设置页面自定义名称和属性'
  },
  {
    id: 'default-3',
    type_name: 'LEVEL_3',
    display_name: '软件',
    icon_class: 'Box',
    order: 3,
    parent_id: 'default-2',
    enable_comm_node_list: 1,
    description: '用户可通过层级设置页面自定义名称和属性'
  }
];

// 基础字段模板（用于新建层级时自动创建）
// 注意：name 是内置字段，不在动态字段模板中
const BASE_FIELD_TEMPLATE = [
  {
    id: 'field-version',
    field_name: '版本',
    field_type: 'string',
    required: 0,
    placeholder: '请输入版本号',
    order: 1
  },
  {
    id: 'field-desc',
    field_name: '描述',
    field_type: 'textarea',
    required: 0,
    placeholder: '请输入描述',
    order: 2
  }
];

// ==================== 服务类 ====================

class HierarchyService {
  /**
   * 获取所有层级类型（包含字段）
   * @returns {Promise<Array>} 层级类型列表
   */
  static async getAllNodeTypes() {
    try {
      let nodeTypes = await HierarchyModel.findAllNodeTypes();
      if (!nodeTypes || nodeTypes.length === 0) {
        await HierarchyService.initializeDefaultNodeTypes();
        nodeTypes = await HierarchyModel.findAllNodeTypes();
      }

      // 解析每个 node_type 的 fields 字段
      for (const nodeType of nodeTypes) {
        let fields = nodeType.fields;

        // 如果层级没有字段，自动补充默认字段
        if (!fields || fields.length === 0) {
          await HierarchyService.ensureDefaultFields(nodeType.id);
          // 重新获取
          const updated = await HierarchyModel.findNodeTypeById(nodeType.id);
          fields = updated?.fields;
        }

        // 处理 options 字段的反序列化
        nodeType.fields = (fields || []).map((field) => ({
          id: field.id,
          name: field.field_name,
          type: field.field_type,
          required: field.required === 1,
          defaultValue: field.default_value || '',
          options: field.options ? (Array.isArray(field.options) ? field.options : []) : [],
          placeholder: field.placeholder || '',
          order: field.order || 0
        }));
      }
      return nodeTypes;
    } catch (error) {
      throw new Error('getAllNodeTypes Failed: ' + error.message);
    }
  }

  /**
   * 确保层级有默认字段
   * @param {string} nodeTypeId - 层级类型ID
   * @returns {Promise<void>}
   */
  static async ensureDefaultFields(nodeTypeId) {
    // 获取当前 node_type
    const nodeType = await HierarchyModel.findNodeTypeById(nodeTypeId);
    if (!nodeType) throw new Error('Node type not found');

    // 生成带 ID 的字段数组
    const fields = BASE_FIELD_TEMPLATE.map((tpl) => ({
      id: uuidv4(),
      field_name: tpl.field_name,
      field_type: tpl.field_type,
      required: tpl.required,
      default_value: '',
      options: null,
      placeholder: tpl.placeholder,
      order: tpl.order
    }));

    // 更新 node_type 的 fields 字段
    await HierarchyModel.updateNodeType(nodeTypeId, {
      fields: fields,
      updated_at: Date.now()
    });
  }

  /**
   * 初始化默认层级类型
   * @returns {Promise<void>}
   */
  static async initializeDefaultNodeTypes() {
    const now = Date.now();

    // 为每个层级生成基础字段
    const nodeTypesData = DEFAULT_NODE_TYPES.map((nodeType) => {
      // 为每个层级创建独立的字段副本（带唯一 ID）
      const fields = BASE_FIELD_TEMPLATE.map((tpl) => ({
        id: uuidv4(),
        field_name: tpl.field_name,
        field_type: tpl.field_type,
        required: tpl.required,
        default_value: '',
        options: null,
        placeholder: tpl.placeholder,
        order: tpl.order
      }));

      return {
        ...nodeType,
        fields: fields,
        created_at: now,
        updated_at: now
      };
    });

    await NodeType.bulkCreate(nodeTypesData);
  }

  /**
   * 获取单个层级类型
   * @param {string} id - 层级类型ID
   * @returns {Promise<Object>} 层级类型对象
   */
  static async getNodeTypeById(id) {
    try {
      const nodeType = await HierarchyModel.findNodeTypeById(id);
      if (nodeType) {
        const fields = nodeType.fields;
        nodeType.fields = fields.map((field) => ({
          id: field.id,
          name: field.field_name,
          type: field.field_type,
          required: field.required === 1,
          defaultValue: field.default_value || '',
          options: field.options ? (Array.isArray(field.options) ? field.options : []) : [],
          placeholder: field.placeholder || '',
          order: field.order || 0
        }));
      }
      return nodeType;
    } catch (error) {
      throw new Error('getNodeTypeById Failed: ' + error.message);
    }
  }

  /**
   * 创建层级类型（自动创建默认字段）
   * @param {Object} data - 层级类型数据
   * @param {string} data.type_name - 类型名称
   * @param {string} data.display_name - 显示名称
   * @param {string} data.icon_class - 图标类名
   * @param {number} data.order - 排序序号
   * @param {string} data.parent_id - 父级ID
   * @param {string} data.description - 描述
   * @returns {Promise<Object>} 创建的层级类型对象
   */
  static async createNodeType(data) {
    try {
      const nodeTypeId = uuidv4();
      const now = Date.now();

      // 生成默认字段（带唯一 ID）
      const fields = BASE_FIELD_TEMPLATE.map((tpl) => ({
        id: uuidv4(),
        field_name: tpl.field_name,
        field_type: tpl.field_type,
        required: tpl.required,
        default_value: '',
        options: null,
        placeholder: tpl.placeholder,
        order: tpl.order
      }));

      const nodeTypeData = {
        id: nodeTypeId,
        type_name: data.type_name || 'CUSTOM',
        display_name: data.display_name,
        icon_class: data.icon_class || '',
        order: data.order || 0,
        parent_id: data.parent_id || null,
        description: data.description || '',
        fields: fields,
        created_at: now,
        updated_at: now
      };

      const result = await HierarchyModel.createNodeType(nodeTypeData);
      return await this.getNodeTypeById(nodeTypeId);
    } catch (error) {
      throw new Error('createNodeType Failed: ' + error.message);
    }
  }

  /**
   * 更新层级类型
   * @param {string} id - 层级类型ID
   * @param {Object} data - 更新数据
   * @param {string} data.type_name - 类型名称
   * @param {string} data.display_name - 显示名称
   * @param {string} data.icon_class - 图标类名
   * @param {number} data.order - 排序序号
   * @param {string} data.parent_id - 父级ID
   * @param {string} data.description - 描述
   * @param {number} data.enable_comm_node_list - 是否启用通信节点列表
   * @returns {Promise<Object>} 更新后的层级类型对象
   */
  static async updateNodeType(id, data) {
    try {
      // 只更新基本字段，不更新 fields
      const updateData = {
        type_name: data.type_name,
        display_name: data.display_name,
        icon_class: data.icon_class,
        order: data.order,
        parent_id: data.parent_id,
        description: data.description,
        enable_comm_node_list: data.enable_comm_node_list,
        updated_at: Date.now()
      };

      await HierarchyModel.updateNodeType(id, updateData);
      return await this.getNodeTypeById(id);
    } catch (error) {
      throw new Error('updateNodeType Failed: ' + error.message);
    }
  }

  /**
   * 删除层级类型
   * @param {string} id - 层级类型ID
   * @returns {Promise<boolean>} 删除结果
   */
  static async deleteNodeType(id) {
    try {
      return await HierarchyModel.deleteNodeType(id);
    } catch (error) {
      throw new Error('deleteNodeType Failed: ' + error.message);
    }
  }

  /**
   * 为层级添加字段
   * @param {string} nodeTypeId - 层级类型ID
   * @param {Object} fieldData - 字段数据
   * @param {string} fieldData.name - 字段名称
   * @param {string} fieldData.type - 字段类型
   * @param {boolean} fieldData.required - 是否必填
   * @param {string} fieldData.defaultValue - 默认值
   * @param {Array} fieldData.options - 选项列表
   * @param {string} fieldData.placeholder - 占位符
   * @param {number} fieldData.order - 排序序号
   * @returns {Promise<Object>} 创建的字段对象
   */
  static async createNodeTypeField(nodeTypeId, fieldData) {
    try {
      // 获取当前 node_type 的 fields
      const nodeType = await HierarchyModel.findNodeTypeById(nodeTypeId);
      if (!nodeType) throw new Error('Node type not found');

      let fields = nodeType.fields;

      // 计算新字段的 order（追加到末尾）
      const maxOrder = fields.length > 0 ? Math.max(...fields.map((f) => f.order || 0)) : 0;

      // 创建新字段
      const newField = {
        id: uuidv4(),
        field_name: fieldData.name,
        field_type: fieldData.type,
        required: fieldData.required ? 1 : 0,
        default_value: fieldData.defaultValue || '',
        options: fieldData.options || [],
        placeholder: fieldData.placeholder || '',
        order: fieldData.order ?? maxOrder + 1
      };

      fields.push(newField);

      // 更新 node_type 的 fields 字段
      await HierarchyModel.updateNodeType(nodeTypeId, {
        fields: fields,
        updated_at: Date.now()
      });

      return {
        id: newField.id,
        name: newField.field_name,
        type: newField.field_type,
        required: newField.required === 1,
        defaultValue: newField.default_value,
        options: newField.options,
        placeholder: newField.placeholder,
        order: newField.order
      };
    } catch (error) {
      throw new Error('createNodeTypeField Failed: ' + error.message);
    }
  }

  /**
   * 更新层级字段
   * @param {string} fieldId - 字段ID
   * @param {Object} data - 更新数据
   * @param {string} data.name - 字段名称
   * @param {string} data.type - 字段类型
   * @param {boolean} data.required - 是否必填
   * @param {string} data.defaultValue - 默认值
   * @param {Array} data.options - 选项列表
   * @param {string} data.placeholder - 占位符
   * @param {number} data.order - 排序序号
   * @returns {Promise<Object>} 更新后的字段对象
   */
  static async updateNodeTypeField(fieldId, data) {
    try {
      // 找到包含该字段的 node_type
      const nodeTypes = await HierarchyModel.findAllNodeTypes();
      let targetType = null;
      let targetFields = null;

      for (const nodeType of nodeTypes) {
        const fields = nodeType.fields;
        const field = fields.find((f) => f.id === fieldId);
        if (field) {
          targetType = nodeType;
          targetFields = fields;
          break;
        }
      }

      if (!targetType || !targetFields) {
        throw new Error('Field not found');
      }

      // 更新字段
      const fieldIndex = targetFields.findIndex((f) => f.id === fieldId);
      if (fieldIndex !== -1) {
        targetFields[fieldIndex] = {
          ...targetFields[fieldIndex],
          field_name: data.name,
          field_type: data.type,
          required: data.required ? 1 : 0,
          default_value: data.defaultValue || '',
          options: data.options || [],
          placeholder: data.placeholder || '',
          order: data.order ?? targetFields[fieldIndex].order
        };

        // 更新 node_type 的 fields 字段
        await HierarchyModel.updateNodeType(targetType.id, {
          fields: targetFields,
          updated_at: Date.now()
        });
      }

      return {
        id: fieldId,
        name: data.name,
        type: data.type,
        required: data.required,
        defaultValue: data.defaultValue,
        options: data.options,
        placeholder: data.placeholder,
        order: data.order
      };
    } catch (error) {
      throw new Error('updateNodeTypeField Failed: ' + error.message);
    }
  }

  /**
   * 删除层级字段
   * @param {string} fieldId - 字段ID
   * @returns {Promise<Object>} 删除结果
   */
  static async deleteNodeTypeField(fieldId) {
    try {
      // 找到包含该字段的 node_type
      const nodeTypes = await HierarchyModel.findAllNodeTypes();
      let targetType = null;
      let targetFields = null;

      for (const nodeType of nodeTypes) {
        const fields = nodeType.fields;
        const field = fields.find((f) => f.id === fieldId);
        if (field) {
          targetType = nodeType;
          targetFields = fields;
          break;
        }
      }

      if (!targetType || !targetFields) {
        throw new Error('Field not found');
      }

      // 删除字段
      const filteredFields = targetFields.filter((f) => f.id !== fieldId);

      // 更新 node_type 的 fields 字段
      await HierarchyModel.updateNodeType(targetType.id, {
        fields: filteredFields,
        updated_at: Date.now()
      });

      return { success: true };
    } catch (error) {
      throw new Error('deleteNodeTypeField Failed: ' + error.message);
    }
  }

  /**
   * 获取层级节点树
   * @returns {Promise<Array>} 层级节点树
   */
  static async getHierarchyTree() {
    try {
      return await HierarchyModel.buildHierarchyTree();
    } catch (error) {
      throw new Error('getHierarchyTree Failed: ' + error.message);
    }
  }

  /**
   * 获取所有层级节点
   * @returns {Promise<Array>} 层级节点列表
   */
  static async getAllHierarchyNodes() {
    try {
      const nodes = await HierarchyModel.findAllHierarchyNodes();
      const nodeTypes = await HierarchyModel.findAllNodeTypes();

      const nodeTypeMap = {};
      nodeTypes.forEach((type) => {
        nodeTypeMap[type.id] = type;
      });

      nodes.forEach((node) => {
        node.type = nodeTypeMap[node.node_type_id];
        node.properties = node.properties || {};
      });

      return nodes;
    } catch (error) {
      throw new Error('getAllHierarchyNodes Failed: ' + error.message);
    }
  }

  /**
   * 根据ID获取层级节点
   * @param {string} id - 节点ID
   * @returns {Promise<Object>} 层级节点对象
   */
  static async getHierarchyNodeById(id) {
    try {
      const node = await HierarchyModel.findHierarchyNodeById(id);
      if (node) {
        const nodeTypes = await HierarchyModel.findAllNodeTypes();
        const nodeType = nodeTypes.find((type) => type.id === node.node_type_id);
        node.type = nodeType;
        node.properties = node.properties || {};
      }
      return node;
    } catch (error) {
      throw new Error('getHierarchyNodeById Failed: ' + error.message);
    }
  }

  /**
   * 创建层级节点
   * @param {Object} data - 节点数据
   * @param {string} data.node_type_id - 层级类型ID
   * @param {string} data.parent_id - 父节点ID
   * @param {string} data.name - 节点名称
   * @param {string} data.description - 描述
   * @param {Object} data.customFields - 自定义字段
   * @returns {Promise<Object>} 创建的节点对象
   */
  static async createHierarchyNode(data) {
    try {
      const nodeData = {
        id: uuidv4(),
        node_type_id: data.node_type_id,
        parent_id: data.parent_id || null,
        name: data.name,
        description: data.description || '',
        properties: data.customFields || {},
        created_at: Date.now(),
        updated_at: Date.now()
      };
      return await HierarchyModel.createHierarchyNode(nodeData);
    } catch (error) {
      throw new Error('createHierarchyNode Failed: ' + error.message);
    }
  }

  /**
   * 更新层级节点
   * @param {string} id - 节点ID
   * @param {Object} data - 更新数据
   * @param {string} data.name - 节点名称
   * @param {string} data.description - 描述
   * @param {Object} data.customFields - 自定义字段
   * @returns {Promise<Object>} 更新后的节点对象
   */
  static async updateHierarchyNode(id, data) {
    try {
      const updateData = {
        name: data.name,
        description: data.description,
        properties: data.customFields || {},
        updated_at: Date.now()
      };
      await HierarchyModel.updateHierarchyNode(id, updateData);
      return await this.getHierarchyNodeById(id);
    } catch (error) {
      throw new Error('updateHierarchyNode Failed: ' + error.message);
    }
  }

  /**
   * 删除层级节点
   * @param {string} id - 节点ID
   * @returns {Promise<boolean>} 删除结果
   */
  static async deleteHierarchyNode(id) {
    try {
      return await HierarchyModel.deleteHierarchyNode(id);
    } catch (error) {
      throw new Error('deleteHierarchyNode Failed: ' + error.message);
    }
  }
}

module.exports = HierarchyService;
