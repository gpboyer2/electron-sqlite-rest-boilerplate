const { sqliteTable, integer, real, text, uniqueIndex } = require('drizzle-orm/sqlite-core');

const system_stats = sqliteTable('system_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cpu_usage: real('cpu_usage').notNull().default(0),
  memory_usage: real('memory_usage').notNull().default(0),
  memory_total: integer('memory_total').notNull().default(0),
  memory_used: integer('memory_used').notNull().default(0),
  disk_usage: real('disk_usage').notNull().default(0),
  disk_total: integer('disk_total').notNull().default(0),
  disk_used: integer('disk_used').notNull().default(0),
  network_rx: integer('network_rx').notNull().default(0),
  network_tx: integer('network_tx').notNull().default(0),
  recorded_at: integer('recorded_at').notNull()
});

const process_info = sqliteTable('process_info', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pid: integer('pid').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull().default('running'),
  cpu_usage: real('cpu_usage').notNull().default(0),
  memory_usage: real('memory_usage').notNull().default(0),
  memory_bytes: integer('memory_bytes').notNull().default(0),
  started_at: text('started_at'),
  command: text('command'),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull()
});

const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull(),
  value: text('value'),
  description: text('description'),
  updated_at: integer('updated_at').notNull()
});

const about_info = sqliteTable('about_info', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  app_name: text('app_name').notNull(),
  version: text('version').notNull(),
  description: text('description'),
  author: text('author'),
  license: text('license'),
  updated_at: integer('updated_at').notNull()
});

const template_roles = sqliteTable('template_roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  code: text('code').notNull(),
  description: text('description'),
  created_at: integer('created_at').notNull()
}, (table) => [
  uniqueIndex('template_roles_code_unique').on(table.code)
]);

const template_permissions = sqliteTable('template_permissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  code: text('code').notNull(),
  description: text('description'),
  created_at: integer('created_at').notNull()
}, (table) => [
  uniqueIndex('template_permissions_code_unique').on(table.code)
]);

const template_role_permissions = sqliteTable('template_role_permissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  role_id: integer('role_id').notNull(),
  permission_id: integer('permission_id').notNull()
}, (table) => [
  uniqueIndex('template_role_permissions_unique').on(table.role_id, table.permission_id)
]);

const template_users = sqliteTable('template_users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  password_hash: text('password_hash').notNull(),
  real_name: text('real_name'),
  email: text('email'),
  role_id: integer('role_id').notNull(),
  status: text('status').notNull().default('active'),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at').notNull()
}, (table) => [
  uniqueIndex('template_users_username_unique').on(table.username)
]);

const template_sessions = sqliteTable('template_sessions', {
  id: text('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  access_token: text('access_token').notNull(),
  refresh_token: text('refresh_token').notNull(),
  access_expires_at: integer('access_expires_at').notNull(),
  refresh_expires_at: integer('refresh_expires_at').notNull(),
  revoked_at: integer('revoked_at'),
  created_at: integer('created_at').notNull()
}, (table) => [
  uniqueIndex('template_sessions_access_token_unique').on(table.access_token),
  uniqueIndex('template_sessions_refresh_token_unique').on(table.refresh_token)
]);

module.exports = {
  about_info,
  process_info,
  settings,
  system_stats,
  template_permissions,
  template_role_permissions,
  template_roles,
  template_sessions,
  template_users
};
