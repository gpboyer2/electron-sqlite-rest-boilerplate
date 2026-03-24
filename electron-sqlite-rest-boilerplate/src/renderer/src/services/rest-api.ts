export interface EmbeddedApiStatus {
  mode: 'http'
  running: boolean
  initializing: boolean
  host: string
  port: number
  baseUrl: string
  serverEntry: string
  databasePath: string
  logDir: string
  lastError?: string | null
  startedAt?: string | null
}

export type EmbeddedApiInfo = EmbeddedApiStatus & {
  apiBaseUrl: string
}

interface ApiEnvelope<T> {
  status: 'success' | 'error'
  message: string
  datum: T
}

export interface HealthInfo {
  status: string
  timestamp: string
  database: string
}

export interface DashboardInfo {
  system: {
    cpu: { usage: number }
    memory: { usage: number; total: number; used: number }
    disk: { usage: number; total: number; used: number }
    network: { rx: number; tx: number }
  }
  process: {
    total: number
    running: number
    stopped: number
  }
  settings: Record<string, string>
  last_updated: number | null
}

export interface DashboardChartPoint {
  recorded_at: number
  cpu_usage?: number
  memory_usage?: number
  memory_used?: number
  memory_total?: number
  disk_usage?: number
  disk_used?: number
  disk_total?: number
  network_rx?: number
  network_tx?: number
}

export interface DashboardChartResponse {
  metric: string
  time_range: number
  list: DashboardChartPoint[]
  pagination: { current_page: number; page_size: number; total: number }
}

export interface SystemStatRecord {
  id: number
  cpu_usage: number
  memory_usage: number
  memory_total: number
  memory_used: number
  disk_usage: number
  disk_total: number
  disk_used: number
  network_rx: number
  network_tx: number
  recorded_at: number
}

export interface ProcessRecord {
  id: number
  pid: number
  name: string
  status: string
  cpu_usage: number
  memory_usage: number
  memory_bytes: number
  started_at: string | null
  command: string | null
  created_at: number
  updated_at: number
}

export interface SettingRecord {
  id: number
  key: string
  value: string
  description: string
  updated_at: number
}

export interface AboutInfo {
  id?: number
  app_name: string
  version: string
  description: string
  author: string
  license: string
  updated_at?: number
}

export type AboutRecord = AboutInfo

export interface TemplateAuthUser {
  id: number
  username: string
  realName: string
  email: string
  role: {
    id: number
    code: string
    name: string
  }
  permissions: string[]
}

export interface AuthPublicSummary {
  authMode: string
  demoAccounts: Array<{
    username: string
    password: string
    role: string
  }>
  roles: Array<{
    id: number
    name: string
    code: string
    description: string
  }>
  permissions: Array<{
    id: number
    name: string
    code: string
    description: string
  }>
  users: Array<{
    id: number
    username: string
    realName: string
    role: {
      code: string
      name: string
    }
  }>
  protectedRoute: string
}

export interface AuthLoginResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
  refreshExpiresIn: number
  user: TemplateAuthUser
}

interface PaginatedResponse<T> {
  list: T[]
  pagination: { current_page: number; page_size: number; total: number }
}

interface SettingsResponse extends PaginatedResponse<SettingRecord> {
  map: Record<string, string>
}

function buildQuery(params?: Record<string, string | number | undefined>): string {
  if (!params) {
    return ''
  }

  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value))
    }
  })

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export async function getEmbeddedApiStatus(): Promise<EmbeddedApiInfo> {
  const status = await window.api.getEmbeddedApiStatus()
  return {
    ...status,
    apiBaseUrl: `${status.baseUrl}/api`,
    lastError: status.lastError ?? null,
    startedAt: status.startedAt ?? null
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const apiStatus = await getEmbeddedApiStatus()

  if (!apiStatus.running && apiStatus.lastError) {
    throw new Error(apiStatus.lastError)
  }

  const response = await fetch(`${apiStatus.baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const payload = (await response.json()) as ApiEnvelope<T>
  if (payload.status !== 'success') {
    throw new Error(payload.message || 'Request failed')
  }

  return payload.datum
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

export const templateApi = {
  getEmbeddedApiStatus,
  getHealth: (): Promise<HealthInfo> => request('/api/health'),
  getDashboard: (): Promise<DashboardInfo> => request('/api/dashboard/query'),
  getDashboardChart: (
    metric: 'cpu' | 'memory' | 'disk' | 'network' | 'all' = 'all',
    timeRange = 60
  ): Promise<DashboardChartResponse> =>
    request(`/api/dashboard/chart${buildQuery({ metric, time_range: timeRange })}`),
  querySystemStats: (page = 1, pageSize = 10): Promise<PaginatedResponse<SystemStatRecord>> =>
    request(`/api/system/query${buildQuery({ current_page: page, page_size: pageSize })}`),
  createSystemStat: (payload: Partial<SystemStatRecord>): Promise<{ id: number }> =>
    post('/api/system/create', payload),
  updateSystemStat: (
    payload: Partial<SystemStatRecord> & { id: number }
  ): Promise<{ changes: number }> => post('/api/system/update', payload),
  deleteSystemStats: (ids: number[]): Promise<{ deleted: number }> =>
    post('/api/system/delete', { data: ids }),
  queryProcesses: (
    status?: string,
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResponse<ProcessRecord>> =>
    request(`/api/process/query${buildQuery({ status, current_page: page, page_size: pageSize })}`),
  createProcess: (payload: Partial<ProcessRecord>): Promise<{ id: number }> =>
    post('/api/process/create', payload),
  updateProcess: (payload: Partial<ProcessRecord> & { id: number }): Promise<{ changes: number }> =>
    post('/api/process/update', payload),
  deleteProcesses: (ids: number[]): Promise<{ deleted: number }> =>
    post('/api/process/delete', { data: ids }),
  querySettings: (): Promise<SettingsResponse> => request('/api/settings/query'),
  createSetting: (
    payload: Pick<SettingRecord, 'key' | 'value' | 'description'>
  ): Promise<{ id: number }> => post('/api/settings/create', payload),
  updateSetting: (
    payload: Pick<SettingRecord, 'key' | 'value' | 'description'>
  ): Promise<{ changes?: number; id?: number }> => post('/api/settings/update', payload),
  deleteSettings: (keys: string[]): Promise<{ deleted: number }> =>
    post('/api/settings/delete', { data: keys }),
  getAboutInfo: (): Promise<AboutInfo> => request('/api/about/query'),
  updateAboutInfo: (payload: Partial<AboutInfo>): Promise<{ changes?: number; id?: number }> =>
    post('/api/about/update', payload),
  getAuthPublicSummary: (): Promise<AuthPublicSummary> => request('/api/auth/public-summary'),
  registerTemplateUser: (payload: {
    username: string
    password: string
    realName?: string
    email?: string
  }): Promise<{ username: string; role: string }> => post('/api/auth/register', payload),
  loginTemplateUser: (payload: {
    username: string
    password: string
  }): Promise<AuthLoginResult> => post('/api/auth/login', payload),
  refreshTemplateUser: (refreshToken: string): Promise<AuthLoginResult> =>
    post('/api/auth/refresh', { refreshToken }),
  getTemplateMe: (accessToken: string): Promise<TemplateAuthUser> =>
    request('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }),
  logoutTemplateUser: (accessToken: string): Promise<null> =>
    postWithAuth('/api/auth/logout', accessToken),
  getProtectedTemplateExample: (accessToken: string): Promise<{
    message: string
    currentUser: TemplateAuthUser
    hint: string
  }> => requestWithAuth('/api/auth/protected-example', accessToken)
}

function requestWithAuth<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  return request<T>(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`
    }
  })
}

function postWithAuth<T>(path: string, accessToken: string, body?: unknown): Promise<T> {
  return requestWithAuth<T>(path, accessToken, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body)
  })
}

export const getHealth = templateApi.getHealth
export const getDashboard = templateApi.getDashboard
export const getDashboardChart = templateApi.getDashboardChart
export const getSystemRecords = templateApi.querySystemStats
export const createSystemRecord = templateApi.createSystemStat
export const getProcesses = templateApi.queryProcesses
export const createProcess = templateApi.createProcess
export const updateProcess = templateApi.updateProcess
export const deleteProcesses = templateApi.deleteProcesses
export const getSettings = templateApi.querySettings
export const createSetting = templateApi.createSetting
export const updateSetting = templateApi.updateSetting
export const deleteSettings = templateApi.deleteSettings
export const getAbout = templateApi.getAboutInfo
export const updateAbout = templateApi.updateAboutInfo

export async function startEmbeddedApi(): Promise<EmbeddedApiInfo> {
  const status = await window.api.startEmbeddedApi()
  return {
    ...status,
    apiBaseUrl: `${status.baseUrl}/api`,
    lastError: status.lastError ?? null,
    startedAt: status.startedAt ?? null
  }
}
