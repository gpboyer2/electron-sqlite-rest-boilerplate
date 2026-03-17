const jwt = require('jsonwebtoken');
const log4js = require('../middleware/log4jsPlus');
const logger = log4js.getLogger('default');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// 测试模式：跳过认证，直接给予最高权限
// 设置环境变量 BYPASS_AUTH=true 即可启用
const BYPASS_AUTH = process.env.BYPASS_AUTH === 'true';

// 测试模式下的模拟超级管理员用户
const MOCK_SUPER_USER = {
  id: 1,
  username: 'test_admin',
  realName: '测试超级管理员',
  email: 'test@admin.com',
  roleId: 1, // 超级管理员拥有所有权限
  permissions: ['*'] // 全部权限
};

/**
 * JWT认证中间件
 */
const authenticateToken = async (req, res, next) => {
  try {
    // 测试模式：跳过所有认证，直接使用超级管理员身份
    if (BYPASS_AUTH) {
      console.log('[Auth] 测试模式 - 跳过认证，使用超级管理员身份 - URL:', req.url);
      req.user = { ...MOCK_SUPER_USER };
      return next();
    }

    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    // 检查 token 是否缺失
    if (!token) {
      console.log('[Auth] Token缺失 - URL:', req.url);
      return res.apiError(null, '无效的访问令牌');
    }

    // 检查 token 是否为空字符串（明显无效）
    // eslint-disable-next-line security/detect-possible-timing-attacks
    if (token === '') {
      console.log('[Auth] Token为空字符串 - URL:', req.url);
      return res.apiError(null, '无效的访问令牌');
    }

    // 检查 token 格式是否明显错误（JWT 应该有两个点）
    if (!token.includes('.') || token.split('.').length !== 3) {
      console.log('[Auth] Token格式错误 - URL:', req.url);
      return res.apiError(null, '无效的访问令牌');
    }

    // 验证JWT
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      console.log('[Auth] JWT验证失败 - URL:', req.url, 'Error:', jwtError.name);
      throw jwtError;
    }

    // 延迟加载 Model，避免循环依赖
    const SessionModel = require('../mvc/models/session');
    const UserModel = require('../mvc/models/user');

    // 检查token是否在黑名单中
    const session = await SessionModel.findByToken(token);
    if (session && session.status === 0) {
      console.log('[Auth] Session已被注销 - URL:', req.url, 'UserId:', decoded.userId);
      return res.apiError(null, '无效的访问令牌');
    }
    if (!session) {
      console.log('[Auth] Session不存在 - URL:', req.url, 'UserId:', decoded.userId);
    }

    // 获取用户信息
    const user = await UserModel.findByUserId(decoded.userId);
    if (!user || user.status !== 1) {
      return res.apiError(null, '用户不存在或已禁用');
    }

    // 获取用户权限
    const permissions = await getUserPermissions(user.user_id);

    req.user = {
      id: user.user_id,
      username: user.user_name,
      realName: user.real_name,
      email: user.email,
      roleId: user.role_id,
      permissions: permissions
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.apiError(null, '无效的访问令牌');
    } else if (error.name === 'JsonWebTokenError') {
      return res.apiError(null, '无效的访问令牌');
    } else {
      logger.error('认证中间件错误:', error);
      return res.apiError(null, '服务器内部错误');
    }
  }
};

/**
 * 权限检查中间件
 * @param {string|Array} permissionCodes - 权限代码
 */
const checkPermission = (permissionCodes) => {
  const permissions = Array.isArray(permissionCodes) ? permissionCodes : [permissionCodes];

  return (req, res, next) => {
    if (!req.user) {
      return res.apiError(null, '未认证');
    }

    // 超级管理员拥有所有权限
    if (req.user.roleId === 1) {
      return next();
    }

    // 检查用户是否拥有所需权限
    const hasPermission = permissions.some((code) => req.user.permissions.includes(code));

    if (!hasPermission) {
      return res.apiError(null, '权限不足');
    }

    next();
  };
};

/**
 * 获取用户权限列表
 * @param {number} userId - 用户ID
 * @returns {Array} 权限代码列表
 */
const getUserPermissions = async (userId) => {
  try {
    const PermissionModel = require('../mvc/models/permission');
    return await PermissionModel.findByUserId(userId);
  } catch (error) {
    logger.error('获取用户权限失败:', error);
    return [];
  }
};

/**
 * 生成JWT令牌
 * @param {Object} payload - 载荷数据
 * @returns {Object} 包含accessToken和refreshToken的对象
 */
const generateTokens = (payload) => {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ userId: payload.userId, type: 'refresh' }, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN
  });

  return { accessToken, refreshToken };
};

/**
 * 验证刷新令牌
 * @param {string} refreshToken - 刷新令牌
 * @returns {Object} 解码后的载荷
 */
const verifyRefreshToken = (refreshToken) => {
  try {
    return jwt.verify(refreshToken, JWT_SECRET);
  } catch (error) {
    throw new Error('无效的刷新令牌');
  }
};

/**
 * 清理过期会话
 */
const cleanExpiredSessions = async () => {
  try {
    const SessionModel = require('../mvc/models/session');
    await SessionModel.deleteExpired();
  } catch (error) {
    logger.error('清理过期会话失败:', error);
  }
};

module.exports = {
  authenticateToken,
  checkPermission,
  getUserPermissions,
  generateTokens,
  verifyRefreshToken,
  cleanExpiredSessions
};
