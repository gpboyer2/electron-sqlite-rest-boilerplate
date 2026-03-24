const repository = require('./repository');

function queryProcesses(query) {
  const status = query.status;
  const currentPage = Number.parseInt(query.current_page, 10) || 1;
  const pageSize = Number.parseInt(query.page_size, 10) || 20;
  const offset = (currentPage - 1) * pageSize;

  return {
    list: repository.listProcesses(status, pageSize, offset),
    pagination: {
      current_page: currentPage,
      page_size: pageSize,
      total: repository.countProcesses(status)
    }
  };
}

function createProcess(payload) {
  if (!payload.pid || !payload.name) {
    throw new Error('缺少必要参数');
  }

  const now = Math.floor(Date.now() / 1000);
  const result = repository.createProcess({
    pid: payload.pid,
    name: payload.name,
    status: payload.status || 'running',
    cpu_usage: payload.cpu_usage || 0,
    memory_usage: payload.memory_usage || 0,
    memory_bytes: payload.memory_bytes || 0,
    started_at: payload.started_at || null,
    command: payload.command || null,
    created_at: now,
    updated_at: now
  });

  return { id: result.lastInsertRowid };
}

function updateProcess(payload) {
  if (!payload.id) {
    throw new Error('缺少ID');
  }

  const result = repository.updateProcess(payload.id, {
    ...payload,
    updated_at: Math.floor(Date.now() / 1000)
  });

  if (!result) {
    throw new Error('无可更新字段');
  }

  if (result.changes === 0) {
    throw new Error('记录不存在');
  }

  return { changes: result.changes };
}

function deleteProcesses(payload) {
  const ids = payload.data;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('缺少要删除的ID');
  }

  const result = repository.deleteProcesses(ids);
  return { deleted: result.changes };
}

module.exports = {
  queryProcesses,
  createProcess,
  updateProcess,
  deleteProcesses
};
