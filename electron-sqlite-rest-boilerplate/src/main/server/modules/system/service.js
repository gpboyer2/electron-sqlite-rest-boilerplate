const repository = require('./repository');

function querySystemStats(query) {
  const currentPage = Number.parseInt(query.current_page, 10) || 1;
  const pageSize = Number.parseInt(query.page_size, 10) || 20;
  const offset = (currentPage - 1) * pageSize;

  return {
    list: repository.listSystemStats(pageSize, offset),
    pagination: {
      current_page: currentPage,
      page_size: pageSize,
      total: repository.countSystemStats()
    }
  };
}

function createSystemStat(payload) {
  const now = Math.floor(Date.now() / 1000);
  const result = repository.createSystemStat({
    cpu_usage: payload.cpu_usage || 0,
    memory_usage: payload.memory_usage || 0,
    memory_total: payload.memory_total || 0,
    memory_used: payload.memory_used || 0,
    disk_usage: payload.disk_usage || 0,
    disk_total: payload.disk_total || 0,
    disk_used: payload.disk_used || 0,
    network_rx: payload.network_rx || 0,
    network_tx: payload.network_tx || 0,
    recorded_at: payload.recorded_at || now
  });

  return { id: result.lastInsertRowid };
}

function updateSystemStat(payload) {
  if (!payload.id) {
    throw new Error('缺少ID');
  }

  const result = repository.updateSystemStat(payload.id, payload);
  if (!result) {
    throw new Error('无可更新字段');
  }

  if (result.changes === 0) {
    throw new Error('记录不存在');
  }

  return { changes: result.changes };
}

function deleteSystemStats(payload) {
  const ids = payload.data;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('缺少要删除的ID');
  }

  const result = repository.deleteSystemStats(ids);
  return { deleted: result.changes };
}

module.exports = {
  querySystemStats,
  createSystemStat,
  updateSystemStat,
  deleteSystemStats
};
