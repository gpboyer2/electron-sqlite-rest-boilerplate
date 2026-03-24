const { getCurrentUser } = require('../modules/auth/service');

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return '';
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return '';
  }

  return token;
}

function authenticateTemplateUser(req, res, next) {
  try {
    const accessToken = getBearerToken(req);
    if (!accessToken) {
      return res.apiError(null, '请先登录模板示例账号');
    }

    req.templateAuth = {
      accessToken,
      user: getCurrentUser(accessToken)
    };
    return next();
  } catch (error) {
    return res.apiError(null, error.message || '认证失败');
  }
}

function requireTemplatePermission(permissionCode) {
  return (req, res, next) => {
    if (!req.templateAuth?.user) {
      return res.apiError(null, '请先登录模板示例账号');
    }

    const permissions = req.templateAuth.user.permissions || [];
    if (!permissions.includes(permissionCode)) {
      return res.apiError(null, '当前账号没有示例权限');
    }

    return next();
  };
}

module.exports = {
  authenticateTemplateUser,
  requireTemplatePermission
};
