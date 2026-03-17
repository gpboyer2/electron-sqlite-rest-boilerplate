/**
 * 用户管理模块测试
 *
 * 测试架构约束（永久遵循）：
 * 1. 使用 Mock.js 动态生成所有测试数据
 * 2. 将创建成功的用户 ID 保存到全局变量，供后续模块使用
 * 3. 修改密码测试在最后执行，依赖此处保存的全局数据
 */

const { test, describe, before, beforeEach } = require('../../lib/test-runner')
const { expect } = require('../../lib/assertions')
const { getApiClient, getDataTracker, createApiClient } = require('../../context')
const {
  initializeGlobalTestData,
  getTestData,
  setTestData
} = require('../../utils/mock-data-generator')

// 使用全局共享的实例
const apiClient = getApiClient()
const dataTracker = getDataTracker()

// 临时存储测试数据
let testUserId = null

// 辅助函数：确保已登录
async function ensureLoggedIn() {
  const currentToken = apiClient.getToken()
  if (currentToken) {
    try {
      await apiClient.get('/auth/me', {}, { expect: 'success' })
      return currentToken
    } catch (error) {
      // token 无效，继续执行登录
    }
  }
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
  return token
}

describe('用户管理模块', () => {
  // 在所有测试前执行：初始化全局测试数据并登录
  before(async () => {
    console.log('[用户模块 before] 初始化全局测试数据...')
    // 初始化 Mock.js 全局测试数据
    initializeGlobalTestData()
    console.log('[用户模块 before] 全局测试数据初始化完成')

    await ensureLoggedIn()
  })

  // 每个测试前确保 token 有效
  beforeEach(async () => {
    await ensureLoggedIn()
  })

  test('查询用户列表 - 正常情况', async () => {
    const response = await apiClient.get(
      '/user/list',
      {
        current_page: 1,
        page_size: 10
      },
      { expect: 'success' }
    )

    expect(response.datum.list).to.be.truthy()
    expect(response.datum.pagination).to.be.truthy()
  })

  test('查询用户列表 - 带关键字搜索', async () => {
    const response = await apiClient.get(
      '/user/list',
      {
        current_page: 1,
        page_size: 10,
        keyword: 'admin'
      },
      { expect: 'success' }
    )
  })

  test('查询用户列表 - 分页测试', async () => {
    const response = await apiClient.get(
      '/user/list',
      {
        current_page: 1,
        page_size: 5
      },
      { expect: 'success' }
    )

    expect(response.datum.pagination.current_page).to.equal(1)
    expect(response.datum.pagination.page_size).to.equal(5)
  })

  test('创建用户 - 正常情况（使用全局 Mock 数据）', async () => {
    // 获取全局动态生成的测试数据
    let userData = getTestData('user')

    // 尝试创建用户，如果用户名已存在则重新生成用户名
    let response = await apiClient.post(
      '/user/create',
      {
        data: [
          {
            user_name: userData.username,
            password: userData.password,
            real_name: userData.realName,
            email: userData.email,
            phone: userData.phone,
            role_id: userData.roleId,
            status: userData.status
          }
        ]
      },
      { expect: 'success' }
    )

    // 如果用户名已存在，重新生成用户名
    if (response.status === 'error' && response.message.includes('用户名已存在')) {
      console.log('[用户模块] 用户名已存在，重新生成...')
      const Mock = require('mockjs')
      const randomSuffix = Mock.Random.string('number', 4)
      userData = {
        ...userData,
        username: `test_user_${randomSuffix}`
      }

      response = await apiClient.post(
        '/user/create',
        {
          data: [
            {
              user_name: userData.username,
              password: userData.password,
              real_name: userData.realName,
              email: userData.email,
              phone: userData.phone,
              role_id: userData.roleId,
              status: userData.status
            }
          ]
        },
        { expect: 'success' }
      )
    }

    expect(response.datum[0].success).to.equal(true)

    // 保存创建的用户 ID 到全局变量（供修改密码测试使用）
    const createdUserId = response.datum[0].user_id
    setTestData('user', {
      ...userData,
      createdUserId: createdUserId
    })

    testUserId = createdUserId
    dataTracker.track('/user/delete', { id: testUserId, user_name: userData.username })

    console.log('[用户模块] 全局测试用户创建成功:', {
      username: userData.username,
      userId: createdUserId,
      password: '***'
    })
  })

  test('创建用户 - 批量创建', async () => {
    const timestamp = Date.now()
    const response = await apiClient.post(
      '/user/create',
      {
        data: [
          {
            user_name: `batch_user_1_${timestamp}`,
            password: 'password123',
            real_name: '批量用户1',
            role_id: 2,
            status: 1
          },
          {
            user_name: `batch_user_2_${timestamp}`,
            password: 'password123',
            real_name: '批量用户2',
            role_id: 2,
            status: 1
          }
        ]
      },
      { expect: 'success' }
    )

    expect(response.datum.length).to.equal(2)

    // 追踪测试数据
    response.datum.forEach((item) => {
      if (item.success && item.user_id) {
        dataTracker.track('/user/delete', { id: item.user_id, user_name: item.user_name })
      }
    })
  })

  test('创建用户 - 缺少必填字段', async () => {
    await apiClient.post(
      '/user/create',
      {
        data: [
          {
            real_name: '不完整用户'
          }
        ]
      },
      { expect: 'error' }
    )
  })

  test('创建用户 - 用户名重复', async () => {
    const timestamp = Date.now()
    const userName = `duplicate_user_${timestamp}`

    // 先创建一个用户
    await apiClient.post(
      '/user/create',
      {
        data: [
          {
            user_name: userName,
            password: 'password123',
            real_name: '原始用户',
            role_id: 2,
            status: 1
          }
        ]
      },
      { expect: 'success' }
    )

    // 尝试创建相同用户名的用户
    await apiClient.post(
      '/user/create',
      {
        data: [
          {
            user_name: userName,
            password: 'password123',
            real_name: '重复用户',
            role_id: 2,
            status: 1
          }
        ]
      },
      { expect: 'error' }
    )
  })

  test('更新用户 - 正常情况', async () => {
    if (!testUserId) {
      test.skip('没有可用的测试用户 ID')
      return
    }

    const response = await apiClient.post(
      '/user/update',
      {
        data: [
          {
            user_id: testUserId,
            real_name: '更新的测试用户',
            email: 'updated@example.com',
            status: 1
          }
        ]
      },
      { expect: 'success' }
    )

    expect(response.datum[0].success).to.equal(true)
  })

  test('更新用户 - 部分更新', async () => {
    if (!testUserId) {
      test.skip('没有可用的测试用户 ID')
      return
    }

    await apiClient.post(
      '/user/update',
      {
        data: [
          {
            user_id: testUserId,
            phone: '13900139000'
          }
        ]
      },
      { expect: 'success' }
    )
  })

  test('更新用户 - 用户不存在', async () => {
    await apiClient.post(
      '/user/update',
      {
        data: [
          {
            user_id: 999999,
            real_name: '不存在的用户'
          }
        ]
      },
      { expect: 'error' }
    )
  })

  test('查询用户列表 - 未登录', async () => {
    const tempClient = createApiClient()
    // 不设置 token

    await tempClient.get('/user/list', null, { expect: 'error' })
  })

  test('查询用户列表 - 权限不足', async () => {
    // 使用独立的 ApiClient，避免污染共享的 apiClient
    const tempClient = createApiClient()
    const timestamp = Date.now()

    // 先用 admin 登录 tempClient
    const adminLoginResponse = await tempClient.post(
      '/auth/login',
      {
        username: 'admin',
        password: 'admin123'
      },
      { expect: 'success' }
    )
    tempClient.setToken(adminLoginResponse.datum.accessToken)

    // 用 admin 创建普通用户
    const createResponse = await tempClient.post(
      '/user/create',
      {
        data: [
          {
            user_name: `normal_user_${timestamp}`,
            password: 'password123',
            real_name: '普通用户',
            role_id: 3,
            status: 1
          }
        ]
      },
      { expect: 'success' }
    )

    if (createResponse.datum[0].success) {
      const userId = createResponse.datum[0].user_id
      const userName = `normal_user_${timestamp}`

      // 使用普通用户登录
      const loginResponse = await tempClient.post(
        '/auth/login',
        {
          username: userName,
          password: 'password123'
        },
        { expect: 'success' }
      )

      tempClient.setToken(loginResponse.datum.accessToken)

      // 验证普通用户无法访问用户列表
      await tempClient.get('/user/list', null, { expect: 'error' })

      // 用 apiClient (admin) 清理测试用户，使用 user_id 而不是 user_name
      await apiClient.post('/user/delete', { data: [userId] }, { expect: 'success' })
    }
  })

  // 删除用户测试放在最后，因为删除后 testUserId 会清空
  test('删除用户 - 单个删除（不删除全局用户）', async () => {
    // 创建一个临时用户用于删除测试，不影响全局用户
    const timestamp = Date.now()
    const tempUserName = `temp_delete_user_${timestamp}`

    const createResponse = await apiClient.post(
      '/user/create',
      {
        data: [
          {
            user_name: tempUserName,
            password: 'password123',
            real_name: '临时删除用户',
            role_id: 2,
            status: 1
          }
        ]
      },
      { expect: 'success' }
    )

    const tempUserId = createResponse.datum[0].user_id

    // 删除刚创建的临时用户
    const response = await apiClient.post(
      '/user/delete',
      {
        data: [tempUserId]
      },
      { expect: 'success' }
    )

    expect(response.datum[0].success).to.equal(true)

    console.log('[用户模块] 临时用户已删除，全局用户保留')
  })

  test('删除用户 - 批量删除', async () => {
    // 先创建一些测试用户
    const timestamp = Date.now()
    const createResponse = await apiClient.post(
      '/user/create',
      {
        data: [
          {
            user_name: `delete_user_1_${timestamp}`,
            password: 'password123',
            real_name: '待删除用户1',
            role_id: 2,
            status: 1
          },
          {
            user_name: `delete_user_2_${timestamp}`,
            password: 'password123',
            real_name: '待删除用户2',
            role_id: 2,
            status: 1
          }
        ]
      },
      { expect: 'success' }
    )

    const userIds = createResponse.datum.filter((item) => item.success).map((item) => item.user_id)

    if (userIds.length > 0) {
      // 通过查询获取实际 user_id
      await apiClient.post(
        '/user/delete',
        {
          data: userIds
        },
        { expect: 'success' }
      )
    }
  })
})
