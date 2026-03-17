const log4js = require('../middleware/log4jsPlus');
const debugLogger = log4js.getLogger('debug'); /**
 * 通用工具函数集合
 * @fileoverview 提供网络、时间、编码、计算等各类通用工具函数
 * @author CSSC Node View
 * @version 1.0.0
 * @since 2025-11-28
 */

const { networkInterfaces } = require('os');

/**
 * 获取本地IPv4地址
 * @returns {string} 本地非内部网络的IPv4地址
 */
function getLocalIP() {
  const interfaces = networkInterfaces();
  let localIP = '';

  Object.keys(interfaces).forEach((name) => {
    interfaces[name].forEach((iface) => {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
      }
    });
  });

  return localIP;
}

/**
 * 获取当前时间数组（7位格式）
 * 将当前时间拆分为7个元素：年份前两位、年份后两位、月、日、时、分、秒
 * @example 2023年9月2日 12:23:56 -> ["20", "23", "09", "02", "12", "23", "56"]
 * @returns {string[]} 包含7个时间元素的数组
 */
function parseTimeStampToArray() {
  const now = new Date();

  const year = now.getFullYear();

  const yearFirstDigit = String(Math.floor(year / 100));
  const yearSecondDigit = String(year % 100).padStart(2, '0');

  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getDay()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const formattedTime = [yearFirstDigit, yearSecondDigit, month, day, hours, minutes, seconds];
  return formattedTime;
}
/**
 * 获取当前时间数组（7个字段，年份占4位）
 * @example 2023年9月2日 12:23:56 -> [2023, "09", "02", "12", "23", "56", "0"]
 * @returns {(number|string)[]} 包含7个时间元素的数组，年份为数字，其他为字符串
 */
function parseTimeStampToArray1() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getDay()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const formattedTime = [year, month, day, hours, minutes, seconds, '0'];
  return formattedTime;
}
/**
 * 将时间数组转换为本地化的日期时间字符串
 * @example [2023, "09", "02", "12", "23", "56", "0"] -> "2023年9月2日 12:23:56"
 * @param {Array} timeArray - 时间数组，包含 [year, month, day, hours, minutes, seconds]
 * @returns {string} 本地化的日期时间字符串
 */
function parseToTimestamp1(timeArray) {
  const [year, month, day, hours, minutes, seconds] = timeArray;

  // 创建一个 Date 对象来表示指定的时间
  const date = new Date(
    year,
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hours, 10),
    parseInt(minutes, 10),
    parseInt(seconds, 10)
  );

  // 获取该时间对应的时间戳（单位为毫秒）
  const timestamp = date.toLocaleString();

  return timestamp;
}
/**
 * 将时间数组转换为时间戳（毫秒）
 * @example ["20", "23", "09", "02", "12", "23", "56"] -> 毫秒时间戳
 * @param {string[]} timeArray - 时间数组，包含 [yearFirstDigit, yearSecondDigit, month, day, hours, minutes, seconds]
 * @returns {number} Unix 毫秒时间戳
 */
function parseToTimestamp(timeArray) {
  const [yearFirstDigit, yearSecondDigit, month, day, hours, minutes, seconds] = timeArray;
  // 将年份的两个数字合并成一个四位数
  const year = parseInt(yearFirstDigit + yearSecondDigit, 10);
  // 创建一个 Date 对象来表示指定的时间
  const date = new Date(
    year,
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hours, 10),
    parseInt(minutes, 10),
    parseInt(seconds, 10)
  );
  // 获取该时间对应的时间戳（单位为毫秒）
  const timestamp = date.getTime();

  return timestamp;
}

/**
 * 将时间字符串转换为时间数组
 * @example "12:08:10" -> ["12", "08", "10", "00"]
 * @param {string} timeString - 时间字符串，格式如 "12:23:34"
 * @returns {string[]} 包含 [小时, 分钟, 秒, "00"] 的数组
 */
function parseTimeArray(timeString) {
  const timeArray = timeString.split(':').map((item) => item.padStart(2, '0'));
  timeArray.push('00');

  return timeArray;
}

/**
 * 将时间数组转换为时间字符串
 * @example ["12", "08", "10", "00"] -> "12:08:10"
 * @param {string[]} timeArray - 时间数组，包含 [小时, 分钟, 秒, 其他]
 * @returns {string} 格式化的时间字符串 "HH:mm:ss"
 */
function parseTimeString(timeArray) {
  const newArr = timeArray.slice(0, 3);

  return newArr.join(':');
}

/**
 * 将十进制度数转换为度分秒数组
 * @example 115.8657 -> [115, 51, 27, 50]
 * @param {number} dms - 十进制格式的经纬度数值
 * @returns {number[]} 包含 [度, 分, 秒, 毫秒] 的数组
 */
function parseDegrees(dms) {
  const degrees = Math.floor(dms);
  const minutes = Math.floor((dms - degrees) * 60);
  const seconds = Math.floor((dms - degrees - minutes / 60) * 3600).toFixed(2);
  const secondsInt = Math.floor(seconds);
  const secondsDecimal = Math.round((seconds - secondsInt) * 100);

  return [degrees, minutes, secondsInt, secondsDecimal];
}

/**
 * 将度分秒数组转换为十进制度数
 * @example [115, 51, 27, 50] -> 115.8657
 * @param {number[]} dms - 包含 [度, 分, 秒, 毫秒] 的数组
 * @returns {number} 十进制格式的经纬度数值
 */
function parseDegreesArray(dms) {
  const degrees = dms[0];
  const minutes = dms[1];
  const secondsInt = dms[2];
  const secondsDecimal = dms[3];

  const totalSeconds = secondsInt + secondsDecimal / 100;
  const totalMinutes = minutes + totalSeconds / 60;
  const totalDegrees = degrees + totalMinutes / 60;
  return totalDegrees;
}
/**
 * 将度分秒格式字符串转换为数组
 * @example "117°51′27″" -> [117, 51, 27, 45]
 * @param {string} dms - 度分秒格式字符串
 * @returns {number[]} 包含 [度, 分, 秒, 毫秒] 的数组
 */
function parseDMS(dms) {
  // 使用正则表达式提取度、分、秒的数值部分
  var result = longitude.match(/(\d+)°(\d+)′(\d+)″/);

  // 将数值部分转换为整数
  var degrees = parseInt(result[1]);
  var minutes = parseInt(result[2]);
  var seconds = parseInt(result[3]);

  // 计算秒钟的小数部分，并转换为两位整数
  var secondsDecimal = Math.round((seconds / 60) * 100);

  // 输出结果
  return [degrees, minutes, seconds, secondsDecimal];
}

/**
 * 将度分秒数组转换为度分秒格式字符串
 * @example [117, 51, 27, 45] -> "117°51′27.45″"
 * @param {number[]} longitude - 包含 [度, 分, 秒, 毫秒] 的数组
 * @returns {string} 度分秒格式字符串
 */
function parseDMSArray(longitude) {
  longitude = [117, 51, 27, 45];

  // 将度、分、秒整数部分和秒小数部分取两位整数进行拆解
  var degrees = longitude[0];
  var minutes = longitude[1];
  var seconds = longitude[2];
  var secondsDecimal = longitude[3];

  // 计算度分秒表示法中的秒钟部分
  // 先将秒的小数部分转换为小数形式
  var secondsFraction = secondsDecimal / 100;
  // 再将秒和秒的小数部分相加得到完整的秒钟部分
  seconds += secondsFraction;

  return degrees + '°' + minutes + '′' + seconds + '″';
}

/**
 * 将字符串转换为16进制数组
 * @param {string} str - 输入字符串
 * @returns {string[]} 每个字符的16进制表示数组
 */
function parseStringToHexArray(str) {
  const hexArray = [];

  for (let i = 0; i < str.length; i++) {
    const hex = str.charCodeAt(i).toString(16);
    hexArray.push(hex);
  }

  return hexArray;
}
/**
 * 将16进制数组转换为字符串
 * @example ["24", "59", "58", "42"] -> "$YXB"
 * @param {string[]} hexArray - 16进制字符串数组
 * @returns {string} 解码后的字符串
 */
function parseHexArrayToString(hexArray) {
  let str = '';

  for (let i = 0; i < hexArray.length; i++) {
    const charCode = parseInt(hexArray[i], 16);
    const char = String.fromCharCode(charCode);
    str += char;
  }

  return str;
}

/**
 * 计算数组的校验和（XOR校验）
 * @param {number[]} data - 字节数组
 * @returns {number} XOR校验和
 */
function calculateChecksum(data) {
  let checksum = 0;
  for (let i = 0; i < data.length; i++) {
    checksum ^= data[i]; // 使用按位异或运算符进行累计计算
  }
  return checksum;
}

/**
 * 检查字符串是否全部由中文字符组成
 * @param {string} str - 待检查的字符串
 * @returns {boolean} 如果全部是中文字符返回 true，否则返回 false
 */
function isAllChineseCharacters(str) {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x4e00 || code > 0x9fff) {
      return false;
    }
  }
  return true;
}

/**
 * 计算数值的模值
 * @param {number} iValue - 输入数值
 * @param {number} [modInverse=2000] - 模数，默认为 2000
 * @returns {number} 模运算结果
 */
function calculateMod(iValue, modInverse = 2000) {
  const modValue = iValue % modInverse;
  return modValue;
}

/**
 * 根据模值反推原数值
 * @param {number} modValue - 模值
 * @param {number} [modInverse=2000] - 模数，默认为 2000
 * @returns {number|null} 找到的原数值，未找到返回 null
 */
function calculateValueByMod(modValue, modInverse = 2000) {
  let year = null;

  for (let i = 0; i < modInverse; i++) {
    if (i % modInverse === modValue) {
      year = i;
      break;
    }
  }

  debugLogger.debug(year);
}

/**
 * 生成全局唯一的时间戳序列号
 * 将当前时间编码为32位整数：年(6位) + 月(4位) + 日(5位) + 时(5位) + 分(6位) + 秒(6位)
 * @returns {number} 编码后的32位序列号
 */
function generateSequenceNumber() {
  const currentDate = new Date();

  let year = currentDate.getFullYear() - 2000;
  let month = currentDate.getMonth() + 1;
  let day = currentDate.getDate();
  let hour = currentDate.getDay();
  let minute = currentDate.getMinutes();
  let second = currentDate.getSeconds();

  let encoded = 0;
  encoded |= (year & 0x3f) << 26;
  encoded |= (month & 0x0f) << 22;
  encoded |= (day & 0x1f) << 17;
  encoded |= (hour & 0x1f) << 12;
  encoded |= (minute & 0x3f) << 6;
  encoded |= second & 0x3f;

  return encoded;
}

/**
 * 基于基准值生成随机浮动数据
 * @param {number} baseValue - 基准数值
 * @returns {number} 在 0 到 baseValue 之间的随机值
 */
function getRandomData(baseValue) {
  let data = baseValue * (1 - Math.random());
  return data;
}

/**
 * 生成指定范围内的随机整数
 * @param {number} min - 最小值（包含）
 * @param {number} max - 最大值（包含）
 * @returns {number} 在 min 到 max 之间的随机整数
 */
function getRandomValue(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

module.exports = {
  getLocalIP,
  parseTimeStampToArray,
  parseToTimestamp,
  parseTimeStampToArray1,
  parseToTimestamp1,
  parseTimeArray,
  parseTimeString,
  isAllChineseCharacters,
  parseDegrees,
  parseDegreesArray,
  parseDMS,
  parseDMSArray,
  calculateChecksum,
  calculateMod,
  calculateValueByMod,
  generateSequenceNumber,
  getRandomData,
  getRandomValue
};
