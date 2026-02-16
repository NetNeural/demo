'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Device } from '@/types/sensor-details'

interface RecentActivityCardProps {
  device: Device
}

interface Activity {
  id: string
  activity_type: string
  description: string
  severity: string
  occurred_at: string
  sensor_type?: string
}

export function RecentActivityCard({ device }: RecentActivityCardProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchActivities = async () => {
      const supabase = createClient()
      
      // Fetch sensor activity, alerts, and recent telemetry
      const [sensorActivity, alerts, telemetry] = await Promise.all([
        // Sensor activity (configuration changes, calibrations, etc.)
        supabase
          .from('sensor_activity')
          .select('id, activity_type, description, severity, occurred_at, sensor_type')
          .eq('device_id', device.id)
          .order('occurred_at', { ascending: false })
          .limit(10),
        
        // Alerts created/resolved for this device
        supabase
          .from('alerts')
          .select('id, alert_type, title, severity, created_at, is_resolved')
          .eq('device_id', device.id)
          .order('created_at', { ascending: false })
          .limit(10),
        
        // Recent telemetry data received
        supabase
          .from('device_telemetry_history')
          .select('id, received_at, telemetry')
          .eq('device_id', device.id)
          .order('received_at', { ascending: false })
          .limit(5)
      ])

      // Combine and format all activities
      const combinedActivities: Activity[] = []

      // Add sensor activities
      if (sensorActivity.data) {
        combinedActivities.push(...sensorActivity.data.map(a => ({
          id: a.id,
          activity_type: a.activity_type,
          description: a.description || a.activity_type.replace(/_/g, ' '),
          severity: a.severity || 'info',
          occurred_at: a.occurred_at,
          sensor_type: a.sensor_type
        })))
      }

      // Add alerts
      if (alerts.data) {
        combinedActivities.push(...alerts.data.map(a => ({
          id: a.id,
          activity_type: a.is_resolved ? 'alert_resolved' : 'alert_created',
          description: a.title,
          severity: a.severity,
          occurred_at: a.created_at,
        })))
      }

      // Add telemetry data received events
      if (telemetry.data) {
        combinedActivities.push(...telemetry.data.map((t, idx) => ({
          id: `telemetry-${t.id}-${idx}`,
          activity_type: 'data_received',
          description: 'Telemetry data received',
          severity: 'info',
          occurred_at: t.received_at,
        })))
      }

      // Sort by timestamp (newest first) and limit to 15
      combinedActivities.sort((a, b) => 
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
      )
      
      setActivities(combinedActivities.slice(0, 15))
      setLoading(false)
    }

    fetchActivities()

    // Refresh every 30 seconds
    const interval = setInterval(fetchActivities, 30000)
    return () => clearInterval(interval)
  }, [device.id])

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return `${Math.floor(diffMins / 1440)}d ago`
  }

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-blue-500'
      case 'info': return 'bg-gray-400'
      default: return 'bg-gray-400'
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'threshold_updated': return '⚙️'
      case 'alert_triggered':
      case 'alert_created': return '🚨'
      case 'alert_resolved': return '✅'
      case 'calibration': return '🔧'
      case 'maintenance': return '🛠️'
      case 'status_change': return '🔄'
      case 'anomaly_detected': return '⚠️'
      case 'data_received': return '📊'
      case 'configuration_change': return '⚙️'
      default: return '📋'
    }
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
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-gray-300 mt-2" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-3">
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="flex gap-3 group hover:bg-muted/50 p-2 -ml-2 rounded-lg transition-colors">
                  <div className="flex-shrink-0 mt-0.5">
                    <span className="text-lg">{getActivityIcon(activity.activity_type)}</span>
                  </div>
                  <div className="flex-shrink-0">
                    <div className={`w-2 h-2 rounded-full ${getSeverityColor(activity.severity)} mt-2`} />
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2">{activity.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatTime(activity.occurred_at)}</span>
                      {activity.sensor_type && (
                        <>
                          <span>•</span>
                          <span className="capitalize">{activity.sensor_type}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
