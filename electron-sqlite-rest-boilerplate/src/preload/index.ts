import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // 打开外部链接
  openExternal: (url: string, usePrivateMode?: boolean): void => {
    ipcRenderer.send('open-external', url, usePrivateMode)
  },

  // 监听关闭确认对话框显示事件
  onShowCloseConfirmDialog: (callback: () => void): (() => void) => {
    const handler = (): void => {
      callback()
    }
    ipcRenderer.on('show-close-confirm-dialog', handler)
    return () => {
      ipcRenderer.removeListener('show-close-confirm-dialog', handler)
    }
  },

  // 发送关闭确认对话框响应
  sendCloseConfirmResponse: (
    action: 'minimize' | 'quit' | 'cancel',
    rememberChoice: boolean
  ): void => {
    ipcRenderer.send('close-confirm-response', action, rememberChoice)
  },

  // 获取应用版本
  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke('get-app-version')
  },

  // 监听 OAuth 回调
  onAuthCallback: (callback: (data: { code: string; state: string }) => void): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { code: string; state: string }
    ): void => {
      callback(data)
    }
    ipcRenderer.on('auth-callback', handler)
    return () => {
      ipcRenderer.removeListener('auth-callback', handler)
    }
  },

  // 文件操作 - 导出到文件
  exportToFile: (data: string, filename: string): Promise<boolean> => {
    return ipcRenderer.invoke('export-to-file', data, filename)
  },

  // 文件操作 - 从文件导入
  importFromFile: (): Promise<string | null> => {
    return ipcRenderer.invoke('import-from-file')
  },

  // ============ 手动登录 API ============

  // 启动 Builder ID 手动登录
  startBuilderIdLogin: (
    region?: string
  ): Promise<{
    success: boolean
    userCode?: string
    verificationUri?: string
    expiresIn?: number
    interval?: number
    error?: string
  }> => {
    return ipcRenderer.invoke('start-builder-id-login', region || 'us-east-1')
  },

  // 轮询 Builder ID 授权状态
  pollBuilderIdAuth: (
    region?: string
  ): Promise<{
    success: boolean
    completed?: boolean
    status?: string
    accessToken?: string
    refreshToken?: string
    clientId?: string
    clientSecret?: string
    region?: string
    expiresIn?: number
    error?: string
  }> => {
    return ipcRenderer.invoke('poll-builder-id-auth', region || 'us-east-1')
  },

  // 取消 Builder ID 登录
  cancelBuilderIdLogin: (): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('cancel-builder-id-login')
  },

  // 启动 IAM Identity Center SSO 登录 (Authorization Code flow)
  startIamSsoLogin: (
    startUrl: string,
    region?: string
  ): Promise<{
    success: boolean
    authorizeUrl?: string
    expiresIn?: number
    error?: string
  }> => {
    return ipcRenderer.invoke('start-iam-sso-login', startUrl, region || 'us-east-1')
  },

  // 轮询 IAM SSO 授权状态
  pollIamSsoAuth: (
    region?: string
  ): Promise<{
    success: boolean
    completed?: boolean
    status?: string
    accessToken?: string
    refreshToken?: string
    clientId?: string
    clientSecret?: string
    region?: string
    expiresIn?: number
    error?: string
  }> => {
    return ipcRenderer.invoke('poll-iam-sso-auth', region || 'us-east-1')
  },

  // 完成 IAM SSO 登录 (用授权码换取 token)
  completeIamSsoLogin: (
    code: string
  ): Promise<{
    success: boolean
    completed?: boolean
    accessToken?: string
    refreshToken?: string
    clientId?: string
    clientSecret?: string
    region?: string
    expiresIn?: number
    error?: string
  }> => {
    return ipcRenderer.invoke('complete-iam-sso-login', code)
  },

  // 取消 IAM SSO 登录
  cancelIamSsoLogin: (): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('cancel-iam-sso-login')
  },

  // 启动 Social Auth 登录 (Google/GitHub)
  startSocialLogin: (
    provider: 'Google' | 'Github',
    usePrivateMode?: boolean
  ): Promise<{
    success: boolean
    loginUrl?: string
    state?: string
    error?: string
  }> => {
    return ipcRenderer.invoke('start-social-login', provider, usePrivateMode)
  },

  // 交换 Social Auth token
  exchangeSocialToken: (
    code: string,
    state: string
  ): Promise<{
    success: boolean
    accessToken?: string
    refreshToken?: string
    profileArn?: string
    expiresIn?: number
    authMethod?: string
    provider?: string
    error?: string
  }> => {
    return ipcRenderer.invoke('exchange-social-token', code, state)
  },

  // 取消 Social Auth 登录
  cancelSocialLogin: (): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('cancel-social-login')
  },

  // 监听 Social Auth 回调
  onSocialAuthCallback: (
    callback: (data: { code?: string; state?: string; error?: string }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { code?: string; state?: string; error?: string }
    ): void => {
      callback(data)
    }
    ipcRenderer.on('social-auth-callback', handler)
    return () => {
      ipcRenderer.removeListener('social-auth-callback', handler)
    }
  },

  // 代理设置
  // ============ 机器码管理 API ============

  // 获取操作系统类型
  machineIdGetOSType: (): Promise<'windows' | 'macos' | 'linux' | 'unknown'> => {
    return ipcRenderer.invoke('machine-id:get-os-type')
  },

  // 获取当前机器码
  machineIdGetCurrent: (): Promise<{
    success: boolean
    machineId?: string
    error?: string
    requiresAdmin?: boolean
  }> => {
    return ipcRenderer.invoke('machine-id:get-current')
  },

  // 设置新机器码
  machineIdSet: (
    newMachineId: string
  ): Promise<{
    success: boolean
    machineId?: string
    error?: string
    requiresAdmin?: boolean
  }> => {
    return ipcRenderer.invoke('machine-id:set', newMachineId)
  },

  // 生成随机机器码
  machineIdGenerateRandom: (): Promise<string> => {
    return ipcRenderer.invoke('machine-id:generate-random')
  },

  // 检查管理员权限
  machineIdCheckAdmin: (): Promise<boolean> => {
    return ipcRenderer.invoke('machine-id:check-admin')
  },

  // 请求管理员权限重启
  machineIdRequestAdminRestart: (): Promise<boolean> => {
    return ipcRenderer.invoke('machine-id:request-admin-restart')
  },

  // 备份机器码到文件
  machineIdBackupToFile: (machineId: string): Promise<boolean> => {
    return ipcRenderer.invoke('machine-id:backup-to-file', machineId)
  },

  // 从文件恢复机器码
  machineIdRestoreFromFile: (): Promise<{
    success: boolean
    machineId?: string
    error?: string
  }> => {
    return ipcRenderer.invoke('machine-id:restore-from-file')
  },

  // ============ 自动更新 ============

  // 检查更新 (electron-updater)
  checkForUpdates: (): Promise<{
    hasUpdate: boolean
    version?: string
    releaseDate?: string
    message?: string
    error?: string
  }> => {
    return ipcRenderer.invoke('check-for-updates')
  },

  // 手动检查更新 (GitHub API, 用于 AboutPage)
  checkForUpdatesManual: (): Promise<{
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
  }> => {
    return ipcRenderer.invoke('check-for-updates-manual')
  },

  // 下载更新
  downloadUpdate: (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('download-update')
  },

  // 安装更新并重启
  installUpdate: (): Promise<void> => {
    return ipcRenderer.invoke('install-update')
  },

  // 监听更新事件
  onUpdateChecking: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('update-checking', handler)
    return () => ipcRenderer.removeListener('update-checking', handler)
  },

  onUpdateAvailable: (
    callback: (info: { version: string; releaseDate?: string; releaseNotes?: string }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      info: { version: string; releaseDate?: string; releaseNotes?: string }
    ): void => callback(info)
    ipcRenderer.on('update-available', handler)
    return () => ipcRenderer.removeListener('update-available', handler)
  },

  onUpdateNotAvailable: (callback: (info: { version: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: { version: string }): void =>
      callback(info)
    ipcRenderer.on('update-not-available', handler)
    return () => ipcRenderer.removeListener('update-not-available', handler)
  },

  onUpdateDownloadProgress: (
    callback: (progress: {
      percent: number
      bytesPerSecond: number
      transferred: number
      total: number
    }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }
    ): void => callback(progress)
    ipcRenderer.on('update-download-progress', handler)
    return () => ipcRenderer.removeListener('update-download-progress', handler)
  },

  onUpdateDownloaded: (
    callback: (info: { version: string; releaseDate?: string; releaseNotes?: string }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      info: { version: string; releaseDate?: string; releaseNotes?: string }
    ): void => callback(info)
    ipcRenderer.on('update-downloaded', handler)
    return () => ipcRenderer.removeListener('update-downloaded', handler)
  },

  onUpdateError: (callback: (error: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: string): void => callback(error)
    ipcRenderer.on('update-error', handler)
    return () => ipcRenderer.removeListener('update-error', handler)
  },

  // ============ 应用设置管理 API ============

  // 获取应用设置
  getAppSettings: (): Promise<{
    settings?: Record<string, unknown>
    mcpConfig?: { mcpServers: Record<string, unknown> }
    steeringFiles?: string[]
    error?: string
  }> => {
    return ipcRenderer.invoke('get-app-settings')
  },

  // 获取应用可用模型列表
  getAppAvailableModels: (): Promise<{
    models: Array<{ id: string; name: string; description: string }>
    error?: string
  }> => {
    return ipcRenderer.invoke('get-app-available-models')
  },

  // 保存应用设置
  saveAppSettings: (
    settings: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('save-app-settings', settings)
  },

  // 打开应用 MCP 配置文件
  openAppMcpConfig: (type: 'user' | 'workspace'): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('open-app-mcp-config', type)
  },

  // 打开应用 Steering 目录
  openAppSteeringFolder: (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('open-app-steering-folder')
  },

  // 打开应用 settings.json 文件
  openAppSettingsFile: (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('open-app-settings-file')
  },

  // 打开指定的 Steering 文件
  openAppSteeringFile: (filename: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('open-app-steering-file', filename)
  },

  // 创建默认的 rules.md 文件
  createAppDefaultRules: (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('create-app-default-rules')
  },

  // 读取 Steering 文件内容
  readAppSteeringFile: (
    filename: string
  ): Promise<{ success: boolean; content?: string; error?: string }> => {
    return ipcRenderer.invoke('read-app-steering-file', filename)
  },

  // 保存 Steering 文件内容
  saveAppSteeringFile: (
    filename: string,
    content: string
  ): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('save-app-steering-file', filename, content)
  },

  // 删除 Steering 文件
  deleteAppSteeringFile: (filename: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('delete-app-steering-file', filename)
  },

  // ============ MCP 服务器管理 ============

  // 保存 MCP 服务器配置
  saveMcpServer: (
    name: string,
    config: { command: string; args?: string[]; env?: Record<string, string> },
    oldName?: string
  ): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('save-mcp-server', name, config, oldName)
  },

  // 删除 MCP 服务器
  deleteMcpServer: (name: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('delete-mcp-server', name)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
