const { asc, desc, sql, gte } = require('drizzle-orm');
const { db, schema } = require('../../database/database');

const { process_info, settings, system_stats } = schema;

const CHART_FIELD_MAP = {
  recorded_at: system_stats.recorded_at,
  cpu_usage: system_stats.cpu_usage,
  memory_usage: system_stats.memory_usage,
  memory_used: system_stats.memory_used,
  memory_total: system_stats.memory_total,
  disk_usage: system_stats.disk_usage,
  disk_used: system_stats.disk_used,
  disk_total: system_stats.disk_total,
  network_rx: system_stats.network_rx,
  network_tx: system_stats.network_tx
};

function getLatestSystemStats() {
  return db.select().from(system_stats).orderBy(desc(system_stats.recorded_at)).limit(1).get();
}

function getProcessSummary() {
  return db
    .select({
      total_processes: sql`count(*)`,
      running_processes: sql`sum(case when ${process_info.status} = 'running' then 1 else 0 end)`,
      stopped_processes: sql`sum(case when ${process_info.status} = 'stopped' then 1 else 0 end)`
    })
    .from(process_info)
    .get();
}

function getSettingsMap() {
  const list = db
    .select({
      key: settings.key,
      value: settings.value
    })
    .from(settings)
    .all();

  return list.reduce((result, item) => {
    result[item.key] = item.value;
    return result;
  }, {});
}

function getChartData(selectedFields, since) {
  const selectedColumns = selectedFields.reduce((result, field) => {
    if (CHART_FIELD_MAP[field]) {
      result[field] = CHART_FIELD_MAP[field];
    }
    return result;
  }, {});

  return db
    .select(selectedColumns)
    .from(system_stats)
    .where(gte(system_stats.recorded_at, since))
    .orderBy(asc(system_stats.recorded_at))
    .all();
}

module.exports = {
  getLatestSystemStats,
  getProcessSummary,
  getSettingsMap,
  getChartData
};
