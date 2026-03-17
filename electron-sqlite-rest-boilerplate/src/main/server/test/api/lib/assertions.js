/**
 * 断言工具
 * 提供简洁的断言语法
 */

/**
 * 断言错误类
 */
class AssertionError extends Error {
  constructor(message, expected, actual) {
    super(message)
    this.name = 'AssertionError'
    this.expected = expected
    this.actual = actual
  }
}

/**
 * 预期不匹配错误类
 * 当 API 返回结果与声明的 expect 不一致时抛出
 */
class ExpectedMismatchError extends Error {
  constructor(message, expected, actual, responseData) {
    super(message)
    this.name = 'ExpectedMismatchError'
    this.expected = expected
    this.actual = actual
    this.responseData = responseData
  }

  /**
   * 格式化错误输出
   */
  format() {
    const messagePart = this.responseData?.message ? `, message: ${this.responseData.message}` : ''
    return `
[预期不匹配]
  预期: status = ${this.expected}
  实际: status = ${this.actual}${messagePart}`
  }
}

/**
 * 断言链类
 */
class AssertionChain {
  constructor(actual) {
    this.actual = actual
    this.negated = false
  }

  /**
   * 取反断言
   */
  get not() {
    this.negated = !this.negated
    return this
  }

  /**
   * 链式调用接口
   */
  get to() {
    // 创建一个代理对象，支持 to.not 语法
    const handler = {
      get: (target, prop) => {
        if (prop === 'not') {
          // 切换 negated 状态并返回新的代理
          this.negated = !this.negated
          return target
        }
        return target[prop]
      }
    }

    const methods = {
      // 相等断言
      equal: (expected) => {
        this._checkEqual(this.actual, expected)
        return this._createChain()
      },

      // 深度相等断言
      deep: {
        equal: (expected) => {
          this._checkDeepEqual(this.actual, expected)
          return this._createChain()
        }
      },

      // 包含断言
      include: (item) => {
        let isIncluded = false

        // 支持数组和字符串
        if (Array.isArray(this.actual)) {
          isIncluded = this.actual.includes(item)
        } else if (typeof this.actual === 'string') {
          isIncluded = this.actual.includes(item)
        }

        if (this.negated) {
          if (isIncluded) {
            throw new AssertionError(
              `期望 ${JSON.stringify(this.actual)} 不包含 ${JSON.stringify(item)}`,
              `not include ${JSON.stringify(item)}`,
              this.actual
            )
          }
        } else {
          if (!isIncluded) {
            throw new AssertionError(
              `期望 ${JSON.stringify(this.actual)} 包含 ${JSON.stringify(item)}`,
              `include ${JSON.stringify(item)}`,
              this.actual
            )
          }
        }
        return this._createChain()
      },

      // 拥有属性断言
      have: {
        property: (key) => {
          const hasProperty = this.actual && typeof this.actual === 'object' && key in this.actual
          if (this.negated) {
            if (hasProperty) {
              throw new AssertionError(
                `期望对象不包含属性 "${key}"`,
                `not have property "${key}"`,
                this.actual
              )
            }
          } else {
            if (!hasProperty) {
              throw new AssertionError(
                `期望对象包含属性 "${key}"`,
                `have property "${key}"`,
                this.actual
              )
            }
          }
          return this._createChain()
        },

        // API 专用：成功响应断言
        success: () => {
          // 支持 success: true 或 status: "success" 两种格式
          const isSuccess =
            this.actual &&
            (this.actual.success === true ||
              this.actual.status === 'success' ||
              this.actual.code === 200)
          if (this.negated) {
            if (isSuccess) {
              throw new AssertionError('期望响应不成功', 'not have success', this.actual)
            }
          } else {
            if (!isSuccess) {
              const successFlag =
                this.actual?.success !== undefined
                  ? `success: ${this.actual?.success}`
                  : this.actual?.status !== undefined
                    ? `status: ${this.actual?.status}`
                    : `code: ${this.actual?.code}`
              throw new AssertionError(
                `期望响应成功，但实际为: ${successFlag}`,
                'have success',
                this.actual
              )
            }
          }
          return this._createChain()
        },

        // API 专用：业务码断言（支持 code 字段或 status === 'success' 表示 200）
        code: (expectedCode) => {
          let hasCode = false
          if (this.actual) {
            if (this.actual.code === expectedCode) {
              hasCode = true
            } else if (expectedCode === 200 && this.actual.status === 'success') {
              // 当期望 200 时，也接受 status: 'success' 作为成功响应
              hasCode = true
            }
          }

          if (this.negated) {
            if (hasCode) {
              throw new AssertionError(
                `期望业务码不等于 ${expectedCode}`,
                `not have code ${expectedCode}`,
                this.actual
              )
            }
          } else {
            if (!hasCode) {
              const actualCode =
                this.actual?.code !== undefined
                  ? this.actual?.code
                  : this.actual?.status || 'undefined'
              throw new AssertionError(
                `期望业务码为 ${expectedCode}，实际为: ${actualCode}`,
                `have code ${expectedCode}`,
                this.actual
              )
            }
          }
          return this._createChain()
        },

        // API 专用：有数据断言（支持 datum 或 data）
        data: () => {
          const hasData = this.actual && ('datum' in this.actual || 'data' in this.actual)
          if (this.negated) {
            if (hasData) {
              throw new AssertionError('期望响应不包含数据', 'not have data', this.actual)
            }
          } else {
            if (!hasData) {
              throw new AssertionError('期望响应包含数据', 'have data', this.actual)
            }
          }
          return this._createChain()
        },

        // API 专用：有业务数据断言（新规范 datum 字段）
        datum: () => {
          const hasDatum = this.actual && 'datum' in this.actual
          if (this.negated) {
            if (hasDatum) {
              throw new AssertionError('期望响应不包含业务数据', 'not have datum', this.actual)
            }
          } else {
            if (!hasDatum) {
              throw new AssertionError('期望响应包含业务数据', 'have datum', this.actual)
            }
          }
          return this._createChain()
        }
      },

      // 真值/假值断言
      be: {
        truthy: () => {
          const isTruthy = !!this.actual
          if (this.negated) {
            if (isTruthy) {
              throw new AssertionError(
                `期望 ${JSON.stringify(this.actual)} 为假值`,
                'to be falsy',
                this.actual
              )
            }
          } else {
            if (!isTruthy) {
              throw new AssertionError(
                `期望 ${JSON.stringify(this.actual)} 为真值`,
                'to be truthy',
                this.actual
              )
            }
          }
          return this._createChain()
        },

        falsy: () => {
          const isFalsy = !this.actual
          if (this.negated) {
            if (isFalsy) {
              throw new AssertionError(
                `期望 ${JSON.stringify(this.actual)} 为真值`,
                'to be truthy',
                this.actual
              )
            }
          } else {
            if (!isFalsy) {
              throw new AssertionError(
                `期望 ${JSON.stringify(this.actual)} 为假值`,
                'to be falsy',
                this.actual
              )
            }
          }
          return this._createChain()
        },

        null: () => {
          if (this.negated) {
            if (this.actual === null) {
              throw new AssertionError('期望值不为 null', 'not to be null', this.actual)
            }
          } else {
            if (this.actual !== null) {
              throw new AssertionError(
                `期望 ${JSON.stringify(this.actual)} 为 null`,
                'to be null',
                this.actual
              )
            }
          }
          return this._createChain()
        },

        // API 专用：错误响应断言
        error: (expectedCode) => {
          if (this.negated) {
            throw new AssertionError('不能对错误断言使用 not 修饰符', 'not error', this.actual)
          }

          // 支持 ApiError 对象或普通错误对象
          const actualCode =
            this.actual?.code !== undefined ? this.actual.code : this.actual?.status
          const isError = this.actual && actualCode === expectedCode
          if (!isError) {
            throw new AssertionError(
              `期望错误码为 ${expectedCode}，实际为: ${actualCode} (消息: ${this.actual?.message || '无'})`,
              `be error ${expectedCode}`,
              this.actual
            )
          }
          return this._createChain()
        }
      }
    }

    return new Proxy(methods, handler)
  }

  /**
   * 创建新的链式调用对象
   * 重置 negated 状态，避免影响后续断言
   */
  _createChain() {
    const chain = new AssertionChain(this.actual)
    // 不传递 negated 状态，每个断言独立处理
    return chain
  }

  /**
   * 内部方法：检查相等
   */
  _checkEqual(actual, expected) {
    const isEqual = actual === expected
    if (this.negated) {
      if (isEqual) {
        throw new AssertionError(
          `期望 ${JSON.stringify(actual)} 不等于 ${JSON.stringify(expected)}`,
          `not equal ${JSON.stringify(expected)}`,
          actual
        )
      }
    } else {
      if (!isEqual) {
        throw new AssertionError(
          `期望 ${JSON.stringify(actual)} 等于 ${JSON.stringify(expected)}`,
          `equal ${JSON.stringify(expected)}`,
          actual
        )
      }
    }
  }

  /**
   * 内部方法：检查深度相等
   */
  _checkDeepEqual(actual, expected) {
    const isEqual = this._deepEqual(actual, expected)
    if (this.negated) {
      if (isEqual) {
        throw new AssertionError('期望对象不相等', 'not deep equal', { actual, expected })
      }
    } else {
      if (!isEqual) {
        throw new AssertionError('期望对象深度相等', 'deep equal', { actual, expected })
      }
    }
  }

  /**
   * 深度比较
   */
  _deepEqual(a, b) {
    if (a === b) return true

    if (a == null || b == null) return false
    if (typeof a !== typeof b) return false

    if (typeof a !== 'object') return a === b

    if (Array.isArray(a) !== Array.isArray(b)) return false

    const keysA = Object.keys(a)
    const keysB = Object.keys(b)

    if (keysA.length !== keysB.length) return false

    for (const key of keysA) {
      if (!keysB.includes(key)) return false
      if (!this._deepEqual(a[key], b[key])) return false
    }

    return true
  }
}

/**
 * 创建断言链
 * @param {*} actual - 实际值
 * @returns {AssertionChain} 断言链对象
 */
function expect(actual) {
  return new AssertionChain(actual)
}

module.exports = {
  expect,
  AssertionError,
  AssertionChain,
  ExpectedMismatchError
}
