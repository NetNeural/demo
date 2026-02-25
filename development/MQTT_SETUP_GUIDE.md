# MQTT Setup & Troubleshooting Guide

## Current Issue

- You see "No activity logs yet" in the Support → Activity Log section
- This means no MQTT data has been received by NetNeural

## Where MQTT Data Should Appear

1. **Activity Log** (`/dashboard/support` → Activity tab)
   - Shows integration events (connection, data received, errors)
2. **Sensor Telemetry Table** (Database: `sensor_telemetry_data`)
   - Stores all temperature, humidity, battery data
3. **Device Details** (`/dashboard/devices/[id]`)
   - Shows latest readings for each device

## Step-by-Step Troubleshooting

### Step 1: Check Your Devices

Run this SQL in Supabase SQL Editor (or use `mqtt-diagnostic.sql`):

```sql
SELECT name, device_id, is_active FROM devices;
```

**Expected:** You should see at least one device
**If empty:** Create a device first in `/dashboard/devices`

---

### Step 2: Verify MQTT Credentials

Go to **Support → Troubleshooting** tab and click "Test Integration"

**Expected result:**

```json
{
  "success": true,
  "message": "Golioth service is operational",
  "hasApiKey": true,
  "hasProjectId": true
}
```

**If `hasApiKey: false`:** You need to set `GOLIOTH_API_KEY` in GitHub Secrets
**If test fails:** Check your Golioth account status

---

### Step 3: Configure Device in Golioth Dashboard

1. Log into [Golioth Console](https://console.golioth.io)
2. Go to your project
3. Navigate to **Devices** or **Blueprints**
4. For each device, configure:
   - **Device Name:** Must match your NetNeural device's `device_id`
   - **Credentials:** Copy PSK-ID and PSK for device firmware
   - **Pipeline:** Must send data to **Callbacks**

---

### Step 4: Set Up Golioth Callback (Webhook)

In Golioth Console:

1. Go to **Webhooks** or **Callbacks**
2. Create a new webhook:
   - **URL:** `https://[your-staging-url]/api/integrations/golioth/callback`
   - **Events:** Select `message.received` or `stream.received`
   - **Format:** JSON
   - **Authentication:** None (or Basic Auth if you set it up)

Example callback URL:

```
https://demo-stage.netneural.ai/api/integrations/golioth/callback
```

---

### Step 5: Send Test Data from Device

From your IoT device, publish to Golioth:

**Topic Format:**

```
projects/[PROJECT_ID]/devices/[DEVICE_ID]/data
```

**Example Payload:**

```json
{
  "temperature": 22.5,
  "humidity": 55.0,
  "battery_level": 85
}
```

**Using Golioth CLI:**

```bash
goliothctl stream set [DEVICE_NAME] /sensor '{
  "temperature": 22.5,
  "humidity": 55.0,
  "battery_level": 85
}'
```

---

### Step 6: Check for Data

**Option A: Using SQL** (recommended for debugging)

```sql
-- Check latest telemetry
SELECT * FROM sensor_telemetry_data
ORDER BY timestamp DESC
LIMIT 10;

-- Check integration activity
SELECT * FROM integration_activity
ORDER BY created_at DESC
LIMIT 10;
```

**Option B: Using Dashboard**

1. Go to `/dashboard/devices`
2. Click on a device
3. Check "Latest Reading" card
4. View telemetry charts

**Option C: Using Activity Log**

1. Go to `/dashboard/support`
2. Click "Activity" tab
3. Should see "Golioth data received" events

---

## Common Issues

### Issue: "Integration service not available"

**Cause:** Edge Function not deployed or crashed
**Fix:** Check GitHub Actions deployment logs

### Issue: "Device not found"

**Cause:** Device name in Golioth doesn't match NetNeural device_id
**Fix:**

```sql
-- Check your device IDs
SELECT device_id, name FROM devices;
```

Update Golioth device name to match

### Issue: "Invalid payload"

**Cause:** Data format doesn't match expected structure
**Fix:** Use this exact format:

```json
{
  "temperature": 22.5,
  "humidity": 55.0,
  "battery_level": 85,
  "timestamp": "2026-02-20T10:30:00Z"
}
```

### Issue: No data in Activity Log but SQL shows data

**Cause:** Activity logging might be disabled or UI filter issue
**Fix:** Check SQL directly:

```sql
SELECT COUNT(*) FROM integration_activity WHERE integration_type = 'golioth';
```

---

## Test Data Manually

If you don't have a physical device, you can insert test data:

```sql
-- Insert test telemetry
INSERT INTO sensor_telemetry_data (
  device_id,
  timestamp,
  temperature,
  humidity,
  battery_level,
  metadata
)
SELECT
  id as device_id,
  NOW() as timestamp,
  22.5 as temperature,
  55.0 as humidity,
  85 as battery_level,
  '{"source": "manual_test"}'::jsonb as metadata
FROM devices
LIMIT 1;
```

Then refresh `/dashboard/devices/[device-id]` to see it

---

## Next Steps

1. **Run `mqtt-diagnostic.sql`** to see current state
2. **Test integration** in Support → Troubleshooting
3. **Set up Golioth webhook** pointing to your Edge Function
4. **Send test data** from Golioth CLI or dashboard
5. **Check Activity Log** for confirmation

---

## Quick Reference

| What             | Where                                      |
| ---------------- | ------------------------------------------ |
| Activity Logs    | `/dashboard/support` → Activity tab        |
| Test Integration | `/dashboard/support` → Troubleshooting tab |
| Device Telemetry | `/dashboard/devices/[id]`                  |
| Raw Data (SQL)   | Supabase SQL Editor                        |
| Integration Logs | `SELECT * FROM integration_activity`       |
| Telemetry Data   | `SELECT * FROM sensor_telemetry_data`      |

---

**Need Help?**
Run `mqtt-diagnostic.sql` and share the output to get specific troubleshooting steps.
