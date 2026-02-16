// ============================================================================
// Sensor Details Types - Issue #105
// ============================================================================

export interface SensorReading {
  id: string
  device_id: string
  sensor_type: string
  value: number
  unit: string | null
  quality: number | null
  timestamp: string
  metadata?: Record<string, any>
}

export interface SensorThreshold {
  id: string
  device_id: string
  sensor_type: string
  min_value: number | null
  max_value: number | null
  critical_min: number | null
  critical_max: number | null
  alert_enabled: boolean
  alert_message: string | null
  alert_severity: 'low' | 'medium' | 'high' | 'critical'
  notify_on_breach: boolean
  notification_cooldown_minutes: number
  last_notification_at: string | null
  notify_user_ids: string[] | null
  notify_emails: string[] | null
  notification_channels: string[] | null
  created_at: string
  updated_at: string
}

export interface SensorActivity {
  id: string
  device_id: string
  sensor_type: string
  activity_type: 
    | 'threshold_updated'
    | 'alert_triggered'
    | 'alert_resolved'
    | 'calibration'
    | 'maintenance'
    | 'status_change'
    | 'anomaly_detected'
    | 'manual_override'
    | 'configuration_change'
  description: string | null
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical' | null
  previous_value: Record<string, any> | null
  new_value: Record<string, any> | null
  performed_by: string | null
  performed_by_name: string | null
  metadata: Record<string, any>
  related_alert_id: string | null
  occurred_at: string
  created_at: string
}

export interface SensorStatistics {
  current: number
  min: number
  max: number
  avg: number
  stddev: number
  readings_count: number
  last_updated: string
}

export interface SensorTrendPoint {
  timestamp: string
  value: number
  quality: number | null
}

export interface Device {
  id: string
  name: string
  device_type: string
  model?: string
  serial_number?: string
  status: 'online' | 'offline' | 'warning' | 'error' | 'maintenance'
  location?: string
  firmware_version?: string
  battery_level?: number
  signal_strength?: number
  last_seen?: string
  metadata?: Record<string, any>
}

export interface SensorDetailsData {
  device: Device
  sensor_type: string
  latest_reading: SensorReading | null
  trend_data: SensorTrendPoint[]
  statistics: SensorStatistics | null
  threshold: SensorThreshold | null
  recent_activity: SensorActivity[]
  available_sensors: string[]
}

export interface TelemetryResponse {
  success: boolean
  data?: {
    readings: SensorReading[]
    statistics: SensorStatistics | null
    device: Device
  }
  error?: {
    code: string
    message: string
  }
}

export interface ExportOptions {
  format: 'csv' | 'excel' | 'json' | 'pdf'
  date_range: {
    start: string
    end: string
  }
  include_statistics?: boolean
  include_thresholds?: boolean
  include_activity?: boolean
}

export type TimeRange = '48h' | '7d' | '30d' | '90d' | 'custom'

export interface TimeRangeOption {
  value: TimeRange
  label: string
  hours: number
}

export const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { value: '48h', label: 'Last 48 Hours', hours: 48 },
  { value: '7d', label: 'Last 7 Days', hours: 168 },
  { value: '30d', label: 'Last 30 Days', hours: 720 },
  { value: '90d', label: 'Last 90 Days', hours: 2160 },
  { value: 'custom', label: 'Custom Range', hours: 0 },
]
