import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Github,
  Heart,
  Code,
  ExternalLink,
  User,
  Coffee,
  MessageCircle,
  X,
  RefreshCw,
  Download,
  CheckCircle,
  AlertCircle,
  Info,
  Zap,
  Save,
  Server
} from 'lucide-react'
import appLogo from '@/assets/app-logo.png'
import groupQR from '@/assets/lark-group-qr.jpg'
import authorAvatar from '@/assets/author-avatar.png'
import { cn } from '@/lib/utils'
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

export function AboutPage() {
  const [version, setVersion] = useState('...')
  const [aboutForm, setAboutForm] = useState<AboutRecord>({
    app_name: '',
    version: '',
    description: '',
    author: '',
    license: ''
  })
  const [apiInfo, setApiInfo] = useState<EmbeddedApiInfo | null>(null)
  const [aboutError, setAboutError] = useState<string | null>(null)
  const [savingAbout, setSavingAbout] = useState(false)
  const [showGroupQR, setShowGroupQR] = useState(false)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [darkMode] = useState(false)
  const { t } = useTranslation()
  const isEn = t('common.unknown') === 'Unknown'

  useEffect(() => {
    window.api.getAppVersion().then(setVersion)
    getEmbeddedApiStatus()
      .then(setApiInfo)
      .catch(() => null)
    getAbout()
      .then(setAboutForm)
      .catch((error) => {
        setAboutError(error instanceof Error ? error.message : '加载关于信息失败')
      })
    // 不自动检查更新，避免 GitHub API 速率限制
    // 用户可以手动点击"检查更新"按钮
  }, [])

  const checkForUpdates = async (showModal = true) => {
    setIsCheckingUpdate(true)
    try {
      const result = await window.api.checkForUpdatesManual()
      setUpdateInfo(result)
      if (showModal || result.hasUpdate) {
        setShowUpdateModal(true)
      }
    } catch (error) {
      console.error('Check update failed:', error)
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  const openReleasePage = () => {
    if (updateInfo?.releaseUrl) {
      window.api.openExternal(updateInfo.releaseUrl)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const saveAboutInfo = async () => {
    setSavingAbout(true)
    try {
      await updateAbout(aboutForm)
      const latest = await getAbout()
      setAboutForm(latest)
      setAboutError(null)
    } catch (error) {
      setAboutError(error instanceof Error ? error.message : '保存关于信息失败')
    } finally {
      setSavingAbout(false)
    }
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 p-8 border border-primary/20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-primary/20 to-transparent rounded-full blur-2xl" />
        <div className="relative text-center space-y-4">
          <img
            src={appLogo}
            alt="App"
            className={cn('h-20 w-auto mx-auto transition-all', darkMode && 'invert brightness-0')}
          />
          <div>
            <h1 className="text-2xl font-bold text-primary">
              {isEn ? 'Electron Sqlite Rest Boilerplate' : 'Electron Sqlite Rest 样板'}
            </h1>
            <p className="text-muted-foreground">
              {isEn ? `Version ${version}` : `版本 ${version}`}
            </p>
          </div>
          <div className="flex gap-2 justify-center flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => checkForUpdates(true)}
              disabled={isCheckingUpdate}
            >
              <RefreshCw className={cn('h-4 w-4', isCheckingUpdate && 'animate-spin')} />
              {isCheckingUpdate
                ? isEn
                  ? 'Checking...'
                  : '检查中...'
                : isEn
                  ? 'Check Updates'
                  : '检查更新'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowGroupQR(true)}
              style={{ display: 'none' }}
            >
              <MessageCircle className="h-4 w-4" />
              {isEn ? 'Join Group' : '加入交流群'}
            </Button>
          </div>

          {/* 更新提示 */}
          {updateInfo?.hasUpdate && !showUpdateModal && (
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm cursor-pointer hover:bg-primary/20"
              onClick={() => setShowUpdateModal(true)}
            >
              <Download className="h-4 w-4" />
              {isEn
                ? `New version v${updateInfo.latestVersion}`
                : `发现新版本 v${updateInfo.latestVersion}`}
            </div>
          )}
        </div>
      </div>

      {/* 更新弹窗 */}
      {showUpdateModal && updateInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowUpdateModal(false)} />
          <div className="relative bg-card rounded-xl p-6 shadow-xl z-10 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <button
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
              onClick={() => setShowUpdateModal(false)}
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-4">
              {updateInfo.hasUpdate ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-green-500/10">
                      <Download className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">
                        {isEn ? 'New Version Available' : '发现新版本'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {updateInfo.currentVersion} → {updateInfo.latestVersion}
                      </p>
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm font-medium mb-2">{updateInfo.releaseName}</p>
                    {updateInfo.publishedAt && (
                      <p className="text-xs text-muted-foreground">
                        {isEn
                          ? `Released: ${new Date(updateInfo.publishedAt).toLocaleDateString('en-US')}`
                          : `发布时间: ${new Date(updateInfo.publishedAt).toLocaleDateString('zh-CN')}`}
                      </p>
                    )}
                  </div>

                  {updateInfo.releaseNotes && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{isEn ? 'Release Notes:' : '更新内容:'}</p>
                      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {updateInfo.releaseNotes}
                      </div>
                    </div>
                  )}

                  {updateInfo.assets && updateInfo.assets.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        {isEn ? 'Download Files:' : '下载文件:'}
                      </p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {updateInfo.assets.slice(0, 6).map((asset, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1"
                          >
                            <span className="truncate flex-1">{asset.name}</span>
                            <span className="text-muted-foreground ml-2">
                              {formatFileSize(asset.size)}
                            </span>
                          </div>
                        ))}
                        {updateInfo.assets.length > 6 && (
                          <p className="text-xs text-muted-foreground text-center">
                            {isEn
                              ? `${updateInfo.assets.length - 6} more files...`
                              : `还有 ${updateInfo.assets.length - 6} 个文件...`}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <Button className="w-full gap-2" onClick={openReleasePage}>
                    <ExternalLink className="h-4 w-4" />
                    {isEn ? 'Go to Download Page' : '前往下载页面'}
                  </Button>
                </>
              ) : updateInfo.error ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-red-500/10">
                      <AlertCircle className="h-6 w-6 text-red-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">
                        {isEn ? 'Check Failed' : '检查更新失败'}
                      </h3>
                      <p className="text-sm text-muted-foreground">{updateInfo.error}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => checkForUpdates(true)}
                  >
                    {isEn ? 'Retry' : '重试'}
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-green-500/10">
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">
                        {isEn ? 'Up to Date' : '已是最新版本'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {isEn
                          ? `Version v${updateInfo.currentVersion} is the latest`
                          : `当前版本 v${updateInfo.currentVersion} 已经是最新的了`}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 交流群弹窗 */}
      {showGroupQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowGroupQR(false)} />
          <div className="relative bg-card rounded-xl p-6 shadow-xl z-10">
            <button
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
              onClick={() => setShowGroupQR(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="text-center space-y-3" style={{ display: 'none' }}>
              <h3 className="font-semibold text-lg">{isEn ? 'Join Group' : '扫码加入交流群'}</h3>
              <div className="bg-[#07C160]/5 rounded-xl p-3 border border-[#07C160]/20">
                {/* 邀请链接：https://applink.larksuite.com/client/chat/chatter/add_by_link?link_token=bdcq62ef-27ba-4229-b4c7-8cbb96ngv38v */}
                <img src={groupQR} alt="Group" className="w-48 h-48 object-contain" />
              </div>
              <p className="text-sm text-muted-foreground">
                {isEn ? 'Scan with Lark' : 'Lark 扫码加入'}
              </p>
            </div>
          </div>
        </div>
      )}

      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Server className="h-4 w-4 text-primary" />
            </div>
            {isEn ? 'About API Demo' : '关于接口演示'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {isEn ? 'REST API status' : 'REST API 状态'}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
                apiInfo?.running
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {apiInfo?.running ? 'Online' : 'Offline'}
            </span>
            <span className="text-muted-foreground">
              {apiInfo ? `${apiInfo.baseUrl}/api` : '--'}
            </span>
          </div>

          {aboutError && <div className="text-sm text-destructive">{aboutError}</div>}

          <div className="grid gap-3 lg:grid-cols-2">
            <InputField
              label={isEn ? 'App name' : '应用名称'}
              value={aboutForm.app_name}
              onChange={(value) => setAboutForm((current) => ({ ...current, app_name: value }))}
            />
            <InputField
              label={isEn ? 'Template version' : '模板版本'}
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

          <div className="space-y-2">
            <div className="text-sm font-medium">{isEn ? 'Description' : '说明'}</div>
            <textarea
              className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
              value={aboutForm.description}
              onChange={(event) =>
                setAboutForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </div>

          <div className="flex justify-end">
            <Button
              className="gap-2"
              onClick={saveAboutInfo}
              disabled={savingAbout || !apiInfo?.running}
            >
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

      {/* Description */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Info className="h-4 w-4 text-primary" />
            </div>
            {isEn ? 'About' : '关于本应用'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <p>
            {isEn
              ? 'Electron SQLite REST Boilerplate is a desktop application template based on Electron + SQLite + REST API. It provides out-of-the-box project structure and development experience.'
              : 'Electron SQLite REST 模板项目是一个基于 Electron + SQLite + REST API 的桌面应用模板。提供开箱即用的项目结构和开发体验。'}
          </p>
          <p>
            {isEn
              ? 'Built with Electron + React + TypeScript, supporting Windows, macOS and Linux. All data is stored locally to protect your privacy.'
              : '本应用使用 Electron + React + TypeScript 开发，支持 Windows、macOS 和 Linux 平台。所有数据均存储在本地，保护你的隐私安全。'}
          </p>
        </CardContent>
      </Card>

      {/* Features */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            {isEn ? 'Features' : '主要功能'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>{isEn ? 'Quick Start' : '快速启动'}</strong>
              {isEn ? ': Out-of-the-box project structure' : '：开箱即用的项目结构'}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>{isEn ? 'REST API' : 'REST 接口'}</strong>
              {isEn ? ': Built-in API server' : '：内置 REST API 服务'}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>{isEn ? 'SQLite Database' : 'SQLite 数据库'}</strong>
              {isEn ? ': Local data persistence' : '：本地数据持久化'}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>{isEn ? 'Cross Platform' : '跨平台'}</strong>
              {isEn ? ': Windows, macOS, Linux' : '：支持 Windows、macOS、Linux'}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>{isEn ? 'TypeScript' : 'TypeScript'}</strong>
              {isEn ? ': Full type support' : '：完整类型支持'}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>{isEn ? 'Electron' : 'Electron'}</strong>
              {isEn ? ': Desktop app framework' : '：桌面应用框架'}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>{isEn ? 'React' : 'React'}</strong>
              {isEn ? ': Modern UI framework' : '：现代 UI 框架'}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>{isEn ? 'Vite' : 'Vite'}</strong>
              {isEn ? ': Fast build tool' : '：快速构建工具'}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>{isEn ? 'Tailwind CSS' : 'Tailwind CSS'}</strong>
              {isEn ? ': Utility-first styling' : '：实用优先的样式方案'}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>{isEn ? 'Themes' : '主题定制'}</strong>
              {isEn ? ': 21 colors, dark/light mode' : '：21 种主题颜色，深色/浅色模式'}
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Tech Stack */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Code className="h-4 w-4 text-primary" />
            </div>
            {isEn ? 'Tech Stack' : '技术栈'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['Electron', 'React', 'TypeScript', 'Tailwind CSS', 'Zustand', 'Vite'].map((tech) => (
              <span
                key={tech}
                className="px-2.5 py-1 text-xs bg-muted rounded-full text-muted-foreground"
              >
                {tech}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Author */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            {isEn ? 'Author' : '作者'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={authorAvatar} alt="gpboyer2" className="w-10 h-10 rounded-full" />
              <p className="font-medium">gpboyer2</p>
            </div>
            <a
              href="https://github.com/gpboyer2/electron-sqlite-rest-boilerplate"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
            >
              <Github className="h-4 w-4" />
              GitHub
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Sponsor */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Coffee className="h-4 w-4 text-primary" />
            </div>
            {isEn ? 'Sponsor' : '赞助支持'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {isEn
              ? 'If this project helps you, buy me a coffee ☕'
              : '如果这个项目对你有帮助，可以请作者喝杯咖啡 ☕'}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center space-y-2">
              <div className="bg-[#1677FF]/5 rounded-xl p-3 border border-[#1677FF]/20">
                <img alt="Alipay" className="w-full aspect-square object-contain rounded-lg" />
              </div>
              <p className="text-sm font-medium text-[#1677FF]">{isEn ? 'Alipay' : '支付宝'}</p>
            </div>
            <div className="text-center space-y-2">
              <div className="bg-[#07C160]/5 rounded-xl p-3 border border-[#07C160]/20">
                <img alt="WeChat Pay" className="w-full aspect-square object-contain rounded-lg" />
              </div>
              <p className="text-sm font-medium text-[#07C160]">
                {isEn ? 'WeChat Pay' : '微信支付'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground py-4">
        <p className="flex items-center justify-center gap-1">
          Made with <Heart className="h-3 w-3 text-primary" /> for developers
        </p>
      </div>
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
