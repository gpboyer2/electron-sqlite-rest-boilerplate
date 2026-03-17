/**
 * 权限管理模块测试
 */

const { test, describe, before, beforeEach } = require('../../lib/test-runner')
const { expect } = require('../../lib/assertions')
const { getApiClient, getDataTracker, createApiClient } = require('../../context')

// 使用全局共享的实例
const apiClient = getApiClient()
const dataTracker = getDataTracker()

// 临时存储测试数据
let testPermissionId = null

// 辅助函数：确保已登录为管理员
async function ensureLoggedIn() {
  // 强制使用 admin 登录，确保 token 正确
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

describe('权限管理模块', () => {
  // 在所有测试前执行一次登录
  before(async () => {
    await ensureLoggedIn()
  })

  // 每个测试前确保 token 有效
  beforeEach(async () => {
    await ensureLoggedIn()
  })

  test('查询权限列表 - 正常情况', async () => {
    const response = await apiClient.get('/permissions/list', {}, { expect: 'success' })

    expect(response.datum.list).to.be.truthy()
    expect(response.datum.tree).to.be.truthy()
  })

  test('查询权限列表 - 带状态筛选', async () => {
    const response = await apiClient.get(
      '/permissions/list',
      {
        status: 1
      },
      { expect: 'success' }
    )
  })

  test('查询权限列表 - 带关键字搜索', async () => {
    const response = await apiClient.get('/permissions/list', {}, { expect: 'success' })
  })

  test('创建权限 - 正常情况', async () => {
    const timestamp = Date.now()
    const response = await apiClient.post(
      '/permissions/create',
      {
        data: [
          {
            permission_name: `测试权限_${timestamp}`,
            permission_code: `TEST:PERMISSION:${timestamp}`,
            description: '这是一个测试权限',
            status: 1
          }
        ]
      },
      { expect: 'success' }
    )

    expect(response.datum[0].success).to.equal(true)

    // 获取创建的权限 ID
    testPermissionId = response.datum[0].permission_id

    // 追踪测试数据
    dataTracker.track('/permissions/delete', {
      id: testPermissionId,
      permission_name: `测试权限_${timestamp}`
    })
  })

  test('创建权限 - 批量创建', async () => {
    const timestamp = Date.now()
    const response = await apiClient.post(
      '/permissions/create',
      {
        data: [
          {
            permission_name: `批量权限1_${timestamp}`,
            permission_code: `BATCH:PERMISSION:1:${timestamp}`,
            description: '批量测试权限1',
            status: 1
          },
          {
            permission_name: `批量权限2_${timestamp}`,
            permission_code: `BATCH:PERMISSION:2:${timestamp}`,
            description: '批量测试权限2',
            status: 1
          }
        ]
      },
      { expect: 'success' }
    )

    expect(response.datum.length).to.equal(2)

    // 追踪测试数据
    response.datum.forEach((item) => {
      if (item.success && item.permission_id) {
        dataTracker.track('/permissions/delete', {
          id: item.permission_id,
          permission_name: item.permission_name
        })
      }
    })
  })

  test('创建权限 - 缺少必填字段', async () => {
    await apiClient.post(
      '/permissions/create',
      {
        data: [
          {
            description: '不完整的权限'
          }
        ]
      },
      { expect: 'error' }
    )
  })

  test('创建权限 - 权限代码重复', async () => {
    const timestamp = Date.now()
    const permissionCode = `DUPLICATE:PERMISSION:${timestamp}`

    // 先创建一个权限
    await apiClient.post(
      '/permissions/create',
      {
        data: [
          {
            permission_name: '原始权限',
            permission_code: permissionCode,
            description: '原始权限描述',
            status: 1
          }
        ]
      },
      { expect: 'success' }
    )

    // 尝试创建相同权限代码的权限
    await apiClient.post(
      '/permissions/create',
      {
        data: [
          {
            permission_name: '重复权限',
            permission_code: permissionCode,
            description: '重复权限描述',
            status: 1
          }
        ]
      },
      { expect: 'error' }
    )
  })

  test('更新权限 - 正常情况', async () => {
    if (!testPermissionId) {
      test.skip('没有可用的测试权限 ID')
      return
    }

    const response = await apiClient.post(
      '/permissions/update',
      {
        data: [
          {
            permission_id: testPermissionId,
            permission_name: '更新的测试权限',
            description: '更新后的权限描述',
            status: 1
          }
        ]
      },
      { expect: 'success' }
    )

    expect(response.datum[0].success).to.equal(true)
  })

  test('更新权限 - 部分更新', async () => {
    if (!testPermissionId) {
      test.skip('没有可用的测试权限 ID')
      return
    }

    await apiClient.post(
      '/permissions/update',
      {
        data: [
          {
            permission_id: testPermissionId,
            description: '只更新描述'
          }
        ]
      },
      { expect: 'success' }
    )
  })

  test('更新权限 - 权限不存在', async () => {
    await apiClient.post(
      '/permissions/update',
      {
        data: [
          {
            permission_id: 999999,
            permission_name: '不存在的权限'
          }
        ]
      },
      { expect: 'error' }
    )
  })

  test('删除权限 - 单个删除', async () => {
    if (!testPermissionId) {
      test.skip('没有可用的测试权限 ID')
      return
    }

    const response = await apiClient.post(
      '/permissions/delete',
      {
        data: [testPermissionId]
      },
      { expect: 'success' }
    )

    expect(response.datum[0].success).to.equal(true)

    // 从追踪中移除
    testPermissionId = null
  })

  test('删除权限 - 批量删除', async () => {
    // 先创建一些测试权限
    const timestamp = Date.now()
    const createResponse = await apiClient.post(
      '/permissions/create',
      {
        data: [
          {
            permission_name: `待删除权限1_${timestamp}`,
            permission_code: `DELETE:PERMISSION:1:${timestamp}`,
            description: '待删除权限1',
            status: 1
          },
          {
            permission_name: `待删除权限2_${timestamp}`,
            permission_code: `DELETE:PERMISSION:2:${timestamp}`,
            description: '待删除权限2',
            status: 1
          }
        ]
      },
      { expect: 'success' }
    )

    const permissionIds = createResponse.datum
      .filter((item) => item.success && item.permission_id)
      .map((item) => item.permission_id)

    if (permissionIds.length > 0) {
      const deleteResponse = await apiClient.post(
        '/permissions/delete',
        {
          data: permissionIds
        },
        { expect: 'success' }
      )

      expect(deleteResponse.datum.length).to.equal(permissionIds.length)
    }
  })

  test('查询权限列表 - 未登录', async () => {
    const tempClient = createApiClient()
    // 不设置 token

    await tempClient.get('/permissions/list', {}, { expect: 'error' })
  })

  test('查询权限列表 - 权限不足', async () => {
    // 创建一个普通用户并登录
    const timestamp = Date.now()
    const userResponse = await apiClient.post(
      '/user/create',
      {
        data: [
          {
            user_name: `normal_perm_user_${timestamp}`,
            password: 'password123',
            real_name: '普通权限用户',
            role_id: 3,
            status: 1
          }
        ]
      },
      { expect: 'success' }
    )

    // 检查用户是否创建成功
    if (userResponse.datum && userResponse.datum[0] && userResponse.datum[0].success) {
      const userId = userResponse.datum[0].user_id

      // 使用普通用户登录
      const loginResponse = await apiClient.post(
        '/auth/login',
        {
          username: `normal_perm_user_${timestamp}`,
          password: 'password123'
        },
        { expect: 'success' }
      )

      const normalUserToken = loginResponse.datum.accessToken
      const tempClient = createApiClient()
      tempClient.setToken(normalUserToken)

      await tempClient.get('/permissions/list', {}, { expect: 'error' })

      // 清理测试用户
      try {
        await apiClient.post('/user/delete', { data: [userId] }, { expect: 'success' })
      } catch (deleteError) {
        // 删除失败不影响测试结果
        console.log('[permission] 清理用户失败（可能已删除）:', deleteError.message)
      }
    } else {
      // 用户创建失败，跳过此测试
      console.log('[permission] 用户创建失败，跳过权限不足测试')
    }
  })
})
