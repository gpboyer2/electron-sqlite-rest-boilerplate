const { desc, eq } = require('drizzle-orm');
const { db, schema } = require('../../database/database');

const { about_info } = schema;

function getLatestAboutInfo() {
  return db.select().from(about_info).orderBy(desc(about_info.id)).limit(1).get();
}

function updateAboutInfo(data) {
  const updatePayload = {
    updated_at: data.updated_at
  };

  ['app_name', 'version', 'description', 'author', 'license'].forEach((field) => {
    if (data[field] !== undefined && data[field] !== null) {
      updatePayload[field] = data[field];
    }
  });

  return db.update(about_info).set(updatePayload).where(eq(about_info.id, data.id)).run();
}

function createAboutInfo(data) {
  return db.insert(about_info).values(data).run();
}

module.exports = {
  getLatestAboutInfo,
  updateAboutInfo,
  createAboutInfo
};
