import { useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle,
  Download,
  ExternalLink,
  Info,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  Workflow
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import appLogo from '@/assets/app-logo.png'
import { useTranslation } from '@/hooks/useTranslation'
import {
  getAbout,
  getEmbeddedApiStatus,
  updateAbout,
  type AboutRecord,
  type EmbeddedApiInfo
} from '@/services/rest-api'

interface UpdateInfo {
  hasUpdate: boolean
  currentVersion?: string
  latestVersion?: string
  releaseNotes?: string
  releaseName?: string
  releaseUrl?: string
  publishedAt?: string
  assets?: Array<{
    name: string
    downloadUrl: string
    size: number
  }>
  error?: string
}

const defaultAboutForm: AboutRecord = {
  app_name: '',
  version: '',
  description: '',
  author: '',
  license: ''
}

export function AboutPage() {
  const { t } = useTranslation()
  const isEn = t('common.unknown') === 'Unknown'
  const [version, setVersion] = useState('...')
  const [apiInfo, setApiInfo] = useState<EmbeddedApiInfo | null>(null)
  const [aboutForm, setAboutForm] = useState<AboutRecord>(defaultAboutForm)
  const [aboutError, setAboutError] = useState('')
  const [savingAbout, setSavingAbout] = useState(false)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)

  const refreshPage = async () => {
    const [embeddedApi, about] = await Promise.all([getEmbeddedApiStatus(), getAbout()])
    setApiInfo(embeddedApi)
    setAboutForm(about)
    setAboutError('')
  }

  useEffect(() => {
    window.api.getAppVersion().then(setVersion)
    refreshPage().catch((error) => {
      setAboutError(error instanceof Error ? error.message : '加载模板信息失败')
    })
  }, [])

  const checkForUpdates = async () => {
    setIsCheckingUpdate(true)
    try {
      const result = await window.api.checkForUpdatesManual()
      setUpdateInfo(result)
      setShowUpdateModal(true)
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  const saveAboutInfo = async () => {
    setSavingAbout(true)
    try {
      await updateAbout(aboutForm)
      await refreshPage()
    } catch (error) {
      setAboutError(error instanceof Error ? error.message : '保存模板信息失败')
    } finally {
      setSavingAbout(false)
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-primary/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src={appLogo} alt="App" className="h-14 w-14 rounded-xl border bg-background p-2" />
            <div>
              <h1 className="text-2xl font-bold">
                {isEn ? 'Template Overview' : '模板总览'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isEn
                  ? 'This page keeps the template metadata, updater, and packaging status in one place.'
                  : '这个页面集中展示模板元信息、更新能力和打包后的内置 API 状态。'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={apiInfo?.running ? 'success' : 'outline'}>
              {apiInfo?.running ? 'REST API Online' : 'REST API Offline'}
            </Badge>
            <Badge variant="secondary">
              {isEn ? `App ${version}` : `应用版本 ${version}`}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => void refreshPage()}>
              <RefreshCw className="h-4 w-4" />
              {isEn ? 'Refresh Data' : '刷新数据'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void checkForUpdates()} disabled={isCheckingUpdate}>
              <Download className={`h-4 w-4 ${isCheckingUpdate ? 'animate-pulse' : ''}`} />
              {isEn ? 'Check Updates' : '检查更新'}
            </Button>
          </div>
        </div>
      </div>

      {aboutError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {aboutError}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              {isEn ? 'Embedded API Runtime' : '内置 API 运行时'}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <InfoRow label={isEn ? 'Base URL' : '服务地址'} value={apiInfo?.baseUrl || '--'} />
            <InfoRow label={isEn ? 'Host / Port' : '主机 / 端口'} value={apiInfo ? `${apiInfo.host}:${apiInfo.port}` : '--'} />
            <InfoRow label={isEn ? 'Server Entry' : '服务入口'} value={apiInfo?.serverEntry || '--'} />
            <InfoRow label={isEn ? 'Database Path' : '数据库路径'} value={apiInfo?.databasePath || '--'} />
            <InfoRow label={isEn ? 'Log Directory' : '日志目录'} value={apiInfo?.logDir || '--'} />
            <InfoRow label={isEn ? 'Started At' : '启动时间'} value={apiInfo?.startedAt || '--'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5" />
              {isEn ? 'Template Coverage' : '模板场景覆盖'}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <ScenarioCard
              icon={Server}
              title={isEn ? 'Dashboard API' : 'Dashboard API'}
              description={
                isEn ? '/api/health, /api/dashboard, /api/system' : '/api/health、/api/dashboard、/api/system'
              }
            />
            <ScenarioCard
              icon={Workflow}
              title={isEn ? 'CRUD Demo' : 'CRUD 示例'}
              description={isEn ? '/api/process CRUD page is already bound' : '/api/process 的 CRUD 页面已经接好'}
            />
            <ScenarioCard
              icon={ShieldCheck}
              title={isEn ? 'Auth Demo' : '认证示例'}
              description={
                isEn ? 'Register, login, refresh, me, and one protected endpoint' : '注册、登录、刷新、当前用户和一个受限接口'
              }
            />
            <ScenarioCard
              icon={Info}
              title={isEn ? 'About API' : 'About API'}
              description={isEn ? '/api/about query + update' : '/api/about 查询与更新'}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            {isEn ? 'About API Demo' : '关于接口演示'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <InputField
              label={isEn ? 'App Name' : '应用名称'}
              value={aboutForm.app_name}
              onChange={(value) => setAboutForm((current) => ({ ...current, app_name: value }))}
            />
            <InputField
              label={isEn ? 'Template Version' : '模板版本'}
              value={aboutForm.version}
              onChange={(value) => setAboutForm((current) => ({ ...current, version: value }))}
            />
            <InputField
              label={isEn ? 'Author' : '作者'}
              value={aboutForm.author}
              onChange={(value) => setAboutForm((current) => ({ ...current, author: value }))}
            />
            <InputField
              label={isEn ? 'License' : '许可证'}
              value={aboutForm.license}
              onChange={(value) => setAboutForm((current) => ({ ...current, license: value }))}
            />
          </div>

          <label className="space-y-2">
            <div className="text-sm font-medium">{isEn ? 'Description' : '说明'}</div>
            <textarea
              className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
              value={aboutForm.description}
              onChange={(event) =>
                setAboutForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </label>

          <div className="flex justify-end">
            <Button className="gap-2" onClick={saveAboutInfo} disabled={savingAbout || !apiInfo?.running}>
              <Save className="h-4 w-4" />
              {savingAbout
                ? isEn
                  ? 'Saving...'
                  : '保存中...'
                : isEn
                  ? 'Save to /api/about/update'
                  : '保存到 /api/about/update'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {showUpdateModal && updateInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowUpdateModal(false)} />
          <div className="relative z-10 mx-4 w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            {updateInfo.hasUpdate ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-green-500/10 p-2">
                    <Download className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      {isEn ? 'Update Available' : '发现新版本'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {updateInfo.currentVersion} → {updateInfo.latestVersion}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                  {updateInfo.releaseNotes || (isEn ? 'No release notes' : '暂无更新说明')}
                </div>
                <Button
                  className="w-full gap-2"
                  onClick={() => updateInfo.releaseUrl && window.api.openExternal(updateInfo.releaseUrl)}
                  disabled={!updateInfo.releaseUrl}
                >
                  <ExternalLink className="h-4 w-4" />
                  {isEn ? 'Open Release Page' : '打开发布页'}
                </Button>
              </div>
            ) : updateInfo.error ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-red-500/10 p-2">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      {isEn ? 'Update Check Failed' : '检查更新失败'}
                    </h3>
                    <p className="text-sm text-muted-foreground">{updateInfo.error}</p>
                  </div>
                </div>
                <Button variant="outline" className="w-full" onClick={() => void checkForUpdates()}>
                  {isEn ? 'Retry' : '重试'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-green-500/10 p-2">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      {isEn ? 'Already Up To Date' : '当前已是最新版本'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {isEn
                        ? `Current version ${updateInfo.currentVersion}`
                        : `当前版本 ${updateInfo.currentVersion}`}
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="w-full" onClick={() => setShowUpdateModal(false)}>
                  {isEn ? 'Close' : '关闭'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ScenarioCard({
  icon: Icon,
  title,
  description
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="mb-2 flex items-center gap-2 font-medium">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="text-muted-foreground">{description}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 break-all text-sm font-medium">{value}</div>
    </div>
  )
}

function InputField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-2">
      <div className="text-sm font-medium">{label}</div>
      <input
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
