/**
 * 层级配置模块测试
 */

const { test, describe } = require('../../lib/test-runner')
const { expect } = require('../../lib/assertions')
const { getApiClient, getDataTracker } = require('../../context')

const apiClient = getApiClient()
const dataTracker = getDataTracker()

describe('层级配置模块', () => {
  let testLevelId
  let testNodeId
  let testFieldId

  /**
   * 测试获取层级类型列表 - 正常情况
   * 验证能够成功获取所有层级类型的列表
   */
  test('获取层级类型列表 - 正常情况', async () => {
    const response = await apiClient.get(
      '/hierarchy/hierarchy-levels/list',
      {},
      { expect: 'success' }
    )

    expect(response).to.have.datum()
    expect(Array.isArray(response.datum)).to.equal(true)
  })

  /**
   * 测试创建层级类型 - 正常情况
   * 验证能够成功创建新的层级类型，并返回类型ID
   */
  test('创建层级类型 - 正常情况', async () => {
    const levelData = {
      type_name: 'TEST_LEVEL_' + Date.now(),
      display_name: '测试层级-' + Date.now(),
      description: '这是一个测试层级',
      icon_class: 'test-icon',
      order: 999
    }

    const response = await apiClient.post('/hierarchy/hierarchy-levels/create', levelData, {
      expect: 'success'
    })

    expect(response).to.have.datum()

    if (response.datum && response.datum.id) {
      testLevelId = response.datum.id
      // 追踪数据，使用 POST /delete 模式
      dataTracker.track('/hierarchy/hierarchy-levels/delete', {
        id: testLevelId,
        name: levelData.display_name
      })
    }
  })

  /**
   * 测试获取层级类型详情 - 已存在的层级
   * 验证能够成功获取指定层级类型的详细信息
   */
  test('获取层级类型详情 - 已存在的层级', async () => {
    if (!testLevelId) {
      return // 跳过如果创建失败
    }

    const response = await apiClient.get(
      '/hierarchy/hierarchy-levels/detail',
      {
        id: testLevelId
      },
      { expect: 'success' }
    )

    expect(response).to.have.datum()
    expect(response.datum.id).to.equal(testLevelId)
  })

  /**
   * 测试为层级类型添加字段 - 正常情况
   * 验证能够成功为层级类型添加自定义字段
   */
  test('为层级类型添加字段 - 正常情况', async () => {
    if (!testLevelId) {
      return // 跳过如果创建失败
    }

    const fieldData = {
      id: testLevelId,
      name: 'test_field_' + Date.now(),
      type: 'string',
      required: false,
      defaultValue: '',
      placeholder: '测试字段'
    }

    const response = await apiClient.post('/hierarchy/hierarchy-levels/add-field', fieldData, {
      expect: 'success'
    })

    if (response.datum && response.datum.id) {
      testFieldId = response.datum.id
      // 追踪字段，使用 POST /delete-field 模式
      dataTracker.track('/hierarchy/hierarchy-levels/delete-field', {
        id: testLevelId,
        field_id: testFieldId,
        name: fieldData.name
      })
    }
  })

  /**
   * 测试获取层级节点树 - 正常情况
   * 验证能够成功获取层级节点的树形结构列表
   */
  test('获取层级节点树 - 正常情况', async () => {
    const response = await apiClient.get(
      '/hierarchy/hierarchy-nodes/list',
      {},
      { expect: 'success' }
    )

    expect(response).to.have.datum()
    expect(Array.isArray(response.datum)).to.equal(true)
  })

  /**
   * 测试创建层级节点 - 正常情况
   * 验证能够成功创建层级节点，并返回节点ID
   */
  test('创建层级节点 - 正常情况', async () => {
    if (!testLevelId) {
      return // 跳过如果创建失败
    }

    const nodeData = {
      name: '测试节点-' + Date.now(),
      node_type_id: testLevelId,
      parent_id: null,
      description: '这是一个测试节点'
    }

    const response = await apiClient.post('/hierarchy/hierarchy-nodes/create', nodeData, {
      expect: 'success'
    })

    expect(response).to.have.datum()

    if (response.datum && response.datum.id) {
      testNodeId = response.datum.id
      // 追踪节点，使用 POST /delete 模式
      dataTracker.track('/hierarchy/hierarchy-nodes/delete', {
        id: testNodeId,
        name: nodeData.name
      })
    }
  })

  /**
   * 测试获取层级节点详情 - 已存在的节点
   * 验证能够成功获取指定层级节点的详细信息
   */
  test('获取层级节点详情 - 已存在的节点', async () => {
    if (!testNodeId) {
      return // 跳过如果创建失败
    }

    const response = await apiClient.get(
      '/hierarchy/hierarchy-nodes/detail',
      {
        id: testNodeId
      },
      { expect: 'success' }
    )

    expect(response).to.have.datum()
    expect(response.datum.id).to.equal(testNodeId)
  })

  /**
   * 测试更新层级节点 - 正常情况
   * 验证能够成功更新层级节点的名称和描述信息
   */
  test('更新层级节点 - 正常情况', async () => {
    if (!testNodeId) {
      return // 跳过如果创建失败
    }

    const updateData = {
      id: testNodeId,
      name: '更新后的测试节点',
      description: '更新后的描述'
    }

    const response = await apiClient.post('/hierarchy/hierarchy-nodes/update', updateData, {
      expect: 'success'
    })

    expect(response).to.have.datum()
  })

  /**
   * 测试更新层级类型 - 正常情况
   * 验证能够成功更新层级类型的名称和描述信息
   */
  test('更新层级类型 - 正常情况', async () => {
    if (!testLevelId) {
      return // 跳过如果创建失败
    }

    const updateData = {
      id: testLevelId,
      type_name: 'TEST_LEVEL_' + Date.now(),
      display_name: '更新后的测试层级',
      description: '更新后的描述'
    }

    const response = await apiClient.post('/hierarchy/hierarchy-levels/update', updateData, {
      expect: 'success'
    })

    expect(response).to.have.datum()
  })

  /**
   * 测试获取层级类型列表 - 包含新创建的层级
   * 验证列表中包含新创建的层级类型
   */
  test('获取层级类型列表 - 包含新创建的层级', async () => {
    const response = await apiClient.get(
      '/hierarchy/hierarchy-levels/list',
      {},
      { expect: 'success' }
    )

    expect(response).to.have.datum()
    expect(Array.isArray(response.datum)).to.equal(true)
    // 验证列表中有数据
    expect(response.datum.length).to.be.truthy()
  })
})
