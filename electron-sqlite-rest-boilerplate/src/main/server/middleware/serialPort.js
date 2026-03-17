const SerialPort = require('serialport');
const log4js = require('../middleware/log4jsPlus');
const logger = log4js.getLogger('default');

/**
 * 创建并配置串口连接实例
 * @param {string} path - 串口路径（如 /dev/ttyUSB0 或 COM1）
 * @param {number} baudRate - 波特率（如 9600、115200）
 * @returns {Object} 串口实例对象
 */
function createSerialPort(path, baudRate) {
  const port = new SerialPort.SerialPort({ path, baudRate });

  port.on('open', () => {
    logger.info(`串口 ${path} 已打开，正在监听数据...`);
  });

  port.on('error', (err) => {
    logger.error(`${path} 串口发生错误:`, err.message);
  });

  port.on('data', (data) => {
    logger.info(`从 ${path} 串口收到数据:`, data.toString());
  });

  return port;
}

/**
 * 串口中间件工厂函数
 * 创建多个串口实例并将它们挂载到 req.serialPorts
 * @param {Object} options - 配置选项
 * @param {Array<Object>} options.ports - 串口配置数组，每项包含 path 和 baudRate
 * @returns {Function} Express 中间件函数
 */
function serialPortMiddleware(options) {
  const { ports } = options;

  const serialPorts = [];

  // 创建串口实例并存储到数组中
  ports.forEach((port) => {
    const { path, baudRate } = port;
    logger.info(port);
    const serialPort = createSerialPort(path, baudRate);
    serialPorts.push(serialPort);
  });

  return (req, res, next) => {
    req.serialPorts = serialPorts;
    next();
  };
}
/**
 * 列出当前设备所有可用串口
 * 将可用串口列表打印到日志
 * @returns {Promise<void>}
 */
function serialPortList() {
  SerialPort.SerialPort.list()
    .then((ports) => {
      logger.info('输出当前设备所有串口：', ports.length === 0 ? '无串口' : ports);
    })
    .catch((error) => {
      logger.error(error);
    });
}

module.exports = { serialPortMiddleware, serialPortList };
