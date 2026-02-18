'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TelemetryLineChart } from '@/components/telemetry/TelemetryLineChart';
import { createClient } from '@/lib/supabase/client';
import type { TimeRange } from '../types/analytics.types';

interface OrgDevice {
  id: string;
  name: string;
}

interface TelemetryChartsSectionProps {
  organizationId: string;
  timeRange: TimeRange;
}

const CHARTS = [
  { metric: 'temperature', label: 'Temperature', description: 'Real-time temperature monitoring', unit: '°C' },
  { metric: 'battery', label: 'Battery Level', description: 'Fleet-wide battery health', unit: '%' },
  { metric: 'rssi', label: 'Signal Strength', description: 'Network connectivity quality', unit: 'dBm' },
  { metric: 'humidity', label: 'Humidity', description: 'Environmental conditions', unit: '%' },
] as const;

export function TelemetryChartsSection({ organizationId, timeRange }: TelemetryChartsSectionProps) {
  const [devices, setDevices] = useState<OrgDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const supabase = createClient();

  const fetchDevices = useCallback(async () => {
    if (!organizationId) return;
    const { data, error } = await supabase
      .from('devices')
      .select('id, name')
      .eq('organization_id', organizationId)
      .order('name');

    if (!error && data) {
      setDevices(data as OrgDevice[]);
    }
  }, [organizationId, supabase]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Build device name lookup for chart legends
  const deviceNames: Record<string, string> = {};
  for (const d of devices) {
    deviceNames[d.id] = d.name;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Telemetry Trends</h2>
        <Select value={selectedDevice} onValueChange={setSelectedDevice}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select device" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Devices</SelectItem>
            {devices.map((device) => (
              <SelectItem key={device.id} value={device.id}>
                {device.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {CHARTS.map(({ metric, label, description, unit }) => (
          <Card key={metric} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{label}</CardTitle>
              <CardDescription>
                {selectedDevice === 'all'
                  ? description
                  : `${deviceNames[selectedDevice] || 'Device'} — ${description.toLowerCase()}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TelemetryLineChart
                organizationId={organizationId}
                deviceId={selectedDevice === 'all' ? undefined : selectedDevice}
                metric={metric}
                metricLabel={label}
                timeRange={timeRange}
                unit={unit}
                height={280}
                deviceNames={deviceNames}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
