const repository = require('./repository');

function querySettings(query) {
  const key = query.key;

  if (key) {
    const setting = repository.getSettingByKey(key);
    if (!setting) {
      throw new Error('设置不存在');
    }

    return setting;
  }

  const list = repository.listSettings();
  const settingsMap = list.reduce((result, item) => {
    result[item.key] = item.value;
    return result;
  }, {});

  return {
    list,
    map: settingsMap,
    pagination: { current_page: 1, page_size: list.length, total: list.length }
  };
}

function createSetting(payload) {
  if (!payload.key) {
    throw new Error('缺少设置键');
  }

  const result = repository.createSetting({
    key: payload.key,
    value: payload.value || '',
    description: payload.description || '',
    updated_at: Math.floor(Date.now() / 1000)
  });

  return { id: result.lastInsertRowid };
}

function updateSetting(payload) {
  if (!payload.key) {
    throw new Error('缺少设置键');
  }

  const now = Math.floor(Date.now() / 1000);
  const existing = repository.getSettingByKey(payload.key);

  if (existing) {
    const result = repository.updateSetting({
      key: payload.key,
      value: payload.value || '',
      description: payload.description || '',
      updated_at: now
    });

    return { changes: result.changes };
  }

  const result = repository.createSetting({
    key: payload.key,
    value: payload.value || '',
    description: payload.description || '',
    updated_at: now
  });

  return { id: result.lastInsertRowid };
}

function deleteSettings(payload) {
  const keys = payload.data;
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('缺少要删除的设置键');
  }

  const result = repository.deleteSettings(keys);
  return { deleted: result.changes };
}

module.exports = {
  querySettings,
  createSetting,
  updateSetting,
  deleteSettings
};
