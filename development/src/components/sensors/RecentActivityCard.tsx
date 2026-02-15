'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock } from 'lucide-react'
import type { Device } from '@/types/sensor-details'

interface RecentActivityCardProps {
  device: Device
}

export function RecentActivityCard({ device }: RecentActivityCardProps) {
  // Placeholder - will be populated with real activity data
  const activities = [
    {
      type: 'status_change',
      description: `Device came online`,
      timestamp: device.last_seen || new Date().toISOString(),
      severity: 'info'
    }
  ]

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return `${Math.floor(diffMins / 1440)}d ago`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          🔧 Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity, idx) => (
            <div key={idx} className="flex gap-3">
              <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">{activity.description}</p>
                <p className="text-xs text-muted-foreground">{formatTime(activity.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
