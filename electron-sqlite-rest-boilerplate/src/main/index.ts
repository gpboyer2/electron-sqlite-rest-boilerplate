import { app, shell, BrowserWindow, ipcMain, dialog, globalShortcut } from 'electron'
import { autoUpdater } from 'electron-updater'
import * as machineIdModule from './machineId'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { writeFile, readFile } from 'fs/promises'
import { encode, decode } from 'cbor-x'
import icon from '../../resources/icon.png?asset'
import {
  createTray,
  destroyTray,
  updateTrayMenu,
  setTrayTooltip,
  updateTrayLanguage,
  type TraySettings,
  defaultTraySettings
} from './tray'

// ============ 应用名称配置 ============
app.setName('Electron SQLite REST')

// ============ 自动更新配置 ============
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

function setupAutoUpdater(): void {
  // 检查更新出错
  autoUpdater.on('error', (error) => {
    console.error('[AutoUpdater] Error:', error)
    mainWindow?.webContents.send('update-error', error.message)
  })

  // 检查更新中
  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for update...')
    mainWindow?.webContents.send('update-checking')
  })

  // 有可用更新
  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version)
    mainWindow?.webContents.send('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    })
  })

  // 没有可用更新
  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] No update available, current:', info.version)
    mainWindow?.webContents.send('update-not-available', { version: info.version })
  })

  // 下载进度
  autoUpdater.on('download-progress', (progress) => {
    console.log(`[AutoUpdater] Download progress: ${progress.percent.toFixed(1)}%`)
    mainWindow?.webContents.send('update-download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    })
  })

  // 下载完成
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info.version)
    mainWindow?.webContents.send('update-downloaded', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    })
  })
}

// ============ 第三方 API 调用 ============
const THIRD_PARTY_API_BASE = 'https://app.example.com/service/ThirdPartyWebPortalService/operation'
// REST API 端点配置 - 官方插件仅支持 us-east-1 和 eu-central-1
const THIRD_PARTY_REST_API_ENDPOINTS: Record<string, string> = {
  'us-east-1': 'https://q.us-east-1.amazonaws.com',
  'eu-central-1': 'https://q.eu-central-1.amazonaws.com'
}

// 根据 SSO 区域映射到最近的 REST API 端点
function getRestApiBase(ssoRegion?: string): string {
  if (!ssoRegion) return THIRD_PARTY_REST_API_ENDPOINTS['us-east-1']
  // 如果是支持的端点区域，直接使用
  if (THIRD_PARTY_REST_API_ENDPOINTS[ssoRegion]) return THIRD_PARTY_REST_API_ENDPOINTS[ssoRegion]
  // EU 区域映射到 eu-central-1
  if (ssoRegion.startsWith('eu-')) return THIRD_PARTY_REST_API_ENDPOINTS['eu-central-1']
  // 其他区域默认 us-east-1
  return THIRD_PARTY_REST_API_ENDPOINTS['us-east-1']
}

// 获取备用 REST API 端点（用于 fallback）
function getFallbackRestApiBase(ssoRegion?: string): string {
  const primary = getRestApiBase(ssoRegion)
  // 返回另一个端点作为 fallback
  return primary === THIRD_PARTY_REST_API_ENDPOINTS['eu-central-1']
    ? THIRD_PARTY_REST_API_ENDPOINTS['us-east-1']
    : THIRD_PARTY_REST_API_ENDPOINTS['eu-central-1']
}

// API 类型配置
type UsageApiType = 'rest' | 'cbor'
let currentUsageApiType: UsageApiType = 'rest' // 默认使用 REST API (GetUsageLimits)

export function setUsageApiType(type: UsageApiType): void {
  currentUsageApiType = type
  console.log(`[API] Usage API type set to: ${type}`)
}

export function getUsageApiType(): UsageApiType {
  return currentUsageApiType
}

// ============ OIDC Token 刷新 ============
interface OidcRefreshResult {
  success: boolean
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  error?: string
}

// 社交登录 (GitHub/Google) 的 Token 刷新端点
const THIRD_PARTY_AUTH_ENDPOINT = 'https://prod.us-east-1.auth.desktop.kiro.dev'

// ============ 代理设置 ============

// ============ 防抖 store 写入（减少磁盘 I/O） ============
const pendingStoreWrites: Map<string, unknown> = new Map()

function flushStoreWrites(): void {
  if (!store || pendingStoreWrites.size === 0) return
  for (const [key, value] of pendingStoreWrites) {
    store.set(key, value)
  }
  pendingStoreWrites.clear()
}

// ============ 隐私模式打开浏览器 ============
import { exec, execSync } from 'child_process'

// 获取 Windows 默认浏览器
function getWindowsDefaultBrowser(): string {
  try {
    // 从注册表读取默认浏览器
    const progId = execSync(
      'reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice" /v ProgId',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    )

    if (progId.includes('ChromeHTML') || progId.includes('Google')) return 'chrome'
    if (progId.includes('MSEdgeHTM') || progId.includes('Edge')) return 'msedge'
    if (progId.includes('FirefoxURL') || progId.includes('Firefox')) return 'firefox'
    if (progId.includes('BraveHTML') || progId.includes('Brave')) return 'brave'
    if (progId.includes('Opera')) return 'opera'

    return 'unknown'
  } catch {
    return 'unknown'
  }
}

// 使用隐私模式打开浏览器
function openBrowserInPrivateMode(url: string): void {
  const platform = process.platform
  console.log(`[Browser] Opening in private mode on ${platform}: ${url}`)

  try {
    if (platform === 'win32') {
      // Windows: 检测默认浏览器并使用对应的隐私模式参数
      const defaultBrowser = getWindowsDefaultBrowser()
      console.log(`[Browser] Detected default browser: ${defaultBrowser}`)

      let command = ''
      switch (defaultBrowser) {
        case 'chrome':
          command = `start chrome --incognito "${url}"`
          break
        case 'msedge':
          command = `start msedge -inprivate "${url}"`
          break
        case 'firefox':
          command = `start firefox -private-window "${url}"`
          break
        case 'brave':
          command = `start brave --incognito "${url}"`
          break
        case 'opera':
          command = `start opera --private "${url}"`
          break
        default:
          // 未知浏览器，尝试常见浏览器
          console.log('[Browser] Unknown default browser, trying common browsers...')
          exec(`start chrome --incognito "${url}"`, (err) => {
            if (err) {
              exec(`start msedge -inprivate "${url}"`, (err2) => {
                if (err2) {
                  exec(`start firefox -private-window "${url}"`, (err3) => {
                    if (err3) {
                      console.log('[Browser] Fallback to default browser (non-private)')
                      shell.openExternal(url)
                    }
                  })
                }
              })
            }
          })
          return
      }

      exec(command, (err) => {
        if (err) {
          console.log(`[Browser] Failed to open ${defaultBrowser}, fallback to default`)
          shell.openExternal(url)
        }
      })
    } else if (platform === 'darwin') {
      // macOS: 尝试 Chrome -> Firefox -> 默认浏览器
      exec(`open -na "Google Chrome" --args --incognito "${url}"`, (err) => {
        if (err) {
          exec(`open -a Firefox --args -private-window "${url}"`, (err2) => {
            if (err2) {
              console.log('[Browser] Fallback to default browser')
              shell.openExternal(url)
            }
          })
        }
      })
    } else {
      // Linux: 尝试 Chrome -> Chromium -> Firefox
      exec(`google-chrome --incognito "${url}"`, (err) => {
        if (err) {
          exec(`chromium --incognito "${url}"`, (err2) => {
            if (err2) {
              exec(`firefox -private-window "${url}"`, (err3) => {
                if (err3) {
                  console.log('[Browser] Fallback to default browser')
                  shell.openExternal(url)
                }
              })
            }
          })
        }
      })
    }
  } catch (error) {
    console.error('[Browser] Error opening in private mode:', error)
    shell.openExternal(url)
  }
}

// IdC (BuilderId) 的 OIDC Token 刷新
async function refreshOidcToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  region: string = 'us-east-1'
): Promise<OidcRefreshResult> {
  console.log(`[OIDC] Refreshing token with clientId: ${clientId.substring(0, 20)}...`)

  const url = `https://oidc.${region}.amazonaws.com/token`

  const payload = {
    clientId,
    clientSecret,
    refreshToken,
    grantType: 'refresh_token'
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[OIDC] Refresh failed: ${response.status} - ${errorText}`)
      return { success: false, error: `HTTP ${response.status}: ${errorText}` }
    }

    const data = await response.json()
    console.log(`[OIDC] Token refreshed successfully, expires in ${data.expiresIn}s`)

    return {
      success: true,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || refreshToken, // 可能不返回新的 refreshToken
      expiresIn: data.expiresIn
    }
  } catch (error) {
    console.error(`[OIDC] Refresh error:`, error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// 社交登录 (GitHub/Google) 的 Token 刷新
async function refreshSocialToken(refreshToken: string): Promise<OidcRefreshResult> {
  console.log(`[Social] Refreshing token...`)

  const url = `${THIRD_PARTY_AUTH_ENDPOINT}/refreshToken`
  const machineId = getCurrentMachineId()

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': getThirdPartyUserAgent(machineId)
      },
      body: JSON.stringify({ refreshToken })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Social] Refresh failed: ${response.status} - ${errorText}`)
      return { success: false, error: `HTTP ${response.status}: ${errorText}` }
    }

    const data = await response.json()
    console.log(`[Social] Token refreshed successfully, expires in ${data.expiresIn}s`)

    return {
      success: true,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || refreshToken,
      expiresIn: data.expiresIn
    }
  } catch (error) {
    console.error(`[Social] Refresh error:`, error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// 通用 Token 刷新 - 根据 authMethod 选择刷新方式
async function refreshTokenByMethod(
  token: string,
  clientId: string,
  clientSecret: string,
  region: string = 'us-east-1',
  authMethod?: string
): Promise<OidcRefreshResult> {
  // 如果是社交登录，使用第三方 Auth Service 刷新
  if (authMethod === 'social') {
    return refreshSocialToken(token)
  }
  // 否则使用 OIDC 刷新 (IdC/BuilderId)
  return refreshOidcToken(token, clientId, clientSecret, region)
}

function generateInvocationId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// 第三方 API 版本和 User-Agent 生成
const THIRD_PARTY_VERSION = '0.6.18'

function getThirdPartyUserAgent(machineId?: string): string {
  const suffix = machineId
    ? `ElectronSQLiteRest-${THIRD_PARTY_VERSION}-${machineId}`
    : `ElectronSQLiteRest-${THIRD_PARTY_VERSION}`
  return `aws-sdk-js/1.0.18 ua/2.1 os/windows lang/js md/nodejs#20.16.0 api/codewhispererstreaming#1.0.18 m/E ${suffix}`
}

function getThirdPartyAmzUserAgent(machineId?: string): string {
  const suffix = machineId
    ? `ElectronSQLiteRest ${THIRD_PARTY_VERSION} ${machineId}`
    : `ElectronSQLiteRest-${THIRD_PARTY_VERSION}`
  return `aws-sdk-js/1.0.18 ${suffix}`
}

function getCurrentMachineId(): string | undefined {
  // kproxy 模块已删除，返回 undefined
  return undefined
}

// ============ AWS SSO 设备授权流程 ============

async function thirdPartyApiRequest<T>(
  operation: string,
  body: Record<string, unknown>,
  accessToken: string,
  idp: string = 'BuilderId', // 支持 BuilderId, Github, Google
  accountMachineId?: string // 账户绑定的设备 ID
): Promise<T> {
  console.log(`[ThirdParty API] Calling ${operation}`)
  console.log(`[ThirdParty API] Body:`, JSON.stringify(body))
  console.log(`[ThirdParty API] AccessToken length:`, accessToken?.length)
  console.log(`[ThirdParty API] AccessToken (first 100 chars):`, accessToken?.substring(0, 100))
  console.log(
    `[ThirdParty API] AccessToken (last 50 chars):`,
    accessToken?.substring(accessToken.length - 50)
  )
  console.log(`[ThirdParty API] Idp:`, idp)

  // 优先使用账户绑定的设备 ID，其次使用当前设备 ID
  const machineId = accountMachineId || getCurrentMachineId()
  console.log(
    `[ThirdParty API] Machine ID: ${machineId || 'undefined'} (account: ${accountMachineId ? 'yes' : 'no'})`
  )

  // 直接使用原生 fetch
  const headers: Record<string, string> = {
    accept: 'application/cbor',
    'content-type': 'application/cbor',
    'smithy-protocol': 'rpc-v2-cbor',
    'amz-sdk-invocation-id': generateInvocationId(),
    'amz-sdk-request': 'attempt=1; max=1',
    'x-amz-user-agent': getThirdPartyAmzUserAgent(machineId),
    authorization: `Bearer ${accessToken}`,
    cookie: `Idp=${idp}; AccessToken=${accessToken}`
  }

  const response = await fetch(`${THIRD_PARTY_API_BASE}/${operation}`, {
    method: 'POST',
    headers,
    body: Buffer.from(encode(body))
  })

  console.log(`[ThirdParty API] Response status: ${response.status}`)

  if (!response.ok) {
    // 尝试解析 CBOR 格式的错误响应
    let errorMessage = `HTTP ${response.status}`
    const errorBuffer = await response.arrayBuffer()
    try {
      const errorData = decode(Buffer.from(errorBuffer)) as { __type?: string; message?: string }
      if (errorData.__type && errorData.message) {
        // 提取错误类型名称（去掉命名空间）
        const errorType = errorData.__type.split('#').pop() || errorData.__type
        // 在错误消息中包含 HTTP 状态码，便于封禁检测
        errorMessage = `HTTP ${response.status}: ${errorType}: ${errorData.message}`
      } else if (errorData.message) {
        errorMessage = `HTTP ${response.status}: ${errorData.message}`
      }
      console.error(`[ThirdParty API] Error:`, errorData)
    } catch {
      // 如果 CBOR 解析失败，显示原始内容
      const errorText = Buffer.from(errorBuffer).toString('utf-8')
      console.error(`[ThirdParty API] Error (raw): ${errorText}`)
    }
    throw new Error(errorMessage)
  }

  const arrayBuffer = await response.arrayBuffer()
  const result = decode(Buffer.from(arrayBuffer)) as T
  console.log(`[ThirdParty API] Response:`, JSON.stringify(result, null, 2))
  return result
}

// ============ GetUsageLimits REST API (官方格式) ============
interface UsageLimitsResponse {
  // REST API 实际返回 usageBreakdownList（不是 usageBreakdowns）
  usageBreakdownList?: Array<{
    type?: string
    resourceType?: string
    displayName?: string
    displayNamePlural?: string
    currentUsage?: number
    currentUsageWithPrecision?: number
    usageLimit?: number
    usageLimitWithPrecision?: number
    currency?: string
    unit?: string
    overageRate?: number
    overageCap?: number
    overageCharges?: number
    currentOverages?: number
    freeTrialUsage?: {
      currentUsage?: number
      currentUsageWithPrecision?: number
      usageLimit?: number
      usageLimitWithPrecision?: number
      freeTrialStatus?: string
      freeTrialExpiry?: string
    }
    // REST API 直接返回 freeTrialInfo（与 freeTrialUsage 结构相同）
    freeTrialInfo?: {
      currentUsage?: number
      currentUsageWithPrecision?: number
      usageLimit?: number
      usageLimitWithPrecision?: number
      freeTrialStatus?: string
      freeTrialExpiry?: number | string
    }
    bonuses?: Array<{
      bonusCode?: string
      displayName?: string
      description?: string
      usageLimit?: number
      usageLimitWithPrecision?: number
      currentUsage?: number
      currentUsageWithPrecision?: number
      expiresAt?: number | string // REST API 返回数字时间戳
      redeemedAt?: number | string
      status?: string
    }>
  }>
  nextDateReset?: number | string // Unix 时间戳（秒）或 ISO 字符串
  subscriptionInfo?: {
    subscriptionName?: string
    subscriptionTitle?: string
    subscriptionType?: string
    status?: string
    subscriptionManagementTarget?: string
    upgradeCapability?: string
    overageCapability?: string
  }
  overageSettings?: {
    overageStatus?: string
  }
  overageConfiguration?: {
    overageEnabled?: boolean
  }
  userInfo?: {
    email?: string
    userId?: string
  }
}

// 辅助函数：将 Unix 时间戳（秒）或 ISO 字符串转换为 ISO 字符串
function normalizeResetDate(value: number | string | undefined): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'number') {
    // Unix 时间戳（秒），转换为毫秒后创建 Date
    return new Date(value * 1000).toISOString()
  }
  return value
}

async function fetchRestApi(
  baseUrl: string,
  path: string,
  accessToken: string,
  machineId?: string
): Promise<Response> {
  // kproxy 模块已删除，直接使用原生 fetch
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'User-Agent': getThirdPartyUserAgent(machineId),
    'x-amz-user-agent': getThirdPartyAmzUserAgent(machineId)
  }
  const url = `${baseUrl}${path}`
  return fetch(url, { method: 'GET', headers })
}

async function getUsageLimitsRest(
  accessToken: string,
  profileArn?: string,
  accountMachineId?: string, // 账户绑定的设备 ID
  ssoRegion?: string // SSO 区域，用于选择正确的 REST API 端点
): Promise<UsageLimitsResponse> {
  console.log(`[ThirdParty REST API] Calling GetUsageLimits (ssoRegion: ${ssoRegion || 'default'})`)

  // 优先使用账户绑定的设备 ID，其次使用当前设备 ID
  const machineId = accountMachineId || getCurrentMachineId()
  console.log(
    `[ThirdParty REST API] Machine ID: ${machineId || 'undefined'} (account: ${accountMachineId ? 'yes' : 'no'})`
  )

  const params = new URLSearchParams({
    origin: 'AI_EDITOR',
    resourceType: 'AGENTIC_REQUEST',
    isEmailRequired: 'true'
  })
  if (profileArn) {
    params.set('profileArn', profileArn)
  }
  const path = `/getUsageLimits?${params.toString()}`

  // 根据 SSO 区域选择主端点
  const primaryBase = getRestApiBase(ssoRegion)
  const fallbackBase = getFallbackRestApiBase(ssoRegion)

  console.log(`[ThirdParty REST API] Primary endpoint: ${primaryBase}`)

  let response = await fetchRestApi(primaryBase, path, accessToken, machineId)
  console.log(`[ThirdParty REST API] Response status: ${response.status}`)

  // 如果主端点返回 403，尝试备用端点
  if (response.status === 403) {
    console.log(
      `[ThirdParty REST API] Primary endpoint returned 403, trying fallback: ${fallbackBase}`
    )
    response = await fetchRestApi(fallbackBase, path, accessToken, machineId)
    console.log(`[ThirdParty REST API] Fallback response status: ${response.status}`)
  }

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[ThirdParty REST API] Error: ${errorText}`)
    throw new Error(`HTTP ${response.status}: ${errorText}`)
  }

  const result = await response.json()
  console.log(`[ThirdParty REST API] Response:`, JSON.stringify(result, null, 2))
  return result
}

async function getUsageAndLimits(
  accessToken: string,
  idp: string = 'BuilderId',
  profileArn?: string,
  accountMachineId?: string, // 账户绑定的设备 ID
  ssoRegion?: string // SSO 区域，用于选择正确的 REST API 端点
): Promise<Record<string, unknown>> {
  if (currentUsageApiType === 'rest') {
    // 使用 REST API (GetUsageLimits)
    const result = await getUsageLimitsRest(accessToken, profileArn, accountMachineId, ssoRegion)
    console.log('[REST->Unified] Converting response:', JSON.stringify(result, null, 2))
    // REST API 返回的字段名和 CBOR API 相同，直接返回
    return {
      usageBreakdownList: result.usageBreakdownList?.map((b) => ({
        resourceType: b.resourceType || b.type,
        displayName: b.displayName,
        displayNamePlural: b.displayNamePlural,
        currentUsage: b.currentUsage,
        currentUsageWithPrecision: b.currentUsageWithPrecision,
        usageLimit: b.usageLimit,
        usageLimitWithPrecision: b.usageLimitWithPrecision,
        currency: b.currency,
        unit: b.unit,
        overageRate: b.overageRate,
        overageCap: b.overageCap,
        type: b.type,
        // REST API 直接返回 freeTrialInfo，CBOR API 返回 freeTrialUsage
        freeTrialInfo: b.freeTrialInfo
          ? {
              freeTrialStatus: b.freeTrialInfo.freeTrialStatus,
              usageLimit: b.freeTrialInfo.usageLimit,
              usageLimitWithPrecision: b.freeTrialInfo.usageLimitWithPrecision,
              currentUsage: b.freeTrialInfo.currentUsage,
              currentUsageWithPrecision: b.freeTrialInfo.currentUsageWithPrecision,
              // REST API 返回数字时间戳，需要转换为 ISO 字符串
              freeTrialExpiry:
                typeof b.freeTrialInfo.freeTrialExpiry === 'number'
                  ? new Date(b.freeTrialInfo.freeTrialExpiry * 1000).toISOString()
                  : b.freeTrialInfo.freeTrialExpiry
            }
          : b.freeTrialUsage
            ? {
                freeTrialStatus: b.freeTrialUsage.freeTrialStatus,
                usageLimit: b.freeTrialUsage.usageLimit,
                usageLimitWithPrecision: b.freeTrialUsage.usageLimitWithPrecision,
                currentUsage: b.freeTrialUsage.currentUsage,
                currentUsageWithPrecision: b.freeTrialUsage.currentUsageWithPrecision,
                freeTrialExpiry: b.freeTrialUsage.freeTrialExpiry
              }
            : undefined,
        // 转换 bonuses 中的时间戳为 ISO 字符串
        bonuses: b.bonuses?.map((bonus) => ({
          ...bonus,
          expiresAt:
            typeof bonus.expiresAt === 'number'
              ? new Date(bonus.expiresAt * 1000).toISOString()
              : bonus.expiresAt
        }))
      })),
      // REST API 返回的 nextDateReset 是 Unix 时间戳（秒），需要转换为 ISO 字符串
      nextDateReset: normalizeResetDate(result.nextDateReset),
      subscriptionInfo: result.subscriptionInfo,
      overageConfiguration: result.overageConfiguration,
      userInfo: result.userInfo
    }
  } else {
    // 使用 CBOR API (GetUserUsageAndLimits)
    // CBOR API (第三方网页端门户) 仅支持 BuilderId 认证
    // Enterprise/IdC 账号可能返回 401，需要 fallback 到 REST API
    try {
      return await thirdPartyApiRequest<Record<string, unknown>>(
        'GetUserUsageAndLimits',
        { isEmailRequired: true, origin: 'THIRD_PARTY_IDE' },
        accessToken,
        idp,
        accountMachineId
      )
    } catch (cborError) {
      const errorMsg = cborError instanceof Error ? cborError.message : ''
      // CBOR 401/403 时自动 fallback 到 REST API
      if (errorMsg.includes('401') || errorMsg.includes('403')) {
        console.log(`[API] CBOR API failed (${errorMsg}), falling back to REST API...`)
        const result = await getUsageLimitsRest(
          accessToken,
          profileArn,
          accountMachineId,
          ssoRegion
        )
        return {
          usageBreakdownList: result.usageBreakdownList?.map((b) => ({
            resourceType: b.resourceType || b.type,
            displayName: b.displayName,
            displayNamePlural: b.displayNamePlural,
            currentUsage: b.currentUsage,
            currentUsageWithPrecision: b.currentUsageWithPrecision,
            usageLimit: b.usageLimit,
            usageLimitWithPrecision: b.usageLimitWithPrecision,
            currency: b.currency,
            unit: b.unit,
            overageRate: b.overageRate,
            overageCap: b.overageCap,
            type: b.type,
            freeTrialInfo: b.freeTrialInfo
              ? {
                  freeTrialStatus: b.freeTrialInfo.freeTrialStatus,
                  usageLimit: b.freeTrialInfo.usageLimit,
                  usageLimitWithPrecision: b.freeTrialInfo.usageLimitWithPrecision,
                  currentUsage: b.freeTrialInfo.currentUsage,
                  currentUsageWithPrecision: b.freeTrialInfo.currentUsageWithPrecision,
                  freeTrialExpiry:
                    typeof b.freeTrialInfo.freeTrialExpiry === 'number'
                      ? new Date(b.freeTrialInfo.freeTrialExpiry * 1000).toISOString()
                      : b.freeTrialInfo.freeTrialExpiry
                }
              : b.freeTrialUsage
                ? {
                    freeTrialStatus: b.freeTrialUsage.freeTrialStatus,
                    usageLimit: b.freeTrialUsage.usageLimit,
                    usageLimitWithPrecision: b.freeTrialUsage.usageLimitWithPrecision,
                    currentUsage: b.freeTrialUsage.currentUsage,
                    currentUsageWithPrecision: b.freeTrialUsage.currentUsageWithPrecision,
                    freeTrialExpiry: b.freeTrialUsage.freeTrialExpiry
                  }
                : undefined,
            bonuses: b.bonuses?.map((bonus) => ({
              ...bonus,
              expiresAt:
                typeof bonus.expiresAt === 'number'
                  ? new Date(bonus.expiresAt * 1000).toISOString()
                  : bonus.expiresAt
            }))
          })),
          nextDateReset: normalizeResetDate(result.nextDateReset as unknown as number | string),
          subscriptionInfo: result.subscriptionInfo,
          overageConfiguration: result.overageConfiguration,
          userInfo: result.userInfo
        }
      }
      throw cborError
    }
  }
}

// GetUserInfo API - 只需要 accessToken 即可调用
interface UserInfoResponse {
  email?: string
  userId?: string
  idp?: string
  status?: string
  featureFlags?: string[]
}

async function getUserInfo(
  accessToken: string,
  idp: string = 'BuilderId',
  accountMachineId?: string
): Promise<UserInfoResponse> {
  return thirdPartyApiRequest<UserInfoResponse>(
    'GetUserInfo',
    { origin: 'THIRD_PARTY_IDE' },
    accessToken,
    idp,
    accountMachineId
  )
}

// 定义自定义协议
const PROTOCOL_PREFIX = 'electron-sqlite-rest'

// electron-store 实例（延迟初始化）
let store: {
  get: (key: string, defaultValue?: unknown) => unknown
  set: (key: string, value: unknown) => void
  path: string
} | null = null

// 最后保存的数据（用于崩溃恢复）
const lastSavedData: unknown = null

async function initStore(): Promise<void> {
  if (store) return
  const Store = (await import('electron-store')).default
  const fs = await import('fs/promises')
  const path = await import('path')

  const storeInstance = new Store({
    name: 'third-party-accounts',
    encryptionKey: 'electron-sqlite-rest-boilerplate-secret-key'
  })

  store = storeInstance as unknown as typeof store

  // 尝试从备份恢复数据（如果主数据损坏）
  try {
    const backupPath = path.join(
      path.dirname(storeInstance.path),
      'third-party-accounts.backup.json'
    )
    const mainData = storeInstance.get('accountData')

    if (!mainData) {
      // 主数据不存在或损坏，尝试从备份恢复
      try {
        const backupContent = await fs.readFile(backupPath, 'utf-8')
        const backupData = JSON.parse(backupContent)
        if (backupData && backupData.accounts) {
          console.log('[Store] Restoring data from backup...')
          storeInstance.set('accountData', backupData)
          console.log('[Store] Data restored from backup successfully')
        }
      } catch {
        // 备份也不存在，忽略
      }
    }
  } catch (error) {
    console.error('[Store] Error checking backup:', error)
  }
}

// 创建数据备份
async function createBackup(data: unknown): Promise<void> {
  if (!store) return

  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const backupPath = path.join(path.dirname(store.path), 'third-party-accounts.backup.json')

    await fs.writeFile(backupPath, JSON.stringify(data, null, 2), 'utf-8')
    console.log('[Backup] Data backup created')
  } catch (error) {
    console.error('[Backup] Failed to create backup:', error)
  }
}

let mainWindow: BrowserWindow | null = null

// ============ 托盘相关变量 ============
let traySettings: TraySettings = { ...defaultTraySettings }
let isQuitting = false // 标记是否真正退出应用

// ============ 全局快捷键设置 ============
let showWindowShortcut = process.platform === 'darwin' ? 'Command+Shift+K' : 'Ctrl+Shift+K'

// 加载快捷键设置
async function loadShortcutSettings(): Promise<void> {
  try {
    await initStore()
    const saved = store?.get('showWindowShortcut') as string | undefined
    if (saved) {
      showWindowShortcut = saved
    }
  } catch (error) {
    console.error('[Shortcut] Failed to load shortcut settings:', error)
  }
}

// 保存快捷键设置
async function saveShortcutSettings(): Promise<void> {
  try {
    await initStore()
    store?.set('showWindowShortcut', showWindowShortcut)
  } catch (error) {
    console.error('[Shortcut] Failed to save shortcut settings:', error)
  }
}

// 注册显示主窗口的快捷键
function registerShowWindowShortcut(): void {
  // 先注销所有已注册的快捷键
  globalShortcut.unregisterAll()

  if (!showWindowShortcut) return

  try {
    const success = globalShortcut.register(showWindowShortcut, () => {
      if (mainWindow) {
        // macOS: 显示窗口时恢复 Dock 图标
        if (process.platform === 'darwin' && app.dock) {
          app.dock.show()
        }
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.show()
        mainWindow.focus()
      }
    })
    if (success) {
      console.log(`[Shortcut] Registered: ${showWindowShortcut}`)
    } else {
      console.warn(`[Shortcut] Failed to register: ${showWindowShortcut}`)
    }
  } catch (error) {
    console.error('[Shortcut] Error registering shortcut:', error)
  }
}

// 加载托盘设置
async function loadTraySettings(): Promise<void> {
  try {
    await initStore()
    const saved = store?.get('traySettings') as TraySettings | undefined
    if (saved) {
      traySettings = { ...defaultTraySettings, ...saved }
    }
  } catch (error) {
    console.error('[Tray] Failed to load tray settings:', error)
  }
}

// 保存托盘设置
async function saveTraySettings(): Promise<void> {
  try {
    await initStore()
    store?.set('traySettings', traySettings)
  } catch (error) {
    console.error('[Tray] Failed to save tray settings:', error)
  }
}

// 初始化托盘
function initTray(): void {
  if (!traySettings.enabled) return

  createTray({
    onShowWindow: () => {
      if (mainWindow) {
        // macOS: 显示窗口时恢复 Dock 图标
        if (process.platform === 'darwin' && app.dock) {
          app.dock.show()
        }
        if (mainWindow.isMinimized()) {
          mainWindow.restore()
        }
        mainWindow.show()
        mainWindow.focus()
      }
    },
    onQuit: () => {
      isQuitting = true
      app.quit()
    },
    onRefreshAccount: async () => {
      mainWindow?.webContents.send('tray-refresh-account')
    },
    onSwitchAccount: async () => {
      mainWindow?.webContents.send('tray-switch-account')
    },
    getCurrentAccount: () => null,
    getAccountList: () => [],
    getSessionStats: () => {
      return { totalRequests: 0, successRequests: 0, failedRequests: 0, startTime: 0 }
    }
  })

  // 设置初始提示
  setTrayTooltip(`Electron SQLite REST v${app.getVersion()}`)
}

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    title: `Electron SQLite REST v${app.getVersion()}`,
    width: 1200, // 刚好容纳 3 列卡片 (340*3 + 16*2 + 边距)
    height: 1100,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    // 设置带版本号的标题（HTML 加载后会覆盖初始标题）
    mainWindow?.setTitle(`Electron SQLite REST v${app.getVersion()}`)
    mainWindow?.show()

    // proxy 和 kproxy 模块已删除，自启动逻辑已移除
  })

  mainWindow.on('close', (event) => {
    // 托盘最小化逻辑 - 必须同步检查并调用 preventDefault
    if (traySettings.enabled && !isQuitting) {
      if (traySettings.closeAction === 'minimize') {
        // 直接最小化到托盘
        event.preventDefault()
        mainWindow?.hide()
        // macOS: 隐藏窗口时隐藏 Dock 图标
        if (process.platform === 'darwin' && app.dock) {
          app.dock.hide()
        }
        return
      } else if (traySettings.closeAction === 'ask' && mainWindow) {
        // 询问用户 - 先阻止关闭，再异步处理
        event.preventDefault()
        // 通知渲染进程显示自定义对话框
        mainWindow.webContents.send('show-close-confirm-dialog')
        return
      }
      // closeAction === 'quit' 时继续关闭流程
    }

    // 窗口关闭前保存数据（同步保存，不等待备份）
    if (lastSavedData && store) {
      try {
        console.log('[Window] Saving data before close...')
        store.set('accountData', lastSavedData)
        // 备份异步进行，不阻塞关闭
        createBackup(lastSavedData)
          .then(() => {
            console.log('[Window] Backup created')
          })
          .catch((err) => {
            console.error('[Window] Backup failed:', err)
          })
        console.log('[Window] Data saved successfully')
      } catch (error) {
        console.error('[Window] Failed to save data:', error)
      }
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 注册自定义协议
function registerProtocol(): void {
  // 先注销旧的注册（防止上次异常退出未注销）
  unregisterProtocol()

  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL_PREFIX, process.execPath, [join(process.argv[1])])
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL_PREFIX)
  }
  console.log(`[Protocol] Registered ${PROTOCOL_PREFIX}:// protocol`)
}

// 注销自定义协议 (应用退出时调用)
function unregisterProtocol(): void {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.removeAsDefaultProtocolClient(PROTOCOL_PREFIX, process.execPath, [join(process.argv[1])])
    }
  } else {
    app.removeAsDefaultProtocolClient(PROTOCOL_PREFIX)
  }
  console.log(`[Protocol] Unregistered ${PROTOCOL_PREFIX}:// protocol`)
}

// 处理协议 URL (用于 OAuth 回调)
function handleProtocolUrl(url: string): void {
  if (!url.startsWith(`${PROTOCOL_PREFIX}://`)) return

  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname.replace(/^\/+/, '')

    // 处理 auth 回调
    if (pathname === 'auth/callback' || urlObj.host === 'auth') {
      const code = urlObj.searchParams.get('code')
      const state = urlObj.searchParams.get('state')

      if (code && state && mainWindow) {
        mainWindow.webContents.send('auth-callback', { code, state })
        mainWindow.focus()
      }
    }
  } catch (error) {
    console.error('Failed to parse protocol URL:', error)
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // 注册自定义协议
  registerProtocol()

  // ============ macOS Dock 图标设置 ============
  // 必须在 whenReady 后设置，否则 app.dock 可能未初始化
  if (process.platform === 'darwin' && app.dock) {
    const { nativeImage } = await import('electron')
    // 生产环境使用 icns，开发环境使用 png（electron-vite 开发模式不支持直接加载 icns）
    const dockIconPath = app.isPackaged
      ? join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'AppIcon.icns')
      : join(__dirname, '../../resources/icon.png')
    const dockIcon = nativeImage.createFromPath(dockIconPath)
    if (!dockIcon.isEmpty()) {
      app.dock.setIcon(dockIcon)
    }
  }

  // 加载托盘设置并初始化托盘
  await loadTraySettings()
  initTray()

  // 初始化自动更新（仅生产环境）
  if (!is.dev) {
    setupAutoUpdater()
    // 启动后延迟检查更新
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(console.error)
    }, 3000)
  }

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electronsqlirest.boilerplate')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC: 打开外部链接
  ipcMain.on('open-external', (_event, url: string, usePrivateMode?: boolean) => {
    if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      if (usePrivateMode) {
        openBrowserInPrivateMode(url)
      } else {
        shell.openExternal(url)
      }
    }
  })

  // ============ 托盘相关 IPC ============

  // IPC: 获取托盘设置
  ipcMain.handle('get-tray-settings', () => {
    return traySettings
  })

  // IPC: 获取显示主窗口快捷键
  ipcMain.handle('get-show-window-shortcut', () => {
    return showWindowShortcut
  })

  // IPC: 设置显示主窗口快捷键
  ipcMain.handle('set-show-window-shortcut', async (_event, shortcut: string) => {
    try {
      showWindowShortcut = shortcut
      await saveShortcutSettings()
      registerShowWindowShortcut()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // IPC: 保存托盘设置
  ipcMain.handle('save-tray-settings', async (_event, settings: Partial<TraySettings>) => {
    try {
      traySettings = { ...traySettings, ...settings }
      await saveTraySettings()

      // 根据设置启用/禁用托盘
      if (settings.enabled !== undefined) {
        if (settings.enabled) {
          initTray()
        } else {
          destroyTray()
        }
      }

      return { success: true }
    } catch (error) {
      console.error('[Tray] Failed to save settings:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // IPC: 更新托盘账户信息（从渲染进程调用）- 已禁用
  ipcMain.on('update-tray-account', () => {
    // 功能已禁用
  })

  // IPC: 更新托盘账户列表（从渲染进程调用）- 已禁用
  ipcMain.on('update-tray-account-list', () => {
    // 功能已禁用
  })

  // IPC: 刷新托盘菜单
  ipcMain.on('refresh-tray-menu', () => {
    updateTrayMenu()
  })

  // IPC: 更新托盘语言
  ipcMain.on('update-tray-language', (_event, language: 'en' | 'zh') => {
    updateTrayLanguage(language)
  })

  // IPC: 关闭确认对话框响应
  ipcMain.on(
    'close-confirm-response',
    (_event, action: 'minimize' | 'quit' | 'cancel', rememberChoice: boolean) => {
      if (action === 'minimize') {
        mainWindow?.hide()
        // macOS: 隐藏窗口时隐藏 Dock 图标
        if (process.platform === 'darwin' && app.dock) {
          app.dock.hide()
        }
      } else if (action === 'quit') {
        // 如果用户选择记住选择
        if (rememberChoice) {
          traySettings.closeAction = 'quit'
          saveTraySettings()
        }
        isQuitting = true
        app.quit()
      }
      // cancel 时不做任何操作

      // 如果用户选择记住"最小化"选择
      if (action === 'minimize' && rememberChoice) {
        traySettings.closeAction = 'minimize'
        saveTraySettings()
      }
    }
  )

  // IPC: 获取应用版本
  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })

  // IPC: 检查更新
  ipcMain.handle('check-for-updates', async () => {
    if (is.dev) {
      return { hasUpdate: false, message: '开发环境不支持更新检查' }
    }
    try {
      const result = await autoUpdater.checkForUpdates()
      return {
        hasUpdate: !!result?.updateInfo,
        version: result?.updateInfo?.version,
        releaseDate: result?.updateInfo?.releaseDate
      }
    } catch (error) {
      console.error('[AutoUpdater] Check failed:', error)
      return { hasUpdate: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // IPC: 下载更新
  ipcMain.handle('download-update', async () => {
    if (is.dev) {
      return { success: false, message: '开发环境不支持更新' }
    }
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error) {
      console.error('[AutoUpdater] Download failed:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // IPC: 安装更新并重启
  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  // IPC: 手动检查更新（使用 GitHub API，用于 AboutPage）
  const GITHUB_REPO = 'gpboyer2/electron-sqlite-rest-boilerplate'
  const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`

  ipcMain.handle('check-for-updates-manual', async () => {
    try {
      console.log('[Update] Manual check via GitHub API...')
      const currentVersion = app.getVersion()

      const response = await fetch(GITHUB_API_URL, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'electron-sqlite-rest-boilerplate'
        }
      })

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('GitHub API 请求次数超限，请稍后再试')
        } else if (response.status === 404) {
          throw new Error('未找到发布版本')
        }
        throw new Error(`GitHub API 错误: ${response.status}`)
      }

      const release = (await response.json()) as {
        tag_name: string
        name: string
        body: string
        html_url: string
        published_at: string
        assets: Array<{
          name: string
          browser_download_url: string
          size: number
        }>
      }

      const latestVersion = release.tag_name.replace(/^v/, '')

      // 比较版本号
      const compareVersions = (v1: string, v2: string): number => {
        const parts1 = v1.split('.').map(Number)
        const parts2 = v2.split('.').map(Number)
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
          const p1 = parts1[i] || 0
          const p2 = parts2[i] || 0
          if (p1 > p2) return 1
          if (p1 < p2) return -1
        }
        return 0
      }

      const hasUpdate = compareVersions(latestVersion, currentVersion) > 0

      console.log(
        `[Update] Current: ${currentVersion}, Latest: ${latestVersion}, HasUpdate: ${hasUpdate}`
      )

      return {
        hasUpdate,
        currentVersion,
        latestVersion,
        releaseNotes: release.body || '',
        releaseName: release.name || `v${latestVersion}`,
        releaseUrl: release.html_url,
        publishedAt: release.published_at,
        assets: release.assets.map((a) => ({
          name: a.name,
          downloadUrl: a.browser_download_url,
          size: a.size
        }))
      }
    } catch (error) {
      console.error('[Update] Manual check failed:', error)
      return {
        hasUpdate: false,
        error: error instanceof Error ? error.message : '检查更新失败'
      }
    }
  })

  // IPC: 后台批量刷新账号（在主进程执行，不阻塞 UI）
  ipcMain.handle(
    'background-batch-refresh',
    async (
      _event,
      accounts: Array<{
        id: string
        idp?: string
        needsTokenRefresh?: boolean
        machineId?: string // 账户绑定的设备 ID
        credentials: {
          refreshToken: string
          clientId?: string
          clientSecret?: string
          region?: string
          authMethod?: string
          accessToken?: string
          provider?: string
        }
      }>,
      concurrency: number = 10,
      syncInfo: boolean = true
    ) => {
      console.log(
        `[BackgroundRefresh] Starting batch refresh for ${accounts.length} accounts, concurrency: ${concurrency}, syncInfo: ${syncInfo}`
      )

      let completed = 0
      let success = 0
      let failed = 0

      // 串行处理每批，避免并发过高
      for (let i = 0; i < accounts.length; i += concurrency) {
        const batch = accounts.slice(i, i + concurrency)

        await Promise.allSettled(
          batch.map(async (account) => {
            try {
              const {
                refreshToken,
                clientId,
                clientSecret,
                region,
                authMethod,
                accessToken,
                provider
              } = account.credentials
              const needsTokenRefresh = account.needsTokenRefresh !== false // 默认为 true（兼容旧版本）

              // 确定正确的 idp
              let idp = 'BuilderId'
              if (authMethod === 'social') {
                idp = provider || account.idp || 'BuilderId'
              } else if (provider) {
                idp = provider
              }

              let newAccessToken = accessToken
              let newRefreshToken = refreshToken
              let newExpiresIn: number | undefined

              // 只有需要刷新 Token 时才刷新
              if (needsTokenRefresh) {
                if (!refreshToken) {
                  failed++
                  completed++
                  return
                }

                // 刷新 Token
                const refreshResult = await refreshTokenByMethod(
                  refreshToken,
                  clientId || '',
                  clientSecret || '',
                  region || 'us-east-1',
                  authMethod
                )

                if (!refreshResult.success) {
                  failed++
                  completed++
                  // 通知渲染进程刷新失败
                  mainWindow?.webContents.send('background-refresh-result', {
                    id: account.id,
                    success: false,
                    error: refreshResult.error
                  })
                  return
                }

                newAccessToken = refreshResult.accessToken || accessToken
                newRefreshToken = refreshResult.refreshToken || refreshToken
                newExpiresIn = refreshResult.expiresIn
              }

              // 获取账号信息
              if (!newAccessToken) {
                failed++
                completed++
                return
              }

              // 根据 syncInfo 决定是否检测账户信息
              let parsedUsage:
                | {
                    current: number
                    limit: number
                    baseCurrent: number
                    baseLimit: number
                    freeTrialCurrent: number
                    freeTrialLimit: number
                    freeTrialExpiry?: string
                    bonuses: Array<{
                      code: string
                      name: string
                      current: number
                      limit: number
                      expiresAt?: string
                    }>
                    nextResetDate?: string
                  }
                | undefined
              let userInfoData: UserInfoResponse | undefined
              let subscriptionData:
                | { type: string; title: string; daysRemaining?: number; expiresAt?: number }
                | undefined
              let status = 'active'
              let errorMessage: string | undefined

              if (syncInfo) {
                // 调用 getUsageAndLimits API（根据配置选择 REST 或 CBOR 格式）
                try {
                  interface UsageBreakdownItem {
                    resourceType?: string
                    currentUsage?: number
                    currentUsageWithPrecision?: number
                    usageLimit?: number
                    usageLimitWithPrecision?: number
                    freeTrialInfo?: {
                      freeTrialStatus?: string
                      usageLimit?: number
                      usageLimitWithPrecision?: number
                      currentUsage?: number
                      currentUsageWithPrecision?: number
                      freeTrialExpiry?: string
                    }
                    bonuses?: Array<{
                      bonusCode?: string
                      displayName?: string
                      usageLimit?: number
                      usageLimitWithPrecision?: number
                      currentUsage?: number
                      currentUsageWithPrecision?: number
                      expiresAt?: string
                      status?: string
                    }>
                  }
                  interface UsageResponse {
                    usageBreakdownList?: UsageBreakdownItem[]
                    nextDateReset?: string
                    subscriptionInfo?: {
                      subscriptionTitle?: string
                      type?: string
                    }
                  }
                  console.log(
                    `[BackgroundRefresh] Account ${account.id} machineId: ${account.machineId || 'undefined'}`
                  )
                  const rawUsage = (await getUsageAndLimits(
                    newAccessToken,
                    idp,
                    undefined,
                    account.machineId,
                    region
                  )) as UsageResponse

                  // 解析使用量数据
                  const creditUsage = rawUsage.usageBreakdownList?.find(
                    (b) => b.resourceType === 'CREDIT'
                  )
                  const baseCurrent =
                    creditUsage?.currentUsageWithPrecision ?? creditUsage?.currentUsage ?? 0
                  const baseLimit =
                    creditUsage?.usageLimitWithPrecision ?? creditUsage?.usageLimit ?? 0
                  let freeTrialCurrent = 0
                  let freeTrialLimit = 0
                  let freeTrialExpiry: string | undefined
                  if (creditUsage?.freeTrialInfo?.freeTrialStatus === 'ACTIVE') {
                    freeTrialCurrent =
                      creditUsage.freeTrialInfo.currentUsageWithPrecision ??
                      creditUsage.freeTrialInfo.currentUsage ??
                      0
                    freeTrialLimit =
                      creditUsage.freeTrialInfo.usageLimitWithPrecision ??
                      creditUsage.freeTrialInfo.usageLimit ??
                      0
                    freeTrialExpiry = creditUsage.freeTrialInfo.freeTrialExpiry
                  }
                  const bonuses: Array<{
                    code: string
                    name: string
                    current: number
                    limit: number
                    expiresAt?: string
                  }> = []
                  if (creditUsage?.bonuses) {
                    for (const bonus of creditUsage.bonuses) {
                      if (bonus.status === 'ACTIVE') {
                        bonuses.push({
                          code: bonus.bonusCode || '',
                          name: bonus.displayName || '',
                          current: bonus.currentUsageWithPrecision ?? bonus.currentUsage ?? 0,
                          limit: bonus.usageLimitWithPrecision ?? bonus.usageLimit ?? 0,
                          expiresAt: bonus.expiresAt
                        })
                      }
                    }
                  }
                  const totalLimit =
                    baseLimit + freeTrialLimit + bonuses.reduce((sum, b) => sum + b.limit, 0)
                  const totalCurrent =
                    baseCurrent + freeTrialCurrent + bonuses.reduce((sum, b) => sum + b.current, 0)

                  parsedUsage = {
                    current: totalCurrent,
                    limit: totalLimit,
                    baseCurrent,
                    baseLimit,
                    freeTrialCurrent,
                    freeTrialLimit,
                    freeTrialExpiry,
                    bonuses,
                    nextResetDate: rawUsage.nextDateReset
                  }

                  // 解析订阅信息（注意检查顺序：先检查更具体的类型）
                  const subscriptionTitle = rawUsage.subscriptionInfo?.subscriptionTitle || 'Free'
                  let subscriptionType = 'Free'
                  const titleUpper = subscriptionTitle.toUpperCase()
                  if (
                    titleUpper.includes('PRO+') ||
                    titleUpper.includes('PRO_PLUS') ||
                    titleUpper.includes('PROPLUS')
                  ) {
                    subscriptionType = 'Pro_Plus'
                  } else if (titleUpper.includes('POWER')) {
                    subscriptionType = 'Enterprise'
                  } else if (titleUpper.includes('PRO')) {
                    subscriptionType = 'Pro'
                  } else if (titleUpper.includes('ENTERPRISE')) {
                    subscriptionType = 'Enterprise'
                  } else if (titleUpper.includes('TEAMS')) {
                    subscriptionType = 'Teams'
                  }

                  // 计算剩余天数和到期时间
                  let daysRemaining: number | undefined
                  let expiresAt: number | undefined
                  if (rawUsage.nextDateReset) {
                    expiresAt = new Date(rawUsage.nextDateReset).getTime()
                    daysRemaining = Math.max(
                      0,
                      Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24))
                    )
                  }

                  subscriptionData = {
                    type: subscriptionType,
                    title: subscriptionTitle,
                    daysRemaining,
                    expiresAt
                  }
                } catch (apiError) {
                  const errMsg = apiError instanceof Error ? apiError.message : String(apiError)
                  console.log(`[BackgroundRefresh] Usage API error for ${account.id}:`, errMsg)
                  if (errMsg.includes('AccountSuspendedException') || errMsg.includes('423')) {
                    status = 'error'
                    errorMessage = errMsg
                  }
                }

                // 调用 GetUserInfo API 获取用户状态
                try {
                  userInfoData = await getUserInfo(newAccessToken, idp, account.machineId)
                } catch (apiError) {
                  const errMsg = apiError instanceof Error ? apiError.message : String(apiError)
                  if (errMsg.includes('AccountSuspendedException') || errMsg.includes('423')) {
                    status = 'error'
                    errorMessage = errMsg
                  }
                }
              }

              success++
              completed++

              // 通知渲染进程更新账号
              mainWindow?.webContents.send('background-refresh-result', {
                id: account.id,
                success: true,
                data: {
                  accessToken: newAccessToken,
                  refreshToken: newRefreshToken,
                  expiresIn: newExpiresIn,
                  usage: parsedUsage,
                  subscription: subscriptionData,
                  userInfo: syncInfo ? userInfoData : undefined,
                  status,
                  errorMessage
                }
              })
            } catch (e) {
              failed++
              completed++
              mainWindow?.webContents.send('background-refresh-result', {
                id: account.id,
                success: false,
                error: e instanceof Error ? e.message : 'Unknown error'
              })
            }
          })
        )

        // 通知进度
        mainWindow?.webContents.send('background-refresh-progress', {
          completed,
          total: accounts.length,
          success,
          failed
        })

        // 批次间延迟，让主进程有喘息时间
        if (i + concurrency < accounts.length) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }

      console.log(`[BackgroundRefresh] Completed: ${success} success, ${failed} failed`)
      return { success: true, completed, successCount: success, failedCount: failed }
    }
  )

  // IPC: 后台批量检查账号状态（不刷新 Token，只检查状态）
  ipcMain.handle(
    'background-batch-check',
    async (
      _event,
      accounts: Array<{
        id: string
        email: string
        credentials: {
          accessToken: string
          refreshToken?: string
          clientId?: string
          clientSecret?: string
          region?: string
          authMethod?: string
          provider?: string
        }
        idp?: string
      }>,
      concurrency: number = 10
    ) => {
      console.log(
        `[BackgroundCheck] Starting batch check for ${accounts.length} accounts, concurrency: ${concurrency}`
      )

      let completed = 0
      let success = 0
      let failed = 0

      // 串行处理每批
      for (let i = 0; i < accounts.length; i += concurrency) {
        const batch = accounts.slice(i, i + concurrency)

        await Promise.allSettled(
          batch.map(async (account) => {
            try {
              const { accessToken, authMethod, provider } = account.credentials

              if (!accessToken) {
                failed++
                completed++
                mainWindow?.webContents.send('background-check-result', {
                  id: account.id,
                  success: false,
                  error: '缺少 accessToken'
                })
                return
              }

              // 确定 idp
              let idp = account.idp || 'BuilderId'
              if (authMethod === 'social' && provider) {
                idp = provider
              }

              // 调用 API 获取用量和用户信息（根据配置选择 REST 或 CBOR 格式）
              const [usageRes, userInfoRes] = await Promise.allSettled([
                getUsageAndLimits(
                  accessToken,
                  idp,
                  undefined,
                  undefined,
                  account.credentials?.region
                ) as Promise<{
                  usageBreakdownList?: Array<{
                    resourceType?: string
                    displayName?: string
                    usageLimit?: number
                    usageLimitWithPrecision?: number
                    currentUsage?: number
                    currentUsageWithPrecision?: number
                    freeTrialInfo?: {
                      freeTrialStatus?: string
                      usageLimit?: number
                      usageLimitWithPrecision?: number
                      currentUsage?: number
                      currentUsageWithPrecision?: number
                      freeTrialExpiry?: string
                    }
                    bonuses?: Array<{
                      bonusCode?: string
                      displayName?: string
                      usageLimit?: number
                      usageLimitWithPrecision?: number
                      currentUsage?: number
                      currentUsageWithPrecision?: number
                      expiresAt?: string
                      status?: string
                    }>
                  }>
                  nextDateReset?: string
                  subscriptionInfo?: {
                    subscriptionTitle?: string
                    type?: string
                  }
                  userInfo?: {
                    email?: string
                    userId?: string
                  }
                }>,
                thirdPartyApiRequest<{
                  email?: string
                  userId?: string
                  status?: string
                  idp?: string
                }>('GetUserInfo', { origin: 'THIRD_PARTY_IDE' }, accessToken, idp).catch(() => null)
              ])

              // 解析响应（thirdPartyApiRequest 直接返回数据或抛出异常）
              let usageData: {
                current: number
                limit: number
                baseCurrent?: number
                baseLimit?: number
                freeTrialCurrent?: number
                freeTrialLimit?: number
                freeTrialExpiry?: string
                bonuses?: Array<{
                  code: string
                  name: string
                  current: number
                  limit: number
                  expiresAt?: string
                }>
                nextResetDate?: string
              } | null = null
              let subscriptionData: {
                type: string
                title: string
                daysRemaining?: number
                expiresAt?: number
              } | null = null
              let userInfoData: {
                email?: string
                userId?: string
                status?: string
              } | null = null
              let status = 'active'
              let errorMessage: string | undefined

              // 处理用量响应
              if (usageRes.status === 'fulfilled') {
                const rawUsage = usageRes.value
                // 解析 Credits 使用量（和单个检查一致）
                const creditUsage = rawUsage.usageBreakdownList?.find(
                  (b) => b.resourceType === 'CREDIT' || b.displayName === 'Credits'
                )

                const baseCurrent =
                  creditUsage?.currentUsageWithPrecision ?? creditUsage?.currentUsage ?? 0
                const baseLimit =
                  creditUsage?.usageLimitWithPrecision ?? creditUsage?.usageLimit ?? 0
                let freeTrialCurrent = 0
                let freeTrialLimit = 0
                let freeTrialExpiry: string | undefined
                if (creditUsage?.freeTrialInfo?.freeTrialStatus === 'ACTIVE') {
                  freeTrialLimit =
                    creditUsage.freeTrialInfo.usageLimitWithPrecision ??
                    creditUsage.freeTrialInfo.usageLimit ??
                    0
                  freeTrialCurrent =
                    creditUsage.freeTrialInfo.currentUsageWithPrecision ??
                    creditUsage.freeTrialInfo.currentUsage ??
                    0
                  freeTrialExpiry = creditUsage.freeTrialInfo.freeTrialExpiry
                }

                // 解析 bonuses
                const bonuses: Array<{
                  code: string
                  name: string
                  current: number
                  limit: number
                  expiresAt?: string
                }> = []
                if (creditUsage?.bonuses) {
                  for (const bonus of creditUsage.bonuses) {
                    if (bonus.status === 'ACTIVE') {
                      bonuses.push({
                        code: bonus.bonusCode || '',
                        name: bonus.displayName || '',
                        current: bonus.currentUsageWithPrecision ?? bonus.currentUsage ?? 0,
                        limit: bonus.usageLimitWithPrecision ?? bonus.usageLimit ?? 0,
                        expiresAt: bonus.expiresAt
                      })
                    }
                  }
                }

                const totalLimit =
                  baseLimit + freeTrialLimit + bonuses.reduce((sum, b) => sum + b.limit, 0)
                const totalCurrent =
                  baseCurrent + freeTrialCurrent + bonuses.reduce((sum, b) => sum + b.current, 0)

                usageData = {
                  current: totalCurrent,
                  limit: totalLimit,
                  baseCurrent,
                  baseLimit,
                  freeTrialCurrent,
                  freeTrialLimit,
                  freeTrialExpiry,
                  bonuses,
                  nextResetDate: rawUsage.nextDateReset
                }

                // 解析订阅信息（注意检查顺序：先检查更具体的类型）
                const subscriptionTitle = rawUsage.subscriptionInfo?.subscriptionTitle ?? 'Free'
                let subscriptionType = 'Free'
                const titleUpper = subscriptionTitle.toUpperCase()
                if (
                  titleUpper.includes('PRO+') ||
                  titleUpper.includes('PRO_PLUS') ||
                  titleUpper.includes('PROPLUS')
                ) {
                  subscriptionType = 'Pro_Plus'
                } else if (titleUpper.includes('POWER')) {
                  subscriptionType = 'Enterprise'
                } else if (titleUpper.includes('PRO')) {
                  subscriptionType = 'Pro'
                } else if (titleUpper.includes('ENTERPRISE')) {
                  subscriptionType = 'Enterprise'
                } else if (titleUpper.includes('TEAMS')) {
                  subscriptionType = 'Teams'
                }

                // 计算剩余天数和到期时间
                let daysRemaining: number | undefined
                let expiresAt: number | undefined
                if (rawUsage.nextDateReset) {
                  expiresAt = new Date(rawUsage.nextDateReset).getTime()
                  daysRemaining = Math.max(
                    0,
                    Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24))
                  )
                }

                subscriptionData = {
                  type: subscriptionType,
                  title: subscriptionTitle,
                  daysRemaining,
                  expiresAt
                }
              } else if (usageRes.status === 'rejected') {
                // API 调用失败（可能是封禁或 Token 过期）
                const errorMsg = usageRes.reason?.message || String(usageRes.reason)
                console.log(`[BackgroundCheck] Usage API failed for ${account.email}:`, errorMsg)
                if (errorMsg.includes('AccountSuspendedException') || errorMsg.includes('423')) {
                  status = 'error'
                  errorMessage = errorMsg
                } else if (errorMsg.includes('401')) {
                  status = 'expired'
                  errorMessage = 'Token 已过期，请刷新'
                } else {
                  status = 'error'
                  errorMessage = errorMsg
                }
              }

              // 处理用户信息响应
              if (userInfoRes.status === 'fulfilled' && userInfoRes.value) {
                const rawUserInfo = userInfoRes.value
                userInfoData = {
                  email: rawUserInfo.email,
                  userId: rawUserInfo.userId,
                  status: rawUserInfo.status
                }
                // 检查用户状态（Stale 视为正常，仅 Suspended/Disabled 等视为异常）
                if (
                  rawUserInfo.status &&
                  rawUserInfo.status !== 'Active' &&
                  rawUserInfo.status !== 'Stale' &&
                  status !== 'error'
                ) {
                  status = 'error'
                  errorMessage = `用户状态异常: ${rawUserInfo.status}`
                }
              }

              success++
              completed++

              // 通知渲染进程更新账号
              mainWindow?.webContents.send('background-check-result', {
                id: account.id,
                success: true,
                data: {
                  usage: usageData,
                  subscription: subscriptionData,
                  userInfo: userInfoData,
                  status,
                  errorMessage
                }
              })
            } catch (e) {
              failed++
              completed++
              mainWindow?.webContents.send('background-check-result', {
                id: account.id,
                success: false,
                error: e instanceof Error ? e.message : 'Unknown error'
              })
            }
          })
        )

        // 通知进度
        mainWindow?.webContents.send('background-check-progress', {
          completed,
          total: accounts.length,
          success,
          failed
        })

        // 批次间延迟
        if (i + concurrency < accounts.length) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }

      console.log(`[BackgroundCheck] Completed: ${success} success, ${failed} failed`)
      return { success: true, completed, successCount: success, failedCount: failed }
    }
  )

  // IPC: 导出到文件
  ipcMain.handle('export-to-file', async (_event, data: string, filename: string) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: '导出账号数据',
        defaultPath: filename,
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      })

      if (!result.canceled && result.filePath) {
        await writeFile(result.filePath, data, 'utf-8')
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to export:', error)
      return false
    }
  })

  // IPC: 从文件导入
  ipcMain.handle('import-from-file', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: '导入账号数据',
        filters: [
          { name: '所有支持的格式', extensions: ['json', 'csv', 'txt'] },
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'TXT Files', extensions: ['txt'] }
        ],
        properties: ['openFile']
      })

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0]
        const content = await readFile(filePath, 'utf-8')
        const ext = filePath.split('.').pop()?.toLowerCase() || 'json'
        return { content, format: ext }
      }
      return null
    } catch (error) {
      console.error('Failed to import:', error)
      return null
    }
  })

  // IPC: 验证凭证并获取账号信息（用于添加账号）
  ipcMain.handle(
    'verify-account-credentials',
    async (
      _event,
      credentials: {
        refreshToken: string
        clientId: string
        clientSecret: string
        region?: string
        authMethod?: string
        provider?: string // 'BuilderId', 'Github', 'Google' 等
      }
    ) => {
      console.log('[IPC] verify-account-credentials called')

      try {
        const {
          refreshToken,
          clientId,
          clientSecret,
          region = 'us-east-1',
          authMethod,
          provider
        } = credentials
        // 确定 idp：社交登录使用 provider，IdC 也需要根据 provider 区分 BuilderId 和 Enterprise
        const idp =
          provider && (provider === 'Enterprise' || provider === 'Github' || provider === 'Google')
            ? provider
            : 'BuilderId'

        // 社交登录只需要 refreshToken，IdC 需要 clientId 和 clientSecret
        if (!refreshToken) {
          return { success: false, error: '请填写 Refresh Token' }
        }
        if (authMethod !== 'social' && (!clientId || !clientSecret)) {
          return { success: false, error: '请填写 Client ID 和 Client Secret' }
        }

        // Step 1: 使用合适的方式刷新获取 accessToken
        console.log(`[Verify] Step 1: Refreshing token (authMethod: ${authMethod || 'IdC'})...`)
        const refreshResult = await refreshTokenByMethod(
          refreshToken,
          clientId,
          clientSecret,
          region,
          authMethod
        )

        if (!refreshResult.success || !refreshResult.accessToken) {
          return { success: false, error: `Token 刷新失败: ${refreshResult.error}` }
        }

        console.log('[Verify] Step 2: Getting user info...')

        // Step 2: 调用 GetUserUsageAndLimits 获取用户信息
        interface Bonus {
          bonusCode?: string
          displayName?: string
          usageLimit?: number
          usageLimitWithPrecision?: number
          currentUsage?: number
          currentUsageWithPrecision?: number
          status?: string
          expiresAt?: string // API 返回的是 expiresAt
        }

        interface FreeTrialInfo {
          usageLimit?: number
          usageLimitWithPrecision?: number
          currentUsage?: number
          currentUsageWithPrecision?: number
          freeTrialStatus?: string
          freeTrialExpiry?: string
        }

        interface UsageBreakdown {
          usageLimit?: number
          usageLimitWithPrecision?: number
          currentUsage?: number
          currentUsageWithPrecision?: number
          resourceType?: string
          displayName?: string
          displayNamePlural?: string
          currency?: string
          unit?: string
          overageRate?: number
          overageCap?: number
          bonuses?: Bonus[]
          freeTrialInfo?: FreeTrialInfo
        }

        interface UsageResponse {
          nextDateReset?: string
          usageBreakdownList?: UsageBreakdown[]
          subscriptionInfo?: {
            subscriptionTitle?: string
            type?: string
            subscriptionManagementTarget?: string
            upgradeCapability?: string
            overageCapability?: string
          }
          overageConfiguration?: { overageEnabled?: boolean }
          userInfo?: { email?: string; userId?: string }
        }

        const usageResult = (await getUsageAndLimits(
          refreshResult.accessToken,
          idp,
          undefined,
          undefined,
          region
        )) as UsageResponse

        // 解析用户信息
        const email = usageResult.userInfo?.email || ''
        const userId = usageResult.userInfo?.userId || ''

        // 解析订阅类型（注意检查顺序：先检查更具体的类型）
        const subscriptionTitle = usageResult.subscriptionInfo?.subscriptionTitle || 'Free'
        let subscriptionType = 'Free'
        const titleUpper = subscriptionTitle.toUpperCase()
        if (
          titleUpper.includes('PRO+') ||
          titleUpper.includes('PRO_PLUS') ||
          titleUpper.includes('PROPLUS')
        ) {
          subscriptionType = 'Pro_Plus'
        } else if (titleUpper.includes('POWER')) {
          subscriptionType = 'Enterprise'
        } else if (titleUpper.includes('PRO')) {
          subscriptionType = 'Pro'
        } else if (titleUpper.includes('ENTERPRISE')) {
          subscriptionType = 'Enterprise'
        } else if (titleUpper.includes('TEAMS')) {
          subscriptionType = 'Teams'
        }

        // 解析使用量（详细，使用精确小数）
        const creditUsage = usageResult.usageBreakdownList?.find((b) => b.resourceType === 'CREDIT')

        // 基础额度
        const baseLimit = creditUsage?.usageLimitWithPrecision ?? creditUsage?.usageLimit ?? 0
        const baseCurrent = creditUsage?.currentUsageWithPrecision ?? creditUsage?.currentUsage ?? 0

        // 试用额度
        let freeTrialLimit = 0
        let freeTrialCurrent = 0
        let freeTrialExpiry: string | undefined
        if (creditUsage?.freeTrialInfo?.freeTrialStatus === 'ACTIVE') {
          freeTrialLimit =
            creditUsage.freeTrialInfo.usageLimitWithPrecision ??
            creditUsage.freeTrialInfo.usageLimit ??
            0
          freeTrialCurrent =
            creditUsage.freeTrialInfo.currentUsageWithPrecision ??
            creditUsage.freeTrialInfo.currentUsage ??
            0
          freeTrialExpiry = creditUsage.freeTrialInfo.freeTrialExpiry
        }

        // 奖励额度
        const bonuses: {
          code: string
          name: string
          current: number
          limit: number
          expiresAt?: string
        }[] = []
        if (creditUsage?.bonuses) {
          for (const bonus of creditUsage.bonuses) {
            if (bonus.status === 'ACTIVE') {
              bonuses.push({
                code: bonus.bonusCode || '',
                name: bonus.displayName || '',
                current: bonus.currentUsageWithPrecision ?? bonus.currentUsage ?? 0,
                limit: bonus.usageLimitWithPrecision ?? bonus.usageLimit ?? 0,
                expiresAt: bonus.expiresAt
              })
            }
          }
        }

        // 计算总额度
        const totalLimit = baseLimit + freeTrialLimit + bonuses.reduce((sum, b) => sum + b.limit, 0)
        const totalUsed =
          baseCurrent + freeTrialCurrent + bonuses.reduce((sum, b) => sum + b.current, 0)

        // 计算重置剩余天数
        let daysRemaining: number | undefined
        let expiresAt: number | undefined
        const nextResetDate = usageResult.nextDateReset
        if (nextResetDate) {
          expiresAt = new Date(nextResetDate).getTime()
          daysRemaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24)))
        }

        console.log('[Verify] Success! Email:', email)

        return {
          success: true,
          data: {
            email,
            userId,
            accessToken: refreshResult.accessToken,
            refreshToken: refreshResult.refreshToken || refreshToken,
            expiresIn: refreshResult.expiresIn,
            subscriptionType,
            subscriptionTitle,
            subscription: {
              rawType: usageResult.subscriptionInfo?.type,
              managementTarget: usageResult.subscriptionInfo?.subscriptionManagementTarget,
              upgradeCapability: usageResult.subscriptionInfo?.upgradeCapability,
              overageCapability: usageResult.subscriptionInfo?.overageCapability
            },
            usage: {
              current: totalUsed,
              limit: totalLimit,
              baseLimit,
              baseCurrent,
              freeTrialLimit,
              freeTrialCurrent,
              freeTrialExpiry,
              bonuses,
              nextResetDate,
              resourceDetail: creditUsage
                ? {
                    displayName: creditUsage.displayName,
                    displayNamePlural: creditUsage.displayNamePlural,
                    resourceType: creditUsage.resourceType,
                    currency: creditUsage.currency,
                    unit: creditUsage.unit,
                    overageRate: creditUsage.overageRate,
                    overageCap: creditUsage.overageCap,
                    overageEnabled: usageResult.overageConfiguration?.overageEnabled
                  }
                : undefined
            },
            daysRemaining,
            expiresAt
          }
        }
      } catch (error) {
        console.error('[Verify] Error:', error)
        return { success: false, error: error instanceof Error ? error.message : '验证失败' }
      }
    }
  )

  // IPC: 获取本地 SSO 缓存中当前使用的账号信息 - 已禁用
  ipcMain.handle('get-local-active-account', async () => {
    return { success: false, error: '功能已禁用' }
  })

  // IPC: 从第三方本地配置导入凭证
  ipcMain.handle('load-third-party-credentials', async () => {
    const os = await import('os')
    const path = await import('path')
    const crypto = await import('crypto')
    const fs = await import('fs/promises')

    try {
      // 从 ~/.aws/sso/cache/third-party-auth-token.json 读取 token
      const ssoCache = path.join(os.homedir(), '.aws', 'sso', 'cache')
      const tokenPath = path.join(ssoCache, 'third-party-auth-token.json')
      console.log('[ThirdParty Credentials] Reading token from:', tokenPath)

      let tokenData: {
        accessToken?: string
        refreshToken?: string
        clientIdHash?: string
        region?: string
        authMethod?: string
        provider?: string
      }

      try {
        const tokenContent = await readFile(tokenPath, 'utf-8')
        tokenData = JSON.parse(tokenContent)
      } catch {
        return {
          success: false,
          error: '找不到 third-party-auth-token.json 文件，请先在对应应用中登录'
        }
      }

      if (!tokenData.refreshToken) {
        return { success: false, error: 'third-party-auth-token.json 中缺少 refreshToken' }
      }

      // 确定 clientIdHash：优先使用文件中的，否则计算默认值
      let clientIdHash = tokenData.clientIdHash
      if (!clientIdHash) {
        // 使用标准的 startUrl 计算 hash
        const startUrl = 'https://view.awsapps.com/start'
        clientIdHash = crypto.createHash('sha1').update(JSON.stringify({ startUrl })).digest('hex')
        console.log('[ThirdParty Credentials] Calculated clientIdHash:', clientIdHash)
      }

      // 读取客户端注册信息
      const clientRegPath = path.join(ssoCache, `${clientIdHash}.json`)
      console.log('[ThirdParty Credentials] Trying client registration from:', clientRegPath)

      let clientData: {
        clientId?: string
        clientSecret?: string
      } | null = null

      try {
        const clientContent = await readFile(clientRegPath, 'utf-8')
        clientData = JSON.parse(clientContent)
      } catch {
        // 如果找不到，尝试搜索目录中的其他 .json 文件（排除 third-party-auth-token.json）
        console.log('[ThirdParty Credentials] Client file not found, searching cache directory...')
        try {
          const files = await fs.readdir(ssoCache)
          for (const file of files) {
            if (file.endsWith('.json') && file !== 'third-party-auth-token.json') {
              try {
                const content = await readFile(path.join(ssoCache, file), 'utf-8')
                const data = JSON.parse(content)
                if (data.clientId && data.clientSecret) {
                  clientData = data
                  console.log('[ThirdParty Credentials] Found client registration in:', file)
                  break
                }
              } catch {
                // 忽略无法解析的文件
              }
            }
          }
        } catch {
          // 忽略目录读取错误
        }
      }

      // 社交登录不需要 clientId/clientSecret
      const isSocialAuth = tokenData.authMethod === 'social'

      if (!isSocialAuth && (!clientData || !clientData.clientId || !clientData.clientSecret)) {
        return { success: false, error: '找不到客户端注册文件，请确保已在对应应用中完成登录' }
      }

      console.log(
        `[ThirdParty Credentials] Successfully loaded credentials (authMethod: ${tokenData.authMethod || 'IdC'})`
      )

      return {
        success: true,
        data: {
          accessToken: tokenData.accessToken || '',
          refreshToken: tokenData.refreshToken,
          clientId: clientData?.clientId || '',
          clientSecret: clientData?.clientSecret || '',
          region: tokenData.region || 'us-east-1',
          authMethod: tokenData.authMethod || 'IdC',
          provider: tokenData.provider || 'BuilderId'
        }
      }
    } catch (error) {
      console.error('[ThirdParty Credentials] Error:', error)
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  // IPC: 切换账号 - 已禁用
  ipcMain.handle('switch-account', async (_event, _credentials) => {
    return { success: false, error: '功能已禁用' }
  })

  // IPC: 退出登录 - 已禁用
  ipcMain.handle('logout-account', async () => {
    return { success: false, error: '功能已禁用' }
  })

  // ============ 手动登录相关 IPC ============

  // 存储当前登录状态
  let currentLoginState: {
    type: 'builderid' | 'social' | 'iamsso'
    // BuilderId / IAM SSO 相关
    clientId?: string
    clientSecret?: string
    deviceCode?: string
    userCode?: string
    verificationUri?: string
    interval?: number
    expiresAt?: number
    startUrl?: string // IAM SSO 专用
    redirectUri?: string // IAM SSO Authorization Code flow
    region?: string // IAM SSO region
    // Social Auth 相关
    codeVerifier?: string
    codeChallenge?: string
    oauthState?: string
    provider?: string
  } | null = null

  // IPC: 启动 Builder ID 手动登录
  ipcMain.handle('start-builder-id-login', async (_event, region: string = 'us-east-1') => {
    console.log('[Login] Starting Builder ID login...')

    const oidcBase = `https://oidc.${region}.amazonaws.com`
    const startUrl = 'https://view.awsapps.com/start'
    const scopes = [
      'codewhisperer:completions',
      'codewhisperer:analysis',
      'codewhisperer:conversations',
      'codewhisperer:transformations',
      'codewhisperer:taskassist'
    ]

    try {
      // Step 1: 注册 OIDC 客户端
      console.log('[Login] Step 1: Registering OIDC client...')
      const regRes = await fetch(`${oidcBase}/client/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: 'Electron Sqlite Rest Boilerplate',
          clientType: 'public',
          scopes,
          grantTypes: ['urn:ietf:params:oauth:grant-type:device_code', 'refresh_token'],
          issuerUrl: startUrl
        })
      })

      if (!regRes.ok) {
        const errText = await regRes.text()
        return { success: false, error: `注册客户端失败: ${errText}` }
      }

      const regData = await regRes.json()
      const clientId = regData.clientId
      const clientSecret = regData.clientSecret
      console.log('[Login] Client registered:', clientId.substring(0, 30) + '...')

      // Step 2: 发起设备授权
      console.log('[Login] Step 2: Starting device authorization...')
      const authRes = await fetch(`${oidcBase}/device_authorization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret, startUrl })
      })

      if (!authRes.ok) {
        const errText = await authRes.text()
        return { success: false, error: `设备授权失败: ${errText}` }
      }

      const authData = await authRes.json()
      const {
        deviceCode,
        userCode,
        verificationUri,
        verificationUriComplete,
        interval = 5,
        expiresIn = 600
      } = authData
      console.log('[Login] Device code obtained, user_code:', userCode)

      // 保存登录状态
      currentLoginState = {
        type: 'builderid',
        clientId,
        clientSecret,
        deviceCode,
        userCode,
        verificationUri,
        interval,
        expiresAt: Date.now() + expiresIn * 1000
      }

      return {
        success: true,
        userCode,
        verificationUri: verificationUriComplete || verificationUri,
        expiresIn,
        interval
      }
    } catch (error) {
      console.error('[Login] Error:', error)
      return { success: false, error: error instanceof Error ? error.message : '登录失败' }
    }
  })

  // IPC: 轮询 Builder ID 授权状态
  ipcMain.handle('poll-builder-id-auth', async (_event, region: string = 'us-east-1') => {
    console.log('[Login] Polling for authorization...')

    if (!currentLoginState || currentLoginState.type !== 'builderid') {
      return { success: false, error: '没有进行中的登录' }
    }

    if (Date.now() > (currentLoginState.expiresAt || 0)) {
      currentLoginState = null
      return { success: false, error: '授权已过期，请重新开始' }
    }

    const oidcBase = `https://oidc.${region}.amazonaws.com`
    const { clientId, clientSecret, deviceCode } = currentLoginState

    try {
      const tokenRes = await fetch(`${oidcBase}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          clientSecret,
          grantType: 'urn:ietf:params:oauth:grant-type:device_code',
          deviceCode
        })
      })

      if (tokenRes.status === 200) {
        const tokenData = await tokenRes.json()
        console.log('[Login] Authorization successful!')

        const result = {
          success: true,
          completed: true,
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          clientId,
          clientSecret,
          region,
          expiresIn: tokenData.expiresIn
        }

        currentLoginState = null
        return result
      } else if (tokenRes.status === 400) {
        const errData = await tokenRes.json()
        const error = errData.error

        if (error === 'authorization_pending') {
          return { success: true, completed: false, status: 'pending' }
        } else if (error === 'slow_down') {
          if (currentLoginState) {
            currentLoginState.interval = (currentLoginState.interval || 5) + 5
          }
          return { success: true, completed: false, status: 'slow_down' }
        } else if (error === 'expired_token') {
          currentLoginState = null
          return { success: false, error: '设备码已过期' }
        } else if (error === 'access_denied') {
          currentLoginState = null
          return { success: false, error: '用户拒绝授权' }
        } else {
          currentLoginState = null
          return { success: false, error: `授权错误: ${error}` }
        }
      } else {
        return { success: false, error: `未知响应: ${tokenRes.status}` }
      }
    } catch (error) {
      console.error('[Login] Poll error:', error)
      return { success: false, error: error instanceof Error ? error.message : '轮询失败' }
    }
  })

  // IPC: 取消 Builder ID 登录
  ipcMain.handle('cancel-builder-id-login', async () => {
    console.log('[Login] Cancelling Builder ID login...')
    currentLoginState = null
    return { success: true }
  })

  // IAM SSO 本地服务器和状态
  let iamSsoServer: ReturnType<typeof import('http').createServer> | null = null
  let iamSsoResult: {
    completed: boolean
    success: boolean
    accessToken?: string
    refreshToken?: string
    clientId?: string
    clientSecret?: string
    region?: string
    expiresIn?: number
    error?: string
  } | null = null

  // IPC: 启动 IAM Identity Center SSO 登录 (使用 Authorization Code Grant with PKCE)
  ipcMain.handle(
    'start-iam-sso-login',
    async (_event, startUrl: string, region: string = 'us-east-1') => {
      console.log('[Login] Starting IAM Identity Center SSO login (Authorization Code flow)...')
      console.log('[Login] Start URL:', startUrl)

      // 验证 startUrl 格式
      if (!startUrl || !startUrl.startsWith('https://')) {
        return { success: false, error: 'SSO Start URL 必须以 https:// 开头' }
      }

      const crypto = await import('crypto')
      const http = await import('http')

      const oidcBase = `https://oidc.${region}.amazonaws.com`
      const scopes = [
        'codewhisperer:completions',
        'codewhisperer:analysis',
        'codewhisperer:conversations',
        'codewhisperer:transformations',
        'codewhisperer:taskassist'
      ]

      try {
        // Step 1: 注册 OIDC 客户端 (使用 authorization_code grant type)
        console.log('[Login] Step 1: Registering OIDC client...')
        const regRes = await fetch(`${oidcBase}/client/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: 'Electron Sqlite Rest Boilerplate',
            clientType: 'public',
            scopes,
            grantTypes: ['authorization_code', 'refresh_token'],
            redirectUris: ['http://127.0.0.1/oauth/callback'],
            issuerUrl: startUrl
          })
        })

        if (!regRes.ok) {
          const errText = await regRes.text()
          console.error('[Login] IAM SSO client registration failed:', regRes.status, errText)

          if (errText.includes('UnauthorizedException') || errText.includes('access denied')) {
            return {
              success: false,
              error:
                '授权失败：您的组织可能未配置 Amazon Q Developer 访问权限。请联系组织管理员在 IAM Identity Center 中启用相关权限。'
            }
          }

          return { success: false, error: `注册客户端失败: ${errText}` }
        }

        const regData = await regRes.json()
        const clientId = regData.clientId
        const clientSecret = regData.clientSecret
        console.log('[Login] Client registered:', clientId.substring(0, 30) + '...')

        // Step 2: 生成 PKCE 和 state
        const codeVerifier = crypto.randomBytes(32).toString('base64url')
        const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
        const state = crypto.randomUUID()

        // Step 3: 启动本地 HTTP 服务器接收回调
        console.log('[Login] Step 2: Starting local OAuth callback server...')

        // 关闭之前的服务器
        if (iamSsoServer) {
          iamSsoServer.close()
          iamSsoServer = null
        }

        // 找一个可用端口
        const port = await new Promise<number>((resolve, reject) => {
          const server = http.createServer()
          server.listen(0, '127.0.0.1', () => {
            const addr = server.address()
            if (addr && typeof addr === 'object') {
              const p = addr.port
              server.close(() => resolve(p))
            } else {
              reject(new Error('无法获取端口'))
            }
          })
        })

        const redirectUri = `http://127.0.0.1:${port}/oauth/callback`
        console.log('[Login] Redirect URI:', redirectUri)

        // 重置结果
        iamSsoResult = null

        // 创建回调服务器
        iamSsoServer = http.createServer(async (req, res) => {
          const url = new URL(req.url || '', `http://127.0.0.1:${port}`)

          if (url.pathname === '/oauth/callback') {
            const code = url.searchParams.get('code')
            const returnedState = url.searchParams.get('state')
            const error = url.searchParams.get('error')

            if (error) {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
              res.end('<html><body><h1>授权失败</h1><p>您可以关闭此窗口。</p></body></html>')
              iamSsoResult = { completed: true, success: false, error: `授权失败: ${error}` }
              return
            }

            if (returnedState !== state) {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
              res.end('<html><body><h1>授权失败</h1><p>状态不匹配，请重试。</p></body></html>')
              iamSsoResult = { completed: true, success: false, error: '状态不匹配' }
              return
            }

            if (code) {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
              res.end('<html><body><h1>授权成功！</h1><p>正在获取令牌，请稍候...</p></body></html>')

              // 自动完成 token 交换
              try {
                const tokenRes = await fetch(`${oidcBase}/token`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    clientId,
                    clientSecret,
                    grantType: 'authorization_code',
                    redirectUri,
                    code,
                    codeVerifier
                  })
                })

                if (!tokenRes.ok) {
                  const errText = await tokenRes.text()
                  console.error('[Login] Token exchange failed:', tokenRes.status, errText)
                  iamSsoResult = {
                    completed: true,
                    success: false,
                    error: `获取 Token 失败: ${errText}`
                  }
                } else {
                  const tokenData = await tokenRes.json()
                  console.log('[Login] IAM SSO Authorization successful!')
                  iamSsoResult = {
                    completed: true,
                    success: true,
                    accessToken: tokenData.accessToken,
                    refreshToken: tokenData.refreshToken,
                    clientId,
                    clientSecret,
                    region,
                    expiresIn: tokenData.expiresIn
                  }
                }
              } catch (tokenError) {
                console.error('[Login] Token exchange error:', tokenError)
                iamSsoResult = {
                  completed: true,
                  success: false,
                  error: tokenError instanceof Error ? tokenError.message : '获取 Token 失败'
                }
              }
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
              res.end('<html><body><h1>授权失败</h1><p>未收到授权码。</p></body></html>')
              iamSsoResult = { completed: true, success: false, error: '未收到授权码' }
            }
          } else {
            res.writeHead(404)
            res.end('Not Found')
          }
        })

        iamSsoServer.listen(port, '127.0.0.1', () => {
          console.log('[Login] OAuth callback server listening on port', port)
        })

        // Step 4: 构建授权 URL 并打开浏览器
        const authorizeParams = new URLSearchParams({
          response_type: 'code',
          client_id: clientId,
          redirect_uri: redirectUri,
          scopes: scopes.join(','),
          state: state,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256'
        })
        const authorizeUrl = `${oidcBase}/authorize?${authorizeParams.toString()}`
        console.log('[Login] Opening browser for authorization...')

        // 保存登录状态
        currentLoginState = {
          type: 'iamsso',
          clientId,
          clientSecret,
          codeVerifier,
          redirectUri,
          region,
          startUrl,
          expiresAt: Date.now() + 600000
        }

        // 返回授权 URL，前端会打开浏览器
        return {
          success: true,
          authorizeUrl,
          expiresIn: 600
        }
      } catch (error) {
        console.error('[Login] Error:', error)
        return { success: false, error: error instanceof Error ? error.message : '登录失败' }
      }
    }
  )

  // IPC: 轮询 IAM SSO 授权状态 (检查本地服务器是否收到回调)
  ipcMain.handle('poll-iam-sso-auth', async () => {
    if (!currentLoginState || currentLoginState.type !== 'iamsso') {
      return { success: false, error: '没有进行中的 IAM SSO 登录' }
    }

    if (Date.now() > (currentLoginState.expiresAt || 0)) {
      if (iamSsoServer) {
        iamSsoServer.close()
        iamSsoServer = null
      }
      iamSsoResult = null
      currentLoginState = null
      return { success: false, error: '授权已过期，请重新开始' }
    }

    // 检查是否已收到回调并完成 token 交换
    if (iamSsoResult) {
      const result = { ...iamSsoResult }
      if (result.completed) {
        // 清理状态
        if (iamSsoServer) {
          iamSsoServer.close()
          iamSsoServer = null
        }
        iamSsoResult = null
        currentLoginState = null
      }
      return result
    }

    // 还在等待回调
    return { success: true, completed: false, status: 'pending' }
  })

  // IPC: 取消 IAM SSO 登录
  ipcMain.handle('cancel-iam-sso-login', async () => {
    console.log('[Login] Cancelling IAM SSO login...')
    if (iamSsoServer) {
      iamSsoServer.close()
      iamSsoServer = null
    }
    iamSsoResult = null
    currentLoginState = null
    return { success: true }
  })

  // IPC: 启动 Social Auth 登录 (Google/GitHub)
  ipcMain.handle(
    'start-social-login',
    async (_event, provider: 'Google' | 'Github', usePrivateMode?: boolean) => {
      console.log(
        `[Login] Starting ${provider} Social Auth login... (privateMode: ${usePrivateMode})`
      )

      const crypto = await import('crypto')

      // 生成 PKCE
      const codeVerifier = crypto.randomBytes(64).toString('base64url').substring(0, 128)
      const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
      const oauthState = crypto.randomBytes(32).toString('base64url')

      // 构建登录 URL
      const redirectUri =
        'electron-sqlite-rest://electron-sqlite-rest.thirdPartyAgent/authenticate-success'
      const loginUrl = new URL(`${THIRD_PARTY_AUTH_ENDPOINT}/login`)
      loginUrl.searchParams.set('idp', provider)
      loginUrl.searchParams.set('redirect_uri', redirectUri)
      loginUrl.searchParams.set('code_challenge', codeChallenge)
      loginUrl.searchParams.set('code_challenge_method', 'S256')
      loginUrl.searchParams.set('state', oauthState)

      // 保存登录状态
      currentLoginState = {
        type: 'social',
        codeVerifier,
        codeChallenge,
        oauthState,
        provider
      }

      const urlStr = loginUrl.toString()
      console.log(`[Login] Opening browser for ${provider} login...`)

      // 根据是否使用隐私模式选择打开方式
      if (usePrivateMode) {
        openBrowserInPrivateMode(urlStr)
      } else {
        shell.openExternal(urlStr)
      }

      return {
        success: true,
        loginUrl: urlStr,
        state: oauthState
      }
    }
  )

  // IPC: 交换 Social Auth token
  ipcMain.handle('exchange-social-token', async (_event, code: string, state: string) => {
    console.log('[Login] Exchanging Social Auth token...')

    if (!currentLoginState || currentLoginState.type !== 'social') {
      return { success: false, error: '没有进行中的社交登录' }
    }

    // 验证 state
    if (state !== currentLoginState.oauthState) {
      currentLoginState = null
      return { success: false, error: '状态参数不匹配，可能存在安全风险' }
    }

    const { codeVerifier, provider } = currentLoginState
    const redirectUri =
      'electron-sqlite-rest://electron-sqlite-rest.thirdPartyAgent/authenticate-success'

    try {
      const tokenRes = await fetch(`${THIRD_PARTY_AUTH_ENDPOINT}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri
        })
      })

      if (!tokenRes.ok) {
        const errText = await tokenRes.text()
        currentLoginState = null
        return { success: false, error: `Token 交换失败: ${errText}` }
      }

      const tokenData = await tokenRes.json()
      console.log('[Login] Token exchange successful!')

      const result = {
        success: true,
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        profileArn: tokenData.profileArn,
        expiresIn: tokenData.expiresIn,
        authMethod: 'social' as const,
        provider
      }

      currentLoginState = null
      return result
    } catch (error) {
      console.error('[Login] Token exchange error:', error)
      currentLoginState = null
      return { success: false, error: error instanceof Error ? error.message : 'Token 交换失败' }
    }
  })

  // IPC: 取消 Social Auth 登录
  ipcMain.handle('cancel-social-login', async () => {
    console.log('[Login] Cancelling Social Auth login...')
    currentLoginState = null
    return { success: true }
  })

  // ============ 第三方设置管理 IPC ============

  // IPC: 获取第三方设置
  ipcMain.handle('get-third-party-settings', async () => {
    try {
      const os = await import('os')
      const fs = await import('fs')
      const path = await import('path')

      const homeDir = os.homedir()
      const settingsPath = path.join(
        homeDir,
        'AppData',
        'Roaming',
        'ElectronSQLiteRest',
        'User',
        'settings.json'
      )
      const steeringPath = path.join(homeDir, '.electron-sqlite-rest', 'steering')
      const mcpUserPath = path.join(homeDir, '.electron-sqlite-rest', 'settings', 'mcp.json')

      let settings = {}
      let mcpConfig = { mcpServers: {} }
      let steeringFiles: string[] = []

      // 读取 settings.json (VS Code 风格 JSON，可能有尾随逗号)
      if (fs.existsSync(settingsPath)) {
        const content = fs.readFileSync(settingsPath, 'utf-8')
        // 移除尾随逗号和注释以兼容标准 JSON
        const cleanedContent = content
          .replace(/\/\/.*$/gm, '') // 移除单行注释
          .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行注释
          .replace(/,(\s*[}\]])/g, '$1') // 移除尾随逗号
        const parsed = JSON.parse(cleanedContent)
        settings = {
          modelSelection: parsed['kiroAgent.modelSelection'],
          agentAutonomy: parsed['kiroAgent.agentAutonomy'],
          enableDebugLogs: parsed['kiroAgent.enableDebugLogs'],
          enableTabAutocomplete: parsed['kiroAgent.enableTabAutocomplete'],
          enableCodebaseIndexing: parsed['kiroAgent.enableCodebaseIndexing'],
          usageSummary: parsed['kiroAgent.usageSummary'],
          codeReferences: parsed['kiroAgent.codeReferences.referenceTracker'],
          configureMCP: parsed['kiroAgent.configureMCP'],
          trustedCommands: parsed['kiroAgent.trustedCommands'] || [],
          trustedTools: parsed['kiroAgent.trustedTools'] || {},
          commandDenylist: parsed['kiroAgent.commandDenylist'] || [],
          ignoreFiles: parsed['kiroAgent.ignoreFiles'] || [],
          mcpApprovedEnvVars: parsed['kiroAgent.mcpApprovedEnvVars'] || [],
          notificationsActionRequired: parsed['kiroAgent.notifications.agent.actionRequired'],
          notificationsFailure: parsed['kiroAgent.notifications.agent.failure'],
          notificationsSuccess: parsed['kiroAgent.notifications.agent.success'],
          notificationsBilling: parsed['kiroAgent.notifications.billing']
        }
      }

      // 读取 MCP 配置
      if (fs.existsSync(mcpUserPath)) {
        const mcpContent = fs.readFileSync(mcpUserPath, 'utf-8')
        mcpConfig = JSON.parse(mcpContent)
      }

      // 读取 Steering 文件列表
      if (fs.existsSync(steeringPath)) {
        const files = fs.readdirSync(steeringPath)
        steeringFiles = files.filter((f) => f.endsWith('.md'))
        console.log('[ThirdPartySettings] Steering path:', steeringPath)
        console.log('[ThirdPartySettings] Found steering files:', steeringFiles)
      } else {
        console.log('[ThirdPartySettings] Steering path does not exist:', steeringPath)
      }

      return { settings, mcpConfig, steeringFiles }
    } catch (error) {
      console.error('[ThirdPartySettings] Failed to get settings:', error)
      return { error: error instanceof Error ? error.message : 'Failed to get settings' }
    }
  })

  // IPC: 获取第三方可用模型列表（proxy 模块已删除，返回空列表）
  ipcMain.handle('get-third-party-available-models', async () => {
    // proxy 模块已删除，此功能暂时不可用
    return { models: [], error: 'Model fetching requires proxy module' }
  })

  // IPC: 保存第三方设置
  ipcMain.handle('save-third-party-settings', async (_event, settings: Record<string, unknown>) => {
    try {
      const os = await import('os')
      const fs = await import('fs')
      const path = await import('path')

      const homeDir = os.homedir()
      const settingsPath = path.join(
        homeDir,
        'AppData',
        'Roaming',
        'ElectronSQLiteRest',
        'User',
        'settings.json'
      )

      let existingSettings = {}
      if (fs.existsSync(settingsPath)) {
        const content = fs.readFileSync(settingsPath, 'utf-8')
        // 移除尾随逗号和注释以兼容标准 JSON
        const cleanedContent = content
          .replace(/\/\/.*$/gm, '') // 移除单行注释
          .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行注释
          .replace(/,(\s*[}\]])/g, '$1') // 移除尾随逗号
        existingSettings = JSON.parse(cleanedContent)
      }

      // 映射设置到第三方应用的格式
      const thirdPartySettings = {
        ...existingSettings,
        'kiroAgent.modelSelection': settings.modelSelection,
        'kiroAgent.agentAutonomy': settings.agentAutonomy,
        'kiroAgent.enableDebugLogs': settings.enableDebugLogs,
        'kiroAgent.enableTabAutocomplete': settings.enableTabAutocomplete,
        'kiroAgent.enableCodebaseIndexing': settings.enableCodebaseIndexing,
        'kiroAgent.usageSummary': settings.usageSummary,
        'kiroAgent.codeReferences.referenceTracker': settings.codeReferences,
        'kiroAgent.configureMCP': settings.configureMCP,
        'kiroAgent.trustedCommands': settings.trustedCommands,
        'kiroAgent.trustedTools': settings.trustedTools,
        'kiroAgent.commandDenylist': settings.commandDenylist,
        'kiroAgent.ignoreFiles': settings.ignoreFiles,
        'kiroAgent.mcpApprovedEnvVars': settings.mcpApprovedEnvVars,
        'kiroAgent.notifications.agent.actionRequired': settings.notificationsActionRequired,
        'kiroAgent.notifications.agent.failure': settings.notificationsFailure,
        'kiroAgent.notifications.agent.success': settings.notificationsSuccess,
        'kiroAgent.notifications.billing': settings.notificationsBilling
      }

      // 确保目录存在
      const dir = path.dirname(settingsPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      fs.writeFileSync(settingsPath, JSON.stringify(thirdPartySettings, null, 4))
      return { success: true }
    } catch (error) {
      console.error('[ThirdPartySettings] Failed to save settings:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save settings'
      }
    }
  })

  // IPC: 打开第三方 MCP 配置文件
  ipcMain.handle('open-kiro-mcp-config', async (_event, type: 'user' | 'workspace') => {
    try {
      const os = await import('os')
      const path = await import('path')
      const homeDir = os.homedir()

      let configPath: string
      if (type === 'user') {
        configPath = path.join(homeDir, '.kiro', 'settings', 'mcp.json')
      } else {
        // 工作区配置，打开当前工作区的 .kiro/settings/mcp.json
        configPath = path.join(process.cwd(), '.kiro', 'settings', 'mcp.json')
      }

      // 如果文件不存在，创建空配置
      const fs = await import('fs')
      if (!fs.existsSync(configPath)) {
        const dir = path.dirname(configPath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        fs.writeFileSync(configPath, JSON.stringify({ mcpServers: {} }, null, 2))
      }

      shell.openPath(configPath)
      return { success: true }
    } catch (error) {
      console.error('[ThirdPartySettings] Failed to open MCP config:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open MCP config'
      }
    }
  })

  // IPC: 打开第三方工作区目录
  ipcMain.handle('open-kiro-steering-folder', async () => {
    try {
      const os = await import('os')
      const path = await import('path')
      const fs = await import('fs')
      const homeDir = os.homedir()
      const steeringPath = path.join(homeDir, '.kiro', 'steering')

      // 如果目录不存在，创建它
      if (!fs.existsSync(steeringPath)) {
        fs.mkdirSync(steeringPath, { recursive: true })
      }

      shell.openPath(steeringPath)
      return { success: true }
    } catch (error) {
      console.error('[ThirdPartySettings] Failed to open steering folder:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open steering folder'
      }
    }
  })

  // IPC: 打开第三方配置文件
  ipcMain.handle('open-kiro-settings-file', async () => {
    try {
      const os = await import('os')
      const path = await import('path')
      const fs = await import('fs')
      const homeDir = os.homedir()
      const settingsPath = path.join(
        homeDir,
        'AppData',
        'Roaming',
        'ThirdPartyApp',
        'User',
        'settings.json'
      )

      // 如果文件不存在，创建默认配置
      if (!fs.existsSync(settingsPath)) {
        const dir = path.dirname(settingsPath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        const defaultSettings = {
          'workbench.colorTheme': 'Default Light',
          'kiroAgent.modelSelection': 'claude-haiku-4.5'
        }
        fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 4))
      }

      shell.openPath(settingsPath)
      return { success: true }
    } catch (error) {
      console.error('[ThirdPartySettings] Failed to open settings file:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open settings file'
      }
    }
  })

  // IPC: 打开指定的 Steering 文件
  ipcMain.handle('open-kiro-steering-file', async (_event, filename: string) => {
    try {
      const os = await import('os')
      const path = await import('path')
      const homeDir = os.homedir()
      const filePath = path.join(homeDir, '.kiro', 'steering', filename)

      shell.openPath(filePath)
      return { success: true }
    } catch (error) {
      console.error('[ThirdPartySettings] Failed to open steering file:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open steering file'
      }
    }
  })

  // IPC: 创建默认的 rules.md 文件
  ipcMain.handle('create-kiro-default-rules', async () => {
    try {
      const os = await import('os')
      const fs = await import('fs')
      const path = await import('path')
      const homeDir = os.homedir()
      const steeringPath = path.join(homeDir, '.kiro', 'steering')
      const rulesPath = path.join(steeringPath, 'rules.md')

      // 确保目录存在
      if (!fs.existsSync(steeringPath)) {
        fs.mkdirSync(steeringPath, { recursive: true })
      }

      // 默认规则内容
      const defaultContent = `# Role: 高级软件开发助手
一、系统为Windows10
二、调式文件、测试脚本、test相关文件都放在test文件夹里面，md文件放在docs文件夹里面
# 核心原则


## 1. 沟通与协作
- **诚实优先**：在任何情况下都严禁猜测或伪装。当需求不明确、存在技术风险或遇到知识盲区时，必须停止工作，并立即向用户澄清。
- **技术攻坚**：面对技术难题时，首要目标是寻找并提出高质量的解决方案。只有在所有可行方案均被评估后，才能与用户探讨降级或替换方案。
- **批判性思维**：在执行任务时，如果发现当前需求存在技术限制、潜在风险或有更优的实现路径，必须主动向用户提出你的见解和改进建议。
- **语言要求**：思考和回答时总是使用中文进行回复。


## 2. 架构设计
- **模块化设计**：所有设计都必须遵循功能解耦、职责单一的原则。严格遵守SOLID和DRY原则。
- **前瞻性思维**：在设计时必须考虑未来的可扩展性和可维护性，确保解决方案能够融入项目的整体架构。
- **技术债务优先**：在进行重构或优化时，优先处理对系统稳定性和可维护性影响最大的技术债务和基础架构问题。


## 3. 代码与交付物质量标准
### 编写规范
- **架构视角**：始终从整体项目架构出发编写代码，确保代码片段能够无缝集成，而不是孤立的功能。
- **零技术债务**：严禁创建任何形式的技术债务，包括但不限于：临时文件、硬编码值、职责不清的模块或函数。
- **问题暴露**：禁止添加任何用于掩盖或绕过错误的fallback机制。代码应设计为快速失败（Fail-Fast），确保问题在第一时间被发现。


### 质量要求
- **可读性**：使用清晰、有意义的变量名和函数名。代码逻辑必须清晰易懂，并辅以必要的注释。
- **规范遵循**：严格遵循目标编程语言的社区最佳实践和官方编码规范。
- **健壮性**：必须包含充分的错误处理逻辑和边界条件检查。
- **性能意识**：在保证代码质量和可读性的前提下，对性能敏感部分进行合理优化，避免不必要的计算复杂度和资源消耗。


### 交付物规范
- **无文档**：除非用户明确要求，否则不要创建任何Markdown文档或其他形式的说明文档。
- **无测试**：除非用户明确要求，否则不要编写单元测试或集成测试代码。
- **无编译/运行**：禁止编译或执行任何代码。你的任务是生成高质量的代码和设计方案。


# 注意事项
- 除非特别说明否则不要创建新的文档、不要测试、不要编译、不要运行、不需要总结，除非用户主动要求


- 需求不明确时使向用户询问澄清，提供预定义选项
- 在有多个方案的时候，需要向用户询问，而不是自作主张
- 在有方案/策略需要更新时，需要向用户询问，而不是自作主张


- ACE为augmentContextEngine工具的缩写
- 如果要求查看文档请使用 Context7 MCP
- 如果需要进行WEB前端页面测试请使用 Playwright MCP
- 如果用户回复'继续' 则请按照最佳实践继续完成任务
`

      fs.writeFileSync(rulesPath, defaultContent, 'utf-8')
      console.log('[ThirdPartySettings] Created default rules.md at:', rulesPath)

      // 打开文件
      shell.openPath(rulesPath)

      return { success: true }
    } catch (error) {
      console.error('[ThirdPartySettings] Failed to create default rules:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create default rules'
      }
    }
  })

  // IPC: 读取 Steering 文件内容
  ipcMain.handle('read-kiro-steering-file', async (_event, filename: string) => {
    try {
      const os = await import('os')
      const fs = await import('fs')
      const path = await import('path')
      const homeDir = os.homedir()
      const filePath = path.join(homeDir, '.kiro', 'steering', filename)

      if (!fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' }
      }

      const content = fs.readFileSync(filePath, 'utf-8')
      return { success: true, content }
    } catch (error) {
      console.error('[ThirdPartySettings] Failed to read steering file:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read file'
      }
    }
  })

  // IPC: 保存 Steering 文件内容
  ipcMain.handle('save-kiro-steering-file', async (_event, filename: string, content: string) => {
    try {
      const os = await import('os')
      const fs = await import('fs')
      const path = await import('path')
      const homeDir = os.homedir()
      const steeringPath = path.join(homeDir, '.kiro', 'steering')
      const filePath = path.join(steeringPath, filename)

      // 确保目录存在
      if (!fs.existsSync(steeringPath)) {
        fs.mkdirSync(steeringPath, { recursive: true })
      }

      fs.writeFileSync(filePath, content, 'utf-8')
      console.log('[ThirdPartySettings] Saved steering file:', filePath)
      return { success: true }
    } catch (error) {
      console.error('[ThirdPartySettings] Failed to save steering file:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save file'
      }
    }
  })

  // ============ MCP 服务器管理 IPC ============

  // IPC: 保存 MCP 服务器配置
  ipcMain.handle(
    'save-mcp-server',
    async (
      _event,
      name: string,
      config: { command: string; args?: string[]; env?: Record<string, string> },
      oldName?: string
    ) => {
      try {
        const os = await import('os')
        const fs = await import('fs')
        const path = await import('path')
        const homeDir = os.homedir()
        const mcpPath = path.join(homeDir, '.kiro', 'settings', 'mcp.json')

        // 读取现有配置
        let mcpConfig: { mcpServers: Record<string, unknown> } = { mcpServers: {} }
        if (fs.existsSync(mcpPath)) {
          const content = fs.readFileSync(mcpPath, 'utf-8')
          mcpConfig = JSON.parse(content)
        }

        // 如果是重命名，先删除旧的
        if (oldName && oldName !== name) {
          delete mcpConfig.mcpServers[oldName]
        }

        // 添加/更新服务器
        mcpConfig.mcpServers[name] = config

        // 确保目录存在
        const dir = path.dirname(mcpPath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }

        fs.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2))
        console.log('[ThirdPartySettings] Saved MCP server:', name)
        return { success: true }
      } catch (error) {
        console.error('[ThirdPartySettings] Failed to save MCP server:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save MCP server'
        }
      }
    }
  )

  // IPC: 删除 MCP 服务器
  ipcMain.handle('delete-mcp-server', async (_event, name: string) => {
    try {
      const os = await import('os')
      const fs = await import('fs')
      const path = await import('path')
      const homeDir = os.homedir()
      const mcpPath = path.join(homeDir, '.kiro', 'settings', 'mcp.json')

      if (!fs.existsSync(mcpPath)) {
        return { success: false, error: '配置文件不存在' }
      }

      const content = fs.readFileSync(mcpPath, 'utf-8')
      const mcpConfig = JSON.parse(content)

      if (!mcpConfig.mcpServers || !mcpConfig.mcpServers[name]) {
        return { success: false, error: '服务器不存在' }
      }

      delete mcpConfig.mcpServers[name]
      fs.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2))
      console.log('[ThirdPartySettings] Deleted MCP server:', name)
      return { success: true }
    } catch (error) {
      console.error('[ThirdPartySettings] Failed to delete MCP server:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete MCP server'
      }
    }
  })

  // IPC: 删除 Steering 文件
  ipcMain.handle('delete-kiro-steering-file', async (_event, filename: string) => {
    try {
      const os = await import('os')
      const fs = await import('fs')
      const path = await import('path')
      const homeDir = os.homedir()
      const filePath = path.join(homeDir, '.kiro', 'steering', filename)

      if (!fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' }
      }

      fs.unlinkSync(filePath)
      console.log('[ThirdPartySettings] Deleted steering file:', filePath)
      return { success: true }
    } catch (error) {
      console.error('[ThirdPartySettings] Failed to delete steering file:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete file'
      }
    }
  })

  // ============ 机器码管理 IPC ============

  // IPC: 获取操作系统类型
  ipcMain.handle('machine-id:get-os-type', () => {
    return machineIdModule.getOSType()
  })

  // IPC: 获取当前机器码
  ipcMain.handle('machine-id:get-current', async () => {
    console.log('[MachineId] Getting current machine ID...')
    return await machineIdModule.getCurrentMachineId()
  })

  // IPC: 设置新机器码
  ipcMain.handle('machine-id:set', async (_event, newMachineId: string) => {
    console.log('[MachineId] Setting new machine ID:', newMachineId.substring(0, 8) + '...')
    const result = await machineIdModule.setMachineId(newMachineId)

    if (!result.success && result.requiresAdmin) {
      // 弹窗询问用户是否以管理员权限重启
      const shouldRestart = await machineIdModule.showAdminRequiredDialog()
      if (shouldRestart) {
        await machineIdModule.requestAdminRestart()
      }
    }

    return result
  })

  // IPC: 生成随机机器码
  ipcMain.handle('machine-id:generate-random', () => {
    return machineIdModule.generateRandomMachineId()
  })

  // IPC: 检查管理员权限
  ipcMain.handle('machine-id:check-admin', async () => {
    return await machineIdModule.checkAdminPrivilege()
  })

  // IPC: 请求管理员权限重启
  ipcMain.handle('machine-id:request-admin-restart', async () => {
    const shouldRestart = await machineIdModule.showAdminRequiredDialog()
    if (shouldRestart) {
      return await machineIdModule.requestAdminRestart()
    }
    return false
  })

  // IPC: 备份机器码到文件
  ipcMain.handle('machine-id:backup-to-file', async (_event, machineId: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '备份机器码',
      defaultPath: 'machine-id-backup.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })

    if (result.canceled || !result.filePath) {
      return false
    }

    return await machineIdModule.backupMachineIdToFile(machineId, result.filePath)
  })

  // IPC: 从文件恢复机器码
  ipcMain.handle('machine-id:restore-from-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '恢复机器码',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })

    if (result.canceled || !result.filePaths[0]) {
      return { success: false, error: '用户取消' }
    }

    return await machineIdModule.restoreMachineIdFromFile(result.filePaths[0])
  })

  // 更新协议处理函数以支持 Social Auth 回调
  const originalHandleProtocolUrl = handleProtocolUrl
  // @ts-ignore - 重新定义协议处理
  handleProtocolUrl = (url: string): void => {
    if (!url.startsWith(`${PROTOCOL_PREFIX}://`)) return

    try {
      const urlObj = new URL(url)

      // 处理 Social Auth 回调 (kiro://kiro.kiroAgent/authenticate-success)
      if (url.includes('authenticate-success') || url.includes('auth')) {
        const code = urlObj.searchParams.get('code')
        const state = urlObj.searchParams.get('state')
        const error = urlObj.searchParams.get('error')

        if (error) {
          console.log('[Login] Auth callback error:', error)
          if (mainWindow) {
            mainWindow.webContents.send('social-auth-callback', { error })
            mainWindow.focus()
          }
          return
        }

        if (code && state && mainWindow) {
          console.log('[Login] Auth callback received, code:', code.substring(0, 20) + '...')
          mainWindow.webContents.send('social-auth-callback', { code, state })
          mainWindow.focus()
        }
        return
      }

      // 调用原始处理函数处理其他协议
      originalHandleProtocolUrl(url)
    } catch (error) {
      console.error('Failed to parse protocol URL:', error)
    }
  }

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else if (mainWindow) {
      // macOS: 点击 Dock 图标时显示主窗口
      if (process.platform === 'darwin' && app.dock) {
        app.dock.show()
      }
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  // 加载并注册全局快捷键
  await loadShortcutSettings()
  registerShowWindowShortcut()
})

// Windows/Linux: 处理第二个实例和协议 URL
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, commandLine) => {
    // Windows: 协议 URL 会作为命令行参数传入
    const url = commandLine.find((arg) => arg.startsWith(`${PROTOCOL_PREFIX}://`))
    if (url) {
      handleProtocolUrl(url)
    }

    // 聚焦主窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

// macOS: 处理协议 URL
app.on('open-url', (_event, url) => {
  handleProtocolUrl(url)
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 应用退出前注销 URI 协议处理器并保存数据
app.on('will-quit', async (event) => {
  // 防止重复处理
  if (isQuitting) return

  // 防止应用立即退出，先保存数据
  if (lastSavedData && store) {
    event.preventDefault()
    isQuitting = true

    // 设置超时，确保 3 秒后强制退出（防止关机阻塞）
    const forceQuitTimer = setTimeout(() => {
      console.log('[Exit] Force quit due to timeout')
      unregisterProtocol()
      app.exit(0)
    }, 3000)

    try {
      console.log('[Exit] Saving data before quit...')
      // 刷新待写入的防抖数据
      flushStoreWrites()
      store.set('accountData', lastSavedData)
      await createBackup(lastSavedData)
      console.log('[Exit] Data saved successfully')
    } catch (error) {
      console.error('[Exit] Failed to save data:', error)
    }

    clearTimeout(forceQuitTimer)
    unregisterProtocol()
    app.exit(0)
  } else {
    unregisterProtocol()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
