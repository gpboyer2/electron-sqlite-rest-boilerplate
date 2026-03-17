/**
 * YAML 配置加载模块
 * 统一读取项目根目录的 config/app.yaml 配置文件
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * 加载 YAML 配置文件
 * @returns {object} 配置对象
 */
function loadYamlConfig() {
  try {
    // pkg 环境：从虚拟文件系统读取（相对于 source 目录）
    // 开发环境：从 server 目录向上找项目根目录的 config/app.yaml
    let configPath;
    if (process.pkg) {
      // pkg 打包后，app.js 在 source/ 目录，config 也在 source/ 目录
      // __dirname 在 pkg 环境下是 /release-build/pkg/source/server/utils
      configPath = path.join(__dirname, '../../../config/app.yaml');
    } else {
      // 开发环境：从 server/utils/ 向上两级到项目根目录
      configPath = path.join(__dirname, '../../config/app.yaml');
    }
    const fileContents = fs.readFileSync(configPath, 'utf8');
    return yaml.load(fileContents);
  } catch (e) {
    console.error('加载配置文件失败:', e.message);
    // 返回默认配置
    return {
      app: {
        name: '体系级全流程设计系统',
        short_name: '体系级设计系统',
        version: '1.0.0'
      },
      backend: {
        description: '体系级全流程设计系统-服务端',
        api_title: '体系级全流程设计系统 API',
        api_description: '体系级全流程设计系统的后端服务接口文档'
      }
    };
  }
}

// 导出配置对象
const appConfig = loadYamlConfig();

/**
 * 获取 API 标题
 * @returns {string} API 标题
 */
function getApiTitle() {
  return appConfig.backend?.api_title || 'API文档';
}

/**
 * 获取 API 描述
 * @returns {string} API 描述
 */
function getApiDescription() {
  return appConfig.backend?.api_description || 'API 文档';
}

/**
 * 获取应用版本号
 * @returns {string} 版本号
 */
function getAppVersion() {
  return appConfig.app?.version || '1.0.0';
}

/**
 * 获取应用名称
 * @param {boolean} short - 是否返回简称
 * @returns {string} 应用名称
 */
function getAppName(short = false) {
  if (short) {
    return appConfig.app?.short_name || '体系级设计系统';
  }
  return appConfig.app?.name || '体系级全流程设计系统';
}

module.exports = {
  appConfig,
  getApiTitle,
  getApiDescription,
  getAppVersion,
  getAppName
};
