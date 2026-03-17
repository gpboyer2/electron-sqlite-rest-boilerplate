/**
 * 数组工具函数
 * @fileoverview 提供数组相关的工具函数
 * @author CSSC Node View
 * @version 1.0.0
 * @since 2025-11-28
 */

/**
 * 检查数组中是否包含指定元素
 * @param {Array} arr - 要搜索的数组
 * @param {*} item - 要查找的元素
 * @returns {boolean} 如果数组中包含该元素返回 true，否则返回 false
 */
function isArrContainsItem(arr, item) {
  for (let idx in arr) {
    if (arr[idx] === item) {
      return true;
    }
  }
  return false;
}

module.exports = {
  isArrContainsItem
};
