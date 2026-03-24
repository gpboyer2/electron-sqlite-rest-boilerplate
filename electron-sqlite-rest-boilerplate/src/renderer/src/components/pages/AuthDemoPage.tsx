import { useEffect, useState } from 'react'
import { KeyRound, Lock, LogIn, LogOut, RefreshCw, ShieldCheck, UserPlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/hooks/useTranslation'
import {
  templateApi,
  type AuthLoginResult,
  type AuthPublicSummary,
  type TemplateAuthUser
} from '@/services/rest-api'

const TOKEN_STORAGE_KEY = 'template-auth-session'

type StoredAuthSession = {
  accessToken: string
  refreshToken: string
  user: TemplateAuthUser
}

function readStoredSession(): StoredAuthSession | null {
  try {
    const rawValue = window.localStorage.getItem(TOKEN_STORAGE_KEY)
    return rawValue ? (JSON.parse(rawValue) as StoredAuthSession) : null
  } catch {
    return null
  }
}

function writeStoredSession(value: StoredAuthSession | null): void {
  if (!value) {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(value))
}

export function AuthDemoPage() {
  const { t } = useTranslation()
  const isEn = t('common.unknown') === 'Unknown'
  const [summary, setSummary] = useState<AuthPublicSummary | null>(null)
  const [currentUser, setCurrentUser] = useState<TemplateAuthUser | null>(null)
  const [accessToken, setAccessToken] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: 'admin123' })
  const [registerForm, setRegisterForm] = useState({
    username: '',
    password: '',
    realName: '',
    email: ''
  })
  const [protectedMessage, setProtectedMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadSummary = async () => {
    const publicSummary = await templateApi.getAuthPublicSummary()
    setSummary(publicSummary)
  }

  const hydrateStoredSession = async () => {
    const storedSession = readStoredSession()
    if (!storedSession) {
      return
    }

    try {
      const me = await templateApi.getTemplateMe(storedSession.accessToken)
      setCurrentUser(me)
      setAccessToken(storedSession.accessToken)
      setRefreshToken(storedSession.refreshToken)
      writeStoredSession({
        accessToken: storedSession.accessToken,
        refreshToken: storedSession.refreshToken,
        user: me
      })
    } catch {
      writeStoredSession(null)
    }
  }

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true)
      setError('')

      try {
        await loadSummary()
        await hydrateStoredSession()
      } catch (bootstrapError) {
        setError(bootstrapError instanceof Error ? bootstrapError.message : String(bootstrapError))
      } finally {
        setLoading(false)
      }
    }

    void bootstrap()
  }, [])

  const persistLoginResult = (result: AuthLoginResult) => {
    setCurrentUser(result.user)
    setAccessToken(result.accessToken)
    setRefreshToken(result.refreshToken)
    setProtectedMessage('')
    writeStoredSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user
    })
  }

  const handleLogin = async () => {
    setSubmitting(true)
    setError('')

    try {
      const result = await templateApi.loginTemplateUser(loginForm)
      persistLoginResult(result)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : String(loginError))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegister = async () => {
    setSubmitting(true)
    setError('')

    try {
      await templateApi.registerTemplateUser(registerForm)
      setRegisterForm({ username: '', password: '', realName: '', email: '' })
      await loadSummary()
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : String(registerError))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRefresh = async () => {
    setSubmitting(true)
    setError('')

    try {
      const result = await templateApi.refreshTemplateUser(refreshToken)
      persistLoginResult(result)
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError))
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = async () => {
    setSubmitting(true)
    setError('')

    try {
      if (accessToken) {
        await templateApi.logoutTemplateUser(accessToken)
      }
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : String(logoutError))
    } finally {
      setCurrentUser(null)
      setAccessToken('')
      setRefreshToken('')
      setProtectedMessage('')
      writeStoredSession(null)
      setSubmitting(false)
    }
  }

  const callProtectedExample = async () => {
    setSubmitting(true)
    setError('')

    try {
      const response = await templateApi.getProtectedTemplateExample(accessToken)
      setProtectedMessage(response.message)
    } catch (protectedError) {
      setError(protectedError instanceof Error ? protectedError.message : String(protectedError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{isEn ? 'Auth Demo' : '认证与权限演示'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEn
              ? 'Most template APIs stay open. Only one example endpoint is permission-protected.'
              : '模板里的大部分接口保持开放，只保留一个受限示例接口来演示权限控制。'}
          </p>
        </div>
        <Badge variant={currentUser ? 'success' : 'outline'}>
          {currentUser
            ? isEn
              ? `Signed in as ${currentUser.role.code}`
              : `当前角色：${currentUser.role.code}`
            : isEn
              ? 'Guest mode'
              : '访客模式'}
        </Badge>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              {isEn ? 'Demo Accounts' : '内置演示账号'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {summary?.demoAccounts.map((account) => (
              <button
                key={account.username}
                type="button"
                className="flex w-full items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-left hover:bg-muted/40"
                onClick={() => setLoginForm({ username: account.username, password: account.password })}
              >
                <div>
                  <div className="font-medium">{account.username}</div>
                  <div className="text-xs text-muted-foreground">{account.password}</div>
                </div>
                <Badge variant="secondary">{account.role}</Badge>
              </button>
            ))}
            <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
              {isEn
                ? 'Use admin to access the protected example. Newly registered users default to viewer.'
                : '使用 admin 可访问受限示例接口。新注册用户默认是 viewer。'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              {isEn ? 'Public Summary' : '公开概览'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3 md:grid-cols-3">
              <Stat title={isEn ? 'Roles' : '角色'} value={summary?.roles.length ?? 0} />
              <Stat title={isEn ? 'Permissions' : '权限'} value={summary?.permissions.length ?? 0} />
              <Stat title={isEn ? 'Users' : '用户'} value={summary?.users.length ?? 0} />
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                {isEn ? 'Only protected example' : '唯一受限示例接口'}
              </div>
              <div className="font-mono text-xs">{summary?.protectedRoute || '/api/auth/protected-example'}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5" />
              {isEn ? 'Login' : '登录'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field
              label={isEn ? 'Username' : '用户名'}
              value={loginForm.username}
              onChange={(value) => setLoginForm((current) => ({ ...current, username: value }))}
            />
            <Field
              label={isEn ? 'Password' : '密码'}
              type="password"
              value={loginForm.password}
              onChange={(value) => setLoginForm((current) => ({ ...current, password: value }))}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleLogin()} disabled={submitting || loading}>
                <LogIn className="h-4 w-4" />
                {isEn ? 'Login' : '登录'}
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleRefresh()}
                disabled={submitting || !refreshToken}
              >
                <RefreshCw className="h-4 w-4" />
                {isEn ? 'Refresh Session' : '刷新会话'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => void handleLogout()}
                disabled={submitting || !accessToken}
              >
                <LogOut className="h-4 w-4" />
                {isEn ? 'Logout' : '退出登录'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {isEn ? 'Register Viewer' : '注册 viewer 用户'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field
              label={isEn ? 'Username' : '用户名'}
              value={registerForm.username}
              onChange={(value) => setRegisterForm((current) => ({ ...current, username: value }))}
            />
            <Field
              label={isEn ? 'Password' : '密码'}
              type="password"
              value={registerForm.password}
              onChange={(value) => setRegisterForm((current) => ({ ...current, password: value }))}
            />
            <Field
              label={isEn ? 'Display Name' : '显示名称'}
              value={registerForm.realName}
              onChange={(value) => setRegisterForm((current) => ({ ...current, realName: value }))}
            />
            <Field
              label="Email"
              value={registerForm.email}
              onChange={(value) => setRegisterForm((current) => ({ ...current, email: value }))}
            />
            <Button onClick={() => void handleRegister()} disabled={submitting || loading}>
              <UserPlus className="h-4 w-4" />
              {isEn ? 'Register' : '注册'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr,1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              {isEn ? 'Current Auth State' : '当前认证状态'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {currentUser ? (
              <>
                <InfoRow label={isEn ? 'Username' : '用户名'} value={currentUser.username} />
                <InfoRow label={isEn ? 'Role' : '角色'} value={`${currentUser.role.name} (${currentUser.role.code})`} />
                <InfoRow
                  label={isEn ? 'Permissions' : '权限'}
                  value={currentUser.permissions.length ? currentUser.permissions.join(', ') : '--'}
                />
              </>
            ) : (
              <div className="rounded-lg border bg-muted/20 p-4 text-muted-foreground">
                {isEn ? 'No active session' : '当前没有登录会话'}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? 'Protected Example' : '受限示例接口'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              {isEn
                ? 'This button calls the only permission-protected route in the template.'
                : '这个按钮会调用模板里唯一默认开启权限校验的接口。'}
            </p>
            <Button onClick={() => void callProtectedExample()} disabled={submitting || !accessToken}>
              <ShieldCheck className="h-4 w-4" />
              {isEn ? 'Call Protected Example' : '调用受限示例接口'}
            </Button>
            {protectedMessage && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-green-700">
                {protectedMessage}
              </div>
            )}
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
  type = 'text'
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 break-all font-medium">{value}</div>
    </div>
  )
}
