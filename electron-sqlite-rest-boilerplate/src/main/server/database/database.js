/**
 * SQLite 数据库配置和管理
 *
 * 【强制约束】本项目使用 better-sqlite3 + drizzle-orm/better-sqlite3
 *
 * 基于 better-sqlite3 和 Drizzle ORM 的数据库操作层，提供：
 * - 数据库连接配置和初始化
 * - 运行时自动执行迁移
 * - 模板级默认数据 seed
 */

const Database = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
const { eq, sql } = require('drizzle-orm');
const path = require('path');
const fs = require('fs');
const log4js = require('log4js');
const { hashPassword } = require('../utils/password');
const schema = require('./schema');

const {
  about_info,
  settings,
  template_permissions,
  template_role_permissions,
  template_roles,
  template_users
} = schema;

const logger = log4js.getLogger('default');

const NODE_ENV = process.env.NODE_ENV || 'development';
const isDev = NODE_ENV !== 'production';
const isTest = NODE_ENV === 'test';
const defaultRuntimeRoot = path.resolve(__dirname, '../../../../.runtime/embedded-api');

let dbPath;
if (process.env.DATABASE_PATH) {
  dbPath = process.env.DATABASE_PATH;
} else {
  const dbFileName = isTest ? 'electron-boilerplate-test.db' : 'electron-boilerplate.db';
  dbPath = path.join(defaultRuntimeRoot, 'storage', dbFileName);
}

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const migrationsFolder = path.join(__dirname, 'migrations');

const sqlite = new Database(dbPath, isDev ? { verbose: console.log } : undefined);
const db = drizzle(sqlite, { schema });

sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = OFF');

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

function runMigrations() {
  migrate(db, { migrationsFolder });
  logger.info(`[DB] Drizzle migrations applied: ${migrationsFolder}`);
}

function seedDefaultSettings() {
  const defaultSettings = [
    { key: 'machine_id', value: '', description: '机器ID' },
    { key: 'theme', value: 'light', description: '主题：light/dark' },
    { key: 'language', value: 'zh-CN', description: '语言：zh-CN/en' },
    { key: 'api_port', value: '9200', description: 'REST API 端口' },
    { key: 'auth_demo_enabled', value: 'true', description: '是否启用模板认证演示' }
  ];

  defaultSettings.forEach((item) => {
    const exists = db
      .select({ id: settings.id })
      .from(settings)
      .where(eq(settings.key, item.key))
      .limit(1)
      .get();

    if (!exists) {
      db
        .insert(settings)
        .values({
          ...item,
          updated_at: nowInSeconds()
        })
        .run();
    }
  });
}

function seedAboutInfo() {
  const total = Number(
    db
      .select({
        count: sql`count(*)`
      })
      .from(about_info)
      .get().count
  );

  if (total > 0) {
    return;
  }

  db
    .insert(about_info)
    .values({
      app_name: 'Electron Boilerplate',
      version: '1.0.0',
      description: 'Electron + SQLite + REST API Desktop Application',
      author: '开发者',
      license: 'AGPL-3.0',
      updated_at: nowInSeconds()
    })
    .run();
}

function seedTemplateAuthData() {
  const seedTime = nowInSeconds();

  const defaultRoles = [
    { name: 'Template Admin', code: 'admin', description: '模板管理员，可访问受限示例接口' },
    { name: 'Template Viewer', code: 'viewer', description: '模板访客，仅访问公开接口' }
  ];

  defaultRoles.forEach((role) => {
    db
      .insert(template_roles)
      .values({
        ...role,
        created_at: seedTime
      })
      .onConflictDoNothing()
      .run();
  });

  const defaultPermissions = [
    {
      name: 'Access Protected Example',
      code: 'template.example.access',
      description: '访问模板中的受限示例接口'
    },
    {
      name: 'Manage Protected Example',
      code: 'template.example.manage',
      description: '管理模板中的受限示例能力'
    }
  ];

  defaultPermissions.forEach((permission) => {
    db
      .insert(template_permissions)
      .values({
        ...permission,
        created_at: seedTime
      })
      .onConflictDoNothing()
      .run();
  });

  const adminRole = db
    .select({ id: template_roles.id })
    .from(template_roles)
    .where(eq(template_roles.code, 'admin'))
    .limit(1)
    .get();
  const accessPermission = db
    .select({ id: template_permissions.id })
    .from(template_permissions)
    .where(eq(template_permissions.code, 'template.example.access'))
    .limit(1)
    .get();
  const managePermission = db
    .select({ id: template_permissions.id })
    .from(template_permissions)
    .where(eq(template_permissions.code, 'template.example.manage'))
    .limit(1)
    .get();

  if (adminRole && accessPermission) {
    db
      .insert(template_role_permissions)
      .values({
        role_id: adminRole.id,
        permission_id: accessPermission.id
      })
      .onConflictDoNothing()
      .run();
  }

  if (adminRole && managePermission) {
    db
      .insert(template_role_permissions)
      .values({
        role_id: adminRole.id,
        permission_id: managePermission.id
      })
      .onConflictDoNothing()
      .run();
  }

  const defaultUsers = [
    {
      username: 'admin',
      password: 'admin123',
      realName: '模板管理员',
      email: 'admin@example.com',
      roleCode: 'admin'
    },
    {
      username: 'viewer',
      password: 'viewer123',
      realName: '模板访客',
      email: 'viewer@example.com',
      roleCode: 'viewer'
    }
  ];

  defaultUsers.forEach((user) => {
    const exists = db
      .select({ id: template_users.id })
      .from(template_users)
      .where(eq(template_users.username, user.username))
      .limit(1)
      .get();
    const role = db
      .select({ id: template_roles.id })
      .from(template_roles)
      .where(eq(template_roles.code, user.roleCode))
      .limit(1)
      .get();

    if (!exists && role) {
      db
        .insert(template_users)
        .values({
          username: user.username,
          password_hash: hashPassword(user.password),
          real_name: user.realName,
          email: user.email,
          role_id: role.id,
          status: 'active',
          created_at: seedTime,
          updated_at: seedTime
        })
        .run();
    }
  });
}

function seedTemplateData() {
  seedDefaultSettings();
  seedAboutInfo();
  seedTemplateAuthData();
}

function initDatabase() {
  runMigrations();
  seedTemplateData();
  logger.info(`[DB] SQLite 数据库初始化完成: ${dbPath}`);
}

function testConnection() {
  try {
    sqlite.prepare('SELECT 1 as test').get();
    logger.info('[DB] better-sqlite3 + drizzle 数据库连接成功');
    return true;
  } catch (error) {
    logger.error('[DB] better-sqlite3 + drizzle 数据库连接失败:', error.message);
    throw error;
  }
}

function closeDatabase() {
  if (sqlite) {
    sqlite.close();
    logger.info('[DB] 数据库连接已关闭');
  }
}

initDatabase();

module.exports = {
  db,
  dbPath,
  migrationsFolder,
  schema,
  sqlite,
  testConnection,
  closeDatabase
};
