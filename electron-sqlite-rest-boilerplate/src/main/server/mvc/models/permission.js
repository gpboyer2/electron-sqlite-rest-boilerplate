/**
 * 权限模型，处理权限的CRUD操作和树形结构构建
 */
const log4js = require('../../middleware/log4jsPlus');
const logger = log4js.getLogger('default');
const { Permission, RolePermission, User } = require('../../database/models');
const { sequelize } = require('../../database/sequelize');
const { QueryTypes } = require('sequelize');

class PermissionModel {
  /**
   * 获取权限列表
   * @param {number|null} status - 权限状态（可选），null表示查询所有状态
   * @returns {Promise<Array>} 权限列表
   */
  static async findAll(status = null) {
    try {
      const where = status !== null ? { status: status } : {};
      return await Permission.findAll({
        where,
        order: [
          ['parent_id', 'ASC'],
          ['sort_order', 'ASC']
        ],
        raw: true
      });
    } catch (error) {
      logger.error('获取权限列表失败:', error);
      throw error;
    }
  }

  /**
   * 根据权限ID获取权限详情
   * @param {number} permissionId - 权限ID
   * @returns {Promise<Object|null>} 权限详情对象，不存在时返回null
   */
  static async findByPermissionId(permissionId) {
    try {
      return await Permission.findByPk(permissionId, { raw: true });
    } catch (error) {
      logger.error('获取权限详情失败:', error);
      throw error;
    }
  }

  /**
   * 根据权限代码获取权限
   * @param {string} permissionCode - 权限代码
   * @returns {Promise<Object|null>} 权限对象，不存在时返回null
   */
  static async findByPermissionCode(permissionCode) {
    try {
      return await Permission.findOne({ where: { permission_code: permissionCode }, raw: true });
    } catch (error) {
      logger.error('根据权限代码获取权限失败:', error);
      throw error;
    }
  }

  /**
   * 创建权限
   * @param {Object} permissionData - 权限数据
   * @param {string} permissionData.permission_name - 权限名称
   * @param {string} permissionData.permission_code - 权限代码
   * @param {number} [permissionData.parent_id] - 父权限ID
   * @param {number} [permissionData.sort_order] - 排序顺序
   * @param {number} [permissionData.status] - 权限状态，默认为1
   * @returns {Promise<Object>} 创建的权限对象
   */
  static async create(permissionData) {
    try {
      return await Permission.create({
        ...permissionData,
        create_time: Date.now(),
        status: permissionData.status || 1
      });
    } catch (error) {
      logger.error('创建权限失败:', error);
      throw error;
    }
  }

  /**
   * 更新权限
   * @param {number} permissionId - 权限ID
   * @param {Object} updateData - 更新的权限数据
   * @returns {Promise<Array<number>>} 更新影响的行数数组
   */
  static async update(permissionId, updateData) {
    try {
      return await Permission.update(updateData, { where: { permission_id: permissionId } });
    } catch (error) {
      logger.error('更新权限失败:', error);
      throw error;
    }
  }

  /**
   * 删除权限
   * @param {number} permissionId - 权限ID
   * @returns {Promise<number>} 删除的权限数量
   */
  static async delete(permissionId) {
    try {
      await RolePermission.destroy({ where: { permission_id: permissionId } });
      return await Permission.destroy({ where: { permission_id: permissionId } });
    } catch (error) {
      logger.error('删除权限失败:', error);
      throw error;
    }
  }

  /**
   * 获取权限树形结构
   * @param {number} [status=1] - 权限状态，默认为1（启用）
   * @returns {Promise<Array>} 树形结构的权限列表
   */
  static async getTree(status = 1) {
    try {
      const permissionList = await this.findAll(status);
      return this.buildTree(permissionList);
    } catch (error) {
      logger.error('获取权限树失败:', error);
      throw error;
    }
  }

  /**
   * 构建树形结构
   * @param {Array} permissionList - 扁平化的权限列表
   * @returns {Array} 树形结构的权限列表
   */
  static buildTree(permissionList) {
    const map = {};
    const roots = [];

    permissionList.forEach((p) => {
      map[p.permission_id] = { ...p, children: [] };
    });

    permissionList.forEach((p) => {
      if (p.parent_id === null || p.parent_id === 0) {
        roots.push(map[p.permission_id]);
      } else {
        const parent = map[p.parent_id];
        if (parent) {
          parent.children.push(map[p.permission_id]);
        }
      }
    });

    return roots;
  }

  /**
   * 获取子权限ID列表（递归）
   * @param {number} permissionId - 父权限ID
   * @returns {Promise<Array<number>>} 所有子权限的ID列表（递归）
   */
  static async getChildrenIdList(permissionId) {
    try {
      const allPermissionList = await this.findAll();
      const idList = [];

      const findChildren = (parentId) => {
        allPermissionList.forEach((p) => {
          if (p.parent_id === parentId) {
            idList.push(p.permission_id);
            findChildren(p.permission_id);
          }
        });
      };

      findChildren(permissionId);
      return idList;
    } catch (error) {
      logger.error('获取子权限ID列表失败:', error);
      throw error;
    }
  }

  /**
   * 创建权限列表（支持批量）
   * @param {Array} permissionDataList - 权限数据数组
   * @returns {Promise<Array>} 创建的权限对象数组
   */
  static async createList(permissionDataList) {
    try {
      return await Permission.bulkCreate(
        permissionDataList.map((p) => ({
          ...p,
          create_time: Date.now(),
          status: p.status || 1
        }))
      );
    } catch (error) {
      logger.error('创建权限列表失败:', error);
      throw error;
    }
  }

  /**
   * 根据用户ID获取权限代码列表
   * @param {number} userId - 用户ID
   * @returns {Promise<Array<string>>} 权限代码数组
   */
  static async findByUserId(userId) {
    try {
      const result = await sequelize.query(
        `
        SELECT DISTINCT p.permission_code
        FROM permissions p
        INNER JOIN role_permissions rp ON p.permission_id = rp.permission_id
        INNER JOIN users u ON u.role_id = rp.role_id
        WHERE u.user_id = ? AND p.status = 1 AND u.status = 1
      `,
        { replacements: [userId], type: QueryTypes.SELECT }
      );
      return result.map((item) => item.permission_code);
    } catch (error) {
      logger.error('根据用户ID获取权限失败:', error);
      return [];
    }
  }
}

module.exports = PermissionModel;
