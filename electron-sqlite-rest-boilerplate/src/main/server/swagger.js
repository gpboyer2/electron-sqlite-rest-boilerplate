const { VITE_API_HOST, VITE_API_PORT, VITE_WS_HOST, VITE_WS_PORT } = require('./etc/config');

const { getApiTitle, getApiDescription, getAppVersion } = require('./utils/load-yaml-config');

/**
 * Swagger API 文档配置
 * 用于生成 API 文档的配置对象，包含 OpenAPI 规范定义和路由扫描路径
 * @returns {object} Swagger 配置对象，包含 definition、apis 等属性
 */
const options = {
  definition: {
    openapi: '3.0.2',
    info: {
      title: getApiTitle(),
      version: getAppVersion(),
      description: getApiDescription()
    },
    servers: [
      {
        url: 'http://localhost:9200' // 本地服务
      },
      {
        url: `http://${VITE_API_HOST}:${VITE_API_PORT}` // 服务
      }
    ]
  },
  apis: ['./routes/*.js'] // 包含所有定义的接口文件
};

module.exports = options;
