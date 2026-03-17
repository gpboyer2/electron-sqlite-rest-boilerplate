/**
 * 用户模型，处理用户账户的认证、授权和管理功能
 */
const log4js = require('../../middleware/log4jsPlus');
const logger = log4js.getLogger('default');
const { User, Role } = require('../../database/models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

class UserModel {
  /**
   * 超级管理员角色ID（系统约定）
   */
  static SUPER_ADMIN_ROLE_ID = 1;

  /**
   * 获取用户列表（支持分页和搜索，根据当前用户权限过滤）
   * @param {Number} current_page - 当前页码，默认为1
   * @param {Number} page_size - 每页数量，默认为10
   * @param {String} keyword - 搜索关键词，可匹配用户名、真实姓名、邮箱
   * @param {Number|null} role - 角色ID筛选，默认为null
   * @param {Number|null} status - 状态筛选，默认为null
   * @param {Object|null} currentUser - 当前登录用户信息，用于权限过滤
   * @returns {Promise<Object>} 返回包含list（用户列表）和pagination（分页信息）的对象
   */
  static async findAll(
    current_page = 1,
    page_size = 10,
    keyword = '',
    role = null,
    status = null,
    currentUser = null
  ) {
    try {
      const where = {};

      // 核心安全逻辑：永远不返回超级管理员用户
      where.role_id = { [Op.ne]: this.SUPER_ADMIN_ROLE_ID };

      // 权限过滤：只能看到比自己角色级别低的用户
      if (currentUser && currentUser.role_id) {
        where.role_id = {
          [Op.and]: [{ [Op.ne]: this.SUPER_ADMIN_ROLE_ID }, { [Op.gt]: currentUser.role_id }]
        };
      }

      if (keyword) {
        where[Op.or] = [
          { user_name: { [Op.like]: `%${keyword}%` } },
          { real_name: { [Op.like]: `%${keyword}%` } },
          { email: { [Op.like]: `%${keyword}%` } }
        ];
      }

      if (role) {
        // 如果筛选的角色是超级管理员，直接返回空
        if (role === this.SUPER_ADMIN_ROLE_ID) {
          return { list: [], pagination: { current_page, page_size, total: 0 } };
        }
        where.role_id = role;
      }

      if (status !== null) {
        where.status = status;
      }

      const { count, rows } = await User.findAndCountAll({
        where,
        order: [['create_time', 'DESC']],
        limit: page_size,
        offset: (current_page - 1) * page_size,
        raw: true
      });

      // 单独查询角色信息
      const roleIdList = [...new Set(rows.map((row) => row.role_id).filter(Boolean))];
      const roleList =
        roleIdList.length > 0
          ? await Role.findAll({ where: { role_id: roleIdList }, raw: true })
          : [];
      const roleMap = Object.fromEntries(roleList.map((r) => [r.role_id, r]));

      return {
        list: rows.map((row) => ({
          ...row,
          role_name: roleMap[row.role_id]?.role_name,
          role_code: roleMap[row.role_id]?.role_code
        })),
        pagination: { current_page, page_size, total: count }
      };
    } catch (error) {
      logger.error('获取用户列表失败:', error);
      throw error;
    }
  }

  /**
   * 根据用户ID获取用户详情
   * @param {Number} userId - 用户ID
   * @returns {Promise<Object|null>} 返回用户详情对象（包含角色信息），用户不存在时返回null
   */
  static async findByUserId(userId) {
    try {
      const user = await User.findByPk(userId, { raw: true });
      if (!user) return null;

      // 单独查询角色信息
      let roleInfo = null;
      if (user.role_id) {
        roleInfo = await Role.findByPk(user.role_id, { raw: true });
      }

      return {
        ...user,
        role_name: roleInfo?.role_name,
        role_code: roleInfo?.role_code
      };
    } catch (error) {
      logger.error('获取用户详情失败:', error);
      throw error;
    }
  }

  /**
   * 根据用户名获取用户
   * @param {String} username - 用户名
   * @returns {Promise<Object|null>} 返回用户对象，用户不存在时返回null
   */
  static async findByUsername(username) {
    try {
      return await User.findOne({ where: { user_name: username }, raw: true });
    } catch (error) {
      logger.error('根据用户名获取用户失败:', error);
      throw error;
    }
  }

  /**
   * 创建新用户
   * @param {Object} userData - 用户数据对象
   * @param {String} userData.user_name - 用户名
   * @param {String} [userData.password] - 密码，默认为'123456'
   * @param {String} [userData.real_name] - 真实姓名
   * @param {String} [userData.email] - 邮箱
   * @param {Number} [userData.role_id] - 角色ID
   * @param {Number} [userData.status] - 状态，默认为1
   * @returns {Promise<Object>} 返回创建的用户对象
   */
  static async create(userData) {
    try {
      const hashedPassword = await bcrypt.hash(userData.password || '123456', 10);
      return await User.create({
        ...userData,
        password: hashedPassword,
        create_time: Date.now(),
        status: userData.status || 1
      });
    } catch (error) {
      logger.error('创建用户失败:', error);
      throw error;
    }
  }

  /**
   * 用户登录验证
   * @param {String} username - 用户名
   * @param {String} password - 密码
   * @returns {Promise<Object>} 返回用户对象（登录成功时）
   * @throws {Error} 当用户名不存在、密码错误或账户被禁用时抛出错误
   */
  static async login(username, password) {
    try {
      console.log('[UserModel.login] 查找用户 - Username:', username);
      const user = await User.findOne({ where: { user_name: username, status: 1 }, raw: true });
      console.log(
        '[UserModel.login] 查找用户结果:',
        user ? `找到用户 user_id=${user.user_id}, has_password=${!!user.password}` : '用户不存在'
      );
      if (!user || !user.password) throw new Error('账户或密码不正确');

      console.log(
        '[UserModel.login] 开始验证密码 - 输入密码长度:',
        password?.length,
        '数据库密码前缀:',
        user.password.substring(0, 10) + '...'
      );
      const isValid = await bcrypt.compare(password, user.password);
      console.log('[UserModel.login] 密码验证结果:', isValid);
      if (!isValid) throw new Error('账户或密码不正确');

      await User.update({ last_login_time: Date.now() }, { where: { user_id: user.user_id } });
      console.log('[UserModel.login] 登录成功 - user_id:', user.user_id);
      return user;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 更新用户信息
   * @param {Number} userId - 用户ID
   * @param {Object} updateData - 要更新的数据对象
   * @param {String} [updateData.password] - 新密码（如果提供会自动加密）
   * @param {String} [updateData.user_name] - 用户名
   * @param {String} [updateData.real_name] - 真实姓名
   * @param {String} [updateData.email] - 邮箱
   * @param {Number} [updateData.role_id] - 角色ID
   * @param {Number} [updateData.status] - 状态
   * @returns {Promise<Array>} 返回更新影响的行数数组
   */
  static async update(userId, updateData) {
    try {
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }
      updateData.update_time = Date.now();
      return await User.update(updateData, { where: { user_id: userId } });
    } catch (error) {
      logger.error('更新用户失败:', error);
      throw error;
    }
  }

  /**
   * 删除用户
   * @param {Number} userId - 用户ID
   * @returns {Promise<Number>} 返回删除的行数
   */
  static async delete(userId) {
    try {
      return await User.destroy({ where: { user_id: userId } });
    } catch (error) {
      logger.error('删除用户失败:', error);
      throw error;
    }
  }

  /**
   * 更新用户状态（支持批量）
   * @param {Array<Number>} userIdList - 用户ID数组
   * @param {Number} status - 状态值
   * @returns {Promise<Array>} 返回更新影响的行数数组
   */
  static async updateStatusList(userIdList, status) {
    try {
      return await User.update(
        { status: status, update_time: Date.now() },
        { where: { user_id: { [Op.in]: userIdList } } }
      );
    } catch (error) {
      logger.error('更新用户状态失败:', error);
      throw error;
    }
  }

  /**
   * 删除用户（支持批量）
   * @param {Array<Number>} userIdList - 用户ID数组
   * @returns {Promise<Number>} 返回删除的行数
   */
  static async deleteList(userIdList) {
    try {
      return await User.destroy({ where: { user_id: { [Op.in]: userIdList } } });
    } catch (error) {
      logger.error('删除用户失败:', error);
      throw error;
    }
  }

  /**
   * 修改密码
   * @param {Number} userId - 用户ID
   * @param {String} oldPassword - 原密码
   * @param {String} newPassword - 新密码
   * @returns {Promise<Array>} 返回更新影响的行数数组
   * @throws {Error} 当用户不存在或原密码错误时抛出错误
   */
  static async changePassword(userId, oldPassword, newPassword) {
    try {
      const user = await User.findByPk(userId, { attributes: ['password'], raw: true });
      if (!user) throw new Error('用户不存在');

      const isValid = await bcrypt.compare(oldPassword, user.password);
      if (!isValid) throw new Error('原密码错误');

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      return await User.update(
        { password: hashedPassword, update_time: Date.now() },
        { where: { user_id: userId } }
      );
    } catch (error) {
      logger.error('修改密码失败:', error);
      throw error;
    }
  }

  /**
   * 重置密码
   * @param {Number} userId - 用户ID
   * @param {String} newPassword - 新密码，默认为'123456'
   * @returns {Promise<Array>} 返回更新影响的行数数组
   */
  static async resetPassword(userId, newPassword = '123456') {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      return await User.update(
        { password: hashedPassword, update_time: Date.now() },
        { where: { user_id: userId } }
      );
    } catch (error) {
      logger.error('重置密码失败:', error);
      throw error;
    }
  }
}

module.exports = UserModel;
