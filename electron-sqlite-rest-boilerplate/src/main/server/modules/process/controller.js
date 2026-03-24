const log4js = require('../../middleware/log4jsPlus');
const processService = require('./service');

const logger = log4js.getLogger('httpApi');

function queryProcesses(req, res) {
  try {
    res.apiSuccess(processService.queryProcesses(req.query));
  } catch (error) {
    logger.error('[Process] 获取进程列表失败:', error.message);
    res.apiError(null, '获取进程列表失败');
  }
}

function createProcess(req, res) {
  try {
    res.apiSuccess(processService.createProcess(req.body), '创建成功');
  } catch (error) {
    logger.error('[Process] 创建进程记录失败:', error.message);
    res.apiError(null, error.message || '创建失败');
  }
}

function updateProcess(req, res) {
  try {
    res.apiSuccess(processService.updateProcess(req.body), '更新成功');
  } catch (error) {
    logger.error('[Process] 更新进程失败:', error.message);
    res.apiError(null, error.message || '更新失败');
  }
}

function deleteProcesses(req, res) {
  try {
    res.apiSuccess(processService.deleteProcesses(req.body), '删除成功');
  } catch (error) {
    logger.error('[Process] 删除进程失败:', error.message);
    res.apiError(null, error.message || '删除失败');
  }
}

module.exports = {
  queryProcesses,
  createProcess,
  updateProcess,
  deleteProcesses
};
