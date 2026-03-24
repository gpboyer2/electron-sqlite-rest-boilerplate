const log4js = require('./log4jsPlus');

const httpApiLogger = log4js.getLogger('httpApi');
const logger = log4js.getLogger();

/**
 * 记录请求信息的自定义中间件函数
 * @param {Express.Request} req - Express 请求对象
 * @param {Express.Response} res - Express 响应对象
 * @param {Express.NextFunction} next - Express 下一个中间件函数
 * @returns {void} 无返回值，调用 next() 传递控制权
 */
const accessHandler = (req, res, next) => {
  // 记录请求的基本信息
  const requestInfo = {
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress
  };

  // 如果有查询参数，记录查询参数
  if (Object.keys(req.query).length > 0) {
    requestInfo.query = req.query;
  }

  // 如果有请求体，记录请求体（排除文件上传等大文件）
  if (req.body && Object.keys(req.body).length > 0) {
    // 过滤掉敏感字段（如密码）
    const safeBody = { ...req.body };
    const sensitiveFields = ['password', 'pwd', 'secret', 'token', 'apiKey'];
    sensitiveFields.forEach((field) => {
      if (safeBody[field]) {
        safeBody[field] = '***';
      }
    });
    requestInfo.body = safeBody;
  }

  // 输出请求日志
  httpApiLogger.info(JSON.stringify(requestInfo));

  // 保存原始的 res.send 方法
  const originalSend = res.send;

  // 重写 res.send 方法，记录响应信息
  res.send = function (data) {
    // 记录响应状态码
    httpApiLogger.info(
      `[${new Date().toLocaleString()}] - ${req.method} ${req.url} - Response: ${res.statusCode}`
    );
    // 调用原始的 res.send 方法发送响应
    originalSend.call(this, data);
  };

  next();
};

module.exports = accessHandler;
