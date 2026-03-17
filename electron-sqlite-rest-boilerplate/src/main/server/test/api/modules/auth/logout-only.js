/**
 * 退出登录模块测试（独立执行）
 *
 * 测试架构：
 * 1. 每个测试都有独立的登录流程，确保状态隔离
 * 2. 不依赖其他模块，不影响其他模块
 * 3. 测试结束后重新登录，确保环境恢复
 */

const { test, describe, before, after } = require('../../lib/test-runner')
const { expect } = require('../../lib/assertions')
const { createApiClient, setAdminToken } = require('../../context')

describe('退出登录模块（独立执行）', () => {
  let apiClient

  // 测试前：创建新的客户端实例并登录
  before(async () => {
    console.log('[退出登录模块 before] 初始化独立测试环境...')

    apiClient = createApiClient()

    // 登录
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

    console.log('[退出登录模块 before] Admin 登录成功')
  })

  test('退出登录 - 正常情况', async () => {
    // 先重新登录确保有有效 token
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

    await apiClient.post('/auth/logout', {}, { expect: 'success' })

    // 验证 token 已失效
    await apiClient.get('/auth/me', null, { expect: 'error' })

    // 添加延迟，确保会话状态完全清理
    await new Promise((resolve) => setTimeout(resolve, 100))

    // 测试结束后重新登录，为下一个测试恢复状态
    const reLoginResponse = await apiClient.post(
      '/auth/login',
      {
        username: 'admin',
        password: 'admin123'
      },
      { expect: 'success' }
    )
    const newToken = reLoginResponse.datum.accessToken
    apiClient.setToken(newToken)
    setAdminToken(newToken)
  })

  test('退出登录 - 重复退出', async () => {
    // 先登录
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

    // 第一次退出
    await apiClient.post('/auth/logout', {}, { expect: 'success' })

    // 第二次退出（应该允许或返回错误，取决于业务逻辑）
    await apiClient.post('/auth/logout', {}, { expect: 'success' })

    // 添加延迟，确保会话状态完全清理
    await new Promise((resolve) => setTimeout(resolve, 100))

    // 测试结束后重新登录，为下一个测试恢复状态
    const reLoginResponse = await apiClient.post(
      '/auth/login',
      {
        username: 'admin',
        password: 'admin123'
      },
      { expect: 'success' }
    )
    const newToken = reLoginResponse.datum.accessToken
    apiClient.setToken(newToken)
    setAdminToken(newToken)
  })

  test('退出登录 - 未登录状态', async () => {
    const tempClient = createApiClient()

    // 未登录状态调用退出登录，幂等设计，返回 success
    await tempClient.post('/auth/logout', {}, { expect: 'success' })
  })

  test('退出登录 - 使用过期的 token', async () => {
    // 先登录
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

    // 退出登录
    await apiClient.post('/auth/logout', {}, { expect: 'success' })

    // 尝试使用已退出的 token
    await apiClient.get('/auth/me', null, { expect: 'error' })

    // 添加延迟，确保会话状态完全清理
    await new Promise((resolve) => setTimeout(resolve, 100))

    // 测试结束后重新登录，恢复状态
    const reLoginResponse = await apiClient.post(
      '/auth/login',
      {
        username: 'admin',
        password: 'admin123'
      },
      { expect: 'success' }
    )
    const newToken = reLoginResponse.datum.accessToken
    apiClient.setToken(newToken)
    setAdminToken(newToken)
  })

  test('退出登录 - 退出后无法访问受保护接口', async () => {
    // 先登录
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

    // 退出登录
    await apiClient.post('/auth/logout', {}, { expect: 'success' })

    // 尝试访问受保护的接口
    const protectedEndpoints = [
      { method: 'get', url: '/auth/me' },
      { method: 'get', url: '/user/list' }
    ]

    for (const endpoint of protectedEndpoints) {
      await apiClient[endpoint.method](endpoint.url, null, { expect: 'error' })
    }

    // 添加延迟，确保会话状态完全清理
    await new Promise((resolve) => setTimeout(resolve, 100))

    // 测试结束后重新登录，恢复状态
    const reLoginResponse = await apiClient.post(
      '/auth/login',
      {
        username: 'admin',
        password: 'admin123'
      },
      { expect: 'success' }
    )
    const newToken = reLoginResponse.datum.accessToken
    apiClient.setToken(newToken)
    setAdminToken(newToken)
  })

  test('退出登录 - 完整流程测试', async () => {
    // 完整流程：登录 → 退出 → 重新登录 → 验证可用
    // 使用独立的 ApiClient 实例，避免状态干扰
    // 使用独立的 admin 账户进行测试，避免与其他测试冲突

    const testClient = createApiClient()

    // 第一步：登录
    const loginResponse1 = await testClient.post(
      '/auth/login',
      {
        username: 'admin',
        password: 'admin123'
      },
      { expect: 'success' }
    )

    const token1 = loginResponse1.datum.accessToken
    testClient.setToken(token1)

    // 第二步：验证可以访问
    await testClient.get('/auth/me', null, { expect: 'success' })

    // 第三步：退出登录
    await testClient.post('/auth/logout', {}, { expect: 'success' })

    // 第四步：验证无法访问
    await testClient.get('/auth/me', null, { expect: 'error' })

    // 添加延迟，确保会话状态完全清理
    await new Promise((resolve) => setTimeout(resolve, 100))

    // 第五步：重新登录
    const loginResponse2 = await testClient.post(
      '/auth/login',
      {
        username: 'admin',
        password: 'admin123'
      },
      { expect: 'success' }
    )

    const token2 = loginResponse2.datum.accessToken
    testClient.setToken(token2)

    // 验证 token2 确实被设置了
    expect(testClient.getToken()).to.equal(token2)

    // 再添加一个延迟，确保新会话完全建立
    await new Promise((resolve) => setTimeout(resolve, 50))

    // 第六步：验证可以访问
    await testClient.get('/auth/me', null, { expect: 'success' })

    // 恢复主 apiClient 的状态，但不使用 setAdminToken
    apiClient.setToken(token2)
    // setAdminToken(token2); // 注释掉，避免重复设置导致问题

    console.log('[退出登录] 完整流程测试通过')
  })

  // 测试结束后重新登录，恢复环境
  after(async () => {
    try {
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

      console.log('[退出登录模块 after] 已重新登录，环境已恢复')
    } catch (error) {
      console.error('[退出登录模块 after] 重新登录失败:', error.message)
    }
  })
})
