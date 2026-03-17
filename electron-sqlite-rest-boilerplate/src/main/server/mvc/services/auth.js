/**
 * @file       auth.js
 * @brief      认证服务，处理用户登录、登出、令牌管理等相关业务逻辑
 * @date       2025-11-28
 * @copyright  Copyright (c) 2025
 */
const log4js = require('../../middleware/log4jsPlus');
const logger = log4js.getLogger('default');
const UserModel = require('../models/user');
const SessionModel = require('../models/session');
const { generateTokens, verifyRefreshToken, getUserPermissions } = require('../../middleware/auth');

class AuthService {
  /**
   * 用户登录
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @param {string} ip - IP地址
   * @param {string} userAgent - 用户代理
   * @returns {Object} 登录结果
   */
  static async login(username, password, ip = '', userAgent = '') {
    try {
      // 验证用户凭据
      const user = await UserModel.login(username, password);

      // 生成JWT令牌
      const payload = {
        userId: user.user_id,
        username: user.user_name,
        roleId: user.role_id
      };

      const { accessToken, refreshToken } = generateTokens(payload);

      // 计算过期时间（7天后，转为时间戳）
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

      // 保存用户会话
      await SessionModel.create({
        session_id: require('crypto').randomUUID(),
        user_id: user.user_id,
        token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        ip_address: ip || '',
        user_agent: userAgent || '',
        create_time: Date.now(),
        status: 1
      });

      // 获取用户权限
      const permissions = await getUserPermissions(user.user_id);

      // 返回用户信息（排除密码）
      const userInfo = {
        id: user.user_id,
        username: user.user_name,
        realName: user.real_name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        roleId: user.role_id,
        permissions: permissions
      };

      return {
        accessToken,
        refreshToken,
        expiresIn: 24 * 60 * 60, // 24小时（秒）
        user: userInfo
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 用户登出
   * @param {string} token - 访问令牌
   */
  static async logout(token) {
    try {
      await SessionModel.revoke(token);
      return true;
    } catch (error) {
      logger.error('登出失败:', error);
      throw error;
    }
  }

  /**
   * 刷新访问令牌
   * @param {string} refreshToken - 刷新令牌
   * @returns {Object} 新的令牌信息
   */
  static async refreshToken(refreshToken) {
    try {
      // 验证刷新令牌
      const decoded = verifyRefreshToken(refreshToken);

      if (decoded.type !== 'refresh') {
        throw new Error('无效的刷新令牌类型');
      }

      // 获取用户信息
      const user = await UserModel.findByUserId(decoded.userId);
      if (!user || user.status !== 1) {
        throw new Error('用户不存在或已禁用');
      }

      // 生成新的访问令牌
      const payload = {
        userId: user.user_id,
        username: user.user_name,
        roleId: user.role_id
      };

      const { accessToken: newAccessToken } = generateTokens(payload);

      // 创建新会话
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

      await SessionModel.create({
        session_id: require('crypto').randomUUID(),
        user_id: user.user_id,
        token: newAccessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        create_time: Date.now(),
        status: 1
      });

      return {
        accessToken: newAccessToken,
        expiresIn: 24 * 60 * 60
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取当前用户信息
   * @param {number} userId - 用户ID
   * @returns {Object} 用户信息
   */
  static async getCurrentUser(userId) {
    try {
      const user = await UserModel.findByUserId(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      // 获取用户权限
      const permissions = await getUserPermissions(userId);

      return {
        id: user.user_id,
        username: user.user_name,
        realName: user.real_name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        roleId: user.role_id,
        roleName: user.role_name,
        roleCode: user.role_code,
        status: user.status,
        createTime: user.create_time,
        lastLoginTime: user.last_login_time,
        permissions: permissions
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 修改密码
   * @param {number} userId - 用户ID
   * @param {string} oldPassword - 旧密码
   * @param {string} newPassword - 新密码
   * @param {string} currentToken - 当前会话token（不注销当前会话）
   */
  static async changePassword(userId, oldPassword, newPassword, currentToken = null) {
    try {
      console.log('[AuthService] 修改密码开始 - UserId:', userId);
      await UserModel.changePassword(userId, oldPassword, newPassword);

      // 注销该用户的其他会话（保留当前会话）
      console.log('[AuthService] 注销其他会话 - UserId:', userId, '当前Token保留');
      await SessionModel.revokeByUserIdExcept(userId, currentToken);

      console.log('[AuthService] 修改密码完成 - UserId:', userId);
      return true;
    } catch (error) {
      console.log('[AuthService] 修改密码失败 - UserId:', userId, 'Error:', error.message);
      throw error;
    }
  }
}

module.exports = AuthService;
