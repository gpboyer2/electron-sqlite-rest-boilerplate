#!/usr/bin/env node

/**
 * 调试模块加载问题
 */

const path = require('path')

console.log('开始调试模块加载问题...\n')

try {
  console.log('1. 尝试加载 test-runner...')
  const testRunner = require('./lib/test-runner')
  console.log('[OK] test-runner 加载成功')
  console.log('  导出:', Object.keys(testRunner))
} catch (error) {
  console.error('[FAIL] test-runner 加载失败:', error.message)
  console.error('  堆栈:', error.stack)
  process.exit(1)
}

try {
  console.log('\n2. 尝试加载 assertions...')
  const assertions = require('./lib/assertions')
  console.log('[OK] assertions 加载成功')
  console.log('  导出:', Object.keys(assertions))
} catch (error) {
  console.error('[FAIL] assertions 加载失败:', error.message)
  console.error('  堆栈:', error.stack)
  process.exit(1)
}

try {
  console.log('\n3. 尝试加载 api-client...')
  const { ApiClient } = require('./lib/api-client')
  console.log('[OK] api-client 加载成功')
} catch (error) {
  console.error('[FAIL] api-client 加载失败:', error.message)
  console.error('  堆栈:', error.stack)
  process.exit(1)
}

try {
  console.log('\n4. 尝试加载 auth 模块...')
  const authPath = path.resolve(__dirname, './modules/auth')
  console.log('  路径:', authPath)
  const auth = require(authPath)
  console.log('[OK] auth 模块加载成功')
  console.log('  导出:', Object.keys(auth))
} catch (error) {
  console.error('[FAIL] auth 模块加载失败:', error.message)
  console.error('  错误名称:', error.name)
  console.error('  堆栈:', error.stack)
  process.exit(1)
}

console.log('\n所有模块加载成功！')
