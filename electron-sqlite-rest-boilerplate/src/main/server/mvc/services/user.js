// 用户服务，处理用户相关业务逻辑
const UserModel = require('../models/user');
const RoleModel = require('../models/role');
const { getUserPermissions } = require('../../middleware/auth');

class UserService {
  /**
   * 用户登录
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @returns {Promise<Object>} 登录结果
   */
  static async login(username, password) {
    try {
      const result = await UserModel.login(username, password);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取用户列表（带角色信息）
   * @param {number} page - 页码
   * @param {number} size - 每页数量
   * @param {string} keyword - 关键词搜索
   * @param {number} roleId - 角色ID筛选
   * @param {number} status - 状态筛选
   * @returns {Promise<Object>} 用户列表
   */
  static async getUserList(page = 1, size = 10, keyword = '', roleId = null, status = null) {
    try {
      return await UserModel.findAll(page, size, keyword, roleId, status);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取用户详情（带角色和权限信息）
   * @param {number} userId - 用户ID
   * @returns {Promise<Object>} 用户详情
   */
  static async getUserDetail(userId) {
    try {
      const user = await UserModel.findByUserId(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      // 获取用户权限
      const permissionList = await getUserPermissions(userId);

      return {
        ...user,
        permissionList
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 创建用户
   * @param {Object} userData - 用户数据
   * @param {string} userData.user_name - 用户名
   * @param {string} userData.password - 密码
   * @param {string} userData.real_name - 真实姓名
   * @param {string} userData.email - 邮箱
   * @param {string} userData.phone - 手机号
   * @param {number} userData.role_id - 角色ID
   * @returns {Promise<Object>} 创建的用户对象
   */
  static async createUser(userData) {
    try {
      // 检查用户名是否已存在
      const existUser = await UserModel.findByUsername(userData.user_name);
      if (existUser) {
        throw new Error('用户名已存在');
      }

      // 如果指定了角色，检查角色是否存在
      if (userData.role_id) {
        const role = await RoleModel.findByRoleId(userData.role_id);
        if (!role) {
          throw new Error('角色不存在');
        }
      }

      return await UserModel.create(userData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 更新用户
   * @param {number} userId - 用户ID
   * @param {Object} updateData - 更新数据
   * @param {string} updateData.user_name - 用户名
   * @param {string} updateData.real_name - 真实姓名
   * @param {string} updateData.email - 邮箱
   * @param {string} updateData.phone - 手机号
   * @param {number} updateData.role_id - 角色ID
   * @returns {Promise<Object>} 更新后的用户对象
   */
  static async updateUser(userId, updateData) {
    try {
      // 检查用户是否存在
      const user = await UserModel.findByUserId(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      // 如果更新用户名，检查是否重复
      if (updateData.user_name && updateData.user_name !== user.user_name) {
        const existUser = await UserModel.findByUsername(updateData.user_name);
        if (existUser) {
          throw new Error('用户名已存在');
        }
      }

      // 如果更新角色，检查角色是否存在
      if (updateData.role_id) {
        const role = await RoleModel.findByRoleId(updateData.role_id);
        if (!role) {
          throw new Error('角色不存在');
        }
      }

      return await UserModel.update(userId, updateData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 删除用户
   * @param {number} userId - 用户ID
   * @returns {Promise<boolean>} 删除结果
   */
  static async deleteUser(userId) {
    try {
      const user = await UserModel.findByUserId(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      // 防止删除超级管理员
      if (user.role_id === 1) {
        throw new Error('不能删除超级管理员');
      }

      return await UserModel.delete(userId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 启用用户（支持批量）
   * @param {Array<number>} userIdList - 用户ID数组
   * @returns {Promise<number>} 更新的用户数量
   */
  static async enableUser(userIdList) {
    try {
      return await UserModel.updateStatusList(userIdList, 1);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 禁用用户（支持批量）
   * @param {Array<number>} userIdList - 用户ID数组
   * @returns {Promise<number>} 更新的用户数量
   */
  static async disableUser(userIdList) {
    try {
      // 检查是否包含超级管理员
      for (const userId of userIdList) {
        const user = await UserModel.findByUserId(userId);
        if (user && user.role_id === 1) {
          throw new Error('不能禁用超级管理员');
        }
      }

      return await UserModel.updateStatusList(userIdList, 0);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 删除用户（支持批量）
   * @param {Array<number>} userIdList - 用户ID数组
   * @returns {Promise<number>} 删除的用户数量
   */
  static async deleteUserList(userIdList) {
    try {
      // 检查是否包含超级管理员
      for (const userId of userIdList) {
        const user = await UserModel.findByUserId(userId);
        if (user && user.role_id === 1) {
          throw new Error('不能删除超级管理员');
        }
      }

      return await UserModel.deleteList(userIdList);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 重置密码
   * @param {number} userId - 用户ID
   * @param {string} newPassword - 新密码，默认为'123456'
   * @returns {Promise<boolean>} 重置结果
   */
  static async resetPassword(userId, newPassword = '123456') {
    try {
      const user = await UserModel.findByUserId(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      return await UserModel.resetPassword(userId, newPassword);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 修改密码
   * @param {number} userId - 用户ID
   * @param {string} oldPassword - 旧密码
   * @param {string} newPassword - 新密码
   * @returns {Promise<boolean>} 修改结果
   */
  static async changePassword(userId, oldPassword, newPassword) {
    try {
      return await UserModel.changePassword(userId, oldPassword, newPassword);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 分配角色
   * @param {number} userId - 用户ID
   * @param {number} roleId - 角色ID
   * @returns {Promise<boolean>} 分配结果
   */
  static async assignRole(userId, roleId) {
    try {
      const user = await UserModel.findByUserId(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      const role = await RoleModel.findByRoleId(roleId);
      if (!role) {
        throw new Error('角色不存在');
      }

      return await UserModel.update(userId, { role_id: roleId });
    } catch (error) {
      throw error;
    }
  }
}

module.exports = UserService;
