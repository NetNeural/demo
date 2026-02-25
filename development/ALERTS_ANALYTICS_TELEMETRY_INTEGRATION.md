# Alerts & Analytics Integration with Universal Telemetry System

## Overview

The universal telemetry recording system provides the **data foundation** for both alerts and analytics. By ensuring ALL integrations (MQTT, Golioth, AWS IoT, Azure IoT) consistently record telemetry to `device_telemetry_history`, we enable powerful monitoring and visualization capabilities across the entire platform.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTEGRATION SOURCES                          │
├─────────────┬──────────────┬──────────────┬────────────────────┤
│    MQTT     │   Golioth    │   AWS IoT    │    Azure IoT       │
│  (Real-time)│    (Sync)    │   (Shadow)   │     (Twin)         │
└──────┬──────┴──────┬───────┴──────┬───────┴────────┬───────────┘
       │             │              │                │
       │             │              │                │
       ▼             ▼              ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│              device_telemetry_history                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  id, device_id, organization_id, integration_id          │  │
│  │  telemetry: { temperature, battery, humidity, rssi }     │  │
│  │  device_timestamp, received_at                           │  │
│  │  activity_log_id (link to event context)                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────┬─────────────────────────────────┬───────────────────┘
            │                                 │
            │                                 │
       ┌────▼────┐                       ┌────▼─────┐
       │ ALERTS  │                       │ ANALYTICS│
       │ SYSTEM  │                       │  ENGINE  │
       └─────────┘                       └──────────┘
```

---

## 🚨 Part 1: Alerts Integration

### How Alerts Work with Telemetry

**Alert Flow:**

```
1. Telemetry Data Arrives
   ↓
2. Stored in device_telemetry_history
   ↓
3. Alert Rule Evaluation Triggered
   ↓
4. Check Rules: Compare telemetry against thresholds
   ↓
5. If Rule Triggered → Create Alert Instance
   ↓
6. Send Notifications (based on user preferences)
```

---

### Alert Rules (Organization-Level Configuration)

**Location:** `/dashboard/organizations` > Alerts Tab  
**Purpose:** Define WHAT triggers alerts  
**Database Table:** `alert_rules`

**Rule Structure:**

```typescript
interface AlertRule {
  id: string
  organization_id: string
  name: string // "High Temperature Alert"
  condition: {
    metric: string // "temperature"
    operator: string // "greater_than"
    value: number // 80
    duration?: number // Optional: sustained for N minutes
  }
  severity: 'info' | 'warning' | 'critical'
  enabled: boolean
  device_filter?: {
    device_ids?: string[] // Specific devices
    tags?: string[] // Devices with specific tags
    all_devices?: boolean // Apply to all devices
  }
  notification_channels: string[] // ['email', 'slack', 'sms']
  cooldown_period: number // Seconds before re-triggering
}
```

**Example Rules:**

```typescript
// Rule 1: Critical Temperature
{
  name: "Critical Temperature Threshold",
  condition: {
    metric: "temperature",
    operator: "greater_than",
    value: 85,
    duration: 5  // Sustained for 5 minutes
  },
  severity: "critical",
  device_filter: { all_devices: true }
}

// Rule 2: Low Battery Warning
{
  name: "Low Battery Alert",
  condition: {
    metric: "battery",
    operator: "less_than",
    value: 20
  },
  severity: "warning",
  device_filter: { tags: ["production"] }  // Only production devices
}

// Rule 3: Signal Quality
{
  name: "Poor Signal Strength",
  condition: {
    metric: "rssi",
    operator: "less_than",
    value: -80
  },
  severity: "info",
  device_filter: { device_ids: ["device-123", "device-456"] }
}
```

---

### Real-Time Alert Evaluation

**Implementation:** `supabase/functions/mqtt-listener/index.ts`

**When MQTT Message Arrives:**

```typescript
async function handleMqttMessage(
  topic,
  payload,
  config,
  integration,
  supabase
) {
  // 1. Parse telemetry from payload
  const parsed = parsePayload(payload, config.payload_parser)

  // 2. Record telemetry to database
  await supabase.rpc('record_device_telemetry', {
    p_device_id: deviceId,
    p_organization_id: integration.organization_id,
    p_telemetry: parsed.telemetry,
    p_device_timestamp: parsed.timestamp,
    p_activity_log_id: activityLogId,
    p_integration_id: integration.id,
  })

  // 3. ✅ CHECK ALERT RULES (Real-time evaluation)
  await checkTelemetryAlerts(
    deviceId,
    parsed.telemetry,
    integration.organization_id,
    supabase
  )
}
```

**Alert Rule Evaluation:**

```typescript
async function checkTelemetryAlerts(
  deviceId: string,
  telemetry: Record<string, unknown>,
  organizationId: string,
  supabase: any
) {
  // 1. Fetch active alert rules for this organization
  const { data: rules } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('enabled', true)
    .or(`device_id.eq.${deviceId},device_id.is.null`) // Device-specific or org-wide

  if (!rules || rules.length === 0) return

  // 2. Evaluate each rule against incoming telemetry
  for (const rule of rules) {
    const triggered = evaluateAlertRule(rule, telemetry)

    if (triggered) {
      // 3. Create alert instance
      await supabase.from('alerts').insert({
        organization_id: organizationId,
        device_id: deviceId,
        rule_id: rule.id,
        severity: rule.severity,
        title: rule.name,
        message: `Alert triggered: ${rule.condition.metric} ${rule.condition.operator} ${rule.condition.value}`,
        status: 'active',
        metadata: {
          telemetry,
          rule_condition: rule.condition,
          triggered_at: new Date().toISOString(),
        },
      })

      // 4. Trigger notifications (handled by separate notification service)
      // Notifications sent based on user preferences (see below)
    }
  }
}

function evaluateAlertRule(
  rule: any,
  telemetry: Record<string, unknown>
): boolean {
  const { metric, operator, value } = rule.condition
  const telemetryValue = telemetry[metric]

  if (telemetryValue === undefined) return false

  switch (operator) {
    case 'greater_than':
      return Number(telemetryValue) > value
    case 'less_than':
      return Number(telemetryValue) < value
    case 'equals':
      return telemetryValue === value
    case 'not_equals':
      return telemetryValue !== value
    default:
      return false
  }
}
```

---

### Scheduled Alert Evaluation (For Synced Integrations)

**When Sync Operations Complete (Golioth, AWS IoT, Azure IoT):**

```typescript
// After recording telemetry during sync:
public async import(): Promise<SyncResult> {
  for (const device of devices) {
    // 1. Record telemetry (already implemented)
    await this.recordTelemetry(localDeviceId, telemetry, timestamp)

    // 2. ✅ TRIGGER ALERT EVALUATION
    await this.evaluateAlertsForDevice(localDeviceId, telemetry)
  }
}

protected async evaluateAlertsForDevice(
  deviceId: string,
  telemetry: Record<string, unknown>
) {
  // Call edge function to evaluate alerts
  const { error } = await this.config.supabase.functions.invoke('evaluate-alerts', {
    body: {
      device_id: deviceId,
      organization_id: this.config.organizationId,
      telemetry
    }
  })

  if (error) {
    console.error('Alert evaluation failed:', error)
  }
}
```

**Benefit:** Alerts work for ALL integration types, not just MQTT!

---

### Alert Instances (User-Facing Alerts)

**Location:** `/dashboard/alerts`  
**Purpose:** View and manage active alerts  
**Database Table:** `alerts`

**Alert Instance Structure:**

```typescript
interface Alert {
  id: string
  organization_id: string
  device_id: string
  rule_id: string

  // Alert Details
  severity: 'info' | 'warning' | 'critical'
  title: string // "High Temperature Alert"
  message: string // "Temperature exceeded 85°C"
  category: string // "temperature", "battery", "connectivity"
  status: 'active' | 'acknowledged' | 'resolved'

  // Context
  metadata: {
    telemetry: Record<string, unknown> // Telemetry that triggered alert
    rule_condition: any // Rule condition that was violated
    triggered_at: string // ISO timestamp
  }

  // Resolution Tracking
  acknowledged_by?: string
  acknowledged_at?: string
  resolved_by?: string
  resolved_at?: string

  created_at: string
}
```

**UI Components:**

- `src/components/alerts/AlertsList.tsx` - Display active alerts
- `src/components/alerts/AlertCard.tsx` - Individual alert cards
- `src/app/dashboard/alerts/page.tsx` - Main alerts page

---

### User Notification Preferences (Personal Settings)

**Location:** `/dashboard/settings` > Preferences Tab  
**Purpose:** Control HOW users receive alert notifications  
**Database Table:** `user_notification_preferences`

**Preference Structure:**

```typescript
interface NotificationPreferences {
  user_id: string
  organization_id: string

  // Channel Toggles
  email_enabled: boolean
  sms_enabled: boolean
  push_enabled: boolean
  slack_enabled: boolean

  // Filtering
  minimum_severity: 'info' | 'warning' | 'critical' // Only notify for critical alerts

  // Quiet Hours
  quiet_hours_enabled: boolean
  quiet_hours_start: string // "22:00"
  quiet_hours_end: string // "07:00"
  quiet_hours_timezone: string

  // Weekend Muting
  mute_weekends: boolean
}
```

**Notification Decision Flow:**

```
Alert Created → Check User Preferences
  ↓
1. Is alert.severity >= user.minimum_severity?  ❌ → Don't send
  ↓ YES
2. Is current time in quiet hours?              ❌ → Don't send
  ↓ NO
3. Is it weekend AND mute_weekends = true?      ❌ → Don't send
  ↓ NO
4. Which channels are enabled?
   - Email enabled?   → Send email
   - SMS enabled?     → Send SMS
   - Push enabled?    → Send push notification
   - Slack enabled?   → Post to Slack
```

---

### Complete Alert Example

**Scenario:** Temperature sensor exceeds threshold

```
┌─────────────────────────────────────────────────────┐
│ 1. TELEMETRY DATA ARRIVES                           │
├─────────────────────────────────────────────────────┤
│  Device: sensor-123                                 │
│  Telemetry: { temperature: 92, humidity: 65 }       │
│  Source: Golioth Sync                               │
│  Timestamp: 2025-01-09 14:30:00                     │
└─────────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────┐
│ 2. STORED IN device_telemetry_history               │
├─────────────────────────────────────────────────────┤
│  id: telemetry-456                                  │
│  device_id: sensor-123                              │
│  integration_id: golioth-integration-789            │
│  telemetry: { temperature: 92, humidity: 65 }       │
└─────────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────┐
│ 3. ALERT RULE EVALUATION                            │
├─────────────────────────────────────────────────────┤
│  Rule: "High Temperature Alert"                     │
│  Condition: temperature > 85                        │
│  Current Value: 92                                  │
│  Result: ✅ TRIGGERED                               │
└─────────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────┐
│ 4. ALERT INSTANCE CREATED                           │
├─────────────────────────────────────────────────────┤
│  id: alert-999                                      │
│  severity: critical                                 │
│  title: "High Temperature Alert"                    │
│  message: "sensor-123 exceeded 85°C (current: 92)"  │
│  status: active                                     │
└─────────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────┐
│ 5. NOTIFICATIONS SENT                               │
├─────────────────────────────────────────────────────┤
│  User 1 (Admin):                                    │
│    ✅ Email: admin@company.com                      │
│    ✅ Push: Mobile app notification                 │
│    ❌ SMS: Disabled in preferences                  │
│                                                     │
│  User 2 (Operator):                                 │
│    ❌ No notifications (quiet hours: 10 PM - 7 AM)  │
│                                                     │
│  User 3 (Manager):                                  │
│    ❌ No notifications (min severity = critical,    │
│       this alert is "warning")                      │
└─────────────────────────────────────────────────────┘
```

---

## 📊 Part 2: Analytics Integration

### How Analytics Uses Telemetry

**Analytics Capabilities Enabled by Universal Telemetry:**

1. **Time-Series Charts** - Temperature/battery/signal trends over time
2. **Aggregated Metrics** - Average temperature per device, min/max battery
3. **Comparative Analysis** - Compare telemetry across devices or integrations
4. **Anomaly Detection** - Identify unusual patterns in telemetry data
5. **Health Scores** - Derive device health from telemetry metrics
6. **Predictive Maintenance** - Forecast battery replacement or failures

---

### Query Patterns for Analytics

#### 1. Temperature Trend Chart (Last 24 Hours)

**UI Component:** Device detail page, Analytics dashboard

```sql
-- Query telemetry from ALL integration sources
SELECT
  dth.device_timestamp AS time,
  (dth.telemetry->>'temperature')::numeric AS temperature,
  i.type AS source,
  i.name AS integration_name
FROM device_telemetry_history dth
JOIN device_integrations i ON i.id = dth.integration_id
WHERE dth.device_id = 'device-uuid'
  AND dth.telemetry ? 'temperature'  -- Has temperature field
  AND dth.device_timestamp > NOW() - INTERVAL '24 hours'
ORDER BY dth.device_timestamp ASC;
```

**Result:**

```
time                      | temperature | source   | integration_name
--------------------------|-------------|----------|------------------
2025-01-09 00:00:00+00    | 22.5        | mqtt     | Factory MQTT
2025-01-09 01:00:00+00    | 23.1        | golioth  | Golioth Devices
2025-01-09 02:00:00+00    | 22.8        | aws_iot  | AWS IoT Core
2025-01-09 03:00:00+00    | 24.2        | mqtt     | Factory MQTT
```

**Chart Rendering:**

```typescript
// Frontend code
const temperatureData = await fetchTelemetry(deviceId, 'temperature', '24h')

<LineChart
  data={temperatureData}
  xKey="time"
  yKey="temperature"
  colorKey="source"  // Different colors per integration
  title="Temperature (Last 24 Hours)"
  yAxisLabel="°C"
/>
```

---

#### 2. Battery Health Across All Devices

**UI Component:** Organization dashboard, Device list view

```sql
-- Get latest battery reading for each device
SELECT DISTINCT ON (dth.device_id)
  d.name AS device_name,
  (dth.telemetry->>'battery')::numeric AS battery_level,
  i.type AS source,
  dth.received_at,
  CASE
    WHEN (dth.telemetry->>'battery')::numeric < 20 THEN 'critical'
    WHEN (dth.telemetry->>'battery')::numeric < 50 THEN 'warning'
    ELSE 'healthy'
  END AS battery_status
FROM device_telemetry_history dth
JOIN devices d ON d.id = dth.device_id
JOIN device_integrations i ON i.id = dth.integration_id
WHERE dth.organization_id = 'org-uuid'
  AND dth.telemetry ? 'battery'
ORDER BY dth.device_id, dth.received_at DESC;
```

**Result:**

```
device_name    | battery_level | source   | battery_status
---------------|---------------|----------|----------------
Sensor A       | 87            | golioth  | healthy
Sensor B       | 45            | aws_iot  | warning
Sensor C       | 15            | mqtt     | critical
Gateway 1      | 92            | azure_iot| healthy
```

**UI Visualization:**

```typescript
<BatteryHealthOverview>
  <MetricCard
    title="Critical Battery"
    value={devicesWithCriticalBattery}
    icon={<BatteryLow className="text-red-500" />}
    trend="up"  // Number increasing (bad)
  />
  <MetricCard
    title="Healthy Devices"
    value={devicesWithHealthyBattery}
    icon={<BatteryFull className="text-green-500" />}
  />
</BatteryHealthOverview>
```

---

#### 3. Multi-Metric Dashboard (Real-time)

**UI Component:** Device detail page

```sql
-- Get latest telemetry across all metrics
SELECT
  dth.telemetry,
  dth.device_timestamp,
  i.type AS source
FROM device_telemetry_history dth
JOIN device_integrations i ON i.id = dth.integration_id
WHERE dth.device_id = 'device-uuid'
ORDER BY dth.received_at DESC
LIMIT 1;
```

**Result:**

```json
{
  "telemetry": {
    "temperature": 24.5,
    "humidity": 62.3,
    "battery": 87,
    "rssi": -45,
    "firmware_version": "2.3.1",
    "uptime": 86400
  },
  "device_timestamp": "2025-01-09T14:30:00Z",
  "source": "golioth"
}
```

**UI Rendering:**

```typescript
<DeviceMetrics>
  <MetricCard
    label="Temperature"
    value={telemetry.temperature}
    unit="°C"
    icon={<Thermometer />}
    trend={calculateTrend(deviceId, 'temperature', '1h')}
  />
  <MetricCard
    label="Battery"
    value={telemetry.battery}
    unit="%"
    icon={<Battery />}
    status={telemetry.battery < 20 ? 'critical' : 'healthy'}
  />
  <MetricCard
    label="Signal Strength"
    value={telemetry.rssi}
    unit="dBm"
    icon={<Wifi />}
  />
  <MetricCard
    label="Humidity"
    value={telemetry.humidity}
    unit="%"
    icon={<Droplet />}
  />
</DeviceMetrics>
```

---

#### 4. Integration Source Comparison

**UI Component:** Analytics page - Integration performance

```sql
-- Compare telemetry volume by integration type
SELECT
  i.type AS integration_type,
  i.name AS integration_name,
  COUNT(*) AS telemetry_points,
  COUNT(DISTINCT dth.device_id) AS devices,
  MIN(dth.received_at) AS first_data,
  MAX(dth.received_at) AS last_data
FROM device_telemetry_history dth
JOIN device_integrations i ON i.id = dth.integration_id
WHERE dth.organization_id = 'org-uuid'
  AND dth.received_at > NOW() - INTERVAL '24 hours'
GROUP BY i.type, i.name
ORDER BY telemetry_points DESC;
```

**Result:**

```
integration_type | integration_name  | telemetry_points | devices | first_data           | last_data
-----------------|-------------------|------------------|---------|----------------------|----------------------
mqtt             | Factory MQTT      | 86400            | 25      | 2025-01-08 14:30:00  | 2025-01-09 14:30:00
golioth          | Golioth Devices   | 2400             | 10      | 2025-01-08 14:30:00  | 2025-01-09 14:30:00
aws_iot          | AWS IoT Core      | 1200             | 5       | 2025-01-08 15:00:00  | 2025-01-09 14:15:00
azure_iot        | Azure Hub         | 600              | 3       | 2025-01-08 16:00:00  | 2025-01-09 13:45:00
```

**Chart:**

```typescript
<BarChart
  data={integrationStats}
  xKey="integration_name"
  yKey="telemetry_points"
  title="Telemetry Volume by Integration (Last 24h)"
  colorByIntegrationType
/>
```

---

#### 5. Aggregated Telemetry (Performance Optimization)

**For Large Datasets:** Pre-compute hourly/daily averages

```sql
-- Create materialized view for hourly aggregates
CREATE MATERIALIZED VIEW device_telemetry_hourly AS
SELECT
  device_id,
  date_trunc('hour', device_timestamp) AS hour,
  AVG((telemetry->>'temperature')::numeric) AS avg_temperature,
  AVG((telemetry->>'humidity')::numeric) AS avg_humidity,
  AVG((telemetry->>'battery')::numeric) AS avg_battery,
  MIN((telemetry->>'battery')::numeric) AS min_battery,
  MAX((telemetry->>'temperature')::numeric) AS max_temperature,
  COUNT(*) AS sample_count
FROM device_telemetry_history
WHERE telemetry ? 'temperature' OR telemetry ? 'battery'
GROUP BY device_id, date_trunc('hour', device_timestamp);

-- Refresh hourly via pg_cron
SELECT cron.schedule(
  'refresh-telemetry-aggregates',
  '5 * * * *',  -- Every hour at :05
  'REFRESH MATERIALIZED VIEW CONCURRENTLY device_telemetry_hourly'
);
```

**Query aggregates for fast chart rendering:**

```sql
SELECT
  hour,
  avg_temperature,
  min_battery,
  max_temperature
FROM device_telemetry_hourly
WHERE device_id = 'device-uuid'
  AND hour > NOW() - INTERVAL '7 days'
ORDER BY hour ASC;
```

---

### Analytics UI Components

**Locations:**

- `/dashboard/analytics` - Main analytics page
- `/dashboard/devices/[id]` - Device detail with telemetry charts
- `/dashboard/organizations` - Organization overview with aggregated metrics
- `/dashboard` - Main dashboard with key metrics

**Key Components:**

```
src/components/charts/
├── LineChart.tsx           # Time-series telemetry
├── AreaChart.tsx           # Multi-metric area charts
├── BarChart.tsx            # Comparison charts
├── DonutChart.tsx          # Distribution (battery status, etc.)
├── RealTimeChart.tsx       # Live telemetry updates
└── MetricCard.tsx          # Single metric display

src/components/analytics/
├── TelemetryChart.tsx      # Unified telemetry chart component
├── DeviceHealthScore.tsx   # Derived health metrics
├── ComparisonView.tsx      # Compare devices/integrations
└── ExportButton.tsx        # Export telemetry to CSV/Excel
```

---

### Real-Time Analytics (Supabase Realtime)

**Stream telemetry updates to UI:**

```typescript
// Frontend subscription
const telemetrySubscription = supabase
  .channel('device-telemetry')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'device_telemetry_history',
      filter: `device_id=eq.${deviceId}`,
    },
    (payload) => {
      const newTelemetry = payload.new

      // Update chart in real-time
      updateChart((prevData) => [
        ...prevData,
        {
          time: newTelemetry.device_timestamp,
          temperature: newTelemetry.telemetry.temperature,
          battery: newTelemetry.telemetry.battery,
        },
      ])

      // Update latest metrics
      setLatestMetrics(newTelemetry.telemetry)
    }
  )
  .subscribe()

// Cleanup on unmount
return () => {
  telemetrySubscription.unsubscribe()
}
```

**Benefit:** Charts update automatically as new telemetry arrives (MQTT, sync, etc.)

---

## 🔗 Integration Summary

### Before Universal Telemetry Recording

| Feature       | MQTT     | Golioth    | AWS IoT    | Azure IoT  | Impact                          |
| ------------- | -------- | ---------- | ---------- | ---------- | ------------------------------- |
| **Alerts**    | ✅ Works | ❌ No data | ❌ No data | ❌ No data | Alerts only work for MQTT       |
| **Charts**    | ✅ Works | ❌ No data | ❌ No data | ❌ No data | Empty charts for synced devices |
| **Analytics** | ✅ Works | ❌ No data | ❌ No data | ❌ No data | Incomplete organization metrics |
| **Trends**    | ✅ Works | ❌ No data | ❌ No data | ❌ No data | Can't analyze historical data   |

---

### After Universal Telemetry Recording

| Feature       | MQTT     | Golioth      | AWS IoT      | Azure IoT    | Impact                          |
| ------------- | -------- | ------------ | ------------ | ------------ | ------------------------------- |
| **Alerts**    | ✅ Works | ✅ **Works** | ✅ **Works** | ✅ **Works** | ✅ **Universal alerting**       |
| **Charts**    | ✅ Works | ✅ **Works** | ✅ **Works** | ✅ **Works** | ✅ **Complete visualizations**  |
| **Analytics** | ✅ Works | ✅ **Works** | ✅ **Works** | ✅ **Works** | ✅ **Accurate org metrics**     |
| **Trends**    | ✅ Works | ✅ **Works** | ✅ **Works** | ✅ **Works** | ✅ **Full historical analysis** |

---

## 🎯 Key Benefits

### 1. **Universal Alerting**

- Alert rule: "Battery < 20%" works for ANY device (MQTT, Golioth, AWS IoT, Azure IoT)
- No need to create separate rules per integration type
- Consistent alert evaluation logic

### 2. **Complete Analytics**

- Temperature charts show data from ALL integration sources
- Battery health dashboard includes ALL devices
- Organization-wide metrics are accurate

### 3. **Integration-Agnostic**

- Users don't care if data came from MQTT or Golioth
- Charts seamlessly combine data from multiple sources
- Same query patterns work for all integrations

### 4. **Real-Time + Historical**

- MQTT provides real-time telemetry stream
- Sync operations backfill historical telemetry
- Combined view gives complete picture

### 5. **Consistent UX**

- Same chart components work for all device types
- Same alert UI for all integration sources
- Same export/download functionality

---

## 🚀 Next Steps

### 1. Add Alert Evaluation to Sync Operations

**File:** `supabase/functions/_shared/base-integration-client.ts`

```typescript
// Add to base class
protected async evaluateAlertsForDevice(
  deviceId: string,
  telemetry: Record<string, unknown>
): Promise<void> {
  const { error } = await this.config.supabase.functions.invoke('evaluate-alerts', {
    body: {
      device_id: deviceId,
      organization_id: this.config.organizationId,
      telemetry
    }
  })

  if (error) {
    console.error('[Alert Evaluation] Failed:', error)
  }
}
```

**Call from sync operations:**

```typescript
// In golioth-client.ts, aws-iot-client.ts, azure-iot-client.ts
await this.recordTelemetry(deviceId, telemetry, timestamp)
await this.evaluateAlertsForDevice(deviceId, telemetry) // NEW
```

---

### 2. Create Analytics Edge Function

**File:** `supabase/functions/analytics/index.ts`

```typescript
serve(async (req) => {
  const { type, device_id, timeframe, metrics } = await req.json()

  switch (type) {
    case 'device-metrics':
      return getDeviceMetrics(device_id, timeframe, metrics)

    case 'organization-summary':
      return getOrganizationSummary(org_id, timeframe)

    case 'battery-health':
      return getBatteryHealthReport(org_id)

    case 'telemetry-export':
      return exportTelemetryCSV(device_id, timeframe)
  }
})
```

---

### 3. Enhance UI Components

**Add telemetry charts to device detail pages:**

```typescript
// src/app/dashboard/devices/[id]/page.tsx
<DeviceDetailPage deviceId={params.id}>
  <DeviceHeader device={device} />

  {/* NEW: Telemetry charts */}
  <TelemetryCharts deviceId={params.id}>
    <LineChart metric="temperature" timeframe="24h" />
    <LineChart metric="battery" timeframe="7d" />
    <LineChart metric="rssi" timeframe="24h" />
  </TelemetryCharts>

  <MetricsGrid>
    <MetricCard label="Temperature" value={latest.temperature} />
    <MetricCard label="Battery" value={latest.battery} />
    <MetricCard label="Signal" value={latest.rssi} />
  </MetricsGrid>
</DeviceDetailPage>
```

---

## 📚 Documentation References

- **Telemetry Architecture:** `TELEMETRY_UNIVERSAL_RECORDING.md`
- **Alert System:** `docs/archive/ALERT_NOTIFICATION_IMPLEMENTATION.md`
- **MQTT Pipeline:** `MQTT_DATA_ARCHITECTURE.md`
- **Gap Resolution:** `TELEMETRY_GAP_RESOLVED.md`

---

## ✅ Summary

The universal telemetry recording system provides the **critical data foundation** that enables:

1. **Alerts** - Rule-based monitoring with real-time evaluation
2. **Analytics** - Time-series charts and aggregated metrics
3. **Integration-Agnostic** - Works across MQTT, Golioth, AWS IoT, Azure IoT
4. **Real-Time + Historical** - Combines live streams with synced data
5. **Consistent UX** - Same components, queries, and APIs for all integrations

By ensuring ALL integrations record telemetry consistently, we unlock powerful monitoring, visualization, and analysis capabilities across the entire platform.
