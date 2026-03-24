import { useEffect, useMemo, useState } from 'react'
import { Activity, RefreshCw, Save, Search, Trash2, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/hooks/useTranslation'
import { templateApi, type ProcessRecord } from '@/services/rest-api'

const emptyForm = {
  pid: '2001',
  name: 'worker-main',
  status: 'running',
  cpu_usage: '12.6',
  memory_usage: '18.3',
  memory_bytes: '268435456',
  started_at: new Date().toISOString(),
  command: 'node worker.js'
}

function toNumber(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatEpoch(value?: number | null): string {
  if (!value) {
    return '--'
  }

  return new Date(value * 1000).toLocaleString()
}

export function ProcessesPage() {
  const { t } = useTranslation()
  const isEn = t('common.unknown') === 'Unknown'
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [records, setRecords] = useState<ProcessRecord[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadProcesses = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await templateApi.queryProcesses(statusFilter || undefined, 1, 50)
      setRecords(response.list)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProcesses()
  }, [statusFilter])

  const filteredRecords = useMemo(() => {
    const searchValue = search.trim().toLowerCase()
    if (!searchValue) {
      return records
    }

    return records.filter((record) => {
      return (
        record.name.toLowerCase().includes(searchValue) ||
        String(record.pid).includes(searchValue) ||
        (record.command || '').toLowerCase().includes(searchValue)
      )
    })
  }, [records, search])

  const handleGenerateDemo = () => {
    const status = Math.random() > 0.25 ? 'running' : 'stopped'
    const pid = Math.floor(Math.random() * 5000 + 1000)
    setForm({
      pid: `${pid}`,
      name: `worker-${pid}`,
      status,
      cpu_usage: (Math.random() * 50).toFixed(1),
      memory_usage: (Math.random() * 40).toFixed(1),
      memory_bytes: `${Math.round(Math.random() * 1024 * 1024 * 1024)}`,
      started_at: new Date().toISOString(),
      command: status === 'running' ? 'node worker.js --watch' : 'node worker.js --stopped'
    })
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyForm)
  }

  const handleEdit = (record: ProcessRecord) => {
    setEditingId(record.id)
    setForm({
      pid: `${record.pid}`,
      name: record.name,
      status: record.status,
      cpu_usage: `${record.cpu_usage}`,
      memory_usage: `${record.memory_usage}`,
      memory_bytes: `${record.memory_bytes}`,
      started_at: record.started_at || new Date().toISOString(),
      command: record.command || ''
    })
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')

    const payload = {
      pid: toNumber(form.pid),
      name: form.name,
      status: form.status,
      cpu_usage: toNumber(form.cpu_usage),
      memory_usage: toNumber(form.memory_usage),
      memory_bytes: toNumber(form.memory_bytes),
      started_at: form.started_at,
      command: form.command
    }

    try {
      if (editingId) {
        await templateApi.updateProcess({ id: editingId, ...payload })
      } else {
        await templateApi.createProcess(payload)
      }

      resetForm()
      await loadProcesses()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await templateApi.deleteProcesses([id])
      if (editingId === id) {
        resetForm()
      }
      await loadProcesses()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError))
    }
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">{isEn ? 'CRUD Demo' : 'CRUD 示例'}</h1>
            <p className="text-sm text-muted-foreground">
              {isEn
                ? 'This page demonstrates a standard CRUD screen on top of /api/process/*.'
                : '这个页面演示的是一个标准 CRUD 模板页面，底层接口来自 /api/process/*。'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">{isEn ? 'All Status' : '全部状态'}</option>
            <option value="running">running</option>
            <option value="stopped">stopped</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadProcesses()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {isEn ? 'Refresh' : '刷新'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[0.95fr,1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>{isEn ? 'Create or Update Record' : '创建或更新记录'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="PID"
                value={form.pid}
                onChange={(value) => setForm({ ...form, pid: value })}
              />
              <Field
                label={isEn ? 'Name' : '进程名称'}
                value={form.name}
                onChange={(value) => setForm({ ...form, name: value })}
              />
              <label className="space-y-2 text-sm">
                <span className="text-muted-foreground">Status</span>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                >
                  <option value="running">running</option>
                  <option value="stopped">stopped</option>
                </select>
              </label>
              <Field
                label="CPU %"
                value={form.cpu_usage}
                onChange={(value) => setForm({ ...form, cpu_usage: value })}
              />
              <Field
                label={isEn ? 'Memory %' : '内存 %'}
                value={form.memory_usage}
                onChange={(value) => setForm({ ...form, memory_usage: value })}
              />
              <Field
                label={isEn ? 'Memory Bytes' : '内存字节数'}
                value={form.memory_bytes}
                onChange={(value) => setForm({ ...form, memory_bytes: value })}
              />
              <Field
                label={isEn ? 'Started At' : '启动时间'}
                value={form.started_at}
                onChange={(value) => setForm({ ...form, started_at: value })}
              />
              <label className="space-y-2 text-sm sm:col-span-2">
                <span className="text-muted-foreground">Command</span>
                <Input
                  value={form.command}
                  onChange={(event) => setForm({ ...form, command: event.target.value })}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleSubmit()} disabled={submitting}>
                <Save className="h-4 w-4" />
                {editingId ? (isEn ? 'Update' : '更新') : isEn ? 'Create' : '创建'}
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
            <CardTitle>{isEn ? 'Record List' : '记录列表'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={isEn ? 'Search by name, pid or command' : '按名称、PID 或命令搜索'}
                className="pl-9"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">PID</th>
                    <th className="py-2 pr-3">{isEn ? 'Name' : '名称'}</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">CPU</th>
                    <th className="py-2 pr-3">{isEn ? 'Memory' : '内存'}</th>
                    <th className="py-2 pr-3">{isEn ? 'Updated At' : '更新时间'}</th>
                    <th className="py-2 text-right">{isEn ? 'Actions' : '操作'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="border-b last:border-0">
                      <td className="py-3 pr-3 font-medium">{record.pid}</td>
                      <td className="py-3 pr-3">
                        <div className="font-medium">{record.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {record.command || '--'}
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <Badge variant={record.status === 'running' ? 'success' : 'secondary'}>
                          {record.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-3">{record.cpu_usage}%</td>
                      <td className="py-3 pr-3">{record.memory_usage}%</td>
                      <td className="py-3 pr-3">{formatEpoch(record.updated_at)}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(record)}>
                            {isEn ? 'Edit' : '编辑'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => void handleDelete(record.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredRecords.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {isEn ? 'No process records found' : '未找到进程记录'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Field({
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
