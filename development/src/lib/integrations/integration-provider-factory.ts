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

import {
  DeviceIntegrationProvider,
  ProviderConfig,
} from './base-integration-provider'
import { GoliothIntegrationProvider } from './golioth-integration-provider'
import { OrganizationIntegration } from './organization-integrations'

type ProviderConstructor = new (
  config: ProviderConfig
) => DeviceIntegrationProvider

type LazyProviderLoader = () => Promise<ProviderConstructor>

/**
 * Registry of available integration providers
 * Supports both eager (ProviderConstructor) and lazy (dynamic import) registration
 */
const providerRegistry = new Map<string, ProviderConstructor | LazyProviderLoader>()

/**
 * Register a provider type (eager — class already loaded)
 */
export function registerProvider(
  type: string,
  providerClass: ProviderConstructor
): void {
  providerRegistry.set(type, providerClass)
}

/**
 * Register a provider type lazily (dynamic import — only loaded when first used)
 * This keeps heavy SDKs (AWS, Azure, MQTT) out of the initial client bundle.
 */
export function registerLazyProvider(
  type: string,
  loader: LazyProviderLoader
): void {
  providerRegistry.set(type, loader)
}

/**
 * Integration Provider Factory
 */
export class IntegrationProviderFactory {
  /**
   * Create a provider instance from an integration record
   */
  static async create(
    integration: OrganizationIntegration
  ): Promise<DeviceIntegrationProvider> {
    const entry = providerRegistry.get(integration.integration_type)

    if (!entry) {
      throw new Error(
        `Unknown integration type: ${integration.integration_type}. ` +
          `Available types: ${Array.from(providerRegistry.keys()).join(', ')}`
      )
    }

    // Resolve lazy providers (dynamic imports) on first use
    let ProviderClass: ProviderConstructor
    if (typeof entry === 'function' && !entry.prototype) {
      // It's a lazy loader, not a constructor
      ProviderClass = await (entry as LazyProviderLoader)()
    } else {
      ProviderClass = entry as ProviderConstructor
    }

    // Extract configuration from integration
    const config: ProviderConfig = {
      type: integration.integration_type,
      apiKey: this.decryptApiKey(integration.api_key_encrypted || ''),
      projectId: integration.project_id || undefined,
      endpoint: integration.base_url || undefined,
      credentials:
        (integration.settings as Record<string, unknown>) || undefined,
    }

    return new ProviderClass(config)
  }

  /**
   * Get list of registered provider types
   */
  static getRegisteredTypes(): string[] {
    return Array.from(providerRegistry.keys())
  }

  /**
   * Check if a provider type is registered
   */
  static isTypeRegistered(type: string): boolean {
    return providerRegistry.has(type)
  }

  /**
   * Decrypt API key
   *
   * ⚠️ SECURITY NOTE: This method provides fallback decryption for backward
   * compatibility with base64-encoded keys during migration. New keys are
   * encrypted using pgsodium and should ideally be decrypted server-side
   * via database functions before reaching this code.
   *
   * @param encrypted - Base64 string (old format) or pgsodium-encrypted string
   * @returns Decrypted API key
   *
   * TODO: Once all keys are migrated to pgsodium encryption, Edge Functions
   * should decrypt keys before creating providers, and this method can be removed.
   */
  private static decryptApiKey(encrypted: string): string {
    if (!encrypted) {
      return ''
    }

    try {
      // Try base64 decode for backward compatibility with old format
      // New keys encrypted with pgsodium cannot be decrypted here
      // (they require database-side decryption via decrypt_api_key function)
      return Buffer.from(encrypted, 'base64').toString('utf-8')
    } catch (error) {
      console.warn(
        'Failed to decrypt API key. If using pgsodium encryption, ' +
          'keys must be decrypted via Edge Functions before provider creation.'
      )
      return encrypted // Return as-is if decryption fails
    }
  }
}

// ============================================================================
// Register Built-in Providers
// ============================================================================

// Register all device integration providers
// Golioth is eagerly loaded (lightweight, most commonly used)
registerProvider('golioth', GoliothIntegrationProvider)

// Heavy SDK providers are lazily loaded via dynamic import to keep them
// out of the initial client bundle (~500-700 KB savings)
registerLazyProvider('aws_iot', async () => {
  const { AwsIotIntegrationProvider } = await import('./aws-iot-integration-provider')
  return AwsIotIntegrationProvider
})
registerLazyProvider('azure_iot', async () => {
  const { AzureIotIntegrationProvider } = await import('./azure-iot-integration-provider')
  return AzureIotIntegrationProvider
})
registerLazyProvider('mqtt', async () => {
  const { MqttIntegrationProvider } = await import('./mqtt-integration-provider')
  return MqttIntegrationProvider
})
registerLazyProvider('netneural_hub', async () => {
  const { NetNeuralHubIntegrationProvider } = await import('./netneural-hub-integration-provider')
  return NetNeuralHubIntegrationProvider
})

// Note: Google IoT Core was removed (discontinued by Google Aug 2023).
// Legacy 'google_iot' DB entries can be ignored or migrated to other providers.
