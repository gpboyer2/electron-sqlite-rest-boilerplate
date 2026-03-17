/**
 * @file       auth.js
 * @brief      用户认证控制器，负责处理用户登录、登出、令牌刷新等认证相关的HTTP请求
 * @date       2025-11-28
 * @copyright  Copyright (c) 2025
 */

const AuthService = require('../services/auth');
const { hasControlCharacter } = require('../../utils/string');

// 环境变量配置
const BYPASS_AUTH = process.env.BYPASS_AUTH === 'true';

class AuthController {
  /**
   * 用户登录
   * @param {Object} req - Express请求对象
   * @param {Object} req.body - 请求体
   * @param {string} req.body.username - 用户名
   * @param {string} req.body.password - 密码
   * @param {Object} res - Express响应对象
   * @returns {void} 返回登录结果（包含访问令牌、刷新令牌和用户信息）
   */
  static async login(req, res) {
    const { username, password } = req.body;

    try {
      console.log(
        '[AuthController] 登录请求 - Username:',
        username,
        'Password length:',
        password?.length
      );

      // 参数校验（即使在测试模式下也必须校验）
      // 检查参数存在性
      if (
        username === undefined ||
        username === null ||
        password === undefined ||
        password === null
      ) {
        console.log('[AuthController] 登录失败 - 缺少必要参数');
        return res.apiError(null, '用户名和密码不能为空');
      }

      // 检查参数类型
      if (typeof username !== 'string' || typeof password !== 'string') {
        console.log('[AuthController] 登录失败 - 参数类型错误');
        return res.apiError(null, '用户名和密码必须是字符串');
      }

      // 检查空字符串（去除首尾空格后）
      const trimmedUsername = username.trim();
      const trimmedPassword = password.trim();

      if (trimmedUsername === '' || trimmedPassword === '') {
        console.log('[AuthController] 登录失败 - 用户名或密码为空字符串');
        return res.apiError(null, '用户名和密码不能为空');
      }

      // 检查长度限制
      if (trimmedUsername.length < 3 || trimmedUsername.length > 50) {
        console.log('[AuthController] 登录失败 - 用户名长度不符合要求');
        return res.apiError(null, '用户名长度必须在3-50个字符之间');
      }

      if (trimmedPassword.length < 6 || trimmedPassword.length > 100) {
        console.log('[AuthController] 登录失败 - 密码长度不符合要求');
        return res.apiError(null, '密码长度必须在6-100个字符之间');
      }

      // 使用工具函数检查控制字符
      if (hasControlCharacter(trimmedUsername) || hasControlCharacter(trimmedPassword)) {
        console.log('[AuthController] 登录失败 - 包含非法控制字符');
        return res.apiError(null, '用户名或密码包含非法字符');
      }

      // 测试模式（BYPASS_AUTH）：跳过认证，直接返回超级管理员
      if (BYPASS_AUTH) {
        console.log('[AuthController] 测试模式 - 跳过认证');
        const { generateTokens } = require('../../middleware/auth');
        const tokens = generateTokens({ userId: 1, username: trimmedUsername });
        res.apiSuccess(
          {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
              id: 1,
              username: trimmedUsername,
              realName: '测试超级管理员',
              email: 'test@admin.com',
              roleId: 1,
              roleName: '超级管理员',
              roleCode: 'admin',
              status: 1,
              permissions: ['*']
            }
          },
          '登录成功'
        );
        return;
      }

      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.login(trimmedUsername, trimmedPassword, ip, userAgent);

      console.log(
        '[AuthController] 登录成功 - Username:',
        trimmedUsername,
        'Token前缀:',
        result.accessToken.substring(0, 20) + '...'
      );
      res.apiSuccess(result, '登录成功');
    } catch (error) {
      console.log(
        '[AuthController] 登录失败 - Username:',
        username || '(null)',
        'Error:',
        error.message
      );
      res.apiError(null, error.message);
    }
  }

  /**
   * 用户登出
   * @param {Object} req - Express请求对象
   * @param {Object} req.headers - 请求头
   * @param {string} req.headers.authorization - Authorization认证头（Bearer Token）
   * @param {Object} res - Express响应对象
   * @returns {void} 返回登出结果
   */
  static async logout(req, res) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      // 允许未登录状态退出（幂等操作）
      if (token) {
        await AuthService.logout(token);
      }

      res.apiSuccess(null, '登出成功');
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 刷新访问令牌
   * @param {Object} req - Express请求对象
   * @param {Object} req.body - 请求体
   * @param {string} req.body.refreshToken - 刷新令牌
   * @param {Object} res - Express响应对象
   * @returns {void} 返回新的访问令牌和刷新令牌
   */
  static async refresh(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.apiError(null, '刷新令牌不能为空');
      }

      const result = await AuthService.refreshToken(refreshToken);

      res.apiSuccess(result, '令牌刷新成功');
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 获取当前用户信息
   * @param {Object} req - Express请求对象
   * @param {Object} req.user - 认证用户信息（由中间件注入）
   * @param {number} req.user.id - 用户ID
   * @param {Object} res - Express响应对象
   * @returns {void} 返回用户详细信息
   */
  static async me(req, res) {
    try {
      const userId = req.user.id;
      const userInfo = await AuthService.getCurrentUser(userId);

      res.apiSuccess(userInfo);
    } catch (error) {
      res.apiError(null, error.message);
    }
  }

  /**
   * 修改密码
   * @param {Object} req - Express请求对象
   * @param {Object} req.user - 认证用户信息（由中间件注入）
   * @param {number} req.user.id - 用户ID
   * @param {Object} req.body - 请求体
   * @param {string} req.body.oldPassword - 旧密码
   * @param {string} req.body.newPassword - 新密码
   * @param {Object} req.headers - 请求头
   * @param {string} req.headers.authorization - Authorization认证头（Bearer Token）
   * @param {Object} res - Express响应对象
   * @returns {void} 返回密码修改结果
   */
  static async changePassword(req, res) {
    try {
      const userId = req.user.id;
      const { oldPassword, newPassword } = req.body;
      const authHeader = req.headers.authorization;
      const currentToken = authHeader && authHeader.split(' ')[1];

      if (!oldPassword || !newPassword) {
        return res.apiError(null, '旧密码和新密码不能为空');
      }

      if (newPassword.length < 6) {
        return res.apiError(null, '新密码长度不能少于6位');
      }

      // 传递当前 token，修改密码时不注销当前会话
      await AuthService.changePassword(userId, oldPassword, newPassword, currentToken);

      res.apiSuccess(null, '密码修改成功');
    } catch (error) {
      res.apiError(null, error.message);
    }
  }
}

module.exports = AuthController;
