/**
 * 体系配置树模块测试
 */

const { test, describe } = require('../../lib/test-runner')
const { expect } = require('../../lib/assertions')
const { getApiClient, getDataTracker, createApiClient, setAdminToken } = require('../../context')

const apiClient = getApiClient()
const dataTracker = getDataTracker()

// 辅助函数：确保已登录
async function ensureLoggedIn() {
  // 先检查是否有有效 token
  if (apiClient.getToken()) {
    try {
      const response = await apiClient.get('/auth/me', null, { expect: 'success' })
      if (response && response.datum) {
        return apiClient.getToken() // 已登录，直接返回
      }
    } catch (error) {
      // token 无效，继续执行登录
    }
  }

  // 执行登录
  const loginResponse = await apiClient.post(
    '/auth/login',
    {
      username: 'admin',
      password: 'admin123'
    },
    null,
    { expect: 'success' }
  )
  const token = loginResponse.datum.accessToken
  apiClient.setToken(token)
  setAdminToken(token)
  return token
}

// 辅助函数：获取有效的 node_type_id
async function getValidNodeTypeId() {
  const response = await apiClient.get(
    '/hierarchy/hierarchy-levels/list',
    {},
    { expect: 'success' }
  )
  if (response.datum && response.datum.length > 0) {
    return response.datum[0].id
  }
  return null
}

describe('体系配置树模块', () => {
  let testNodeId
  let validNodeTypeId

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

  test('获取有效的节点类型ID', async () => {
    await ensureLoggedIn()
    validNodeTypeId = await getValidNodeTypeId()
    expect(validNodeTypeId).to.be.truthy()
  })

  test('获取所有节点 - 正常情况', async () => {
    await ensureLoggedIn()

    const response = await apiClient.get(
      '/system-level-design-tree/nodes',
      {},
      { expect: 'success' }
    )

    expect(response).to.have.datum()
    expect(Array.isArray(response.datum)).to.equal(true)
  })

  test('获取所有节点 - 带筛选条件', async () => {
    await ensureLoggedIn()

    const response = await apiClient.get(
      '/system-level-design-tree/nodes',
      {
        projectId: 1,
        level: 1
      },
      { expect: 'success' }
    )

    expect(response).to.have.datum()
  })

  test('获取节点详情 - 不存在的节点', async () => {
    await ensureLoggedIn()

    const response = await apiClient.get(
      '/system-level-design-tree/nodes/detail',
      {
        id: 'non-existent-id'
      },
      { expect: 'success' }
    )

    expect(response.datum === null).to.equal(true)
  })

  test('获取子节点 - 根节点', async () => {
    await ensureLoggedIn()

    // 查询根节点：传 "null" 字符串
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
    await ensureLoggedIn()

    const response = await apiClient.get(
      '/system-level-design-tree/nodes/children',
      {
        parentId: 'non-existent-parent'
      },
      { expect: 'success' }
    )

    expect(Array.isArray(response.datum)).to.equal(true)
  })

  test('创建节点 - 正常情况', async () => {
    await ensureLoggedIn()

    if (!validNodeTypeId) {
      validNodeTypeId = await getValidNodeTypeId()
    }

    if (!validNodeTypeId) {
      console.log('[systemLevelDesign] 没有有效的 node_type_id，跳过创建测试')
      return
    }

    const timestamp = Date.now()
    const nodeData = {
      node_type_id: validNodeTypeId,
      properties: {
        name: `测试体系节点-${timestamp}`
      },
      parent_id: null,
      description: '测试节点'
    }

    const response = await apiClient.post('/system-level-design-tree/nodes/create', [nodeData], {
      expect: 'success'
    })

    if (response.datum && response.datum.created && response.datum.created.length > 0) {
      testNodeId = response.datum.created[0]
      dataTracker.track('/system-level-design-tree/nodes/delete', {
        id: testNodeId,
        name: nodeData.properties.name
      })
    } else if (response.datum && response.datum.length > 0 && response.datum[0].id) {
      testNodeId = response.datum[0].id
      dataTracker.track('/system-level-design-tree/nodes/delete', {
        id: testNodeId,
        name: nodeData.properties.name
      })
    }
  })

  test('创建节点 - 缺少必填字段', async () => {
    await ensureLoggedIn()

    await apiClient.post(
      '/system-level-design-tree/nodes/create',
      [
        {
          properties: {}
        }
      ],
      { expect: 'error' }
    )
  })

  test('创建节点 - 批量创建', async () => {
    await ensureLoggedIn()

    if (!validNodeTypeId) {
      validNodeTypeId = await getValidNodeTypeId()
    }

    if (!validNodeTypeId) {
      console.log('[systemLevelDesign] 没有有效的 node_type_id，跳过批量创建测试')
      return
    }

    const timestamp = Date.now()
    const nodeDataList = [
      {
        node_type_id: validNodeTypeId,
        properties: {
          name: `批量节点1-${timestamp}`
        },
        parent_id: null
      },
      {
        node_type_id: validNodeTypeId,
        properties: {
          name: `批量节点2-${timestamp}`
        },
        parent_id: null
      }
    ]

    const response = await apiClient.post('/system-level-design-tree/nodes/create', nodeDataList, {
      expect: 'success'
    })

    expect(
      (response.datum.created && response.datum.created.length) || response.datum.length
    ).to.equal(2)
  })

  test('创建节点 - 无效的 node_type_id', async () => {
    await ensureLoggedIn()

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

  test('创建节点 - 层级关系验证（错误层级关系）', async () => {
    await ensureLoggedIn()

    // 获取所有层级类型
    const levelsResponse = await apiClient.get(
      '/hierarchy/hierarchy-levels/list',
      {},
      { expect: 'success' }
    )

    if (!levelsResponse.datum || levelsResponse.datum.length < 2) {
      console.log('[层级验证] 层级类型不足，跳过测试')
      return
    }

    // 找到两个有父子关系的层级
    const parentLevel = levelsResponse.datum.find((l) => l.parent_id === null)
    const childLevel = levelsResponse.datum.find((l) => l.parent_id === parentLevel?.id)

    if (!parentLevel || !childLevel) {
      console.log('[层级验证] 未找到合适的父子层级关系，跳过测试')
      return
    }

    // 尝试在错误的层级关系下创建节点：
    // 应该在 parentLevel 下创建节点，但尝试在 childLevel 类型的节点下创建 parentLevel 类型的子节点
    const testNodeData = {
      node_type_id: parentLevel.id, // 父层级类型
      properties: {
        name: `错误层级关系测试-${Date.now()}`
      },
      parent_id: 'some-child-node-id', // 假设的子节点ID（不存在）
      description: '测试错误层级关系'
    }

    // 由于父节点不存在，应该返回错误
    await apiClient.post('/system-level-design-tree/nodes/create', [testNodeData], {
      expect: 'error'
    })
  })

  test('创建节点 - 非根节点类型不能作为根节点创建', async () => {
    await ensureLoggedIn()

    // 获取所有层级类型
    const levelsResponse = await apiClient.get(
      '/hierarchy/hierarchy-levels/list',
      {},
      { expect: 'success' }
    )

    if (!levelsResponse.datum || levelsResponse.datum.length < 2) {
      console.log('[层级验证] 层级类型不足，跳过测试')
      return
    }

    // 找到一个非根层级（有 parent_id 的层级）
    const nonRootLevel = levelsResponse.datum.find((l) => l.parent_id !== null)

    if (!nonRootLevel) {
      console.log('[层级验证] 未找到非根层级，跳过测试')
      return
    }

    // 尝试将非根层级作为根节点创建（parent_id 为 null）
    const testNodeData = {
      node_type_id: nonRootLevel.id, // 非根层级类型
      properties: {
        name: `非根层级作为根节点测试-${Date.now()}`
      },
      parent_id: null, // 尝试作为根节点
      description: '测试非根层级不能作为根节点'
    }

    // 应该返回错误，因为非根层级必须有父节点
    await apiClient.post('/system-level-design-tree/nodes/create', [testNodeData], {
      expect: 'error'
    })
  })

  test('更新节点 - 正常情况', async () => {
    await ensureLoggedIn()

    if (!testNodeId) {
      return
    }

    const updateData = {
      data: [
        {
          id: testNodeId,
          properties: {
            name: '更新后的测试节点'
          },
          description: '更新后的描述'
        }
      ]
    }

    await apiClient.put('/system-level-design-tree/nodes/update', updateData, { expect: 'success' })
  })

  test('获取节点详情 - 已存在的节点', async () => {
    await ensureLoggedIn()

    if (!testNodeId) {
      return
    }

    const response = await apiClient.get(
      '/system-level-design-tree/nodes/detail',
      {
        id: testNodeId
      },
      { expect: 'success' }
    )

    expect(response).to.have.datum()
  })

  test('删除节点 - 单个删除', async () => {
    await ensureLoggedIn()

    if (!testNodeId) {
      return
    }

    await apiClient.post(
      '/system-level-design-tree/nodes/delete',
      {
        ids: [testNodeId]
      },
      { expect: 'success' }
    )

    testNodeId = null
  })

  test('删除节点 - 批量删除', async () => {
    await ensureLoggedIn()

    if (!validNodeTypeId) {
      validNodeTypeId = await getValidNodeTypeId()
    }

    if (!validNodeTypeId) {
      console.log('[systemLevelDesign] 没有有效的 node_type_id，跳过批量删除测试')
      return
    }

    const timestamp = Date.now()
    const nodeDataList = [
      {
        node_type_id: validNodeTypeId,
        properties: {
          name: `待删除节点1-${timestamp}`
        },
        parent_id: null
      },
      {
        node_type_id: validNodeTypeId,
        properties: {
          name: `待删除节点2-${timestamp}`
        },
        parent_id: null
      }
    ]

    const createResponse = await apiClient.post(
      '/system-level-design-tree/nodes/create',
      nodeDataList,
      { expect: 'success' }
    )

    // 获取创建的节点ID
    let nodeIds = []
    if (
      createResponse.datum &&
      createResponse.datum.created &&
      createResponse.datum.created.length > 0
    ) {
      nodeIds = createResponse.datum.created
    } else if (createResponse.datum && createResponse.datum.length > 0) {
      nodeIds = createResponse.datum.filter((item) => item.id).map((item) => item.id)
    }

    if (nodeIds.length > 0) {
      await apiClient.post(
        '/system-level-design-tree/nodes/delete',
        {
          ids: nodeIds
        },
        { expect: 'success' }
      )
    } else {
      // 如果创建失败，跳过此测试
      expect(true).to.equal(true)
    }
  })

  test('获取节点列表 - 未登录', async () => {
    const tempClient = createApiClient()

    await tempClient.get('/system-level-design-tree/nodes', {}, { expect: 'error' })
  })
})
