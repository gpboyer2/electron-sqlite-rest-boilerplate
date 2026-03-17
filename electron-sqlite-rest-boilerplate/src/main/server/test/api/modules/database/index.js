/**
 * 数据库管理模块测试
 */

const { test, describe, before, beforeEach } = require('../../lib/test-runner')
const { expect } = require('../../lib/assertions')
const { getApiClient } = require('../../context')

const apiClient = getApiClient()

/**
 * 辅助函数：确保已登录
 * 检查当前客户端是否已登录，如果未登录或token无效则执行登录操作
 * @returns {Promise<string>} 返回登录成功后的 access token
 */
async function ensureLoggedIn() {
  const currentToken = apiClient.getToken()
  if (currentToken) {
    try {
      await apiClient.get('/auth/me', null, { expect: 'success' })
      return currentToken
    } catch (error) {
      // token 无效, 继续执行登录
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

describe('数据库管理模块', () => {
  let testTableName

  /**
   * 测试前置钩子
   * 在所有测试开始前执行一次登录操作
   */
  before(async () => {
    await ensureLoggedIn()
  })

  /**
   * 测试前置钩子
   * 每个测试执行前确保 token 有效
   */
  beforeEach(async () => {
    await ensureLoggedIn()
  })

  /**
   * 测试获取数据库表列表 - 正常情况
   * 验证能够成功获取数据库中的所有表名
   */
  test('获取数据库表列表 - 正常情况', async () => {
    const response = await apiClient.get('/database/tables', {}, { expect: 'success' })

    expect(response.datum.list).to.be.truthy()
    expect(Array.isArray(response.datum.list)).to.equal(true)

    // 保存第一个表名用于后续测试
    if (response.datum.list && response.datum.list.length > 0) {
      testTableName = response.datum.list[0]
    }
  })

  /**
   * 测试获取表结构 - 正常情况
   * 验证能够成功获取指定表的结构信息（字段名、类型等）
   */
  test('获取表结构 - 正常情况', async () => {
    if (!testTableName) {
      return // 跳过如果没有可用的表
    }

    await apiClient.get(
      '/database/schema',
      {
        tableName: testTableName
      },
      { expect: 'success' }
    )
  })

  /**
   * 测试查询表数据 - 正常情况
   * 验证能够成功查询指定表的数据，支持分页
   */
  test('查询表数据 - 正常情况', async () => {
    if (!testTableName) {
      return // 跳过如果没有可用的表
    }

    const response = await apiClient.post(
      '/database/query',
      {
        tableName: testTableName,
        page_num: 1,
        page_size: 10
      },
      { expect: 'success' }
    )

    expect(response.datum.list).to.be.truthy()
    expect(Array.isArray(response.datum.list)).to.equal(true)
  })

  /**
   * 测试执行SQL查询 - 正常情况
   * 验证能够成功执行自定义SQL查询语句
   */
  test('执行SQL查询 - 正常情况', async () => {
    await apiClient.post(
      '/database/execute',
      {
        sql: `SELECT name FROM sqlite_master WHERE type='table' LIMIT 5`
      },
      { expect: 'success' }
    )
  })

  /**
   * 测试查询表数据 - 带搜索条件
   * 验证能够使用搜索、排序等条件查询表数据
   */
  test('查询表数据 - 带搜索条件', async () => {
    if (!testTableName) {
      return // 跳过如果没有可用的表
    }

    await apiClient.post(
      '/database/query',
      {
        tableName: testTableName,
        page_num: 1,
        page_size: 10,
        search: '',
        sort_field: 'id',
        sort_order: 'ASC'
      },
      { expect: 'success' }
    )
  })

  /**
   * 测试获取表结构 - 不存在的表
   * 验证查询不存在的表时返回错误提示
   */
  test('获取表结构 - 不存在的表', async () => {
    await apiClient.get(
      '/database/schema',
      {
        tableName: 'non_existent_table_' + Date.now()
      },
      { expect: 'error' }
    )
  })
})
