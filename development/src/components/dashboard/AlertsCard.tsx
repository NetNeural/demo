'use client'

import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/contexts/OrganizationContext'

interface AlertItem {
  id: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  device: string
  timestamp: string
  acknowledged: boolean
}

// Helper function to format timestamp
const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
};

export function AlertsCard() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const { currentOrganization } = useOrganization()

  const fetchAlerts = useCallback(async () => {
    if (!currentOrganization) {
      setAlerts([])
      setLoading(false)
      return
    }

    try {
      // Get authenticated user's session
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session')
      }
      
      // Filter by current organization
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/alerts?organization_id=${currentOrganization.id}`;
      
      const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();

        // Define API response type
        interface AlertApiResponse {
          id: string;
          title: string;
          message: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          deviceName: string;
          timestamp: string;
          isResolved: boolean;
        }

        // Transform API response to match AlertItem interface
        const transformedAlerts: AlertItem[] = (data.alerts || []).map((alert: AlertApiResponse) => ({
          id: alert.id,
          title: alert.title,
          description: alert.message,
          severity: alert.severity,
          device: alert.deviceName,
          timestamp: formatTimestamp(alert.timestamp),
          acknowledged: alert.isResolved
        }));
        
        setAlerts(transformedAlerts);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      // Show empty state instead of mock data
      setAlerts([]);
    } finally {
      setLoading(false)
    }
  }, [currentOrganization])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  const getSeverityIcon = (severity: AlertItem['severity']) => {
    switch (severity) {
      case 'critical': return '🚨'
      case 'high': return '⚠️'
      case 'medium': return '🟡'
      case 'low': return 'ℹ️'
      default: return '❓'
    }
  }

  const getSeverityColor = (severity: AlertItem['severity']) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50'
      case 'high': return 'border-orange-500 bg-orange-50'
      case 'medium': return 'border-yellow-500 bg-yellow-50'
      case 'low': return 'border-blue-500 bg-blue-50'
      default: return 'border-gray-500 bg-gray-50'
    }
  }

  return (
    <>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Active Alerts</CardTitle>
          <Button variant="outline" size="sm">
            View All Alerts
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-3 border rounded-lg animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {alerts.map((alert) => (
              <Alert 
                key={alert.id} 
                className={`${getSeverityColor(alert.severity)} ${alert.acknowledged ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between w-full">
                  <div className="flex items-start space-x-2">
                    <span className="text-lg mt-0.5">{getSeverityIcon(alert.severity)}</span>
                    <div>
                      <AlertDescription className="font-medium text-sm">
                        {alert.title}
                      </AlertDescription>
                      <AlertDescription className="text-xs text-muted-foreground mt-1">
                        {alert.description}
                      </AlertDescription>
                      <AlertDescription className="text-xs text-muted-foreground mt-1">
                        {alert.device} • {alert.timestamp}
                      </AlertDescription>
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <span className={`text-xs px-2 py-1 rounded ${
                      alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                      alert.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                      alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    {!alert.acknowledged && (
                      <Button variant="ghost" size="sm" className="text-xs h-6">
                        Acknowledge
                      </Button>
                    )}
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        )}
        
        {!loading && alerts.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-green-600">🎉 No active alerts</p>
            <p className="text-sm mt-1">All systems operating normally</p>
          </div>
        )}
      </CardContent>
    </>
  )
}