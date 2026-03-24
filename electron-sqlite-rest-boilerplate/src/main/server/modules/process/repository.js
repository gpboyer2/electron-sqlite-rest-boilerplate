const { desc, eq, inArray, sql } = require('drizzle-orm');
const { db, schema } = require('../../database/database');

const { process_info } = schema;

const PROCESS_FIELDS = [
  'pid',
  'name',
  'status',
  'cpu_usage',
  'memory_usage',
  'memory_bytes',
  'started_at',
  'command'
];

function countProcesses(status) {
  if (!status) {
    return Number(
      db
        .select({
          total: sql`count(*)`
        })
        .from(process_info)
        .get().total
    );
  }

  return Number(
    db
      .select({
        total: sql`count(*)`
      })
      .from(process_info)
      .where(eq(process_info.status, status))
      .get().total
  );
}

function listProcesses(status, limit, offset) {
  if (!status) {
    return db
      .select()
      .from(process_info)
      .orderBy(desc(process_info.updated_at))
      .limit(limit)
      .offset(offset)
      .all();
  }

  return db
    .select()
    .from(process_info)
    .where(eq(process_info.status, status))
    .orderBy(desc(process_info.updated_at))
    .limit(limit)
    .offset(offset)
    .all();
}

function createProcess(data) {
  return db.insert(process_info).values(data).run();
}

function updateProcess(id, data) {
  const updatePayload = {};

  PROCESS_FIELDS.forEach((field) => {
    if (data[field] !== undefined) {
      updatePayload[field] = data[field];
    }
  });

  if (Object.keys(updatePayload).length === 0) {
    return null;
  }

  updatePayload.updated_at = data.updated_at;

  return db.update(process_info).set(updatePayload).where(eq(process_info.id, id)).run();
}

function deleteProcesses(ids) {
  return db.delete(process_info).where(inArray(process_info.id, ids)).run();
}

module.exports = {
  countProcesses,
  listProcesses,
  createProcess,
  updateProcess,
  deleteProcesses
};
