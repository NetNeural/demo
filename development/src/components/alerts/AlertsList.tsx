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

type ViewMode = 'cards' | 'table'
type TabType = 'all' | 'unacknowledged' | 'connectivity' | 'security' | 'environmental' | 'system'

export function AlertsList() {
  const { currentOrganization } = useOrganization()
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  
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

  const handleAcknowledge = async (alertId: string) => {
    if (!currentOrganization) return

    try {
      const response = await edgeFunctions.userActions.acknowledgeAlert(alertId, 'acknowledged')

      if (!response.success) {
        toast.error('Failed to acknowledge alert')
        return
      }

      setAlerts(prevAlerts =>
        prevAlerts.map(alert =>
          alert.id === alertId
            ? { ...alert, acknowledged: true, acknowledgedBy: 'Current User', acknowledgedAt: new Date() }
            : alert
        )
      )
      
      // Remove from selection
      setSelectedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(alertId)
        return newSet
      })
      
      toast.success('Alert acknowledged')
      await fetchAlerts()
    } catch (error) {
      console.error('Error acknowledging alert:', error)
      toast.error('Failed to acknowledge alert')
    }
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
                                      <span className="font-medium">{alert.device}</span> • {alert.timestamp}
                                    </AlertDescription>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end space-y-2">
                                  <div className="flex space-x-2">
                                    {!alert.acknowledged && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleAcknowledge(alert.id)}
                                      >
                                        Acknowledge
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setSelectedAlert(alert)}
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
    </div>
  )
}
