# Golioth Integration - Demo Guide 🚀

**Quick Start Guide to Test All New Features**

---

## 🎯 Prerequisites

1. **Start the development environment:**
   ```bash
   cd /workspaces/MonoRepo/development
   npm run dev:full:debug
   ```

2. **Verify services are running:**
   ```bash
   # Check Supabase
   curl http://127.0.0.1:54321/health
   
   # Check Next.js
   curl http://localhost:3000
   ```

3. **Get your auth token:**
   - Open http://localhost:3000
   - Sign in to your account
   - Open browser DevTools → Application → Local Storage
   - Copy the `supabase.auth.token` value

---

## 📊 Demo 1: View Extended Device Data

### Check New Database Columns

```sql
-- Connect to local Supabase
-- Run in Supabase Studio: http://127.0.0.1:54323

SELECT 
  id,
  name,
  serial_number,
  last_seen_online,        -- NEW!
  last_seen_offline,       -- NEW!
  hardware_ids,            -- NEW!
  cohort_id,               -- NEW!
  golioth_status           -- NEW!
FROM devices
LIMIT 10;
```

### Check New Tables

```sql
-- Firmware history
SELECT * FROM device_firmware_history LIMIT 10;

-- Firmware artifacts
SELECT * FROM firmware_artifacts LIMIT 10;

-- Device credentials
SELECT * FROM device_credentials LIMIT 10;

-- Sync conflicts
SELECT * FROM sync_conflicts LIMIT 10;
```

---

## 📊 Demo 2: Test Unified Status API

### Get Device Status (Issue #89)

```bash
# Replace with your actual device ID
DEVICE_ID="your-device-id-here"
AUTH_TOKEN="your-auth-token-here"

curl -X GET "http://localhost:3000/api/devices/${DEVICE_ID}/status" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" | jq
```

**Expected Response:**
```json
{
  "device": {
    "id": "abc-123",
    "name": "Temperature Sensor 1",
    "external_device_id": "golioth-device-789"
  },
  "connectionState": "online",
  "lastActivity": "2026-01-26T10:15:00Z",
  "firmware": {
    "version": "v2.3.1",
    "component": "main"
  },
  "telemetry": {
    "battery": 85,
    "signalStrength": -65,
    "temperature": 22.5
  },
  "health": {
    "status": "healthy",
    "uptime": 86400
  },
  "capabilities": {
    "supportsFirmwareManagement": true,
    "supportsRealTimeStatus": true
  }
}
```

---

## 📊 Demo 3: Test Manual Sync (Issue #88)

### Trigger Device Sync

```bash
# Replace with your integration ID
INTEGRATION_ID="your-golioth-integration-id"
AUTH_TOKEN="your-auth-token-here"

curl -X POST "http://localhost:3000/api/integrations/${INTEGRATION_ID}/sync" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "fullSync": false,
    "batchSize": 100
  }' | jq
```

**Expected Response:**
```json
{
  "success": true,
  "devicesProcessed": 42,
  "devicesCreated": 5,
  "devicesUpdated": 37,
  "devicesDeleted": 0,
  "conflicts": [],
  "duration": 3245,
  "timestamp": "2026-01-26T10:30:00Z"
}
```

**What This Does:**
1. ✅ Connects to Golioth using YOUR existing provider
2. ✅ Fetches all devices from Golioth API
3. ✅ Matches devices by serial number (Issue #83)
4. ✅ Updates new columns (last_seen_online, hardware_ids, cohort_id)
5. ✅ Auto-logs firmware changes (Issue #81)
6. ✅ Detects and logs conflicts (Issue #87)

---

## 📊 Demo 4: View Firmware Deployment (Issue #85)

### List Firmware Artifacts

```bash
curl -X GET "http://localhost:3000/api/firmware/artifacts" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" | jq
```

### Deploy Firmware to Device

```bash
DEVICE_ID="your-device-id"
ARTIFACT_ID="artifact-uuid"

curl -X POST "http://localhost:3000/api/devices/${DEVICE_ID}/deploy-firmware" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "artifactId": "'${ARTIFACT_ID}'",
    "componentType": "main"
  }' | jq
```

**Expected Response:**
```json
{
  "deploymentId": "golioth-dev-456-1706234567890",
  "status": "queued",
  "artifactId": "artifact-uuid",
  "version": "v2.4.0",
  "componentType": "main",
  "queuedAt": "2026-01-26T10:35:00Z",
  "message": "Firmware v2.4.0 deployment queued for device dev-456",
  "details": {
    "deploymentId": "golioth-dev-456-1706234567890",
    "status": "queued"
  }
}
```

**What This Does:**
1. ✅ Validates firmware artifact exists
2. ✅ Checks provider supports firmware management
3. ✅ Calls real `provider.deployFirmware()` method
4. ✅ Logs to device_firmware_history table
5. ✅ Returns deployment tracking ID

### Check Firmware History

```sql
SELECT 
  dfh.*,
  d.name as device_name
FROM device_firmware_history dfh
JOIN devices d ON d.id = dfh.device_id
ORDER BY dfh.updated_at DESC
LIMIT 20;
```

---

## 📊 Demo 5: Credential Management (Issue #86)

### List Device Credentials

```bash
DEVICE_ID="your-device-id"

curl -X GET "http://localhost:3000/api/devices/${DEVICE_ID}/credentials" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" | jq
```

**Response:**
```json
{
  "credentials": [
    {
      "id": "cred-123",
      "type": "psk",
      "identity": "device-001",
      "createdAt": "2026-01-20T08:00:00Z"
    }
  ]
}
```

### Decrypt Credential (with Audit Trail)

```bash
DEVICE_ID="your-device-id"
CREDENTIAL_ID="cred-123"

curl -X POST "http://localhost:3000/api/devices/${DEVICE_ID}/credentials/decrypt" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "credentialId": "'${CREDENTIAL_ID}'"
  }' | jq
```

**Response:**
```json
{
  "credentialId": "cred-123",
  "type": "psk",
  "identity": "device-001",
  "secret": "decrypted-secret-here",
  "decryptedAt": "2026-01-26T10:40:00Z"
}
```

**What This Does:**
1. ✅ Calls database function `decrypt_device_credential()`
2. ✅ Decrypts server-side (keys never exposed to client)
3. ✅ Logs access to `device_credential_access_log`
4. ✅ Records IP address, user agent, timestamp

### Check Audit Log

```sql
SELECT 
  dcal.*,
  dc.credential_type,
  dc.identity,
  u.email as accessed_by_email
FROM device_credential_access_log dcal
JOIN device_credentials dc ON dc.id = dcal.credential_id
LEFT JOIN auth.users u ON u.id = dcal.accessed_by
ORDER BY dcal.accessed_at DESC
LIMIT 20;
```

---

## 📊 Demo 6: Sync Conflict Resolution (Issue #87)

### List Active Conflicts

```bash
curl -X GET "http://localhost:3000/api/sync/conflicts?status=pending" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" | jq
```

**Response:**
```json
{
  "conflicts": [
    {
      "id": "conflict-123",
      "deviceId": "dev-456",
      "deviceName": "Sensor 42",
      "field": "firmware_version",
      "localValue": "v2.3.1",
      "externalValue": "v2.4.0",
      "detectedAt": "2026-01-26T09:00:00Z",
      "status": "pending"
    }
  ],
  "total": 1
}
```

### Resolve Conflict

```bash
CONFLICT_ID="conflict-123"

curl -X POST "http://localhost:3000/api/sync/conflicts/${CONFLICT_ID}/resolve" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "use_external",
    "notes": "Accepting OTA update from Golioth"
  }' | jq
```

**Response:**
```json
{
  "conflictId": "conflict-123",
  "status": "resolved",
  "resolution": "use_external",
  "resolvedAt": "2026-01-26T10:45:00Z"
}
```

---

## 📊 Demo 7: Integration in Browser

### Visual Demo Steps

1. **Navigate to Devices Page:**
   ```
   http://localhost:3000/dashboard/devices
   ```

2. **Click on a Device:**
   - See real-time status from Golioth
   - View firmware version
   - Check last_seen_online timestamp

3. **Trigger Sync:**
   - Go to Integrations page
   - Click "Sync Now" button
   - Watch device count update

4. **View Firmware History:**
   - Open device details
   - See firmware update timeline
   - View deployment status

---

## 🧪 Complete Demo Script

### Step-by-Step Test Flow

```bash
#!/bin/bash
# Complete Golioth Demo Script

# 1. Setup
echo "🚀 Starting Golioth Demo..."
cd /workspaces/MonoRepo/development

# 2. Get first device from database
DEVICE_ID=$(npx supabase db execute "SELECT id FROM devices LIMIT 1" --local | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
echo "📱 Using device: $DEVICE_ID"

# 3. Get integration ID
INTEGRATION_ID=$(npx supabase db execute "SELECT id FROM device_integrations WHERE integration_type='golioth' LIMIT 1" --local | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
echo "🔌 Using integration: $INTEGRATION_ID"

# 4. Test Status API
echo ""
echo "📊 Testing Status API..."
curl -s "http://localhost:3000/api/devices/${DEVICE_ID}/status" | jq '.connectionState, .firmware.version'

# 5. Trigger Sync
echo ""
echo "🔄 Triggering Sync..."
curl -s -X POST "http://localhost:3000/api/integrations/${INTEGRATION_ID}/sync" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 10}' | jq '.devicesProcessed, .devicesUpdated'

# 6. Check for conflicts
echo ""
echo "⚠️  Checking for conflicts..."
curl -s "http://localhost:3000/api/sync/conflicts" | jq '.total'

# 7. View firmware history
echo ""
echo "📦 Checking firmware history..."
npx supabase db execute "SELECT COUNT(*) as history_count FROM device_firmware_history" --local

echo ""
echo "✅ Demo complete!"
```

---

## 🎬 Quick Demo Commands

### One-Liner Status Check
```bash
# Check if new columns exist
npx supabase db execute "SELECT last_seen_online, hardware_ids, cohort_id FROM devices LIMIT 1" --local
```

### One-Liner Sync Test
```bash
# Trigger sync and show result
curl -X POST "http://localhost:3000/api/integrations/YOUR_INTEGRATION_ID/sync" | jq '.success, .devicesProcessed'
```

### One-Liner Conflict Check
```bash
# Count pending conflicts
curl "http://localhost:3000/api/sync/conflicts?status=pending" | jq '.total'
```

---

## 📸 Demo Screenshots

### What to Show:

1. **Database Before/After Sync**
   - Show devices table with NULL values
   - Run sync
   - Show populated last_seen_online, hardware_ids

2. **API Response**
   - Show unified status API returning real-time data
   - Highlight firmware version, battery level, connection state

3. **Firmware Deployment**
   - Show artifact upload
   - Trigger deployment
   - Show deployment ID in response

4. **Conflict Resolution**
   - Show conflict list
   - Resolve conflict
   - Show updated device

5. **Audit Trail**
   - Show credential access log
   - Highlight IP address, timestamp, user

---

## 🐛 Troubleshooting

### Issue: "Device not found"
```bash
# List available devices
npx supabase db execute "SELECT id, name FROM devices" --local
```

### Issue: "Integration not found"
```bash
# List available integrations
npx supabase db execute "SELECT id, name, integration_type FROM device_integrations" --local
```

### Issue: API returns 401
```bash
# Make sure you're authenticated
# Get new token from browser DevTools
```

### Issue: No data in new columns
```bash
# Run a sync first!
curl -X POST "http://localhost:3000/api/integrations/YOUR_INTEGRATION_ID/sync"
```

---

## 🎯 Success Criteria

**After running the demo, you should see:**

✅ New columns populated in devices table  
✅ Firmware history entries created  
✅ Status API returns real-time data  
✅ Sync completes successfully  
✅ Conflicts detected and resolvable  
✅ Credential access logged  
✅ Deployment tracking working  

---

## 📚 Next Steps

1. **Connect Real Golioth Account:**
   - Add actual Golioth API key to integration
   - Run sync with real devices

2. **Test with Real Devices:**
   - Trigger firmware deployment to physical device
   - Monitor OTA update progress

3. **Enable Automated Sync:**
   - Set sync_interval_seconds in integration
   - Watch automated sync runs

4. **Monitor Audit Logs:**
   - Check credential access patterns
   - Review sync conflict history

---

**Happy Testing! 🚀**
