'use client'

import { HelpCircle } from 'lucide-react'
import { useState } from 'react'

interface MetricTooltipProps {
  metric: string
  definition: string
  calculation?: string
  example?: string
}

export function MetricTooltip({
  metric,
  definition,
  calculation,
  example,
}: MetricTooltipProps) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative inline-flex">
      <button
        className="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => {
          e.stopPropagation()
          setShow(!show)
        }}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {show && (
        <div className="absolute left-0 top-6 z-50 w-72 rounded-md border bg-popover p-3 text-popover-foreground shadow-md">
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold">{metric}</p>
              <p className="mt-1 text-xs text-muted-foreground">{definition}</p>
            </div>
            {calculation && (
              <div className="border-t pt-2">
                <p className="text-xs font-medium">Calculation:</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {calculation}
                </p>
              </div>
            )}
            {example && (
              <div className="border-t pt-2">
                <p className="text-xs font-medium">Example:</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {example}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Common metric definitions
export const METRIC_DEFINITIONS = {
  totalDevices: {
    metric: 'Total Devices',
    definition:
      'The total number of devices registered in your organization, including both online and offline devices.',
    calculation: 'COUNT(devices WHERE organization_id = current_org)',
    example: 'If you have 50 sensors deployed, this shows 50.',
  },
  onlineDevices: {
    metric: 'Online Devices',
    definition:
      'Devices that have sent telemetry data within the last 5 minutes.',
    calculation: 'COUNT(devices WHERE last_seen > NOW() - 5 minutes)',
    example: 'A device is "online" if it reported within the last 5 minutes.',
  },
  activeAlerts: {
    metric: 'Active Alerts',
    definition:
      'Unresolved alerts that require attention. Does not include resolved or dismissed alerts.',
    calculation:
      'COUNT(alerts WHERE is_resolved = false AND organization_id = current_org)',
    example:
      "If 3 sensors triggered alerts today and they haven't been acknowledged, this shows 3.",
  },
  uptimePercentage: {
    metric: 'Uptime %',
    definition:
      'Percentage of time the device has been online in the selected period.',
    calculation: '(online_hours / total_hours) × 100',
    example: 'A device online for 23 of 24 hours has 95.8% uptime.',
  },
  batteryLevel: {
    metric: 'Battery Level',
    definition: 'Current battery charge percentage reported by the device.',
    calculation: 'Latest telemetry.battery value',
    example: '85% means the device has 85% charge remaining.',
  },
  rssi: {
    metric: 'Signal Strength (RSSI)',
    definition:
      'Received Signal Strength Indicator in dBm. Higher (closer to 0) is better.',
    calculation: 'Latest telemetry.rssi value',
    example: '-65 dBm is excellent, -85 dBm is fair, -100 dBm is poor.',
  },
  dataPoints: {
    metric: 'Data Points',
    definition:
      'Total number of telemetry readings received in the selected time period.',
    calculation:
      'COUNT(telemetry_history WHERE device_id = current_device AND received_at >= start_date)',
    example:
      'A device reporting every minute for 24 hours generates 1,440 data points.',
  },
  responseTime: {
    metric: 'Alert Response Time',
    definition:
      'Average time between alert creation and acknowledgment by a user.',
    calculation: 'AVG(acknowledged_at - created_at) for resolved alerts',
    example:
      'If alerts are typically acknowledged in 15 minutes, this shows "15 min".',
  },
  recentExports: {
    metric: 'Recent Exports',
    definition:
      'Number of data exports (CSV, JSON) performed in the last 7 days.',
    calculation:
      'COUNT(audit_log WHERE action_category = "export" AND created_at >= NOW() - 7 days)',
    example: 'If you exported 5 reports this week, this shows 5.',
  },
  confidence: {
    metric: 'AI Confidence',
    definition:
      'Statistical confidence of the AI prediction, based on data quality and quantity.',
    calculation:
      'R² (coefficient of determination) for regression models, or model accuracy score',
    example: "0.85 (85%) means the model's predictions are highly reliable.",
  },
} as const

export type MetricKey = keyof typeof METRIC_DEFINITIONS
