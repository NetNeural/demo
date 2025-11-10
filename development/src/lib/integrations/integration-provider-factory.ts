/**
 * Integration Provider Factory
 * ============================
 * Central registry and factory for creating integration provider instances
 * 
 * This factory pattern allows:
 * - Easy registration of new providers
 * - Dynamic provider instantiation based on integration type
 * - Type-safe provider creation
 * 
 * Date: 2025-11-09
 * Issue: #82 - Common Integration Provider Interface
 */

import { DeviceIntegrationProvider, ProviderConfig } from './base-integration-provider';
import { GoliothIntegrationProvider } from './golioth-integration-provider';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AwsIotIntegrationProvider } from './aws-iot-integration-provider';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AzureIotIntegrationProvider } from './azure-iot-integration-provider';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MqttIntegrationProvider } from './mqtt-integration-provider';
import { OrganizationIntegration } from './organization-integrations';

type ProviderConstructor = new (config: ProviderConfig) => DeviceIntegrationProvider;

/**
 * Registry of available integration providers
 */
const providerRegistry = new Map<string, ProviderConstructor>();

/**
 * Register a provider type
 */
export function registerProvider(type: string, providerClass: ProviderConstructor): void {
  providerRegistry.set(type, providerClass);
}

/**
 * Integration Provider Factory
 */
export class IntegrationProviderFactory {
  /**
   * Create a provider instance from an integration record
   */
  static create(integration: OrganizationIntegration): DeviceIntegrationProvider {
    const ProviderClass = providerRegistry.get(integration.integration_type);
    
    if (!ProviderClass) {
      throw new Error(
        `Unknown integration type: ${integration.integration_type}. ` +
        `Available types: ${Array.from(providerRegistry.keys()).join(', ')}`
      );
    }

    // Extract configuration from integration
    const config: ProviderConfig = {
      type: integration.integration_type,
      apiKey: this.decryptApiKey(integration.api_key_encrypted || ''),
      projectId: integration.project_id || undefined,
      endpoint: integration.base_url || undefined,
      credentials: integration.settings as Record<string, unknown> || undefined,
    };

    return new ProviderClass(config);
  }

  /**
   * Get list of registered provider types
   */
  static getRegisteredTypes(): string[] {
    return Array.from(providerRegistry.keys());
  }

  /**
   * Check if a provider type is registered
   */
  static isTypeRegistered(type: string): boolean {
    return providerRegistry.has(type);
  }

  /**
   * Decrypt API key (placeholder - implement proper decryption)
   */
  private static decryptApiKey(encrypted: string): string {
    // TODO: Implement proper decryption
    // For now, just decode base64
    try {
      return Buffer.from(encrypted, 'base64').toString('utf-8');
    } catch {
      return encrypted;
    }
  }
}

// ============================================================================
// Register Built-in Providers
// ============================================================================

// Register all device integration providers
registerProvider('golioth', GoliothIntegrationProvider as unknown as ProviderConstructor);
registerProvider('aws_iot', AwsIotIntegrationProvider as unknown as ProviderConstructor);
registerProvider('azure_iot', AzureIotIntegrationProvider as unknown as ProviderConstructor);
registerProvider('mqtt', MqttIntegrationProvider as unknown as ProviderConstructor);

// Note: Google IoT Core was discontinued by Google in August 2023
// Legacy 'google_iot' type entries should be migrated to alternative providers
