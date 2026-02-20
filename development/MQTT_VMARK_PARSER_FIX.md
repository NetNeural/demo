# MQTT Integration Log Display Issue - Resolution

## Problem
Dashboard at `https://demo-stage.netneural.ai/dashboard/integrations/view/?id=a6d0e905-0532-4178-9ed0-2aae24a896f6` shows no logs under "Protocol Detected" section, despite device `2400390030314701` being connected and sending VMark protocol payloads.

## Root Cause Identified
The VMark payload parser in `/workspaces/MonoRepo/development/services/mqtt-subscriber/src/message-processor.ts` was incorrectly implemented:

### Expected VMark Payload Format:
```json
{
  "device": "2400390030314701",
  "handle": "properties_report",
  "paras": {
    "temperature": 22.77,
    "RSSI": -20
  },
  "time": "2025-04-23_07:35:22.214"
}
```

### Issues Found:

1. **Wrong telemetry field**: Parser was looking for `payload.data` instead of `payload.paras`
2. **Wrong device ID field**: Parser wasn't checking for `payload.device` (without underscore)
3. **Wrong timestamp field**: Parser was looking for `payload.timestamp` instead of `payload.time`
4. **Wrong timestamp format**: VMark uses `"YYYY-MM-DD_HH:MM:SS.mmm"` format

## Fixes Applied

### 1. Fixed `parseVMarkMessage()` method (lines 225-263)
- ✅ Changed from `payload.data` to `payload.paras` for telemetry extraction
- ✅ Added fallback to `payload.data` for backward compatibility
- ✅ Changed from `payload.timestamp` to `payload.time` for timestamp
- ✅ Added VMark timestamp parser: converts `"2025-04-23_07:35:22.214"` → ISO-8601 format
- ✅ Added try-catch for timestamp parsing with fallback to current time

### 2. Fixed `extractDeviceId()` method (lines 147-177)
- ✅ Added `payload.device` to device ID extraction checks
- ✅ Now checks: `device` → `deviceId` → `device_id` → `id` (in priority order)

## Next Steps

### For Staging/Production Environment:

1. **Restart MQTT Subscriber Service** (required to apply fixes):
   ```bash
   # If using Docker:
   cd /workspaces/MonoRepo/development/services/mqtt-subscriber
   docker-compose restart
   
   # If using PM2:
   pm2 restart mqtt-subscriber
   
   # If using systemd:
   sudo systemctl restart mqtt-subscriber
   ```

2. **Verify Service is Running**:
   ```bash
   # Docker:
   docker-compose ps
   docker-compose logs -f mqtt-subscriber
   
   # PM2:
   pm2 status
   pm2 logs mqtt-subscriber
   
   # Check for connection logs:
   # Should see: "Connected to MQTT broker" and "Subscribed to topics"
   ```

3. **Send Test Message** from your MQTT device or client:
   ```bash
   # Example using mosquitto_pub:
   mosquitto_pub -h <broker> -p <port> \
     -t "devices/2400390030314701/telemetry" \
     -m '{"device":"2400390030314701","handle":"properties_report","paras":{"temperature":22.77,"RSSI":-20},"time":"2025-04-23_07:35:22.214"}'
   ```

4. **Run Diagnostic Query** to verify logs are being created:
   ```bash
   # Run the diagnostic SQL in Supabase SQL Editor:
   cat /workspaces/MonoRepo/development/diagnose-mqtt-integration.sql
   ```

5. **Check Dashboard** - Refresh the integration view page to see new logs appear

### Diagnostic Checklist:

Run the diagnostic SQL file to check:
- ✅ Integration configuration (parser type should be 'vmark')
- ✅ Recent activity logs (should see 'mqtt_message_received' entries)
- ✅ Device exists and has recent `last_seen` timestamp
- ✅ Telemetry is being stored in `device_telemetry_history`
- ✅ MQTT credentials are configured (if using hosted broker)

## Expected Behavior After Fix

Once the MQTT subscriber service is restarted:

1. **Incoming messages** will be parsed correctly
2. **Activity logs** will appear in `integration_activity_log` table with:
   - `activity_type: 'mqtt_message_received'`
   - `direction: 'incoming'`
   - `status: 'success'`
   - `metadata` containing device ID and telemetry keys

3. **Dashboard** will display logs in the "Activity" tab showing:
   - Timestamp
   - Activity type (MQTT Message Received)
   - Direction (Incoming)
   - Status (Success)
   - Metadata with payload details

4. **Telemetry data** will be stored in `device_telemetry_history` with:
   - `temperature` metric
   - `RSSI` metric
   - Parsed timestamp from VMark format

## Additional Notes

### Parser Configuration
Ensure the integration has `payload_parser` set to `'vmark'` in the settings:

```sql
UPDATE device_integrations
SET settings = jsonb_set(settings, '{payload_parser}', '"vmark"')
WHERE id = 'a6d0e905-0532-4178-9ed0-2aae24a896f6';
```

### If Logs Still Don't Appear

1. **Check service logs** for connection errors
2. **Verify MQTT broker credentials** are correct
3. **Check topic subscriptions** match device publish topics
4. **Verify RLS policies** allow reading from `integration_activity_log`
5. **Check browser console** for JavaScript errors in dashboard

## Files Modified

1. `/workspaces/MonoRepo/development/services/mqtt-subscriber/src/message-processor.ts`
   - `parseVMarkMessage()` method (lines 225-263)
   - `extractDeviceId()` method (lines 147-177)

## Files Created

1. `/workspaces/MonoRepo/development/diagnose-mqtt-integration.sql`
   - Diagnostic queries for troubleshooting

---

**Status**: Code fixes complete ✅  
**Action Required**: Restart MQTT subscriber service in staging environment  
**Verification**: Run diagnostic SQL and test with live MQTT message
