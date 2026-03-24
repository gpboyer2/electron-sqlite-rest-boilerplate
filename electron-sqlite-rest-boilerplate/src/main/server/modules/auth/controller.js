const authService = require('./service');

function getPublicSummary(_req, res) {
  res.apiSuccess(
    authService.getPublicSummary(),
    '模板认证示例公开信息，可直接用于演示注册、登录和权限控制'
  );
}

function register(req, res) {
  try {
    res.apiSuccess(
      authService.registerUser({
        username: req.body.username,
        password: req.body.password,
        realName: req.body.realName,
        email: req.body.email
      }),
      '注册成功，默认分配 viewer 角色'
    );
  } catch (error) {
    res.apiError(null, error.message);
  }
}

function login(req, res) {
  try {
    res.apiSuccess(
      authService.loginUser({
        username: req.body.username,
        password: req.body.password
      }),
      '登录成功'
    );
  } catch (error) {
    res.apiError(null, error.message);
  }
}

function refresh(req, res) {
  try {
    res.apiSuccess(authService.refreshSession(req.body.refreshToken), '刷新成功');
  } catch (error) {
    res.apiError(null, error.message);
  }
}

function logout(req, res) {
  authService.revokeSessionByAccessToken(req.templateAuth.accessToken);
  res.apiSuccess(null, '已退出登录');
}

function me(req, res) {
  res.apiSuccess(req.templateAuth.user, '获取当前用户成功');
}

function protectedExample(req, res) {
  res.apiSuccess(
    {
      message: '这是模板里唯一默认受限的示例接口',
      currentUser: req.templateAuth.user,
      hint: '你可以把现有的业务接口替换到这里，继续扩展真正的 RBAC'
    },
    '受限接口访问成功'
  );
}

module.exports = {
  getPublicSummary,
  register,
  login,
  refresh,
  logout,
  me,
  protectedExample
};
