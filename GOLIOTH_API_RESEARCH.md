# Golioth API Research & Feature Analysis

## Project Information
- **Project ID**: nn-cellular-alerts
- **Project Name**: NN-Cellular-Alerts
- **Organization**: mike-jordan
- **Base URL**: https://api.golioth.io/v1
- **Authentication**: x-api-key header

---

## 📊 DISCOVERED API ENDPOINTS & FEATURES

### 1. PROJECT LEVEL ENDPOINTS

#### ✅ **GET /projects/{projectId}**
**Purpose**: Get project information
**Returns**: 
```json
{
  "id": "nn-cellular-alerts",
  "name": "NN-Cellular-Alerts",
  "createdAt": "2025-07-08T03:14:23.316Z",
  "updatedAt": "2025-07-08T03:14:23.316Z",
  "organizationId": "mike-jordan"
}
```
**Use Cases**:
- Validate API connection
- Display project info in UI
- Check project status

---

### 2. DEVICE MANAGEMENT

#### ✅ **GET /projects/{projectId}/devices**
**Purpose**: List all devices in the project
**Returns**: Paginated list of devices (currently 6 devices)
**Device Structure**:
```json
{
  "id": "68bf1cc5425dd2ea93f248a3",
  "hardwareIds": ["20250908181325-c253700003"],
  "name": "C253700003",
  "createdAt": "2025-09-08T18:13:25.775Z",
  "updatedAt": "2025-09-08T18:13:25.775Z",
  "lastReport": "2025-11-09T23:35:06.957Z",
  "status": "-",
  "enabled": true,
  "cohortId": "nrf9151-cell-gateways",
  "metadata": {
    "lastSeenOnline": "2025-11-09T20:23:38.628Z",
    "lastSeenOffline": null,
    "update": { /* firmware status */ }
  }
}
```

**Key Device Fields**:
- `id`: Unique device identifier
- `hardwareIds`: Array of hardware identifiers
- `name`: Display name
- `lastReport`: Last time device sent data
- `lastSeenOnline`/`lastSeenOffline`: Connection tracking
- `status`: Device status indicator
- `enabled`: Whether device is active
- `cohortId`: OTA update group assignment
- `metadata.update`: Firmware version and update status

**Use Cases**:
- Device inventory management
- Real-time connection monitoring
- Firmware version tracking
- **NEW**: Last seen online/offline timestamps
- **NEW**: Hardware ID tracking (can have multiple)
- **NEW**: Cohort-based firmware management

---

#### ✅ **GET /projects/{projectId}/devices/{deviceId}**
**Purpose**: Get detailed device information
**Returns**: Full device object with all metadata
**Use Cases**:
- Device detail views
- Status monitoring
- Configuration management

---

#### ✅ **GET /projects/{projectId}/devices/{deviceId}/data**
**Purpose**: Get device's LightDB Stream data (time-series data)
**Returns**: JSON object with custom data structure
**Example Response**:
```json
{
  "BLEPassKeys": {
    "0": {
      "bleid": "E3:12:D7:3D:11:4A",
      "passkey": 342039
    }
    // ... more BLE devices
  }
}
```

**Features**:
- **Custom data structure** - devices can send any JSON structure
- Real-time sensor data
- Application-specific data
- BLE device tracking in this case

**Use Cases**:
- Sensor data visualization
- Historical data retrieval
- Real-time dashboards
- **NEW**: BLE passkey management
- **NEW**: Custom telemetry tracking

---

#### ✅ **GET /projects/{projectId}/devices/{deviceId}/settings**
**Purpose**: Get device remote configuration settings
**Returns**: List of configuration key-value pairs
**Features**:
- Remote configuration management
- Can push settings to devices
- Currently empty for test devices

**Use Cases**:
- Remote device configuration
- Feature flags
- Operational parameters
- **NEW**: Over-the-air configuration updates

---

#### ✅ **GET /projects/{projectId}/devices/{deviceId}/credentials**
**Purpose**: Get device authentication credentials
**Returns**: List of credentials (PSK, certificates, etc.)
**Example**:
```json
{
  "id": "68bf1cc5425dd2ea93f248a4",
  "type": "PRE_SHARED_KEY",
  "identity": "20250908181325-c253700003@nn-cellular-alerts",
  "createdAt": "2025-09-08T18:13:25.789Z",
  "preSharedKey": "1739a901d4f96dcbcdb0383d8cc854c7"
}
```

**Credential Types**:
- `PRE_SHARED_KEY`: Shared secret authentication
- Others (certificates, tokens, etc.)

**Use Cases**:
- Security management
- Device provisioning
- Credential rotation
- **NEW**: Display PSK for device setup
- **NEW**: Multiple credential support per device

---

### 3. FIRMWARE MANAGEMENT (OTA UPDATES)

#### ✅ **GET /projects/{projectId}/artifacts**
**Purpose**: List firmware artifacts available for OTA updates
**Returns**: List of firmware binaries with version info
**Example**:
```json
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
      "sha256": { "digest": "4ece0ac612122a27...", "size": 32 }
    }
  }
}
```

**Current Artifacts**:
1. `cellgateway-nrf9151-firmware` v1.0.6 (354KB)
2. `cellgateway-nrf52840-firmware` v1.0.5 (375KB)
3. `modsensor-rev_d-nrf52840-debug-firmware` v1.0.5 (471KB)
4. `modsensor-rev_d-nrf52840-release-firmware` v1.0.5 (332KB)

**Features**:
- Version tracking
- Binary checksums (SHA256)
- File size information
- MCUboot format support
- Package naming for different hardware

**Use Cases**:
- OTA firmware updates
- Version management
- Firmware inventory
- **NEW**: Multi-package support (different hardware/components)
- **NEW**: Release vs Debug builds
- **NEW**: Binary verification via checksums

---

#### **Device Firmware Status** (from device metadata)
**Location**: `device.metadata.update`
**Example**:
```json
{
  "cellgateway-nrf9151-firmware": {
    "package": "cellgateway-nrf9151-firmware",
    "version": "1.0.6",
    "state": "IDLE",
    "stateCode": "0",
    "reason": "ready state",
    "reasonCode": "0",
    "target": "",
    "time": "2025-11-09T20:23:39.113864458Z"
  },
  "main": {
    "package": "main",
    "version": "1.0.0",
    "state": "IDLE"
    // ... same fields
  }
}
```

**Update States**:
- `IDLE`: No update in progress
- Other states: DOWNLOADING, INSTALLING, etc.

**Use Cases**:
- Track OTA update progress
- Show current firmware version
- Detect update failures
- **NEW**: Multi-component firmware (main + cellgateway)
- **NEW**: Real-time update state tracking
- **NEW**: Update timestamp tracking

---

### 4. ENDPOINTS THAT RETURNED 404/NOT IMPLEMENTED

#### ❌ **GET /projects/{projectId}/devices/{deviceId}/state** (404)
**Purpose**: LightDB State management
**Status**: Not implemented or no state data

#### ❌ **GET /projects/{projectId}/devices/{deviceId}/logs** (404)
**Purpose**: Device logs
**Status**: Not available

#### ❌ **GET /projects/{projectId}/devices/{deviceId}/rpc** (501)
**Purpose**: Remote Procedure Calls
**Status**: Method not allowed

#### ❌ **GET /projects/{projectId}/devices/{deviceId}/tags** (404)
**Purpose**: Device-specific tags
**Status**: Not available (but project-level tags exist)

#### ❌ **GET /projects/{projectId}/pipelines** (404)
**Purpose**: Data pipelines
**Status**: Not implemented

#### ❌ **GET /projects/{projectId}/webhooks** (404)
**Purpose**: Webhook management
**Status**: Not available

#### ❌ **GET /projects/{projectId}/api-keys** (404)
**Purpose**: API key management
**Status**: Not accessible via current key

#### ✅ **GET /projects/{projectId}/blueprints** (Empty)
**Purpose**: Device blueprints/templates
**Status**: Works but no blueprints defined

#### ✅ **GET /projects/{projectId}/tags** (Empty)
**Purpose**: Project-level tags
**Status**: Works but no tags defined

---

## 🎯 FEATURES WE CAN IMPLEMENT

### **Tier 1: Already Implemented**
1. ✅ Device list with sync
2. ✅ Device status tracking
3. ✅ Basic device information

### **Tier 2: High-Value New Features**

#### 1. **Real-Time Connection Monitoring**
- Display `lastSeenOnline` and `lastSeenOffline`
- Show connection duration
- Alert on prolonged offline status
- **Value**: Proactive device health monitoring

#### 2. **Firmware Management Dashboard**
- List available firmware artifacts
- Show current device firmware versions
- Track OTA update progress
- Display update success/failure
- Group devices by firmware version
- **Value**: Professional OTA management

#### 3. **Device Telemetry Visualization**
- Parse and display custom LightDB Stream data
- Create charts for sensor data
- Historical data analysis
- **Value**: Data-driven insights

#### 4. **BLE Device Management** (from telemetry data)
- List BLE devices connected to gateways
- Show BLE passkeys
- Track BLE device associations
- **Value**: Extend monitoring to BLE peripherals

#### 5. **Device Credentials Management**
- Display device PSKs for provisioning
- Show credential creation dates
- Support credential rotation
- **Value**: Security and device setup

#### 6. **Hardware ID Tracking**
- Support multiple hardware IDs per device
- Track hardware changes
- Link physical devices to virtual ones
- **Value**: Asset management

#### 7. **Device Cohort Management**
- View device OTA groups
- Manage cohort assignments
- Staged firmware rollouts
- **Value**: Controlled updates

### **Tier 3: Advanced Features**

#### 8. **Remote Configuration Management**
- Set device settings remotely
- Configuration templates
- Bulk configuration updates
- **Value**: Operational efficiency

#### 9. **Multi-Component Firmware**
- Track multiple firmware components per device (main, cellgateway, modsensor)
- Component-specific update management
- **Value**: Complex device management

#### 10. **Device Analytics**
- Connection uptime statistics
- Firmware update success rates
- Data transmission patterns
- **Value**: Operational insights

---

## 📊 DATA STRUCTURE ANALYSIS

### Device Object Fields Available:
```typescript
interface GoliothDevice {
  // Identity
  id: string
  hardwareIds: string[]  // NEW: Can be multiple
  name: string
  
  // Timestamps
  createdAt: string
  updatedAt: string
  lastReport: string | null
  
  // Status
  status: string
  enabled: boolean
  
  // Organization
  cohortId?: string  // NEW: OTA group
  tagIds: string[]
  
  // Custom Data
  data: any | null  // NEW: LightDB Stream data
  
  // Metadata (rich information)
  metadata: {
    // Connection tracking
    lastSeenOnline: string | null  // NEW
    lastSeenOffline: string | null  // NEW
    lastReport: string | null
    lastSettingsStatus: any | null
    status: string
    
    // Firmware management (NEW - very detailed)
    update: {
      [packageName: string]: {
        package: string
        version: string
        state: string  // IDLE, DOWNLOADING, etc.
        stateCode: string
        reason: string
        reasonCode: string
        target: string
        time: string  // ISO timestamp
      }
    }
  }
}
```

### Firmware Artifact Object:
```typescript
interface GoliothArtifact {
  id: string
  version: string
  package: string  // Package name
  createdAt: string
  updatedAt: string
  size: string  // File size
  binaryInfo: {
    type: string  // "mcuboot"
    size: number
    digests: {
      sha256: {
        digest: string  // Hex hash
        size: number
        type: string
      }
    }
  }
}
```

### Device Credential Object:
```typescript
interface GoliothCredential {
  id: string
  type: 'PRE_SHARED_KEY' | string
  identity: string  // Format: {hardwareId}@{projectId}
  createdAt: string
  preSharedKey?: string  // For PSK type
}
```

---

## 🚀 RECOMMENDED IMPLEMENTATION PRIORITY

### Phase 1: Connection & Status Enhancements
1. Add `lastSeenOnline` and `lastSeenOffline` to device display
2. Calculate and show "online duration" or "offline duration"
3. Add connection status indicators (green/yellow/red)
4. Alert on devices offline >24 hours

### Phase 2: Firmware Management
1. Create firmware artifacts list view
2. Show device current firmware versions
3. Display OTA update status (IDLE, DOWNLOADING, etc.)
4. Group devices by firmware version
5. Show update timestamps

### Phase 3: Telemetry & Data
1. Parse LightDB Stream data structure
2. Create generic telemetry viewer
3. Add BLE device list for gateways
4. Sensor data visualization

### Phase 4: Device Provisioning
1. Display device credentials (PSKs)
2. Show hardware IDs
3. Device setup wizard

### Phase 5: Advanced Management
1. Remote configuration UI
2. Cohort management
3. Bulk operations

---

## 💡 BUSINESS VALUE

**Current State**: Basic device list and sync
**With New Features**:
- **Proactive Monitoring**: Catch offline devices before customers complain
- **Firmware Compliance**: Ensure all devices run latest firmware
- **Data Insights**: Visualize sensor data for decision-making
- **BLE Ecosystem**: Manage gateway + peripheral devices
- **Operational Efficiency**: Remote configuration without site visits
- **Security**: Track and manage device credentials
- **Professional OTA**: Enterprise-grade firmware management

---

## 🔍 API LIMITATIONS DISCOVERED

1. **No RPC**: Cannot trigger remote procedures
2. **No Device Logs**: Cannot retrieve device logs via API
3. **No LightDB State**: State API not available
4. **No Webhooks API**: Cannot manage webhooks programmatically
5. **Limited Tag Support**: Tags exist but empty in current project
6. **No Pipelines**: Data pipeline API not implemented

---

## ✅ NEXT STEPS

1. **Update TypeScript Types**: Add new fields (lastSeenOnline, update metadata, hardwareIds array)
2. **Enhance GoliothClient**: Add firmware artifacts method
3. **Update Device Sync**: Capture new metadata fields
4. **UI Enhancements**: Add connection status, firmware version display
5. **New Components**: Firmware management dashboard, telemetry viewer
6. **Database Schema**: Add fields for lastSeenOnline, firmware_version, hardware_ids

---

## 📝 NOTES

- All 6 devices currently online
- Active firmware: v1.0.6 (cellgateway-nrf9151), v1.0.0 (main)
- BLE passkeys actively tracked
- No tags or blueprints currently used
- PSK authentication in use
- Cohort "nrf9151-cell-gateways" exists but API returned 404 on cohort details
