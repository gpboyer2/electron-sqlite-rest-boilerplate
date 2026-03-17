/**
 * 报告生成器
 * 生成简洁的控制台测试报告，重点突出是否符合预期
 */

const dayjs = require('dayjs')
const { TEST_API_BASE } = require('../config')

class Reporter {
  constructor(options = {}) {
    this.apiBase = options.apiBase || TEST_API_BASE
    this.showAllTests = options.showAllTests || false
  }

  /**
   * 生成测试报告
   * @param {object} results - 测试结果对象
   * @param {number} results.total - 总用例数
   * @param {number} results.passed - 符合预期的用例数
   * @param {number} results.failed - 不符合预期的用例数
   * @param {number} results.skipped - 跳过的用例数
   * @param {Array} results.failures - 失败用例详情数组
   * @param {number} [results.cleanedData] - 清理的数据条数
   * @returns {string} 格式化的测试报告文本
   */
  generate(results) {
    const lines = []

    // 标题
    lines.push('')
    lines.push('=================== API 自动化测试报告 ===================')
    lines.push('')

    // 测试时间和环境
    lines.push(`测试时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`)
    lines.push(`测试环境: ${this.apiBase}`)
    lines.push('')

    // 总体统计 - 使用符合预期的概念
    lines.push('总体统计:')
    lines.push(`总用例数: ${results.total}`)
    lines.push(`符合预期: ${results.passed}`)
    lines.push(`不符合预期: ${results.failed}`)
    lines.push(`跳过: ${results.skipped}`)

    const passRate =
      results.total > 0 ? ((results.passed / results.total) * 100).toFixed(2) : '0.00'
    lines.push(`预期符合率: ${passRate}%`)
    lines.push('')

    // 模块统计
    if (results.failures.length > 0) {
      const moduleStats = this._calculateModuleStats(results)
      lines.push('模块详情:')

      for (const [module, stats] of Object.entries(moduleStats)) {
        const moduleRate = ((stats.passed / stats.total) * 100).toFixed(2)
        const icon = stats.failed === 0 ? '[OK]' : '[X]'
        lines.push(`${icon} ${module} (${stats.passed}/${stats.total}) - ${moduleRate}%`)
      }
      lines.push('')
    }

    // 不符合预期的用例详情
    if (results.failures.length > 0) {
      lines.push('不符合预期的用例:')
      lines.push('--------------------------------------------------')
      lines.push('')

      results.failures.forEach((failure, index) => {
        lines.push(`${index + 1}. [${failure.suite}] ${failure.description}`)
        lines.push(`   不符合预期的原因: ${failure.error}`)
        lines.push('')
      })

      lines.push('--------------------------------------------------')
      lines.push('')
    }

    // 数据清理信息（如果有）
    if (results.cleanedData !== undefined) {
      lines.push(`数据清理: 已清理 ${results.cleanedData} 条测试数据`)
      lines.push('')
    }

    // 结束标记
    lines.push('======================== 测试完成 ========================')
    lines.push('')

    return lines.join('\n')
  }

  /**
   * 计算模块统计
   */
  _calculateModuleStats(results) {
    const stats = {}

    // 统计通过的测试
    const passedCount = results.passed
    const failedTests = results.failures

    // 从失败测试中提取模块信息
    failedTests.forEach((failure) => {
      const module = failure.suite.split(' > ')[0]
      if (!stats[module]) {
        stats[module] = { total: 0, passed: 0, failed: 0 }
      }
      stats[module].failed++
    })

    // 估算总数（这里简化处理，实际应该从测试收集阶段统计）
    for (const module in stats) {
      stats[module].total =
        stats[module].failed + Math.floor(passedCount / Object.keys(stats).length)
      stats[module].passed = stats[module].total - stats[module].failed
    }

    return stats
  }

  /**
   * 打印报告到控制台
   * @param {object} results - 测试结果对象
   */
  print(results) {
    const report = this.generate(results)
    console.log(report)
  }

  /**
   * 设置 API 基础 URL
   * @param {string} apiBase - API 基础 URL
   */
  setApiBase(apiBase) {
    this.apiBase = apiBase
  }

  /**
   * 设置是否显示所有测试
   * @param {boolean} show - 是否显示所有测试
   */
  setShowAllTests(show) {
    this.showAllTests = show
  }
}

module.exports = Reporter
