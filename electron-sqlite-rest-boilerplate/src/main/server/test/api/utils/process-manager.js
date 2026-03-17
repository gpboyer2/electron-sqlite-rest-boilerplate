/**
 * 进程管理器
 * 负责管理后端 Node.js 进程的生命周期
 */

const { spawn, exec } = require('child_process')
const http = require('http')
const fs = require('fs')
const path = require('path')
const { TEST_PORT } = require('../config')

class ProcessManager {
  constructor(options = {}) {
    this.port = options.port || TEST_PORT
    this.host = options.host || '0.0.0.0'
    this.backendPath = options.backendPath || process.cwd()
    this.backendCommand = options.backendCommand || 'node'
    this.backendArgs = options.backendArgs || ['server.js']
    this.backendProcess = null
    this.healthCheckPath = options.healthCheckPath || '/api/test/health'
    this.healthCheckTimeout = options.healthCheckTimeout || 30000
    this.backendLogFile = null
    this.backendLogWriteStream = null
  }

  /**
   * 生成后端日志文件名
   * @returns {string} 日志文件名（格式：server-YYYYMMDD-HHMMSS.log）
   */
  generateBackendLogFileName() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    const timestamp = `${year}${month}${day}-${hour}${minute}${second}`
    return `server-${timestamp}.log`
  }

  /**
   * 创建后端日志写入流
   * @returns {string} 日志文件完整路径
   */
  createBackendLogStream() {
    const reportDir = path.resolve(__dirname, '../../reports')
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true })
    }
    const fileName = this.generateBackendLogFileName()
    const fullPath = path.join(reportDir, fileName)
    const writeStream = fs.createWriteStream(fullPath, { encoding: 'utf8' })
    this.backendLogFile = fullPath
    this.backendLogWriteStream = writeStream
    return fullPath
  }

  /**
   * 关闭后端日志流
   * @returns {void}
   */
  closeBackendLogStream() {
    if (this.backendLogWriteStream) {
      this.backendLogWriteStream.end()
      this.backendLogWriteStream = null
    }
  }

  /**
   * 查找占用端口的进程
   * @returns {Promise<number|null>} 进程 PID，如果未找到则返回 null
   */
  async findBackendProcess() {
    return new Promise((resolve, reject) => {
      // 在 macOS 上使用 lsof 命令
      exec(`lsof -i :${this.port} -t`, (error, stdout) => {
        if (error) {
          // 没有找到进程，端口未被占用
          if (stdout.trim() === '') {
            resolve(null)
          } else {
            reject(new Error(`查找进程失败: ${error.message}`))
          }
          return
        }

        const pids = stdout
          .trim()
          .split('\n')
          .filter((pid) => pid)
        if (pids.length === 0) {
          resolve(null)
        } else {
          // 返回找到的第一个 PID
          resolve(parseInt(pids[0], 10))
        }
      })
    })
  }

  /**
   * 终止进程
   * @param {number} pid - 进程 PID
   * @param {Object} options - 终止选项
   * @param {boolean} options.force - 是否强制终止
   * @param {number} options.timeout - 超时时间（毫秒）
   * @returns {Promise<void>}
   */
  async killProcess(pid, options = {}) {
    const { force = false, timeout = 10000 } = options

    return new Promise((resolve, reject) => {
      const startTime = Date.now()

      const checkProcess = () => {
        exec(`kill -0 ${pid} 2>/dev/null`, (error) => {
          // 如果命令返回错误，说明进程已经不存在
          if (error !== null) {
            resolve()
            return
          }

          // 进程还在运行
          if (Date.now() - startTime > timeout) {
            // 超时，强制杀死
            if (force) {
              exec(`kill -9 ${pid}`, (err) => {
                if (err) {
                  reject(new Error(`强制终止进程失败: ${err.message}`))
                } else {
                  console.log(`已强制终止进程 ${pid}`)
                  resolve()
                }
              })
            } else {
              reject(new Error(`终止进程超时 (${timeout}ms)`))
            }
            return
          }

          // 继续检查
          setTimeout(checkProcess, 100)
        })
      }

      // 先尝试优雅退出
      exec(`kill ${pid}`, (error) => {
        if (error) {
          reject(new Error(`终止进程失败: ${error.message}`))
          return
        }

        console.log(`正在终止进程 ${pid}...`)
        checkProcess()
      })
    })
  }

  /**
   * 启动后端服务
   * @returns {Promise<ChildProcess>} 后端进程对象
   */
  async startBackend() {
    return new Promise((resolve, reject) => {
      const logPath = this.createBackendLogStream()
      console.log(`正在启动后端服务: ${this.backendCommand} ${this.backendArgs.join(' ')}`)
      console.log(`后端日志文件: ${logPath}`)

      this.backendProcess = spawn(this.backendCommand, this.backendArgs, {
        cwd: this.backendPath,
        env: { ...process.env, NODE_ENV: 'test' },
        stdio: ['ignore', 'pipe', 'pipe']
      })

      // 捕获 stdout 并写入文件（不输出到终端，避免混入测试报告）
      this.backendProcess.stdout.on('data', (chunk) => {
        this.backendLogWriteStream.write(chunk)
      })

      // 捕获 stderr 并写入文件（不输出到终端，避免混入测试报告）
      this.backendProcess.stderr.on('data', (chunk) => {
        this.backendLogWriteStream.write(chunk)
      })

      this.backendProcess.on('error', (error) => {
        this.closeBackendLogStream()
        reject(new Error(`启动后端失败: ${error.message}`))
      })

      this.backendProcess.on('exit', (code, signal) => {
        if (code !== null && code !== 0) {
          console.error(`后端进程退出，代码: ${code}`)
        }
        if (signal) {
          console.error(`后端进程被信号终止: ${signal}`)
        }
        this.closeBackendLogStream()
      })

      // 给进程一点时间启动
      setTimeout(() => {
        resolve(this.backendProcess)
      }, 1000)
    })
  }

  /**
   * 健康检查 - 使用真实 HTTP 请求检查服务是否就绪
   * @returns {Promise<void>}
   */
  async healthCheck() {
    const startTime = Date.now()

    return new Promise((resolve, reject) => {
      const checkConnection = () => {
        const options = {
          hostname: this.host === '0.0.0.0' ? '127.0.0.1' : this.host,
          port: this.port,
          path: this.healthCheckPath,
          method: 'GET',
          timeout: 2000
        }

        const req = http.request(options, (res) => {
          // 只要能收到响应，说明服务已就绪
          const duration = Date.now() - startTime
          console.log(`后端健康检查通过 (耗时 ${duration}ms)`)
          res.resume()
          resolve()
        })

        req.on('error', (error) => {
          if (Date.now() - startTime > this.healthCheckTimeout) {
            reject(new Error(`健康检查超时 (${this.healthCheckTimeout}ms)`))
            return
          }
          setTimeout(checkConnection, 500)
        })

        req.on('timeout', () => {
          req.destroy()
          if (Date.now() - startTime > this.healthCheckTimeout) {
            reject(new Error(`健康检查超时 (${this.healthCheckTimeout}ms)`))
            return
          }
          setTimeout(checkConnection, 500)
        })

        req.end()
      }

      checkConnection()
    })
  }

  /**
   * 停止当前运行的后端进程
   * @returns {Promise<void>}
   */
  async stopBackend() {
    if (this.backendProcess && this.backendProcess.pid) {
      console.log(`正在停止后端进程 (PID: ${this.backendProcess.pid})...`)
      await this.killProcess(this.backendProcess.pid, { force: true })
      this.backendProcess = null
    }
    this.closeBackendLogStream()
  }

  /**
   * 重启后端服务
   * 1. 查找并终止现有进程
   * 2. 启动新进程
   * 3. 健康检查
   * @returns {Promise<void>}
   */
  async restartBackend() {
    try {
      // 1. 查找现有进程
      const existingPid = await this.findBackendProcess()
      if (existingPid) {
        console.log(`发现现有后端进程 (PID: ${existingPid})，正在终止...`)
        await this.killProcess(existingPid, { force: true, timeout: 5000 })
        console.log('现有后端进程已终止')
        // 等待端口释放
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } else {
        console.log(`端口 ${this.port} 未被占用`)
      }

      // 2. 启动新进程
      await this.startBackend()
      console.log('后端服务已启动')

      // 3. 健康检查
      await this.healthCheck()
      console.log('后端服务就绪')
    } catch (error) {
      console.error('重启后端失败:', error.message)
      this.closeBackendLogStream()
      throw error
    }
  }

  /**
   * 获取后端进程信息
   * @returns {Object} 后端进程信息
   * @returns {string} return.host - 主机地址
   * @returns {number} return.port - 端口号
   * @returns {number|null} return.pid - 进程 PID
   * @returns {string} return.apiBase - API 基础地址
   * @returns {string|null} return.backendLogFile - 后端日志文件路径
   */
  getBackendInfo() {
    return {
      host: this.host,
      port: this.port,
      pid: this.backendProcess?.pid || null,
      apiBase: `http://localhost:${this.port}/api`,
      backendLogFile: this.backendLogFile
    }
  }
}

module.exports = ProcessManager
