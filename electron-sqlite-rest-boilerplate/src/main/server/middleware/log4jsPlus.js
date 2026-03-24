const log4js = require('log4js');
const path = require('path');
const fs = require('fs');

const { getCurrentDateTime } = require('../utils/time');

const YYYY_MM_DD = getCurrentDateTime('YYYY-MM-DD');
const DEFAULT_RUNTIME_ROOT = path.resolve(__dirname, '../../../../.runtime/embedded-api');
const DEFAULT_LOG_DIR = path.join(DEFAULT_RUNTIME_ROOT, 'logs');

// 确定日志目录：打包运行走主进程注入目录；开发态写到项目根的 .runtime 下
const LOG_DIR = process.env.LOG_DIR || DEFAULT_LOG_DIR;
const log_dir = path.join(LOG_DIR, YYYY_MM_DD);

// 确保日志目录存在
if (LOG_DIR) {
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
