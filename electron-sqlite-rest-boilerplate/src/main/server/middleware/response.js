const { getCurrentDateTime } = require('../utils/time')
const log4js = require('../middleware/log4jsPlus')
const logger = log4js.getLogger('httpApi')

// 认证绕过开关（统一配置入口）
const BYPASS_AUTH = process.env.BYPASS_AUTH === 'true'

/**
 * 统一返回格式封装中间件
 * 为 Express 的 response 对象添加 apiSuccess 和 apiError 方法，并记录请求日志
 * @param {Object} req - Express 请求对象
 * @param {Object} res - Express 响应对象，会被扩展 apiSuccess 和 apiError 方法
 * @param {Function} next - Express 中间件 next 函数
 */
const responseFormatMiddleware = (req, res, next) => {
  // 认证绕过模式下，添加响应头通知前端
  if (BYPASS_AUTH) {
    res.setHeader('X-Bypass-Auth', 'true')
  }

  const start = process.hrtime()
  res.on('finish', () => {
    const elapsed = process.hrtime(start)
    const elapsedTimeInMs = parseFloat((elapsed[0] * 1000 + elapsed[1] / 1000000).toFixed(2))
    logger.info(
      `[${getCurrentDateTime()}]- ${req.ip} - [${req.method}] ${req.originalUrl} - ${res.statusCode} - ${elapsedTimeInMs}ms`
    )
  })

  // 格式化成功返回
  res.apiSuccess = (datum = null, message = '操作成功') => {
    res.status(200).json({
      status: 'success',
      message,
      datum
    })
  }

  // 格式化错误返回（参数顺序与 apiSuccess 保持一致）
  res.apiError = (datum = null, message = '操作失败') => {
    res.status(200).json({
      status: 'error',
      message,
      datum
    })
  }

  next()
}

module.exports = responseFormatMiddleware
