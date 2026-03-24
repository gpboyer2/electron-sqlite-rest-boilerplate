const crypto = require('crypto');
const repository = require('./repository');
const { verifyPassword, hashPassword } = require('../../utils/password');

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

function createOpaqueToken() {
  return crypto.randomBytes(32).toString('hex');
}

function mapUser(userRow) {
  const resolvedUserId = userRow.user_id ?? userRow.id;

  return {
    id: resolvedUserId,
    username: userRow.username,
    realName: userRow.real_name,
    email: userRow.email || '',
    role: {
      id: userRow.role_id,
      code: userRow.role_code,
      name: userRow.role_name
    },
    permissions: repository.getUserPermissions(resolvedUserId)
  };
}

function cleanupExpiredSessions() {
  const now = nowInSeconds();
  repository.cleanupExpiredSessions(now, now - REFRESH_TOKEN_TTL_SECONDS);
}

function createSessionForUser(userId) {
  const current = nowInSeconds();
  const accessToken = createOpaqueToken();
  const refreshToken = createOpaqueToken();

  repository.createSession({
    id: crypto.randomUUID(),
    user_id: userId,
    access_token: accessToken,
    refresh_token: refreshToken,
    access_expires_at: current + ACCESS_TOKEN_TTL_SECONDS,
    refresh_expires_at: current + REFRESH_TOKEN_TTL_SECONDS,
    revoked_at: null,
    created_at: current
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS
  };
}

function registerUser({ username, password, realName, email }) {
  if (!username || !password) {
    throw new Error('用户名和密码不能为空');
  }

  const normalizedUsername = username.trim().toLowerCase();
  if (normalizedUsername.length < 3 || normalizedUsername.length > 24) {
    throw new Error('用户名长度必须在 3 到 24 个字符之间');
  }

  if (password.length < 6 || password.length > 64) {
    throw new Error('密码长度必须在 6 到 64 个字符之间');
  }

  const exists = repository.getUserByUsername(normalizedUsername);
  if (exists) {
    throw new Error('用户名已存在');
  }

  const viewerRole = repository.getRoleByCode('viewer');
  if (!viewerRole) {
    throw new Error('模板角色初始化失败');
  }

  repository.createUser({
    username: normalizedUsername,
    password_hash: hashPassword(password),
    real_name: realName || normalizedUsername,
    email: email || null,
    role_id: viewerRole.id,
    status: 'active',
    created_at: nowInSeconds(),
    updated_at: nowInSeconds()
  });

  return {
    username: normalizedUsername,
    role: viewerRole.code
  };
}

function loginUser({ username, password }) {
  if (!username || !password) {
    throw new Error('用户名和密码不能为空');
  }

  cleanupExpiredSessions();

  const userRow = repository.getUserByUsername(username.trim().toLowerCase());
  if (!userRow || userRow.status !== 'active') {
    throw new Error('账户不存在或已禁用');
  }

  if (!verifyPassword(password, userRow.password_hash)) {
    throw new Error('用户名或密码错误');
  }

  return {
    ...createSessionForUser(userRow.id),
    user: mapUser(userRow)
  };
}

function refreshSession(refreshToken) {
  cleanupExpiredSessions();

  const session = repository.getSessionByRefreshToken(refreshToken);
  if (!session || session.revoked_at) {
    throw new Error('刷新令牌无效');
  }

  if (session.refresh_expires_at <= nowInSeconds()) {
    throw new Error('刷新令牌已过期');
  }

  const nextTokens = createSessionForUser(session.user_id);
  repository.deleteSessionById(session.id);

  return {
    ...nextTokens,
    user: mapUser(session)
  };
}

function getCurrentUser(accessToken) {
  cleanupExpiredSessions();

  const session = repository.getSessionByAccessToken(accessToken);
  if (!session || session.revoked_at) {
    throw new Error('访问令牌无效');
  }

  if (session.access_expires_at <= nowInSeconds()) {
    throw new Error('访问令牌已过期');
  }

  if (session.status && session.status !== 'active') {
    throw new Error('用户已禁用');
  }

  return mapUser(session);
}

function revokeSessionByAccessToken(accessToken) {
  repository.revokeSessionByAccessToken(accessToken, nowInSeconds());
}

function getPublicSummary() {
  return {
    authMode: 'token-session',
    demoAccounts: [
      { username: 'admin', password: 'admin123', role: 'admin' },
      { username: 'viewer', password: 'viewer123', role: 'viewer' }
    ],
    roles: repository.listRoles(),
    permissions: repository.listPermissions(),
    users: repository.listUsers().map((user) => ({
      id: user.id,
      username: user.username,
      realName: user.real_name,
      role: {
        code: user.role_code,
        name: user.role_name
      }
    })),
    protectedRoute: '/api/auth/protected-example'
  };
}

module.exports = {
  getCurrentUser,
  getPublicSummary,
  loginUser,
  refreshSession,
  registerUser,
  revokeSessionByAccessToken
};
