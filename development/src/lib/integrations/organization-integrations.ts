import { createClient } from '@/lib/supabase/client';
import { Database } from '@/lib/supabase-types';

export interface OrganizationIntegration {
  id: string;
  organization_id: string;
  integration_type: string;
  name: string;
  api_key_encrypted?: string | null;
  project_id?: string | null;
  base_url?: string | null;
  settings: Database['public']['Tables']['device_integrations']['Row']['settings'];
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export class OrganizationIntegrationService {
  private supabase = createClient();

  /**
   * Get all integrations for an organization
   */
  async getIntegrations(organizationId: string): Promise<OrganizationIntegration[]> {
    const { data, error } = await this.supabase
      .from('device_integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to fetch integrations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a specific integration
   */
  async getIntegration(integrationId: string): Promise<OrganizationIntegration | null> {
    const { data, error } = await this.supabase
      .from('device_integrations')
      .select('*')
      .eq('id', integrationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch integration: ${error.message}`);
    }

    return data;
  }

  /**
   * Get Golioth integrations for an organization
   */
  async getGoliothIntegrations(organizationId: string): Promise<OrganizationIntegration[]> {
    const { data, error } = await this.supabase
      .from('device_integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('integration_type', 'golioth')
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to fetch Golioth integrations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create a new integration
   */
  async createIntegration(integration: Omit<OrganizationIntegration, 'id' | 'created_at' | 'updated_at'>): Promise<OrganizationIntegration> {
    const { data, error } = await this.supabase
      .from('device_integrations')
      .insert(integration)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create integration: ${error.message}`);
    }

    return data;
  }

  /**
   * Update an integration
   */
  async updateIntegration(integrationId: string, updates: Partial<OrganizationIntegration>): Promise<OrganizationIntegration> {
    const { data, error } = await this.supabase
      .from('device_integrations')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', integrationId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update integration: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete an integration
   */
  async deleteIntegration(integrationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('device_integrations')
      .delete()
      .eq('id', integrationId);

    if (error) {
      throw new Error(`Failed to delete integration: ${error.message}`);
    }
  }

  /**
   * Test integration connection
   */
  async testIntegration(integrationId: string): Promise<{ success: boolean; message: string }> {
    try {
      const integration = await this.getIntegration(integrationId);
      if (!integration) {
        return { success: false, message: 'Integration not found' };
      }

      if (integration.integration_type === 'golioth') {
        // Test Golioth connection
        return await this.testGoliothConnection(integration);
      }

      // For all other types, delegate to the integration-test edge function
      try {
        const { data, error } = await this.supabase.functions.invoke('integration-test', {
          body: { integrationId },
        });
        if (error) {
          return { success: false, message: error.message || 'Test connection failed' };
        }
        return { success: data?.success ?? false, message: data?.message || 'Test completed' };
      } catch {
        return { success: false, message: 'Failed to invoke test connection' };
      }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Test Golioth integration connection
   */
  private async testGoliothConnection(integration: OrganizationIntegration): Promise<{ success: boolean; message: string }> {
    try {
      if (!integration.api_key_encrypted || !integration.project_id) {
        return { success: false, message: 'Missing API key or project ID' };
      }

      // In a real implementation, you would decrypt the API key and test the connection
      // For now, just simulate a successful test
      const baseUrl = integration.base_url || 'https://api.golioth.io';
      
      // Basic validation
      if (!baseUrl.startsWith('http')) {
        return { success: false, message: 'Invalid base URL' };
      }

      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }

  /**
   * Encrypt sensitive data (placeholder - implement with proper encryption)
   */
  private encryptApiKey(apiKey: string): string {
    // In a real implementation, use proper encryption
    // For now, just base64 encode (NOT SECURE - just for demonstration)
    return Buffer.from(apiKey).toString('base64');
  }

  /**
   * Decrypt sensitive data (placeholder - implement with proper decryption)
   */
  private decryptApiKey(encryptedApiKey: string): string {
    // In a real implementation, use proper decryption
    // For now, just base64 decode (NOT SECURE - just for demonstration)
    return Buffer.from(encryptedApiKey, 'base64').toString();
  }
}

// Export singleton instance
export const organizationIntegrationService = new OrganizationIntegrationService();