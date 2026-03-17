/**
 * SQLite 数据库配置和管理
 *
 * 【强制约束】本项目必须使用 better-sqlite3，禁止使用 Sequelize 或其他 ORM
 *
 * 基于 better-sqlite3 的数据库操作层，提供：
 * - 数据库连接配置和初始化
 * - 同步的数据库操作接口
 *
 * 开发阶段数据库索引规范（重要）：
 * - 禁止在 Sequelize 模型中定义任何索引（indexes 配置）
 * - 禁止在代码中手动创建索引
 * - 只保留主键索引（PRIMARY KEY），其余索引全部删除
 * - 生产环境部署时再根据性能需求添加必要索引
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const log4js = require('log4js');
const logger = log4js.getLogger('default');

// 环境变量配置
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDev = NODE_ENV !== 'production';
const isTest = NODE_ENV === 'test';

// 数据库路径配置
let dbPath;
if (process.env.DATABASE_PATH) {
  dbPath = process.env.DATABASE_PATH;
} else {
  const dbFileName = isTest ? 'electron-boilerplate-test.db' : 'electron-boilerplate.db';
  dbPath = path.join(__dirname, '../data', dbFileName);
}

// 确保 data 目录存在
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * 【强制约束】必须使用 better-sqlite3 创建数据库连接
 * 禁止使用：sequelize, sqlite3, knex 等其他库
 */
const db = new Database(dbPath);

// 启用 WAL 模式提升并发性能
db.pragma('journal_mode = WAL');

// 禁用外键约束
db.pragma('foreign_keys = OFF');

// 打印 SQL 语句（仅开发环境）
db.pragma('verbose', isDev ? console.log : null);

/**
 * 初始化数据库表结构
 * 使用 better-sqlite3 的同步 API 创建表
 * 注意：开发阶段不定义任何索引
 * @returns {void}
 */
function initDatabase() {
  // 1. 系统统计历史表（用于仪表盘图表）
  // 注意：开发阶段不创建索引，只保留主键索引
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cpu_usage REAL NOT NULL DEFAULT 0,
      memory_usage REAL NOT NULL DEFAULT 0,
      memory_total INTEGER NOT NULL DEFAULT 0,
      memory_used INTEGER NOT NULL DEFAULT 0,
      disk_usage REAL NOT NULL DEFAULT 0,
      disk_total INTEGER NOT NULL DEFAULT 0,
      disk_used INTEGER NOT NULL DEFAULT 0,
      network_rx INTEGER NOT NULL DEFAULT 0,
      network_tx INTEGER NOT NULL DEFAULT 0,
      recorded_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `);

  // 2. 进程信息表
  // 注意：开发阶段不创建索引，只保留主键索引
  db.exec(`
    CREATE TABLE IF NOT EXISTS process_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pid INTEGER NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      cpu_usage REAL NOT NULL DEFAULT 0,
      memory_usage REAL NOT NULL DEFAULT 0,
      memory_bytes INTEGER NOT NULL DEFAULT 0,
      started_at TEXT,
      command TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `);

  // 3. 设置表
  // 注意：开发阶段不创建 UNIQUE 索引，只保留主键索引
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      value TEXT,
      description TEXT,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `);

  // 4. 初始化默认设置
  const defaultSettings = [
    { key: 'machine_id', value: '', description: '机器ID' },
    { key: 'theme', value: 'light', description: '主题：light/dark' },
    { key: 'language', value: 'zh-CN', description: '语言：zh-CN/en' },
    { key: 'api_port', value: '9200', description: 'REST API 端口' }
  ];

  for (const setting of defaultSettings) {
    db.prepare('INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)').run(
      setting.key,
      setting.value,
      setting.description
    );
  }

  // 5. 关于信息表
  db.exec(`
    CREATE TABLE IF NOT EXISTS about_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_name TEXT NOT NULL DEFAULT 'Electron Boilerplate',
      version TEXT NOT NULL DEFAULT '1.0.0',
      description TEXT,
      author TEXT,
      license TEXT,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `);

  // 初始化默认关于信息
  const aboutExists = db.prepare('SELECT COUNT(*) as count FROM about_info').get();
  if (aboutExists.count === 0) {
    db.prepare(
      `
      INSERT INTO about_info (app_name, version, description, author, license)
      VALUES (?, ?, ?, ?, ?)
    `
    ).run(
      'Electron Boilerplate',
      '1.0.0',
      'Electron + SQLite + REST API Desktop Application',
      '开发者',
      'AGPL-3.0'
    );
  }

  logger.info(`[DB] SQLite 数据库初始化完成: ${dbPath}`);
}

/**
 * 测试数据库连接
 * @returns {boolean} 连接成功返回 true
 */
function testConnection() {
  try {
    db.prepare('SELECT 1 as test').get();
    logger.info('[DB] better-sqlite3 数据库连接成功');
    return true;
  } catch (error) {
    logger.error('[DB] better-sqlite3 数据库连接失败:', error.message);
    throw error;
  }
}

/**
 * 关闭数据库连接
 * @returns {void}
 */
function closeDatabase() {
  if (db) {
    db.close();
    logger.info('[DB] 数据库连接已关闭');
  }
}

// 初始化数据库
initDatabase();

module.exports = {
  db,
  testConnection,
  closeDatabase
};
