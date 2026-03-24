module.exports = [
  { prefix: '/health', router: require('./health/router'), desc: '健康检查接口' },
  { prefix: '/dashboard', router: require('./dashboard/router'), desc: '仪表盘接口' },
  { prefix: '/system', router: require('./system/router'), desc: '系统监控接口' },
  { prefix: '/process', router: require('./process/router'), desc: '进程管理接口' },
  { prefix: '/settings', router: require('./settings/router'), desc: '设置接口' },
  { prefix: '/about', router: require('./about/router'), desc: '关于接口' },
  { prefix: '/auth', router: require('./auth/router'), desc: '模板认证与权限演示接口' }
];
