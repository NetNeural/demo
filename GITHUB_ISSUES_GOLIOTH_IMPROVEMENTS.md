# GitHub Issues - Golioth Integration Improvements

**Generated**: November 9, 2025
**Related Document**: `GOLIOTH_INTEGRATION_GAPS_ANALYSIS.md`

This document contains 10 ready-to-create GitHub issues for improving our Golioth integration.

---

## Issue #1: Capture Missing Golioth Device Fields

### Title
`[Enhancement] Capture missing Golioth device fields (lastSeenOnline, hardwareIds, cohortId)`

### Labels
`enhancement`, `integration`, `golioth`, `high-priority`

### Description

We're missing critical device data that Golioth provides through their API. Our sync service only captures basic fields, leaving valuable connection tracking, hardware identification, and cohort management data unused.

### Current State

The sync service (`organization-golioth-sync.ts`) currently captures:
- ✅ Device name, status, last_seen
- ✅ Battery level (from metadata)
- ✅ Generic firmware_version string
- ✅ Full metadata object

Missing from Golioth API:
- ❌ `metadata.lastSeenOnline` - Exact online timestamp
- ❌ `metadata.lastSeenOffline` - Exact offline timestamp  
- ❌ `hardwareIds[]` - Array of hardware identifiers (we only support single)
- ❌ `cohortId` - OTA update group assignment
- ❌ `status` field - Unknown purpose, currently ignored

### Impact

**User Experience:**
- Can't show "connected X minutes ago" vs "disconnected Y hours ago"
- Device with multiple hardware IDs not properly tracked
- No cohort-based firmware management
- Missing data for professional device monitoring

**Technical:**
- Incomplete device representation
- Lost data on every sync
- Can't build cohort management features

### Proposed Solution

1. **Update Database Schema**
```sql
ALTER TABLE devices ADD COLUMN last_seen_online TIMESTAMP WITH TIME ZONE;
ALTER TABLE devices ADD COLUMN last_seen_offline TIMESTAMP WITH TIME ZONE;
ALTER TABLE devices ADD COLUMN hardware_ids TEXT[];
ALTER TABLE devices ADD COLUMN cohort_id VARCHAR(100);
ALTER TABLE devices ADD COLUMN golioth_status VARCHAR(50);
```

2. **Update TypeScript Interface**
```typescript
// src/lib/golioth.ts
export interface GoliothDevice {
  // ... existing fields
  hardwareIds: string[];  // Change from hardware_id: string
  cohortId?: string;
  metadata?: {
    lastSeenOnline?: string;
    lastSeenOffline?: string;
    // ... existing metadata
  };
}
```

3. **Update Sync Service**
```typescript
// src/lib/sync/organization-golioth-sync.ts
if (syncLastSeen) {
  updateData.last_seen = goliothDevice.last_seen || null;
  updateData.last_seen_online = goliothDevice.metadata?.lastSeenOnline || null;
  updateData.last_seen_offline = goliothDevice.metadata?.lastSeenOffline || null;
}

updateData.hardware_ids = goliothDevice.hardwareIds || [];
updateData.cohort_id = goliothDevice.cohortId || null;
updateData.golioth_status = goliothDevice.status || null;
```

4. **Update UI Components**
```tsx
// Show connection timeline
<DeviceConnectionStatus 
  lastSeenOnline={device.last_seen_online}
  lastSeenOffline={device.last_seen_offline}
/>

// Show hardware IDs
<HardwareIdsList ids={device.hardware_ids} />

// Show cohort badge
<CohortBadge cohortId={device.cohort_id} />
```

### Acceptance Criteria

- [ ] Database migration created and applied
- [ ] `GoliothDevice` interface updated
- [ ] Sync service captures all new fields
- [ ] TypeScript types updated (`supabase-types.ts`)
- [ ] UI displays `lastSeenOnline`/`lastSeenOffline` timestamps
- [ ] Hardware IDs shown in device details
- [ ] Cohort displayed in device card/details
- [ ] All existing tests pass
- [ ] New fields documented

### Files to Modify

- `supabase/migrations/YYYYMMDD_add_golioth_device_fields.sql` (create)
- `src/lib/golioth.ts`
- `src/lib/sync/organization-golioth-sync.ts`
- `src/types/supabase.ts` (regenerate)
- `src/lib/supabase-types.ts` (regenerate)
- `src/components/devices/DeviceCard.tsx`
- `src/components/devices/DeviceDetails.tsx`

### Dependencies

None - Can be implemented immediately

### Effort Estimate

**Medium** - 3-4 days
- Database changes: 1 day
- TypeScript updates: 1 day
- UI components: 1-2 days

### Priority

**High** - These are foundational fields we should have captured from day 1

---

## Issue #2: Multi-Component Firmware Tracking

### Title
`[Feature] Track multiple firmware components per device (main, cellgateway, modsensor)`

### Labels
`feature`, `firmware`, `golioth`, `high-priority`

### Description

Golioth devices have multiple firmware components (e.g., "main" v1.0.0, "cellgateway-nrf9151" v1.0.6), each with its own version, update state, and progress. Currently we only store a single `firmware_version` string, losing critical OTA update tracking data.

### Current State

**What we store:**
```typescript
device.firmware_version = "1.0.6"  // Single string, which component?
```

**What Golioth provides:**
```json
{
  "metadata": {
    "update": {
      "cellgateway-nrf9151-firmware": {
        "package": "cellgateway-nrf9151-firmware",
        "version": "1.0.6",
        "state": "IDLE",
        "stateCode": "0",
        "reason": "ready state",
        "reasonCode": "0",
        "target": "1.0.7",
        "time": "2025-11-09T20:23:39.113Z"
      },
      "main": {
        "package": "main",
        "version": "1.0.0",
        "state": "DOWNLOADING",
        "target": "1.0.1",
        "time": "2025-11-09T22:15:00.000Z"
      }
    }
  }
}
```

### Impact

**Missing Capabilities:**
- Can't show OTA update in progress
- Can't track update state (IDLE, DOWNLOADING, INSTALLING)
- Can't display target version during updates
- Can't show per-component firmware versions
- No update timestamp tracking
- No failure reason capture

**Business Impact:**
- Not competitive with Golioth console for OTA management
- Can't provide firmware compliance reporting
- Users must use external tools for firmware tracking

### Proposed Solution

1. **Create New Table**
```sql
CREATE TABLE device_firmware_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    component_name VARCHAR(100) NOT NULL,  -- "main", "cellgateway-nrf9151-firmware"
    package_name VARCHAR(100) NOT NULL,
    current_version VARCHAR(50) NOT NULL,
    target_version VARCHAR(50),
    state VARCHAR(50) NOT NULL,  -- IDLE, DOWNLOADING, INSTALLING, INSTALLED, FAILED
    state_code VARCHAR(10),
    reason TEXT,
    reason_code VARCHAR(10),
    progress INTEGER CHECK (progress >= 0 AND progress <= 100),
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(device_id, component_name)
);

CREATE INDEX idx_firmware_components_device ON device_firmware_components(device_id);
CREATE INDEX idx_firmware_components_state ON device_firmware_components(state);
```

2. **Parse and Store Components**
```typescript
// src/lib/database/firmware-components.ts
export class FirmwareComponentService {
  async syncDeviceComponents(deviceId: string, updateMetadata: Record<string, FirmwareComponent>) {
    for (const [componentName, component] of Object.entries(updateMetadata)) {
      await this.upsertComponent({
        device_id: deviceId,
        component_name: componentName,
        package_name: component.package,
        current_version: component.version,
        target_version: component.target || null,
        state: component.state,
        state_code: component.stateCode,
        reason: component.reason,
        reason_code: component.reasonCode,
        last_updated: component.time
      });
    }
  }
}
```

3. **Update Sync Service**
```typescript
// In organization-golioth-sync.ts
if (syncFirmware && goliothDevice.metadata?.update) {
  await firmwareComponentService.syncDeviceComponents(
    localDevice.id,
    goliothDevice.metadata.update
  );
}
```

4. **Create UI Components**
```tsx
// src/components/devices/FirmwareStatusWidget.tsx
export function FirmwareStatusWidget({ deviceId }: Props) {
  const components = useFirmwareComponents(deviceId);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Firmware Components</CardTitle>
      </CardHeader>
      <CardContent>
        {components.map(component => (
          <div key={component.component_name}>
            <div className="flex justify-between">
              <span>{component.component_name}</span>
              <Badge>{component.current_version}</Badge>
            </div>
            
            {component.state !== 'IDLE' && (
              <div className="mt-2">
                <Progress value={component.progress || 0} />
                <span className="text-sm text-muted-foreground">
                  {component.state} - {component.reason}
                </span>
              </div>
            )}
            
            {component.target_version && (
              <div className="text-sm">
                Updating to {component.target_version}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

### Acceptance Criteria

- [ ] `device_firmware_components` table created
- [ ] Database migration applied
- [ ] `FirmwareComponentService` implemented
- [ ] Sync service parses and stores firmware components
- [ ] UI widget displays all firmware components
- [ ] Update state shown with progress bars
- [ ] Target version displayed during updates
- [ ] Update timestamps shown
- [ ] RLS policies created
- [ ] Tests written

### Files to Create

- `supabase/migrations/YYYYMMDD_device_firmware_components.sql`
- `src/lib/database/firmware-components.ts`
- `src/components/devices/FirmwareStatusWidget.tsx`
- `src/hooks/useFirmwareComponents.ts`

### Files to Modify

- `src/lib/sync/organization-golioth-sync.ts`
- `src/components/devices/DeviceDetails.tsx` (add widget)

### Dependencies

- None - independent feature

### Effort Estimate

**High** - 5-7 days
- Database design: 1 day
- Service implementation: 2 days
- Sync integration: 1 day
- UI components: 2-3 days

### Priority

**High** - Critical for professional OTA firmware management

---

## Issue #3: BLE Device Management

### Title
`[Feature] Track and manage BLE peripheral devices connected to gateways`

### Labels
`feature`, `ble`, `golioth`, `medium-priority`

### Description

Gateway devices report connected BLE peripherals via Golioth's LightDB Stream data. Each gateway can have 10+ BLE devices with MAC addresses and passkeys stored in `device.data.BLEPassKeys`. We currently store this in generic metadata but don't parse or display it in the UI.

### Current State

**Golioth Data Structure:**
```json
{
  "data": {
    "BLEPassKeys": {
      "0": {
        "bleid": "E3:12:D7:3D:11:4A",
        "passkey": 342039
      },
      "1": {
        "bleid": "DD:3A:F2:56:6A:11",
        "passkey": 189912
      }
      // ... up to 10 BLE devices
    }
  }
}
```

**Current Storage:**
```typescript
device.metadata = { BLEPassKeys: { ... } }  // Generic JSONB
```

**Impact:**
- Can't query BLE devices
- No BLE device list in UI
- Passkeys hidden from users
- Can't monitor BLE connectivity
- No BLE-specific features

### Proposed Solution

1. **Create BLE Peripherals Table**
```sql
CREATE TABLE device_ble_peripherals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gateway_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    slot_number INTEGER NOT NULL,  -- 0-9 in BLEPassKeys
    ble_mac_address VARCHAR(20) NOT NULL,
    passkey INTEGER,
    name VARCHAR(255),
    last_seen TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'unknown',
    rssi INTEGER,  -- Signal strength
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(gateway_device_id, slot_number),
    UNIQUE(gateway_device_id, ble_mac_address)
);

CREATE INDEX idx_ble_peripherals_gateway ON device_ble_peripherals(gateway_device_id);
CREATE INDEX idx_ble_peripherals_mac ON device_ble_peripherals(ble_mac_address);
```

2. **Parse BLE Data in Sync**
```typescript
// src/lib/database/ble-devices.ts
export class BleDeviceService {
  async syncGatewayBleDevices(gatewayDeviceId: string, blePassKeys: Record<string, BlePassKey>) {
    for (const [slot, bleData] of Object.entries(blePassKeys)) {
      await this.upsertBleDevice({
        gateway_device_id: gatewayDeviceId,
        slot_number: parseInt(slot),
        ble_mac_address: bleData.bleid,
        passkey: bleData.passkey,
        last_seen: new Date()
      });
    }
  }
}
```

3. **UI Component**
```tsx
// src/components/devices/BleDevicesList.tsx
export function BleDevicesList({ gatewayDeviceId }: Props) {
  const bleDevices = useBleDevices(gatewayDeviceId);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected BLE Devices</CardTitle>
        <CardDescription>{bleDevices.length} devices paired</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>MAC Address</TableHead>
              <TableHead>Passkey</TableHead>
              <TableHead>Last Seen</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bleDevices.map(device => (
              <TableRow key={device.id}>
                <TableCell className="font-mono text-sm">
                  {device.ble_mac_address}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <code>{device.passkey}</code>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => copyToClipboard(device.passkey)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <RelativeTime time={device.last_seen} />
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm">
                    Pair Device
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

### Acceptance Criteria

- [ ] `device_ble_peripherals` table created
- [ ] BLE data parsed from `device.data.BLEPassKeys`
- [ ] BLE devices synced on every gateway sync
- [ ] BLE devices list component created
- [ ] Passkeys displayed with copy-to-clipboard
- [ ] Last seen timestamps shown
- [ ] Component added to gateway device details page
- [ ] RLS policies created
- [ ] Tests written

### Files to Create

- `supabase/migrations/YYYYMMDD_device_ble_peripherals.sql`
- `src/lib/database/ble-devices.ts`
- `src/components/devices/BleDevicesList.tsx`
- `src/hooks/useBleDevices.ts`

### Files to Modify

- `src/lib/sync/organization-golioth-sync.ts`
- `src/components/devices/DeviceDetails.tsx`

### Dependencies

- None

### Effort Estimate

**Medium** - 3-4 days
- Database: 1 day
- Service: 1 day
- UI: 1-2 days

### Priority

**Medium** - Valuable for gateway management, not blocking

---

## Issue #4: Device Credentials Management

### Title
`[Feature] Store and display device credentials (PSK) for provisioning`

### Labels
`feature`, `security`, `golioth`, `medium-priority`

### Description

Golioth provides device credentials (Pre-Shared Keys) via API endpoint. These are needed for provisioning new devices but currently not captured or displayed in our UI. Users must access Golioth console to get PSKs.

### Current State

**Golioth API Provides:**
```
GET /projects/{projectId}/devices/{deviceId}/credentials

Response:
{
  "id": "68bf1cc5425dd2ea93f248a4",
  "type": "PRE_SHARED_KEY",
  "identity": "20250908181325-c253700003@nn-cellular-alerts",
  "createdAt": "2025-09-08T18:13:25.789Z",
  "preSharedKey": "1739a901d4f96dcbcdb0383d8cc854c7"
}
```

**We capture:** Nothing

**Impact:**
- Users need Golioth console for device setup
- No credential visibility in our platform
- Can't support device provisioning workflows
- No credential rotation tracking

### Proposed Solution

1. **Create Credentials Table**
```sql
CREATE TABLE device_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    external_credential_id VARCHAR(255),
    credential_type VARCHAR(50) NOT NULL,  -- PRE_SHARED_KEY, CERTIFICATE, TOKEN
    identity VARCHAR(255),
    credential_encrypted TEXT NOT NULL,  -- Encrypted PSK or certificate
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    last_rotated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_device_credentials_device ON device_credentials(device_id);
CREATE INDEX idx_device_credentials_type ON device_credentials(credential_type);
```

2. **Fetch Credentials API**
```typescript
// src/lib/golioth.ts - Add method
async getDeviceCredentials(deviceId: string): Promise<GoliothCredential[]> {
  return this.request<GoliothCredential[]>(
    `/v1/projects/${this.projectId}/devices/${deviceId}/credentials`
  );
}
```

3. **Sync Credentials**
```typescript
// Optional sync step
if (options.syncCredentials) {
  const credentials = await goliothAPI.getDeviceCredentials(deviceId);
  await credentialService.syncCredentials(localDevice.id, credentials);
}
```

4. **UI Display**
```tsx
// src/components/devices/DeviceCredentialsCard.tsx
export function DeviceCredentialsCard({ deviceId }: Props) {
  const credentials = useDeviceCredentials(deviceId);
  const [showPSK, setShowPSK] = useState(false);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Device Credentials</CardTitle>
      </CardHeader>
      <CardContent>
        {credentials.map(cred => (
          <div key={cred.id}>
            <Label>Type</Label>
            <Badge>{cred.credential_type}</Badge>
            
            <Label>Identity</Label>
            <code className="text-sm">{cred.identity}</code>
            
            <Label>Pre-Shared Key</Label>
            <div className="flex gap-2">
              <Input 
                type={showPSK ? "text" : "password"}
                value={cred.decrypted_key}
                readOnly
              />
              <Button onClick={() => setShowPSK(!showPSK)}>
                {showPSK ? <EyeOff /> : <Eye />}
              </Button>
              <Button onClick={() => copyToClipboard(cred.decrypted_key)}>
                <Copy />
              </Button>
            </div>
            
            <div className="text-sm text-muted-foreground">
              Created: <RelativeTime time={cred.created_at} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

### Security Considerations

- Store PSKs encrypted at rest (use Supabase Vault or similar)
- Only decrypt for display when user explicitly requests
- Log credential access
- Support credential rotation
- RLS policies to restrict access

### Acceptance Criteria

- [ ] `device_credentials` table created with encryption
- [ ] Golioth API method for fetching credentials
- [ ] Credential sync implemented
- [ ] Credentials stored encrypted
- [ ] UI card displays credentials
- [ ] Show/hide PSK toggle
- [ ] Copy to clipboard functionality
- [ ] RLS policies enforce access control
- [ ] Audit logging for credential access
- [ ] Tests written

### Files to Create

- `supabase/migrations/YYYYMMDD_device_credentials.sql`
- `src/lib/database/credentials.ts`
- `src/components/devices/DeviceCredentialsCard.tsx`
- `src/hooks/useDeviceCredentials.ts`

### Files to Modify

- `src/lib/golioth.ts`
- `src/lib/sync/organization-golioth-sync.ts`
- `src/components/devices/DeviceDetails.tsx`

### Dependencies

- Encryption solution (Supabase Vault or similar)

### Effort Estimate

**Medium** - 3-4 days
- Database + encryption: 1-2 days
- API integration: 1 day
- UI: 1 day

### Priority

**Medium** - Nice to have for provisioning workflows

---

## Issue #5: Firmware Artifacts Catalog & OTA Management

### Title
`[Feature] Sync firmware artifacts from Golioth and enable OTA deployment management`

### Labels
`feature`, `firmware`, `ota`, `golioth`, `medium-priority`

### Description

Golioth provides firmware artifacts (OTA packages) via API. We should sync these to enable firmware version tracking, deployment management, and OTA update workflows within our platform.

### Current State

**Golioth API Provides:**
```
GET /projects/{projectId}/artifacts

Response:
[
  {
    "id": "68f7bbbe424cece3ad3e36f4",
    "version": "1.0.6",
    "package": "cellgateway-nrf9151-firmware",
    "createdAt": "2025-10-21T16:58:38.869Z",
    "size": "354531",
    "binaryInfo": {
      "type": "mcuboot",
      "size": 354531,
      "digests": {
        "sha256": {
          "digest": "4ece0ac612122a27...",
          "size": 32
        }
      }
    }
  }
]
```

**Current State:**
- 4 artifacts available in test project
- Not synced to our database
- Can't list available versions
- No deployment management

### Proposed Solution

1. **Create Firmware Artifacts Table**
```sql
CREATE TABLE firmware_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES device_integrations(id) ON DELETE CASCADE,
    external_artifact_id VARCHAR(255) NOT NULL,
    package_name VARCHAR(100) NOT NULL,
    version VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    binary_type VARCHAR(50),  -- "mcuboot", etc.
    sha256_digest TEXT,
    release_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(integration_id, external_artifact_id)
);

CREATE INDEX idx_firmware_artifacts_integration ON firmware_artifacts(integration_id);
CREATE INDEX idx_firmware_artifacts_package ON firmware_artifacts(package_name);
CREATE INDEX idx_firmware_artifacts_version ON firmware_artifacts(version);
```

2. **Sync Artifacts**
```typescript
// src/lib/database/firmware-artifacts.ts
export class FirmwareArtifactService {
  async syncArtifacts(organizationId: string, integrationId: string) {
    const artifacts = await goliothAPI.getArtifacts(integrationId);
    
    for (const artifact of artifacts) {
      await this.upsertArtifact({
        organization_id: organizationId,
        integration_id: integrationId,
        external_artifact_id: artifact.id,
        package_name: artifact.package,
        version: artifact.version,
        file_size: parseInt(artifact.size),
        binary_type: artifact.binaryInfo.type,
        sha256_digest: artifact.binaryInfo.digests.sha256.digest,
        release_date: artifact.createdAt
      });
    }
  }
}
```

3. **Firmware Management Page**
```tsx
// src/app/dashboard/firmware/page.tsx
export default function FirmwarePage() {
  const artifacts = useFirmwareArtifacts();
  
  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Firmware Management</h1>
        <Button onClick={syncArtifacts}>
          <RefreshCw className="mr-2" />
          Sync Artifacts
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Available Firmware Versions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Package</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Released</TableHead>
                <TableHead>Deployed</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {artifacts.map(artifact => (
                <TableRow key={artifact.id}>
                  <TableCell className="font-medium">
                    {artifact.package_name}
                  </TableCell>
                  <TableCell>
                    <Badge>{artifact.version}</Badge>
                  </TableCell>
                  <TableCell>{formatBytes(artifact.file_size)}</TableCell>
                  <TableCell>
                    <RelativeTime time={artifact.release_date} />
                  </TableCell>
                  <TableCell>
                    <DeviceCount packageName={artifact.package_name} version={artifact.version} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => viewDetails(artifact)}>
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deployToDevices(artifact)}>
                          Deploy to Devices
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => viewDeploymentHistory(artifact)}>
                          Deployment History
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <DeploymentDialog />
    </div>
  );
}
```

4. **Deployment Dialog**
```tsx
// Select devices and trigger OTA update
<DeploymentDialog 
  artifact={selectedArtifact}
  onDeploy={async (deviceIds) => {
    await firmwareService.deployToDevices(artifact.id, deviceIds);
  }}
/>
```

### Acceptance Criteria

- [ ] `firmware_artifacts` table created
- [ ] Artifact sync implemented
- [ ] Firmware management page created
- [ ] List artifacts with versions, sizes, dates
- [ ] Show device count per version
- [ ] Sync artifacts button
- [ ] View artifact details (SHA256, binary info)
- [ ] Deployment dialog (select devices)
- [ ] Track deployment history
- [ ] RLS policies created
- [ ] Tests written

### Files to Create

- `supabase/migrations/YYYYMMDD_firmware_artifacts.sql`
- `src/lib/database/firmware-artifacts.ts`
- `src/app/dashboard/firmware/page.tsx`
- `src/components/firmware/ArtifactsList.tsx`
- `src/components/firmware/DeploymentDialog.tsx`
- `src/components/firmware/DeploymentHistory.tsx`
- `src/hooks/useFirmwareArtifacts.ts`

### Files to Modify

- `src/lib/golioth.ts` (add artifacts methods if missing)

### Dependencies

- Issue #2 (firmware components) - nice to have but not required

### Effort Estimate

**High** - 5-7 days
- Database: 1 day
- Sync service: 1-2 days
- UI pages: 3-4 days

### Priority

**Medium** - Enables professional OTA management but not blocking

---

## Issue #6: Smart Device Matching Algorithm

### Title
`[Enhancement] Implement multi-strategy device matching (ID, hardware ID, name similarity)`

### Labels
`enhancement`, `sync`, `golioth`, `medium-priority`

### Description

User request: "look for existing devices in our app that match the names from Golioth"

Current sync only matches by `external_device_id`. If a user manually creates a device before importing from Golioth, we create a duplicate. Need intelligent matching using multiple strategies.

### Current State

**Current Matching:**
```typescript
// Only matches by exact external_device_id
const goliothDevice = goliothDeviceMap.get(localDevice.external_device_id);
```

**Problem Scenarios:**

1. **Scenario A: Manual Device Creation**
   - User creates "Flow Meter 1" manually in our app
   - Sync imports "Flow Meter 1" from Golioth
   - Result: Two devices with same name

2. **Scenario B: Hardware ID Changed**
   - Device hardware ID updated in Golioth
   - Sync doesn't match by old ID
   - Result: Orphaned local device + new duplicate

3. **Scenario C: Name Changed**
   - Device renamed in Golioth
   - Sync matches by ID but doesn't detect name conflict
   - Result: Confusing device list

### Proposed Solution

Implement multi-strategy matching with confidence scores:

1. **Matching Strategies**

```typescript
// src/lib/sync/matching/strategies.ts

interface MatchStrategy {
  name: string;
  match(local: Device, external: Device): MatchScore;
}

interface MatchScore {
  score: number;  // 0.0 - 1.0
  confidence: 'high' | 'medium' | 'low' | 'none';
  method: string;
  reason?: string;
}

// Strategy 1: Exact ID Match (100% confidence)
class ExactIdMatcher implements MatchStrategy {
  name = 'exact_id';
  
  match(local, external): MatchScore {
    if (local.external_device_id === external.id) {
      return {
        score: 1.0,
        confidence: 'high',
        method: 'exact_id',
        reason: 'External device IDs match exactly'
      };
    }
    return { score: 0, confidence: 'none', method: 'exact_id' };
  }
}

// Strategy 2: Hardware ID Match (95% confidence)
class HardwareIdMatcher implements MatchStrategy {
  name = 'hardware_id';
  
  match(local, external): MatchScore {
    // Check if any external hardwareIds match local hardware_id
    if (external.hardwareIds.some(id => 
      id === local.hardware_id || 
      local.hardware_ids?.includes(id)
    )) {
      return {
        score: 0.95,
        confidence: 'high',
        method: 'hardware_id',
        reason: 'Hardware IDs match'
      };
    }
    return { score: 0, confidence: 'none', method: 'hardware_id' };
  }
}

// Strategy 3: Name Similarity (60-90% confidence)
class NameSimilarityMatcher implements MatchStrategy {
  name = 'name_similarity';
  
  match(local, external): MatchScore {
    const similarity = levenshteinSimilarity(
      local.name.toLowerCase(),
      external.name.toLowerCase()
    );
    
    if (similarity > 0.9) {
      return {
        score: similarity,
        confidence: 'high',
        method: 'name_similarity',
        reason: `Names are ${Math.round(similarity * 100)}% similar`
      };
    } else if (similarity > 0.8) {
      return {
        score: similarity,
        confidence: 'medium',
        method: 'name_similarity',
        reason: `Names are ${Math.round(similarity * 100)}% similar`
      };
    } else if (similarity > 0.7) {
      return {
        score: similarity,
        confidence: 'low',
        method: 'name_similarity',
        reason: `Names are ${Math.round(similarity * 100)}% similar`
      };
    }
    
    return { score: 0, confidence: 'none', method: 'name_similarity' };
  }
}

// Strategy 4: Serial Number Match (90% confidence)
class SerialNumberMatcher implements MatchStrategy {
  name = 'serial_number';
  
  match(local, external): MatchScore {
    if (local.serial_number && 
        external.metadata?.serial_number === local.serial_number) {
      return {
        score: 0.9,
        confidence: 'high',
        method: 'serial_number',
        reason: 'Serial numbers match'
      };
    }
    return { score: 0, confidence: 'none', method: 'serial_number' };
  }
}
```

2. **Matching Engine**

```typescript
// src/lib/sync/matching/engine.ts

export class DeviceMatchingEngine {
  private strategies: MatchStrategy[] = [
    new ExactIdMatcher(),
    new HardwareIdMatcher(),
    new NameSimilarityMatcher(),
    new SerialNumberMatcher()
  ];
  
  async findMatches(
    localDevices: Device[],
    externalDevices: Device[]
  ): Promise<MatchResult> {
    const matched: DeviceMatch[] = [];
    const unmatchedLocal: Device[] = [];
    const unmatchedExternal: Device[] = [];
    const conflicts: DeviceConflict[] = [];
    
    const externalMap = new Map(externalDevices.map(d => [d.id, d]));
    
    for (const localDevice of localDevices) {
      const candidates = [];
      
      // Try each strategy
      for (const external of externalDevices) {
        const scores = this.strategies.map(strategy => 
          strategy.match(localDevice, external)
        );
        
        // Get best score
        const bestScore = scores.reduce((best, current) =>
          current.score > best.score ? current : best
        );
        
        if (bestScore.score > 0.7) {
          candidates.push({
            external,
            score: bestScore.score,
            confidence: bestScore.confidence,
            method: bestScore.method,
            reason: bestScore.reason
          });
        }
      }
      
      if (candidates.length === 0) {
        unmatchedLocal.push(localDevice);
      } else if (candidates.length === 1) {
        const match = candidates[0];
        if (match.confidence === 'high') {
          // Auto-match
          matched.push({
            local: localDevice,
            external: match.external,
            score: match.score,
            confidence: match.confidence,
            method: match.method,
            autoMatched: true
          });
          externalMap.delete(match.external.id);
        } else {
          // Manual review needed
          matched.push({
            local: localDevice,
            external: match.external,
            score: match.score,
            confidence: match.confidence,
            method: match.method,
            autoMatched: false
          });
          externalMap.delete(match.external.id);
        }
      } else {
        // Multiple candidates - conflict
        conflicts.push({
          local: localDevice,
          candidates: candidates,
          reason: 'Multiple possible matches found'
        });
      }
    }
    
    // Remaining external devices are unmatched
    unmatchedExternal.push(...Array.from(externalMap.values()));
    
    return {
      matched,
      unmatchedLocal,
      unmatchedExternal,
      conflicts
    };
  }
}
```

3. **Match Review UI**

```tsx
// src/components/sync/MatchReviewDialog.tsx

export function MatchReviewDialog({ matches, onConfirm }: Props) {
  const [selections, setSelections] = useState<Record<string, boolean>>({});
  
  return (
    <Dialog>
      <DialogHeader>
        <DialogTitle>Review Device Matches</DialogTitle>
        <DialogDescription>
          We found {matches.length} potential device matches. 
          Please review and confirm.
        </DialogDescription>
      </DialogHeader>
      
      <DialogContent>
        {matches.filter(m => !m.autoMatched).map(match => (
          <Card key={match.local.id}>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Local Device</Label>
                  <div className="font-medium">{match.local.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {match.local.device_type}
                  </div>
                </div>
                
                <div>
                  <Label>Golioth Device</Label>
                  <div className="font-medium">{match.external.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {match.external.status}
                  </div>
                </div>
              </div>
              
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant={
                      match.confidence === 'high' ? 'default' :
                      match.confidence === 'medium' ? 'secondary' : 'outline'
                    }>
                      {match.confidence} confidence
                    </Badge>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {match.reason}
                    </span>
                  </div>
                  
                  <Switch
                    checked={selections[match.local.id] !== false}
                    onCheckedChange={(checked) =>
                      setSelections({ ...selections, [match.local.id]: checked })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </DialogContent>
      
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onConfirm(selections)}>
          Confirm Matches
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
```

### Acceptance Criteria

- [ ] Matching strategies implemented
- [ ] Levenshtein distance calculation
- [ ] Matching engine with confidence scores
- [ ] Auto-match high-confidence matches
- [ ] Manual review UI for medium/low confidence
- [ ] Conflict detection for multiple matches
- [ ] Match history tracking
- [ ] Tests for all matching strategies
- [ ] Performance optimization for large device lists

### Files to Create

- `src/lib/sync/matching/strategies.ts`
- `src/lib/sync/matching/engine.ts`
- `src/lib/sync/matching/utils.ts` (levenshtein, etc.)
- `src/components/sync/MatchReviewDialog.tsx`
- `supabase/migrations/YYYYMMDD_device_match_candidates.sql`

### Files to Modify

- `src/lib/sync/organization-golioth-sync.ts`

### Dependencies

- None

### Effort Estimate

**High** - 5-7 days
- Matching engine: 2-3 days
- UI components: 2-3 days
- Testing: 1-2 days

### Priority

**Medium** - Prevents user frustration from duplicates

---

**[Continuing with Issues #7-10 in next message due to length...]**
