import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Download } from 'lucide-react'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import type { TimeRange } from '../types/analytics.types'
import type { OrganizationSettings } from '@/types/organization'

interface AnalyticsHeaderProps {
  organizationName: string
  organizationSettings?: OrganizationSettings
  timeRange: TimeRange
  onTimeRangeChange: (range: TimeRange) => void
  onExport: () => void
}

export function AnalyticsHeader({
  organizationName,
  organizationSettings,
  timeRange,
  onTimeRangeChange,
  onExport,
}: AnalyticsHeaderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <OrganizationLogo
            settings={organizationSettings}
            name={organizationName || 'NetNeural'}
            size="xl"
          />
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {organizationName} AI Analytics
            </h2>
            <p className="text-muted-foreground">
              AI-powered insights, forecasting, and fleet health for{' '}
              {organizationName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={timeRange}
            onValueChange={(v) => onTimeRangeChange(v as TimeRange)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={onExport} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>
    </div>
  )
}
