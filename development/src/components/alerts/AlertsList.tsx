'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useState } from 'react'

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
  const [alerts, setAlerts] = useState<AlertItem[]>([
    {
      id: '1',
      title: 'High Temperature Alert',
      description: 'Temperature exceeded 85°C threshold in production area. Immediate attention required.',
      severity: 'critical',
      device: 'Temperature Sensor - Floor 1',
      deviceId: 'temp-001',
      timestamp: '2 minutes ago',
      rawTimestamp: new Date(Date.now() - 2 * 60 * 1000),
      acknowledged: false,
      category: 'temperature'
    },
    {
      id: '2',
      title: 'Low Battery Warning',
      description: 'Battery level below 25% - replacement needed within 48 hours',
      severity: 'medium',
      device: 'Pressure Monitor - Tank A',
      deviceId: 'press-tank-a',
      timestamp: '15 minutes ago',
      rawTimestamp: new Date(Date.now() - 15 * 60 * 1000),
      acknowledged: false,
      category: 'battery'
    },
    {
      id: '3',
      title: 'Device Offline',
      description: 'No data received in 2 hours - check connectivity and power supply',
      severity: 'high',
      device: 'Vibration Detector - Motor 3',
      deviceId: 'vib-motor-3',
      timestamp: '2 hours ago',
      rawTimestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      acknowledged: true,
      acknowledgedBy: 'John Doe',
      acknowledgedAt: new Date(Date.now() - 30 * 60 * 1000),
      category: 'connectivity'
    },
    {
      id: '4',
      title: 'Connectivity Issue',
      description: 'Intermittent connection detected - signal strength varies',
      severity: 'low',
      device: 'Motion Detector - Entry Gate',
      deviceId: 'motion-gate-1',
      timestamp: '4 hours ago',
      rawTimestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      acknowledged: false,
      category: 'connectivity'
    },
    {
      id: '5',
      title: 'Security Breach Attempt',
      description: 'Unauthorized access attempt detected on secure zone sensor',
      severity: 'critical',
      device: 'Security Sensor - Zone 7',
      deviceId: 'sec-zone-7',
      timestamp: '5 minutes ago',
      rawTimestamp: new Date(Date.now() - 5 * 60 * 1000),
      acknowledged: false,
      category: 'security'
    }
  ])

  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const handleAcknowledge = (alertId: string) => {
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