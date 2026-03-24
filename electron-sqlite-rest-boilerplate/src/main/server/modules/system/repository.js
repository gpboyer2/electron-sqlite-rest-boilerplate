const { desc, eq, inArray, sql } = require('drizzle-orm');
const { db, schema } = require('../../database/database');

const { system_stats } = schema;

const SYSTEM_FIELDS = [
  'cpu_usage',
  'memory_usage',
  'memory_total',
  'memory_used',
  'disk_usage',
  'disk_total',
  'disk_used',
  'network_rx',
  'network_tx',
  'recorded_at'
];

function countSystemStats() {
  return Number(
    db
      .select({
        total: sql`count(*)`
      })
      .from(system_stats)
      .get().total
  );
}

function listSystemStats(limit, offset) {
  return db
    .select()
    .from(system_stats)
    .orderBy(desc(system_stats.recorded_at))
    .limit(limit)
    .offset(offset)
    .all();
}

function createSystemStat(data) {
  return db.insert(system_stats).values(data).run();
}

function updateSystemStat(id, data) {
  const updatePayload = {};

  SYSTEM_FIELDS.forEach((field) => {
    if (data[field] !== undefined) {
      updatePayload[field] = data[field];
    }
  });

  if (Object.keys(updatePayload).length === 0) {
    return null;
  }

  return db.update(system_stats).set(updatePayload).where(eq(system_stats.id, id)).run();
}

function deleteSystemStats(ids) {
  return db.delete(system_stats).where(inArray(system_stats.id, ids)).run();
}

module.exports = {
  countSystemStats,
  listSystemStats,
  createSystemStat,
  updateSystemStat,
  deleteSystemStats
};
