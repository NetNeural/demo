export interface Device {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning' | 'error' | 'maintenance';
  last_seen?: string;
}

export interface DevicePerformance {
  device_id: string;
  device_name: string;
  uptime_percentage: number;
  data_points_count: number;
  last_error?: string;
  last_error_time?: string | null;
  avg_battery?: number;
  avg_rssi?: number;
}

export interface AlertStats {
  total_alerts: number;
  critical_alerts: number;
  high_alerts: number;
  medium_alerts: number;
  low_alerts: number;
  resolved_alerts: number;
  pending_alerts: number;
  avg_response_time_minutes?: number;
  avg_resolution_time_minutes?: number;
}

export interface SystemHealth {
  overall_health: number;
  connectivity_rate: number;
  error_rate: number;
  performance_score: number;
  avg_battery_health: number;
  avg_data_collection_rate: number;
}

export interface AnalyticsData {
  devicePerformance: DevicePerformance[];
  alertStats: AlertStats;
  systemHealth: SystemHealth;
}

export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';

export function getTimeRangeHours(range: TimeRange): number {
  const map: Record<TimeRange, number> = {
    '1h': 1,
    '6h': 6,
    '24h': 24,
    '7d': 168,
    '30d': 720,
  };
  return map[range];
}
