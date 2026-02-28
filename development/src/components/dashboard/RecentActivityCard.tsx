'use client'

import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'

interface ActivityItem {
  id: string
  type:
    | 'device_added'
    | 'device_updated'
    | 'alert_created'
    | 'alert_resolved'
    | 'user_action'
    | 'system_event'
  title: string
  description: string
  user?: string
  timestamp: string
  device?: string
}

export function RecentActivityCard() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        // TODO: Create audit-logs edge function to query audit_logs table
        // audit_logs table exists with: action, resource_type, resource_id, user_id, created_at, metadata
        // For now, show empty state until edge function is implemented
        console.info(
          'Activity tracking not yet implemented. Need to create audit-logs edge function.'
        )
        setActivities([])
      } catch (error) {
        console.error('Failed to fetch activities:', error)
        // Show empty state on error instead of mock data
        setActivities([])
      } finally {
        setLoading(false)
      }
    }

    fetchActivities()
  }, [])

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'device_added':
        return '📱'
      case 'device_updated':
        return '🔧'
      case 'alert_created':
        return '🚨'
      case 'alert_resolved':
        return '✅'
      case 'user_action':
        return '👤'
      case 'system_event':
        return '⚙️'
      default:
        return '📋'
    }
  }

  const getActivityColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'device_added':
        return 'text-green-600'
      case 'device_updated':
        return 'text-blue-600'
      case 'alert_created':
        return 'text-red-600'
      case 'alert_resolved':
        return 'text-green-600'
      case 'user_action':
        return 'text-purple-600'
      case 'system_event':
        return 'text-gray-600'
      default:
        return 'text-gray-500'
    }
  }

  return (
    <>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Activity</CardTitle>
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Activity tracking will be available soon"
          >
            View Activity Log
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex animate-pulse items-start space-x-3">
                <div className="h-8 w-8 rounded-full bg-gray-200"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 rounded bg-gray-200"></div>
                  <div className="h-3 w-3/4 rounded bg-gray-200"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-h-96 space-y-4 overflow-y-auto">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start space-x-3 rounded-lg p-3 hover:bg-gray-50"
              >
                <div className="flex-shrink-0">
                  <span className="text-2xl">
                    {getActivityIcon(activity.type)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {activity.description}
                  </p>
                  <div className="mt-2 flex items-center space-x-2 text-xs text-gray-400">
                    {activity.user && (
                      <>
                        <span>by {activity.user}</span>
                        <span>•</span>
                      </>
                    )}
                    {activity.device && (
                      <>
                        <span>{activity.device}</span>
                        <span>•</span>
                      </>
                    )}
                    <span>{activity.timestamp}</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getActivityColor(activity.type)}`}
                  >
                    {activity.type
                      .replace('_', ' ')
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && activities.length === 0 && (
          <div className="py-6 text-center text-muted-foreground">
            <p>No recent activity</p>
          </div>
        )}
      </CardContent>
    </>
  )
}
