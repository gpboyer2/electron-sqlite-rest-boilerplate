/**
 * WebSocket 服务模块
 * 创建独立的 WebSocket 服务器，用于接收前端日志等
 */
const { Server: SocketIoServer } = require('socket.io');
const log4js = require('./middleware/log4jsPlus');
const logger = log4js.getLogger();

let wsServer = null;
let io = null;

/**
 * 创建 WebSocket 服务器
 * @param {number} port - WebSocket 监听端口
 * @param {string} host - WebSocket 监听地址
 * @returns {object} WebSocket 服务器实例
 */
function createWebSocketServer(port, host) {
  if (io) {
    return { wsServer, io };
  }

  // 创建独立的 HTTP 服务器用于 WebSocket
  wsServer = require('http').Server();
  io = new SocketIoServer(wsServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // WebSocket 连接处理
  io.on('connection', (socket) => {
    logger.info(`WebSocket 客户端已连接: ${socket.id}`);

    // 接收前端日志
    socket.on('frontend-log', async (data) => {
      try {
        const { logs } = data;
        if (Array.isArray(logs) && logs.length > 0) {
          // 延迟加载避免模块循环依赖
          const FrontendLogService = require('./mvc/services/frontendLog');
          await FrontendLogService.parseAndCreateBatch(logs);
        }
      } catch (error) {
        logger.error('处理前端日志失败:', error.message);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`WebSocket 客户端已断开: ${socket.id}`);
    });
  });

  // 启动监听
  wsServer.listen(port, host, function () {
    logger.info(`WebSocket 服务(${host}:${port}) 启动成功`);
  });

  return { wsServer, io };
}

/**
 * 获取 WebSocket 服务器实例
 * @returns {object} { wsServer, io }
 */
function getWebSocketServer() {
  return { wsServer, io };
}

module.exports = {
  createWebSocketServer,
  getWebSocketServer
};
