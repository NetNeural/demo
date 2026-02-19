# 📱 How to Add Devices from Golioth & Assign Them

## Overview

There are **3 ways** to add devices from Golioth to your NetNeural system:

1. **Automatic Sync** (Recommended) - Auto-import all devices from Golioth
2. **Manual Assignment** - Link existing local devices to Golioth devices
3. **Manual Creation** - Create devices one-by-one with Golioth mapping

---

## 🚀 Method 1: Automatic Sync (RECOMMENDED)

This automatically imports all devices from your Golioth project into your system.

### Setup Process

#### Step 1: Configure Golioth Integration

```bash
1. Login to your NetNeural app
2. Go to: Settings → Integrations
3. Click "Add Integration"
4. Select "Golioth"
5. Fill in:
   - Name: "Production Devices"
   - API Key: gol_your_api_key
   - Project ID: your-project-id
   - Base URL: https://api.golioth.io
6. Click "Test Connection" to verify
7. Save
```

#### Step 2: Run Auto-Sync

The sync service will automatically:
- ✅ Find all devices in your Golioth project
- ✅ Create local database entries for each device
- ✅ Map them using `external_device_id`
- ✅ Import device data (status, battery, location, etc.)

**Option A: Via API (Programmatic)**

```typescript
import { organizationGoliothSyncService } from '@/lib/sync/organization-golioth-sync';

// Sync all devices from Golioth
const result = await organizationGoliothSyncService.syncDevices(
  organizationId,    // Your org ID
  integrationId,     // Golioth integration ID
  {
    syncStatus: true,           // Import online/offline status
    syncBattery: true,          // Import battery levels
    syncLastSeen: true,         // Import last seen timestamp
    syncFirmware: true,         // Import firmware version
    syncLocation: true,         // Import location data
    syncMetadata: true,         // Import custom metadata
    createMissingDevices: true  // ← AUTO-CREATE DEVICES!
  }
);

console.log(`✅ Synced ${result.syncedDevices} devices`);
console.log(`⚠️ ${result.unmappedGoliothDevices} unmapped devices`);
```

**Option B: Via UI (Manual Trigger)**

Create a "Sync Devices" button in your UI:

```tsx
// Add to src/components/devices/DevicesHeader.tsx

const handleSyncGoliothDevices = async () => {
  try {
    // Get Golioth integration
    const integration = await getGoliothIntegration(organizationId);
    
    if (!integration) {
      toast.error('No Golioth integration configured');
      return;
    }
    
    // Run sync
    const result = await fetch('/api/devices/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: organizationId,
        integration_id: integration.id,
        create_missing_devices: true
      })
    });
    
    const data = await result.json();
    
    toast.success(`✅ Synced ${data.syncedDevices} devices from Golioth`);
    
    // Refresh device list
    refreshDevices();
    
  } catch (error) {
    toast.error('Failed to sync devices');
  }
};

// Add button to UI
<Button onClick={handleSyncGoliothDevices}>
  <RefreshCw className="mr-2 h-4 w-4" />
  Sync from Golioth
</Button>
```

**Option C: Scheduled Auto-Sync (Background)**

```typescript
// Run sync every 5 minutes (cron job or interval)
setInterval(async () => {
  const organizations = await getAllOrganizations();
  
  for (const org of organizations) {
    const goliothIntegrations = await getGoliothIntegrations(org.id);
    
    for (const integration of goliothIntegrations) {
      await organizationGoliothSyncService.syncDevices(
        org.id,
        integration.id,
        { createMissingDevices: true }
      );
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes
```

---

## 📝 Method 2: Manual Assignment

Link existing local devices to Golioth devices by setting the `external_device_id`.

### UI Flow

```tsx
// Device edit form
<Dialog>
  <DialogContent>
    <h2>Link to Golioth Device</h2>
    
    <Select
      value={externalDeviceId}
      onChange={(value) => setExternalDeviceId(value)}
    >
      <option value="">None (Local only)</option>
      {goliothDevices.map(device => (
        <option key={device.id} value={device.id}>
          {device.name} ({device.id})
        </option>
      ))}
    </Select>
    
    <Button onClick={async () => {
      await updateDevice(localDeviceId, {
        external_device_id: externalDeviceId,
        integration_id: goliothIntegrationId
      });
      
      toast.success('Device linked to Golioth!');
    }}>
      Save
    </Button>
  </DialogContent>
</Dialog>
```

### API Call

```typescript
// Update device with Golioth mapping
await databaseDeviceService.updateDevice(deviceId, {
  external_device_id: 'golioth-device-abc123', // From Golioth
  integration_id: 'your-integration-uuid'
});

// Future syncs will now update this device
```

---

## ➕ Method 3: Manual Creation with Golioth Link

Create a new device and immediately link it to Golioth.

### UI Form

```tsx
<Dialog>
  <DialogContent>
    <h2>Add Device</h2>
    
    <Input
      label="Device Name"
      value={name}
      onChange={(e) => setName(e.target.value)}
    />
    
    <Select label="Device Type">
      <option value="sensor">Sensor</option>
      <option value="gateway">Gateway</option>
      <option value="controller">Controller</option>
    </Select>
    
    <Select
      label="Link to Golioth Device (optional)"
      value={externalDeviceId}
      onChange={(e) => setExternalDeviceId(e.target.value)}
    >
      <option value="">None</option>
      {goliothDevices.map(device => (
        <option key={device.id} value={device.id}>
          {device.name} ({device.id})
        </option>
      ))}
    </Select>
    
    <Button onClick={async () => {
      await databaseDeviceService.createDevice({
        organization_id: organizationId,
        integration_id: goliothIntegrationId,
        name: name,
        device_type: deviceType,
        external_device_id: externalDeviceId || null,
        status: 'offline'
      });
      
      toast.success('Device created!');
    }}>
      Create Device
    </Button>
  </DialogContent>
</Dialog>
```

---

## 🔄 How Device Syncing Works

### Initial Import (First Sync)

```
Golioth Cloud
├── Device: esp32-warehouse-001
├── Device: esp32-warehouse-002
└── Device: nrf9160-tracker-001

                ↓ SYNC ↓

NetNeural Database (devices table)
├── id: uuid-1, external_device_id: "esp32-warehouse-001"
├── id: uuid-2, external_device_id: "esp32-warehouse-002"
└── id: uuid-3, external_device_id: "nrf9160-tracker-001"
```

### Ongoing Sync (Every 5 min)

```
1. Fetch devices from Golioth API
2. Match by external_device_id
3. Update status, battery, location, etc.
4. Display in your UI
```

### Data Flow Example

```typescript
// Golioth device data
{
  id: "esp32-warehouse-001",
  name: "Warehouse Temperature Sensor",
  status: "online",
  last_seen: "2025-10-27T10:30:00Z",
  metadata: {
    battery_level: 85,
    temperature: 23.5,
    humidity: 45
  }
}

// After sync → Local database
{
  id: "uuid-local-123",
  organization_id: "org-uuid",
  integration_id: "golioth-integration-uuid",
  external_device_id: "esp32-warehouse-001",
  name: "Warehouse Temperature Sensor",
  device_type: "sensor",
  status: "online",
  last_seen: "2025-10-27T10:30:00Z",
  battery_level: 85,
  metadata: {
    temperature: 23.5,
    humidity: 45
  }
}
```

---

## 🎯 Assignment Strategies

### Strategy 1: Auto-Import Everything

**Best for:** Starting fresh, want all Golioth devices

```typescript
await organizationGoliothSyncService.syncDevices(orgId, integrationId, {
  createMissingDevices: true  // ← Auto-create all
});
```

**Result:**
- ✅ All Golioth devices automatically added
- ✅ No manual work required
- ⚠️ Might import devices you don't want

### Strategy 2: Selective Import

**Best for:** Only want specific devices

```typescript
// 1. Sync without auto-create
const result = await organizationGoliothSyncService.syncDevices(orgId, integrationId, {
  createMissingDevices: false
});

// 2. Review unmapped devices
console.log(`Found ${result.unmappedGoliothDevices} unmapped devices`);

// 3. Manually create only wanted devices
const goliothDevices = await organizationGoliothAPI.getDevices(integrationId);

for (const device of goliothDevices) {
  if (device.name.includes('Production')) {  // Only production devices
    await databaseDeviceService.createDevice({
      organization_id: orgId,
      integration_id: integrationId,
      external_device_id: device.id,
      name: device.name,
      device_type: 'sensor',
      status: device.status
    });
  }
}
```

### Strategy 3: Manual Mapping

**Best for:** Already have local devices, want to link them

```typescript
// Existing local device
const localDevice = await getDevice('local-uuid-123');

// Link to Golioth
await updateDevice('local-uuid-123', {
  external_device_id: 'esp32-warehouse-001',
  integration_id: 'golioth-integration-uuid'
});

// Now syncs will update this device
```

---

## 📊 Complete Example: Add Devices from Golioth

### Full Workflow

```typescript
// 1. User configures Golioth integration via UI
const integration = await createIntegration({
  organization_id: currentOrg.id,
  integration_type: 'golioth',
  name: 'Production Devices',
  api_key_encrypted: encrypt('gol_abc123...'),
  project_id: 'my-project',
  base_url: 'https://api.golioth.io'
});

// 2. Test connection
const testResult = await organizationGoliothAPI.testConnection(integration.id);
console.log(`Connected! Found ${testResult.deviceCount} devices`);

// 3. User clicks "Import Devices from Golioth"
const syncResult = await organizationGoliothSyncService.syncDevices(
  currentOrg.id,
  integration.id,
  {
    syncStatus: true,
    syncBattery: true,
    syncLastSeen: true,
    syncMetadata: true,
    createMissingDevices: true  // Auto-import all
  }
);

// 4. Show results
toast.success(`✅ Imported ${syncResult.syncedDevices} devices from Golioth!`);

// 5. Devices now appear in UI
// Dashboard shows device count
// Devices page shows full list
// Each device syncs every 5 minutes
```

---

## 🔧 API Endpoints to Create

### POST /api/devices/sync

Trigger sync from UI:

```typescript
// src/app/api/devices/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { organizationGoliothSyncService } from '@/lib/sync/organization-golioth-sync';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organization_id, integration_id, create_missing_devices } = body;
    
    const result = await organizationGoliothSyncService.syncDevices(
      organization_id,
      integration_id,
      {
        syncStatus: true,
        syncBattery: true,
        syncLastSeen: true,
        syncMetadata: true,
        createMissingDevices: create_missing_devices || false
      }
    );
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
```

### GET /api/integrations/golioth/devices

List available Golioth devices before import:

```typescript
// src/app/api/integrations/golioth/devices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { organizationGoliothAPI } from '@/lib/integrations/organization-golioth';

export async function GET(request: NextRequest) {
  try {
    const integrationId = request.nextUrl.searchParams.get('integration_id');
    
    if (!integrationId) {
      return NextResponse.json({ error: 'Missing integration_id' }, { status: 400 });
    }
    
    const devices = await organizationGoliothAPI.getDevices(integrationId);
    
    return NextResponse.json({ devices });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch devices' },
      { status: 500 }
    );
  }
}
```

---

## 🎨 UI Components to Add

### Sync Button in DevicesHeader

```tsx
// src/components/devices/DevicesHeader.tsx

import { RefreshCw } from 'lucide-react';

export function DevicesHeader() {
  const [syncing, setSyncing] = useState(false);
  const { currentOrganization } = useOrganization();
  
  const handleSyncGolioth = async () => {
    setSyncing(true);
    try {
      // Get Golioth integration
      const response = await fetch(`/api/integrations?organization_id=${currentOrganization.id}&type=golioth`);
      const { integrations } = await response.json();
      
      if (integrations.length === 0) {
        toast.error('No Golioth integration configured');
        return;
      }
      
      // Sync devices
      const syncResponse = await fetch('/api/devices/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: currentOrganization.id,
          integration_id: integrations[0].id,
          create_missing_devices: true
        })
      });
      
      const result = await syncResponse.json();
      
      toast.success(`✅ Synced ${result.syncedDevices} devices from Golioth`);
      
      // Refresh device list
      window.location.reload();
      
    } catch (error) {
      toast.error('Failed to sync devices');
    } finally {
      setSyncing(false);
    }
  };
  
  return (
    <div className="flex items-center justify-between">
      <h1>Devices</h1>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={handleSyncGolioth}
          disabled={syncing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync from Golioth'}
        </Button>
        <Button onClick={handleAddDevice}>
          Add Device
        </Button>
      </div>
    </div>
  );
}
```

### Import Devices Dialog

```tsx
// src/components/devices/ImportGoliothDialog.tsx

export function ImportGoliothDialog({ open, onClose, organizationId }) {
  const [goliothDevices, setGoliothDevices] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  
  useEffect(() => {
    if (open) {
      loadGoliothDevices();
    }
  }, [open]);
  
  const loadGoliothDevices = async () => {
    // Fetch devices from Golioth (not yet in local DB)
    const response = await fetch(`/api/integrations/golioth/devices?organization_id=${organizationId}`);
    const { devices } = await response.json();
    setGoliothDevices(devices);
  };
  
  const handleImport = async () => {
    setImporting(true);
    try {
      // Import selected devices
      for (const deviceId of selectedDevices) {
        const goliothDevice = goliothDevices.find(d => d.id === deviceId);
        
        await fetch('/api/devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: organizationId,
            external_device_id: goliothDevice.id,
            name: goliothDevice.name,
            device_type: 'sensor',
            status: goliothDevice.status
          })
        });
      }
      
      toast.success(`✅ Imported ${selectedDevices.length} devices`);
      onClose();
      
    } catch (error) {
      toast.error('Failed to import devices');
    } finally {
      setImporting(false);
    }
  };
  
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Devices from Golioth</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2">
          {goliothDevices.map(device => (
            <label key={device.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={selectedDevices.includes(device.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedDevices([...selectedDevices, device.id]);
                  } else {
                    setSelectedDevices(selectedDevices.filter(id => id !== device.id));
                  }
                }}
              />
              <div className="flex-1">
                <p className="font-medium">{device.name}</p>
                <p className="text-sm text-gray-500">{device.id}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${
                device.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {device.status}
              </span>
            </label>
          ))}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleImport}
            disabled={selectedDevices.length === 0 || importing}
          >
            {importing ? 'Importing...' : `Import ${selectedDevices.length} devices`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 📋 Summary

### Quick Answer

**To add devices from Golioth:**

1. **Configure Golioth integration** (Settings → Integrations)
2. **Run sync** with `createMissingDevices: true`
3. **All Golioth devices auto-import** to your database
4. **Devices appear in UI** immediately
5. **Auto-sync keeps them updated** every 5 minutes

### Code Snippet

```typescript
// One-liner to import all Golioth devices
await organizationGoliothSyncService.syncDevices(
  organizationId,
  goliothIntegrationId,
  { createMissingDevices: true }
);
```

### Next Steps

1. ✅ Add "Sync from Golioth" button to DevicesHeader
2. ✅ Create `/api/devices/sync` endpoint
3. ✅ Add background sync (every 5 min)
4. ✅ Create ImportGoliothDialog for selective import
5. ✅ Update "Add Device" form to include Golioth device picker

**All the code is already there - just needs UI wiring!** 🚀
