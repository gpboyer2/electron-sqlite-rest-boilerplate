/**
 * 测试运行器
 * 自建的轻量测试框架
 */

class TestRunner {
  constructor() {
    this.suites = []
    this.currentSuite = null
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      failures: []
    }
    this.reporter = null
    this.onlyMode = false
    this.startTime = null
  }

  /**
   * 设置报告生成器
   * @param {object} reporter - 报告生成器实例
   */
  setReporter(reporter) {
    this.reporter = reporter
  }

  /**
   * 定义测试套件
   * @param {string} name - 测试套件名称
   * @param {Function} fn - 测试套件函数
   * @returns {object} 测试套件对象
   */
  describe(name, fn) {
    const suite = {
      name,
      tests: [],
      before: null,
      after: null,
      beforeEach: [],
      afterEach: []
    }

    const parentSuite = this.currentSuite
    this.currentSuite = suite

    // 执行套件函数，收集测试
    fn()

    this.currentSuite = parentSuite

    if (parentSuite) {
      parentSuite.tests.push(suite)
    } else {
      this.suites.push(suite)
    }

    return suite
  }

  /**
   * 定义测试用例
   * @param {string} description - 测试用例描述
   * @param {Function} fn - 测试函数
   * @returns {object} 测试用例对象
   */
  test(description, fn) {
    const testCase = {
      description,
      fn,
      skip: false,
      only: false
    }

    if (this.currentSuite) {
      this.currentSuite.tests.push(testCase)
    } else {
      // 如果没有 describe，创建一个匿名的
      this.suites.push({
        name: '测试套件',
        tests: [testCase]
      })
    }

    return testCase
  }

  /**
   * 跳过测试
   * @param {string} description - 测试用例描述
   * @param {Function} fn - 测试函数
   * @returns {object} 测试用例对象
   */
  skipTest(description, fn) {
    const testCase = this.test(description, fn)
    testCase.skip = true
    return testCase
  }

  /**
   * 只运行此测试
   * @param {string} description - 测试用例描述
   * @param {Function} fn - 测试函数
   * @returns {object} 测试用例对象
   */
  onlyTest(description, fn) {
    const testCase = this.test(description, fn)
    testCase.only = true
    this.onlyMode = true
    return testCase
  }

  /**
   * 运行单个测试
   * @param {object} test - 测试用例对象
   * @param {object} suite - 测试套件对象
   * @param {string} suiteName - 测试套件名称
   * @returns {Promise<object|null>} 测试结果对象
   */
  async runTest(test, suite, suiteName) {
    // 检查是否只运行 only 的测试
    if (this.onlyMode && !test.only) {
      this.results.skipped++
      return null
    }

    // 跳过的测试
    if (test.skip) {
      this.results.skipped++
      return {
        suite: suiteName,
        description: test.description,
        status: 'skipped'
      }
    }

    const startTime = Date.now()

    // 输出测试开始信息
    console.log(`\n[测试] ${test.description}`)

    try {
      // 执行 beforeEach 钩子
      if (suite.beforeEach && suite.beforeEach.length > 0) {
        for (const hook of suite.beforeEach) {
          await hook()
        }
      }

      // 执行测试函数
      await test.fn()

      const duration = Date.now() - startTime
      this.results.passed++

      // 输出测试通过信息
      console.log(`[通过] ${test.description} (${duration}ms)`)

      return {
        suite: suiteName,
        description: test.description,
        status: 'passed',
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      this.results.failed++

      // 输出测试失败信息
      console.log(`[失败] ${test.description}`)
      console.log(`  预期: ${error.expected || '符合预期'}`)
      console.log(
        `  实际: ${error.actual !== undefined ? JSON.stringify(error.actual) : error.message}`
      )

      const failure = {
        suite: suiteName,
        description: test.description,
        status: 'failed',
        duration,
        error: error.message,
        expected: error.expected,
        actual: error.actual,
        stack: error.stack
      }

      this.results.failures.push(failure)

      return failure
    }
  }

  /**
   * 递归运行套件
   * @param {object} suite - 测试套件对象
   * @param {string} parentName - 父套件名称
   * @returns {Promise<Array>} 测试结果数组
   */
  async runSuite(suite, parentName = '') {
    const suiteName = parentName ? `${parentName} > ${suite.name}` : suite.name
    const suiteResults = []

    // 执行 before 钩子
    if (suite.before) {
      await suite.before()
    }

    for (const item of suite.tests) {
      if (item.fn) {
        // 这是一个测试用例
        const result = await this.runTest(item, suite, suiteName)
        if (result) {
          suiteResults.push(result)
        }
      } else if (item.tests) {
        // 这是一个嵌套套件
        const nestedResults = await this.runSuite(item, suiteName)
        suiteResults.push(...nestedResults)
      }
    }

    // 执行 after 钩子
    if (suite.after) {
      try {
        await suite.after()
      } catch (error) {
        // after 钩子错误不影响测试结果
        console.error(`[错误] after 钩子执行失败:`, error.message)
      }
    }

    return suiteResults
  }

  /**
   * 运行所有测试
   * @returns {Promise<object>} 测试结果对象
   */
  async run() {
    this.startTime = Date.now()
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      failures: []
    }

    const allResults = []

    for (const suite of this.suites) {
      const results = await this.runSuite(suite)
      allResults.push(...results)
    }

    // 计算总数（排除跳过的）
    this.results.total = this.results.passed + this.results.failed
    this.results.duration = Date.now() - this.startTime

    return this.results
  }

  /**
   * 获取测试结果
   * @returns {object} 测试结果对象
   */
  getResults() {
    return this.results
  }

  /**
   * 重置测试运行器
   */
  reset() {
    this.suites = []
    this.currentSuite = null
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      failures: []
    }
    this.onlyMode = false
  }
}

// 创建全局实例
const globalTestRunner = new TestRunner()

/**
 * 定义测试套件（全局函数）
 * @param {string} name - 测试套件名称
 * @param {Function} fn - 测试套件函数
 * @returns {object} 测试套件对象
 */
const describe = globalTestRunner.describe.bind(globalTestRunner)

/**
 * 定义测试用例（全局函数）
 * @param {string} description - 测试用例描述
 * @param {Function} fn - 测试函数
 * @returns {object} 测试用例对象
 */
function test(description, fn) {
  return globalTestRunner.test(description, fn)
}

/**
 * 跳过测试用例
 * @param {string} description - 测试用例描述
 * @param {Function} fn - 测试函数
 * @returns {object} 测试用例对象
 */
test.skip = function (description, fn) {
  return globalTestRunner.skipTest(description, fn)
}

/**
 * 只运行此测试用例
 * @param {string} description - 测试用例描述
 * @param {Function} fn - 测试函数
 * @returns {object} 测试用例对象
 */
test.only = function (description, fn) {
  return globalTestRunner.onlyTest(description, fn)
}

test.beforeEach = function (fn) {
  // beforeEach 钩子的实现（如果需要）
}

/**
 * 在测试套件执行前运行的钩子
 * @param {Function} fn - 钩子函数
 */
function before(fn) {
  if (globalTestRunner.currentSuite) {
    globalTestRunner.currentSuite.before = fn
  }
}

/**
 * 在每个测试用例执行前运行的钩子
 * @param {Function} fn - 钩子函数
 */
function beforeEach(fn) {
  if (globalTestRunner.currentSuite) {
    globalTestRunner.currentSuite.beforeEach.push(fn)
  }
}

/**
 * 在测试套件执行后运行的钩子
 * @param {Function} fn - 钩子函数
 */
function after(fn) {
  if (globalTestRunner.currentSuite) {
    globalTestRunner.currentSuite.after = fn
  }
}

/**
 * 获取全局测试运行器实例
 * @returns {TestRunner} 全局测试运行器实例
 */
function getGlobalTestRunner() {
  return globalTestRunner
}

module.exports = {
  TestRunner,
  describe,
  test,
  before,
  after,
  beforeEach,
  getGlobalTestRunner
}
