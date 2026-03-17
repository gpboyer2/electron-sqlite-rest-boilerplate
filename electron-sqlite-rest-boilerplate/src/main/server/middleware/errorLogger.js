const log4js = require('./log4jsPlus');

const errLogger = log4js.getLogger('error');
const logger = log4js.getLogger();

/**
 * 错误处理中间件函数
 * @param {Error} err - 错误对象
 * @param {Express.Request} req - Express 请求对象
 * @param {Express.Response} res - Express 响应对象
 * @param {Express.NextFunction} next - Express 下一个中间件函数
 * @returns {void} 无返回值，通过 res.status(500).send() 发送错误响应
 */
const errorHandler = (err, req, res, next) => {
  errLogger.error(err.stack);
  logger.info(err.stack);
  res.status(500).send('Internal Server Error');
};

module.exports = errorHandler;
