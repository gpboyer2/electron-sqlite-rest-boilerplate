const log4js = require('log4js');
const path = require('path');
const fs = require('fs');

const { getCurrentDateTime } = require('../utils/time');

const YYYY_MM_DD = getCurrentDateTime('YYYY-MM-DD');

// 确定日志目录：pkg 环境使用环境变量，否则使用相对路径
const isPkg = process.pkg && typeof process.pkg.entrypoint === 'string';
const LOG_DIR = isPkg ? process.env.LOG_DIR : path.join(__dirname, '../logs');
const log_dir = path.join(LOG_DIR, YYYY_MM_DD);

// 确保日志目录存在（只在非 pkg 环境或使用可写目录时）
if (!isPkg || LOG_DIR !== path.join(__dirname, '../logs')) {
  if (!fs.existsSync(log_dir)) {
    fs.mkdirSync(log_dir, { recursive: true });
  }
}

// log4js 配置
let log_config = {
  appenders: {
    console: { type: 'console' },
    accessFile: { type: 'file', filename: path.join(log_dir, 'http-api.log') },
    debugFile: { type: 'file', filename: path.join(log_dir, 'debug.log') },
    errorFile: { type: 'file', filename: path.join(log_dir, 'error.log') },
    infoFile: { type: 'file', filename: path.join(log_dir, 'info.log') },
    webClient: { type: 'file', filename: path.join(log_dir, 'webClient.log') },
    SQL: { type: 'file', filename: path.join(log_dir, 'SQL.log') }
  },
  categories: {
    default: { appenders: ['console', 'accessFile'], level: 'debug' },
    httpApi: { appenders: ['console', 'accessFile'], level: 'info' },
    debug: { appenders: ['console', 'debugFile'], level: 'debug' },
    error: { appenders: ['console', 'errorFile'], level: 'error' },
    info: { appenders: ['console', 'infoFile'], level: 'info' },
    webClient: { appenders: ['console', 'webClient'], level: 'debug' },
    SQL: { appenders: ['console', 'SQL'], level: 'debug' }
  }
};

log4js.configure(log_config);

module.exports = log4js;
