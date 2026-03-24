import { useEffect, useState } from 'react'
import {
  Cpu,
  HardDrive,
  MemoryStick,
  RefreshCw,
  Save,
  Server,
  Trash2,
  Wifi,
  WandSparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/hooks/useTranslation'
import {
  templateApi,
  type DashboardChartPoint,
  type DashboardInfo,
  type EmbeddedApiStatus,
  type HealthInfo,
  type SystemStatRecord
} from '@/services/rest-api'

const emptyForm = {
  cpu_usage: '18',
  memory_usage: '42',
  memory_total: '16384',
  memory_used: '6881',
  disk_usage: '53',
  disk_total: '512000',
  disk_used: '271360',
  network_rx: '820',
  network_tx: '460'
}

function toNumber(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatTimestamp(value?: number | null): string {
  if (!value) {
    return '--'
  }

  return new Date(value * 1000).toLocaleString()
}

function chartValue(point: DashboardChartPoint): number {
  return point.cpu_usage ?? 0
}

export function HomePage() {
  const { t } = useTranslation()
  const isEn = t('common.unknown') === 'Unknown'
  const [apiStatus, setApiStatus] = useState<EmbeddedApiStatus | null>(null)
  const [healthInfo, setHealthInfo] = useState<HealthInfo | null>(null)
  const [dashboard, setDashboard] = useState<DashboardInfo | null>(null)
  const [chartPoints, setChartPoints] = useState<DashboardChartPoint[]>([])
  const [systemStats, setSystemStats] = useState<SystemStatRecord[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError('')

    try {
      const [status, health, dashboardData, chart, stats] = await Promise.all([
        templateApi.getEmbeddedApiStatus(),
        templateApi.getHealth(),
        templateApi.getDashboard(),
        templateApi.getDashboardChart('cpu', 60),
        templateApi.querySystemStats(1, 8)
      ])

      setApiStatus(status)
      setHealthInfo(health)
      setDashboard(dashboardData)
      setChartPoints(chart.list.slice(-12))
      setSystemStats(stats.list)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const handleGenerateDemo = () => {
    const cpuUsage = Number((Math.random() * 70 + 10).toFixed(1))
    const memoryUsage = Number((Math.random() * 55 + 20).toFixed(1))
    const diskUsage = Number((Math.random() * 45 + 30).toFixed(1))
    const memoryTotal = 16384
    const diskTotal = 512000

    setForm({
      cpu_usage: `${cpuUsage}`,
      memory_usage: `${memoryUsage}`,
      memory_total: `${memoryTotal}`,
      memory_used: `${Math.round((memoryTotal * memoryUsage) / 100)}`,
      disk_usage: `${diskUsage}`,
      disk_total: `${diskTotal}`,
      disk_used: `${Math.round((diskTotal * diskUsage) / 100)}`,
      network_rx: `${Math.round(Math.random() * 2000)}`,
      network_tx: `${Math.round(Math.random() * 2000)}`
    })
  }

  const handleEdit = (record: SystemStatRecord) => {
    setEditingId(record.id)
    setForm({
      cpu_usage: `${record.cpu_usage}`,
      memory_usage: `${record.memory_usage}`,
      memory_total: `${record.memory_total}`,
      memory_used: `${record.memory_used}`,
      disk_usage: `${record.disk_usage}`,
      disk_total: `${record.disk_total}`,
      disk_used: `${record.disk_used}`,
      network_rx: `${record.network_rx}`,
      network_tx: `${record.network_tx}`
    })
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyForm)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')

    const payload = {
      cpu_usage: toNumber(form.cpu_usage),
      memory_usage: toNumber(form.memory_usage),
      memory_total: toNumber(form.memory_total),
      memory_used: toNumber(form.memory_used),
      disk_usage: toNumber(form.disk_usage),
      disk_total: toNumber(form.disk_total),
      disk_used: toNumber(form.disk_used),
      network_rx: toNumber(form.network_rx),
      network_tx: toNumber(form.network_tx)
    }

    try {
      if (editingId) {
        await templateApi.updateSystemStat({ id: editingId, ...payload })
      } else {
        await templateApi.createSystemStat(payload)
      }

      resetForm()
      await loadData()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    setError('')

    try {
      await templateApi.deleteSystemStats([id])
      if (editingId === id) {
        resetForm()
      }
      await loadData()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError))
    }
  }

  const chartMax = Math.max(...chartPoints.map((point) => chartValue(point)), 1)

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{isEn ? 'System Dashboard' : '系统监控与仪表盘'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEn
              ? 'Health, dashboard, chart and system CRUD are all wired to /api/*.'
              : '健康检查、仪表盘、趋势图和系统统计 CRUD 都已接到 /api/*。'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={apiStatus?.running ? 'success' : 'destructive'}>
            {apiStatus?.running
              ? isEn
                ? 'API Running'
                : 'API 运行中'
              : isEn
                ? 'API Unavailable'
                : 'API 不可用'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {isEn ? 'Refresh' : '刷新'}
          </Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ResourceCard icon={Cpu} title="CPU" value={dashboard?.system.cpu.usage ?? '--'} unit="%" />
        <ResourceCard icon={MemoryStick} title={isEn ? 'Memory' : '内存'} value={dashboard?.system.memory.usage ?? '--'} unit="%" />
        <ResourceCard icon={HardDrive} title={isEn ? 'Disk' : '磁盘'} value={dashboard?.system.disk.usage ?? '--'} unit="%" />
        <ResourceCard icon={Wifi} title={isEn ? 'Network RX' : '网络接收'} value={dashboard?.system.network.rx ?? '--'} unit="KB/s" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              {isEn ? 'Embedded REST API' : '内置 REST API 状态'}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <InfoRow label={isEn ? 'Base URL' : '服务地址'} value={apiStatus?.baseUrl || '--'} />
            <InfoRow label={isEn ? 'Database' : '数据库路径'} value={apiStatus?.databasePath || '--'} />
            <InfoRow label={isEn ? 'Log Directory' : '日志目录'} value={apiStatus?.logDir || '--'} />
            <InfoRow label={isEn ? 'Started At' : '启动时间'} value={apiStatus?.startedAt || '--'} />
            <InfoRow label={isEn ? 'Health' : '健康状态'} value={healthInfo?.status || '--'} />
            <InfoRow label={isEn ? 'DB Connection' : '数据库连接'} value={healthInfo?.database || '--'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? 'CPU Trend (Last 12 points)' : 'CPU 趋势（最近 12 个点）'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-2">
              {chartPoints.map((point) => (
                <div key={point.recorded_at} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t-md bg-primary/80"
                    style={{ height: `${Math.max((chartValue(point) / chartMax) * 100, 8)}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(point.recorded_at * 1000).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              ))}
              {chartPoints.length === 0 && (
                <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                  {isEn ? 'No chart data yet' : '暂无图表数据'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{isEn ? 'Create or Update System Snapshot' : '创建或更新系统快照'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricInput label="CPU %" value={form.cpu_usage} onChange={(value) => setForm({ ...form, cpu_usage: value })} />
              <MetricInput label={isEn ? 'Memory %' : '内存 %'} value={form.memory_usage} onChange={(value) => setForm({ ...form, memory_usage: value })} />
              <MetricInput label={isEn ? 'Memory Total' : '内存总量'} value={form.memory_total} onChange={(value) => setForm({ ...form, memory_total: value })} />
              <MetricInput label={isEn ? 'Memory Used' : '已用内存'} value={form.memory_used} onChange={(value) => setForm({ ...form, memory_used: value })} />
              <MetricInput label={isEn ? 'Disk %' : '磁盘 %'} value={form.disk_usage} onChange={(value) => setForm({ ...form, disk_usage: value })} />
              <MetricInput label={isEn ? 'Disk Total' : '磁盘总量'} value={form.disk_total} onChange={(value) => setForm({ ...form, disk_total: value })} />
              <MetricInput label={isEn ? 'Disk Used' : '已用磁盘'} value={form.disk_used} onChange={(value) => setForm({ ...form, disk_used: value })} />
              <MetricInput label={isEn ? 'Network RX' : '网络接收'} value={form.network_rx} onChange={(value) => setForm({ ...form, network_rx: value })} />
              <MetricInput label={isEn ? 'Network TX' : '网络发送'} value={form.network_tx} onChange={(value) => setForm({ ...form, network_tx: value })} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleSubmit()} disabled={submitting}>
                <Save className="h-4 w-4" />
                {editingId
                  ? isEn
                    ? 'Update Snapshot'
                    : '更新快照'
                  : isEn
                    ? 'Create Snapshot'
                    : '创建快照'}
              </Button>
              <Button variant="outline" onClick={handleGenerateDemo}>
                <WandSparkles className="h-4 w-4" />
                {isEn ? 'Fill Demo Data' : '填充演示数据'}
              </Button>
              <Button variant="ghost" onClick={resetForm}>
                {isEn ? 'Reset' : '重置'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? 'System Snapshot Records' : '系统快照记录'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">ID</th>
                    <th className="py-2 pr-3">CPU</th>
                    <th className="py-2 pr-3">{isEn ? 'Memory' : '内存'}</th>
                    <th className="py-2 pr-3">{isEn ? 'Disk' : '磁盘'}</th>
                    <th className="py-2 pr-3">RX/TX</th>
                    <th className="py-2 pr-3">{isEn ? 'Recorded At' : '记录时间'}</th>
                    <th className="py-2 text-right">{isEn ? 'Actions' : '操作'}</th>
                  </tr>
                </thead>
                <tbody>
                  {systemStats.map((record) => (
                    <tr key={record.id} className="border-b last:border-0">
                      <td className="py-3 pr-3 font-medium">#{record.id}</td>
                      <td className="py-3 pr-3">{record.cpu_usage}%</td>
                      <td className="py-3 pr-3">{record.memory_usage}%</td>
                      <td className="py-3 pr-3">{record.disk_usage}%</td>
                      <td className="py-3 pr-3">{record.network_rx}/{record.network_tx}</td>
                      <td className="py-3 pr-3">{formatTimestamp(record.recorded_at)}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(record)}>
                            {isEn ? 'Edit' : '编辑'}
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => void handleDelete(record.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {systemStats.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {isEn ? 'No system snapshots yet' : '还没有系统快照数据'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ResourceCard({
  icon: Icon,
  title,
  value,
  unit
}: {
  icon: React.ElementType
  title: string
  value: string | number
  unit: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-2 flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{title}</span>
        </div>
        <div className="text-2xl font-bold">
          {value}
          <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function MetricInput({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-lg border bg-muted/20 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="break-all font-medium">{value}</div>
    </div>
  )
}
