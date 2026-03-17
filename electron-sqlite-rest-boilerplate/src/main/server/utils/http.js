/**
 * HTTP工具函数
 * @fileoverview 封装HTTP GET和POST请求方法，简化HTTP调用
 * @author CSSC Node View
 * @version 1.0.0
 * @since 2025-11-28
 */

const http = require('http');
const log4js = require('../middleware/log4jsPlus');
const httpApiLogger = log4js.getLogger('httpApi');

/**
 * 发送 HTTP GET 请求
 * @param {string} url - 请求的 URL 地址
 * @param {Function} cb - 成功回调函数，接收参数 (status_code, rawData, response)
 * @param {Function} errCb - 错误回调函数，接收错误对象
 * @param {string} [encoding='utf8'] - 响应数据编码格式，默认为 utf8
 */
const get = (url, cb, errCb, encoding = 'utf8') => {
  http.get(url, (res) => {
    const { status_code } = res;
    res.setEncoding(encoding);
    let rawData = '';
    res.on('data', (chunk) => (rawData += chunk));
    res.on('end', () => cb(status_code, rawData, res));
    res.on('error', (e) => errCb(e));
  });
};

/**
 * 发送 HTTP POST 请求
 * @param {string} host - 目标主机地址
 * @param {number} port - 目标端口
 * @param {string} path - 请求路径
 * @param {Object} data - 要发送的 JSON 数据对象
 * @param {Object} [options] - 请求配置选项，默认包含 method: 'POST' 和 Content-Type: 'application/json'
 * @param {Function} cb - 回调函数，接收参数 (status_code, responseString, response)
 */
const post = (host, port, path, data, options, cb) => {
  try {
    if (!options) {
      options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };
    }

    const postData = JSON.stringify(data);

    options.hostname = host;
    options.port = port;
    options.path = path;
    options.headers['Content-Length'] = postData.length;

    const req = http.request(options, (res) => {
      let recStr = '';
      res.on('data', (chunk) => {
        recStr += chunk;
      });
      res.on('end', () => {
        cb(res.status_code, recStr, res);
      });
    });

    req.write(postData);
    req.end();
  } catch (error) {
    httpApiLogger.error(`发送 post 发生错误`, error.message);
  }
};

module.exports = {
  get,
  post
};
