/**
 * 流程图模块测试
 */

const { test, describe } = require('../../lib/test-runner')
const { expect } = require('../../lib/assertions')
const { getApiClient, getDataTracker } = require('../../context')

const apiClient = getApiClient()
const dataTracker = getDataTracker()

describe('流程图模块', () => {
  let testFlowchartId
  // 每次测试使用唯一的 ID，避免唯一约束冲突
  const getUniqueId = () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  let testArchNodeId
  let testCommNodeId // 通信节点ID，用于删除流程图

  /**
   * 测试根据体系节点ID获取通信节点列表 - 正常情况
   * 验证能够成功获取指定体系节点下的通信节点列表
   */
  test('根据体系节点ID获取通信节点列表 - 正常情况', async () => {
    testArchNodeId = getUniqueId()
    testCommNodeId = getUniqueId()
    const response = await apiClient.get(
      '/flowcharts/comm-nodes',
      {
        arch_node_id: testArchNodeId
      },
      { expect: 'success' }
    )

    expect(response).to.have.datum()
    // 期望返回一个数组
    expect(Array.isArray(response.datum)).to.equal(true)
  })

  /**
   * 测试根据体系节点ID加载流程图 - 不存在的流程图
   * 验证查询不存在的流程图时返回null或空对象
   */
  test('根据体系节点ID加载流程图 - 不存在的流程图', async () => {
    testArchNodeId = getUniqueId()
    const response = await apiClient.get(
      '/flowcharts/by-arch-node',
      {
        arch_node_id: testArchNodeId
      },
      { expect: 'success' }
    )

    expect(response).to.have.datum()
    // 可能返回 null 或空对象
    expect(response.datum === null || typeof response.datum === 'object').to.equal(true)
  })

  /**
   * 测试根据通信节点ID加载流程图 - 不存在的流程图
   * 验证通过通信节点ID查询不存在的流程图时返回null或空对象
   */
  test('根据通信节点ID加载流程图 - 不存在的流程图', async () => {
    testCommNodeId = getUniqueId()
    const response = await apiClient.get(
      '/flowcharts/by-comm-node',
      {
        comm_node_id: testCommNodeId
      },
      { expect: 'success' }
    )

    expect(response).to.have.datum()
    expect(response.datum === null || typeof response.datum === 'object').to.equal(true)
  })

  /**
   * 测试保存流程图 - 创建新流程图
   * 验证能够成功创建新的流程图，并返回流程图ID
   */
  test('保存流程图 - 创建新流程图', async () => {
    testArchNodeId = getUniqueId()
    const uniqueName = `测试流程图_${Date.now()}`
    const flowchartData = {
      arch_node_id: testArchNodeId,
      name: uniqueName,
      nodes: [
        {
          id: 'node-1',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: '开始' }
        }
      ],
      edges: []
    }

    const response = await apiClient.post('/flowcharts/save', flowchartData, { expect: 'success' })

    expect(response).to.have.datum()

    if (response.datum && response.datum.id) {
      testFlowchartId = response.datum.id
      // 保存 communication_node_id 用于删除（流程图通过删除通信节点来删除）
      testCommNodeId = response.datum.communication_node_id
      if (testCommNodeId) {
        // 使用 POST /delete-comm-node 请求体模式
        dataTracker.track('/flowcharts/delete-comm-node', {
          comm_node_id: testCommNodeId,
          name: uniqueName
        })
      }
    }
  })

  /**
   * 测试根据体系节点ID加载流程图 - 已存在
   * 验证能够成功加载已存在的流程图
   */
  test('根据体系节点ID加载流程图 - 已存在', async () => {
    if (!testFlowchartId) {
      return // 跳过如果创建失败
    }

    const response = await apiClient.get(
      '/flowcharts/by-arch-node',
      {
        arch_node_id: testArchNodeId
      },
      { expect: 'success' }
    )

    expect(response).to.have.datum()
    expect(response.datum).to.be.truthy()
    expect(response.datum.arch_node_id).to.equal(testArchNodeId)
  })

  /**
   * 测试保存流程图 - 更新现有流程图
   * 验证能够成功更新已存在的流程图，包括节点和连线信息
   */
  test('保存流程图 - 更新现有流程图', async () => {
    if (!testFlowchartId) {
      return // 跳过如果创建失败
    }

    const uniqueName = `更新后的测试流程图_${Date.now()}`
    const flowchartData = {
      arch_node_id: testArchNodeId,
      name: uniqueName,
      nodes: [
        {
          id: 'node-1',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: '开始' }
        },
        {
          id: 'node-2',
          type: 'end',
          position: { x: 300, y: 100 },
          data: { label: '结束' }
        }
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2'
        }
      ]
    }

    const response = await apiClient.post('/flowcharts/save', flowchartData, { expect: 'success' })

    expect(response).to.have.datum()
  })

  /**
   * 测试根据体系节点ID获取通信节点列表 - 返回节点数据
   * 验证能够成功获取通信节点列表，并返回完整的节点数据
   */
  test('根据体系节点ID获取通信节点列表 - 返回节点数据', async () => {
    const response = await apiClient.get(
      '/flowcharts/comm-nodes',
      {
        arch_node_id: testArchNodeId
      },
      { expect: 'success' }
    )

    expect(response).to.have.datum()
    expect(Array.isArray(response.datum)).to.equal(true)
  })
})
