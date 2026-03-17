#!/usr/bin/env node

/**
 * 框架测试运行器
 * 用于验证测试框架核心组件是否正常工作（不需要后端服务）
 */

const path = require('path')

// 禁用 API 请求日志
const { RequestLogger } = require('./lib/api-client')
RequestLogger.ENABLED = false

const Reporter = require('./lib/reporter')
const { getGlobalTestRunner } = require('./lib/test-runner')

async function main() {
  console.log('\n========================================')
  console.log('     测试框架自检')
  console.log('========================================\n')

  // 加载框架测试
  try {
    require('./framework-test')
  } catch (error) {
    console.error('[错误] 加载框架测试失败:', error.message)
    process.exit(1)
  }

  // 运行测试
  console.log('开始运行框架测试...\n')

  const reporter = new Reporter({ apiBase: 'N/A (框架自检)' })
  const testRunner = getGlobalTestRunner()
  testRunner.setReporter(reporter)

  const results = await testRunner.run()
  console.log('\n')

  // 生成报告
  reporter.print(results)

  // 根据测试结果设置退出码
  if (results.failed > 0) {
    process.exit(1)
  } else {
    console.log('[OK] 测试框架核心组件工作正常！')
    process.exit(0)
  }
}

main()
