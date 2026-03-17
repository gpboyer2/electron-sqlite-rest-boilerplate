/**
 * 测试环境配置
 */

// 端口配置
const TEST_PORT = 9558
const DEV_PORT = 9200

// API 基础 URL
const TEST_API_BASE = `http://localhost:${TEST_PORT}/api`
const DEV_API_BASE = `http://localhost:${DEV_PORT}/api`

module.exports = {
  TEST_PORT,
  DEV_PORT,
  TEST_API_BASE,
  DEV_API_BASE
}
