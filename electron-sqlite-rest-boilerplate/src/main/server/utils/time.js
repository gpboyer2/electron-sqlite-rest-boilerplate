/**
 * 时间工具函数
 * @fileoverview 提供时间格式化、时间戳获取等时间相关的工具函数
 * @author CSSC Node View
 * @version 1.0.0
 * @since 2025-11-28
 */

const moment = require('moment');

/**
 * 获取当前格式化的时间字符串
 * @param {string} [_format='YYYY-MM-DD HH:mm:ss'] - moment.js 格式化字符串
 * @returns {string} 格式化后的时间字符串
 */
function getCurrentDateTime(_format = 'YYYY-MM-DD HH:mm:ss') {
  return moment().format(_format);
}

/**
 * 获取毫秒级时间戳
 * @returns {number} 当前时间的毫秒时间戳
 */
function getTimeStampMS() {
  return new Date().getTime();
}

/**
 * 获取秒级时间戳
 * @returns {number} 当前时间的秒级时间戳（Unix 时间戳）
 */
function getTimeStamp() {
  return Math.round(new Date().getTime() / 1000);
}

module.exports = {
  getCurrentDateTime,
  getTimeStampMS,
  getTimeStamp
};
