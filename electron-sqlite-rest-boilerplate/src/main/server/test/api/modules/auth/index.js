/**
 * 认证模块测试
 * 覆盖登录、刷新token、获取用户信息等认证相关的 API 端点
 * 注意：退出登录测试已移至独立模块 auth-logout-only.js
 */

const { test, describe, after } = require('../../lib/test-runner')
const { expect } = require('../../lib/assertions')
const { getApiClient, createApiClient, setAdminToken } = require('../../context')

// 使用全局共享的 API 客户端实例
const apiClient = getApiClient()

/**
 * 辅助函数：确保已登录
 * 先重置管理员密码为 admin123，然后执行登录操作
 * @returns {Promise<string>} 返回登录成功后的 access token
 */
async function ensureLoggedIn() {
  const bcrypt = require('bcryptjs')
  const { sequelize } = require('../../../../database/sequelize')

  try {
    const hashedPassword = await bcrypt.hash('admin123', 10)
    await sequelize.query('UPDATE users SET password = ? WHERE user_name = ?', {
      replacements: [hashedPassword, 'admin']
    })
  } catch (error) {
    console.error('[ensureLoggedIn] 密码重置失败:', error.message)
  }

  const loginResponse = await apiClient.post(
    '/auth/login',
    {
      username: 'admin',
      password: 'admin123'
    },
    { expect: 'success' }
  )
  const token = loginResponse.datum.accessToken
  apiClient.setToken(token)
  setAdminToken(token)
  return token
}

describe('认证模块', () => {
  let adminToken

  /**
   * 测试管理员登录 - 正常情况
   * 验证使用正确的用户名和密码能够成功登录，并返回 access token、refresh token 和用户信息
   */
  test('管理员登录 - 正常情况', async () => {
    const response = await apiClient.post(
      '/auth/login',
      {
        username: 'admin',
        password: 'admin123'
      },
      { expect: 'success' }
    )

    expect(response.datum.accessToken).to.be.truthy()
    expect(response.datum.refreshToken).to.be.truthy()
    expect(response.datum.user).to.be.truthy()
    expect(response.datum.user.username).to.equal('admin')

    adminToken = response.datum.accessToken
    apiClient.setToken(adminToken)
    setAdminToken(adminToken)
  })

  /**
   * 测试管理员登录 - 用户名不存在
   * 验证使用不存在的用户名登录时返回错误提示
   */
  test('管理员登录 - 用户名不存在', async () => {
    const loginClient = createApiClient()
    const response = await loginClient.post(
      '/auth/login',
      {
        username: 'nonexistentuser_' + Date.now(),
        password: 'password123'
      },
      { expect: 'error' }
    )

    expect(response.message).to.include('账户或密码不正确')
  })

  /**
   * 测试管理员登录 - 密码错误
   * 验证使用错误的密码登录时返回错误提示
   */
  test('管理员登录 - 密码错误', async () => {
    const loginClient = createApiClient()
    const response = await loginClient.post(
      '/auth/login',
      {
        username: 'admin',
        password: 'wrongpassword'
      },
      { expect: 'error' }
    )

    expect(response.message).to.include('账户或密码不正确')
  })

  /**
   * 测试管理员登录 - 缺少用户名
   * 验证登录时缺少用户名参数时的行为
   */
  test('管理员登录 - 缺少用户名', async () => {
    const loginClient = createApiClient()
    const response = await loginClient.post(
      '/auth/login',
      {
        password: 'admin123'
      },
      { expect: 'error' }
    )

    expect(response).to.be.truthy()
  })

  /**
   * 测试管理员登录 - 缺少密码
   * 验证登录时缺少密码参数时的行为
   */
  test('管理员登录 - 缺少密码', async () => {
    const loginClient = createApiClient()
    const response = await loginClient.post(
      '/auth/login',
      {
        username: 'admin'
      },
      { expect: 'error' }
    )

    expect(response).to.be.truthy()
  })

  /**
   * 测试管理员登录 - 用户名为空字符串
   * 验证用户名字段为空字符串时的行为
   */
  test('管理员登录 - 用户名为空字符串', async () => {
    const loginClient = createApiClient()
    const response = await loginClient.post(
      '/auth/login',
      {
        username: '',
        password: 'admin123'
      },
      { expect: 'error' }
    )

    expect(response).to.be.truthy()
  })

  /**
   * 测试管理员登录 - 密码为空字符串
   * 验证密码字段为空字符串时的行为
   */
  test('管理员登录 - 密码为空字符串', async () => {
    const loginClient = createApiClient()
    const response = await loginClient.post(
      '/auth/login',
      {
        username: 'admin',
        password: ''
      },
      { expect: 'error' }
    )

    expect(response).to.be.truthy()
  })

  /**
   * 测试管理员登录 - 参数为空对象
   * 验证登录请求体为空对象时的行为
   */
  test('管理员登录 - 参数为空对象', async () => {
    const loginClient = createApiClient()
    const response = await loginClient.post('/auth/login', {}, { expect: 'error' })

    expect(response).to.be.truthy()
  })

  /**
   * 测试获取当前用户信息 - 已登录
   * 验证已登录用户能够获取到自己的用户信息
   */
  test('获取当前用户信息 - 已登录', async () => {
    const response = await apiClient.get('/auth/me', null, { expect: 'success' })

    expect(response.datum.username).to.equal('admin')
    expect(response.datum.id).to.be.truthy()
  })

  /**
   * 测试获取当前用户信息 - 未登录
   * 验证未登录时获取用户信息返回错误提示
   */
  test('获取当前用户信息 - 未登录', async () => {
    const tempClient = createApiClient()

    const response = await tempClient.get('/auth/me', null, { expect: 'error' })
    expect(response.message).to.include('无效的访问令牌')
  })

  /**
   * 测试获取当前用户信息 - 无效的 token
   * 验证使用无效的 access token 获取用户信息时返回错误提示
   */
  test('获取当前用户信息 - 无效的 token', async () => {
    const tempClient = createApiClient()
    tempClient.setToken('invalid-token-12345')

    const response = await tempClient.get('/auth/me', null, { expect: 'error' })
    expect(response.message).to.include('无效的访问令牌')
  })

  /**
   * 测试获取当前用户信息 - token 格式错误
   * 验证使用格式错误的 token（包含 Bearer 前缀）获取用户信息时返回错误提示
   */
  test('获取当前用户信息 - token 格式错误', async () => {
    const tempClient = createApiClient()
    tempClient.setToken('Bearer invalid-token')

    const response = await tempClient.get('/auth/me', null, { expect: 'error' })
    expect(response.message).to.include('无效的访问令牌')
  })

  /**
   * 测试刷新 Token - 正常情况
   * 验证使用有效的 refresh token 能够刷新 access token，并返回新的过期时间
   */
  test('刷新 Token - 正常情况', async () => {
    await ensureLoggedIn()

    const loginResponse = await apiClient.post(
      '/auth/login',
      {
        username: 'admin',
        password: 'admin123'
      },
      { expect: 'success' }
    )

    const { refreshToken } = loginResponse.datum

    const refreshResponse = await apiClient.post(
      '/auth/refresh',
      {
        refreshToken
      },
      { expect: 'success' }
    )

    expect(refreshResponse.datum.accessToken).to.be.truthy()
    expect(refreshResponse.datum.expiresIn).to.be.truthy()

    adminToken = refreshResponse.datum.accessToken
    apiClient.setToken(adminToken)
    setAdminToken(adminToken)
  })

  /**
   * 测试刷新 Token - 无效的 refresh token
   * 验证使用无效的 refresh token 刷新时返回错误提示
   */
  test('刷新 Token - 无效的 refresh token', async () => {
    const response = await apiClient.post(
      '/auth/refresh',
      {
        refreshToken: 'invalid-refresh-token'
      },
      { expect: 'error' }
    )

    expect(response).to.be.truthy()
  })

  /**
   * 测试刷新 Token - 缺少 refresh token
   * 验证刷新时缺少 refresh token 参数时的行为
   */
  test('刷新 Token - 缺少 refresh token', async () => {
    const response = await apiClient.post('/auth/refresh', {}, { expect: 'error' })
    expect(response).to.be.truthy()
  })

  /**
   * 测试刷新 Token - refresh token 为空字符串
   * 验证 refresh token 字段为空字符串时的行为
   */
  test('刷新 Token - refresh token 为空字符串', async () => {
    const response = await apiClient.post(
      '/auth/refresh',
      {
        refreshToken: ''
      },
      { expect: 'error' }
    )

    expect(response).to.be.truthy()
  })

  /**
   * 测试刷新 Token - 格式错误的 refresh token
   * 验证使用格式错误的 refresh token（非 JWT 格式）时返回错误提示
   */
  test('刷新 Token - 格式错误的 refresh token', async () => {
    const response = await apiClient.post(
      '/auth/refresh',
      {
        refreshToken: 'not-a-valid-jwt-token'
      },
      { expect: 'error' }
    )

    expect(response).to.be.truthy()
  })

  // 测试结束后确保密码恢复为 admin123
  /**
   * 测试清理钩子
   * 在所有测试执行完毕后，将管理员密码重置为 admin123，确保后续测试能够正常登录
   */
  after(async () => {
    const bcrypt = require('bcryptjs')
    const { sequelize } = require('../../../../database/sequelize')

    try {
      const hashedPassword = await bcrypt.hash('admin123', 10)
      await sequelize.query('UPDATE users SET password = ? WHERE user_name = ?', {
        replacements: [hashedPassword, 'admin']
      })
      console.log('[auth after] 密码已直接重置为 admin123')
    } catch (error) {
      console.error('[auth after] 密码重置失败:', error.message)
    }
  })
})
