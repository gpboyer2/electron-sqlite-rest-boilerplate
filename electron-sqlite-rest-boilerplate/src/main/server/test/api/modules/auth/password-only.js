/**
 * 修改密码模块测试
 *
 * 测试架构约束（永久遵循）：
 * 1. 使用 Mock.js 动态生成的全局测试数据
 * 2. 修改密码测试是最后一个测试模块
 * 3. 每次测试运行都是新的随机数据，无状态依赖
 *
 * 测试流程：
 * - 从全局变量获取之前创建用户时动态生成的用户名和密码
 * - 使用这些动态数据测试修改密码接口
 * - 测试完成后密码无需恢复（因为每次都是新数据）
 */

const { test, describe, after, before } = require('../../lib/test-runner')
const { expect } = require('../../lib/assertions')
const { getApiClient, createApiClient, getDataTracker } = require('../../context')
const { getTestData, setTestData } = require('../../utils/mock-data-generator')

const apiClient = getApiClient()
const dataTracker = getDataTracker()

describe('修改密码模块（最后执行）', () => {
  let adminToken
  let testUserToken
  let testUserId
  let originalPassword
  let username

  // 前置：从全局测试数据获取用户信息
  before(async () => {
    try {
      console.log('[修改密码 before] 获取全局测试数据...')

      // 从高维度全局变量获取之前创建用户时动态生成的数据
      const globalUserData = getTestData('user')
      if (!globalUserData || !globalUserData.createdUserId) {
        throw new Error('全局测试数据不存在，请确保用户创建模块先执行')
      }

      username = globalUserData.username
      originalPassword = globalUserData.password
      testUserId = globalUserData.createdUserId

      console.log('[修改密码 before] 获取全局测试数据成功:', {
        username,
        userId: testUserId,
        password: '***'
      })

      // 使用 admin 登录（确保获取有效的 token）
      const loginResponse = await apiClient.post(
        '/auth/login',
        {
          username: 'admin',
          password: 'admin123'
        },
        { expect: 'success' }
      )
      adminToken = loginResponse.datum.accessToken
      apiClient.setToken(adminToken)
      console.log('[修改密码 before] Admin 登录成功')
    } catch (error) {
      console.error('[修改密码 before] 初始化失败:', error.message)
      throw error
    }
  })

  test('修改密码 - 正常情况', async () => {
    if (!testUserId) {
      test.skip('测试用户不存在，跳过此测试')
      return
    }

    console.log('[修改密码] 使用全局动态密码登录，用户名:', username)

    // 使用全局动态生成的密码登录
    const loginResponse = await apiClient.post(
      '/auth/login',
      {
        username: username,
        password: originalPassword
      },
      { expect: 'success' }
    )

    testUserToken = loginResponse.datum.accessToken
    apiClient.setToken(testUserToken)

    // 修改密码（使用新随机密码）
    const newPassword = originalPassword + '_new'
    let response = await apiClient.post(
      '/auth/change-password',
      {
        oldPassword: originalPassword,
        newPassword: newPassword
      },
      { expect: 'success' }
    )

    // 使用新密码登录验证
    const newLoginResponse = await apiClient.post(
      '/auth/login',
      {
        username: username,
        password: newPassword
      },
      { expect: 'success' }
    )

    testUserToken = newLoginResponse.datum.accessToken
    apiClient.setToken(testUserToken)

    // 修改回原密码
    response = await apiClient.post(
      '/auth/change-password',
      {
        oldPassword: newPassword,
        newPassword: originalPassword
      },
      { expect: 'success' }
    )

    // 验证可以用原密码登录
    const finalLoginResponse = await apiClient.post(
      '/auth/login',
      {
        username: username,
        password: originalPassword
      },
      { expect: 'success' }
    )

    testUserToken = finalLoginResponse.datum.accessToken
    apiClient.setToken(testUserToken)

    console.log('[修改密码] 正常情况测试通过')
  })

  test('修改密码 - 旧密码错误', async () => {
    if (!testUserId) {
      test.skip('测试用户不存在，跳过此测试')
      return
    }

    const loginResponse = await apiClient.post(
      '/auth/login',
      {
        username: username,
        password: originalPassword
      },
      { expect: 'success' }
    )

    apiClient.setToken(loginResponse.datum.accessToken)

    await apiClient.post(
      '/auth/change-password',
      {
        oldPassword: 'wrongpassword',
        newPassword: 'NewPassword123'
      },
      { expect: 'error' }
    )
  })

  test('修改密码 - 缺少旧密码', async () => {
    if (!testUserId) {
      test.skip('测试用户不存在，跳过此测试')
      return
    }

    const loginResponse = await apiClient.post(
      '/auth/login',
      {
        username: username,
        password: originalPassword
      },
      { expect: 'success' }
    )

    apiClient.setToken(loginResponse.datum.accessToken)

    await apiClient.post(
      '/auth/change-password',
      {
        newPassword: 'NewPassword123'
      },
      { expect: 'error' }
    )
  })

  test('修改密码 - 缺少新密码', async () => {
    if (!testUserId) {
      test.skip('测试用户不存在，跳过此测试')
      return
    }

    const loginResponse = await apiClient.post(
      '/auth/login',
      {
        username: username,
        password: originalPassword
      },
      { expect: 'success' }
    )

    apiClient.setToken(loginResponse.datum.accessToken)

    await apiClient.post(
      '/auth/change-password',
      {
        oldPassword: originalPassword
      },
      { expect: 'error' }
    )
  })

  test('修改密码 - 新密码太短（少于6位）', async () => {
    if (!testUserId) {
      test.skip('测试用户不存在，跳过此测试')
      return
    }

    const loginResponse = await apiClient.post(
      '/auth/login',
      {
        username: username,
        password: originalPassword
      },
      { expect: 'success' }
    )

    apiClient.setToken(loginResponse.datum.accessToken)

    await apiClient.post(
      '/auth/change-password',
      {
        oldPassword: originalPassword,
        newPassword: '12345'
      },
      { expect: 'error' }
    )
  })

  test('修改密码 - 新密码与旧密码相同', async () => {
    if (!testUserId) {
      test.skip('测试用户不存在，跳过此测试')
      return
    }

    const loginResponse = await apiClient.post(
      '/auth/login',
      {
        username: username,
        password: originalPassword
      },
      { expect: 'success' }
    )

    apiClient.setToken(loginResponse.datum.accessToken)

    const response = await apiClient.post(
      '/auth/change-password',
      {
        oldPassword: originalPassword,
        newPassword: originalPassword
      },
      { expect: 'success' }
    )
  })

  test('修改密码 - 新密码包含数字和字母组合', async () => {
    if (!testUserId) {
      test.skip('测试用户不存在，跳过此测试')
      return
    }

    const loginResponse = await apiClient.post(
      '/auth/login',
      {
        username: username,
        password: originalPassword
      },
      { expect: 'success' }
    )

    apiClient.setToken(loginResponse.datum.accessToken)

    const complexPassword = 'TestPass789'
    let response = await apiClient.post(
      '/auth/change-password',
      {
        oldPassword: originalPassword,
        newPassword: complexPassword
      },
      { expect: 'success' }
    )

    // 使用新密码登录（因为修改密码会注销旧 session）
    let newLoginResponse = await apiClient.post(
      '/auth/login',
      {
        username: username,
        password: complexPassword
      },
      { expect: 'success' }
    )

    testUserToken = newLoginResponse.datum.accessToken
    apiClient.setToken(testUserToken)

    // 修改回原密码
    response = await apiClient.post(
      '/auth/change-password',
      {
        oldPassword: complexPassword,
        newPassword: originalPassword
      },
      { expect: 'success' }
    )

    // 再次使用原密码登录（恢复 session）
    let finalLoginResponse = await apiClient.post(
      '/auth/login',
      {
        username: username,
        password: originalPassword
      },
      { expect: 'success' }
    )

    testUserToken = finalLoginResponse.datum.accessToken
    apiClient.setToken(testUserToken)

    console.log('[修改密码] 数字字母组合测试通过')
  })

  test('修改密码 - 未登录状态', async () => {
    const tempClient = createApiClient()

    await tempClient.post(
      '/auth/change-password',
      {
        oldPassword: originalPassword,
        newPassword: 'NewPassword123'
      },
      { expect: 'error' }
    )
  })

  test('修改密码 - 参数为空对象', async () => {
    if (!testUserId) {
      test.skip('测试用户不存在，跳过此测试')
      return
    }

    const loginResponse = await apiClient.post(
      '/auth/login',
      {
        username: username,
        password: originalPassword
      },
      { expect: 'success' }
    )

    apiClient.setToken(loginResponse.datum.accessToken)

    await apiClient.post('/auth/change-password', {}, { expect: 'error' })
  })

  test('修改密码 - 使用过期token', async () => {
    if (!testUserId) {
      test.skip('测试用户不存在，跳过此测试')
      return
    }

    const fakeToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDAwMH0.fake'
    apiClient.setToken(fakeToken)

    await apiClient.post(
      '/auth/change-password',
      {
        oldPassword: originalPassword,
        newPassword: 'NewPassword123'
      },
      { expect: 'error' }
    )
  })

  // 最后一个测试：完整流程测试
  test('修改密码 - 完整流程测试（最后一个测试）', async () => {
    if (!testUserId) {
      test.skip('测试用户不存在，跳过此测试')
      return
    }

    let login = await apiClient.post(
      '/auth/login',
      {
        username: username,
        password: originalPassword
      },
      { expect: 'success' }
    )
    apiClient.setToken(login.datum.accessToken)

    // 第一次修改：使用动态生成的密码
    const password1 = originalPassword + '_1'
    let response1 = await apiClient.post(
      '/auth/change-password',
      {
        oldPassword: originalPassword,
        newPassword: password1
      },
      { expect: 'success' }
    )

    // 验证新密码并重新登录
    let login1 = await apiClient.post(
      '/auth/login',
      {
        username: username,
        password: password1
      },
      { expect: 'success' }
    )
    apiClient.setToken(login1.datum.accessToken)

    // 第二次修改
    const password2 = originalPassword + '_2'
    let response2 = await apiClient.post(
      '/auth/change-password',
      {
        oldPassword: password1,
        newPassword: password2
      },
      { expect: 'success' }
    )

    // 验证新密码并重新登录
    let login2 = await apiClient.post(
      '/auth/login',
      {
        username: username,
        password: password2
      },
      { expect: 'success' }
    )
    apiClient.setToken(login2.datum.accessToken)

    // 恢复初始密码
    let response3 = await apiClient.post(
      '/auth/change-password',
      {
        oldPassword: password2,
        newPassword: originalPassword
      },
      { expect: 'success' }
    )

    // 验证初始密码
    let login3 = await apiClient.post(
      '/auth/login',
      {
        username: username,
        password: originalPassword
      },
      { expect: 'success' }
    )

    console.log('[修改密码] 完整流程测试结束，密码已恢复为初始值')
  })

  // 测试结束后不需要删除用户，因为数据清理脚本会处理
})
