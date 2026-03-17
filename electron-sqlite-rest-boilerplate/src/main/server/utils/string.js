/**
 * 字符串验证工具函数
 * @fileoverview 提供字符串安全性验证相关的工具函数
 */

/**
 * 检查字符串是否包含非法控制字符
 *
 * 排除普通空白字符（tab、换行符、回车符），
 * 拒绝 NULL 字符和其他危险控制字符
 *
 * @param {string} str - 待检查的字符串
 * @returns {boolean} 如果包含非法控制字符返回 true，否则返回 false
 */
function hasControlCharacter(str) {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // 检查控制字符范围: 0-8, 11-12, 14-31, 127
    // 排除: 9(tab), 10(line feed), 13(carriage return)
    if (
      (code >= 0 && code <= 8) ||
      (code >= 11 && code <= 12) ||
      (code >= 14 && code <= 31) ||
      code === 127
    ) {
      return true;
    }
  }
  return false;
}

/**
 * 验证用户名格式
 *
 * @param {string} username - 待验证的用户名
 * @returns {{valid: boolean, error: string|null}} 验证结果
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: '用户名必须是字符串' };
  }

  const trimmed = username.trim();

  if (trimmed === '') {
    return { valid: false, error: '用户名不能为空' };
  }

  if (trimmed.length < 3 || trimmed.length > 50) {
    return { valid: false, error: '用户名长度必须在3-50个字符之间' };
  }

  if (hasControlCharacter(trimmed)) {
    return { valid: false, error: '用户名包含非法字符' };
  }

  return { valid: true, error: null };
}

/**
 * 验证密码格式
 *
 * @param {string} password - 待验证的密码
 * @returns {{valid: boolean, error: string|null}} 验证结果
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: '密码必须是字符串' };
  }

  const trimmed = password.trim();

  if (trimmed === '') {
    return { valid: false, error: '密码不能为空' };
  }

  if (trimmed.length < 6 || trimmed.length > 100) {
    return { valid: false, error: '密码长度必须在6-100个字符之间' };
  }

  if (hasControlCharacter(trimmed)) {
    return { valid: false, error: '密码包含非法字符' };
  }

  return { valid: true, error: null };
}

/**
 * 判断值是否为有效值
 * 校验 undefined、null、false、空字符串、字符串形式的 undefined/null/NaN/false、数字 NaN
 *
 * @param {*} value - 待判断的值
 * @returns {boolean} true 表示有效，false 表示无效
 */
function isValidValue(value) {
  // undefined 或 null
  if (value === undefined || value === null) {
    return false;
  }

  // 布尔值 false
  if (value === false) {
    return false;
  }

  // 字符串类型
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // 空字符串
    if (trimmed === '') {
      return false;
    }
    // 字符串形式的假值
    if (['undefined', 'null', 'NaN', 'false'].includes(trimmed.toLowerCase())) {
      return false;
    }
  }

  return true;
}

module.exports = {
  hasControlCharacter,
  validateUsername,
  validatePassword,
  isValidValue
};
