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
  ProviderConfig,
} from './base-integration-provider';
import { FrontendActivityLogger } from '@/lib/monitoring/activity-logger';

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
  private activityLogger: FrontendActivityLogger;
  private organizationId: string;
  private integrationId: string;

  constructor(config: ProviderConfig) {
    super();
    
    // Extract Golioth-specific config from generic ProviderConfig
    const apiKey = config.apiKey || '';
    const projectId = config.projectId || '';
    const baseUrl = config.endpoint;
    const organizationId = (config.credentials?.organizationId as string) || '';
    const integrationId = (config.credentials?.integrationId as string) || `golioth-${projectId}`;
    
    this.config = { apiKey, projectId, baseUrl };
    this.providerId = `golioth-${projectId}`;
    this.organizationId = organizationId;
    this.integrationId = integrationId;
    this.activityLogger = new FrontendActivityLogger();
    
    // Initialize Golioth API client
    this.api = new GoliothAPI({
      apiKey,
      projectId,
      baseUrl,
    });
  }

  /**
   * Test connection to Golioth
   */
  async testConnection(): Promise<TestConnectionResult> {
    if (!this.organizationId || !this.integrationId) {
      // Fallback to non-logged operation if IDs not provided
      return this._testConnectionInternal();
    }

    return this.activityLogger.withLog({
      organizationId: this.organizationId,
      integrationId: this.integrationId,
      direction: 'outgoing',
      activityType: 'test_connection',
      endpoint: this.config.baseUrl || 'https://api.golioth.io',
    }, async () => {
      return this._testConnectionInternal();
    });
  }

  private async _testConnectionInternal(): Promise<TestConnectionResult> {
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

  /**   * Deploy firmware to a device
   */
  async deployFirmware(
    deviceId: string,
    firmware: {
      artifactId: string;
      version: string;
      packageName: string;
      componentType?: string;
      checksum?: string;
    }
  ): Promise<{
    deploymentId: string;
    status: string;
    message?: string;
  }> {
    try {
      // Golioth uses releases and artifacts for OTA updates
      // We'll trigger an OTA update by updating the device's desired release
      const response = await this.api.updateDevice(deviceId, {
        metadata: {
          desired_release: firmware.version,
          deployment_artifact_id: firmware.artifactId,
          deployment_initiated_at: new Date().toISOString()
        }
      });

      return {
        deploymentId: `golioth-${deviceId}-${Date.now()}`,
        status: 'queued',
        message: `Firmware ${firmware.version} deployment queued for device ${deviceId}`
      };
    } catch (error) {
      console.error('Golioth firmware deployment error:', error);
      throw new Error(`Failed to deploy firmware: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**   * Get provider capabilities
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
    // Extract device type from tags or metadata, default to 'iot_device'
    const deviceType = 
      goliothDevice.tags?.find(tag => tag.startsWith('type:'))?.replace('type:', '') ||
      (goliothDevice.metadata?.device_type as string) ||
      (goliothDevice.metadata?.type as string) ||
      'iot_device';
    
    // Extract model from metadata
    const model = (goliothDevice.metadata?.model as string) || undefined;
    
    // Extract serial number from metadata or hardware ID
    const serialNumber = 
      (goliothDevice.metadata?.serial_number as string) ||
      (goliothDevice.metadata?.serialNumber as string) ||
      undefined;
    
    // Extract firmware version
    const firmwareVersion = 
      (goliothDevice.metadata?.firmware_version as string) ||
      (goliothDevice.metadata?.firmwareVersion as string) ||
      undefined;
    
    // Extract battery level and signal strength
    const batteryLevel = (goliothDevice.metadata?.battery_level as number) || undefined;
    const signalStrength = (goliothDevice.metadata?.signal_strength as number) || undefined;
    
    // Extract gateway/parent information from tags and metadata
    const parentDeviceId = 
      goliothDevice.parentDeviceId ||
      goliothDevice.gatewayId ||
      (goliothDevice.metadata?.parentId as string) ||
      (goliothDevice.metadata?.parent_id as string) ||
      (goliothDevice.metadata?.gatewayId as string) ||
      (goliothDevice.metadata?.gateway_id as string) ||
      goliothDevice.tags?.find(tag => tag.startsWith('gateway:'))?.replace('gateway:', '') ||
      goliothDevice.tags?.find(tag => tag.startsWith('parent:'))?.replace('parent:', '') ||
      undefined;
    
    // Determine if this is a gateway device
    const isGateway = 
      goliothDevice.isGateway ||
      (goliothDevice.metadata?.isGateway as boolean) ||
      (goliothDevice.metadata?.is_gateway as boolean) ||
      goliothDevice.tags?.includes('gateway') ||
      goliothDevice.tags?.includes('type:gateway') ||
      goliothDevice.name?.toLowerCase().includes('gateway') ||
      false;
    
    return {
      id: goliothDevice.id,
      name: goliothDevice.name,
      externalId: goliothDevice.id,
      status: goliothDevice.status,
      deviceType, // Add device type
      model, // Add model
      serialNumber, // Add serial number
      firmwareVersion, // Add firmware version
      hardwareIds: goliothDevice.hardwareIds || (goliothDevice.hardware_id ? [goliothDevice.hardware_id] : undefined),
      cohortId: goliothDevice.cohortId, // Add cohort ID for OTA updates
      parentDeviceId, // Add parent/gateway device ID
      isGateway, // Add gateway indicator
      tags: goliothDevice.tags,
      metadata: goliothDevice.metadata,
      batteryLevel, // Add battery level
      signalStrength, // Add signal strength
      lastSeen: goliothDevice.lastSeenOnline 
        ? new Date(goliothDevice.lastSeenOnline)
        : goliothDevice.last_seen 
          ? new Date(goliothDevice.last_seen)
          : undefined,
      lastSeenOnline: goliothDevice.lastSeenOnline ? new Date(goliothDevice.lastSeenOnline) : undefined,
      lastSeenOffline: goliothDevice.lastSeenOffline ? new Date(goliothDevice.lastSeenOffline) : undefined,
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
