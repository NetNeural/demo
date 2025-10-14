import { GoliothAPI, GoliothDevice } from '@/lib/golioth';
import { OrganizationIntegration, organizationIntegrationService } from './organization-integrations';

/**
 * Organization-aware Golioth API client
 * Manages multiple Golioth integrations per organization
 */
export class OrganizationGoliothAPI {
  private apiInstances: Map<string, GoliothAPI> = new Map();

  /**
   * Get or create a Golioth API instance for a specific integration
   */
  private async getApiInstance(integrationId: string): Promise<GoliothAPI | null> {
    if (this.apiInstances.has(integrationId)) {
      return this.apiInstances.get(integrationId)!;
    }

    const integration = await organizationIntegrationService.getIntegration(integrationId);
    if (!integration || integration.integration_type !== 'golioth') {
      return null;
    }

    // Create a new API instance with the integration's credentials
    const apiInstance = new GoliothAPI({
      apiKey: this.decryptApiKey(integration.api_key_encrypted || ''),
      projectId: integration.project_id || '',
      baseUrl: integration.base_url || 'https://api.golioth.io'
    });

    this.apiInstances.set(integrationId, apiInstance);
    return apiInstance;
  }

  /**
   * Get devices for a specific organization integration
   */
  async getDevices(integrationId: string): Promise<GoliothDevice[]> {
    const api = await this.getApiInstance(integrationId);
    if (!api) {
      throw new Error('Integration not found or not configured');
    }

    return await api.getDevices();
  }

  /**
   * Get a specific device from an integration
   */
  async getDevice(integrationId: string, deviceId: string): Promise<GoliothDevice | null> {
    const api = await this.getApiInstance(integrationId);
    if (!api) {
      throw new Error('Integration not found or not configured');
    }

    return await api.getDevice(deviceId);
  }

  /**
   * Update a device in a specific integration
   */
  async updateDevice(integrationId: string, deviceId: string, updates: Partial<GoliothDevice>): Promise<GoliothDevice> {
    const api = await this.getApiInstance(integrationId);
    if (!api) {
      throw new Error('Integration not found or not configured');
    }

    return await api.updateDevice(deviceId, updates);
  }

  /**
   * Get all devices for all Golioth integrations in an organization
   */
  async getOrganizationDevices(organizationId: string): Promise<{
    integrationId: string;
    integrationName: string;
    devices: GoliothDevice[];
  }[]> {
    const integrations = await organizationIntegrationService.getGoliothIntegrations(organizationId);
    const results = [];

    for (const integration of integrations) {
      try {
        const devices = await this.getDevices(integration.id);
        results.push({
          integrationId: integration.id,
          integrationName: integration.name,
          devices
        });
      } catch (error) {
        console.error(`Failed to fetch devices for integration ${integration.id}:`, error);
        // Continue with other integrations
        results.push({
          integrationId: integration.id,
          integrationName: integration.name,
          devices: []
        });
      }
    }

    return results;
  }

  /**
   * Test connection for a specific integration
   */
  async testConnection(integrationId: string): Promise<{ success: boolean; message: string }> {
    try {
      const api = await this.getApiInstance(integrationId);
      if (!api) {
        return { success: false, message: 'Integration not found or not configured' };
      }

      // Try to fetch devices as a connection test
      await api.getDevices();
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }

  /**
   * Clear cached API instance (useful when integration credentials change)
   */
  clearCache(integrationId?: string): void {
    if (integrationId) {
      this.apiInstances.delete(integrationId);
    } else {
      this.apiInstances.clear();
    }
  }

  /**
   * Get all available integrations for an organization
   */
  async getAvailableIntegrations(organizationId: string): Promise<OrganizationIntegration[]> {
    return await organizationIntegrationService.getGoliothIntegrations(organizationId);
  }

  /**
   * Decrypt API key (placeholder - implement with proper decryption)
   */
  private decryptApiKey(encryptedApiKey: string): string {
    if (!encryptedApiKey) return '';
    
    // In a real implementation, use proper decryption
    // For now, just base64 decode (NOT SECURE - just for demonstration)
    try {
      return Buffer.from(encryptedApiKey, 'base64').toString();
    } catch {
      return encryptedApiKey; // Fallback if not base64 encoded
    }
  }
}

// Export singleton instance
export const organizationGoliothAPI = new OrganizationGoliothAPI();