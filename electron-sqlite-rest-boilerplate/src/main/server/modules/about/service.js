const repository = require('./repository');

function getAboutInfo() {
  const aboutInfo = repository.getLatestAboutInfo();

  if (aboutInfo) {
    return aboutInfo;
  }

  return {
    app_name: 'Electron Boilerplate',
    version: '1.0.0',
    description: 'Electron + SQLite + REST API Desktop Application',
    author: '开发者',
    license: 'AGPL-3.0'
  };
}

function updateAboutInfo(payload) {
  const now = Math.floor(Date.now() / 1000);
  const existing = repository.getLatestAboutInfo();

  if (existing) {
    const result = repository.updateAboutInfo({
      id: existing.id,
      app_name: payload.app_name || null,
      version: payload.version || null,
      description: payload.description || null,
      author: payload.author || null,
      license: payload.license || null,
      updated_at: now
    });

    return { changes: result.changes };
  }

  const result = repository.createAboutInfo({
    app_name: payload.app_name || 'Electron Boilerplate',
    version: payload.version || '1.0.0',
    description: payload.description || '',
    author: payload.author || '开发者',
    license: payload.license || 'AGPL-3.0',
    updated_at: now
  });

  return { id: result.lastInsertRowid };
}

module.exports = {
  getAboutInfo,
  updateAboutInfo
};
