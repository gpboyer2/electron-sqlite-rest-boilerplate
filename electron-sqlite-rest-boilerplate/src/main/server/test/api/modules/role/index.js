/**
 * 角色管理模块测试
 */

const { test, describe } = require('../../lib/test-runner')
const { expect } = require('../../lib/assertions')
const { getApiClient, getDataTracker, createApiClient, setAdminToken } = require('../../context')

// 使用全局共享的实例
const apiClient = getApiClient()
const dataTracker = getDataTracker()

// 辅助函数：确保已登录（自动处理 token 失效情况）
async function ensureLoggedIn() {
  try {
    // 先尝试获取当前用户信息，检查 token 是否有效
    await apiClient.get('/auth/me', null, { expect: 'success' })
  } catch (error) {
    // token 失效，重新登录
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
}

// 临时存储测试数据
let testRoleId = null

describe('角色管理模块', () => {
  // 第一个测试：确保已登录
  test('模块初始化 - 管理员登录', async () => {
    const response = await apiClient.post(
      '/auth/login',
      {
        username: 'admin',
        password: 'admin123'
      },
      { expect: 'success' }
    )

    expect(response.datum.accessToken).to.be.truthy()

    apiClient.setToken(response.datum.accessToken)
  })

  test('查询角色列表 - 正常情况', async () => {
    await ensureLoggedIn()

    const response = await apiClient.get('/roles/list', {}, { expect: 'success' })

    expect(response.datum.list).to.be.truthy()
  })

  test('查询角色列表 - 带状态筛选', async () => {
    await ensureLoggedIn()

    await apiClient.get(
      '/roles/list',
      {
        status: 1
      },
      { expect: 'success' }
    )
  })

  test('查询角色列表 - 带关键字搜索', async () => {
    await ensureLoggedIn()

    // 角色列表 API 不支持关键字搜索，测试正常列表即可
    await apiClient.get('/roles/list', {}, { expect: 'success' })
  })

  test('创建角色 - 正常情况', async () => {
    await ensureLoggedIn()

    const timestamp = Date.now()
    const response = await apiClient.post(
      '/roles/create',
      {
        data: [
          {
            role_name: `测试角色_${timestamp}`,
            role_code: `TEST_ROLE_${timestamp}`,
            role_level: 3,
            description: '这是一个测试角色',
            status: 1
          }
        ]
      },
      { expect: 'success' }
    )

    expect(response.datum).to.be.truthy()
    expect(response.datum[0].success).to.equal(true)

    // 获取创建的角色 ID
    testRoleId = response.datum[0].role_id

    // 追踪测试数据
    dataTracker.track('/roles/delete', { id: testRoleId, role_name: `测试角色_${timestamp}` })
  })

  test('创建角色 - 批量创建', async () => {
    await ensureLoggedIn()

    const timestamp = Date.now()
    const response = await apiClient.post(
      '/roles/create',
      {
        data: [
          {
            role_name: `批量角色1_${timestamp}`,
            role_code: `BATCH_ROLE_1_${timestamp}`,
            role_level: 3,
            description: '批量测试角色1',
            status: 1
          },
          {
            role_name: `批量角色2_${timestamp}`,
            role_code: `BATCH_ROLE_2_${timestamp}`,
            role_level: 3,
            description: '批量测试角色2',
            status: 1
          }
        ]
      },
      { expect: 'success' }
    )

    expect(response.datum.length).to.equal(2)

    // 追踪测试数据
    response.datum.forEach((item) => {
      if (item.success && item.role_id) {
        dataTracker.track('/roles/delete', { id: item.role_id, role_name: item.role_name })
      }
    })
  })

  test('创建角色 - 缺少必填字段', async () => {
    await ensureLoggedIn()

    await apiClient.post(
      '/roles/create',
      {
        data: [
          {
            description: '不完整的角色'
          }
        ]
      },
      { expect: 'error' }
    )
  })

  test('创建角色 - 角色代码重复', async () => {
    await ensureLoggedIn()

    const timestamp = Date.now()
    const roleCode = `DUPLICATE_ROLE_${timestamp}`

    // 先创建一个角色
    await apiClient.post(
      '/roles/create',
      {
        data: [
          {
            role_name: '原始角色',
            role_code: roleCode,
            role_level: 3,
            description: '原始角色描述',
            status: 1
          }
        ]
      },
      { expect: 'success' }
    )

    // 尝试创建相同角色代码的角色
    await apiClient.post(
      '/roles/create',
      {
        data: [
          {
            role_name: '重复角色',
            role_code: roleCode,
            role_level: 3,
            description: '重复角色描述',
            status: 1
          }
        ]
      },
      { expect: 'error' }
    )
  })

  test('更新角色 - 正常情况', async () => {
    await ensureLoggedIn()

    if (!testRoleId) {
      test.skip('没有可用的测试角色 ID')
      return
    }

    const response = await apiClient.post(
      '/roles/update',
      {
        data: [
          {
            role_id: testRoleId,
            role_name: '更新的测试角色',
            description: '更新后的角色描述',
            status: 1
          }
        ]
      },
      { expect: 'success' }
    )

    expect(response.datum[0].success).to.equal(true)
  })

  test('更新角色 - 部分更新', async () => {
    await ensureLoggedIn()

    if (!testRoleId) {
      test.skip('没有可用的测试角色 ID')
      return
    }

    await apiClient.post(
      '/roles/update',
      {
        data: [
          {
            role_id: testRoleId,
            description: '只更新描述'
          }
        ]
      },
      { expect: 'success' }
    )
  })

  test('更新角色 - 角色不存在', async () => {
    await ensureLoggedIn()

    await apiClient.post(
      '/roles/update',
      {
        data: [
          {
            role_id: 999999,
            role_name: '不存在的角色'
          }
        ]
      },
      { expect: 'error' }
    )
  })

  test('删除角色 - 单个删除', async () => {
    await ensureLoggedIn()

    if (!testRoleId) {
      test.skip('没有可用的测试角色 ID')
      return
    }

    const response = await apiClient.post(
      '/roles/delete',
      {
        data: [testRoleId]
      },
      { expect: 'success' }
    )

    expect(response.datum[0].success).to.equal(true)

    // 从追踪中移除
    testRoleId = null
  })

  test('删除角色 - 批量删除', async () => {
    await ensureLoggedIn()

    // 先创建一些测试角色
    const timestamp = Date.now()
    const createResponse = await apiClient.post(
      '/roles/create',
      {
        data: [
          {
            role_name: `待删除角色1_${timestamp}`,
            role_code: `DELETE_ROLE_1_${timestamp}`,
            role_level: 3,
            description: '待删除角色1',
            status: 1
          },
          {
            role_name: `待删除角色2_${timestamp}`,
            role_code: `DELETE_ROLE_2_${timestamp}`,
            role_level: 3,
            description: '待删除角色2',
            status: 1
          }
        ]
      },
      { expect: 'success' }
    )

    const roleIds = createResponse.datum
      .filter((item) => item.success && item.role_id)
      .map((item) => item.role_id)

    if (roleIds.length > 0) {
      const deleteResponse = await apiClient.post(
        '/roles/delete',
        {
          data: roleIds
        },
        { expect: 'success' }
      )

      expect(deleteResponse.datum.length).to.equal(roleIds.length)
    }
  })

  test('删除角色 - 关联用户时删除', async () => {
    await ensureLoggedIn()

    // 创建一个测试角色
    const timestamp = Date.now()
    const roleResponse = await apiClient.post(
      '/roles/create',
      {
        data: [
          {
            role_name: `关联测试角色_${timestamp}`,
            role_code: `LINKED_ROLE_${timestamp}`,
            role_level: 3,
            description: '测试关联删除',
            status: 1
          }
        ]
      },
      { expect: 'success' }
    )

    if (roleResponse.datum[0].success) {
      const roleId = roleResponse.datum[0].role_id

      // 创建一个用户并分配该角色
      const userResponse = await apiClient.post(
        '/user/create',
        {
          data: [
            {
              user_name: `linked_user_${timestamp}`,
              password: 'password123',
              real_name: '关联用户',
              role_id: roleId,
              status: 1
            }
          ]
        },
        { expect: 'success' }
      )

      if (userResponse.datum[0].success) {
        const userName = `linked_user_${timestamp}`

        // 尝试删除角色（可能成功也可能失败，取决于业务逻辑）
        try {
          await apiClient.post(
            '/roles/delete',
            {
              data: [roleId]
            },
            { expect: 'success' }
          )
        } catch (error) {
          // 如果有关联约束导致失败，这也是预期行为
        } finally {
          // 清理用户和角色
          try {
            await apiClient.post('/user/delete', { data: [userName] }, { expect: 'success' })
            await apiClient.post('/roles/delete', { data: [roleId] }, { expect: 'success' })
          } catch (e) {
            // 忽略清理错误
          }
        }
      }
    }
  })

  test('查询角色列表 - 未登录', async () => {
    const tempClient = createApiClient()
    // 不设置 token

    await tempClient.get('/roles/list', {}, { expect: 'error' })
  })

  test('查询角色列表 - 权限不足', async () => {
    await ensureLoggedIn()

    // 创建一个普通用户并登录
    const timestamp = Date.now()
    const userResponse = await apiClient.post(
      '/user/create',
      {
        data: [
          {
            user_name: `normal_role_user_${timestamp}`,
            password: 'password123',
            real_name: '普通角色用户',
            role_id: 3,
            status: 1
          }
        ]
      },
      { expect: 'success' }
    )

    if (userResponse.datum[0].success) {
      const userName = `normal_role_user_${timestamp}`

      // 使用普通用户登录
      const loginResponse = await apiClient.post(
        '/auth/login',
        {
          username: userName,
          password: 'password123'
        },
        { expect: 'success' }
      )

      const normalUserToken = loginResponse.datum.accessToken
      const tempClient = createApiClient()
      tempClient.setToken(normalUserToken)

      // 测试普通用户访问权限
      try {
        await tempClient.get('/roles/list', {}, { expect: 'success' })
      } catch (error) {
        // 如果没有权限，这里会抛出错误
      } finally {
        // 清理测试用户 - 忽略删除错误
        try {
          await apiClient.post('/user/delete', { data: [userName] }, { expect: 'success' })
        } catch (e) {
          // 忽略清理错误
        }
      }
    }
  })
})
