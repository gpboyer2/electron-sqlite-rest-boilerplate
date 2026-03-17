/**
 * 拓扑展示模块测试
 */

const { test, describe } = require('../../lib/test-runner')
const { expect } = require('../../lib/assertions')
const { getApiClient, getDataTracker } = require('../../context')

const apiClient = getApiClient()
const dataTracker = getDataTracker()

// 辅助函数：获取有效的 node_type_id
async function getValidNodeTypeId() {
  try {
    const response = await apiClient.get(
      '/hierarchy/hierarchy-levels/list',
      {},
      { expect: 'success' }
    )
    if (response.datum && response.datum.length > 0) {
      return response.datum[0].id
    }
    return null
  } catch (error) {
    return null
  }
}

describe('拓扑展示模块', () => {
  let validNodeTypeId

  test('获取有效的节点类型ID', async () => {
    validNodeTypeId = await getValidNodeTypeId()
    expect(validNodeTypeId).to.be.truthy()
  })

  test('获取拓扑数据 - 正常情况', async () => {
    const response = await apiClient.get('/topology/nodes', {}, { expect: 'success' })

    expect(response.datum !== null).to.equal(true)
  })

  test('获取通信节点列表 - 正常情况', async () => {
    const response = await apiClient.get('/communication-nodes', {}, { expect: 'success' })

    expect(Array.isArray(response.datum)).to.equal(true)
  })

  test('获取体系节点树 - 正常情况', async () => {
    const response = await apiClient.get(
      '/system-level-design-tree/nodes',
      {},
      { expect: 'success' }
    )

    expect(Array.isArray(response.datum)).to.equal(true)
  })

  test('获取体系节点详情 - 不存在的节点', async () => {
    const response = await apiClient.get(
      '/system-level-design-tree/nodes/detail',
      {
        id: 'non-existent-id'
      },
      { expect: 'success' }
    )

    expect(response === null || response.datum === null).to.equal(true)
  })

  test('获取子节点 - 根节点', async () => {
    // 查询根节点：不传 parentId 或传 "null"
    const response = await apiClient.get(
      '/system-level-design-tree/nodes/children',
      {
        parentId: 'null'
      },
      { expect: 'success' }
    )

    expect(Array.isArray(response.datum)).to.equal(true)
  })

  test('获取子节点 - 不存在的父节点', async () => {
    const response = await apiClient.get(
      '/system-level-design-tree/nodes/children',
      {
        parentId: 'non-existent-parent'
      },
      { expect: 'success' }
    )

    expect(Array.isArray(response.datum)).to.equal(true)
  })

  test('创建体系节点 - 正常情况', async () => {
    if (!validNodeTypeId) {
      validNodeTypeId = await getValidNodeTypeId()
    }

    if (!validNodeTypeId) {
      console.log('[topology] 没有有效的 node_type_id，跳过创建测试')
      return
    }

    const nodeData = {
      node_type_id: validNodeTypeId,
      properties: {
        name: '测试拓扑节点-' + Date.now()
      },
      parent_id: null,
      description: '测试拓扑节点'
    }

    const response = await apiClient.post('/system-level-design-tree/nodes/create', [nodeData], {
      expect: 'success'
    })

    if (response.datum && response.datum.created && response.datum.created.length > 0) {
      const nodeId = response.datum.created[0]
      dataTracker.track('/system-level-design-tree/nodes/delete', {
        id: nodeId,
        name: nodeData.properties.name
      })
    }
  })

  test('创建体系节点 - 无效的 node_type_id', async () => {
    await apiClient.post(
      '/system-level-design-tree/nodes/create',
      [
        {
          node_type_id: 'invalid-node-type-id',
          properties: {
            name: '测试节点'
          }
        }
      ],
      { expect: 'error' }
    )
  })

  test('根据层级节点ID获取通信节点 - 正常情况', async () => {
    const nodeId = 1
    const response = await apiClient.get(
      '/communication-nodes/by-node',
      { node_id: nodeId },
      { expect: 'success' }
    )

    expect(Array.isArray(response.datum)).to.equal(true)
  })

  test('根据层级节点ID获取通信节点 - 不存在的节点', async () => {
    const nodeId = 999999
    const response = await apiClient.get(
      '/communication-nodes/by-node',
      { node_id: nodeId },
      { expect: 'success' }
    )

    expect(Array.isArray(response.datum)).to.equal(true)
  })
})
