import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download } from 'lucide-react';
import type { TimeRange } from '../types/analytics.types';

interface AnalyticsHeaderProps {
  organizationName: string;
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  onExport: () => void;
}

export function AnalyticsHeader({ organizationName, timeRange, onTimeRangeChange, onExport }: AnalyticsHeaderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">AI Analytics</h1>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={(v) => onTimeRangeChange(v as TimeRange)}>
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
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground">
        AI-powered insights, forecasting, and fleet health for {organizationName}
      </p>
    </div>
  );
}
