import { ElectronAPI } from '@electron-toolkit/preload'

interface AppApi {
  openExternal: (url: string, usePrivateMode?: boolean) => void
  getAppVersion: () => Promise<string>
  onAuthCallback: (callback: (data: { code: string; state: string }) => void) => () => void

  // 文件操作
  exportToFile: (data: string, filename: string) => Promise<boolean>
  importFromFile: () => Promise<{ content: string; format: string } | null>

  // ============ 手动登录 API ============
  startBuilderIdLogin: (region?: string) => Promise<{
    success: boolean
    userCode?: string
    verificationUri?: string
    expiresIn?: number
    interval?: number
    error?: string
  }>
  pollBuilderIdAuth: (region?: string) => Promise<{
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
  }>
  cancelBuilderIdLogin: () => Promise<{ success: boolean }>

  startIamSsoLogin: (
    startUrl: string,
    region?: string
  ) => Promise<{
    success: boolean
    authorizeUrl?: string
    expiresIn?: number
    error?: string
  }>
  pollIamSsoAuth: (region?: string) => Promise<{
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
  }>
  cancelIamSsoLogin: () => Promise<{ success: boolean }>

  startSocialLogin: (
    provider: 'Google' | 'Github',
    usePrivateMode?: boolean
  ) => Promise<{
    success: boolean
    loginUrl?: string
    state?: string
    error?: string
  }>
  exchangeSocialToken: (
    code: string,
    state: string
  ) => Promise<{
    success: boolean
    accessToken?: string
    refreshToken?: string
    profileArn?: string
    expiresIn?: number
    authMethod?: string
    provider?: string
    error?: string
  }>
  cancelSocialLogin: () => Promise<{ success: boolean }>
  onSocialAuthCallback: (
    callback: (data: { code?: string; state?: string; error?: string }) => void
  ) => () => void

  // ============ 机器码管理 API ============
  machineIdGetOSType: () => Promise<'windows' | 'macos' | 'linux' | 'unknown'>
  machineIdGetCurrent: () => Promise<{
    success: boolean
    machineId?: string
    error?: string
    requiresAdmin?: boolean
  }>
  machineIdSet: (newMachineId: string) => Promise<{
    success: boolean
    machineId?: string
    error?: string
    requiresAdmin?: boolean
  }>
  machineIdGenerateRandom: () => Promise<string>
  machineIdCheckAdmin: () => Promise<boolean>
  machineIdRequestAdminRestart: () => Promise<boolean>
  machineIdBackupToFile: (machineId: string) => Promise<boolean>
  machineIdRestoreFromFile: () => Promise<{
    success: boolean
    machineId?: string
    error?: string
  }>

  // ============ 自动更新 API ============
  checkForUpdates: () => Promise<{
    hasUpdate: boolean
    version?: string
    releaseDate?: string
    message?: string
    error?: string
  }>
  checkForUpdatesManual: () => Promise<{
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
  }>
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>
  installUpdate: () => Promise<void>

  onUpdateChecking: (callback: () => void) => () => void
  onUpdateAvailable: (
    callback: (info: { version: string; releaseDate?: string; releaseNotes?: string }) => void
  ) => () => void
  onUpdateNotAvailable: (callback: (info: { version: string }) => void) => () => void
  onUpdateDownloadProgress: (
    callback: (progress: {
      percent: number
      bytesPerSecond: number
      transferred: number
      total: number
    }) => void
  ) => () => void
  onUpdateDownloaded: (
    callback: (info: { version: string; releaseDate?: string; releaseNotes?: string }) => void
  ) => () => void
  onUpdateError: (callback: (error: string) => void) => () => void

  // ============ 应用设置管理 API ============
  getAppSettings: () => Promise<{
    settings?: Record<string, unknown>
    mcpConfig?: { mcpServers: Record<string, unknown> }
    steeringFiles?: string[]
    error?: string
  }>
  getAppAvailableModels: () => Promise<{
    models: Array<{ id: string; name: string; description: string }>
    error?: string
  }>
  saveAppSettings: (
    settings: Record<string, unknown>
  ) => Promise<{ success: boolean; error?: string }>
  openAppMcpConfig: (type: 'user' | 'workspace') => Promise<{ success: boolean; error?: string }>
  openAppSteeringFolder: () => Promise<{ success: boolean; error?: string }>
  openAppSettingsFile: () => Promise<{ success: boolean; error?: string }>
  openAppSteeringFile: (filename: string) => Promise<{ success: boolean; error?: string }>
  createAppDefaultRules: () => Promise<{ success: boolean; error?: string }>
  readAppSteeringFile: (
    filename: string
  ) => Promise<{ success: boolean; content?: string; error?: string }>
  saveAppSteeringFile: (
    filename: string,
    content: string
  ) => Promise<{ success: boolean; error?: string }>
  deleteAppSteeringFile: (filename: string) => Promise<{ success: boolean; error?: string }>

  // ============ MCP 服务器管理 ============
  saveMcpServer: (
    name: string,
    config: { command: string; args?: string[]; env?: Record<string, string> },
    oldName?: string
  ) => Promise<{ success: boolean; error?: string }>
  deleteMcpServer: (name: string) => Promise<{ success: boolean; error?: string }>

  // ============ 应用 API 反代服务器 ============
  proxyStart: (config?: {
    port?: number
    host?: string
    apiKey?: string
    enableMultiAccount?: boolean
    logRequests?: boolean
  }) => Promise<{ success: boolean; port?: number; error?: string }>
  proxyStop: () => Promise<{ success: boolean; error?: string }>
  proxyGetStatus: () => Promise<{
    running: boolean
    config: unknown
    stats: unknown
    sessionStats?: {
      totalRequests: number
      successRequests: number
      failedRequests: number
      startTime: number
    }
  }>
  proxyResetCredits: () => Promise<{ success: boolean }>
  proxyResetTokens: () => Promise<{ success: boolean }>
  proxyResetRequestStats: () => Promise<{ success: boolean }>
  proxyGetLogs: (
    count?: number
  ) => Promise<
    Array<{ timestamp: string; level: string; category: string; message: string; data?: unknown }>
  >
  proxyClearLogs: () => Promise<{ success: boolean }>
  proxyGetLogsCount: () => Promise<number>
  proxyUpdateConfig: (config: {
    port?: number
    host?: string
    apiKey?: string
    enableMultiAccount?: boolean
    selectedAccountIds?: string[]
    logRequests?: boolean
    autoStart?: boolean
    maxRetries?: number
    preferredEndpoint?: 'codewhisperer' | 'amazonq'
    autoContinueRounds?: number
    disableTools?: boolean
    autoSwitchOnQuotaExhausted?: boolean
    modelMappings?: Array<{
      id: string
      name: string
      enabled: boolean
      type: 'replace' | 'alias' | 'loadbalance'
      sourceModel: string
      targetModels: string[]
      weights?: number[]
      priority: number
      apiKeyIds?: string[]
    }>
  }) => Promise<{ success: boolean; config?: unknown; error?: string }>
  proxyAddAccount: (account: {
    id: string
    email?: string
    accessToken: string
    refreshToken?: string
    profileArn?: string
    expiresAt?: number
  }) => Promise<{ success: boolean; accountCount?: number; error?: string }>
  proxyRemoveAccount: (
    accountId: string
  ) => Promise<{ success: boolean; accountCount?: number; error?: string }>
  proxySyncAccounts: (
    accounts: Array<{
      id: string
      email?: string
      accessToken: string
      refreshToken?: string
      profileArn?: string
      expiresAt?: number
    }>
  ) => Promise<{ success: boolean; accountCount?: number; error?: string }>
  proxyGetAccounts: () => Promise<{ accounts: unknown[]; availableCount: number }>
  proxyResetPool: () => Promise<{ success: boolean; error?: string }>
  proxyRefreshModels: () => Promise<{ success: boolean; error?: string }>
  proxyGetModels: () => Promise<{
    success: boolean
    error?: string
    models: Array<{
      id: string
      name: string
      description: string
      inputTypes?: string[]
      maxInputTokens?: number | null
      maxOutputTokens?: number | null
      rateMultiplier?: number
      rateUnit?: string
    }>
    fromCache?: boolean
  }>
  accountGetModels: (
    accessToken: string,
    region?: string,
    profileArn?: string
  ) => Promise<{
    success: boolean
    error?: string
    models: Array<{
      id: string
      name: string
      description: string
      inputTypes?: string[]
      maxInputTokens?: number | null
      maxOutputTokens?: number | null
      rateMultiplier?: number
      rateUnit?: string
    }>
  }>
  accountGetSubscriptions: (
    accessToken: string,
    region?: string
  ) => Promise<{
    success: boolean
    error?: string
    plans: Array<{
      name: string
      qSubscriptionType: string
      description: {
        title: string
        billingInterval: string
        featureHeader: string
        features: string[]
      }
      pricing: { amount: number; currency: string }
    }>
    disclaimer?: string[]
  }>
  accountGetSubscriptionUrl: (
    accessToken: string,
    subscriptionType?: string,
    region?: string
  ) => Promise<{ success: boolean; error?: string; url?: string; status?: string }>
  openSubscriptionWindow: (url: string) => Promise<{ success: boolean; error?: string }>
  proxySaveLogs: (
    logs: Array<{ time: string; path: string; status: number; tokens?: number }>
  ) => Promise<{ success: boolean; error?: string }>
  proxyLoadLogs: () => Promise<{
    success: boolean
    logs: Array<{ time: string; path: string; status: number; tokens?: number }>
  }>
  onProxyRequest: (
    callback: (info: { path: string; method: string; accountId?: string }) => void
  ) => () => void
  onProxyResponse: (
    callback: (info: {
      path: string
      model?: string
      status: number
      tokens?: number
      inputTokens?: number
      outputTokens?: number
      credits?: number
      error?: string
    }) => void
  ) => () => void
  onProxyError: (callback: (error: string) => void) => () => void
  onProxyStatusChange: (
    callback: (status: { running: boolean; port: number }) => void
  ) => () => void

  // ============ Usage API 类型设置 ============
  getUsageApiType: () => Promise<'rest' | 'cbor'>
  setUsageApiType: (type: 'rest' | 'cbor') => Promise<{ success: boolean; type: string }>

  // ============ 托盘相关 API ============
  getShowWindowShortcut: () => Promise<string>
  setShowWindowShortcut: (shortcut: string) => Promise<{ success: boolean; error?: string }>
  getTraySettings: () => Promise<{
    enabled: boolean
    closeAction: 'ask' | 'minimize' | 'quit'
    showNotifications: boolean
    minimizeOnStart: boolean
  }>
  saveTraySettings: (settings: {
    enabled?: boolean
    closeAction?: 'ask' | 'minimize' | 'quit'
    showNotifications?: boolean
    minimizeOnStart?: boolean
  }) => Promise<{ success: boolean; error?: string }>
  updateTrayAccount: (
    account: {
      id: string
      email: string
      idp: string
      status: string
      subscription?: string
      usage?: {
        usedCredits: number
        totalCredits: number
        totalRequests: number
        successRequests: number
        failedRequests: number
      }
    } | null
  ) => void
  updateTrayAccountList: (
    accounts: {
      id: string
      email: string
      idp: string
      status: string
    }[]
  ) => void
  refreshTrayMenu: () => void
  updateTrayLanguage: (language: 'en' | 'zh') => void
  onTrayRefreshAccount: (callback: () => void) => () => void
  onTraySwitchAccount: (callback: () => void) => () => void
  onShowCloseConfirmDialog: (callback: () => void) => () => void
  sendCloseConfirmResponse: (
    action: 'minimize' | 'quit' | 'cancel',
    rememberChoice: boolean
  ) => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppApi
  }
}
