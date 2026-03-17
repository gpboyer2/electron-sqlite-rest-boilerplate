/**
 * 测试全局上下文
 * 管理测试过程中的共享状态
 */

const { ApiClient } = require('./lib/api-client')
const DataTracker = require('./utils/data-tracker')

/**
 * 全局上下文类
 */
class TestContext {
  constructor() {
    this.apiClient = null
    this.dataTracker = null
    this.adminToken = null
    this.testData = {}
  }

  /**
   * 初始化上下文
   */
  initialize(apiClient, dataTracker) {
    this.apiClient = apiClient
    this.dataTracker = dataTracker
  }

  /**
   * 获取共享的 API 客户端实例
   */
  getApiClient() {
    if (!this.apiClient) {
      throw new Error('ApiClient 未初始化，请确保测试正确运行')
    }
    return this.apiClient
  }

  /**
   * 获取共享的数据追踪器实例
   */
  getDataTracker() {
    if (!this.dataTracker) {
      throw new Error('DataTracker 未初始化，请确保测试正确运行')
    }
    return this.dataTracker
  }

  /**
   * 创建新的 API 客户端实例（用于测试无token访问等场景）
   */
  createApiClient() {
    const client = new ApiClient()
    // 在测试环境中禁用自动清除token
    client.setAutoClearToken(false)
    return client
  }

  /**
   * 设置管理员 token
   */
  setAdminToken(token) {
    this.adminToken = token
    if (this.apiClient) {
      this.apiClient.setToken(token)
    }
  }

  /**
   * 获取管理员 token
   */
  getAdminToken() {
    return this.adminToken
  }

  /**
   * 保存测试数据
   */
  setTestData(key, value) {
    this.testData[key] = value
  }

  /**
   * 获取测试数据
   */
  getTestData(key) {
    return this.testData[key]
  }

  /**
   * 清除测试数据
   */
  clearTestData() {
    this.testData = {}
  }

  /**
   * 重置上下文
   */
  reset() {
    this.adminToken = null
    this.clearTestData()
  }
}

// 创建全局单例实例
const globalContext = new TestContext()

/**
 * 获取全局测试上下文实例
 * @returns {TestContext} 全局单例上下文对象
 */
const getContext = () => globalContext

/**
 * 获取共享的 API 客户端实例
 * @returns {ApiClient} API 客户端实例
 * @throws {Error} 如果客户端未初始化
 */
const getApiClient = () => globalContext.getApiClient()

/**
 * 获取共享的数据追踪器实例
 * @returns {DataTracker} 数据追踪器实例
 * @throws {Error} 如果追踪器未初始化
 */
const getDataTracker = () => globalContext.getDataTracker()

/**
 * 创建新的 API 客户端实例
 * @returns {ApiClient} 新的 API 客户端实例（禁用自动清除 token）
 */
const createApiClient = () => globalContext.createApiClient()

/**
 * 设置管理员 token
 * @param {string} token - 管理员认证 token
 */
const setAdminToken = (token) => globalContext.setAdminToken(token)

/**
 * 获取管理员 token
 * @returns {string|null} 管理员认证 token
 */
const getAdminToken = () => globalContext.getAdminToken()

/**
 * 保存测试数据到全局上下文
 * @param {string} key - 数据键名
 * @param {*} value - 数据值
 */
const setTestData = (key, value) => globalContext.setTestData(key, value)

/**
 * 从全局上下文获取测试数据
 * @param {string} key - 数据键名
 * @returns {*} 存储的数据值
 */
const getTestData = (key) => globalContext.getTestData(key)

module.exports = {
  TestContext,
  ApiClient,
  getContext,
  getApiClient,
  getDataTracker,
  createApiClient,
  setAdminToken,
  getAdminToken,
  setTestData,
  getTestData
}
