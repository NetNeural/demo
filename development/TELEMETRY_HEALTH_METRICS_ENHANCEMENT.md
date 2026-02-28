# Telemetry Health Metrics Enhancement

**Date:** 2025-11-13  
**Component:** `SensorOverviewCardNew.tsx`  
**Issue:** Battery life and other telemetry health metrics not displaying for IoT sensors

## Problem

The `SensorOverviewCard` component was only displaying device-level fields from the `devices` table:

- `device.battery_level`
- `device.signal_strength`
- `device.firmware_version`

However, the database was collecting additional health metrics in `device_telemetry_history.telemetry` JSONB:

- `telemetry.battery` - Real-time battery readings
- `telemetry.rssi` - Real-time signal strength
- `telemetry.uptime` - Device uptime in seconds
- `telemetry.firmware_version` - Firmware version from telemetry

These telemetry fields were being stored (via migration `20250109000003_telemetry_all_integrations.sql`) but never parsed or displayed in the UI.

## Solution

### 1. Added Telemetry Parsing Logic

Created a `useMemo` hook to extract health metrics from the latest telemetry reading:

```typescript
const telemetryHealthMetrics = useMemo(() => {
  if (!telemetryReadings.length) return null

  const latest = telemetryReadings[0].telemetry
  return {
    battery: typeof latest.battery === 'number' ? latest.battery : null,
    rssi: typeof latest.rssi === 'number' ? latest.rssi : null,
    uptime: typeof latest.uptime === 'number' ? latest.uptime : null,
    firmware:
      typeof latest.firmware_version === 'string'
        ? latest.firmware_version
        : null,
  }
}, [telemetryReadings])
```

### 2. Added Uptime Formatter

Created a helper function to format uptime seconds into human-readable format:

```typescript
const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`)

  return parts.join(' ')
}
```

### 3. Enhanced Secondary Info Grid

Updated the UI to display both device-level and telemetry-level metrics:

**Battery:**

- Shows device profile battery (`device.battery_level`) labeled as "(Profile)"
- Shows live telemetry battery (`telemetry.battery`) labeled as "(Live)"
- If only one source has data, displays it without label

**Signal Strength:**

- Shows device profile signal (`device.signal_strength`) labeled as "(Profile)"
- Shows live telemetry RSSI (`telemetry.rssi`) labeled as "(Live)"
- If only one source has data, displays it without label

**Uptime:**

- NEW: Displays device uptime from telemetry
- Formatted as "3d 14h 23m" for readability

**Firmware Version:**

- Shows device profile firmware (`device.firmware_version`)
- Shows live telemetry firmware (`telemetry.firmware_version`) if different
- Distinguishes between "(Profile)" and "(Live)" versions

## Benefits

1. **Complete Visibility:** Users now see all device health metrics being collected
2. **Real-time Data:** Telemetry provides more current readings than device table
3. **Dual Source Display:** Shows both profile and live data when available
4. **Clear Labeling:** "(Profile)" vs "(Live)" helps users understand data sources
5. **Uptime Monitoring:** New uptime field helps diagnose device issues

## Testing

**Device Tested:** 9a974aa0-7993-46d4-af7e-3a629060214a  
**Environment:** Staging (demo-stage.netneural.ai)

To verify the enhancement:

1. Navigate to device details page
2. Check "Sensor Overview" card
3. Verify battery, signal, uptime, and firmware fields display
4. Confirm labels distinguish device profile from live telemetry

## Related Files

- **Component:** `development/src/components/sensors/SensorOverviewCardNew.tsx`
- **Migration:** `development/supabase/migrations/20250109000003_telemetry_all_integrations.sql`
- **Query Script:** `development/check_telemetry_fields.sql`

## Database Schema

### devices table (Profile Data)

- `battery_level` - Last known battery percentage
- `signal_strength` - Last known signal in dBm
- `firmware_version` - Last known firmware version

### device_telemetry_history.telemetry JSONB (Live Data)

- `battery` - Real-time battery reading (from `battery_level` metadata)
- `rssi` - Real-time signal strength (from `rssi` or `signal_strength` metadata)
- `uptime` - Device uptime in seconds (from `uptime` or `uptime_seconds` metadata)
- `firmware_version` - Firmware version reported in telemetry

## Future Enhancements

- Add trend indicators (🔺/🔻) for battery/signal changes
- Graph historical battery/signal data over time
- Alert on low battery or poor signal conditions
- Add more telemetry health metrics as needed (voltage, current, power, etc.)
