const { and, asc, eq, isNotNull, lt, or } = require('drizzle-orm');
const { db, schema } = require('../../database/database');

const {
  template_permissions,
  template_role_permissions,
  template_roles,
  template_sessions,
  template_users
} = schema;

function getRoleByCode(code) {
  return db.select().from(template_roles).where(eq(template_roles.code, code)).limit(1).get();
}

function getUserPermissions(userId) {
  return db
    .select({
      code: template_permissions.code
    })
    .from(template_permissions)
    .innerJoin(
      template_role_permissions,
      eq(template_role_permissions.permission_id, template_permissions.id)
    )
    .innerJoin(template_users, eq(template_users.role_id, template_role_permissions.role_id))
    .where(eq(template_users.id, userId))
    .orderBy(asc(template_permissions.code))
    .all()
    .map((row) => row.code);
}

function getUserByUsername(username) {
  return db
    .select({
      id: template_users.id,
      username: template_users.username,
      password_hash: template_users.password_hash,
      real_name: template_users.real_name,
      email: template_users.email,
      role_id: template_users.role_id,
      status: template_users.status,
      created_at: template_users.created_at,
      updated_at: template_users.updated_at,
      role_name: template_roles.name,
      role_code: template_roles.code
    })
    .from(template_users)
    .innerJoin(template_roles, eq(template_roles.id, template_users.role_id))
    .where(eq(template_users.username, username))
    .limit(1)
    .get();
}

function getSessionByAccessToken(accessToken) {
  return db
    .select({
      id: template_sessions.id,
      user_id: template_users.id,
      access_token: template_sessions.access_token,
      refresh_token: template_sessions.refresh_token,
      access_expires_at: template_sessions.access_expires_at,
      refresh_expires_at: template_sessions.refresh_expires_at,
      revoked_at: template_sessions.revoked_at,
      created_at: template_sessions.created_at,
      username: template_users.username,
      real_name: template_users.real_name,
      email: template_users.email,
      status: template_users.status,
      role_id: template_users.role_id,
      role_code: template_roles.code,
      role_name: template_roles.name
    })
    .from(template_sessions)
    .innerJoin(template_users, eq(template_users.id, template_sessions.user_id))
    .innerJoin(template_roles, eq(template_roles.id, template_users.role_id))
    .where(eq(template_sessions.access_token, accessToken))
    .limit(1)
    .get();
}

function getSessionByRefreshToken(refreshToken) {
  return db
    .select({
      id: template_sessions.id,
      user_id: template_users.id,
      access_token: template_sessions.access_token,
      refresh_token: template_sessions.refresh_token,
      access_expires_at: template_sessions.access_expires_at,
      refresh_expires_at: template_sessions.refresh_expires_at,
      revoked_at: template_sessions.revoked_at,
      created_at: template_sessions.created_at,
      username: template_users.username,
      real_name: template_users.real_name,
      email: template_users.email,
      status: template_users.status,
      role_id: template_users.role_id,
      role_code: template_roles.code,
      role_name: template_roles.name
    })
    .from(template_sessions)
    .innerJoin(template_users, eq(template_users.id, template_sessions.user_id))
    .innerJoin(template_roles, eq(template_roles.id, template_users.role_id))
    .where(eq(template_sessions.refresh_token, refreshToken))
    .limit(1)
    .get();
}

function listRoles() {
  return db
    .select({
      id: template_roles.id,
      name: template_roles.name,
      code: template_roles.code,
      description: template_roles.description
    })
    .from(template_roles)
    .orderBy(asc(template_roles.id))
    .all();
}

function listPermissions() {
  return db
    .select({
      id: template_permissions.id,
      name: template_permissions.name,
      code: template_permissions.code,
      description: template_permissions.description
    })
    .from(template_permissions)
    .orderBy(asc(template_permissions.id))
    .all();
}

function listUsers() {
  return db
    .select({
      id: template_users.id,
      username: template_users.username,
      real_name: template_users.real_name,
      role_code: template_roles.code,
      role_name: template_roles.name
    })
    .from(template_users)
    .innerJoin(template_roles, eq(template_roles.id, template_users.role_id))
    .orderBy(asc(template_users.id))
    .all();
}

function createUser(data) {
  return db.insert(template_users).values(data).run();
}

function createSession(data) {
  return db.insert(template_sessions).values(data).run();
}

function deleteSessionById(id) {
  return db.delete(template_sessions).where(eq(template_sessions.id, id)).run();
}

function revokeSessionByAccessToken(accessToken, revokedAt) {
  return db
    .update(template_sessions)
    .set({ revoked_at: revokedAt })
    .where(eq(template_sessions.access_token, accessToken))
    .run();
}

function cleanupExpiredSessions(now, revokedBefore) {
  return db
    .delete(template_sessions)
    .where(
      or(
        lt(template_sessions.refresh_expires_at, now),
        and(isNotNull(template_sessions.revoked_at), lt(template_sessions.revoked_at, revokedBefore))
      )
    )
    .run();
}

module.exports = {
  getRoleByCode,
  getUserPermissions,
  getUserByUsername,
  getSessionByAccessToken,
  getSessionByRefreshToken,
  listRoles,
  listPermissions,
  listUsers,
  createUser,
  createSession,
  deleteSessionById,
  revokeSessionByAccessToken,
  cleanupExpiredSessions
};
