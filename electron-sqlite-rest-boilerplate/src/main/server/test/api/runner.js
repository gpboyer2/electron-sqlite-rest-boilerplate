#!/usr/bin/env node

/**
 * API 自动化测试入口
 */

const path = require('path')
const fs = require('fs')
const ProcessManager = require('./utils/process-manager')
const { ApiClient } = require('./lib/api-client')
const DataTracker = require('./utils/data-tracker')
const DataCleaner = require('./utils/data-cleaner')
const Reporter = require('./lib/reporter')
const { describe, test, before, after } = require('./lib/test-runner')
const { getContext } = require('./context')
const bcrypt = require('bcryptjs')
const { sequelize } = require('../../database/sequelize')

/**
 * 生成带时间戳的报告文件名
 * @returns {string} 报告文件名（格式：test-YYYYMMDD-HHMMSS.txt）
 */
function generateReportFileName() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const second = String(now.getSeconds()).padStart(2, '0')
  const timestamp = `${year}${month}${day}-${hour}${minute}${second}`
  return `test-${timestamp}.txt`
}

/**
 * 捕获所有输出到文件
 * @param {string} filePath - 报告文件名
 * @returns {Object} 包含 close 方法和 path 属性的对象
 * @returns {Function} return.close - 关闭捕获的函数
 * @returns {string} return.path - 报告文件完整路径
 */
function captureOutputToFile(filePath) {
  const reportDir = path.resolve(__dirname, '../reports')
  const fullPath = path.join(reportDir, filePath)

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }

  const writeStream = fs.createWriteStream(fullPath, { encoding: 'utf8' })

  const originalWrite = process.stdout.write.bind(process.stdout)
  const originalErrorWrite = process.stderr.write.bind(process.stderr)

  process.stdout.write = function (chunk, encoding, callback) {
    writeStream.write(chunk, encoding)
    return originalWrite(chunk, encoding, callback)
  }

  process.stderr.write = function (chunk, encoding, callback) {
    writeStream.write(chunk, encoding)
    return originalErrorWrite(chunk, encoding, callback)
  }

  return {
    close: () => {
      process.stdout.write = originalWrite
      process.stderr.write = originalErrorWrite
      writeStream.end()
    },
    path: fullPath
  }
}

/**
 * 全局密码重置函数
 * 将管理员密码重置为 admin123
 * @returns {Promise<void>}
 */
async function resetAdminPassword() {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 10)
    await sequelize.query('UPDATE users SET password = ? WHERE user_name = ?', {
      replacements: [hashedPassword, 'admin']
    })
  } catch (error) {
    console.error('[全局] 密码重置失败:', error.message)
  }
}

// 测试模块列表（按功能分组的目录结构）
// 注意：
// - authLogoutOnly 和 authPasswordOnly 是独立模块，完整执行登录→操作→恢复的流程
// - 这些模块不混在主测试流程中，避免影响其他测试
// - 每个业务模块目录下：index.js 是主测试，boundary.js 是边界值测试
const TEST_MODULES = {
  // 用户相关模块
  user: './modules/user/index',
  userBoundary: './modules/user/boundary',

  // 角色权限模块
  role: './modules/role/index',
  rolePermissionBoundary: './modules/role/boundary',

  // 认证模块
  auth: './modules/auth/index',
  authLogoutOnly: './modules/auth/logout-only',
  authPasswordOnly: './modules/auth/password-only',
  authBoundary: './modules/auth/boundary',

  // 业务模块
  permission: './modules/permission/index',
  flowchart: './modules/flowchart/index',
  hierarchy: './modules/hierarchy/index',
  packetMessage: './modules/packet-message/index',
  packetMessageCategories: './modules/packet-message-categories/index',
  topology: './modules/topology/index',
  database: './modules/database/index',
  communicationNode: './modules/communication-node/index',
  systemLevelDesign: './modules/system-level-design/index',
  build: './modules/build/index',

  // 跨模块边界测试
  businessBoundary: './modules/business-boundary'
}

/**
 * 解析命令行参数
 * @returns {Object} 解析后的选项对象
 * @returns {string} return.module - 测试模块名称
 * @returns {boolean} return.noRestart - 是否不重启后端
 * @returns {boolean} return.verbose - 是否详细输出
 * @returns {boolean} return.help - 是否显示帮助
 */
function parseArgs() {
  const args = process.argv.slice(2)

  const options = {
    module: 'all', // all 或指定模块名
    noRestart: false, // 不重启后端
    verbose: false, // 详细输出
    help: false // 显示帮助
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    // 处理 --module=value 格式
    if (arg.startsWith('--module=')) {
      options.module = arg.split('=')[1]
    }
    // 处理 --module value 格式
    else if (arg === '--module' && args[i + 1]) {
      options.module = args[++i]
    } else if (arg === '--no-restart') {
      options.noRestart = true
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    }
  }

  return options
}

/**
 * 显示帮助信息
 * @returns {void}
 */
function showHelp() {
  console.log(`
API 自动化测试工具

用法:
  node runner.js [选项]

选项:
  --module <name>   指定测试模块 (默认: all)
  --no-restart      不重启后端服务
  --verbose, -v     详细输出
  --help, -h        显示帮助信息

示例:
  node runner.js                    # 运行所有测试
  node runner.js --module auth      # 只运行认证模块测试
  node runner.js --no-restart       # 运行测试但不重启后端

可用模块:
  ${Object.keys(TEST_MODULES).join(', ')}
  `)
}

/**
 * 加载测试模块
 * @param {string} moduleName - 模块名称（'all' 或具体模块名）
 * @returns {string[]} 已加载的模块名称列表
 */
function loadTestModules(moduleName) {
  const modules = []

  if (moduleName === 'all') {
    // 加载所有模块
    for (const [name, modulePath] of Object.entries(TEST_MODULES)) {
      try {
        const fullPath = path.resolve(__dirname, modulePath)
        require(fullPath)
        modules.push(name)
      } catch (error) {
        console.error(`[错误] 加载 ${name} 模块失败:`, error.message)
      }
    }
  } else {
    // 加载指定模块
    const modulePath = TEST_MODULES[moduleName]
    if (!modulePath) {
      console.error(`[错误] 未找到模块: ${moduleName}`)
      console.error(`可用模块: ${Object.keys(TEST_MODULES).join(', ')}`)
      process.exit(1)
    }

    try {
      const fullPath = path.resolve(__dirname, modulePath)
      require(fullPath)
      modules.push(moduleName)
    } catch (error) {
      console.error(`[错误] 加载 ${moduleName} 模块失败:`, error.message)
      process.exit(1)
    }
  }

  return modules
}

/**
 * 主函数
 * @returns {Promise<void>}
 */
async function main() {
  // 解析命令行参数
  const options = parseArgs()

  if (options.help) {
    showHelp()
    process.exit(0)
  }

  // 启动输出捕获（在第一条输出之前）
  const reportFileName = generateReportFileName()
  const outputCapture = captureOutputToFile(reportFileName)

  console.log('\n========================================')
  console.log('     API 自动化测试')
  console.log('========================================\n')

  // 初始化组件（确保使用正确的后端路径）
  const serverDir = path.resolve(__dirname, '../..')
  const processManager = new ProcessManager({
    backendPath: serverDir
  })
  const apiClient = new ApiClient()
  // 在测试环境中禁用自动清除token，避免影响后续测试
  apiClient.setAutoClearToken(false)
  const dataTracker = new DataTracker()
  const dataCleaner = new DataCleaner()
  const reporter = new Reporter({
    apiBase: processManager.getBackendInfo().apiBase
  })

  // 设置关联关系
  dataCleaner.setApiClient(apiClient)
  dataCleaner.setDataTracker(dataTracker)

  // 启动数据追踪会话
  dataTracker.startSession()

  // 初始化全局上下文
  const context = getContext()
  context.initialize(apiClient, dataTracker)

  try {
    // 1. [可选] 重启后端服务
    if (!options.noRestart) {
      await processManager.restartBackend()
    }

    // 2. 加载测试模块
    const loadedModules = loadTestModules(options.module)

    // 3. 运行测试

    // 确保测试开始前密码是 admin123
    await resetAdminPassword()

    const { getGlobalTestRunner } = require('./lib/test-runner')
    const testRunner = getGlobalTestRunner()
    testRunner.setReporter(reporter)

    const results = await testRunner.run()

    // 测试结束后确保密码恢复为 admin123
    await resetAdminPassword()

    // 4. [可选] 清理测试数据
    if (results.total > 0) {
      try {
        const cleanResult = await dataCleaner.cleanAll()
        results.cleanedData = cleanResult.totalCleaned
      } catch (error) {
        results.cleanedData = 0
      }
    }

    // 5. 生成报告
    reporter.print(results)

    // 6. 关闭输出捕获并显示文件路径
    outputCapture.close()
    const backendInfo = processManager.getBackendInfo()

    console.log(`测试报告: ${outputCapture.path}`)
    if (backendInfo.backendLogFile) {
      console.log(`后端日志: ${backendInfo.backendLogFile}`)
    }
    console.log('')

    // 7. 根据测试结果设置退出码
    if (results.failed > 0) {
      process.exit(1)
    } else {
      process.exit(0)
    }
  } catch (error) {
    console.error('\n[错误] 测试执行失败:', error.message)
    outputCapture.close()
    const backendInfo = processManager.getBackendInfo()

    console.log(`测试报告: ${outputCapture.path}`)
    if (backendInfo.backendLogFile) {
      console.log(`后端日志: ${backendInfo.backendLogFile}`)
    }
    console.log('')

    if (options.verbose) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// 运行主函数
main()
