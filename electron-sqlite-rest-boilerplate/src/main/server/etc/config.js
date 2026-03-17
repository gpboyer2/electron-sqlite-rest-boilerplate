/**
 * 服务器配置模块
 * 从环境变量读取配置并提供默认值，导出 HTTP 和 WebSocket 服务器配置
 * @returns {object} 配置对象，包含主机、端口和文件上传限制等配置项
 */

// [HTTP-Server]
// 与前端配置统一，使用 VITE_API_PORT 环境变量
const VITE_API_HOST = process.env.VITE_API_HOST || '0.0.0.0';
const VITE_API_PORT = process.env.VITE_API_PORT ? parseInt(process.env.VITE_API_PORT, 10) : 9200;

// [WebSocket-Server]
// 与前端配置统一，使用 VITE_WS_PORT 环境变量
const VITE_WS_HOST = process.env.VITE_WS_HOST || '0.0.0.0';
const VITE_WS_PORT = process.env.VITE_WS_PORT ? parseInt(process.env.VITE_WS_PORT, 10) : 9210;

// 文件上传大小限制（字节）
const MAX_FILE_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

module.exports = {
  VITE_API_HOST,
  VITE_API_PORT,
  VITE_WS_HOST,
  VITE_WS_PORT,
  MAX_FILE_UPLOAD_SIZE
};
