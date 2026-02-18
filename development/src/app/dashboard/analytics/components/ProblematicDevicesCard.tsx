'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  WifiOff,
  BatteryWarning,
  SignalLow,
  DatabaseZap,
  CheckCircle,
} from 'lucide-react';
import type { DevicePerformance } from '../types/analytics.types';

interface ProblematicDevicesCardProps {
  devices: DevicePerformance[];
}

type IssueType = 'offline' | 'intermittent' | 'low_battery' | 'weak_signal' | 'data_gaps';

interface DeviceIssue {
  device: DevicePerformance;
  issues: {
    type: IssueType;
    label: string;
    detail: string;
    severity: 'critical' | 'warning';
  }[];
}

const ISSUE_CONFIG: Record<IssueType, { icon: typeof AlertTriangle; color: string }> = {
  offline: { icon: WifiOff, color: 'text-red-500' },
  intermittent: { icon: AlertTriangle, color: 'text-orange-500' },
  low_battery: { icon: BatteryWarning, color: 'text-yellow-500' },
  weak_signal: { icon: SignalLow, color: 'text-amber-500' },
  data_gaps: { icon: DatabaseZap, color: 'text-purple-500' },
};

function classifyDevice(device: DevicePerformance): DeviceIssue['issues'] {
  const issues: DeviceIssue['issues'] = [];

  // Offline: uptime < 5% means essentially no data
  if (device.uptime_percentage < 5) {
    issues.push({
      type: 'offline',
      label: 'Offline',
      detail: `${device.uptime_percentage.toFixed(0)}% uptime — device appears completely offline`,
      severity: 'critical',
    });
  }
  // Intermittent: some data but unreliable (5-50% uptime)
  else if (device.uptime_percentage < 50) {
    issues.push({
      type: 'intermittent',
      label: 'Intermittent',
      detail: `${device.uptime_percentage.toFixed(0)}% uptime — connecting and dropping frequently`,
      severity: 'warning',
    });
  }

  // Data gaps: very few data points relative to expected
  if (device.data_points_count < 10 && device.uptime_percentage >= 5) {
    issues.push({
      type: 'data_gaps',
      label: 'Data Gaps',
      detail: `Only ${device.data_points_count} data points received — expected much more`,
      severity: 'warning',
    });
  }

  // Low battery
  if (device.avg_battery !== undefined && device.avg_battery < 20) {
    issues.push({
      type: 'low_battery',
      label: device.avg_battery < 10 ? 'Critical Battery' : 'Low Battery',
      detail: `Average battery ${device.avg_battery.toFixed(0)}%`,
      severity: device.avg_battery < 10 ? 'critical' : 'warning',
    });
  }

  // Weak signal
  if (device.avg_rssi !== undefined && device.avg_rssi < -90) {
    issues.push({
      type: 'weak_signal',
      label: 'Weak Signal',
      detail: `Average RSSI ${device.avg_rssi.toFixed(0)} dBm — poor connectivity expected`,
      severity: device.avg_rssi < -100 ? 'critical' : 'warning',
    });
  }

  // Has recent errors
  if (device.last_error) {
    // Only add if not already flagged as offline
    if (!issues.find(i => i.type === 'offline')) {
      issues.push({
        type: 'offline',
        label: 'Error',
        detail: device.last_error,
        severity: 'critical',
      });
    }
  }

  return issues;
}

export function ProblematicDevicesCard({ devices }: ProblematicDevicesCardProps) {
  const problematicDevices = useMemo(() => {
    return devices
      .map((device) => ({
        device,
        issues: classifyDevice(device),
      }))
      .filter((d) => d.issues.length > 0)
      .sort((a, b) => {
        // Sort by severity: critical first, then by number of issues
        const aCritical = a.issues.filter(i => i.severity === 'critical').length;
        const bCritical = b.issues.filter(i => i.severity === 'critical').length;
        if (aCritical !== bCritical) return bCritical - aCritical;
        return b.issues.length - a.issues.length;
      });
  }, [devices]);

  const criticalCount = problematicDevices.filter(d => d.issues.some(i => i.severity === 'critical')).length;
  const warningCount = problematicDevices.length - criticalCount;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Devices Needing Attention
            </CardTitle>
            <CardDescription>
              {problematicDevices.length === 0
                ? 'All devices operating normally'
                : `${problematicDevices.length} of ${devices.length} devices with issues`}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} critical
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                {warningCount} warning
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {problematicDevices.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
            <span className="text-sm">All {devices.length} devices healthy</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {problematicDevices.slice(0, 10).map(({ device, issues }) => {
                const hasCritical = issues.some(i => i.severity === 'critical');
                return (
                  <div
                    key={device.device_id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      hasCritical ? 'border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900' : 'border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20 dark:border-yellow-900'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{device.device_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {device.uptime_percentage.toFixed(0)}% uptime · {device.data_points_count} data points
                        {device.avg_battery != null && ` · ${device.avg_battery.toFixed(0)}% battery`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                      {issues.map((issue) => {
                        const config = ISSUE_CONFIG[issue.type];
                        const Icon = config.icon;
                        return (
                          <div key={issue.type} className="cursor-help" title={`${issue.label}: ${issue.detail}`}>
                            <Icon className={`w-4 h-4 ${config.color}`} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            {problematicDevices.length > 10 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                + {problematicDevices.length - 10} more devices with issues
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
