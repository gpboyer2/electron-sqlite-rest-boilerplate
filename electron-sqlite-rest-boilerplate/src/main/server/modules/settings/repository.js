const { asc, eq, inArray } = require('drizzle-orm');
const { db, schema } = require('../../database/database');

const { settings } = schema;

function getSettingByKey(key) {
  return db.select().from(settings).where(eq(settings.key, key)).limit(1).get();
}

function listSettings() {
  return db.select().from(settings).orderBy(asc(settings.id)).all();
}

function createSetting(data) {
  return db.insert(settings).values(data).run();
}

function updateSetting(data) {
  return db
    .update(settings)
    .set({
      value: data.value,
      description: data.description,
      updated_at: data.updated_at
    })
    .where(eq(settings.key, data.key))
    .run();
}

function deleteSettings(keys) {
  return db.delete(settings).where(inArray(settings.key, keys)).run();
}

module.exports = {
  getSettingByKey,
  listSettings,
  createSetting,
  updateSetting,
  deleteSettings
};
