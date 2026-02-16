'use client'

// Recent Activity Card - displays sensor activity, alerts, and telemetry updates
// Last updated: 2026-02-16T11:05:00Z - Force cache clear
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Clock, RefreshCw, X } from 'lucide-react'
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
  sensor_name?: string
  reading_value?: number
  reading_unit?: string
}

export function RecentActivityCard({ device }: RecentActivityCardProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [isCleared, setIsCleared] = useState(false)

  const fetchActivities = async (skipIfCleared = true) => {
    // If user has cleared activities and this is an auto-refresh, don't fetch
    if (skipIfCleared && isCleared) {
      return
    }

    try {
      setLoading(true)
      const supabase = createClient()
      
      // Fetch sensor activity, alerts, recent telemetry, thresholds, and notifications
      const [sensorActivity, alerts, telemetry, thresholds, notifications] = await Promise.all([
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
          .limit(5),
        
        // Get temperature unit preferences from thresholds
        supabase
          .from('sensor_thresholds')
          .select('sensor_type, temperature_unit')
          .eq('device_id', device.id),
        
        // Notifications sent for this device's alerts
        supabase
          .from('notifications')
          .select('id, alert_id, method, status, sent_at, delivered_at, alerts!inner(title, device_id)')
          .eq('alerts.device_id', device.id)
          .not('sent_at', 'is', null)
          .order('sent_at', { ascending: false })
          .limit(10)
      ])

      // Combine and format all activities
      const combinedActivities: Activity[] = []

      // Add sensor activities
      if (sensorActivity.data) {
        const validActivities = sensorActivity.data
          .filter((a): a is typeof a & { occurred_at: string } => a.occurred_at != null)
          .map(a => ({
            id: a.id,
            activity_type: a.activity_type,
            description: a.description || a.activity_type.replace(/_/g, ' '),
            severity: a.severity || 'info',
            occurred_at: a.occurred_at,
            sensor_type: a.sensor_type
          }))
        combinedActivities.push(...validActivities)
      }

      // Add alerts
      if (alerts.data) {
        const validAlerts = alerts.data
          .filter((a): a is typeof a & { created_at: string } => a.created_at != null)
          .map(a => ({
            id: a.id,
            activity_type: a.is_resolved ? 'alert_resolved' : 'alert_created',
            description: a.title,
            severity: a.severity,
            occurred_at: a.created_at,
          }))
        combinedActivities.push(...validAlerts)
      }

      // Add notifications sent for alerts
      if (notifications.data) {
        const validNotifications = notifications.data
          .filter((n): n is typeof n & { sent_at: string } => n.sent_at != null)
          .map(n => {
            const methodEmoji = {
              email: '📧',
              sms: '📱',
              webhook: '🔗',
              in_app: '🔔'
            }[n.method] || '📤'
            
            const statusText = n.status === 'delivered' ? 'delivered' : 'sent'
            const alertTitle = (n as any).alerts?.title || 'Alert'
            
            return {
              id: `notification-${n.id}`,
              activity_type: 'notification_sent',
              description: `${methodEmoji} ${n.method.toUpperCase()} notification ${statusText}: ${alertTitle}`,
              severity: 'info',
              occurred_at: n.sent_at,
            }
          })
        combinedActivities.push(...validNotifications)
      }

      // Add telemetry data received events with sensor readings
      if (telemetry.data) {
        // Build temperature unit map from thresholds
        const temperatureUnitMap = new Map<string, string>()
        if (thresholds.data) {
          thresholds.data.forEach((t: any) => {
            if (t.temperature_unit && t.sensor_type) {
              temperatureUnitMap.set(t.sensor_type.toLowerCase(), t.temperature_unit)
            }
          })
        }

        // Helper to format sensor value with units
        const formatSensorValue = (sensorName: string, value: number): { value: number, unit: string } => {
          const nameLower = sensorName.toLowerCase()
          
          if (nameLower.includes('temperature') || nameLower.includes('temp')) {
            const unit = temperatureUnitMap.get('temperature') || 'celsius'
            if (unit === 'fahrenheit') {
              return { value: (value * 9/5) + 32, unit: '°F' }
            }
            return { value, unit: '°C' }
          } else if (nameLower.includes('humidity')) {
            return { value, unit: '%' }
          } else if (nameLower.includes('pressure')) {
            return { value, unit: ' hPa' }
          } else if (nameLower.includes('battery')) {
            return { value, unit: '%' }
          }
          
          return { value, unit: '' }
        }

        const validTelemetry = telemetry.data
          .filter((t): t is typeof t & { received_at: string } => t.received_at != null)
          .flatMap((t, idx) => {
            const telemetryData = t.telemetry
            
            // Extract sensor readings from telemetry
            if (telemetryData && typeof telemetryData === 'object') {
              const readings: Activity[] = []
              
              // Metadata fields to exclude from activity feed
              const excludeFields = ['type', 'type_id', 'units', 'value', 'sensor', 'timestamp', 'received_at', 'device_timestamp']
              
              // Valid sensor reading field patterns
              const isSensorField = (key: string): boolean => {
                const keyLower = key.toLowerCase()
                return (
                  keyLower.includes('temperature') ||
                  keyLower.includes('temp') ||
                  keyLower.includes('humidity') ||
                  keyLower.includes('pressure') ||
                  keyLower.includes('battery') ||
                  keyLower.includes('co2') ||
                  keyLower.includes('voc') ||
                  keyLower.includes('light') ||
                  keyLower.includes('motion')
                ) && !excludeFields.includes(key)
              }
              
              // Handle various telemetry structures
              Object.entries(telemetryData).forEach(([key, value]) => {
                if (typeof value === 'number' && isSensorField(key)) {
                  const formatted = formatSensorValue(key, value)
                  readings.push({
                    id: `telemetry-${t.id}-${key}-${idx}`,
                    activity_type: 'data_received',
                    description: `${key.replace(/_/g, ' ')} reading received`,
                    severity: 'info',
                    occurred_at: t.received_at,
                    sensor_name: key.replace(/_/g, ' '),
                    reading_value: formatted.value,
                    reading_unit: formatted.unit
                  })
                }
              })
              
              return readings.length > 0 ? readings : [{
                id: `telemetry-${t.id}-${idx}`,
                activity_type: 'data_received',
                description: 'Telemetry data received',
                severity: 'info',
                occurred_at: t.received_at,
              }]
            }
            
            return [{
              id: `telemetry-${t.id}-${idx}`,
              activity_type: 'data_received',
              description: 'Telemetry data received',
              severity: 'info',
              occurred_at: t.received_at,
            }]
          })
        combinedActivities.push(...validTelemetry)
      }

      // Sort by timestamp (newest first) and limit to 15
      combinedActivities.sort((a, b) => 
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
      )
      
      setActivities(combinedActivities.slice(0, 15))
      setLoading(false)
    } catch (error) {
      console.error('Error fetching activities:', error)
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchActivities(false)

    // Auto-refresh every 30 seconds (will skip if cleared)
    const interval = setInterval(() => fetchActivities(true), 30000)
    return () => clearInterval(interval)
  }, [device.id])

  const handleClear = () => {
    setActivities([])
    setIsCleared(true)
  }

  const handleRefresh = () => {
    setIsCleared(false)
    fetchActivities(false)
  }

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
      case 'notification_sent': return '📤'
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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            🔧 Recent Activity
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="h-8"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={activities.length === 0}
              className="h-8"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
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
                    <p className="text-sm font-medium line-clamp-2">
                      {activity.description}
                      {activity.reading_value !== undefined && (
                        <span className="ml-2 text-primary font-semibold">
                          {activity.reading_value.toFixed(1)}{activity.reading_unit}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatTime(activity.occurred_at)}</span>
                      {activity.sensor_name && (
                        <>
                          <span>•</span>
                          <span className="capitalize">{activity.sensor_name}</span>
                        </>
                      )}
                      {activity.sensor_type && !activity.sensor_name && (
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
