'use client'

import { useState, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Settings2,
  Download,
  Loader2,
  Archive,
  RefreshCw,
  CheckCircle2,
  FileJson,
  FileSpreadsheet,
} from 'lucide-react'
import ExecutiveReportsCard from './ExecutiveReportsCard'

interface Props {
  organizationId: string
}

export default function AdminToolsTab({ organizationId }: Props) {
  const supabase = createClient()
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv')
  const [exportType, setExportType] = useState<string>('telemetry')
  const [exporting, setExporting] = useState(false)
  const [bulkAction, setBulkAction] = useState<string | null>(null)

  const handleExport = async () => {
    if (!organizationId) return
    setExporting(true)
    try {
      let data: Record<string, unknown>[] = []
      let filename = ''

      switch (exportType) {
        case 'telemetry': {
          const { data: telemetry, error } = await supabase
            .from('device_telemetry_history')
            .select(
              'device_id, telemetry, received_at, device_timestamp, organization_id'
            )
            .eq('organization_id', organizationId)
            .order('received_at', { ascending: false })
            .limit(5000)
          if (error) throw error
          data = telemetry || []
          filename = `telemetry-export-${new Date().toISOString().slice(0, 10)}`
          break
        }
        case 'alerts': {
          const { data: alerts, error } = await supabase
            .from('alerts')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .limit(5000)
          if (error) throw error
          data = alerts || []
          filename = `alerts-export-${new Date().toISOString().slice(0, 10)}`
          break
        }
        case 'audit_logs': {
          const { data: logs, error } = await supabase
            .from('user_audit_log')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .limit(5000)
          if (error) throw error
          data = logs || []
          filename = `audit-logs-export-${new Date().toISOString().slice(0, 10)}`
          break
        }
        case 'devices': {
          const { data: devices, error } = await supabase
            .from('devices')
            .select('*')
            .eq('organization_id', organizationId)
            .order('name')
          if (error) throw error
          data = devices || []
          filename = `devices-export-${new Date().toISOString().slice(0, 10)}`
          break
        }
      }

      if (data.length === 0) {
        toast.info('No data to export')
        return
      }

      let blob: Blob
      if (exportFormat === 'json') {
        blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        })
        filename += '.json'
      } else {
        // CSV
        const headers = Object.keys(data[0] as Record<string, unknown>)
        const csvRows = [
          headers.join(','),
          ...data.map((row) =>
            headers
              .map((h) => {
                const val = (row as Record<string, unknown>)[h]
                const str =
                  typeof val === 'object'
                    ? JSON.stringify(val)
                    : String(val ?? '')
                return `"${str.replace(/"/g, '""')}"`
              })
              .join(',')
          ),
        ]
        blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
        filename += '.csv'
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(
        `Exported ${data.length} records as ${exportFormat.toUpperCase()}`
      )
    } catch (err) {
      console.error('Export failed:', err)
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const handleBulkArchiveAlerts = async () => {
    setBulkAction('archive-alerts')
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data, error } = await supabase
        .from('alerts')
        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
        .eq('organization_id', organizationId)
        .eq('is_resolved', true)
        .lt('created_at', thirtyDaysAgo.toISOString())
        .select('id')

      if (error) throw error
      const count = data?.length || 0
      toast.success(`Archived ${count} old acknowledged alerts`)
    } catch (err) {
      console.error('Bulk archive failed:', err)
      toast.error('Failed to archive alerts')
    } finally {
      setBulkAction(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Executive Reports */}
      <ExecutiveReportsCard organizationId={organizationId} />

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Data Export
          </CardTitle>
          <CardDescription>
            Export organization data as CSV or JSON (up to 5,000 records)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={exportType} onValueChange={setExportType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="telemetry">Telemetry Data</SelectItem>
                <SelectItem value="alerts">Alerts</SelectItem>
                <SelectItem value="audit_logs">Audit Logs</SelectItem>
                <SelectItem value="devices">Devices</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={exportFormat}
              onValueChange={(v) => setExportFormat(v as 'csv' | 'json')}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-1">
                    <FileSpreadsheet className="h-4 w-4" /> CSV
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center gap-1">
                    <FileJson className="h-4 w-4" /> JSON
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1 h-4 w-4" />
              )}
              {exporting ? 'Exporting...' : 'Export'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Operations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Bulk Operations
          </CardTitle>
          <CardDescription>
            Batch administrative actions (use with caution)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Archive Old Alerts</p>
                <p className="text-xs text-muted-foreground">
                  Archives acknowledged alerts older than 30 days
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkArchiveAlerts}
                disabled={bulkAction === 'archive-alerts'}
              >
                {bulkAction === 'archive-alerts' ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Archive className="mr-1 h-4 w-4" />
                )}
                Archive
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
