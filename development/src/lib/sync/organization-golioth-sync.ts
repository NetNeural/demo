import { organizationGoliothAPI } from '@/lib/integrations/organization-golioth';
import { databaseDeviceService } from '@/lib/database/devices';
import { GoliothDevice } from '@/lib/golioth';

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface SyncOptions {
  syncStatus?: boolean;
  syncBattery?: boolean;
  syncLastSeen?: boolean;
  syncFirmware?: boolean;
  syncLocation?: boolean;
  syncMetadata?: boolean;
  createMissingDevices?: boolean;
}

export interface SyncResult {
  syncedDevices: number;
  unmappedGoliothDevices: number;
  errors: Array<{
    deviceId: string;
    error: string;
  }>;
}

/**
 * Organization-aware Golioth synchronization service
 */
export class OrganizationGoliothSyncService {
  private syncInProgress: boolean = false;
  private lastSyncTime: Date | null = null;

  /**
   * Sync devices for a specific organization and integration
   */
  async syncDevices(
    organizationId: string,
    integrationId: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;

    const {
      syncStatus = true,
      syncBattery = true,
      syncLastSeen = true,
      syncFirmware = false,
      syncMetadata = false,
      createMissingDevices = false,
    } = options;

    const result: SyncResult = {
      syncedDevices: 0,
      unmappedGoliothDevices: 0,
      errors: []
    };

    try {
      // Get local devices for this organization and integration
      const localDevices = await databaseDeviceService.getDevices({
        organization_id: organizationId,
        integration_id: integrationId,
        has_external_mapping: true
      });

      // Get Golioth devices for this integration
      const goliothDevices = await organizationGoliothAPI.getDevices(integrationId);

      // Create a map of Golioth devices for efficient lookup
      const goliothDeviceMap = new Map(
        goliothDevices.map(device => [device.id, device])
      );

      // Sync each local device that has external mapping
      for (const localDevice of localDevices) {
        if (!localDevice.external_device_id) continue;

        const goliothDevice = goliothDeviceMap.get(localDevice.external_device_id);
        if (!goliothDevice) {
          result.errors.push({
            deviceId: localDevice.id,
            error: 'External device not found in Golioth'
          });
          continue;
        }

        try {
          // Prepare update data based on sync options
          const updateData: {
            status?: 'online' | 'offline' | 'warning' | 'error';
            last_seen?: string | null;
            battery_level?: number | null;
            firmware_version?: string | null;
            location?: string | null;
            metadata?: Json | null;
          } = {};

          if (syncStatus) {
            updateData.status = this.mapGoliothStatus(goliothDevice.status);
          }

          if (syncBattery && goliothDevice.metadata?.battery_level) {
            updateData.battery_level = parseInt(String(goliothDevice.metadata.battery_level));
          }

          if (syncLastSeen && goliothDevice.last_seen) {
            updateData.last_seen = goliothDevice.last_seen;
          }

          if (syncFirmware && (goliothDevice as GoliothDevice & { firmware_version?: string }).firmware_version) {
            updateData.firmware_version = (goliothDevice as GoliothDevice & { firmware_version?: string }).firmware_version || null;
          }

          if (syncMetadata && goliothDevice.metadata) {
            updateData.metadata = JSON.parse(JSON.stringify(goliothDevice.metadata));
          }

          // Update the local device with Golioth data
          if (Object.keys(updateData).length > 0) {
            await databaseDeviceService.updateDevice(localDevice.id, updateData);
            result.syncedDevices++;
          }

          // Remove from map to track unmapped devices
          goliothDeviceMap.delete(localDevice.external_device_id);

        } catch (error) {
          result.errors.push({
            deviceId: localDevice.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Count remaining unmapped Golioth devices
      result.unmappedGoliothDevices = goliothDeviceMap.size;

      // Optionally create local devices for unmapped Golioth devices
      if (createMissingDevices && goliothDeviceMap.size > 0) {
        for (const [goliothId, goliothDevice] of goliothDeviceMap) {
          try {
            await databaseDeviceService.createDevice({
              organization_id: organizationId,
              integration_id: integrationId,
              external_device_id: goliothId,
              name: goliothDevice.name,
              device_type: this.inferDeviceType(goliothDevice),
              status: this.mapGoliothStatus(goliothDevice.status),
              last_seen: goliothDevice.last_seen || null,
              battery_level: goliothDevice.metadata?.battery_level ? 
                parseInt(String(goliothDevice.metadata.battery_level)) : null,
              metadata: JSON.parse(JSON.stringify(goliothDevice.metadata || {}))
            });
            result.syncedDevices++;
          } catch (error) {
            result.errors.push({
              deviceId: goliothId,
              error: `Failed to create local device: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
          }
        }
      }

      this.lastSyncTime = new Date();
      return result;

    } catch (error) {
      result.errors.push({
        deviceId: 'SYNC_SERVICE',
        error: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      return result;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync all integrations for an organization
   */
  async syncOrganizationDevices(
    organizationId: string,
    options: SyncOptions = {}
  ): Promise<{ [integrationId: string]: SyncResult }> {
    const integrations = await organizationGoliothAPI.getAvailableIntegrations(organizationId);
    const results: { [integrationId: string]: SyncResult } = {};

    for (const integration of integrations) {
      try {
        results[integration.id] = await this.syncDevices(organizationId, integration.id, options);
      } catch (error) {
        results[integration.id] = {
          syncedDevices: 0,
          unmappedGoliothDevices: 0,
          errors: [{
            deviceId: 'INTEGRATION',
            error: error instanceof Error ? error.message : 'Unknown error'
          }]
        };
      }
    }

    return results;
  }

  /**
   * Sync a specific device by its local ID
   */
  async syncDevice(localDeviceId: string): Promise<boolean> {
    try {
      const localDevice = await databaseDeviceService.getDevice(localDeviceId);
      
      if (!localDevice || !localDevice.external_device_id || !localDevice.integration_id) {
        throw new Error('Device not found or not mapped to external system');
      }

      const goliothDevice = await organizationGoliothAPI.getDevice(
        localDevice.integration_id,
        localDevice.external_device_id
      );
      
      if (!goliothDevice) {
        throw new Error('External device not found in Golioth');
      }

      // Update local device with Golioth data
      await databaseDeviceService.updateDevice(localDeviceId, {
        status: this.mapGoliothStatus(goliothDevice.status),
        last_seen: goliothDevice.last_seen || null,
        battery_level: goliothDevice.metadata?.battery_level ? 
          parseInt(String(goliothDevice.metadata.battery_level)) : null
      });

      return true;
    } catch (error) {
      console.error('Error syncing device:', error);
      return false;
    }
  }

  /**
   * Map Golioth status to local device status
   */
  private mapGoliothStatus(goliothStatus: string): 'online' | 'offline' | 'warning' | 'error' {
    switch (goliothStatus.toLowerCase()) {
      case 'online':
      case 'connected':
        return 'online';
      case 'offline':
      case 'disconnected':
        return 'offline';
      case 'warning':
      case 'unstable':
        return 'warning';
      case 'error':
      case 'failed':
        return 'error';
      default:
        return 'offline';
    }
  }

  /**
   * Infer device type from Golioth device data
   */
  private inferDeviceType(goliothDevice: GoliothDevice): string {
    const metadata = goliothDevice.metadata || {};
    const deviceType = metadata.device_type || metadata.type || 'IoT Device';
    return String(deviceType);
  }

  /**
   * Get sync status and statistics
   */
  getSyncStatus() {
    return {
      lastSyncTime: this.lastSyncTime,
      syncInProgress: this.syncInProgress,
      isEnabled: true // Organization integrations manage their own enabled state
    };
  }

  /**
   * Push local device changes to Golioth (if supported)
   */
  async pushDeviceToGolioth(localDeviceId: string): Promise<boolean> {
    try {
      const localDevice = await databaseDeviceService.getDevice(localDeviceId);
      
      if (!localDevice || !localDevice.external_device_id || !localDevice.integration_id) {
        throw new Error('Device not found or not mapped to external system');
      }

      // For now, we'll only update the device name in Golioth
      // More sophisticated two-way sync can be added later
      const existingMetadata = localDevice.metadata && 
        typeof localDevice.metadata === 'object' && 
        !Array.isArray(localDevice.metadata) ? 
          localDevice.metadata as Record<string, unknown> : {};
      
      await organizationGoliothAPI.updateDevice(localDevice.integration_id, localDevice.external_device_id, {
        name: localDevice.name,
        metadata: {
          ...existingMetadata,
          local_device_id: localDevice.id,
          last_updated_from_local: new Date().toISOString()
        }
      });

      return true;
    } catch (error) {
      console.error('Error pushing device to Golioth:', error);
      return false;
    }
  }
}

// Export singleton instance
export const organizationGoliothSyncService = new OrganizationGoliothSyncService();