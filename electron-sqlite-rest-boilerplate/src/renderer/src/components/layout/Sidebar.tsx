import { useEffect, useState } from 'react'
import { Home, Settings, Info, ChevronLeft, ChevronRight, Activity, Server } from 'lucide-react'
import { cn } from '@/lib/utils'
import appLogo from '@/assets/app-logo.png'
import appLogoSmall from '@/assets/app-logo.png'
import { useTranslation } from '@/hooks/useTranslation'
import { Badge } from '@/components/ui/badge'
import { getEmbeddedApiStatus, type EmbeddedApiInfo } from '@/services/rest-api'

export type PageType = 'home' | 'processes' | 'settings' | 'about'

interface SidebarProps {
  currentPage: PageType
  onPageChange: (page: PageType) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

const menuItemsConfig: { id: PageType; labelKey: string; icon: React.ElementType }[] = [
  { id: 'home', labelKey: 'nav.home', icon: Home },
  { id: 'processes', labelKey: 'nav.processes', icon: Activity },
  { id: 'settings', labelKey: 'nav.settings', icon: Settings },
  { id: 'about', labelKey: 'nav.about', icon: Info }
]

export function Sidebar({ currentPage, onPageChange, collapsed, onToggleCollapse }: SidebarProps) {
  const { t } = useTranslation()
  const [apiInfo, setApiInfo] = useState<EmbeddedApiInfo | null>(null)

  useEffect(() => {
    let disposed = false

    const refreshStatus = async () => {
      const nextStatus = await getEmbeddedApiStatus()
      if (!disposed) {
        setApiInfo(nextStatus)
      }
    }

    void refreshStatus()
    const timer = window.setInterval(() => {
      void refreshStatus()
    }, 15000)

    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [])

  return (
    <div
      className={cn(
        'h-screen bg-card border-r flex flex-col transition-all duration-300',
        collapsed ? 'w-16' : 'w-52'
      )}
    >
      {/* Logo */}
      <div className="h-12 flex items-center justify-center border-b px-2 gap-2 overflow-hidden">
        {collapsed ? (
          <img
            src={appLogoSmall}
            alt="应用图标"
            className="h-14 w-14 object-contain transition-all"
          />
        ) : (
          <>
            <img src={appLogo} alt="应用Logo" className="h-7 w-auto shrink-0 transition-all" />
            <span className="font-semibold text-foreground whitespace-nowrap">
              {t('common.unknown') === 'Unknown' ? 'Electron Sqlite Rest' : 'Electron Sqlite Rest'}
            </span>
          </>
        )}
      </div>

      {/* Menu Items */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {menuItemsConfig.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          const label = t(item.labelKey)
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={cn(
                'w-full flex items-center rounded-lg text-sm font-medium transition-all overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{label}</span>}
            </button>
          )
        })}
      </nav>

      <div className="px-2 pb-2">
        <div
          className={cn(
            'rounded-lg border bg-muted/30 text-xs text-muted-foreground',
            collapsed ? 'px-2 py-3 flex justify-center' : 'px-3 py-2.5 space-y-2'
          )}
        >
          {collapsed ? (
            <Badge variant={apiInfo?.running ? 'success' : 'outline'} className="px-1.5 py-1">
              <Server className="h-3.5 w-3.5" />
            </Badge>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  <span>REST API</span>
                </div>
                <Badge variant={apiInfo?.running ? 'success' : 'outline'}>
                  {apiInfo?.running ? 'Online' : 'Offline'}
                </Badge>
              </div>
              <div className="truncate">
                {apiInfo ? `${apiInfo.host}:${apiInfo.port}` : '127.0.0.1:9200'}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Collapse Toggle */}
      <div className="p-2 border-t">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          title={
            collapsed
              ? t('common.unknown') === 'Unknown'
                ? 'Expand'
                : '展开侧边栏'
              : t('common.unknown') === 'Unknown'
                ? 'Collapse'
                : '收起侧边栏'
          }
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">
                {t('common.unknown') === 'Unknown' ? 'Collapse' : '收起'}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
