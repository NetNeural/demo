'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, Calendar } from 'lucide-react'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/contexts/OrganizationContext'
import type { Device } from '@/types/sensor-details'

interface HistoricalDataViewerProps {
  device: Device
}

type TimeRange = '24H' | '48H' | '7D' | '30D' | '90D'

export function HistoricalDataViewer({ device }: HistoricalDataViewerProps) {
  const { currentOrganization } = useOrganization()
  const [selectedRange, setSelectedRange] = useState<TimeRange>('48H')
  const [loading, setLoading] = useState(false)
  const [historicalData, setHistoricalData] = useState<any[]>([])

  const fetchHistoricalData = useCallback(async (range: TimeRange) => {
    if (!currentOrganization) return

    setLoading(true)
    try {
      const supabase = createClient()
      
      // Calculate time range
      let hoursAgo = 48
      if (range === '24H') hoursAgo = 24
      if (range === '7D') hoursAgo = 24 * 7
      if (range === '30D') hoursAgo = 24 * 30
      if (range === '90D') hoursAgo = 24 * 90

      const startTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()

      const { data, error } = await supabase
        .from('device_telemetry_history')
        .select('*')
        .eq('device_id', device.id)
        .eq('organization_id', currentOrganization.id)
        .gte('received_at', startTime)
        .order('received_at', { ascending: false })
        .limit(1000)

      if (error) throw error
      setHistoricalData(data || [])
    } catch (err) {
      console.error('[HistoricalDataViewer] Error:', err)
    } finally {
      setLoading(false)
    }
  }, [device.id, currentOrganization])

  const exportToCSV = () => {
    if (historicalData.length === 0) return

    const headers = ['Timestamp', 'Sensor Type', 'Value', 'Unit']
    const rows = historicalData.map(row => [
      row.received_at,
      row.telemetry?.sensor || 'Unknown',
      row.telemetry?.value || '',
      row.telemetry?.units || ''
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${device.name}-${selectedRange}-${new Date().toISOString()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            🗃️ Historical Data
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={exportToCSV}
              disabled={historicalData.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Time Range Selector */}
        <div className="flex flex-wrap gap-2">
          {(['24H', '48H', '7D', '30D', '90D'] as TimeRange[]).map(range => (
            <Button
              key={range}
              size="sm"
              variant={selectedRange === range ? 'default' : 'outline'}
              onClick={() => {
                setSelectedRange(range)
                fetchHistoricalData(range)
              }}
            >
              {range}
            </Button>
          ))}
        </div>

        {/* Data Summary */}
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Loading...</p>
        ) : historicalData.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Data Points:</span>
              <Badge variant="secondary">{historicalData.length.toLocaleString()}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Time Range:</span>
              <span className="font-medium">{selectedRange}</span>
            </div>
            <p className="text-xs text-muted-foreground pt-3 border-t">
              Click &ldquo;Load Data&rdquo; to view detailed historical readings
            </p>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">Select a time range to load historical data</p>
            <Button onClick={() => fetchHistoricalData(selectedRange)}>
              Load {selectedRange} Data
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
