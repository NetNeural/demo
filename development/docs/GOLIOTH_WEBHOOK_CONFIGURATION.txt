# Golioth Webhook Configuration Guide

## Platform Limitation: No Signature Verification

**Important:** Golioth webhooks do **not support HMAC signature generation**. This is a platform limitation - Golioth cannot compute HMAC signatures using the webhook secret and JSON payload as inputs.

**Status:** `signature_verification: "not_supported"` is expected behavior for Golioth webhooks.

---

## Security Considerations

Since Golioth doesn't support webhook signatures, alternative security measures are recommended:

### 1. Network-Level Security
- Webhooks received at Supabase Edge Functions (HTTPS)
- TLS encryption in transit
- Supabase project access controls

### 2. Auto-Detection
- Golioth payloads have unique structure (`device_name` + `telemetry` fields)
- Integration auto-detected from payload format
- Integration must have `webhook_enabled: true`

### 3. Redundancy via Cron Sync
- Auto-sync cron pulls data directly from Golioth API every 5 minutes
- Provides verification that webhook data matches API data
- Acts as backup if webhooks are compromised

---

## Webhook Configuration

### 1. Configure in Golioth Dashboard

1. Go to [Golioth Console](https://console.golioth.io)
2. Navigate to your project: **nn-cellular-alerts**
3. Go to **Settings** → **Webhooks**
4. Find or create a webhook for your endpoint:
   ```
   https://atgbmxicqikmapfqouco.supabase.co/functions/v1/integration-webhook
   ```

5. Configure the following settings:

   **Webhook URL:**
   ```
   https://atgbmxicqikmapfqouco.supabase.co/functions/v1/integration-webhook
   ```

   **Events to Subscribe:**
   - ✅ `device.telemetry` (for sensor data)
   - ✅ `device.updated` (for device changes)
   - ✅ `device.created` (for new devices)
   - ✅ `device.status_changed` (for online/offline events)

   **Custom Headers (Optional):**
   - Name: `Content-Type`, Value: `application/json`
   - Name: `X-Integration-ID`, Value: `4be0f2e1-3912-4d2b-9488-ad11d9683ea7`

### 2. Verify Configuration

After saving, trigger a test webhook from Golioth or wait for a real device event.

Check the logs:
```bash
cd development
node scripts/check-webhook-config.js
```

You should see:
```
Signature Verification: not_supported (Golioth platform limitation)
```

---

## Example: Production Telemetry

**Received on 2026-02-15 17:00:09:**

```json
{
  "event": "device.telemetry",
  "telemetry": {
    "type": 2,
    "units": 3,
    "value": 78.30228122377356,
    "sensor": "SHT40",
    "timestamp": "2026-02-15T17:00:00Z"
  },
  "device_name": "M260600008"
}
```

**Response:**
```json
{
  "success": true,
  "event": "device.telemetry",
  "deviceId": "M260600008",
  "deviceName": "M260600008",
  "message": "Webhook processed successfully"
}
```

**Metadata:**
```json
{
  "signature_verification": "not_supported"
}
```

---

## Golioth Webhook Format Reference

### Event Types

| Event | Description | Payload |
|-------|-------------|---------|
| `device.telemetry` | Sensor data from device | `{ event, telemetry, device_name, timestamp }` |
| `device.updated` | Device metadata changed | `{ event, device: { id, name, status, ... } }` |
| `device.created` | New device added | `{ event, device: { id, name, ... } }` |
| `device.deleted` | Device removed | `{ event, device: { id } }` |
| `device.status_changed` | Online/offline | `{ event, device: { id, name, status } }` |

### Telemetry Payload Structure

Golioth sends telemetry in this format:
```json
{
  "event": "device.telemetry",
  "telemetry": {
    "type": 2,        // Data type (int, float, bool, string, etc.)
    "units": 3,       // Units enum (celsius, fahrenheit, etc.)
    "value": 78.30,   // Actual reading
    "sensor": "SHT40", // Sensor identifier
    "timestamp": "2026-02-15T17:00:00Z"
  },
  "device_name": "M260600008" // Maps to devices.serial_number
}
```

---

## Testing

### Send Test Webhook

```bash
PAYLOAD='{"event":"device.telemetry","telemetry":{"type":2,"units":3,"value":25.0,"sensor":"TEST"},"device_name":"M260600008"}'

curl -X POST https://atgbmxicqikmapfqouco.supabase.co/functions/v1/integration-webhook \
  -H "Content-Type: application/json" \
  -H "X-Integration-ID: 4be0f2e1-3912-4d2b-9488-ad11d9683ea7" \
  -d "$PAYLOAD"
```

### Monitor Logs

```bash
# Check recent webhooks
node scripts/check-webhook-config.js

# Watch edge function logs
npx supabase functions logs integration-webhook --follow
```

---

## Troubleshooting

### Problem: Device not found after webhook

**Check:**
1. Device exists in database: `SELECT * FROM devices WHERE serial_number = 'M260600008'`
2. `serial_number` field matches `device_name` from webhook
3. `organization_id` matches integration's org

**Fix:**
```sql
-- Update serial_number to match Golioth device_name
UPDATE devices
SET serial_number = 'M260600008'
WHERE name = 'M260600008' AND serial_number IS NULL;
```

### Problem: Webhook not being received

**Check:**
1. Golioth webhook URL is correct
2. Integration has `webhook_enabled: true`
3. Integration status is `active`
4. Edge function is deployed

**Debug:**
```sql
-- Check integration status
SELECT 
  name,
  status,
  webhook_enabled,
  webhook_url
FROM device_integrations
WHERE integration_type = 'golioth';

-- Check recent webhook attempts
SELECT 
  activity_type,
  status,
  created_at,
  metadata
FROM integration_activity_log
WHERE integration_id = '4be0f2e1-3912-4d2b-9488-ad11d9683ea7'
ORDER BY created_at DESC
LIMIT 10;
```

---

## References

- [Golioth Webhooks Documentation](https://docs.golioth.io/cloud/webhooks/)
- NetNeural Integration Activity Logs: `integration_activity_log` table
- Webhook Handler Code: `supabase/functions/integration-webhook/index.ts`

---

## Production-Grade Setup: Auto-Sync Cron

For redundancy, set up the 5-minute cron job that pulls data from Golioth API. This provides backup in case webhooks fail.

**See:** [STAGING_CRON_SYNC_SETUP.md](STAGING_CRON_SYNC_SETUP.md) for complete setup guide.

**Benefits:**
- ✅ Catches missed webhook events
- ✅ Provides historical data backfill  
- ✅ Verification that webhook data is authentic
- ✅ Same architecture as production
- ✅ Only 8,640 API calls/month (well within free tier)

**Architecture:**
- **Push (Webhooks)**: Real-time, < 1 second latency
- **Pull (Cron)**: Every 5 minutes, guaranteed backup

---

**Last Updated:** 2026-02-15  
**Environment:** Staging (atgbmxicqikmapfqouco)  
**Status:** Webhook active, signature verification not supported


**Last Updated:** 2026-02-15  
**Status:** Webhook push working, signature needs configuration, optional cron available  
**Priority:** Medium (signature for security), Low (cron for redundancy)
