/**
 * 报文分类管理模块测试
 * 测试报文分类的创建、查询、更新、删除等功能
 */

const { test, describe } = require('../../lib/test-runner')
const { expect } = require('../../lib/assertions')
const { getApiClient, getDataTracker } = require('../../context')

const apiClient = getApiClient()
const dataTracker = getDataTracker()

describe('报文分类管理模块', () => {
  let createdCategoryId
  let createdSubCategoryId
  let detailCategoryId // 用于测试详情查询的分类ID

  test('获取所有分类 - 正常情况（平铺列表）', async () => {
    const response = await apiClient.get(
      '/packet-message-categories/list',
      {},
      { expect: 'success' }
    )

    expect(Array.isArray(response.datum)).to.equal(true)
  })

  test('获取分类树 - 正常情况', async () => {
    const response = await apiClient.get(
      '/packet-message-categories/tree',
      {},
      { expect: 'success' }
    )

    expect(Array.isArray(response.datum)).to.equal(true)
  })

  test('获取分类详情 - 正常情况', async () => {
    // 先创建一个分类用于查询详情
    const categoryData = [
      {
        id: 'test_detail_' + Date.now(),
        name: '测试详情查询_' + Date.now(),
        parent_id: null,
        description: '用于测试详情查询的分类'
      }
    ]

    const createResponse = await apiClient.post('/packet-message-categories/create', categoryData, {
      expect: 'success'
    })

    // 获取创建的分类ID
    detailCategoryId = createResponse.datum.last_id || categoryData[0].id

    // 查询详情
    const response = await apiClient.get(
      '/packet-message-categories/detail',
      {
        id: detailCategoryId
      },
      { expect: 'success' }
    )

    // 追踪清理
    dataTracker.track('/packet-message-categories/delete', { ids: [detailCategoryId] })
  })

  test('获取分类详情 - 不存在的分类ID', async () => {
    await apiClient.get(
      '/packet-message-categories/detail',
      {
        id: 'nonexistent_category_' + Date.now()
      },
      { expect: 'error' }
    )
  })

  test('获取分类详情 - 缺少id参数', async () => {
    await apiClient.get('/packet-message-categories/detail', {}, { expect: 'error' })
  })

  test('获取分类详情 - id为空字符串', async () => {
    await apiClient.get(
      '/packet-message-categories/detail',
      {
        id: ''
      },
      { expect: 'error' }
    )
  })

  test('创建分类 - 正常情况（单个）', async () => {
    const categoryData = [
      {
        id: 'test_category_' + Date.now(),
        name: '测试分类_' + Date.now(),
        parent_id: null,
        description: '这是一个测试分类'
      }
    ]

    const response = await apiClient.post('/packet-message-categories/create', categoryData, {
      expect: 'success'
    })

    // 单个创建返回 { last_id: xxx, changes: 1 }
    if (response.datum) {
      createdCategoryId = response.datum.last_id || categoryData[0].id
      dataTracker.track('/packet-message-categories/delete', { ids: [createdCategoryId] })
    }
  })

  test('创建分类 - 创建子分类', async () => {
    if (!createdCategoryId) {
      test.skip('没有父分类ID')
      return
    }

    const subCategoryData = [
      {
        id: 'test_subcategory_' + Date.now(),
        name: '测试子分类_' + Date.now(),
        parent_id: createdCategoryId,
        description: '这是一个测试子分类'
      }
    ]

    const response = await apiClient.post('/packet-message-categories/create', subCategoryData, {
      expect: 'success'
    })

    // 单个创建返回 { last_id: xxx, changes: 1 }
    if (response.datum) {
      createdSubCategoryId = response.datum.last_id || subCategoryData[0].id
      dataTracker.track('/packet-message-categories/delete', { ids: [createdSubCategoryId] })
    }
  })

  test('创建分类 - 批量创建', async () => {
    const timestamp = Date.now()
    const batchData = [
      {
        id: 'test_batch_1_' + timestamp,
        name: '批量分类1_' + timestamp,
        parent_id: null
      },
      {
        id: 'test_batch_2_' + timestamp,
        name: '批量分类2_' + timestamp,
        parent_id: null
      },
      {
        id: 'test_batch_3_' + timestamp,
        name: '批量分类3_' + timestamp,
        parent_id: null
      }
    ]

    const response = await apiClient.post('/packet-message-categories/create', batchData, {
      expect: 'success'
    })

    // 批量创建返回 { created: [...], changes: 3 }
    if (response.datum && response.datum.created) {
      response.datum.created.forEach((id) => {
        dataTracker.track('/packet-message-categories/delete', { ids: [id] })
      })
    }
  })

  test('创建分类 - 不传id由后端自动生成', async () => {
    const timestamp = Date.now()
    const response = await apiClient.post(
      '/packet-message-categories/create',
      [
        {
          name: '自动生成ID分类_' + timestamp
        }
      ],
      { expect: 'success' }
    )

    // 追踪清理
    if (response.datum && response.datum.last_id) {
      dataTracker.track('/packet-message-categories/delete', { ids: [response.datum.last_id] })
    }
  })

  test('创建分类 - 缺少name', async () => {
    await apiClient.post(
      '/packet-message-categories/create',
      [
        {
          id: 'test_no_name_' + Date.now()
        }
      ],
      { expect: 'error' }
    )
  })

  test('创建分类 - id为空字符串', async () => {
    await apiClient.post(
      '/packet-message-categories/create',
      [
        {
          id: '',
          name: '测试分类'
        }
      ],
      { expect: 'success' }
    ) // 后端允许空 id（会自动生成）
  })

  test('创建分类 - name为空字符串', async () => {
    await apiClient.post(
      '/packet-message-categories/create',
      [
        {
          id: 'test_empty_name_' + Date.now(),
          name: ''
        }
      ],
      { expect: 'error' }
    )
  })

  test('创建分类 - 参数为空数组', async () => {
    await apiClient.post('/packet-message-categories/create', [], { expect: 'error' })
  })

  test('创建分类 - 重复的id', async () => {
    const duplicateId = 'test_duplicate_' + Date.now()

    // 第一次创建
    await apiClient.post(
      '/packet-message-categories/create',
      [
        {
          id: duplicateId,
          name: '第一次创建'
        }
      ],
      { expect: 'success' }
    )

    // 第二次创建相同id
    await apiClient.post(
      '/packet-message-categories/create',
      [
        {
          id: duplicateId,
          name: '第二次创建'
        }
      ],
      { expect: 'error' }
    )
  })

  test('更新分类 - 正常情况', async () => {
    if (!createdCategoryId) {
      test.skip('没有可用的分类ID')
      return
    }

    const updateData = [
      {
        id: createdCategoryId,
        name: '更新后的分类_' + Date.now(),
        description: '更新后的描述'
      }
    ]

    await apiClient.put('/packet-message-categories/update', updateData, { expect: 'success' })
  })

  test('更新分类 - 批量更新', async () => {
    if (!createdCategoryId || !createdSubCategoryId) {
      test.skip('没有足够的分类ID')
      return
    }

    const updateData = [
      {
        id: createdCategoryId,
        name: '批量更新1_' + Date.now()
      },
      {
        id: createdSubCategoryId,
        name: '批量更新2_' + Date.now()
      }
    ]

    await apiClient.put('/packet-message-categories/update', updateData, { expect: 'success' })
  })

  test('更新分类 - 缺少id', async () => {
    await apiClient.put(
      '/packet-message-categories/update',
      [
        {
          name: '更新后的分类'
        }
      ],
      { expect: 'error' }
    )
  })

  test('更新分类 - 不存在的分类ID', async () => {
    const updateData = [
      {
        id: 'nonexistent_category_' + Date.now(),
        name: '更新不存在的分类'
      }
    ]

    await apiClient.put('/packet-message-categories/update', updateData, { expect: 'error' })
  })

  test('更新分类 - 参数为空数组', async () => {
    await apiClient.put('/packet-message-categories/update', [], { expect: 'error' })
  })

  test('删除分类 - 正常情况（单个）', async () => {
    const createData = [
      {
        id: 'test_to_delete_' + Date.now(),
        name: '待删除分类'
      }
    ]

    const createResponse = await apiClient.post('/packet-message-categories/create', createData, {
      expect: 'success'
    })

    // 单个创建返回 { last_id: xxx, changes: 1 }
    const categoryId = createResponse.datum.last_id || createData[0].id

    await apiClient.post(
      '/packet-message-categories/delete',
      {
        ids: [categoryId]
      },
      { expect: 'success' }
    )
  })

  test('删除分类 - 批量删除', async () => {
    const timestamp = Date.now()
    const createData = [
      { id: 'test_del_1_' + timestamp, name: '待删除1' },
      { id: 'test_del_2_' + timestamp, name: '待删除2' },
      { id: 'test_del_3_' + timestamp, name: '待删除3' }
    ]

    await apiClient.post('/packet-message-categories/create', createData, { expect: 'success' })

    const idsToDelete = createData.map((item) => item.id)
    await apiClient.post(
      '/packet-message-categories/delete',
      {
        ids: idsToDelete
      },
      { expect: 'success' }
    )
  })

  test('删除分类 - 缺少ids参数', async () => {
    await apiClient.post('/packet-message-categories/delete', {}, { expect: 'error' })
  })

  test('删除分类 - ids为空数组', async () => {
    await apiClient.post(
      '/packet-message-categories/delete',
      {
        ids: []
      },
      { expect: 'error' }
    )
  })

  test('删除分类 - 不存在的分类ID', async () => {
    const deleteResponse = await apiClient.post(
      '/packet-message-categories/delete',
      {
        ids: ['nonexistent_category_' + Date.now()]
      },
      { expect: 'success' }
    )

    // 可能返回成功或失败，取决于实现
    expect(deleteResponse !== null).to.equal(true)
  })

  test('删除分类 - 删除有子分类的父分类', async () => {
    // 先创建父分类
    const parentData = [
      {
        id: 'test_parent_del_' + Date.now(),
        name: '待删除父分类'
      }
    ]

    const parentResponse = await apiClient.post('/packet-message-categories/create', parentData, {
      expect: 'success'
    })
    // 单个创建返回 { last_id: xxx, changes: 1 }
    const parentId = parentResponse.datum.last_id || parentData[0].id

    // 创建子分类
    const childData = [
      {
        id: 'test_child_del_' + Date.now(),
        name: '待删除子分类',
        parent_id: parentId
      }
    ]

    await apiClient.post('/packet-message-categories/create', childData, { expect: 'success' })

    // 尝试删除父分类（系统应该允许删除，子分类的parent_id会被设为null）
    await apiClient.post(
      '/packet-message-categories/delete',
      {
        ids: [parentId]
      },
      { expect: 'success' }
    )
  })
})
