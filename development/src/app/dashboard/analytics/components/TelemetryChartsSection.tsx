import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TelemetryLineChart } from '@/components/telemetry/TelemetryLineChart';
import type { TimeRange } from '../types/analytics.types';

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
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Telemetry Trends</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {CHARTS.map(({ metric, label, description, unit }) => (
          <Card key={metric} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base">{label}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <TelemetryLineChart
                organizationId={organizationId}
                metric={metric}
                metricLabel={label}
                timeRange={timeRange}
                unit={unit}
                height={280}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
