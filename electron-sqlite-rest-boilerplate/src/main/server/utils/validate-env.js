/**
 * 环境变量校验工具
 *
 * 用于校验必需的环境变量，缺失时抛出错误并提示用户
 *
 * 使用方法：
 * const { validateRequiredEnv } = require('../scripts/validateEnv');
 * validateRequiredEnv(process.env, ['VITE_API_PORT', 'VITE_API_HOST'], '.env');
 */

/**
 * 校验必需的环境变量
 * @param {Object} envObj - 环境变量对象（如 process.env 或 loadEnv 返回值）
 * @param {string[]} requiredVars - 必需的环境变量名数组
 * @param {string} [envFileName='.env'] - 环境变量文件名，用于错误提示
 * @param {string} [context=''] - 额外的上下文信息（如 "Vite 配置"）
 * @throws {Error} 当有必需的环境变量缺失时
 */
function validateRequiredEnv(envObj, requiredVars, envFileName = '.env', context = '') {
  const missingVars = requiredVars.filter((varName) => !envObj[varName]);

  if (missingVars.length > 0) {
    const contextMsg = context ? `${context}缺少` : '缺少';
    const errorLines = [
      '',
      '========================================',
      `错误：${contextMsg}必需的环境变量`,
      '========================================',
      `请确保在 ${envFileName} 文件中配置以下变量：`,
      ...missingVars.map((v) => `  - ${v}`),
      '',
      '解决方法：',
      '  1. 复制 .env.example 为 ' + envFileName,
      `  2. 确保 ${envFileName} 文件包含所有必需的配置`,
      '========================================',
      ''
    ];
    throw new Error(errorLines.join('\n'));
  }
}

/**
 * 获取必需的环境变量值，缺失时抛出错误
 * @param {Object} envObj - 环境变量对象
 * @param {string} varName - 环境变量名
 * @param {string} [envFileName='.env'] - 环境变量文件名，用于错误提示
 * @returns {string} 环境变量值
 * @throws {Error} 当环境变量缺失时
 */
function getRequiredEnv(envObj, varName, envFileName = '.env') {
  if (!envObj[varName]) {
    throw new Error(
      [
        '',
        '========================================',
        `错误：缺少必需的环境变量: ${varName}`,
        '========================================',
        `请确保在 ${envFileName} 文件中配置此变量`,
        '========================================',
        ''
      ].join('\n')
    );
  }
  return envObj[varName];
}

module.exports = {
  validateRequiredEnv,
  getRequiredEnv
};
