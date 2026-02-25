import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  icon: React.ReactNode | string
  label: string
  value: string | number
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

export function StatsCard({
  icon,
  label,
  value,
  change,
  trend,
  className,
}: StatsCardProps) {
  return (
    <Card className={cn('shadow-sm', className)}>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center text-2xl">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-sm text-gray-600">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {change && (
              <p
                className={cn(
                  'mt-1 text-xs',
                  trend === 'up' && 'text-green-600',
                  trend === 'down' && 'text-red-600',
                  trend === 'neutral' && 'text-gray-600'
                )}
              >
                {change}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
