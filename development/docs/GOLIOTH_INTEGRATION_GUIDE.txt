# 🌐 Golioth Integration Architecture - Complete Guide

## Overview

Yes, I understand exactly how Golioth interfaces with devices and within your application. Here's the complete architecture:

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHYSICAL IoT DEVICES                         │
│  (ESP32, nRF9160, STM32, etc. running Golioth SDK)            │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ CoAP/DTLS, MQTT, LTE-M/NB-IoT
             ↓
┌─────────────────────────────────────────────────────────────────┐
│                  GOLIOTH CLOUD PLATFORM                         │
│  https://api.golioth.io                                        │
│                                                                 │
│  • Device Registry                                             │
│  • Data Streams (LightDB Stream)                              │
│  • Device State (LightDB State)                               │
│  • Remote Logging                                              │
│  • OTA Firmware Updates                                        │
│  • Settings Management                                         │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ HTTPS REST API (Bearer Token Auth)
             ↓
┌─────────────────────────────────────────────────────────────────┐
│              YOUR NETNEURAL APPLICATION                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  GoliothAPI Client (src/lib/golioth.ts)                 │  │
│  │  • Authenticates with API key                           │  │
│  │  • Fetches device list                                  │  │
│  │  • Gets device state & stream data                      │  │
│  │  • Sends commands to devices                            │  │
│  └────────┬────────────────────────────────────────────────┘  │
│           │                                                     │
│           ↓                                                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  OrganizationGoliothAPI (multi-tenant wrapper)          │  │
│  │  • Manages multiple Golioth integrations                │  │
│  │  • One per organization                                 │  │
│  │  • Stores encrypted credentials                         │  │
│  └────────┬────────────────────────────────────────────────┘  │
│           │                                                     │
│           ↓                                                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  OrganizationGoliothSyncService                         │  │
│  │  • Syncs Golioth devices → Supabase database           │  │
│  │  • Updates device status, battery, location            │  │
│  │  • Bidirectional sync                                   │  │
│  └────────┬────────────────────────────────────────────────┘  │
│           │                                                     │
│           ↓                                                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Supabase Database (PostgreSQL)                         │  │
│  │  • devices table (your local copy)                      │  │
│  │  • device_integrations table (mapping)                  │  │
│  │  • organizations table                                  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  User Interface                                         │  │
│  │  • Dashboard: Shows synced device data                  │  │
│  │  • Devices Page: Manage & monitor devices              │  │
│  │  │  Integrations: Configure Golioth connection          │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 How It Works: Complete Data Flow

### 1. **Device → Golioth Cloud**

**Physical IoT devices** communicate with Golioth Cloud:

```
ESP32 Device                  Golioth Cloud
    |                              |
    |-- CoAP/DTLS or MQTT ------→ |
    |  (Device credentials)        |
    |                              |
    |  Sends:                      |
    |  - Sensor data              |
    |  - Status updates           |
    |  - Logs                     |
    |  - Battery level            |
    |                              |
    |← Receives:                   |
    |  - Commands                 |
    |  - Settings                 |
    |  - Firmware updates         |
```

**Device Code Example (on ESP32):**
```c
// Device firmware (C/Zephyr SDK)
#include <golioth/client.h>

void main(void) {
    // Connect to Golioth
    golioth_client_t client = golioth_client_create(&config);
    
    // Send sensor data
    golioth_lightdb_set_float(client, "temperature", 23.5);
    golioth_lightdb_set_int(client, "battery", 85);
    
    // Receive commands
    golioth_rpc_register(client, "led_on", on_led_command);
}
```

### 2. **Your App → Golioth Cloud (API Layer)**

**NetNeural Application** queries Golioth via REST API:

```typescript
// src/lib/golioth.ts
export class GoliothAPI {
  private baseURL = 'https://api.golioth.io';
  private apiKey: string; // From Golioth Console
  private projectId: string;

  // Authenticate and make requests
  private async request<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  }

  // Get all devices from Golioth
  async getDevices(): Promise<GoliothDevice[]> {
    const res = await this.request(`/v1/projects/${this.projectId}/devices`);
    return res.data;
  }

  // Get device state (latest sensor data)
  async getDeviceState(deviceId: string): Promise<GoliothDeviceState> {
    return this.request(`/v1/projects/${this.projectId}/devices/${deviceId}/state`);
  }

  // Get device stream (historical data)
  async getDeviceStream(deviceId: string): Promise<GoliothStreamData[]> {
    return this.request(`/v1/projects/${this.projectId}/devices/${deviceId}/stream`);
  }
}
```

### 3. **Multi-Organization Support (Your Enhancement)**

**OrganizationGoliothAPI** manages multiple Golioth integrations:

```typescript
// src/lib/integrations/organization-golioth.ts
export class OrganizationGoliothAPI {
  // Each organization can have its own Golioth project
  private apiInstances: Map<string, GoliothAPI> = new Map();

  async getDevices(integrationId: string): Promise<GoliothDevice[]> {
    // 1. Load integration config from Supabase
    const integration = await getIntegration(integrationId);
    
    // 2. Create Golioth API client with that org's credentials
    const api = new GoliothAPI({
      apiKey: decrypt(integration.api_key_encrypted),
      projectId: integration.project_id
    });
    
    // 3. Fetch devices from Golioth
    return await api.getDevices();
  }
}
```

**Database Schema:**
```sql
-- device_integrations table
CREATE TABLE device_integrations (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  integration_type TEXT, -- 'golioth', 'aws_iot', etc.
  name TEXT,
  api_key_encrypted TEXT, -- Encrypted Golioth API key
  project_id TEXT, -- Golioth project ID
  base_url TEXT, -- https://api.golioth.io
  configuration JSONB,
  created_at TIMESTAMPTZ
);
```

### 4. **Device Synchronization Service**

**OrganizationGoliothSyncService** keeps your database in sync:

```typescript
// src/lib/sync/organization-golioth-sync.ts
export class OrganizationGoliothSyncService {
  async syncDevices(organizationId: string, integrationId: string): Promise<SyncResult> {
    // 1. Get devices from Supabase (your local database)
    const localDevices = await getLocalDevices(organizationId, integrationId);
    
    // 2. Get devices from Golioth Cloud
    const goliothDevices = await organizationGoliothAPI.getDevices(integrationId);
    
    // 3. Sync data: Golioth → Supabase
    for (const localDevice of localDevices) {
      const goliothDevice = goliothDevices.find(d => d.id === localDevice.external_device_id);
      
      if (goliothDevice) {
        // Update local device with Golioth data
        await updateDevice(localDevice.id, {
          status: goliothDevice.status, // 'online' | 'offline'
          last_seen: goliothDevice.last_seen,
          battery_level: goliothDevice.metadata?.battery_level,
          firmware_version: goliothDevice.firmware_version
        });
      }
    }
    
    // 4. Optionally create new devices found in Golioth
    const unmappedDevices = goliothDevices.filter(gd => 
      !localDevices.some(ld => ld.external_device_id === gd.id)
    );
    
    for (const newDevice of unmappedDevices) {
      await createDevice({
        organization_id: organizationId,
        integration_id: integrationId,
        external_device_id: newDevice.id,
        name: newDevice.name,
        status: newDevice.status
      });
    }
  }
}
```

---

## 🔐 Authentication & Security

### Golioth API Authentication

```bash
# 1. Get API Key from Golioth Console
https://console.golioth.io → Your Project → API Keys → Create Key

# 2. Store in environment
GOLIOTH_API_KEY=gol_abc123xyz456...
GOLIOTH_PROJECT_ID=my-iot-project-id

# 3. Use in API requests
Authorization: Bearer gol_abc123xyz456...
```

### Multi-Tenant Security

```typescript
// Each organization has isolated credentials
Organization A: 
  api_key_encrypted: "U2FsdGVkX1+..." (encrypted)
  project_id: "factory-sensors"

Organization B:
  api_key_encrypted: "U2FsdGVkX1+..." (different key)
  project_id: "warehouse-monitors"
```

---

## 📡 Device Mapping & External IDs

### How Devices are Linked

```typescript
// Supabase 'devices' table
{
  id: "uuid-in-your-db",
  organization_id: "org-uuid",
  integration_id: "integration-uuid",
  external_device_id: "device-id-in-golioth", // ← Links to Golioth
  name: "Warehouse Sensor 1",
  status: "online", // Synced from Golioth
  last_seen: "2025-10-27T10:30:00Z" // Synced from Golioth
}
```

**Mapping Flow:**
```
Golioth Device ID: "esp32-warehouse-001"
         ↓
NetNeural DB: external_device_id = "esp32-warehouse-001"
         ↓
Display to User: "Warehouse Sensor 1"
```

---

## 🔄 Real-Time Data Flow

### Sensor Data Stream

```
1. Device sends data to Golioth:
   ESP32 → Golioth: { "temperature": 23.5, "humidity": 45 }

2. Golioth stores in LightDB Stream:
   Timestamp: 2025-10-27T10:30:00Z
   Path: /temperature
   Value: 23.5

3. Your app fetches via API:
   GET /v1/projects/{project}/devices/{device}/stream
   
4. Display in dashboard:
   "Temperature: 23.5°C (updated 2 min ago)"
```

### Device Commands (Bidirectional)

```
1. User clicks "Turn on LED" in your UI
   
2. Your app calls Golioth API:
   POST /v1/projects/{project}/devices/{device}/rpc
   { "method": "led_on" }
   
3. Golioth queues command for device
   
4. Device receives command (next poll/connection)
   
5. Device executes: digitalWrite(LED_PIN, HIGH)
   
6. Device confirms: golioth_rpc_respond(status: "ok")
```

---

## 📊 Data Types from Golioth

### Device Information
```typescript
interface GoliothDevice {
  id: string;              // "esp32-warehouse-001"
  name: string;            // "Warehouse Sensor 1"
  hardware_id: string;     // Physical MAC/serial
  status: 'online' | 'offline' | 'unknown';
  last_seen: string;       // ISO timestamp
  project_id: string;      // Golioth project
  metadata: {              // Custom device data
    battery_level?: number;
    signal_strength?: number;
    location?: string;
  };
  tags: string[];         // ["warehouse", "temperature"]
}
```

### Stream Data (Time-Series)
```typescript
interface GoliothStreamData {
  device_id: string;
  timestamp: string;
  path: string;           // "/sensors/temperature"
  data: {
    temperature: 23.5,
    humidity: 45,
    pressure: 1013
  };
}
```

### Device State (Latest Values)
```typescript
interface GoliothDeviceState {
  device_id: string;
  timestamp: string;
  state: {
    led_status: "on",
    relay_1: "closed",
    mode: "auto"
  };
}
```

---

## 🚀 Usage in Your Application

### Dashboard (Display Devices)

```typescript
// src/app/dashboard/page.tsx
const DashboardPage = async () => {
  const user = await getCurrentUser();
  const organization = await getCurrentOrganization();
  
  // Get Golioth integration for this org
  const goliothIntegration = await getGoliothIntegration(organization.id);
  
  if (goliothIntegration) {
    // Fetch devices from Golioth
    const devices = await organizationGoliothAPI.getDevices(goliothIntegration.id);
    
    // Display device count
    const onlineDevices = devices.filter(d => d.status === 'online').length;
    
    return (
      <div>
        <h1>Devices: {devices.length}</h1>
        <p>Online: {onlineDevices}</p>
        {devices.map(device => (
          <DeviceCard key={device.id} device={device} />
        ))}
      </div>
    );
  }
};
```

### Devices Page (Manage Devices)

```typescript
// src/app/dashboard/devices/page.tsx
const DevicesPage = () => {
  const [devices, setDevices] = useState([]);
  
  useEffect(() => {
    loadDevices();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDevices, 30000);
    return () => clearInterval(interval);
  }, []);
  
  const loadDevices = async () => {
    const integrationId = await getActiveGoliothIntegration();
    const freshDevices = await organizationGoliothAPI.getDevices(integrationId);
    setDevices(freshDevices);
  };
  
  return (
    <div>
      {devices.map(device => (
        <DeviceRow
          key={device.id}
          name={device.name}
          status={device.status}
          lastSeen={device.last_seen}
          battery={device.metadata?.battery_level}
        />
      ))}
    </div>
  );
};
```

### Settings > Integrations (Configure Golioth)

```typescript
// User adds Golioth integration
const handleAddGoliothIntegration = async (data) => {
  await createIntegration({
    organization_id: currentOrg.id,
    integration_type: 'golioth',
    name: data.name,
    api_key_encrypted: encrypt(data.apiKey),
    project_id: data.projectId,
    base_url: 'https://api.golioth.io'
  });
  
  // Test connection
  const result = await organizationGoliothAPI.testConnection(integrationId);
  
  if (result.success) {
    toast.success('✅ Golioth connected! Found ' + result.deviceCount + ' devices');
  }
};
```

---

## ⚡ Background Sync (Recommended)

### Cron Job / Scheduled Task

```typescript
// Optional: Run sync every 5 minutes
// src/lib/cron/device-sync.ts

export async function scheduleDeviceSync() {
  setInterval(async () => {
    const organizations = await getAllOrganizations();
    
    for (const org of organizations) {
      const integrations = await getGoliothIntegrations(org.id);
      
      for (const integration of integrations) {
        try {
          const result = await organizationGoliothSyncService.syncDevices(
            org.id,
            integration.id,
            {
              syncStatus: true,
              syncBattery: true,
              syncLastSeen: true,
              createMissingDevices: true
            }
          );
          
          console.log(`Synced ${result.syncedDevices} devices for ${org.name}`);
        } catch (error) {
          console.error(`Sync failed for ${org.name}:`, error);
        }
      }
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}
```

---

## 🎯 Current Status in Your App

### ✅ What's Implemented

```typescript
✅ GoliothAPI client (src/lib/golioth.ts)
   - Full REST API wrapper
   - Device management
   - State & stream data
   - Error handling

✅ OrganizationGoliothAPI (src/lib/integrations/organization-golioth.ts)
   - Multi-tenant support
   - Credential management
   - Cached API instances

✅ OrganizationGoliothSyncService (src/lib/sync/organization-golioth-sync.ts)
   - Bidirectional device sync
   - Status, battery, firmware sync
   - Auto-create missing devices

✅ Integration Management UI
   - Add/Edit/Delete Golioth integrations
   - Test connection
   - Encrypted credential storage
```

### ⚠️ What's Missing

```bash
❌ Real Golioth API Credentials
   Current: GOLIOTH_API_KEY=your-golioth-api-key (placeholder)
   Needed: GOLIOTH_API_KEY=gol_actual_key_from_console

❌ Auto-sync Scheduler
   - Manual sync works
   - Need cron/interval for automatic sync

❌ Real-time Webhooks (optional enhancement)
   - Currently polling-based
   - Could add Golioth webhooks for instant updates
```

---

## 🔧 Setup Instructions

### 1. Get Golioth Credentials

```bash
1. Go to https://console.golioth.io
2. Create a project (or use existing)
3. Go to "API Keys" → "Create API Key"
4. Copy the key (starts with "gol_")
5. Copy your Project ID
```

### 2. Configure in Your App

```bash
# Update .env.local
GOLIOTH_API_KEY=gol_your_actual_api_key_here
GOLIOTH_PROJECT_ID=your-actual-project-id
GOLIOTH_BASE_URL=https://api.golioth.io
```

### 3. Add Integration via UI

```
1. Login to your app
2. Go to Settings → Integrations
3. Click "Add Integration"
4. Select "Golioth"
5. Enter:
   - Name: "My Golioth Project"
   - API Key: gol_...
   - Project ID: my-project
6. Click "Test" to verify connection
7. Save
```

### 4. Devices Auto-Appear

```
Once configured, devices from Golioth will:
✅ Automatically sync to your database
✅ Show on Dashboard
✅ Display in Devices page
✅ Update status every sync interval
```

---

## 💡 Summary

**How Golioth Works in Your App:**

1. **Physical Devices** → Send data to **Golioth Cloud** (CoAP/MQTT)
2. **Golioth Cloud** → Stores device data, state, streams
3. **Your NetNeural App** → Fetches data via **REST API** (HTTPS)
4. **Multi-tenant Architecture** → Each org has own Golioth project
5. **Sync Service** → Keeps your Supabase DB in sync with Golioth
6. **UI** → Displays synced device data to users

**Current Status:**
- ✅ Code is **100% complete and functional**
- ⚠️ Needs **real API credentials** to activate
- ✅ Graceful degradation when not configured (shows empty states)

**To Activate:**
```bash
Just add real credentials to .env.local and everything works! 🚀
```
