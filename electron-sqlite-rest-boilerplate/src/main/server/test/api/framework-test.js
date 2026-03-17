/**
 * 测试框架自身的测试
 * 用于验证测试框架核心组件是否正常工作
 */

const { test, describe, getGlobalTestRunner } = require('./lib/test-runner')
const { expect } = require('./lib/assertions')
const DataTracker = require('./utils/data-tracker')

// 禁用请求日志以减少输出
const { RequestLogger } = require('./lib/api-client')
RequestLogger.ENABLED = false

describe('测试框架核心组件', () => {
  let dataTracker

  test('数据追踪器 - 启动会话', () => {
    dataTracker = new DataTracker()
    const sessionId = dataTracker.startSession()

    expect(sessionId).to.be.truthy()
    expect(sessionId).to.include('test-')
  })

  test('数据追踪器 - 记录数据', () => {
    dataTracker.track('/user/delete', { id: 1, username: 'test' })
    dataTracker.track('/roles/delete', { id: 2, roleName: 'admin' })

    const allData = dataTracker.getAll()

    expect(allData.length).to.equal(2)
    expect(allData[0].deleteUrl).to.equal('/user/delete')
    expect(allData[1].deleteUrl).to.equal('/roles/delete')
  })

  test('数据追踪器 - 获取所有数据', () => {
    const allData = dataTracker.getAll()

    expect(allData.length).to.equal(2)
    expect(allData[0].data.id).to.equal(1)
    expect(allData[1].data.id).to.equal(2)
  })

  test('数据追踪器 - 获取统计', () => {
    const count = dataTracker.getCount()

    expect(count).to.equal(2)
  })

  test('数据追踪器 - 清空数据', () => {
    dataTracker.clear()

    const count = dataTracker.getCount()
    expect(count).to.equal(0)
  })

  test('断言工具 - 相等断言', () => {
    expect(1).to.equal(1)
    expect('hello').to.equal('hello')

    // 测试不通过的情况（注释掉以避免测试失败）
    // expect(1).to.equal(2);
  })

  test('断言工具 - 深度相等断言', () => {
    expect({ a: 1, b: 2 }).to.deep.equal({ a: 1, b: 2 })
    expect([1, 2, 3]).to.deep.equal([1, 2, 3])
  })

  test('断言工具 - 包含断言', () => {
    expect([1, 2, 3]).to.include(2)
    expect({ a: 1, b: 2 }).to.have.property('a')
  })

  test('断言工具 - 真值/假值断言', () => {
    expect(true).to.be.truthy()
    expect(1).to.be.truthy()
    expect('hello').to.be.truthy()
    expect(false).to.be.falsy()
    expect(0).to.be.falsy()
    expect(null).to.be.null()
  })

  test('断言工具 - API 响应断言', () => {
    const successResponse = {
      success: true,
      code: 200,
      data: { id: 1 }
    }

    expect(successResponse).to.have.success()
    expect(successResponse).to.have.code(200)
    expect(successResponse).to.have.datum()

    const errorResponse = {
      success: false,
      code: 400,
      message: '参数错误'
    }

    // 测试错误响应（通过检查 code 属性）
    expect(errorResponse.code).to.equal(400)
  })

  test('断言工具 - 取反断言', () => {
    expect(1).to.not.equal(2)
    expect([1, 2, 3]).to.not.include(4)
  })

  test('测试运行器 - 获取结果', () => {
    const runner = getGlobalTestRunner()
    const results = runner.getResults()

    // 结果对象应该存在
    expect(results).to.be.truthy()
    expect(results.total !== undefined).to.be.truthy()
    expect(results.passed !== undefined).to.be.truthy()
    expect(results.failed !== undefined).to.be.truthy()
  })
})
