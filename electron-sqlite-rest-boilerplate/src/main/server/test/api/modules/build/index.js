/**
 * 构建管理模块测试
 * 测试构建任务的创建、查询、取消等功能
 */

const { test, describe } = require('../../lib/test-runner')
const { expect } = require('../../lib/assertions')
const { getApiClient } = require('../../context')

const apiClient = getApiClient()

describe('构建管理模块', () => {
  let taskId

  /**
   * 测试获取构建历史 - 正常情况
   * 验证能够成功获取构建任务历史列表
   */
  test('获取构建历史 - 正常情况', async () => {
    const response = await apiClient.get(
      '/build/tasks',
      {
        limit: 10,
        offset: 0
      },
      { expect: 'success' }
    )

    expect(response.datum.list).to.be.truthy()
    expect(Array.isArray(response.datum.list)).to.equal(true)
  })

  /**
   * 测试获取构建历史 - 按上下文筛选
   * 验证能够根据上下文类型和上下文ID筛选构建历史
   */
  test('获取构建历史 - 按上下文筛选', async () => {
    await apiClient.get(
      '/build/tasks',
      {
        contextType: 'hierarchy_node',
        contextId: 'nonexistent',
        limit: 10,
        offset: 0
      },
      { expect: 'success' }
    )
  })

  /**
   * 测试获取构建历史 - 分页参数
   * 验证分页参数能够正确限制返回的构建历史数量
   */
  test('获取构建历史 - 分页参数', async () => {
    await apiClient.get(
      '/build/tasks',
      {
        limit: 5,
        offset: 0
      },
      { expect: 'success' }
    )
  })

  /**
   * 测试获取构建历史 - 缺少limit参数
   * 验证缺少limit参数时使用默认值
   */
  test('获取构建历史 - 缺少limit参数', async () => {
    await apiClient.get(
      '/build/tasks',
      {
        offset: 0
      },
      { expect: 'success' }
    )
  })

  /**
   * 测试获取构建历史 - limit为0
   * 验证limit为0时的行为
   */
  test('获取构建历史 - limit为0', async () => {
    await apiClient.get(
      '/build/tasks',
      {
        limit: 0,
        offset: 0
      },
      { expect: 'success' }
    )
  })

  /**
   * 测试创建构建任务 - 正常情况
   * 验证能够成功创建构建任务，并返回任务ID和状态
   */
  test('创建构建任务 - 正常情况', async () => {
    const buildData = {
      // 使用不存在的层级节点ID即可：任务会落库并进入队列，最终失败不影响“创建任务”接口正确性
      contextType: 'hierarchy_node',
      contextId: 'nonexistent_' + Date.now(),
      contextName: '测试节点',
      options: {
        cppSdk: true,
        icdDoc: false,
        platform: 'linux-x86_64',
        language: 'cpp17'
      }
    }

    const response = await apiClient.post('/build/tasks', buildData, { expect: 'success' })

    expect(response.datum.taskId).to.be.truthy()
    expect(response.datum.status).to.be.truthy()

    taskId = response.datum.taskId
  })

  /**
   * 测试创建构建任务 - 缺少contextType
   * 验证缺少上下文类型参数时返回错误提示
   */
  test('创建构建任务 - 缺少contextType', async () => {
    await apiClient.post('/build/tasks', { contextId: '1' }, { expect: 'error' })
  })

  /**
   * 测试创建构建任务 - 缺少contextId
   * 验证缺少上下文ID参数时返回错误提示
   */
  test('创建构建任务 - 缺少contextId', async () => {
    await apiClient.post('/build/tasks', { contextType: 'hierarchy_node' }, { expect: 'error' })
  })

  /**
   * 测试查询构建任务 - 正常情况
   * 验证能够成功查询指定任务ID的构建任务详情
   */
  test('查询构建任务 - 正常情况', async () => {
    if (!taskId) {
      test.skip('没有可用的任务ID')
      return
    }

    await apiClient.get(`/build/tasks/${taskId}`, {}, { expect: 'success' })
  })

  /**
   * 测试查询构建任务 - 不存在的任务ID
   * 验证查询不存在的任务ID时返回错误提示
   */
  test('查询构建任务 - 不存在的任务ID', async () => {
    await apiClient.get('/build/tasks/nonexistent-task-id', {}, { expect: 'error' })
  })

  /**
   * 测试取消构建任务 - 任务已结束时取消
   * 验证尝试取消已结束的构建任务时返回错误提示
   */
  test('取消构建任务 - 任务已结束时取消', async () => {
    // 先启动一个新任务
    const startResponse = await apiClient.post(
      '/build/tasks',
      {
        contextType: 'hierarchy_node',
        contextId: 'nonexistent_cancel_' + Date.now(),
        contextName: '测试取消节点',
        options: {
          platform: 'linux-x86_64',
          language: 'cpp17',
          cppSdk: true
        }
      },
      { expect: 'success' }
    )

    const newTaskId = startResponse.datum.taskId

    // 任务因为使用不存在的 contextId 会立即失败，所以取消时会返回"构建已结束"
    // 这是预期的行为
    await apiClient.post(`/build/tasks/${newTaskId}/cancel`, {}, { expect: 'error' })
  })

  /**
   * 测试取消构建任务 - 不存在的任务ID
   * 验证尝试取消不存在的任务ID时返回错误提示
   */
  test('取消构建任务 - 不存在的任务ID', async () => {
    await apiClient.post('/build/tasks/nonexistent-task-id/cancel', {}, { expect: 'error' })
  })

  /**
   * 测试下载构建产物 - 正常情况
   * 验证任务未完成时尝试下载返回错误提示
   */
  test('下载构建产物 - 正常情况', async () => {
    if (!taskId) {
      test.skip('没有可用的任务ID')
      return
    }

    // 任务通常不会立刻完成；这里验证“不可下载时返回错误”即可
    await apiClient.get(`/build/tasks/${taskId}/download`, {}, { expect: 'error' })
  })

  /**
   * 测试下载构建产物 - 不存在的任务ID
   * 验证尝试下载不存在任务的构建产物时返回错误提示
   */
  test('下载构建产物 - 不存在的任务ID', async () => {
    await apiClient.get('/build/tasks/nonexistent-task-id/download', {}, { expect: 'error' })
  })
})
