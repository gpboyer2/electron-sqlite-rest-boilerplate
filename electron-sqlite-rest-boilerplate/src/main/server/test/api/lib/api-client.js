/**
 * API 客户端
 * 封装 axios，提供统一的 API 请求能力
 */

const axios = require('axios')
const { TEST_API_BASE } = require('../config')

/**
 * API 错误类
 */
class ApiError extends Error {
  constructor(message, code, data) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.data = data
  }
}

/**
 * 请求日志工具类
 * 输出接口信息、预期值、实际值
 */
class RequestLogger {
  static requestId = 0
  static ENABLED = true
  static VERBOSE = false // 是否输出详细日志
  static currentMethod = null
  static currentUrl = null

  /**
   * 过滤敏感字段（如密码、token等）
   * @param {*} data - 需要过滤的数据对象
   * @returns {*} 过滤后的数据对象
   */
  static filterSensitive(data) {
    if (!data || typeof data !== 'object') {
      return data
    }

    const sensitiveFields = [
      'password',
      'pwd',
      'token',
      'secret',
      'api_key',
      'secret_key',
      'authorization'
    ]
    const filtered = { ...data }

    for (const key of Object.keys(filtered)) {
      if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
        filtered[key] = '***'
      } else if (typeof filtered[key] === 'object' && filtered[key] !== null) {
        filtered[key] = this.filterSensitive(filtered[key])
      }
    }

    return filtered
  }

  /**
   * 记录请求开始
   * @param {string} method - HTTP 方法
   * @param {string} url - 请求 URL
   * @param {object} params - 查询参数
   * @param {object} data - 请求体数据
   * @returns {number} 请求 ID
   */
  static logStart(method, url, params, data) {
    this.currentMethod = method
    this.currentUrl = url
    return ++this.requestId
  }

  /**
   * 统一的匹配记录方法
   * @param {number} requestId - 请求ID
   * @param {string} expected - 预期状态 ('success' | 'error')
   * @param {string} actual - 实际状态 ('success' | 'error')
   * @param {number} startTime - 请求开始时间
   * @param {object} responseData - 响应数据（用于提取错误消息）
   */
  static logMatch(requestId, expected, actual, startTime, responseData = null) {
    const duration = Date.now() - startTime
    const method = this.currentMethod || 'UNKNOWN'
    const url = this.currentUrl || ''
    const matched = expected === actual
    const messagePart = responseData?.message ? `, message: ${responseData.message}` : ''

    console.log(`  [请求] ${method} ${url}`)
    console.log(`  [预期] status: ${expected}`)
    console.log(`  [实际] status: ${actual}${messagePart}, ${duration}ms`)
    console.log(`  [${matched ? '✓ 匹配' : '✗ 不匹配'}]`)

    // 重置
    this.currentMethod = null
    this.currentUrl = null
  }
}

/**
 * API 客户端类
 */
class ApiClient {
  constructor(baseURL = TEST_API_BASE) {
    this.baseURL = baseURL
    this.token = null
    this.autoClearToken = true // 是否自动清除token（遇到401时）
    this.instance = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    this.setupInterceptors()
  }

  /**
   * 设置请求和响应拦截器
   */
  setupInterceptors() {
    // 请求拦截器
    this.instance.interceptors.request.use(
      (config) => {
        // 添加认证 token
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`
        }

        // 添加请求 ID
        config.headers['X-Request-ID'] = this.generateRequestId()

        // 添加时间戳防止缓存
        if (config.method?.toLowerCase() === 'get') {
          config.params = {
            ...config.params,
            _t: Date.now()
          }
        }

        // 处理 expect 参数（如果未声明则跳过验证，不中断测试）
        const expectOption = config.expect

        // 标记是否进行了预期验证
        config.__hasExpectValidation = !!expectOption

        if (expectOption && !['success', 'error'].includes(expectOption)) {
          console.warn(
            `[API] 警告: expect 值无效，跳过验证: ${config.method?.toUpperCase()} ${config.url}，expect: ${expectOption}`
          )
          config.__hasExpectValidation = false
        }

        config.__expectedStatus = expectOption

        // 记录请求开始日志
        const requestId = RequestLogger.logStart(
          config.method?.toUpperCase() || 'UNKNOWN',
          config.url || '',
          config.params,
          config.data
        )
        config.__requestId = requestId
        config.__startTime = Date.now()

        return config
      },
      (error) => {
        console.error('[API] 请求拦截器错误:', error)
        return Promise.reject(error)
      }
    )

    // 响应拦截器
    this.instance.interceptors.response.use(
      (response) => {
        const requestId = response.config.__requestId || 0
        const startTime = response.config.__startTime || Date.now()
        const { data, status: httpStatus } = response
        const expectedStatus = response.config.__expectedStatus
        const hasExpectValidation = response.config.__hasExpectValidation

        // 确定实际状态
        let actualStatus
        if (data.status === 'success' || data.status === 'error') {
          actualStatus = data.status
        } else if (data.success === true) {
          actualStatus = 'success'
        } else if (data.success === false) {
          actualStatus = 'error'
        } else {
          actualStatus = 'error' // 响应格式不符合预期，判定为失败
        }

        // 如果没有 expect 验证，直接返回数据
        if (!hasExpectValidation) {
          console.log(
            `  [请求] ${response.config.method?.toUpperCase() || 'UNKNOWN'} ${response.config.url || ''}`
          )
          console.log(
            `  [实际] status: ${actualStatus}${data.message ? ', message: ' + data.message : ''}, ${Date.now() - startTime}ms`
          )
          console.log(`  [跳过验证] 未声明 expect 选项`)
          return data
        }

        // 验证预期与实际是否匹配
        if (expectedStatus !== actualStatus) {
          const { ExpectedMismatchError } = require('./assertions')
          RequestLogger.logMatch(requestId, expectedStatus, actualStatus, startTime, data)
          throw new ExpectedMismatchError(
            `预期 ${expectedStatus}，实际 ${actualStatus}`,
            expectedStatus,
            actualStatus,
            data
          )
        }

        // 匹配：记录日志并返回数据
        RequestLogger.logMatch(requestId, expectedStatus, actualStatus, startTime, data)
        return data
      },
      async (error) => {
        const requestId = error.config?.__requestId || 0
        const startTime = error.config?.__startTime || Date.now()
        const expectedStatus = error.config?.__expectedStatus
        const hasExpectValidation = error.config?.__hasExpectValidation

        // 处理网络错误
        if (!error.response) {
          const method = error.config?.method?.toUpperCase() || 'UNKNOWN'
          const url = error.config?.url || ''
          RequestLogger.currentMethod = method
          RequestLogger.currentUrl = url

          if (hasExpectValidation) {
            RequestLogger.logMatch(requestId, expectedStatus || 'success', 'error', startTime, {
              message: error.message
            })
          } else {
            console.log(`  [请求] ${method} ${url}`)
            console.log(`  [实际] 网络错误: ${error.message}, ${Date.now() - startTime}ms`)
            console.log(`  [跳过验证] 未声明 expect 选项`)
          }

          if (error.code === 'ECONNREFUSED') {
            throw new ApiError('无法连接到后端服务，请确保后端服务已启动', -1)
          }
          throw new ApiError('网络连接失败，请检查网络设置', -1)
        }

        const { status, data } = error.response
        const method = error.config?.method?.toUpperCase() || 'UNKNOWN'
        const url = error.config?.url || ''
        RequestLogger.currentMethod = method
        RequestLogger.currentUrl = url

        // 处理网关错误（通常后端未运行）
        if (status === 502) {
          if (hasExpectValidation) {
            RequestLogger.logMatch(requestId, expectedStatus || 'success', 'error', startTime, {
              message: '网关错误'
            })
          } else {
            console.log(`  [请求] ${method} ${url}`)
            console.log(`  [实际] 网关错误, ${Date.now() - startTime}ms`)
            console.log(`  [跳过验证] 未声明 expect 选项`)
          }
          throw new ApiError('网关错误：后端服务可能未正常运行，请检查后端服务状态', 502)
        }

        // HTTP 200 但响应体中有错误信息（业务错误）
        if (status === 200 && data) {
          let actualStatus = 'error'
          if (data.status === 'success' || data.success === true) {
            actualStatus = 'success'
          }

          if (hasExpectValidation) {
            // 验证预期与实际是否匹配
            if (expectedStatus && expectedStatus !== actualStatus) {
              const { ExpectedMismatchError } = require('./assertions')
              RequestLogger.logMatch(requestId, expectedStatus, actualStatus, startTime, data)
              throw new ExpectedMismatchError(
                `预期 ${expectedStatus}，实际 ${actualStatus}`,
                expectedStatus,
                actualStatus,
                data
              )
            }
            RequestLogger.logMatch(
              requestId,
              expectedStatus || actualStatus,
              actualStatus,
              startTime,
              data
            )
          } else {
            console.log(`  [请求] ${method} ${url}`)
            console.log(
              `  [实际] status: ${actualStatus}${data.message ? ', message: ' + data.message : ''}, ${Date.now() - startTime}ms`
            )
            console.log(`  [跳过验证] 未声明 expect 选项`)
          }

          if (actualStatus === 'error') {
            throw new ApiError(data.message || '操作失败', data.code || 400, data.datum)
          }
          return data
        }

        // 处理认证失败（兼容旧的 401 状态码）
        if (status === 401 || data?.message?.includes('无效的访问令牌')) {
          if (hasExpectValidation) {
            RequestLogger.logMatch(requestId, expectedStatus || 'success', 'error', startTime, {
              message: '认证失败'
            })
          } else {
            console.log(`  [请求] ${method} ${url}`)
            console.log(`  [实际] 认证失败, ${Date.now() - startTime}ms`)
            console.log(`  [跳过验证] 未声明 expect 选项`)
          }
          // 在测试环境中不清除token，避免影响后续测试
          if (this.autoClearToken) {
            this.token = null
          }
          throw new ApiError('认证失败', 401)
        }

        // 处理其他 HTTP 错误
        const message = data?.message || data?.error || this.getErrorMessage(status)
        if (hasExpectValidation) {
          RequestLogger.logMatch(requestId, expectedStatus || 'success', 'error', startTime, {
            message
          })
        } else {
          console.log(`  [请求] ${method} ${url}`)
          console.log(`  [实际] HTTP ${status}: ${message}, ${Date.now() - startTime}ms`)
          console.log(`  [跳过验证] 未声明 expect 选项`)
        }
        const code = data?.code || status
        throw new ApiError(message, code, data?.datum)
      }
    )
  }

  /**
   * 生成请求唯一标识
   * @returns {string} 请求 ID（格式：时间戳-随机字符串）
   */
  generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 获取状态码对应的错误信息
   * @param {number} status - HTTP 状态码
   * @returns {string} 错误信息描述
   */
  getErrorMessage(status) {
    const statusMessages = {
      400: '请求参数错误',
      403: '访问被拒绝',
      404: '请求的资源不存在',
      405: '请求方法不被允许',
      408: '请求超时',
      429: '请求过于频繁，请稍后再试',
      500: '服务器内部错误',
      502: '网关错误',
      503: '服务暂时不可用',
      504: '网关超时'
    }
    return statusMessages[status] || `请求失败 (${status})`
  }

  /**
   * 设置认证 token
   * @param {string} token - JWT 认证令牌
   */
  setToken(token) {
    this.token = token
    // 静默设置，不输出日志
  }

  /**
   * 设置是否自动清除 token
   * @param {boolean} enabled - 是否启用自动清除（遇 401 时）
   */
  setAutoClearToken(enabled) {
    this.autoClearToken = enabled
  }

  /**
   * 获取认证 token
   * @returns {string|null} 当前 JWT 认证令牌
   */
  getToken() {
    return this.token
  }

  /**
   * 通用请求方法
   * @param {object} config - Axios 请求配置对象
   * @returns {Promise<object>} 响应数据
   */
  async request(config) {
    return this.instance.request(config)
  }

  /**
   * GET 请求
   * @param {string} url - 请求路径
   * @param {object} params - 查询参数
   * @param {object} config - 额外配置选项
   * @returns {Promise<object>} 响应数据
   */
  async get(url, params, config = {}) {
    return this.instance.request({ ...config, method: 'GET', url, params })
  }

  /**
   * POST 请求
   * @param {string} url - 请求路径
   * @param {object} data - 请求体数据
   * @param {object} config - 额外配置选项
   * @returns {Promise<object>} 响应数据
   */
  async post(url, data, config = {}) {
    return this.instance.request({ ...config, method: 'POST', url, data })
  }

  /**
   * PUT 请求
   * @param {string} url - 请求路径
   * @param {object} data - 请求体数据
   * @param {object} config - 额外配置选项
   * @returns {Promise<object>} 响应数据
   */
  async put(url, data, config = {}) {
    return this.instance.request({ ...config, method: 'PUT', url, data })
  }

  /**
   * DELETE 请求
   * @param {string} url - 请求路径
   * @param {object} config - 额外配置选项
   * @returns {Promise<object>} 响应数据
   */
  async delete(url, config = {}) {
    return this.instance.request({ ...config, method: 'DELETE', url })
  }
}

module.exports = { ApiClient, ApiError, RequestLogger }
