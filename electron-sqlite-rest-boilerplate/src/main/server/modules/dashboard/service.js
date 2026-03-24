const repository = require('./repository');

function getDashboardData() {
  const latestStats = repository.getLatestSystemStats();
  const processStats = repository.getProcessSummary();
  const settings = repository.getSettingsMap();

  return {
    system: {
      cpu: { usage: latestStats?.cpu_usage || 0 },
      memory: {
        usage: latestStats?.memory_usage || 0,
        total: latestStats?.memory_total || 0,
        used: latestStats?.memory_used || 0
      },
      disk: {
        usage: latestStats?.disk_usage || 0,
        total: latestStats?.disk_total || 0,
        used: latestStats?.disk_used || 0
      },
      network: { rx: latestStats?.network_rx || 0, tx: latestStats?.network_tx || 0 }
    },
    process: {
      total: processStats?.total_processes || 0,
      running: processStats?.running_processes || 0,
      stopped: processStats?.stopped_processes || 0
    },
    settings,
    last_updated: latestStats?.recorded_at || null
  };
}

function getDashboardChart(query) {
  const metric = query.metric || 'all';
  const timeRange = Number.parseInt(query.time_range, 10) || 60;
  const since = Math.floor(Date.now() / 1000) - timeRange * 60;

  let fields = [];
  switch (metric) {
    case 'cpu':
      fields = ['recorded_at', 'cpu_usage'];
      break;
    case 'memory':
      fields = ['recorded_at', 'memory_usage', 'memory_used', 'memory_total'];
      break;
    case 'disk':
      fields = ['recorded_at', 'disk_usage', 'disk_used', 'disk_total'];
      break;
    case 'network':
      fields = ['recorded_at', 'network_rx', 'network_tx'];
      break;
    default:
      fields = ['recorded_at', 'cpu_usage', 'memory_usage', 'disk_usage'];
  }

  const list = repository.getChartData(fields, since);

  return {
    metric,
    time_range: timeRange,
    list,
    pagination: { current_page: 1, page_size: list.length, total: list.length }
  };
}

module.exports = {
  getDashboardData,
  getDashboardChart
};
