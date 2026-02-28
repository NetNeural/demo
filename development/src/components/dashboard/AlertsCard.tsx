'use client'

import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useEffect, useState, useCallback } from 'react'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AcknowledgeAlertDialog,
  type AcknowledgementType,
} from '@/components/alerts/AcknowledgeAlertDialog'
import { useDateFormatter } from '@/hooks/useDateFormatter'

interface AlertItem {
  id: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  device: string
  timestamp: string
  acknowledged: boolean
}

export function AlertsCard() {
  const { fmt } = useDateFormatter()
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAckDialog, setShowAckDialog] = useState(false)
  const [ackAlertId, setAckAlertId] = useState<string | null>(null)
  const [ackAlertTitle, setAckAlertTitle] = useState('')
  const { currentOrganization } = useOrganization()
  const router = useRouter()

  const fetchAlerts = useCallback(async () => {
    if (!currentOrganization) {
      setAlerts([])
      setLoading(false)
      return
    }

    try {
      const response = await edgeFunctions.alerts.list(currentOrganization.id, {
        resolved: false,
      })

      if (!response.success || !response.data) {
        console.error('Failed to fetch alerts:', response.error)
        setAlerts([])
        setLoading(false)
        return
      }

      // Define API response type
      interface AlertApiResponse {
        id: string
        title: string
        message: string
        severity: 'low' | 'medium' | 'high' | 'critical'
        deviceName: string
        timestamp: string
        isResolved: boolean
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = response.data as any

      // Transform API response to match AlertItem interface
      const transformedAlerts: AlertItem[] = (data.alerts || []).map(
        (alert: AlertApiResponse) => ({
          id: alert.id,
          title: alert.title,
          description: alert.message,
          severity: alert.severity,
          device: alert.deviceName,
          timestamp: alert.timestamp,
          acknowledged: alert.isResolved,
        })
      )

      setAlerts(transformedAlerts)
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
      // Show empty state instead of mock data
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }, [currentOrganization])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  const handleAcknowledgeAlert = async (alertId: string) => {
    const alert = alerts.find((a) => a.id === alertId)
    setAckAlertId(alertId)
    setAckAlertTitle(alert?.title || '')
    setShowAckDialog(true)
  }

  const handleAcknowledgeWithNotes = async (
    type: AcknowledgementType,
    notes: string
  ) => {
    if (!ackAlertId) return

    try {
      const response = await edgeFunctions.userActions.acknowledgeAlert(
        ackAlertId,
        type,
        notes
      )

      if (!response.success) {
        console.error('Failed to acknowledge alert:', response.error)
        toast.error('Failed to acknowledge alert')
        throw new Error('Failed to acknowledge alert')
      }

      // Optimistic UI update
      setAlerts((prevAlerts) =>
        prevAlerts.map((alert) =>
          alert.id === ackAlertId ? { ...alert, acknowledged: true } : alert
        )
      )

      toast.success(
        `Alert ${type === 'resolved' ? 'resolved' : 'acknowledged'}`
      )
      setAckAlertId(null)
    } catch (error) {
      console.error('Error acknowledging alert:', error)
      toast.error('Failed to acknowledge alert')
      fetchAlerts()
      throw error
    }
  }

  const getSeverityIcon = (severity: AlertItem['severity']) => {
    switch (severity) {
      case 'critical':
        return '🚨'
      case 'high':
        return '⚠️'
      case 'medium':
        return '🟡'
      case 'low':
        return 'ℹ️'
      default:
        return '❓'
    }
  }

  const getSeverityColor = (severity: AlertItem['severity']) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-50'
      case 'high':
        return 'border-orange-500 bg-orange-50'
      case 'medium':
        return 'border-yellow-500 bg-yellow-50'
      case 'low':
        return 'border-blue-500 bg-blue-50'
      default:
        return 'border-gray-500 bg-gray-50'
    }
  }

  return (
    <>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Active Alerts</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/alerts')}
          >
            View All Alerts
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border p-3">
                <div className="mb-2 h-4 rounded bg-gray-200"></div>
                <div className="h-3 w-3/4 rounded bg-gray-200"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {alerts.map((alert) => (
              <Alert
                key={alert.id}
                className={`${getSeverityColor(alert.severity)}`}
              >
                <div className="flex w-full items-start justify-between">
                  <div className="flex items-start space-x-2">
                    <span className="mt-0.5 text-lg">
                      {getSeverityIcon(alert.severity)}
                    </span>
                    <div>
                      <AlertDescription className="text-sm font-medium">
                        {alert.title}
                      </AlertDescription>
                      <AlertDescription className="mt-1 text-xs text-muted-foreground">
                        {alert.description}
                      </AlertDescription>
                      <AlertDescription className="mt-1 text-xs text-muted-foreground">
                        {alert.device} • {fmt.timeAgo(alert.timestamp)}
                      </AlertDescription>
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <span
                      className={`rounded px-2 py-1 text-xs ${
                        alert.severity === 'critical'
                          ? 'bg-red-100 text-red-800'
                          : alert.severity === 'high'
                            ? 'bg-orange-100 text-orange-800'
                            : alert.severity === 'medium'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {alert.severity.toUpperCase()}
                    </span>
                    {!alert.acknowledged && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                      >
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
          <div className="py-6 text-center text-muted-foreground">
            <p className="text-green-600">🎉 No active alerts</p>
            <p className="mt-1 text-sm">All systems operating normally</p>
          </div>
        )}
      </CardContent>

      {/* Acknowledge Alert Dialog */}
      <AcknowledgeAlertDialog
        open={showAckDialog}
        onOpenChange={setShowAckDialog}
        alertTitle={ackAlertTitle}
        onConfirm={handleAcknowledgeWithNotes}
      />
    </>
  )
}
