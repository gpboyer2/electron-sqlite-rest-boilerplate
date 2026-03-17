/**
 * 报文配置模块测试
 */

const { test, describe, before } = require('../../lib/test-runner')
const { expect } = require('../../lib/assertions')
const { getApiClient, getDataTracker, setAdminToken } = require('../../context')

const apiClient = getApiClient()
const dataTracker = getDataTracker()

describe('报文配置模块', () => {
  let draftPacketId
  let protocolMessageId
  let publishedPacketId
  let revisionDraftId

  // 确保已登录（packet-message 模块可单独运行）
  before(async () => {
    const bcrypt = require('bcryptjs')
    const { sequelize } = require('../../../../database/sequelize')

    try {
      const hashedPassword = await bcrypt.hash('admin123', 10)
      await sequelize.query('UPDATE users SET password = ? WHERE user_name = ?', {
        replacements: [hashedPassword, 'admin']
      })
    } catch (error) {
      console.error('[packet-message][before] 密码重置失败:', error.message)
    }

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
  })

  test('获取报文列表 - 正常情况', async () => {
    const response = await apiClient.get('/packet-messages/list', {}, { expect: 'success' })

    expect(response.datum.list).to.be.truthy()
    expect(Array.isArray(response.datum.list)).to.equal(true)
  })

  test('获取字段类型列表 - 正常情况', async () => {
    const response = await apiClient.get(
      '/packet-messages/field-types/list',
      {},
      { expect: 'success' }
    )

    expect(Array.isArray(response.datum)).to.equal(true)
  })

  test('获取层级节点列表 - 正常情况', async () => {
    const response = await apiClient.get('/packet-messages/nodes/list', {}, { expect: 'success' })

    expect(Array.isArray(response.datum)).to.equal(true)
  })

  test('创建草稿 - 正常情况（保存不对公共视角可见）', async () => {
    const packetData = {
      name: '测试报文草稿-' + Date.now(),
      description: '这是一个测试草稿',
      hierarchy_node_id: '测试节点',
      protocol: 'tcp',
      fields: []
    }

    const response = await apiClient.post('/packet-messages/draft/create', packetData, {
      expect: 'success'
    })

    expect(response.datum.id).to.be.truthy()
    expect(response.datum.message_id).to.be.truthy()
    expect(response.datum.publish_status).to.equal(0)

    draftPacketId = response.datum.id
    protocolMessageId = response.datum.message_id
    // 追踪删除 API 路径
    dataTracker.track('/packet-messages/delete', { id: draftPacketId, name: packetData.name })
  })

  test('公共列表不可见草稿 - 正常情况', async () => {
    if (!draftPacketId) return
    const response = await apiClient.get('/packet-messages/list', {}, { expect: 'success' })
    const list = response.datum.list || []
    const idList = list.map((x) => x.id)
    expect(idList.includes(draftPacketId)).to.equal(false)
  })

  test('发布草稿 - 首次发布版本为 1.0', async () => {
    if (!draftPacketId) return
    const response = await apiClient.post(
      '/packet-messages/draft/publish',
      { draft_id: draftPacketId },
      { expect: 'success' }
    )
    expect(response.datum.publish_status).to.equal(1)
    expect(response.datum.version).to.equal('1.0')
    expect(response.datum.latest_key).to.equal(protocolMessageId)
    // 方案B：草稿原地升级为已发布（id 不变，草稿不再存在）
    expect(response.datum.id).to.equal(draftPacketId)
    publishedPacketId = response.datum.id
  })

  test('发布后草稿不再存在 - 正常情况', async () => {
    if (!draftPacketId) return
    await apiClient.get(
      '/packet-messages/draft/detail',
      { draft_id: draftPacketId },
      { expect: 'error' }
    )
  })

  test('公共列表可见最新已发布 - 正常情况', async () => {
    if (!protocolMessageId) return
    const response = await apiClient.get('/packet-messages/list', {}, { expect: 'success' })
    const list = response.datum.list || []
    const latest = list.find((x) => x.message_id === protocolMessageId)
    expect(!!latest).to.equal(true)
    expect(latest.publish_status).to.equal(1)
    expect(latest.version).to.be.truthy()
  })

  test('创建修订草稿 - 正常情况', async () => {
    if (!protocolMessageId) return
    const ensureRes = await apiClient.post(
      '/packet-messages/draft/ensure',
      { message_id: protocolMessageId },
      { expect: 'success' }
    )
    expect(ensureRes.datum.publish_status).to.equal(0)
    expect(ensureRes.datum.message_id).to.equal(protocolMessageId)
    revisionDraftId = ensureRes.datum.id
    expect(!!revisionDraftId).to.equal(true)
    if (publishedPacketId) {
      expect(revisionDraftId === publishedPacketId).to.equal(false)
    }
  })

  test('发布修订草稿 - 无改动时发布失败', async () => {
    if (!revisionDraftId) return
    await apiClient.post(
      '/packet-messages/draft/publish',
      { draft_id: revisionDraftId },
      { expect: 'error' }
    )
  })

  test('发布修订草稿 - 有改动时允许发布（版本自动 +1.0）', async () => {
    if (!revisionDraftId) return
    // 先对草稿做任意修改（例如修改描述）
    const updateRes = await apiClient.post(
      '/packet-messages/draft/update',
      { draft_id: revisionDraftId, description: '修改描述-' + Date.now() },
      { expect: 'success' }
    )
    expect(updateRes.datum.publish_status).to.equal(0)
    expect(updateRes.datum.id).to.equal(revisionDraftId)

    const response = await apiClient.post(
      '/packet-messages/draft/publish',
      { draft_id: revisionDraftId },
      { expect: 'success' }
    )
    expect(response.datum.publish_status).to.equal(1)
    expect(response.datum.version).to.equal('2.0')
    expect(response.datum.latest_key).to.equal(protocolMessageId)
    // 方案B：草稿原地升级为已发布（id 不变）
    expect(response.datum.id).to.equal(revisionDraftId)
  })

  test('版本列表仅包含已发布历史 - 正常情况', async () => {
    if (!protocolMessageId) return
    const response = await apiClient.get(
      '/packet-messages/versions',
      { message_id: protocolMessageId },
      { expect: 'success' }
    )
    expect(Array.isArray(response.datum)).to.equal(true)
    const versionList = response.datum.map((x) => x.version)
    expect(versionList.includes('1.0')).to.equal(true)
    expect(versionList.includes('2.0')).to.equal(true)
  })
})
