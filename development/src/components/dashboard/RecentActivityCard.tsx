'use client'

import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/contexts/OrganizationContext'

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
  const supabase = createClient()
  const { currentOrganization } = useOrganization()
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchActivities = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false)
      return
    }
    try {
      const { data, error } = await supabase
        .from('user_audit_log')
        .select(
          'id, action_type, action_category, resource_type, resource_name, user_email, status, created_at'
        )
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error

      const mapped: ActivityItem[] = (data || []).map((row) => {
        const rt = row.resource_type ?? ''
        let type: ActivityItem['type'] = 'system_event'
        if (rt === 'device' || rt === 'sensor') {
          type =
            row.action_type.includes('creat') || row.action_type.includes('add')
              ? 'device_added'
              : 'device_updated'
        } else if (rt === 'alert') {
          type =
            row.action_type.includes('resolv') ||
            row.action_type.includes('close')
              ? 'alert_resolved'
              : 'alert_created'
        } else if (
          row.action_category === 'auth' ||
          row.action_category === 'user'
        ) {
          type = 'user_action'
        }
        const title = `${row.action_type.replace(/_/g, ' ')}${row.resource_name ? `: ${row.resource_name}` : ''}`
        return {
          id: row.id,
          type,
          title: title.charAt(0).toUpperCase() + title.slice(1),
          description: row.resource_type
            ? `${row.resource_type} · ${row.status}`
            : row.status,
          user: row.user_email ?? undefined,
          timestamp: new Date(row.created_at).toLocaleString(),
        }
      })
      setActivities(mapped)
    } catch (error) {
      console.error('Failed to fetch activities:', error)
      setActivities([])
    } finally {
      setLoading(false)
    }
  }, [currentOrganization?.id, supabase])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  // Real-time: new audit log entries appear instantly
  useEffect(() => {
    if (!currentOrganization?.id) return

    const channel = supabase
      .channel(`dashboard-activity-${currentOrganization.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_audit_log',
          filter: `organization_id=eq.${currentOrganization.id}`,
        },
        () => { fetchActivities() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentOrganization?.id, supabase, fetchActivities])

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
            onClick={fetchActivities}
            title="Refresh activity"
          >
            Refresh
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
