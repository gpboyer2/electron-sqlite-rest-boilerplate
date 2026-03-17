import { Cpu, HardDrive, MemoryStick, Wifi } from 'lucide-react'

export function HomePage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold">系统监控</h1>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <ResourceCard icon={Cpu} title="CPU" value="--" unit="%" />
        <ResourceCard icon={MemoryStick} title="内存" value="--" unit="%" />
        <ResourceCard icon={HardDrive} title="磁盘" value="--" unit="%" />
        <ResourceCard icon={Wifi} title="网络" value="--" unit="KB/s" />
      </div>
    </div>
  )
}

function ResourceCard({
  icon: Icon,
  title,
  value,
  unit
}: {
  icon: React.ElementType
  title: string
  value: string
  unit: string
}) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{title}</span>
      </div>
      <div className="text-2xl font-bold">
        {value}
        <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>
      </div>
    </div>
  )
}
