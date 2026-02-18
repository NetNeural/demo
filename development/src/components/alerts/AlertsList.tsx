'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert as AlertUI, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { handleApiError } from '@/lib/sentry-utils'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { AlertsSummaryBar } from './AlertsSummaryBar'
import { AlertsFilters } from './AlertsFilters'
import { AlertsBulkActions } from './AlertsBulkActions'
import { AlertsTable, type Alert } from './AlertsTable'
import { Table2, Grid3x3 } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AcknowledgeAlertDialog, type AcknowledgementType } from './AcknowledgeAlertDialog'

interface AlertMetadata {
  sensor_type?: string
  sensor_name?: string
  current_value?: number
  threshold_id?: string
  breach_type?: 'critical_max' | 'critical_min' | 'max' | 'min'
  min_value?: number
  max_value?: number
  critical_min?: number
  critical_max?: number
  temperature_unit?: 'celsius' | 'fahrenheit'
  is_test?: boolean
  [key: string]: unknown
}

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
  metadata?: AlertMetadata
}

type ViewMode = 'cards' | 'table'
type TabType = 'all' | 'unacknowledged' | 'connectivity' | 'security' | 'environmental' | 'system'

export function AlertsList() {
  const { currentOrganization } = useOrganization()
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [ackAlertId, setAckAlertId] = useState<string | null>(null)
  const [ackAlertTitle, setAckAlertTitle] = useState<string>('')
  const [showAckDialog, setShowAckDialog] = useState(false)
  
  // Issue #108: New state for filters, view mode, tabs, bulk actions
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isProcessing, setIsProcessing] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set(['connectivity']))

  const fetchAlerts = useCallback(async () => {
    if (!currentOrganization) {
      setAlerts([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      const response = await edgeFunctions.alerts.list(currentOrganization.id, {
        resolved: false
      })

      if (!response.success || !response.data) {
        console.error('[AlertsList] Failed to fetch alerts:', response.error)
        
        handleApiError(new Error(response.error?.message || 'Failed to load alerts'), {
          endpoint: `/functions/v1/alerts`,
          method: 'GET',
          status: response.error?.status || 500,
          context: {
            organizationId: currentOrganization.id,
          },
        })
        
        toast.error('Failed to load alerts')
        setAlerts([])
        return
      }

      const data = response.data
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transformedAlerts = ((data as any).alerts || []).map((alert: any) => ({
        id: alert.id,
        title: alert.title || alert.message || 'Alert',
        description: alert.description || alert.message || '',
        severity: alert.severity || 'medium',
        device: alert.deviceName || alert.device_name || 'Unknown Device',
        deviceId: alert.deviceId || alert.device_id || '',
        timestamp: alert.created_at || new Date().toISOString(),
        rawTimestamp: alert.created_at ? new Date(alert.created_at) : new Date(),
        acknowledged: alert.is_resolved || false,
        acknowledgedBy: alert.resolved_by,
        acknowledgedAt: alert.resolved_at ? new Date(alert.resolved_at) : undefined,
        category: alert.category || 'system',
        metadata: alert.metadata || {}
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

  // Filter alerts based on active tab
  const tabFilteredAlerts = useMemo(() => {
    switch (activeTab) {
      case 'unacknowledged':
        return alerts.filter(a => !a.acknowledged)
      case 'connectivity':
        return alerts.filter(a => a.category === 'connectivity')
      case 'security':
        return alerts.filter(a => a.category === 'security')
      case 'environmental':
        return alerts.filter(a => ['temperature', 'vibration'].includes(a.category))
      case 'system':
        return alerts.filter(a => a.category === 'system')
      default:
        return alerts
    }
  }, [alerts, activeTab])

  // Apply search and filters
  const filteredAlerts = useMemo(() => {
    let filtered = tabFilteredAlerts

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(a =>
        a.title.toLowerCase().includes(term) ||
        a.description.toLowerCase().includes(term) ||
        a.device.toLowerCase().includes(term)
      )
    }

    // Severity filter
    if (severityFilter !== 'all') {
      filtered = filtered.filter(a => a.severity === severityFilter)
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(a => a.category === categoryFilter)
    }

    // Sort: severity desc, then timestamp asc (oldest first)
    const severityPriority = { critical: 1, high: 2, medium: 3, low: 4 }
    filtered.sort((a, b) => {
      const severityDiff = severityPriority[a.severity] - severityPriority[b.severity]
      if (severityDiff !== 0) return severityDiff
      return a.rawTimestamp.getTime() - b.rawTimestamp.getTime()
    })

    return filtered
  }, [tabFilteredAlerts, searchTerm, severityFilter, categoryFilter])

  // Group alerts by category for card view
  const groupedAlerts = useMemo(() => {
    const groups: Record<string, AlertItem[]> = {}
    filteredAlerts.forEach(alert => {
      if (!groups[alert.category]) {
        groups[alert.category] = []
      }
      groups[alert.category]!.push(alert)
    })
    return groups
  }, [filteredAlerts])

  const openAckDialog = (alertId: string, alertTitle?: string) => {
    setAckAlertId(alertId)
    setAckAlertTitle(alertTitle || '')
    setShowAckDialog(true)
  }

  const handleAcknowledgeWithNotes = async (type: AcknowledgementType, notes: string) => {
    if (!currentOrganization || !ackAlertId) return

    try {
      const response = await edgeFunctions.userActions.acknowledgeAlert(ackAlertId, type, notes)

      if (!response.success) {
        toast.error('Failed to acknowledge alert')
        throw new Error('Failed to acknowledge alert')
      }

      setAlerts(prevAlerts =>
        prevAlerts.map(alert =>
          alert.id === ackAlertId
            ? { ...alert, acknowledged: true, acknowledgedBy: 'Current User', acknowledgedAt: new Date() }
            : alert
        )
      )
      
      // Remove from selection
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(ackAlertId)
        return newSet
      })
      
      toast.success(`Alert ${type === 'resolved' ? 'resolved' : type === 'false_positive' ? 'marked as false positive' : type === 'dismissed' ? 'dismissed' : 'acknowledged'}`)
      setAckAlertId(null)
      await fetchAlerts()
    } catch (error) {
      console.error('Error acknowledging alert:', error)
      toast.error('Failed to acknowledge alert')
      throw error
    }
  }

  // Legacy handler for components that call with just an ID (table/card views)
  const handleAcknowledge = (alertId: string) => {
    const alert = alerts.find(a => a.id === alertId)
    openAckDialog(alertId, alert?.title)
  }

  const handleViewDetails = (alert: Alert) => {
    // Convert Alert to AlertItem for the details modal
    const alertItem = alerts.find(a => a.id === alert.id)
    if (alertItem) {
      setSelectedAlert(alertItem)
      setShowDetails(true)
    }
  }

  const handleBulkAcknowledge = async () => {
    if (!currentOrganization || selectedIds.size === 0) return

    setIsProcessing(true)
    try {
      const response = await edgeFunctions.alerts.bulkAcknowledge(
        Array.from(selectedIds),
        currentOrganization.id,
        'acknowledged'
      )

      if (!response.success) {
        toast.error('Failed to acknowledge alerts')
        return
      }

      toast.success(`Successfully acknowledged ${selectedIds.size} alert(s)`)
      setSelectedIds(new Set())
      await fetchAlerts()
    } catch (error) {
      console.error('Error bulk acknowledging alerts:', error)
      toast.error('Failed to acknowledge alerts')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredAlerts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredAlerts.map(a => a.id)))
    }
  }

  const handleClearFilters = () => {
    setSearchTerm('')
    setSeverityFilter('all')
    setCategoryFilter('all')
  }

  const toggleGroupCollapse = (category: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
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

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      temperature: 'Temperature',
      connectivity: 'Device Offline',
      battery: 'Battery',
      vibration: 'Vibration',
      security: 'Security',
      system: 'System'
    }
    return labels[category] || category
  }

  const getSeverityColor = (severity: AlertItem['severity']) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50 dark:bg-red-950 dark:border-red-800'
      case 'high': return 'border-orange-500 bg-orange-50 dark:bg-orange-950 dark:border-orange-800'
      case 'medium': return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800'
      case 'low': return 'border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-800'
      default: return 'border-gray-500 bg-gray-50 dark:bg-gray-900 dark:border-gray-700'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <AlertsSummaryBar 
        alerts={alerts}
        onFilterBySeverity={(severity) => setSeverityFilter(severity)}
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <AlertsFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            severityFilter={severityFilter}
            onSeverityChange={setSeverityFilter}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            onClearFilters={handleClearFilters}
          />
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      <AlertsBulkActions
        selectedCount={selectedIds.size}
        onAcknowledgeSelected={handleBulkAcknowledge}
        onClearSelection={() => setSelectedIds(new Set())}
        isProcessing={isProcessing}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="all">All ({alerts.length})</TabsTrigger>
            <TabsTrigger value="unacknowledged">
              Unacknowledged ({alerts.filter(a => !a.acknowledged).length})
            </TabsTrigger>
            <TabsTrigger value="connectivity">
              Device Offline ({alerts.filter(a => a.category === 'connectivity').length})
            </TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="environmental">Environmental</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>

          {/* View Mode Toggle */}
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('cards')}
            >
              <Grid3x3 className="h-4 w-4 mr-1" />
              Cards
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('table')}
            >
              <Table2 className="h-4 w-4 mr-1" />
              Table
            </Button>
          </div>
        </div>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredAlerts.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-green-600 dark:text-green-500 text-lg">🎉 No alerts in this category</p>
                <p className="text-sm text-muted-foreground mt-1">All systems operating normally</p>
              </CardContent>
            </Card>
          ) : viewMode === 'table' ? (
            <AlertsTable
              alerts={filteredAlerts}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAll}
              onAcknowledge={handleAcknowledge}
              onViewDetails={handleViewDetails}
            />
          ) : (
            // Cards view with grouping
            <div className="space-y-4">
              {Object.entries(groupedAlerts).map(([category, categoryAlerts]) => {
                const isCollapsed = collapsedGroups.has(category)
                const categoryLabel = getCategoryLabel(category)
                
                return (
                  <Card key={category}>
                    <Collapsible open={!isCollapsed} onOpenChange={() => toggleGroupCollapse(category)}>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50">
                          <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center space-x-2">
                              <span className="text-2xl">{getCategoryIcon(category as AlertItem['category'])}</span>
                              <span>{categoryLabel}</span>
                              <span className="text-sm font-normal text-muted-foreground">
                                ({categoryAlerts.length})
                              </span>
                            </CardTitle>
                            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="space-y-3">
                          {categoryAlerts.map((alert) => (
                            <AlertUI key={alert.id} className={getSeverityColor(alert.severity)}>
                              <div className="flex items-start justify-between w-full">
                                <div className="flex items-start space-x-3 flex-1">
                                  <div className="flex flex-col items-center space-y-1">
                                    <span className="text-xl">{getSeverityIcon(alert.severity)}</span>
                                  </div>
                                  <div className="flex-1">
                                    <AlertDescription className="font-medium text-base text-gray-900 dark:text-gray-100">
                                      {alert.title}
                                    </AlertDescription>
                                    <AlertDescription className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                      {alert.description}
                                    </AlertDescription>
                                    <AlertDescription className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                                      <span className="font-medium">{alert.device}</span> • {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                                    </AlertDescription>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end space-y-2">
                                  <div className="flex space-x-2">
                                    {!alert.acknowledged && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openAckDialog(alert.id, alert.title)}
                                      >
                                        Acknowledge
                                      </Button>
                                    )}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedAlert(alert)
                                        setShowDetails(true)
                                      }}
                                    >
                                      Details
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </AlertUI>
                          ))}
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Alert Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <span className="text-2xl">{selectedAlert && getSeverityIcon(selectedAlert.severity)}</span>
                <span className="text-2xl">{selectedAlert && getCategoryIcon(selectedAlert.category)}</span>
                Alert Details
              </DialogTitle>
              <Badge variant={selectedAlert?.severity === 'critical' ? 'destructive' : 'default'}>
                {selectedAlert?.severity?.toUpperCase()}
              </Badge>
            </div>
            <DialogDescription className="sr-only">
              Detailed information about the alert
            </DialogDescription>
          </DialogHeader>

          {selectedAlert && (
            <div className="space-y-6">
              {/* Alert Overview */}
              <div className="space-y-2">
                <h4 className="font-semibold text-lg">{selectedAlert.title}</h4>
                <p className="text-sm text-muted-foreground">{selectedAlert.description}</p>
              </div>

              <Separator />

              {/* Device and Timestamp Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Device</label>
                  <p className="text-sm font-medium mt-1">{selectedAlert.device}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Device ID</label>
                  <p className="text-sm font-mono mt-1 truncate" title={selectedAlert.deviceId}>
                    {selectedAlert.deviceId}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</label>
                  <p className="text-sm capitalize mt-1">{selectedAlert.category}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Timestamp</label>
                  <p className="text-sm mt-1">{selectedAlert.rawTimestamp.toLocaleString()}</p>
                </div>
              </div>

              {/* Threshold Details */}
              {selectedAlert.metadata && (selectedAlert.metadata.sensor_type || selectedAlert.metadata.current_value !== undefined) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="font-semibold">Threshold Details</h4>
                    
                    {selectedAlert.metadata.sensor_name && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sensor</label>
                        <p className="text-sm font-medium mt-1">{selectedAlert.metadata.sensor_name}</p>
                      </div>
                    )}

                    {selectedAlert.metadata.breach_type && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Breach Type</label>
                        <p className="text-sm mt-1">
                          <Badge variant={selectedAlert.metadata.breach_type.includes('critical') ? 'destructive' : 'default'}>
                            {selectedAlert.metadata.breach_type.replace(/_/g, ' ').toUpperCase()}
                          </Badge>
                        </p>
                      </div>
                    )}

                    {selectedAlert.metadata.current_value !== undefined && (
                      <div className="bg-muted p-4 rounded-lg">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Value</label>
                        <p className="text-2xl font-bold mt-1">
                          {selectedAlert.metadata.current_value.toFixed(2)}
                          {selectedAlert.metadata.temperature_unit === 'fahrenheit' ? '°F' : 
                           selectedAlert.metadata.temperature_unit === 'celsius' ? '°C' : ''}
                        </p>
                      </div>
                    )}

                    {/* Threshold Values */}
                    <div className="grid grid-cols-2 gap-3">
                      {selectedAlert.metadata.critical_max !== undefined && selectedAlert.metadata.critical_max !== null && (
                        <div className="border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 p-3 rounded-lg">
                          <label className="text-xs font-medium text-red-700 dark:text-red-300 uppercase tracking-wide">
                            Critical Max
                          </label>
                          <p className="text-lg font-semibold text-red-900 dark:text-red-100 mt-1">
                            {selectedAlert.metadata.critical_max}
                            {selectedAlert.metadata.temperature_unit === 'fahrenheit' ? '°F' : 
                             selectedAlert.metadata.temperature_unit === 'celsius' ? '°C' : ''}
                          </p>
                        </div>
                      )}

                      {selectedAlert.metadata.critical_min !== undefined && selectedAlert.metadata.critical_min !== null && (
                        <div className="border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 p-3 rounded-lg">
                          <label className="text-xs font-medium text-red-700 dark:text-red-300 uppercase tracking-wide">
                            Critical Min
                          </label>
                          <p className="text-lg font-semibold text-red-900 dark:text-red-100 mt-1">
                            {selectedAlert.metadata.critical_min}
                            {selectedAlert.metadata.temperature_unit === 'fahrenheit' ? '°F' : 
                             selectedAlert.metadata.temperature_unit === 'celsius' ? '°C' : ''}
                          </p>
                        </div>
                      )}

                      {selectedAlert.metadata.max_value !== undefined && selectedAlert.metadata.max_value !== null && (
                        <div className="border border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800 p-3 rounded-lg">
                          <label className="text-xs font-medium text-orange-700 dark:text-orange-300 uppercase tracking-wide">
                            Max Threshold
                          </label>
                          <p className="text-lg font-semibold text-orange-900 dark:text-orange-100 mt-1">
                            {selectedAlert.metadata.max_value}
                            {selectedAlert.metadata.temperature_unit === 'fahrenheit' ? '°F' : 
                             selectedAlert.metadata.temperature_unit === 'celsius' ? '°C' : ''}
                          </p>
                        </div>
                      )}

                      {selectedAlert.metadata.min_value !== undefined && selectedAlert.metadata.min_value !== null && (
                        <div className="border border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800 p-3 rounded-lg">
                          <label className="text-xs font-medium text-orange-700 dark:text-orange-300 uppercase tracking-wide">
                            Min Threshold
                          </label>
                          <p className="text-lg font-semibold text-orange-900 dark:text-orange-100 mt-1">
                            {selectedAlert.metadata.min_value}
                            {selectedAlert.metadata.temperature_unit === 'fahrenheit' ? '°F' : 
                             selectedAlert.metadata.temperature_unit === 'celsius' ? '°C' : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Acknowledgment Status */}
              <Separator />
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
                <p className={`text-sm font-medium mt-1 ${selectedAlert.acknowledged ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                  {selectedAlert.acknowledged ? '✓ Acknowledged' : '⚠ Active'}
                </p>
                {selectedAlert.acknowledged && selectedAlert.acknowledgedBy && (
                  <div className="mt-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      Acknowledged by <span className="font-medium">{selectedAlert.acknowledgedBy}</span>
                    </p>
                    {selectedAlert.acknowledgedAt && (
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        {selectedAlert.acknowledgedAt.toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Test Alert Indicator */}
              {selectedAlert.metadata?.is_test && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                    🧪 This is a test alert
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Close
            </Button>
            {selectedAlert && !selectedAlert.acknowledged && (
              <Button 
                onClick={() => {
                  setShowDetails(false)
                  openAckDialog(selectedAlert.id, selectedAlert.title)
                }}
              >
                Acknowledge Alert
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Acknowledge Alert Dialog */}
      <AcknowledgeAlertDialog
        open={showAckDialog}
        onOpenChange={setShowAckDialog}
        alertTitle={ackAlertTitle}
        onConfirm={handleAcknowledgeWithNotes}
      />
    </div>
  )
}
