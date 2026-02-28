# Golioth Integration Comparison - Local vs Production

## Summary

**Issue:** Production returns 0 devices despite valid credentials
**Status:** Investigating why Golioth API returns empty device list

---

## Production Settings (via Supabase MCP) ✅ VERIFIED

**Integration Record:**

- ID: `02152062-3010-4313-9277-4fd7c4640cf3`
- Name: "NetNeural Golioth"
- Type: `golioth`
- Status: `active`
- Created: 2025-10-27 02:44:45
- Updated: 2025-11-13 20:48:47 (recent!)

**Connection Details:**

- Project ID: `nn-cellular-alerts`
- Base URL: `https://api.golioth.io/v1`
- API Key Length: 32 chars ✅
- Settings Project ID: `nn-cellular-alerts`
- Settings API Key: `DAf7enB249brtg8EAX7nWnMqWlyextWY`

**Sync Configuration:**

- Sync Enabled: `false`
- Sync Direction: `bidirectional`
- Sync Interval: 300 seconds
- Webhook Enabled: `false`

**Device Count:**

- Total Devices: 3 (all manual test devices, no integration_id)
- Golioth Devices: **0** ❌
- Online Devices: 0

**Activity Logs (Last 10):**

- All operations: `sync_import`
- All statuses: `success` ✅
- Response times: 130-231ms (fast - suggests empty response)
- Last sync: ~7 hours ago (2025-11-14 04:26:22)

---

## Local Settings (via SQLTools) - TO BE QUERIED

**Run this query against "Supabase Local" in SQLTools:**

```sql
-- Integration settings
SELECT
  'LOCAL' as environment,
  id,
  name,
  project_id,
  base_url,
  LENGTH(api_key_encrypted) as api_key_length,
  settings->>'projectId' as settings_project_id,
  LEFT(settings->>'apiKey', 10) || '...' as settings_api_key_preview,
  settings->>'syncEnabled' as sync_enabled,
  status,
  created_at,
  updated_at
FROM device_integrations
WHERE integration_type = 'golioth';

-- Device count
SELECT
  'LOCAL' as environment,
  COUNT(*) as total_devices,
  COUNT(CASE WHEN status = 'online' THEN 1 END) as online_devices,
  COUNT(CASE WHEN status = 'offline' THEN 1 END) as offline_devices,
  MAX(last_seen) as most_recent_seen
FROM devices
WHERE integration_id IN (SELECT id FROM device_integrations WHERE integration_type = 'golioth');

-- Sample devices
SELECT
  name,
  device_type,
  status,
  external_device_id,
  hardware_ids,
  last_seen,
  metadata->>'golioth_project_id' as golioth_project
FROM devices
WHERE integration_id IN (SELECT id FROM device_integrations WHERE integration_type = 'golioth')
LIMIT 5;
```

---

## Key Questions to Answer

1. **Does local use the same Golioth project (`nn-cellular-alerts`)?**
   - If different project → explains why local has devices but production doesn't
2. **Does local use the same API key?**
   - If different key → may have different permissions
3. **Are local devices actually from Golioth API or manually created?**
   - Check `external_device_id` and `metadata.golioth_project_id`
4. **Does the Golioth project `nn-cellular-alerts` actually have devices?**
   - Need to check Golioth Console or query API directly

---

## Next Steps

1. ✅ Run SQLTools query against local database
2. ✅ Compare project IDs and API keys
3. ⏭️ If they match → Query Golioth API directly to see device list
4. ⏭️ If they differ → Production may need different project/key
