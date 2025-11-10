/**
 * Unified Device Status Types
 * Provider-agnostic types for device status across all integrations
 */

export type DeviceConnectionStatus = 'online' | 'offline' | 'warning' | 'error' | 'unknown';

export interface DeviceHealthMetrics {
  battery?: number; // 0-100 percentage
  signalStrength?: number; // dBm or percentage
  temperature?: number; // Celsius
  memory?: {
    used: number;
    total: number;
    unit: 'bytes' | 'kb' | 'mb' | 'gb';
  };
  cpu?: number; // 0-100 percentage
}

export interface DeviceFirmwareInfo {
  version: string;
  components?: Array<{
    name: string;
    version: string;
    lastUpdated?: string;
  }>;
  updateAvailable?: boolean;
  updateVersion?: string;
}

export interface DeviceLocationInfo {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  lastUpdated?: string;
}

export interface DeviceConnectionInfo {
  type?: 'wifi' | 'cellular' | 'ethernet' | 'bluetooth' | 'other';
  lastConnected?: string;
  lastDisconnected?: string;
  uptime?: number; // seconds
  ip?: string;
  mac?: string;
}

export interface UnifiedDeviceStatus {
  // Core identification
  deviceId: string;
  externalDeviceId: string;
  organizationId: string;
  integrationId: string;
  providerType: string;

  // Status
  status: DeviceConnectionStatus;
  lastSeen: string | null;
  lastSeenOnline: string | null;
  lastSeenOffline: string | null;

  // Device info
  name: string;
  deviceType: string;
  hardwareIds?: string[];
  cohortId?: string | null;

  // Health metrics
  health?: DeviceHealthMetrics;

  // Firmware
  firmware?: DeviceFirmwareInfo;

  // Location
  location?: DeviceLocationInfo;

  // Connection
  connection?: DeviceConnectionInfo;

  // Provider-specific metadata
  metadata?: Record<string, unknown>;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface DeviceStatusAPIResponse {
  success: boolean;
  data?: UnifiedDeviceStatus;
  error?: {
    code: string;
    message: string;
  };
}
