/**
 * Provider Verification Script
 * ============================
 * Verifies all integration providers can be instantiated and tested
 *
 * Usage: node scripts/verify-providers.mjs
 */

import { IntegrationProviderFactory } from '../src/lib/integrations/integration-provider-factory.ts'

console.log('🔍 Provider Verification Script')
console.log('================================\n')

// Test data
const testIntegrations = [
  {
    id: 'test-golioth',
    organization_id: 'test-org',
    integration_type: 'golioth',
    name: 'Test Golioth',
    api_key_encrypted: Buffer.from('test-key').toString('base64'),
    project_id: 'test-project',
    base_url: 'https://api.golioth.io',
    settings: {},
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'test-aws',
    organization_id: 'test-org',
    integration_type: 'aws_iot',
    name: 'Test AWS IoT',
    api_key_encrypted: Buffer.from('test-key').toString('base64'),
    settings: {
      region: 'us-west-2',
      accessKeyId: 'test',
      secretAccessKey: 'test',
    },
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'test-azure',
    organization_id: 'test-org',
    integration_type: 'azure_iot',
    name: 'Test Azure IoT',
    settings: {
      connectionString:
        'HostName=test.azure-devices.net;SharedAccessKeyName=test;SharedAccessKey=test',
    },
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'test-mqtt',
    organization_id: 'test-org',
    integration_type: 'mqtt',
    name: 'Test MQTT',
    settings: {
      brokerUrl: 'mqtt://test-broker:1883',
      username: 'test',
      password: 'test',
    },
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
  },
]

console.log('📋 Registered Provider Types:')
const registeredTypes = IntegrationProviderFactory.getRegisteredTypes()
console.log(`   ${registeredTypes.join(', ')}\n`)

console.log('🧪 Testing Provider Instantiation:\n')

let passed = 0
let failed = 0

for (const integration of testIntegrations) {
  try {
    const provider = IntegrationProviderFactory.create(integration)

    console.log(`✅ ${integration.integration_type.toUpperCase()}`)
    console.log(`   Provider ID: ${provider.providerId}`)
    console.log(`   Provider Type: ${provider.providerType}`)
    console.log(`   Provider Name: ${provider.providerName}`)

    const capabilities = provider.getCapabilities()
    console.log(`   Capabilities:`)
    console.log(
      `     - Real-time Status: ${capabilities.supportsRealTimeStatus ? '✅' : '❌'}`
    )
    console.log(
      `     - Telemetry: ${capabilities.supportsTelemetry ? '✅' : '❌'}`
    )
    console.log(
      `     - Firmware Mgmt: ${capabilities.supportsFirmwareManagement ? '✅' : '❌'}`
    )
    console.log(
      `     - Remote Commands: ${capabilities.supportsRemoteCommands ? '✅' : '❌'}`
    )
    console.log(
      `     - Bidirectional Sync: ${capabilities.supportsBidirectionalSync ? '✅' : '❌'}`
    )
    console.log('')

    passed++
  } catch (error) {
    console.log(`❌ ${integration.integration_type.toUpperCase()}`)
    console.log(`   Error: ${error.message}\n`)
    failed++
  }
}

console.log('================================')
console.log(`📊 Results: ${passed} passed, ${failed} failed`)

if (failed === 0) {
  console.log('✅ All providers instantiate successfully!')
  process.exit(0)
} else {
  console.log('❌ Some providers failed to instantiate')
  process.exit(1)
}
