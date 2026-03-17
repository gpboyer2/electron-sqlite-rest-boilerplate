/**
 * 角色模型，处理角色的CRUD操作和权限关联
 */
const log4js = require('../../middleware/log4jsPlus');
const logger = log4js.getLogger('default');
const { Role, Permission, RolePermission, User } = require('../../database/models');
const { sequelize } = require('../../database/sequelize');
const { Op } = require('sequelize');

class RoleModel {
  /**
   * 超级管理员角色ID（系统约定）
   * @type {number}
   */
  static SUPER_ADMIN_ROLE_ID = 1;

  /**
   * 获取角色列表（根据当前用户权限过滤）
   * @param {number|null} status - 角色状态筛选条件（可选）
   * @param {Object|null} currentUser - 当前用户对象（可选）
   * @param {number} currentUser.role_id - 当前用户角色ID
   * @returns {Promise<Object>} 返回包含角色列表的对象
   * @returns {Array} returns.list - 角色列表，包含用户数量统计
   */
  static async findAll(status = null, currentUser = null) {
    try {
      const where = {};

      // 核心安全逻辑：永远不返回超级管理员角色
      where.role_id = { [Op.ne]: this.SUPER_ADMIN_ROLE_ID };

      // 权限过滤：只能看到比自己角色级别低的角色
      if (currentUser && currentUser.role_id) {
        where.role_id = {
          [Op.and]: [{ [Op.ne]: this.SUPER_ADMIN_ROLE_ID }, { [Op.gt]: currentUser.role_id }]
        };
      }

      if (status !== null) {
        where.status = status;
      }

      const roleList = await Role.findAll({
        where,
        order: [['create_time', 'ASC']],
        raw: true
      });

      for (const role of roleList) {
        const userCount = await User.count({ where: { role_id: role.role_id } });
        role.user_count = userCount;
      }

      return { list: roleList };
    } catch (error) {
      logger.error('获取角色列表失败:', error);
      throw error;
    }
  }

  /**
   * 根据角色ID获取角色详情
   * @param {number} roleId - 角色ID
   * @returns {Promise<Object|null>} 返回角色详情对象，未找到时返回null
   */
  static async findByRoleId(roleId) {
    try {
      return await Role.findByPk(roleId, { raw: true });
    } catch (error) {
      logger.error('获取角色详情失败:', error);
      throw error;
    }
  }

  /**
   * 根据角色代码获取角色
   * @param {string} roleCode - 角色代码
   * @returns {Promise<Object|null>} 返回角色对象，未找到时返回null
   */
  static async findByRoleCode(roleCode) {
    try {
      return await Role.findOne({ where: { role_code: roleCode }, raw: true });
    } catch (error) {
      logger.error('根据角色代码获取角色失败:', error);
      throw error;
    }
  }

  /**
   * 创建角色
   * @param {Object} roleData - 角色数据
   * @param {string} roleData.role_name - 角色名称
   * @param {string} roleData.role_code - 角色代码
   * @param {number} [roleData.status=1] - 角色状态（默认为1）
   * @returns {Promise<Object>} 返回创建的角色对象
   */
  static async create(roleData) {
    try {
      return await Role.create({
        ...roleData,
        create_time: Date.now(),
        status: roleData.status || 1
      });
    } catch (error) {
      logger.error('创建角色失败:', error);
      throw error;
    }
  }

  /**
   * 更新角色
   * @param {number} roleId - 角色ID
   * @param {Object} updateData - 更新的角色数据
   * @returns {Promise<Array<number>>} 返回受影响的行数数组
   */
  static async update(roleId, updateData) {
    try {
      updateData.update_time = Date.now();
      return await Role.update(updateData, { where: { role_id: roleId } });
    } catch (error) {
      logger.error('更新角色失败:', error);
      throw error;
    }
  }

  /**
   * 删除角色
   * @param {number} roleId - 角色ID
   * @returns {Promise<number>} 返回删除的记录数
   */
  static async delete(roleId) {
    try {
      await RolePermission.destroy({ where: { role_id: roleId } });
      return await Role.destroy({ where: { role_id: roleId } });
    } catch (error) {
      logger.error('删除角色失败:', error);
      throw error;
    }
  }

  /**
   * 获取角色的权限列表
   * @param {number} roleId - 角色ID
   * @returns {Promise<Array<Object>>} 返回权限列表数组
   */
  static async getPermissions(roleId) {
    try {
      // 通过关联表查询权限ID列表
      const rolePermissionList = await RolePermission.findAll({
        where: { role_id: roleId },
        raw: true
      });

      if (rolePermissionList.length === 0) return [];

      // 查询权限详情
      const permissionIdList = rolePermissionList.map((rp) => rp.permission_id);
      const permissionList = await Permission.findAll({
        where: {
          permission_id: permissionIdList,
          status: 1
        },
        raw: true
      });

      return permissionList;
    } catch (error) {
      logger.error('获取角色权限失败:', error);
      throw error;
    }
  }

  /**
   * 设置角色权限
   * @param {number} roleId - 角色ID
   * @param {Array<number>} permissionIdList - 权限ID列表
   * @returns {Promise<boolean>} 返回true表示设置成功
   */
  static async setPermissions(roleId, permissionIdList) {
    try {
      await RolePermission.destroy({ where: { role_id: roleId } });

      const insertData = permissionIdList.map((permissionId) => ({
        role_id: roleId,
        permission_id: permissionId
      }));

      if (insertData.length > 0) {
        await RolePermission.bulkCreate(insertData);
      }

      return true;
    } catch (error) {
      logger.error('设置角色权限失败:', error);
      throw error;
    }
  }

  /**
   * 检查角色是否有用户关联
   * @param {number} roleId - 角色ID
   * @returns {Promise<boolean>} 返回true表示有用户关联，false表示无用户关联
   */
  static async hasUsers(roleId) {
    try {
      const count = await User.count({ where: { role_id: roleId } });
      return count > 0;
    } catch (error) {
      logger.error('检查角色用户关联失败:', error);
      throw error;
    }
  }
}

module.exports = RoleModel;
