# Complete Integration Migration Strategy

## 🎯 Current State Analysis

### Supported Integration Types (8 total)
Based on database constraints and UI:

**IoT Device Platforms:**
1. ✅ **Golioth** - Cloud IoT platform (COMPLETE - has provider)
2. ⏳ **AWS IoT Core** - Amazon's IoT service (TODO - no provider yet)
3. ⏳ **Azure IoT Hub** - Microsoft's IoT service (TODO - no provider yet)
4. ⏳ **Google IoT Core** - Google Cloud IoT (TODO - no provider yet)
5. ⏳ **MQTT** - Generic MQTT broker (TODO - no provider yet)

**Notification/Communication Platforms:**
6. ⏳ **SMTP** - Email notifications (NOT APPLICABLE - different domain)
7. ⏳ **Slack** - Slack notifications (NOT APPLICABLE - different domain)
8. ⏳ **Webhook** - Generic webhooks (NOT APPLICABLE - different domain)

### Provider Architecture Scope
**Device Integration Providers** - What we're building:
- Golioth ✅
- AWS IoT Core ⏳
- Azure IoT Hub ⏳
- Google IoT Core ⏳
- MQTT ⏳

**Notification Integrations** - OUT OF SCOPE:
- SMTP, Slack, Webhook are for notifications, NOT device management
- These use the Edge Function: `supabase/functions/send-notification`
- Different interface, different purpose
- Keep separate

---

## 🏗️ Complete Migration Plan

### Phase 1: Create All Device Providers ✅ + ⏳

#### 1.1 Golioth Provider ✅ DONE
- File: `src/lib/integrations/golioth-integration-provider.ts`
- Status: Complete
- Lines: 247

#### 1.2 AWS IoT Core Provider ⏳ TODO
Create: `src/lib/integrations/aws-iot-integration-provider.ts`

```typescript
export class AwsIotIntegrationProvider extends DeviceIntegrationProvider {
  override providerId = 'aws-iot'
  override providerType = 'aws_iot'
  
  // AWS SDK v3 client
  private iotClient: IoTClient
  private iotDataClient: IoTDataPlaneClient
  
  constructor(integration: OrganizationIntegration) {
    // AWS credentials from integration.config
    this.iotClient = new IoTClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      }
    })
  }
  
  async listDevices(): Promise<DeviceListResult> {
    // Use AWS IoT ListThings API
    const command = new ListThingsCommand({})
    const response = await this.iotClient.send(command)
    // Map AWS Things to DeviceData[]
  }
  
  async getDevice(deviceId: string): Promise<DeviceData> {
    // Use DescribeThing + GetThingShadow APIs
  }
  
  async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    // Use GetThingShadow for current state
  }
  
  // ... implement all required methods
}
```

**Dependencies needed:**
```bash
npm install @aws-sdk/client-iot @aws-sdk/client-iot-data-plane
```

#### 1.3 Azure IoT Hub Provider ⏳ TODO
Create: `src/lib/integrations/azure-iot-integration-provider.ts`

```typescript
export class AzureIotIntegrationProvider extends DeviceIntegrationProvider {
  override providerId = 'azure-iot'
  override providerType = 'azure_iot'
  
  // Azure IoT SDK
  private registry: Registry
  private client: Client
  
  constructor(integration: OrganizationIntegration) {
    // Connection string from integration.config
    this.registry = Registry.fromConnectionString(config.connectionString)
  }
  
  async listDevices(): Promise<DeviceListResult> {
    // Use Azure Device Registry
    const query = this.registry.createQuery('SELECT * FROM devices')
    // Map Azure devices to DeviceData[]
  }
  
  // ... implement all required methods
}
```

**Dependencies needed:**
```bash
npm install azure-iothub azure-iot-device
```

#### 1.4 Google IoT Core Provider ⏳ TODO
Create: `src/lib/integrations/google-iot-integration-provider.ts`

**NOTE:** Google IoT Core was sunset on August 16, 2023!
- **Action:** Remove from database constraint
- **Migration:** Create migration to remove 'google_iot' from allowed types
- **UI:** Remove Google IoT option from integration forms

#### 1.5 MQTT Provider ⏳ TODO
Create: `src/lib/integrations/mqtt-integration-provider.ts`

```typescript
export class MqttIntegrationProvider extends DeviceIntegrationProvider {
  override providerId = 'mqtt'
  override providerType = 'mqtt'
  
  private client: MqttClient
  
  constructor(integration: OrganizationIntegration) {
    // MQTT broker config from integration.config
    this.client = mqtt.connect(config.brokerUrl, {
      username: config.username,
      password: config.password,
      clientId: `netneural-${integration.id}`,
    })
  }
  
  async listDevices(): Promise<DeviceListResult> {
    // MQTT doesn't have a device registry
    // Return devices we know about from database
    // Mark status based on MQTT $SYS topics or custom discovery
  }
  
  async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    // Subscribe to device status topic
    // Parse last will message or status payload
  }
  
  // Limited capabilities - MQTT is just messaging
  getCapabilities(): ProviderCapabilities {
    return {
      supportsRealTimeStatus: true,  // via subscriptions
      supportsTelemetry: true,        // via topic subscription
      supportsFirmwareManagement: false,
      supportsRemoteCommands: true,   // via command topics
    }
  }
}
```

**Dependencies needed:**
```bash
npm install mqtt @types/mqtt
```

---

### Phase 2: Update Provider Factory ⏳

Update: `src/lib/integrations/integration-provider-factory.ts`

```typescript
import { GoliothIntegrationProvider } from './golioth-integration-provider';
import { AwsIotIntegrationProvider } from './aws-iot-integration-provider';
import { AzureIotIntegrationProvider } from './azure-iot-integration-provider';
import { MqttIntegrationProvider } from './mqtt-integration-provider';

// Register ALL providers
registerProvider('golioth', GoliothIntegrationProvider);
registerProvider('aws_iot', AwsIotIntegrationProvider);
registerProvider('azure_iot', AzureIotIntegrationProvider);
registerProvider('mqtt', MqttIntegrationProvider);
// google_iot removed (service discontinued)
```

---

### Phase 3: Migrate ALL UI Components ⏳

#### 3.1 Update OrganizationIntegrationManager.tsx
**Current:** Uses `organizationGoliothSyncService` (line 160)
**New:** Use `SyncOrchestrator` for ALL integration types

```typescript
// REMOVE:
import { organizationGoliothSyncService } from "@/lib/sync/organization-golioth-sync";

// ADD:
import { SyncOrchestrator } from '@/lib/sync/generic-sync-orchestrator';

const syncIntegration = async (integrationId: string) => {
  const orchestrator = new SyncOrchestrator();
  const integration = integrations.find(i => i.id === integrationId);
  
  if (!integration) return;
  
  const result = await orchestrator.syncIntegration(
    organizationId,
    integration,
    {
      syncStatus: true,
      syncBattery: true,
      syncLastSeen: true,
      createMissingDevices: true
    }
  );
  
  // Result is provider-agnostic!
}
```

#### 3.2 Update Device Detail Pages
Replace Golioth-specific calls with generic provider calls

#### 3.3 Update Dashboard Components
Use `useDeviceStatus` hook and `DeviceStatusCard` everywhere

---

### Phase 4: Remove Old Code 🗑️

#### Files to DELETE:
1. ❌ `src/lib/sync/organization-golioth-sync.ts` (379 lines)
   - **Why:** Replaced by `generic-sync-orchestrator.ts`
   - **Dependent files:** `OrganizationIntegrationManager.tsx`

2. ❌ `src/lib/integrations/organization-golioth.ts` (159 lines)
   - **Why:** Replaced by provider factory + Golioth provider
   - **Dependent files:** `organization-golioth-sync.ts` (being deleted)

3. ⚠️  `src/lib/golioth.ts` - **KEEP BUT REFACTOR**
   - Used by `GoliothIntegrationProvider`
   - This is the base HTTP client
   - Action: Mark as internal, only used by provider

4. ⚠️  `src/services/golioth-sync.service.ts` - **KEEP**
   - Used by Edge Functions (different concern)
   - Frontend service for sync history UI
   - Action: Rename to `integration-sync.service.ts` (make generic)

#### Database Tables to MIGRATE:
1. `golioth_sync_log` → Rename to `integration_sync_log`
2. Add `integration_type` column to track which provider
3. Update all partitioned tables

#### Edge Functions to UPDATE:
1. `supabase/functions/_shared/golioth.ts` - Keep for now (separate deployment)
2. Create `supabase/functions/_shared/integration-provider.ts` later

---

### Phase 5: Database Cleanup 🗄️

#### Remove Google IoT Core (Discontinued Service)
```sql
-- Migration: Remove discontinued Google IoT Core
ALTER TABLE device_integrations 
DROP CONSTRAINT IF EXISTS device_integrations_integration_type_check;

ALTER TABLE device_integrations 
ADD CONSTRAINT device_integrations_integration_type_check 
CHECK (integration_type::text = ANY (ARRAY[
  'golioth'::character varying::text,
  'aws_iot'::character varying::text,
  'azure_iot'::character varying::text,
  -- 'google_iot' REMOVED (service discontinued Aug 2023)
  'mqtt'::character varying::text,
  'smtp'::character varying::text,
  'slack'::character varying::text,
  'webhook'::character varying::text
]));

-- Clean up any existing Google IoT integrations
UPDATE device_integrations 
SET is_active = false 
WHERE integration_type = 'google_iot';

-- Add deprecation notice
COMMENT ON COLUMN device_integrations.integration_type IS 
  'Integration type. Note: google_iot deprecated (Google discontinued service in Aug 2023)';
```

#### Rename Golioth-Specific Tables
```sql
-- Rename sync log table to be provider-agnostic
ALTER TABLE golioth_sync_log RENAME TO integration_sync_log;
ALTER TABLE golioth_sync_log_2025_10 RENAME TO integration_sync_log_2025_10;
ALTER TABLE golioth_sync_log_2025_11 RENAME TO integration_sync_log_2025_11;
ALTER TABLE golioth_sync_log_2025_12 RENAME TO integration_sync_log_2025_12;
ALTER TABLE golioth_sync_log_2026_01 RENAME TO integration_sync_log_2026_01;

-- Add integration_type column
ALTER TABLE integration_sync_log 
ADD COLUMN integration_type VARCHAR(50) DEFAULT 'golioth';

-- Update constraint
ALTER TABLE integration_sync_log 
ADD CONSTRAINT integration_sync_log_integration_type_check 
CHECK (integration_type::text = ANY (ARRAY[
  'golioth', 'aws_iot', 'azure_iot', 'mqtt'
]::text[]));
```

---

## 📋 Complete Migration Checklist

### Code Creation ⏳
- [ ] Create AWS IoT provider (~250 lines)
- [ ] Create Azure IoT provider (~250 lines)
- [ ] Create MQTT provider (~200 lines)
- [ ] Update provider factory registration
- [ ] Create migration to remove google_iot
- [ ] Create migration to rename golioth_sync_log tables

### Code Migration ⏳
- [ ] Update `OrganizationIntegrationManager.tsx` to use orchestrator
- [ ] Update all device detail pages
- [ ] Update dashboard components
- [ ] Migrate `golioth-sync.service.ts` → `integration-sync.service.ts`
- [ ] Update all UI forms to remove Google IoT option

### Code Deletion 🗑️
- [ ] Delete `src/lib/sync/organization-golioth-sync.ts`
- [ ] Delete `src/lib/integrations/organization-golioth.ts`
- [ ] Remove feature flags (after rollout complete)
- [ ] Remove old imports from all files

### Testing ✅
- [ ] Unit tests for each provider
- [ ] Integration tests with real AWS/Azure/MQTT brokers
- [ ] UI testing for all integration types
- [ ] Sync testing across all providers
- [ ] Migration testing (old data → new schema)

### Documentation 📚
- [ ] Update README with new provider architecture
- [ ] Create provider development guide
- [ ] Document AWS IoT setup process
- [ ] Document Azure IoT setup process
- [ ] Document MQTT broker setup
- [ ] Update API documentation

---

## 🎯 Implementation Order (Recommended)

### Week 1: AWS IoT Provider
**Day 1-2:** Create AWS IoT provider
**Day 3:** Register in factory, basic testing
**Day 4:** Integration testing with real AWS account
**Day 5:** Documentation

### Week 2: Azure IoT Provider  
**Day 1-2:** Create Azure IoT provider
**Day 3:** Register in factory, basic testing
**Day 4:** Integration testing with real Azure account
**Day 5:** Documentation

### Week 3: MQTT Provider
**Day 1-2:** Create MQTT provider
**Day 3:** Testing with HiveMQ/Mosquitto
**Day 4:** Advanced MQTT features
**Day 5:** Documentation

### Week 4: UI Migration
**Day 1:** Update OrganizationIntegrationManager
**Day 2:** Update device detail pages
**Day 3:** Update dashboard components
**Day 4-5:** Testing all UI components

### Week 5: Database Migration
**Day 1:** Create migrations
**Day 2:** Test migrations locally
**Day 3:** Backup production, run migrations
**Day 4:** Verify data integrity
**Day 5:** Monitor and fix issues

### Week 6: Code Cleanup
**Day 1:** Delete old sync service
**Day 2:** Delete old organization-golioth API
**Day 3:** Update imports everywhere
**Day 4:** Remove feature flags
**Day 5:** Final cleanup and documentation

---

## 🚨 Breaking Changes & Migration Path

### For Users
**NO BREAKING CHANGES** - All existing integrations continue to work

### For Developers
**BREAKING CHANGES:**
1. `organizationGoliothSyncService` → Use `SyncOrchestrator` instead
2. `OrganizationGoliothAPI` → Use `IntegrationProviderFactory` instead
3. Google IoT integrations will be disabled (service discontinued)

### Migration Script
```typescript
// scripts/migrate-to-provider-system.ts
async function migrateOldCode() {
  // 1. Find all Google IoT integrations
  const googleIntegrations = await supabase
    .from('device_integrations')
    .select('*')
    .eq('integration_type', 'google_iot');
  
  // 2. Disable them with migration notice
  for (const integration of googleIntegrations.data) {
    await supabase
      .from('device_integrations')
      .update({
        is_active: false,
        settings: {
          ...integration.settings,
          migration_notice: 'Google IoT Core discontinued. Please migrate to AWS IoT or Azure IoT.'
        }
      })
      .eq('id', integration.id);
  }
  
  // 3. Update UI to show migration notice
}
```

---

## 📊 Final Architecture

```
Frontend Components
       ↓
SyncOrchestrator (Generic)
       ↓
IntegrationProviderFactory
       ↓
┌──────────┬────────────┬────────────┬──────────┐
│ Golioth  │  AWS IoT   │ Azure IoT  │   MQTT   │
│ Provider │  Provider  │  Provider  │ Provider │
│    ✅    │     ⏳     │     ⏳     │    ⏳    │
└────┬─────┴─────┬──────┴─────┬──────┴────┬─────┘
     │           │            │           │
     ↓           ↓            ↓           ↓
 Golioth     AWS SDK     Azure SDK    MQTT.js
   API     IoT Client    IoT Hub       Client
```

**Benefits:**
- ✅ Single sync orchestrator for ALL providers
- ✅ Easy to add new providers (just implement interface)
- ✅ NO old code left behind
- ✅ Clean, maintainable architecture
- ✅ Fully tested and documented

---

## 💰 Estimated Effort

**Total Development Time:** 6 weeks (1 developer)
**Total Lines of Code:** ~1,500 new + 500 deleted = 1,000 net lines
**Testing Time:** 2 weeks
**Documentation Time:** 1 week

**Grand Total:** 9 weeks for complete migration

---

**Status:** Ready to begin implementation
**Next Step:** Create AWS IoT provider
**Priority:** High - Complete before v2.0.0 release
