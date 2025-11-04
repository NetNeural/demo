'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useState, useEffect, useCallback } from 'react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { createClient } from '@/lib/supabase/client'
import { handleApiError } from '@/lib/sentry-utils'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

interface AlertItem {
  id: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  device: string
  deviceId: string
  timestamp: string
  rawTimestamp: Date
  acknowledged: boolean
  acknowledgedBy?: string
  acknowledgedAt?: Date
  category: 'temperature' | 'connectivity' | 'battery' | 'vibration' | 'security' | 'system'
}

export function AlertsList() {
  const { currentOrganization } = useOrganization()
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const fetchAlerts = useCallback(async () => {
    if (!currentOrganization) {
      setAlerts([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        toast.error('Authentication required')
        setAlerts([])
        return
      }

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/alerts?organization_id=${currentOrganization.id}`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const error = new Error(errorData.error || `HTTP ${response.status}`)
        
        handleApiError(error, {
          endpoint: `/functions/v1/alerts`,
          method: 'GET',
          status: response.status,
          errorData,
          context: {
            organizationId: currentOrganization.id,
          },
        })
        
        toast.error('Failed to load alerts')
        setAlerts([])
        return
      }

      const data = await response.json()
      
      // Transform API response to match AlertItem format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transformedAlerts = (data.alerts || []).map((alert: any) => ({
        id: alert.id,
        title: alert.title || alert.message || 'Alert',
        description: alert.description || alert.message || '',
        severity: alert.severity || 'medium',
        device: alert.deviceName || alert.device_name || 'Unknown Device',
        deviceId: alert.deviceId || alert.device_id || '',
        timestamp: alert.created_at ? new Date(alert.created_at).toLocaleString() : 'Unknown',
        rawTimestamp: alert.created_at ? new Date(alert.created_at) : new Date(),
        acknowledged: alert.is_resolved || false,
        acknowledgedBy: alert.resolved_by,
        acknowledgedAt: alert.resolved_at ? new Date(alert.resolved_at) : undefined,
        category: alert.category || 'system'
      }))
      
      setAlerts(transformedAlerts)
    } catch (error) {
      console.error('Error fetching alerts:', error)
      toast.error('Failed to load alerts')
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }, [currentOrganization])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  const handleAcknowledge = async (alertId: string) => {
    if (!currentOrganization) return

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        toast.error('Authentication required')
        return
      }

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/alerts/${alertId}/acknowledge`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const error = new Error(errorData.error || `HTTP ${response.status}`)
        
        handleApiError(error, {
          endpoint: `/functions/v1/alerts/${alertId}/acknowledge`,
          method: 'POST',
          status: response.status,
          errorData,
          context: {
            alertId,
            organizationId: currentOrganization.id,
          },
        })
        
        toast.error('Failed to acknowledge alert')
        return
      }

      // Optimistically update UI
      setAlerts(prevAlerts => 
        prevAlerts.map(alert => 
          alert.id === alertId 
            ? { 
                ...alert, 
                acknowledged: true, 
                acknowledgedBy: 'Current User',
                acknowledgedAt: new Date()
              }
            : alert
        )
      )
      
      toast.success('Alert acknowledged successfully')
    } catch (error) {
      console.error('Error acknowledging alert:', error)
      toast.error('Failed to acknowledge alert')
    }
  }

  const handleViewDetails = (alert: AlertItem) => {
    setSelectedAlert(alert)
    setShowDetails(true)
  }

  const getSeverityIcon = (severity: AlertItem['severity']) => {
    switch (severity) {
      case 'critical': return '🚨'
      case 'high': return '⚠️'
      case 'medium': return '🟡'
      case 'low': return 'ℹ️'
      default: return '❓'
    }
  }

  const getCategoryIcon = (category: AlertItem['category']) => {
    switch (category) {
      case 'temperature': return '🌡️'
      case 'connectivity': return '📡'
      case 'battery': return '🔋'
      case 'vibration': return '📳'
      case 'security': return '🔒'
      case 'system': return '💻'
      default: return '⚙️'
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

  const activeAlerts = alerts.filter(a => !a.acknowledged)
  const acknowledgedAlerts = alerts.filter(a => a.acknowledged)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* Active Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>🚨 Active Alerts ({activeAlerts.length})</span>
              {activeAlerts.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    activeAlerts.forEach(alert => handleAcknowledge(alert.id))
                  }}
                >
                  Acknowledge All
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeAlerts.length > 0 ? (
              activeAlerts.map((alert) => (
                <Alert key={alert.id} className={getSeverityColor(alert.severity)}>
                  <div className="flex items-start justify-between w-full">
                    <div className="flex items-start space-x-3">
                      <div className="flex flex-col items-center space-y-1">
                        <span className="text-xl">{getSeverityIcon(alert.severity)}</span>
                        <span className="text-sm">{getCategoryIcon(alert.category)}</span>
                      </div>
                      <div className="flex-1">
                        <AlertDescription className="font-medium text-base text-gray-900">
                          {alert.title}
                        </AlertDescription>
                        <AlertDescription className="text-sm text-gray-600 mt-1">
                          {alert.description}
                        </AlertDescription>
                        <AlertDescription className="text-xs text-gray-500 mt-2">
                          <span className="font-medium">{alert.device}</span> • {alert.timestamp}
                        </AlertDescription>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <span className={`text-xs px-2 py-1 rounded font-medium ${
                        alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                        alert.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                        alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleAcknowledge(alert.id)}
                        >
                          Acknowledge
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleViewDetails(alert)}
                        >
                          Details
                        </Button>
                      </div>
                    </div>
                  </div>
                </Alert>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-green-600 text-lg">🎉 No active alerts</p>
                <p className="text-sm mt-1">All systems operating normally</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Acknowledged Alerts */}
        {acknowledgedAlerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>✅ Acknowledged Alerts ({acknowledgedAlerts.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {acknowledgedAlerts.map((alert) => (
                <Alert key={alert.id} className={`${getSeverityColor(alert.severity)} opacity-60`}>
                  <div className="flex items-start justify-between w-full">
                    <div className="flex items-start space-x-3">
                      <div className="flex flex-col items-center space-y-1">
                        <span className="text-xl">{getSeverityIcon(alert.severity)}</span>
                        <span className="text-sm">{getCategoryIcon(alert.category)}</span>
                      </div>
                      <div className="flex-1">
                        <AlertDescription className="font-medium text-base text-gray-700">
                          {alert.title}
                        </AlertDescription>
                        <AlertDescription className="text-sm text-gray-500 mt-1">
                          {alert.description}
                        </AlertDescription>
                        <AlertDescription className="text-xs text-gray-400 mt-2">
                          <span className="font-medium">{alert.device}</span> • {alert.timestamp}
                        </AlertDescription>
                        {alert.acknowledgedBy && (
                          <AlertDescription className="text-xs text-green-600 mt-1">
                            ✓ Acknowledged by {alert.acknowledgedBy}
                          </AlertDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <span className="text-xs px-2 py-1 rounded font-medium bg-green-100 text-green-800">
                        ACKNOWLEDGED
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleViewDetails(alert)}
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                </Alert>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Alert Details Modal */}
      {showDetails && selectedAlert && (
        <div className="modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title flex items-center">
                {getSeverityIcon(selectedAlert.severity)} {getCategoryIcon(selectedAlert.category)} Alert Details
              </h3>
              <button 
                onClick={() => setShowDetails(false)}
                className="modal-close"
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">{selectedAlert.title}</h4>
                <p className="text-gray-600">{selectedAlert.description}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Device</label>
                  <p className="text-sm text-gray-900">{selectedAlert.device}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Device ID</label>
                  <p className="text-sm text-gray-900 font-mono">{selectedAlert.deviceId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Severity</label>
                  <p className={`text-sm font-medium ${
                    selectedAlert.severity === 'critical' ? 'text-red-600' :
                    selectedAlert.severity === 'high' ? 'text-orange-600' :
                    selectedAlert.severity === 'medium' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`}>
                    {selectedAlert.severity.toUpperCase()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Category</label>
                  <p className="text-sm text-gray-900 capitalize">{selectedAlert.category}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Timestamp</label>
                  <p className="text-sm text-gray-900">{selectedAlert.rawTimestamp.toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <p className={`text-sm font-medium ${
                    selectedAlert.acknowledged ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {selectedAlert.acknowledged ? 'Acknowledged' : 'Active'}
                  </p>
                </div>
              </div>
              
              {selectedAlert.acknowledged && selectedAlert.acknowledgedBy && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <h5 className="font-medium text-green-800 mb-1">Acknowledgment Details</h5>
                  <p className="text-sm text-green-700">
                    Acknowledged by <span className="font-medium">{selectedAlert.acknowledgedBy}</span>
                  </p>
                  {selectedAlert.acknowledgedAt && (
                    <p className="text-sm text-green-600 mt-1">
                      {selectedAlert.acknowledgedAt.toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button 
                onClick={() => setShowDetails(false)}
                className="btn btn-secondary"
              >
                Close
              </button>
              {!selectedAlert.acknowledged && (
                <button 
                  onClick={() => {
                    handleAcknowledge(selectedAlert.id)
                    setShowDetails(false)
                  }}
                  className="btn btn-primary"
                >
                  Acknowledge Alert
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}