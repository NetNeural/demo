/**
 * Golioth Integration Provider
 * =============================
 * Implementation of DeviceIntegrationProvider for Golioth IoT Platform
 * 
 * This provider wraps the existing GoliothAPI client and provides a
 * standardized interface for use with the generic sync orchestrator.
 * 
 * Date: 2025-11-09
 * Issue: #82 - Common Integration Provider Interface
 */

import { GoliothAPI, GoliothDevice } from '@/lib/golioth';
import {
  DeviceIntegrationProvider,
  DeviceListResult,
  DeviceData,
  DeviceStatus,
  DeviceUpdate,
  TelemetryQuery,
  TelemetryData,
  TestConnectionResult,
  PaginationOptions,
  ProviderCapabilities,
} from './base-integration-provider';

export interface GoliothProviderConfig {
  apiKey: string;
  projectId: string;
  baseUrl?: string;
}

export class GoliothIntegrationProvider extends DeviceIntegrationProvider {
  providerId: string;
  providerType = 'golioth' as const;
  providerName = 'Golioth IoT Platform';

  private api: GoliothAPI;
  private config: GoliothProviderConfig;

  constructor(config: GoliothProviderConfig) {
    super();
    this.config = config;
    this.providerId = `golioth-${config.projectId}`;
    
    // Initialize Golioth API client
    this.api = new GoliothAPI({
      apiKey: config.apiKey,
      projectId: config.projectId,
      baseUrl: config.baseUrl,
    });
  }

  /**
   * Test connection to Golioth
   */
  async testConnection(): Promise<TestConnectionResult> {
    const startTime = Date.now();
    
    try {
      // Try to fetch devices as a connection test
      await this.api.getDevices();
      const latency = Date.now() - startTime;
      
      return {
        success: true,
        message: 'Successfully connected to Golioth',
        latency,
        details: {
          projectId: this.config.projectId,
          endpoint: this.config.baseUrl || 'https://api.golioth.io',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * List all devices from Golioth
   */
  async listDevices(options?: PaginationOptions): Promise<DeviceListResult> {
    const devices = await this.api.getDevices();
    
    // Map Golioth devices to generic format
    const genericDevices = devices.map((d) => this.mapToGenericDevice(d));
    
    // Apply pagination if needed
    const page = options?.page || 1;
    const limit = options?.limit || genericDevices.length;
    const offset = options?.offset || (page - 1) * limit;
    
    const paginatedDevices = genericDevices.slice(offset, offset + limit);
    
    return {
      devices: paginatedDevices,
      total: genericDevices.length,
      page,
      limit,
    };
  }

  /**
   * Get a specific device from Golioth
   */
  async getDevice(deviceId: string): Promise<DeviceData> {
    const device = await this.api.getDevice(deviceId);
    
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }
    
    return this.mapToGenericDevice(device);
  }

  /**
   * Get real-time device status
   */
  async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    const device = await this.api.getDevice(deviceId);
    
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }
    
    // Extract firmware info from metadata
    const firmwareVersion = device.metadata?.firmware_version as string | undefined;
    const updateInfo = device.metadata?.update as Record<string, unknown> | undefined;
    
    const firmware = {
      version: firmwareVersion || 'unknown',
      updateAvailable: false,
      components: updateInfo ? this.parseFirmwareComponents(updateInfo) : undefined,
    };
    
    // Extract health metrics
    const battery = device.metadata?.battery_level as number | undefined;
    const signal = device.metadata?.signal_strength as number | undefined;
    const temp = device.metadata?.temperature as number | undefined;
    
    return {
      connectionState: device.status,
      lastActivity: new Date(device.lastSeenOnline || device.last_seen || device.updated_at),
      firmware,
      telemetry: device.metadata || {},
      health: {
        battery,
        signalStrength: signal,
        temperature: temp,
      },
    };
  }

  /**
   * Update device information in Golioth
   */
  async updateDevice(
    deviceId: string,
    updates: DeviceUpdate
  ): Promise<DeviceData> {
    const updatedDevice = await this.api.updateDevice(deviceId, {
      name: updates.name,
      tags: updates.tags,
      metadata: updates.metadata,
    });
    
    return this.mapToGenericDevice(updatedDevice);
  }

  /**
   * Query telemetry data (placeholder - Golioth API doesn't expose this yet)
   */
  async queryTelemetry(_query: TelemetryQuery): Promise<TelemetryData[]> {
    // Note: Golioth API doesn't currently provide a telemetry query endpoint
    // This would need to be implemented when Golioth adds this feature
    // For now, return empty array
    console.warn('Telemetry querying not yet supported for Golioth provider');
    return [];
  }

  /**
   * Get provider capabilities
   */
  override getCapabilities(): ProviderCapabilities {
    return {
      supportsRealTimeStatus: true,
      supportsTelemetry: false, // Not yet available in Golioth API
      supportsFirmwareManagement: true,
      supportsRemoteCommands: false,
      supportsBidirectionalSync: true,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Map Golioth device to generic DeviceData format
   */
  private mapToGenericDevice(goliothDevice: GoliothDevice): DeviceData {
    return {
      id: goliothDevice.id,
      name: goliothDevice.name,
      externalId: goliothDevice.id,
      status: goliothDevice.status,
      hardwareIds: goliothDevice.hardwareIds || (goliothDevice.hardware_id ? [goliothDevice.hardware_id] : undefined),
      tags: goliothDevice.tags,
      metadata: goliothDevice.metadata,
      lastSeen: goliothDevice.lastSeenOnline 
        ? new Date(goliothDevice.lastSeenOnline)
        : goliothDevice.last_seen 
          ? new Date(goliothDevice.last_seen)
          : undefined,
      createdAt: new Date(goliothDevice.created_at),
      updatedAt: new Date(goliothDevice.updated_at),
    };
  }

  /**
   * Parse firmware components from Golioth update metadata
   */
  private parseFirmwareComponents(
    updateInfo: Record<string, unknown>
  ): Array<{ name: string; version: string; state?: string }> {
    const components: Array<{ name: string; version: string; state?: string }> = [];
    
    for (const [componentName, info] of Object.entries(updateInfo)) {
      if (typeof info === 'object' && info !== null) {
        const componentInfo = info as Record<string, unknown>;
        components.push({
          name: componentName,
          version: (componentInfo.version as string) || 'unknown',
          state: (componentInfo.state as string) || undefined,
        });
      }
    }
    
    return components;
  }
}
