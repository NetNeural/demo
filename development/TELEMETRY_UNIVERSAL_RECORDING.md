# Universal Telemetry Recording Architecture

## Overview

This document describes the **universal telemetry recording system** that ensures ALL integrations (MQTT, Golioth, AWS IoT, Azure IoT, etc.) consistently record device telemetry to `device_telemetry_history`.

Previously, only MQTT real-time messages triggered telemetry recording. Now, sync operations from ALL integrations extract and store telemetry data during device import.

---

## Problem Statement

**Before This Update:**

| Integration | Metadata Sync | Telemetry Recording | Status     |
| ----------- | ------------- | ------------------- | ---------- |
| MQTT        | Real-time     | ✅ Via listener     | WORKING    |
| Golioth     | ✅ Working    | ❌ API not called   | INCOMPLETE |
| AWS IoT     | ✅ Working    | ❌ Shadow ignored   | INCOMPLETE |
| Azure IoT   | ✅ Working    | ❌ Twin ignored     | INCOMPLETE |

**Issues:**

- Users could see device status but NOT telemetry history
- Charts only displayed MQTT data
- Alerts only worked for MQTT devices
- No historical data for analytics or compliance

**After This Update:**

| Integration | Metadata Sync | Telemetry Recording | Status      |
| ----------- | ------------- | ------------------- | ----------- |
| MQTT        | Real-time     | ✅ Via listener     | ✅ COMPLETE |
| Golioth     | ✅ Working    | ✅ Via sync         | ✅ COMPLETE |
| AWS IoT     | ✅ Working    | ✅ Via sync         | ✅ COMPLETE |
| Azure IoT   | ✅ Working    | ✅ Via sync         | ✅ COMPLETE |

---

## Architecture

### 1. Database Schema

**Extended `device_telemetry_history` table:**

```sql
CREATE TABLE device_telemetry_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  telemetry JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_timestamp TIMESTAMPTZ,
  activity_log_id UUID REFERENCES integration_activity_log(id),
  integration_id UUID REFERENCES device_integrations(id) ON DELETE CASCADE  -- NEW
);
```

**Key Change:** Added `integration_id` to track which integration recorded the telemetry.

### 2. Helper Functions

**`record_device_telemetry()` - Universal telemetry recording:**

```sql
CREATE OR REPLACE FUNCTION record_device_telemetry(
  p_device_id UUID,
  p_organization_id UUID,
  p_telemetry JSONB,
  p_device_timestamp TIMESTAMPTZ DEFAULT NULL,
  p_activity_log_id UUID DEFAULT NULL,
  p_integration_id UUID DEFAULT NULL  -- NEW: Track source
) RETURNS UUID;
```

**`extract_telemetry_from_metadata()` - Auto-extract from device metadata:**

```sql
CREATE OR REPLACE FUNCTION extract_telemetry_from_metadata(p_metadata JSONB)
RETURNS JSONB;
```

Extracts common telemetry fields:

- `battery_level`, `battery`, `battery_percentage` → `battery`
- `temperature`, `temp` → `temperature`
- `humidity` → `humidity`
- `rssi`, `signal_strength` → `rssi`
- `firmware_version` → `firmware_version`
- `uptime`, `uptime_seconds` → `uptime`

**Trigger: Auto-record telemetry on device update:**

```sql
CREATE TRIGGER trigger_auto_record_telemetry
  AFTER UPDATE ON devices
  FOR EACH ROW
  WHEN (NEW.metadata IS DISTINCT FROM OLD.metadata)
  EXECUTE FUNCTION auto_record_telemetry_on_device_update();
```

When a device's metadata is updated during sync, this trigger automatically extracts and records telemetry.

---

## Implementation

### Base Integration Client

**New Helper Methods:**

```typescript
export abstract class BaseIntegrationClient {
  // ... existing methods ...

  /**
   * Record telemetry data during sync operations
   * Ensures ALL integrations consistently record telemetry
   */
  protected async recordTelemetry(
    deviceId: string,
    telemetry: Record<string, unknown>,
    deviceTimestamp?: string
  ): Promise<string | null>

  /**
   * Record multiple telemetry points in batch
   * More efficient for syncing historical telemetry data
   */
  protected async recordTelemetryBatch(
    records: Array<{
      deviceId: string
      telemetry: Record<string, unknown>
      timestamp?: string
    }>
  ): Promise<number>

  /**
   * Extract telemetry from device metadata
   * Helper function to pull common telemetry fields
   */
  protected extractTelemetryFromMetadata(
    metadata: Record<string, unknown>
  ): Record<string, unknown>
}
```

### Integration-Specific Implementations

#### 1. Golioth Integration

**Updated `import()` method:**

```typescript
public async import(): Promise<SyncResult> {
  // ... fetch devices ...

  for (const goliothDevice of goliothDevices) {
    // 1. Upsert device to database
    const localDeviceId = await this.upsertDevice(goliothDevice)

    // 2. NEW: Fetch and record telemetry from Golioth API
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const telemetryData = await this.getDeviceTelemetry(goliothDevice.id, since)

    if (telemetryData.length > 0) {
      await this.recordTelemetryBatch(
        telemetryData.map(point => ({
          deviceId: localDeviceId,
          telemetry: point.data,
          timestamp: point.timestamp
        }))
      )
    }
  }
}
```

**Data Source:** Golioth `/telemetry` API endpoint (last 24 hours)

**Telemetry Format Example:**

```json
{
  "temperature": 22.5,
  "humidity": 65.3,
  "battery": 87,
  "rssi": -45
}
```

---

#### 2. AWS IoT Integration

**Updated `import()` method:**

```typescript
public async import(): Promise<SyncResult> {
  // ... fetch things ...

  for (const thing of things) {
    // 1. Upsert device to database
    const localDeviceId = await this.upsertDevice(thing)

    // 2. Get Thing Shadow
    const shadow = await this.getThingShadow(thing.thingName)

    // 3. NEW: Extract and record telemetry from Shadow "reported" state
    if (shadow?.state?.reported) {
      await this.recordTelemetry(
        localDeviceId,
        shadow.state.reported,
        shadow.metadata?.timestamp
          ? new Date(shadow.metadata.timestamp * 1000).toISOString()
          : undefined
      )
    }
  }
}
```

**Data Source:** AWS IoT Thing Shadow `state.reported` object

**Telemetry Format Example:**

```json
{
  "temperature": 23.1,
  "pressure": 1013.25,
  "location": {
    "lat": 37.7749,
    "lon": -122.4194
  },
  "firmware": "v2.3.1"
}
```

---

#### 3. Azure IoT Integration

**Updated `import()` method:**

```typescript
public async import(): Promise<SyncResult> {
  // ... fetch devices ...

  for (const azureDevice of azureDevices) {
    // 1. Upsert device to database
    const localDeviceId = await this.upsertDevice(azureDevice)

    // 2. Get Device Twin
    const twin = await this.getDeviceTwin(azureDevice.deviceId)

    // 3. NEW: Extract and record telemetry from Twin "reported" properties
    if (twin?.properties?.reported) {
      await this.recordTelemetry(
        localDeviceId,
        twin.properties.reported,
        twin.lastActivityTime
      )
    }
  }
}
```

**Data Source:** Azure IoT Device Twin `properties.reported` object

**Telemetry Format Example:**

```json
{
  "temperature": 24.8,
  "humidity": 58.2,
  "battery": 92,
  "uptime": 36000,
  "firmware_version": "1.2.5"
}
```

---

#### 4. MQTT Integration (Already Working)

**Real-time message handler** (no changes needed):

```typescript
async function handleMqttMessage(message: MqttMessage) {
  // 1. Log message to activity_log
  const activityLogId = await logActivity(...)

  // 2. Record telemetry to device_telemetry_history
  await supabase.rpc('record_device_telemetry', {
    p_device_id: deviceId,
    p_organization_id: orgId,
    p_telemetry: parsedTelemetry,
    p_device_timestamp: message.timestamp,
    p_activity_log_id: activityLogId,
    p_integration_id: mqttIntegrationId
  })
}
```

**Data Source:** MQTT topic messages (real-time)

---

## Benefits

### 1. **Consistent Data Collection**

- All integrations now record telemetry using the same database schema
- Same helper functions ensure consistent error handling

### 2. **Historical Analytics**

- Charts display telemetry from ALL integration types
- Temperature trends, battery degradation, signal strength over time
- Works for Golioth, AWS IoT, Azure IoT, and MQTT devices

### 3. **Universal Alerting**

- Alert rules work across ALL integrations
- Example: "Alert when battery < 20%" works for any device source

### 4. **Compliance & Auditing**

- Complete historical telemetry for regulatory requirements
- Can trace data source via `integration_id` column

### 5. **Auto-Sync Compatible**

- Auto-sync schedules automatically record telemetry during import
- No manual intervention needed

---

## Migration Steps

### 1. Deploy Database Migration

```bash
cd development/supabase
supabase migration up 20250109_telemetry_all_integrations.sql
```

**This migration:**

- Adds `integration_id` column to `device_telemetry_history`
- Updates `record_device_telemetry()` function signature
- Creates `extract_telemetry_from_metadata()` helper
- Creates `trigger_auto_record_telemetry` on `devices` table

### 2. Deploy Updated Edge Functions

```bash
supabase functions deploy device-sync  # Uses updated base-integration-client
```

**Updated files:**

- `base-integration-client.ts` - New helper methods
- `golioth-client.ts` - Updated `import()` method
- `aws-iot-client.ts` - Updated `import()` method
- `azure-iot-client.ts` - Updated `import()` method

### 3. Verify Telemetry Recording

**Test Golioth Sync:**

```bash
curl -X POST https://your-project.supabase.co/functions/v1/device-sync \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{"integration_id": "golioth-integration-id", "direction": "import"}'
```

**Check telemetry recorded:**

```sql
SELECT
  d.name,
  i.type AS integration_type,
  dth.telemetry,
  dth.received_at
FROM device_telemetry_history dth
JOIN devices d ON d.id = dth.device_id
JOIN device_integrations i ON i.id = dth.integration_id
WHERE dth.received_at > NOW() - INTERVAL '1 hour'
ORDER BY dth.received_at DESC;
```

### 4. Backfill Historical Data (Optional)

If you want to import historical telemetry for existing devices:

```sql
-- Trigger backfill by updating device metadata
UPDATE devices
SET metadata = metadata  -- Triggers the auto-record trigger
WHERE organization_id = 'your-org-id'
  AND metadata IS NOT NULL;
```

---

## Query Patterns

### Get Telemetry for a Device (All Integrations)

```sql
SELECT
  dth.telemetry,
  dth.device_timestamp,
  dth.received_at,
  i.type AS source_integration,
  i.name AS integration_name
FROM device_telemetry_history dth
LEFT JOIN device_integrations i ON i.id = dth.integration_id
WHERE dth.device_id = 'device-uuid'
  AND dth.received_at > NOW() - INTERVAL '7 days'
ORDER BY dth.received_at DESC;
```

### Get Latest Telemetry by Integration Type

```sql
SELECT DISTINCT ON (i.type)
  i.type AS integration_type,
  dth.telemetry,
  dth.device_timestamp
FROM device_telemetry_history dth
JOIN device_integrations i ON i.id = dth.integration_id
WHERE dth.device_id = 'device-uuid'
ORDER BY i.type, dth.received_at DESC;
```

### Temperature Chart (All Sources)

```sql
SELECT
  dth.device_timestamp AS time,
  (dth.telemetry->>'temperature')::numeric AS temperature,
  i.type AS source
FROM device_telemetry_history dth
JOIN device_integrations i ON i.id = dth.integration_id
WHERE dth.device_id = 'device-uuid'
  AND dth.telemetry ? 'temperature'
  AND dth.device_timestamp > NOW() - INTERVAL '24 hours'
ORDER BY dth.device_timestamp ASC;
```

---

## Performance Considerations

### Batch Telemetry Recording

For large syncs (100+ devices), telemetry is recorded in batches of 50:

```typescript
protected async recordTelemetryBatch(records: TelemetryRecord[]) {
  const batchSize = 50
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    await Promise.allSettled(batch.map(r => this.recordTelemetry(...)))
  }
}
```

### Retention Policy

Telemetry data is retained for 90 days by default:

```sql
SELECT cron.schedule(
  'cleanup-old-telemetry',
  '0 2 * * *',  -- Daily at 2 AM
  $$ SELECT cleanup_old_telemetry(90); $$
);
```

Override retention per organization:

```sql
-- Keep telemetry for 1 year for specific org
SELECT cleanup_old_telemetry(365, 'org-uuid');
```

---

## Troubleshooting

### Issue: No Telemetry Recorded During Sync

**Symptoms:**

- Devices imported successfully
- `device_telemetry_history` table remains empty

**Diagnosis:**

```sql
-- Check integration_activity_log for errors
SELECT
  activity_type,
  status,
  error_message,
  metadata
FROM integration_activity_log
WHERE integration_id = 'your-integration-id'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Common Causes:**

1. **Golioth:** No telemetry data on platform (devices haven't reported)
2. **AWS IoT:** Thing Shadow doesn't exist (create via AWS Console)
3. **Azure IoT:** Device Twin properties empty (devices haven't updated Twin)

**Solution:**

- Verify devices are actively reporting telemetry to external platform
- Check external platform console (Golioth/AWS/Azure) for telemetry data
- Ensure device credentials are valid

---

### Issue: Telemetry Missing Timestamp

**Symptoms:**

- Telemetry recorded but `device_timestamp` is NULL
- Charts show incorrect time ordering

**Diagnosis:**

```sql
SELECT
  COUNT(*) AS records_without_timestamp
FROM device_telemetry_history
WHERE device_timestamp IS NULL
  AND received_at > NOW() - INTERVAL '1 day';
```

**Solution:**

Telemetry from Golioth/AWS/Azure should include timestamps. If missing, add timestamp extraction:

```typescript
// In integration client import() method:
const timestamp =
  data.timestamp || data.time || data.ts || new Date().toISOString()

await this.recordTelemetry(deviceId, data, timestamp)
```

---

### Issue: Duplicate Telemetry Records

**Symptoms:**

- Same telemetry point recorded multiple times
- Charts show duplicate data

**Diagnosis:**

```sql
SELECT
  device_id,
  telemetry,
  COUNT(*) AS duplicate_count
FROM device_telemetry_history
WHERE received_at > NOW() - INTERVAL '1 hour'
GROUP BY device_id, telemetry
HAVING COUNT(*) > 1;
```

**Solution:**

Add uniqueness constraint (optional, may cause sync errors if platforms send duplicates):

```sql
CREATE UNIQUE INDEX idx_telemetry_dedup
  ON device_telemetry_history (device_id, telemetry, device_timestamp)
  WHERE device_timestamp IS NOT NULL;
```

---

## Future Enhancements

### 1. Telemetry Aggregation

Pre-compute hourly/daily averages for faster chart rendering:

```sql
CREATE TABLE device_telemetry_aggregates (
  device_id UUID,
  time_bucket TIMESTAMPTZ,
  resolution TEXT,  -- 'hour', 'day', 'week'
  avg_temperature NUMERIC,
  avg_humidity NUMERIC,
  avg_battery NUMERIC,
  min_battery NUMERIC,
  max_temperature NUMERIC,
  sample_count INTEGER
);
```

### 2. Telemetry Validation

Add JSON schema validation to ensure telemetry quality:

```sql
ALTER TABLE device_telemetry_history
ADD CONSTRAINT telemetry_schema_check
CHECK (
  jsonb_typeof(telemetry) = 'object' AND
  jsonb_array_length(jsonb_object_keys(telemetry)) > 0
);
```

### 3. Real-time Telemetry Streaming

Stream telemetry updates to UI via Supabase Realtime:

```typescript
const subscription = supabase
  .channel('telemetry')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'device_telemetry_history',
      filter: `device_id=eq.${deviceId}`,
    },
    (payload) => {
      updateChart(payload.new.telemetry)
    }
  )
  .subscribe()
```

### 4. Telemetry Export

Export telemetry for external analytics:

```sql
COPY (
  SELECT
    d.name,
    dth.device_timestamp,
    dth.telemetry
  FROM device_telemetry_history dth
  JOIN devices d ON d.id = dth.device_id
  WHERE dth.received_at > NOW() - INTERVAL '30 days'
) TO '/tmp/telemetry_export.csv' WITH CSV HEADER;
```

---

## Testing

### Unit Tests

```typescript
describe('BaseIntegrationClient.recordTelemetry', () => {
  it('should record telemetry with all parameters', async () => {
    const client = new MockIntegrationClient(config)
    const telemetryId = await client.recordTelemetry(
      'device-123',
      { temperature: 25.5, humidity: 60 },
      '2025-01-09T12:00:00Z'
    )
    expect(telemetryId).toBeTruthy()
  })

  it('should return null for empty telemetry', async () => {
    const client = new MockIntegrationClient(config)
    const telemetryId = await client.recordTelemetry('device-123', {})
    expect(telemetryId).toBeNull()
  })
})
```

### Integration Tests

```typescript
describe('Golioth Sync with Telemetry', () => {
  it('should import devices and record telemetry', async () => {
    const client = new GoliothClient(config)
    const result = await client.import()

    expect(result.devices_succeeded).toBeGreaterThan(0)
    expect(result.details?.telemetry_points).toBeGreaterThan(0)

    // Verify telemetry in database
    const { data } = await supabase
      .from('device_telemetry_history')
      .select('*')
      .eq('integration_id', config.integrationId)

    expect(data?.length).toBeGreaterThan(0)
  })
})
```

---

## Summary

✅ **ALL integrations now record telemetry consistently**  
✅ **Historical data captured from Golioth, AWS IoT, Azure IoT**  
✅ **Charts, alerts, and analytics work across all integration types**  
✅ **Auto-sync schedules automatically record telemetry**  
✅ **Unified helper functions ensure consistent error handling**  
✅ **Telemetry linked to activity_log for complete audit trail**

This architecture provides a solid foundation for comprehensive IoT device monitoring across any integration platform.
