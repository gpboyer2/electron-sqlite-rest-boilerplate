import { Activity, Search, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function ProcessesPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6" />
          <h1 className="text-2xl font-bold">进程管理</h1>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索进程..." className="pl-9" />
        </div>
      </div>

      <div className="border rounded-lg">
        <div className="p-8 text-center text-muted-foreground">进程列表功能开发中...</div>
      </div>
    </div>
  )
}
