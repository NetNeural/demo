/**
 * Integration Sync Orchestrator (Issue #88)
 * 
 * Generic sync service that works with ANY integration provider
 * (Golioth, AWS IoT, Azure IoT, MQTT, etc.)
 * 
 * Replaces hardcoded organization-golioth-sync.ts with provider-agnostic logic.
 */

import { IntegrationProviderFactory } from '@/lib/integrations/integration-provider-factory';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';

type Device = Database['public']['Tables']['devices']['Row'];
type DeviceIntegration = Database['public']['Tables']['device_integrations']['Row'];

export interface SyncOptions {
  fullSync?: boolean; // Sync all devices vs. incremental
  dryRun?: boolean; // Preview changes without applying
  batchSize?: number; // Number of devices to process per batch
}

export interface SyncResult {
  success: boolean;
  devicesProcessed: number;
  devicesCreated: number;
  devicesUpdated: number;
  devicesDeleted: number;
  errors: Array<{ deviceId: string; error: string }>;
  duration: number;
  timestamp: string;
}

export class IntegrationSyncOrchestrator {
  private supabase = createClient();

  /**
   * Sync devices from any integration provider
   */
  async syncIntegration(
    organizationId: string,
    integrationId: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      devicesProcessed: 0,
      devicesCreated: 0,
      devicesUpdated: 0,
      devicesDeleted: 0,
      errors: [],
      duration: 0,
      timestamp: new Date().toISOString()
    };

    try {
      // 1. Get integration config
      const { data: integration, error: intError } = await this.supabase
        .from('device_integrations')
        .select('*')
        .eq('id', integrationId)
        .single();

      if (intError || !integration) {
        throw new Error(`Integration ${integrationId} not found`);
      }

      // 2. Create provider (works for ANY integration type)
      const provider = IntegrationProviderFactory.create(integration as DeviceIntegration);

      // 3. Test connection first
      const connectionTest = await provider.testConnection();
      if (!connectionTest.success) {
        throw new Error(`Provider connection failed: ${connectionTest.message}`);
      }

      // 4. Fetch devices from provider
      const externalDevices = await provider.listDevices({
        limit: options.batchSize || 1000
      });

      // 5. Get local devices for this integration
      const { data: localDevices, error: localError } = await this.supabase
        .from('devices')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('integration_id', integrationId);

      if (localError) {
        throw new Error(`Failed to fetch local devices: ${localError.message}`);
      }

      // 6. Match and sync each device
      for (const externalDevice of externalDevices.devices) {
        result.devicesProcessed++;

        try {
          // Find matching local device (Issue #83: Serial number primary matching)
          const matchedDevice = await this.findMatchingDevice(
            externalDevice,
            localDevices || []
          );

          if (matchedDevice) {
            // Update existing device
            if (!options.dryRun) {
              await this.updateDevice(matchedDevice.id, externalDevice);
            }
            result.devicesUpdated++;
          } else {
            // Create new device
            if (!options.dryRun) {
              await this.createDevice(organizationId, integrationId, externalDevice);
            }
            result.devicesCreated++;
          }
        } catch (error) {
          result.success = false;
          result.errors.push({
            deviceId: externalDevice.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      result.duration = Date.now() - startTime;
      return result;
    } catch (error) {
      result.success = false;
      result.duration = Date.now() - startTime;
      result.errors.push({
        deviceId: 'N/A',
        error: error instanceof Error ? error.message : 'Sync failed'
      });
      return result;
    }
  }

  /**
   * Find matching device using Issue #83 strategy:
   * 1. Serial number (primary)
   * 2. External device ID (fallback for legacy)
   */
  private async findMatchingDevice(
    externalDevice: any,
    localDevices: Device[]
  ): Promise<Device | null> {
    // PRIMARY: Serial number (Golioth Device Name)
    const serialNumber = externalDevice.name;
    const bySerial = localDevices.find(d => d.serial_number === serialNumber);
    if (bySerial) return bySerial;

    // FALLBACK: External device ID (legacy)
    const byExternalId = localDevices.find(d => d.external_device_id === externalDevice.id);
    return byExternalId || null;
  }

  /**
   * Update existing device with data from provider
   */
  private async updateDevice(deviceId: string, externalDevice: any): Promise<void> {
    const updateData: any = {
      name: externalDevice.name,
      status: externalDevice.status,
      updated_at: new Date().toISOString()
    };

    // Issue #80: Add new Golioth fields
    if (externalDevice.lastSeenOnline) {
      updateData.last_seen_online = externalDevice.lastSeenOnline;
    }
    if (externalDevice.lastSeenOffline) {
      updateData.last_seen_offline = externalDevice.lastSeenOffline;
    }
    if (externalDevice.hardwareIds) {
      updateData.hardware_ids = externalDevice.hardwareIds;
    }
    if (externalDevice.cohortId) {
      updateData.cohort_id = externalDevice.cohortId;
    }
    if (externalDevice.goliothStatus) {
      updateData.golioth_status = externalDevice.goliothStatus;
    }

    // Metadata
    if (externalDevice.metadata) {
      updateData.metadata = externalDevice.metadata;
    }

    await this.supabase
      .from('devices')
      .update(updateData)
      .eq('id', deviceId);

    // Issue #81: Log firmware version if changed
    if (externalDevice.firmwareVersion) {
      await this.logFirmwareVersion(deviceId, externalDevice.firmwareVersion);
    }
  }

  /**
   * Create new device from provider data
   */
  private async createDevice(
    organizationId: string,
    integrationId: string,
    externalDevice: any
  ): Promise<void> {
    await this.supabase
      .from('devices')
      .insert({
        organization_id: organizationId,
        integration_id: integrationId,
        external_device_id: externalDevice.id,
        serial_number: externalDevice.name, // Issue #83: Golioth Device Name = serial number
        name: externalDevice.name,
        device_type: externalDevice.deviceType || 'unknown',
        status: externalDevice.status || 'unknown',
        last_seen_online: externalDevice.lastSeenOnline,
        last_seen_offline: externalDevice.lastSeenOffline,
        hardware_ids: externalDevice.hardwareIds || [],
        cohort_id: externalDevice.cohortId,
        golioth_status: externalDevice.goliothStatus,
        metadata: externalDevice.metadata || {}
      });
  }

  /**
   * Log firmware version to history (Issue #81)
   */
  private async logFirmwareVersion(deviceId: string, version: string): Promise<void> {
    // Get current firmware version
    const { data: device } = await this.supabase
      .from('devices')
      .select('firmware_version')
      .eq('id', deviceId)
      .single();

    // Only log if version changed
    if (device && device.firmware_version !== version) {
      await this.supabase
        .from('device_firmware_history')
        .insert({
          device_id: deviceId,
          firmware_version: version,
          component_type: 'main',
          source: 'ota_update'
        });
    }
  }
}
