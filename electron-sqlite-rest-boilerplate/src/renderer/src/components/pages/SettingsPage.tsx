import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings, Info } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

export function SettingsPage() {
  const { t } = useTranslation()
  const isEn = t('common.unknown') === 'Unknown'

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Settings className="h-5 w-5" />
            {isEn ? 'Settings' : '设置'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Info className="h-5 w-5" />
            <p>{isEn ? 'Settings functionality has been removed.' : '设置功能已被移除。'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
