/**
 * REST API 服务器入口
 *
 * 【强制约束】本项目必须使用 better-sqlite3，禁止使用 Sequelize 或其他 ORM
 *
 * 基于 Express 的 REST API 服务器，提供：
 * - 系统监控接口（/api/system）
 * - 仪表盘接口（/api/dashboard）
 * - 进程管理接口（/api/process）
 * - 设置接口（/api/settings）
 * - 关于接口（/api/about）
 */

const path = require('path');

// 加载环境变量（必须在所有其他 require 之前）
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = nodeEnv === 'test' ? '.env.test' : '.env';
require('dotenv').config({ path: path.join(__dirname, `../${envFile}`) });

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const favicon = require('serve-favicon');

// 引入日志模块
const log4js = require('./middleware/log4jsPlus');
const logger = log4js.getLogger('default');

/**
 * 【强制约束】必须使用 better-sqlite3 创建数据库连接
 * 禁止使用：sequelize, sqlite3, knex 等其他库
 */
const { testConnection, closeDatabase } = require('./database/database');

const app = express();

// CORS 配置：允许所有来源
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: false
  })
);

app.use(favicon(path.join(__dirname, 'favicon.ico')));

// 引入中间件
const accessHandler = require('./middleware/accessLogger');
const errorHandler = require('./middleware/errorLogger');
const responseFormatMiddleware = require('./middleware/response');

// HTTP 服务器
const http = require('http');
const httpServer = http.Server(app);

// 配置
const { VITE_API_HOST, VITE_API_PORT } = require('./etc/config');

const apiPrefix = '/api';

// 路由配置表：路径前缀、路由模块、描述
const routeConfigList = [
  { prefix: '/health', router: require('./routes/healthRouter'), desc: '健康检查接口' },
  { prefix: '/dashboard', router: require('./routes/dashboardRouter'), desc: '仪表盘接口' },
  { prefix: '/system', router: require('./routes/systemRouter'), desc: '系统监控接口' },
  { prefix: '/process', router: require('./routes/processRouter'), desc: '进程管理接口' },
  { prefix: '/settings', router: require('./routes/settingsRouter'), desc: '设置接口' },
  { prefix: '/about', router: require('./routes/aboutRouter'), desc: '关于接口' }
];

// 全局中间件
app.use(bodyParser.json());
app.use(responseFormatMiddleware);
app.use(accessHandler);

// 注册路由
routeConfigList.forEach(({ prefix, router }) => {
  app.use(apiPrefix + prefix, router);
});

// 错误处理中间件（放在最后，捕获所有路由的错误）
app.use(errorHandler);

/**
 * 启动服务器
 */
async function startServer() {
  try {
    // 测试数据库连接
    testConnection();

    // 启动 HTTP 服务器
    httpServer.listen(VITE_API_PORT, VITE_API_HOST, function () {
      const nodeEnv = process.env.NODE_ENV || 'development';
      const envDisplay = nodeEnv === 'test' ? '*** 测试环境 (TEST) ***' : nodeEnv;
      logger.info(`========================================`);
      logger.info(`运行环境: ${envDisplay}`);
      logger.info(`========================================`);
      logger.info(`HTTP 服务(${VITE_API_HOST}:${VITE_API_PORT}) 启动成功`);
    });

    // 延迟输出服务信息
    setTimeout(() => {
      logger.info('========================================');
      logger.info('REST API 服务器启动完成');
      logger.info(`HTTP API 服务: http://localhost:${VITE_API_PORT}`);
      logger.info('========================================');
      logger.info('可用接口路由:');
      // 动态输出路由配置
      const maxPrefixLen = Math.max(...routeConfigList.map((r) => r.prefix.length));
      routeConfigList.forEach(({ prefix, desc }) => {
        logger.info(`   ${prefix.padEnd(maxPrefixLen + 2)} - ${desc}`);
      });
      logger.info('========================================');
    }, 1000);
  } catch (error) {
    logger.error('服务器初始化失败:', error);
    process.exit(1);
  }
}

/**
 * 优雅关闭处理函数
 */
function gracefulShutdown(signal) {
  logger.info(`收到 ${signal} 信号，开始优雅关闭...`);

  // 关闭 HTTP 服务器
  httpServer.close(() => {
    logger.info('HTTP 服务器已关闭');
  });

  // 关闭数据库连接（使用 better-sqlite3）
  closeDatabase();

  // 强制退出超时（5秒后强制退出）
  setTimeout(() => {
    logger.error('优雅关闭超时，强制退出');
    process.exit(1);
  }, 5000);
}

// 监听进程退出信号
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 导出启动函数（供 Electron 主进程调用）
module.exports = {
  startServer,
  app,
  httpServer
};
