import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Save, Settings, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/hooks/useTranslation'
import { templateApi, type SettingRecord } from '@/services/rest-api'

const emptyForm = {
  key: 'api_port',
  value: '9200',
  description: 'REST API 端口'
}

export function SettingsPage() {
  const { t } = useTranslation()
  const isEn = t('common.unknown') === 'Unknown'
  const [records, setRecords] = useState<SettingRecord[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const settingsMap = useMemo(() => {
    return records.reduce<Record<string, string>>((accumulator, record) => {
      accumulator[record.key] = record.value
      return accumulator
    }, {})
  }, [records])

  const loadSettings = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await templateApi.querySettings()
      setRecords(response.list)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSettings()
  }, [])

  const resetForm = () => {
    setEditingKey(null)
    setForm(emptyForm)
  }

  const handleEdit = (record: SettingRecord) => {
    setEditingKey(record.key)
    setForm({ key: record.key, value: record.value, description: record.description || '' })
  }

  const handleCreate = async () => {
    setSubmitting(true)
    setError('')

    try {
      await templateApi.createSetting(form)
      resetForm()
      await loadSettings()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    setSubmitting(true)
    setError('')

    try {
      await templateApi.updateSetting(form)
      resetForm()
      await loadSettings()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (key: string) => {
    try {
      await templateApi.deleteSettings([key])
      if (editingKey === key) {
        resetForm()
      }
      await loadSettings()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError))
    }
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">{isEn ? 'Settings' : '设置管理'}</h1>
            <p className="text-sm text-muted-foreground">
              {isEn
                ? 'The template now shows setting query, create, update and delete.'
                : '模板现在直接展示设置的查询、创建、更新和删除。'}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadSettings()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {isEn ? 'Refresh' : '刷新'}
        </Button>
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{isEn ? 'Create or Update Setting' : '创建或更新设置'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label={isEn ? 'Key' : '键名'} value={form.key} onChange={(value) => setForm({ ...form, key: value })} disabled={!!editingKey} />
            <Field label={isEn ? 'Value' : '值'} value={form.value} onChange={(value) => setForm({ ...form, value: value })} />
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">{isEn ? 'Description' : '描述'}</span>
              <textarea
                className="min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void (editingKey ? handleUpdate() : handleCreate())} disabled={submitting}>
                <Save className="h-4 w-4" />
                {editingKey ? (isEn ? 'Update' : '更新') : isEn ? 'Create' : '创建'}
              </Button>
              <Button variant="ghost" onClick={resetForm}>
                {isEn ? 'Reset' : '重置'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? 'Current Settings' : '当前设置'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(settingsMap).map(([key, value]) => (
                <Badge key={key} variant="secondary">
                  {key}: {value}
                </Badge>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">{isEn ? 'Key' : '键名'}</th>
                    <th className="py-2 pr-3">{isEn ? 'Value' : '值'}</th>
                    <th className="py-2 pr-3">{isEn ? 'Description' : '描述'}</th>
                    <th className="py-2 text-right">{isEn ? 'Actions' : '操作'}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.key} className="border-b last:border-0">
                      <td className="py-3 pr-3 font-medium">{record.key}</td>
                      <td className="py-3 pr-3">{record.value}</td>
                      <td className="py-3 pr-3 text-muted-foreground">{record.description || '--'}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(record)}>
                            {isEn ? 'Edit' : '编辑'}
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => void handleDelete(record.key)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {records.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {isEn ? 'No settings stored yet' : '还没有设置记录'}
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
  onChange,
  disabled = false
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
    </label>
  )
}
