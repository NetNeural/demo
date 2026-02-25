# Golioth Enhancement Suite - Technical Specifications
**Issues #80-89 | Developer Reference | Database Schemas, APIs, Code Patterns**

---

## 🗄️ Database Schema Changes

### Issue #80: Missing Golioth Fields

```sql
-- Migration: 20260126000001_add_missing_golioth_fields.sql

-- Add missing fields to devices table
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS last_seen_online TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_seen_offline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hardware_ids TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cohort_id TEXT,
  ADD COLUMN IF NOT EXISTS golioth_status TEXT CHECK (golioth_status IN ('enabled', 'disabled', 'suspended'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_devices_last_seen_online 
  ON devices(last_seen_online DESC) WHERE last_seen_online IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_devices_cohort_id 
  ON devices(cohort_id) WHERE cohort_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_devices_hardware_ids 
  ON devices USING GIN(hardware_ids);

-- Add comment documentation
COMMENT ON COLUMN devices.last_seen_online IS 'Timestamp when device was last seen online (from Golioth)';
COMMENT ON COLUMN devices.last_seen_offline IS 'Timestamp when device last went offline (from Golioth)';
COMMENT ON COLUMN devices.hardware_ids IS 'Array of hardware identifiers (MAC addresses, IMEI, etc.)';
COMMENT ON COLUMN devices.cohort_id IS 'Golioth cohort ID for firmware deployment targeting';
COMMENT ON COLUMN devices.golioth_status IS 'Device status in Golioth platform';
```

**Rollback:**
```sql
-- Rollback: Remove added columns
ALTER TABLE devices
  DROP COLUMN IF EXISTS last_seen_online,
  DROP COLUMN IF EXISTS last_seen_offline,
  DROP COLUMN IF EXISTS hardware_ids,
  DROP COLUMN IF EXISTS cohort_id,
  DROP COLUMN IF EXISTS golioth_status;

DROP INDEX IF EXISTS idx_devices_last_seen_online;
DROP INDEX IF EXISTS idx_devices_cohort_id;
DROP INDEX IF EXISTS idx_devices_hardware_ids;
```

---

### Issue #81: Firmware History Log

```sql
-- Migration: 20260126000002_firmware_history_log.sql

-- Create firmware history table (append-only log)
CREATE TABLE device_firmware_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  firmware_version TEXT NOT NULL,
  component_type TEXT, -- 'main', 'cellgateway', 'modsensor', NULL for legacy/unknown
  installed_at TIMESTAMPTZ DEFAULT now(),
  source TEXT DEFAULT 'ota_update' CHECK (source IN ('ota_update', 'manual_provision', 'factory_default', 'unknown')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient "most recent version" queries
CREATE INDEX idx_firmware_history_device_recent 
  ON device_firmware_history(device_id, installed_at DESC);

-- Index for component-specific queries
CREATE INDEX idx_firmware_history_component 
  ON device_firmware_history(device_id, component_type, installed_at DESC) 
  WHERE component_type IS NOT NULL;

-- Function to auto-update devices.firmware_version from most recent log entry
CREATE OR REPLACE FUNCTION update_device_firmware_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Update devices.firmware_version to most recent main component (or any if no component specified)
  UPDATE devices
  SET firmware_version = NEW.firmware_version,
      updated_at = now()
  WHERE id = NEW.device_id
    AND (NEW.component_type = 'main' OR NEW.component_type IS NULL);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update on insert
CREATE TRIGGER trg_update_firmware_version
  AFTER INSERT ON device_firmware_history
  FOR EACH ROW
  EXECUTE FUNCTION update_device_firmware_version();

-- Comments
COMMENT ON TABLE device_firmware_history IS 'Append-only log of firmware versions (Issue #81)';
COMMENT ON COLUMN device_firmware_history.component_type IS 'Firmware component (main, cellgateway, modsensor) or NULL for monolithic';
COMMENT ON COLUMN device_firmware_history.source IS 'How firmware was installed (OTA, manual, factory)';
```

**Rollback:**
```sql
DROP TRIGGER IF EXISTS trg_update_firmware_version ON device_firmware_history;
DROP FUNCTION IF EXISTS update_device_firmware_version();
DROP TABLE IF EXISTS device_firmware_history;
```

---

### Issue #83: Device Matching (Serial Number Column)

```sql
-- Migration: 20260126000003_device_serial_number.sql

-- Add serial_number column (may already exist)
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS serial_number TEXT UNIQUE;

-- Index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_serial_number 
  ON devices(serial_number) 
  WHERE serial_number IS NOT NULL;

-- Populate from existing data (if available in metadata)
UPDATE devices
SET serial_number = metadata->>'serial_number'
WHERE serial_number IS NULL 
  AND metadata->>'serial_number' IS NOT NULL;

COMMENT ON COLUMN devices.serial_number IS 'Unique device serial number (matches Golioth Device Name)';
```

**Rollback:**
```sql
ALTER TABLE devices DROP COLUMN IF EXISTS serial_number;
DROP INDEX IF EXISTS idx_devices_serial_number;
```

---

### Issue #85: Firmware Artifacts Catalog

```sql
-- Migration: 20260126000004_firmware_artifacts.sql

CREATE TABLE firmware_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES organization_integrations(id) ON DELETE CASCADE,
  external_artifact_id TEXT NOT NULL, -- Golioth artifact ID
  package_name TEXT NOT NULL,
  version TEXT NOT NULL,
  component_type TEXT, -- 'main', 'cellgateway', 'modsensor'
  size_bytes BIGINT,
  checksum_sha256 TEXT,
  release_date TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(integration_id, external_artifact_id)
);

-- Indexes
CREATE INDEX idx_firmware_artifacts_org 
  ON firmware_artifacts(organization_id, created_at DESC);

CREATE INDEX idx_firmware_artifacts_integration 
  ON firmware_artifacts(integration_id, package_name, version);

CREATE INDEX idx_firmware_artifacts_version 
  ON firmware_artifacts(package_name, version);

COMMENT ON TABLE firmware_artifacts IS 'Catalog of available firmware artifacts from IoT platforms';
```

**Rollback:**
```sql
DROP TABLE IF EXISTS firmware_artifacts;
```

---

### Issue #86: Device Credentials (Encrypted PSK)

```sql
-- Migration: 20260126000005_device_credentials.sql

-- Enable Supabase Vault (pgsodium extension) if not already enabled
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Create credentials table with encryption
CREATE TABLE device_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  credential_type TEXT NOT NULL CHECK (credential_type IN ('PRE_SHARED_KEY', 'CERTIFICATE', 'TOKEN')),
  identity TEXT NOT NULL, -- PSK-ID, cert CN, token name
  encrypted_secret TEXT, -- Encrypted PSK, cert private key, token value
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  last_accessed_by UUID REFERENCES auth.users(id),
  UNIQUE(device_id, credential_type)
);

-- Indexes
CREATE INDEX idx_device_credentials_device 
  ON device_credentials(device_id);

CREATE INDEX idx_device_credentials_expiring 
  ON device_credentials(expires_at) 
  WHERE expires_at IS NOT NULL AND expires_at > now();

-- Audit log for credential access
CREATE TABLE device_credential_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES device_credentials(id) ON DELETE CASCADE,
  accessed_by UUID NOT NULL REFERENCES auth.users(id),
  accessed_at TIMESTAMPTZ DEFAULT now(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_credential_access_log_credential 
  ON device_credential_access_log(credential_id, accessed_at DESC);

CREATE INDEX idx_credential_access_log_user 
  ON device_credential_access_log(accessed_by, accessed_at DESC);

-- Helper function to decrypt credentials (RLS enforces access control)
CREATE OR REPLACE FUNCTION decrypt_device_credential(credential_id UUID)
RETURNS TEXT AS $$
DECLARE
  encrypted_value TEXT;
  decrypted_value TEXT;
BEGIN
  -- Get encrypted value
  SELECT encrypted_secret INTO encrypted_value
  FROM device_credentials
  WHERE id = credential_id;
  
  -- Decrypt using pgsodium (simplified - actual implementation depends on Supabase Vault setup)
  -- decrypted_value := pgsodium.crypto_secretbox_open(...);
  
  -- For now, return encrypted (implement actual decryption with Supabase Vault)
  RETURN encrypted_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE device_credentials IS 'Encrypted device credentials (PSK, certificates, tokens)';
COMMENT ON TABLE device_credential_access_log IS 'Audit log for credential access (security compliance)';
```

**Rollback:**
```sql
DROP FUNCTION IF EXISTS decrypt_device_credential(UUID);
DROP TABLE IF EXISTS device_credential_access_log;
DROP TABLE IF EXISTS device_credentials;
```

---

### Issue #87: Conflict Detection

```sql
-- Migration: 20260126000006_sync_conflicts.sql

CREATE TABLE sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  local_value JSONB,
  remote_value JSONB,
  conflict_detected_at TIMESTAMPTZ DEFAULT now(),
  resolution_strategy TEXT CHECK (resolution_strategy IN ('prefer_local', 'prefer_remote', 'manual', 'merge')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT
);

-- Indexes
CREATE INDEX idx_sync_conflicts_unresolved 
  ON sync_conflicts(device_id, conflict_detected_at DESC) 
  WHERE resolved_at IS NULL;

CREATE INDEX idx_sync_conflicts_device 
  ON sync_conflicts(device_id, conflict_detected_at DESC);

COMMENT ON TABLE sync_conflicts IS 'Detected conflicts between local and remote device data';
```

**Rollback:**
```sql
DROP TABLE IF EXISTS sync_conflicts;
```

---

## 🔌 API Endpoints

### Issue #89: Unified Device Status API

**Endpoint:** `GET /api/devices/{deviceId}/status`

**Request:**
```http
GET /api/devices/123e4567-e89b-12d3-a456-426614174000/status
Authorization: Bearer <token>
```

**Response (Success):**
```json
{
  "device": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Gateway-001",
    "deviceType": "cellular_gateway",
    "serialNumber": "GW-2024-0001"
  },
  "status": "online",
  "statusReason": null,
  "connection": {
    "isConnected": true,
    "lastSeenOnline": "2026-01-26T10:30:00Z",
    "lastSeenOffline": "2026-01-25T22:15:00Z",
    "uptime": 43200,
    "signalStrength": 85
  },
  "firmware": {
    "version": "1.2.3",
    "componentVersions": {
      "main": "1.2.3",
      "cellgateway": "2.1.0",
      "modsensor": "1.0.5"
    },
    "updateAvailable": true,
    "updateInProgress": false
  },
  "telemetry": {
    "batteryLevel": 85,
    "temperature": 22.5,
    "signalQuality": "excellent",
    "lastDataReceived": "2026-01-26T10:29:00Z"
  },
  "integration": {
    "type": "golioth",
    "name": "Production IoT Platform",
    "capabilities": {
      "supportsRealTimeStatus": true,
      "supportsTelemetry": false,
      "supportsFirmwareManagement": true,
      "supportsRemoteCommands": false,
      "supportsBidirectionalSync": true
    }
  }
}
```

**Response (Device Offline):**
```json
{
  "device": { ... },
  "status": "offline",
  "statusReason": "No heartbeat received for 24 hours",
  "connection": {
    "isConnected": false,
    "lastSeenOnline": "2026-01-24T10:30:00Z",
    "lastSeenOffline": "2026-01-24T10:35:00Z",
    "uptime": null
  },
  ...
}
```

**Response (Error):**
```json
{
  "error": "Device not found",
  "statusCode": 404
}
```

**Implementation:**
```typescript
// File: src/app/api/devices/[deviceId]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { IntegrationProviderFactory } from '@/lib/integrations/integration-provider-factory';
import { getDevice } from '@/lib/db/devices';

export async function GET(
  request: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  try {
    // 1. Get device with integration info
    const device = await getDevice(params.deviceId);
    
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }
    
    // 2. Create provider (works for ANY integration type)
    const provider = IntegrationProviderFactory.create(device.integration);
    
    // 3. Fetch status from provider
    const [status, connection] = await Promise.all([
      provider.getDeviceStatus(device.external_device_id),
      provider.getConnectionInfo(device.external_device_id)
    ]);
    
    // 4. Build unified response
    return NextResponse.json({
      device: {
        id: device.id,
        name: device.name,
        deviceType: device.device_type,
        serialNumber: device.serial_number
      },
      status: status.connectionState,
      statusReason: status.statusReason,
      connection: {
        isConnected: connection.state === 'online',
        lastSeenOnline: connection.lastActivity,
        uptime: connection.uptime
      },
      firmware: status.firmware,
      telemetry: status.telemetry,
      integration: {
        type: device.integration.integration_type,
        name: device.integration.name,
        capabilities: provider.getCapabilities()
      }
    });
  } catch (error) {
    console.error('Device status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
```

---

### Issue #86: Device Credentials API

**Endpoint:** `GET /api/devices/{deviceId}/credentials`

**Request:**
```http
GET /api/devices/123e4567-e89b-12d3-a456-426614174000/credentials
Authorization: Bearer <token>
```

**Response:**
```json
{
  "credentials": [
    {
      "id": "cred-001",
      "type": "PRE_SHARED_KEY",
      "identity": "device-gw-001-psk-id",
      "encrypted": true,
      "createdAt": "2026-01-15T10:00:00Z",
      "expiresAt": "2027-01-15T10:00:00Z"
    }
  ]
}
```

**Endpoint:** `POST /api/devices/{deviceId}/credentials/decrypt`

**Request:**
```http
POST /api/devices/123e4567-e89b-12d3-a456-426614174000/credentials/decrypt
Authorization: Bearer <token>
Content-Type: application/json

{
  "credentialId": "cred-001"
}
```

**Response:**
```json
{
  "credentialId": "cred-001",
  "type": "PRE_SHARED_KEY",
  "identity": "device-gw-001-psk-id",
  "secret": "a1b2c3d4e5f6...",
  "decryptedAt": "2026-01-26T10:35:00Z"
}
```

**Implementation:**
```typescript
// File: src/app/api/devices/[deviceId]/credentials/decrypt/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  const supabase = createClient();
  const { credentialId } = await request.json();
  
  // 1. Check permissions (RLS handles this, but explicit check for clarity)
  const { data: user } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // 2. Decrypt credential (calls database function)
  const { data: credential, error } = await supabase
    .rpc('decrypt_device_credential', { credential_id: credentialId });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // 3. Log access for audit trail
  await supabase
    .from('device_credential_access_log')
    .insert({
      credential_id: credentialId,
      accessed_by: user.user.id,
      ip_address: request.headers.get('x-forwarded-for'),
      user_agent: request.headers.get('user-agent')
    });
  
  return NextResponse.json({
    credentialId,
    secret: credential,
    decryptedAt: new Date().toISOString()
  });
}
```

---

### Issue #85: Firmware Deployment API

**Endpoint:** `POST /api/devices/{deviceId}/deploy-firmware`

**Request:**
```http
POST /api/devices/123e4567-e89b-12d3-a456-426614174000/deploy-firmware
Authorization: Bearer <token>
Content-Type: application/json

{
  "artifactId": "art-001",
  "componentType": "main"
}
```

**Response:**
```json
{
  "deploymentId": "dep-001",
  "status": "queued",
  "artifactId": "art-001",
  "version": "1.2.4",
  "queuedAt": "2026-01-26T10:40:00Z"
}
```

---

## 🧩 Code Patterns

### Issue #88: Sync Orchestrator

```typescript
// File: src/lib/sync/integration-sync-orchestrator.ts

import { IntegrationProviderFactory } from '@/lib/integrations/integration-provider-factory';
import { createClient } from '@/lib/supabase/server';

export interface SyncOptions {
  fullSync?: boolean; // Sync all devices vs. incremental
  dryRun?: boolean; // Preview changes without applying
}

export interface SyncResult {
  devicesProcessed: number;
  devicesCreated: number;
  devicesUpdated: number;
  devicesDeleted: number;
  errors: Array<{ deviceId: string; error: string }>;
  duration: number;
}

export class IntegrationSyncOrchestrator {
  async syncIntegration(
    organizationId: string,
    integrationId: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      devicesProcessed: 0,
      devicesCreated: 0,
      devicesUpdated: 0,
      devicesDeleted: 0,
      errors: [],
      duration: 0
    };
    
    try {
      const supabase = createClient();
      
      // 1. Get integration config
      const { data: integration } = await supabase
        .from('organization_integrations')
        .select('*')
        .eq('id', integrationId)
        .single();
      
      if (!integration) {
        throw new Error(`Integration ${integrationId} not found`);
      }
      
      // 2. Create provider (works for ANY integration type)
      const provider = IntegrationProviderFactory.create(integration);
      
      // 3. Fetch devices from provider
      const externalDevices = await provider.listDevices();
      
      // 4. Get local devices
      const { data: localDevices } = await supabase
        .from('devices')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('integration_id', integrationId);
      
      // 5. Match and sync
      for (const externalDevice of externalDevices.devices) {
        result.devicesProcessed++;
        
        try {
          // Find matching local device (use Issue #83 logic)
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
          result.errors.push({
            deviceId: externalDevice.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      result.duration = Date.now() - startTime;
      return result;
    } catch (error) {
      result.duration = Date.now() - startTime;
      result.errors.push({
        deviceId: 'N/A',
        error: error instanceof Error ? error.message : 'Sync failed'
      });
      return result;
    }
  }
  
  private async findMatchingDevice(
    externalDevice: any,
    localDevices: any[]
  ): Promise<any | null> {
    // Issue #83: Serial-number-primary matching
    // 1. Try serial number match (Golioth Device Name)
    const serialNumber = externalDevice.name;
    const bySerial = localDevices.find(d => d.serial_number === serialNumber);
    if (bySerial) return bySerial;
    
    // 2. Fallback: External device ID (legacy)
    const byExternalId = localDevices.find(d => d.external_device_id === externalDevice.id);
    return byExternalId || null;
  }
  
  private async updateDevice(deviceId: string, externalDevice: any): Promise<void> {
    // Implementation...
  }
  
  private async createDevice(orgId: string, integrationId: string, externalDevice: any): Promise<void> {
    // Implementation...
  }
}
```

---

### Issue #87: Conflict Detection

```typescript
// File: src/lib/sync/conflict-detector.ts

export type MergeStrategy = 'prefer_local' | 'prefer_remote' | 'manual' | 'merge';

export interface FieldConflict {
  fieldName: string;
  localValue: any;
  remoteValue: any;
  recommendedStrategy: MergeStrategy;
}

export class ConflictDetector {
  // Field-specific merge strategies
  private readonly fieldStrategies: Record<string, MergeStrategy> = {
    // User-editable fields (prefer local)
    name: 'prefer_local',
    description: 'prefer_local',
    tags: 'merge', // Array union
    notes: 'prefer_local',
    
    // Golioth-authoritative fields (prefer remote)
    status: 'prefer_remote',
    battery_level: 'prefer_remote',
    firmware_version: 'prefer_remote',
    last_seen_online: 'prefer_remote',
    last_seen_offline: 'prefer_remote',
    
    // Metadata (manual review)
    metadata: 'manual'
  };
  
  detectConflicts(localDevice: any, remoteDevice: any): FieldConflict[] {
    const conflicts: FieldConflict[] = [];
    
    for (const field of Object.keys(this.fieldStrategies)) {
      const localValue = localDevice[field];
      const remoteValue = remoteDevice[field];
      
      // Only report conflicts if values differ
      if (JSON.stringify(localValue) !== JSON.stringify(remoteValue)) {
        conflicts.push({
          fieldName: field,
          localValue,
          remoteValue,
          recommendedStrategy: this.fieldStrategies[field]
        });
      }
    }
    
    return conflicts;
  }
  
  async resolveConflicts(
    deviceId: string,
    conflicts: FieldConflict[]
  ): Promise<{ autoResolved: number; manualReview: number }> {
    let autoResolved = 0;
    let manualReview = 0;
    const supabase = createClient();
    
    for (const conflict of conflicts) {
      if (conflict.recommendedStrategy === 'manual') {
        // Queue for manual review
        await supabase
          .from('sync_conflicts')
          .insert({
            device_id: deviceId,
            field_name: conflict.fieldName,
            local_value: conflict.localValue,
            remote_value: conflict.remoteValue,
            resolution_strategy: 'manual'
          });
        manualReview++;
      } else {
        // Auto-resolve based on strategy
        const resolvedValue = this.applyStrategy(
          conflict.localValue,
          conflict.remoteValue,
          conflict.recommendedStrategy
        );
        
        await supabase
          .from('devices')
          .update({ [conflict.fieldName]: resolvedValue })
          .eq('id', deviceId);
        
        autoResolved++;
      }
    }
    
    return { autoResolved, manualReview };
  }
  
  private applyStrategy(
    localValue: any,
    remoteValue: any,
    strategy: MergeStrategy
  ): any {
    switch (strategy) {
      case 'prefer_local':
        return localValue;
      case 'prefer_remote':
        return remoteValue;
      case 'merge':
        // Array union (for tags, etc.)
        if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
          return [...new Set([...localValue, ...remoteValue])];
        }
        return remoteValue; // Default to remote if not array
      default:
        return remoteValue;
    }
  }
}
```

---

## 🧪 Testing Examples

### Unit Test: Sync Orchestrator

```typescript
// File: src/lib/sync/__tests__/integration-sync-orchestrator.test.ts

import { IntegrationSyncOrchestrator } from '../integration-sync-orchestrator';
import { IntegrationProviderFactory } from '@/lib/integrations/integration-provider-factory';

// Mock provider
jest.mock('@/lib/integrations/integration-provider-factory');

describe('IntegrationSyncOrchestrator', () => {
  let orchestrator: IntegrationSyncOrchestrator;
  
  beforeEach(() => {
    orchestrator = new IntegrationSyncOrchestrator();
  });
  
  it('should sync devices from Golioth provider', async () => {
    // Mock provider response
    const mockProvider = {
      listDevices: jest.fn().mockResolvedValue({
        devices: [
          { id: 'ext-001', name: 'GW-001', status: 'online' }
        ]
      })
    };
    
    (IntegrationProviderFactory.create as jest.Mock).mockReturnValue(mockProvider);
    
    const result = await orchestrator.syncIntegration('org-001', 'int-001');
    
    expect(result.devicesProcessed).toBe(1);
    expect(result.errors).toHaveLength(0);
  });
  
  it('should handle provider errors gracefully', async () => {
    const mockProvider = {
      listDevices: jest.fn().mockRejectedValue(new Error('API timeout'))
    };
    
    (IntegrationProviderFactory.create as jest.Mock).mockReturnValue(mockProvider);
    
    const result = await orchestrator.syncIntegration('org-001', 'int-001');
    
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('timeout');
  });
});
```

---

## 📚 Documentation Templates

### API Documentation (OpenAPI)

```yaml
# File: docs/api/device-status-api.yaml

openapi: 3.0.0
info:
  title: NetNeural Device Status API
  version: 1.0.0
  description: Unified device status API supporting multiple IoT platforms

paths:
  /api/devices/{deviceId}/status:
    get:
      summary: Get device status
      description: Returns unified status information for any device regardless of integration type
      parameters:
        - name: deviceId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Device status retrieved successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DeviceStatus'
        '404':
          description: Device not found

components:
  schemas:
    DeviceStatus:
      type: object
      properties:
        device:
          $ref: '#/components/schemas/DeviceInfo'
        status:
          type: string
          enum: [online, offline, warning, error, unknown]
        connection:
          $ref: '#/components/schemas/ConnectionInfo'
```

---

**Next Steps:**
1. Review specifications with team
2. Create feature branches
3. Begin implementation (Issue #80 first)
4. Write tests as you code (TDD approach)
5. Document as you build

**Questions?** Reference [GOLIOTH_IMPLEMENTATION_PLAN.md](./GOLIOTH_IMPLEMENTATION_PLAN.md) for strategy details.
