/**
 * 全局测试数据生成器
 *
 * 设计理念：
 * 1. 使用 Mock.js 动态生成所有测试数据
 * 2. 存储在高维度全局变量中
 * 3. 每次测试运行生成新数据，无状态依赖
 * 4. 修改密码测试使用全局数据，放在最后执行
 */

const Mock = require('mockjs')

/**
 * 全局测试数据
 * 这是高维度的全局变量，所有测试模块共享
 */
const GLOBAL_TEST_DATA = {
  // 用户相关测试数据
  user: null,

  // 角色相关测试数据
  role: null,

  // 层级相关测试数据
  hierarchy: null,

  // 流程图相关测试数据
  flowchart: null,

  // 报文相关测试数据
  packetMessage: null,

  // 通信节点相关测试数据
  communicationNode: null,

  // 系统级设计相关测试数据
  systemLevelDesign: null
}

/**
 * 生成随机用户数据
 * @returns {Object} 用户数据对象
 * @returns {string} return.username - 用户名
 * @returns {string} return.password - 密码
 * @returns {string} return.realName - 真实姓名
 * @returns {string} return.email - 邮箱
 * @returns {string} return.phone - 手机号
 * @returns {number} return.roleId - 角色ID
 * @returns {number} return.status - 状态
 */
function generateUserData() {
  const randomSuffix = Mock.Random.string('number', 4)
  return {
    username: `test_user_${randomSuffix}`,
    password: Mock.Random.string('lower', 8, 16) + '1A@', // 确保包含大小写字母、数字和特殊字符
    realName: Mock.Random.cname(),
    email: Mock.Random.email(),
    phone:
      '1' + Mock.Random.pick(['3', '4', '5', '6', '7', '8', '9']) + Mock.Random.string('number', 9), // 生成符合规则的中国手机号：1 + 3-9 + 9位数字
    roleId: 3, // 普通用户角色
    status: 1
  }
}

/**
 * 生成随机角色数据
 * @returns {Object} 角色数据对象
 * @returns {string} return.roleName - 角色名称
 * @returns {string} return.description - 角色描述
 * @returns {number[]} return.permissions - 权限列表
 */
function generateRoleData() {
  return {
    roleName: `测试角色_${Mock.Random.string('lower', 5)}`,
    description: Mock.Random.csentence(10, 30),
    permissions: [1, 2, 3] // 基础权限
  }
}

/**
 * 生成随机层级数据
 * @returns {Object} 层级数据对象
 * @returns {string} return.hierarchyName - 层级名称
 * @returns {string} return.description - 层级描述
 */
function generateHierarchyData() {
  return {
    hierarchyName: `测试层级_${Mock.Random.string('lower', 5)}`,
    description: Mock.Random.csentence(10, 30)
  }
}

/**
 * 生成随机流程图数据
 * @returns {Object} 流程图数据对象
 * @returns {string} return.flowchartName - 流程图名称
 * @returns {string} return.description - 流程图描述
 */
function generateFlowchartData() {
  return {
    flowchartName: `测试流程图_${Mock.Random.string('lower', 5)}`,
    description: Mock.Random.csentence(10, 30)
  }
}

/**
 * 生成随机报文数据
 * @returns {Object} 报文数据对象
 * @returns {string} return.messageName - 报文名称
 * @returns {string} return.messageType - 报文类型
 * @returns {string} return.description - 报文描述
 */
function generatePacketMessageData() {
  return {
    messageName: `测试报文_${Mock.Random.string('lower', 5)}`,
    messageType: Mock.Random.pick(['REQUEST', 'RESPONSE', 'NOTIFY']),
    description: Mock.Random.csentence(10, 30)
  }
}

/**
 * 生成随机通信节点数据
 * @returns {Object} 通信节点数据对象
 * @returns {string} return.nodeName - 节点名称
 * @returns {string} return.nodeType - 节点类型
 * @returns {string} return.ipAddress - IP地址
 * @returns {number} return.port - 端口号
 * @returns {string} return.description - 节点描述
 */
function generateCommunicationNodeData() {
  return {
    nodeName: `测试节点_${Mock.Random.string('lower', 5)}`,
    nodeType: Mock.Random.pick(['SATELLITE', 'GATEWAY', 'BUOY']),
    ipAddress: Mock.Random.ip(),
    port: Mock.Random.integer(1024, 65535),
    description: Mock.Random.csentence(10, 30)
  }
}

/**
 * 初始化全局测试数据
 * 在测试开始前调用，生成所有动态数据
 * @returns {void}
 */
function initializeGlobalTestData() {
  console.log('[MockDataGenerator] 初始化全局测试数据...')
  GLOBAL_TEST_DATA.user = generateUserData()
  GLOBAL_TEST_DATA.role = generateRoleData()
  GLOBAL_TEST_DATA.hierarchy = generateHierarchyData()
  GLOBAL_TEST_DATA.flowchart = generateFlowchartData()
  GLOBAL_TEST_DATA.packetMessage = generatePacketMessageData()
  GLOBAL_TEST_DATA.communicationNode = generateCommunicationNodeData()
  console.log('[MockDataGenerator] 全局测试数据初始化完成')
  console.log('[MockDataGenerator] 用户数据:', {
    username: GLOBAL_TEST_DATA.user.username,
    password: '***',
    realName: GLOBAL_TEST_DATA.user.realName
  })
}

/**
 * 获取全局测试数据
 * @returns {Object} 全局测试数据对象
 */
function getGlobalTestData() {
  return GLOBAL_TEST_DATA
}

/**
 * 获取特定类型的测试数据
 * @param {string} type - 数据类型
 * @returns {Object|null} 特定类型的测试数据
 */
function getTestData(type) {
  return GLOBAL_TEST_DATA[type]
}

/**
 * 设置测试数据（用于在测试中更新数据，如保存创建后返回的 ID）
 * @param {string} type - 数据类型
 * @param {Object} data - 要更新的数据
 * @returns {void}
 */
function setTestData(type, data) {
  GLOBAL_TEST_DATA[type] = { ...GLOBAL_TEST_DATA[type], ...data }
}

/**
 * 重置全局测试数据
 * @returns {void}
 */
function resetGlobalTestData() {
  for (const key in GLOBAL_TEST_DATA) {
    GLOBAL_TEST_DATA[key] = null
  }
  console.log('[MockDataGenerator] 全局测试数据已重置')
}

module.exports = {
  GLOBAL_TEST_DATA,
  initializeGlobalTestData,
  getGlobalTestData,
  getTestData,
  setTestData,
  resetGlobalTestData,
  generateUserData,
  generateRoleData,
  generateHierarchyData,
  generateFlowchartData,
  generatePacketMessageData,
  generateCommunicationNodeData
}
