# MQTT Integration Architecture

**Date**: February 19, 2026  
**Status**: ✅ Production-Ready  
**Related Story**: #97 - MQTT Broker Integration Verification

## Executive Summary

NetNeural's MQTT integration provides device communication via industry-standard MQTT protocol. The architecture is designed around **stateless Edge Functions** (Supabase/Deno runtime) and **async queue processing** (PGMQ), with support for both external customer brokers and HTTP ingestion paths.

### Key Capabilities
- ✅ Publish to external MQTT brokers (Mosquitto, HiveMQ, AWS IoT, etc.)
- ✅ Subscribe to topics (store subscriptions in database)
- ✅ HTTP ingestion with queue-based processing (PGMQ)
- ✅ Telemetry query from `mqtt_messages` table
- ✅ Activity logging and credential management
- ⚠️ Persistent connections not supported (Edge Functions are stateless)

---

## Architecture Decision Record (ADR)

### Context
MQTT is traditionally a persistent protocol - clients maintain long-lived TCP connections to brokers, subscribing to topics and receiving messages in real-time via push notifications. However, Supabase Edge Functions are **stateless** and **short-lived** (max 30 seconds execution time), which creates architectural constraints.

### Decision
We implemented a **hybrid architecture** with two complementary paths:

1. **Stateless MQTT Operations** (`mqtt-hybrid` Edge Function)
   - Uses `npm:mqtt@5.3.4` for real MQTT protocol support
   - Supports publish, one-time subscribe (store subscriptions), test connection
   - Per-request connections (connect → operation → disconnect)
   - Suitable for: Sending commands, testing connections, managing subscriptions

2. **HTTP Ingestion with Queue Processing** (`mqtt-ingest` Edge Function + PGMQ)
   - Devices POST messages to HTTP endpoint
   - Messages queued in PostgreSQL via PGMQ
   - Async processing via database functions
   - Suitable for: Device telemetry ingestion, high-volume data

### Rationale
**Why not persistent connections?**
- Edge Functions cannot maintain long-lived TCP connections
- Functions auto-sleep after 30 seconds of inactivity
- No persistent process/container to hold MQTT subscriptions

**Why HTTP ingestion instead?**
- PostgreSQL-native message queue (PGMQ) is reliable and scalable
- Leverages Supabase's existing infrastructure
- Simpler operational model (no external MQTT broker management)
- Better for serverless/stateless architecture

**Why keep mqtt-hybrid?**
- Customers may have existing MQTT brokers
- Standard protocol compatibility
- Testing and integration validation
- Bridge to external systems

### Consequences
**Positive:**
- Simpler infrastructure (no separate MQTT broker to manage for hosted path)
- PostgreSQL-based queuing is ACID-compliant and transactional
- Scales automatically with Supabase
- Activity logging and credential management built-in

**Negative:**
- Cannot receive real-time MQTT push notifications
- Devices using traditional MQTT must adapt to HTTP POST or use external broker
- Two ingestion paths to maintain (MQTT + HTTP)

**Neutral:**
- Different mental model than traditional MQTT (push → pull)
- Requires customer education on architecture

---

## System Components

### 1. Edge Functions (Deno Runtime)

#### `mqtt-hybrid` (Production) ✅
**Location**: `supabase/functions/mqtt-hybrid/index.ts` (439 lines)  
**Purpose**: Real MQTT protocol operations via stateless connections

**Endpoints:**
- `POST /mqtt-hybrid/publish` - Publish messages to broker
- `POST /mqtt-hybrid/subscribe` - Store topic subscriptions
- `POST /mqtt-hybrid/test` - Test broker connection
- `POST /mqtt-hybrid/credentials` - Generate/get/revoke MQTT credentials

**Features:**
- npm:mqtt@5.3.4 library (full MQTT 3.1.1 support)
- Supports external brokers (mqtt:// and mqtts:// protocols)
- Per-request connections (stateless pattern)
- Activity logging to `integration_activity_log`
- Credential management via `mqtt_credentials` table
- TLS support (configurable rejectUnauthorized)

**Configuration** (in `device_integrations.settings`):
```json
{
  "broker_url": "broker.example.com",
  "port": 1883,
  "protocol": "mqtt",
  "username": "optional",
  "password": "optional",
  "use_tls": false
}
```

#### `mqtt-ingest` (Production) ✅
**Location**: `supabase/functions/mqtt-ingest/index.ts` (190 lines)  
**Purpose**: HTTP POST ingestion with PGMQ queue

**Endpoints:**
- `POST /mqtt-ingest` - Ingest MQTT-style messages via HTTP

**Features:**
- Verifies credentials from `mqtt_credentials` table
- Enforces topic prefix authorization
- Enqueues to PGMQ (`mqtt_messages` queue)
- Async processing via `process_mqtt_queue_message()` function
- Updates connection stats in `mqtt_credentials`

**HTTP Request Format:**
```http
POST /functions/v1/mqtt-ingest
Authorization: Bearer {password}
X-Client-ID: {client_id}
X-Username: {username}
Content-Type: application/json

{
  "topic": "org_xxx/devices/sensor01/telemetry",
  "payload": {
    "temperature": 23.5,
    "humidity": 65.2
  },
  "qos": 0,
  "retain": false
}
```

#### Archived Functions ⚠️
**Location**: `supabase/functions/_archive/`

- `mqtt-broker` (474 lines) - HTTP-based placeholder, superseded by mqtt-hybrid
- `mqtt-listener` (519 lines) - Persistent connection design, not possible in Edge Functions

See `_archive/README.md` for restoration instructions.

---

### 2. Database Schema

#### `device_integrations` table
Stores integration configuration.

**Relevant Fields:**
```sql
integration_type TEXT  -- 'mqtt', 'mqtt_hosted', 'mqtt_external'
settings JSONB         -- broker_url, port, protocol, username, password, use_tls
status TEXT            -- 'active', 'inactive', 'error'
```

#### `mqtt_credentials` table
Generated credentials for MQTT authentication.

**Schema:**
```sql
CREATE TABLE mqtt_credentials (
  id UUID PRIMARY KEY,
  integration_id UUID REFERENCES device_integrations(id),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  client_id TEXT NOT NULL,
  broker_url TEXT NOT NULL,
  topic_prefix TEXT NOT NULL,
  last_connected_at TIMESTAMPTZ,
  connection_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Generation:** Via `generate_mqtt_credentials` RPC function

#### `mqtt_subscriptions` table
Stores topic subscriptions for integrations.

**Schema:**
```sql
CREATE TABLE mqtt_subscriptions (
  id UUID PRIMARY KEY,
  integration_id UUID REFERENCES device_integrations(id),
  organization_id UUID REFERENCES organizations(id),
  topic TEXT NOT NULL,
  qos INTEGER DEFAULT 0,
  callback_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `mqtt_messages` table
Stores received MQTT messages (historical record).

**Schema:**
```sql
CREATE TABLE mqtt_messages (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  integration_id UUID REFERENCES device_integrations(id),
  topic TEXT NOT NULL,
  payload JSONB NOT NULL,
  qos INTEGER DEFAULT 0,
  direction TEXT CHECK (direction IN ('incoming', 'outgoing')),
  received_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Indexes:**
- `idx_mqtt_messages_integration` on integration_id
- `idx_mqtt_messages_received` on received_at DESC (for queries)

#### `mqtt_message_queue` table
PGMQ message queue for async processing.

**Schema:**
```sql
CREATE TABLE mqtt_message_queue (
  id UUID PRIMARY KEY,
  organization_id UUID,
  integration_id UUID,
  topic TEXT NOT NULL,
  payload JSONB NOT NULL,
  qos INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  error_message TEXT
);
```

**Processing Function:** `process_mqtt_queue_message(p_message_id UUID)`

---

### 3. Client-Side Integration Provider

#### `MqttIntegrationProvider` class
**Location**: `src/lib/integrations/mqtt-integration-provider.ts` (474 lines)

**Implements DeviceIntegrationProvider interface:**
```typescript
class MqttIntegrationProvider extends DeviceIntegrationProvider {
  // Device operations
  async listDevices(options?: PaginationOptions): Promise<DeviceListResult>
  async getDevice(deviceId: string): Promise<DeviceData | null>
  async syncDevice(device: DeviceUpdate): Promise<void>
  
  // MQTT-specific operations
  async publishMessage(topic: string, payload: unknown, options?: MqttPublishOptions): Promise<void>
  async subscribeToTopic(topic: string, qos?: 0 | 1 | 2): Promise<void>
  async testConnection(): Promise<TestConnectionResult>
  
  // Telemetry (NEW!)
  async queryTelemetry(): Promise<TelemetryData[]>  // Queries mqtt_messages table
  
  // Capabilities
  getCapabilities(): ProviderCapabilities
}
```

**Capabilities:**
```typescript
{
  supportsRealTimeStatus: true,  // Via subscriptions
  supportsTelemetry: true,       // Via mqtt_messages table (last 100)
  supportsFirmwareManagement: false,
  supportsRemoteCommands: true,  // Via command topics
  supportsBidirectionalSync: false
}
```

---

## Data Flow

### Outbound: Publish to External Broker

```
Frontend/API
    ↓
MqttIntegrationProvider.publishMessage()
    ↓
POST /functions/v1/mqtt-hybrid/publish
    ↓
mqtt.connect() → mqtt.publish() → mqtt.end()
    ↓
External MQTT Broker
    ↓
Activity logged to integration_activity_log
```

### Inbound: HTTP Ingestion (Recommended)

```
Device (HTTP POST)
    ↓
POST /functions/v1/mqtt-ingest
    ↓
Verify credentials (mqtt_credentials table)
    ↓
Enqueue to PGMQ (mqtt_message_queue)
    ↓
Async: process_mqtt_queue_message()
    ↓
Store in mqtt_messages table
    ↓
Update devices.last_data
    ↓
Log to integration_activity_log
```

### Telemetry Query

```
Frontend Dashboard
    ↓
MqttIntegrationProvider.queryTelemetry()
    ↓
Query mqtt_messages table (last 100)
    ↓
Filter for /telemetry, /data, /sensor topics
    ↓
Parse payload (extract deviceId, metrics, timestamp)
    ↓
Return TelemetryData[]
```

---

## Topic Structure

### Standard Convention (Configurable)

```
{organization_prefix}/devices/{device_id}/{message_type}

Examples:
- org_netneural/devices/sensor01/telemetry
- org_netneural/devices/gateway42/status
- org_netneural/devices/actuator99/commands
```

### Topic Authorization
- Enforced via `mqtt_credentials.topic_prefix`
- Prefix verified in `mqtt-ingest` function
- Prevents cross-organization topic access

---

## Security

### Credential Generation
- Generated via `generate_mqtt_credentials` RPC
- Unique username per integration
- Password: 32-character secure random
- Optional expiration (`expires_at`)

### API Key Encryption
- **NEW**: pgsodium AEAD deterministic encryption (Story #96)
- Stored encrypted in `device_integrations.settings`
- Decrypted on-demand in Edge Functions

### Row-Level Security (RLS)
- All tables enforce RLS policies
- Organization members see only their org's data
- Service role bypasses RLS (Edge Functions)

### TLS Support
- Optional TLS for external brokers (`use_tls: true`)
- Supports mqtts:// protocol (port 8883)
- Configurable certificate validation

---

## Operational Considerations

### Monitoring
- Activity logged to `integration_activity_log` table
- Queue stats via `get_mqtt_queue_stats(org_id)` function
- Connection tracking in `mqtt_credentials` (last_connected_at, connection_count)

### Queue Management
- Automatic retries (3 attempts, exponential backoff)
- Failed messages retained for 30 days
- Completed messages cleaned up after 7 days via `cleanup_mqtt_queue()`
- Consider: pg_cron for periodic cleanup

### Scalability
- PGMQ scales with PostgreSQL (proven to millions of messages/day)
- Edge Functions auto-scale with Supabase
- Connection pooling managed by Supabase
- Consider: Partition mqtt_messages by created_at for large volumes

### Limitations
- **No persistent subscriptions** (Edge Functions constraint)
- **No real-time push** (devices must HTTP POST or use external broker)
- **30-second function timeout** (affects large bulk publishes)
- **Connection overhead** (each operation creates new MQTT connection)

---

## Migration from Traditional MQTT

### For Devices
**Before** (traditional MQTT):
```python
import paho.mqtt.client as mqtt

client = mqtt.Client()
client.connect("broker.example.com", 1883)
client.loop_start()

def on_message(client, userdata, message):
    print(f"Received: {message.payload}")

client.subscribe("devices/sensor01/commands")
client.publish("devices/sensor01/telemetry", payload)
client.loop_forever()
```

**After** (NetNeural HTTP ingestion):
```python
import requests

def send_telemetry(topic, payload):
    response = requests.post(
        "https://your-project.supabase.co/functions/v1/mqtt-ingest",
        headers={
            "Authorization": f"Bearer {password}",
            "X-Client-ID": client_id,
            "X-Username": username,
        },
        json={
            "topic": topic,
            "payload": payload,
            "qos": 0
        }
    )
    return response.status_code == 202

send_telemetry("org_netneural/devices/sensor01/telemetry", {
    "temperature": 23.5,
    "humidity": 65.2
})
```

**Alternative** (use customer's existing broker):
- Keep device code unchanged
- Configure `mqtt-hybrid` with customer's broker URL
- NetNeural publishes commands via mqtt-hybrid
- Devices receive via their MQTT subscription (outside NetNeural)

---

## Testing

### Manual Testing
```bash
# Test connection to external broker
curl -X POST https://your-project.supabase.co/functions/v1/mqtt-hybrid/test \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "integration_id": "xxx-xxx-xxx",
    "organization_id": "yyy-yyy-yyy"
  }'

# Publish message
curl -X POST https://your-project.supabase.co/functions/v1/mqtt-hybrid/publish \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "integration_id": "xxx-xxx-xxx",
    "organization_id": "yyy-yyy-yyy",
    "messages": [
      {
        "topic": "test/topic",
        "payload": {"test": true},
        "qos": 0
      }
    ]
  }'

# HTTP ingestion
curl -X POST https://your-project.supabase.co/functions/v1/mqtt-ingest \
  -H "Authorization: Bearer $PASSWORD" \
  -H "X-Client-ID: $CLIENT_ID" \
  -H "X-Username: $USERNAME" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "org_netneural/devices/sensor01/telemetry",
    "payload": {"temperature": 23.5}
  }'
```

### Automated Testing Script
**Location**: `scripts/test-mqtt-broker.js`

```bash
cd development
SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/test-mqtt-broker.js
```

---

## Future Enhancements

### Near-Term (Next Quarter)
- [ ] Extract payload parsers from archived mqtt-listener as library
- [ ] Add MQTT message visualization in dashboard
- [ ] Implement topic pattern matching (wildcards: +, #)
- [ ] Add QoS 1/2 support in mqtt-hybrid

### Long-Term (12+ months)
- [ ] External MQTT bridge service for persistent subscriptions (separate from Edge Functions)
- [ ] WebSocket streaming for real-time telemetry (alternative to MQTT)
- [ ] MQTT v5 support when npm:mqtt adds it
- [ ] Custom payload transformation rules

---

## References

- **MQTT Specification**: [MQTT v3.1.1](https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/mqtt-v3.1.1.html)
- **npm:mqtt Library**: [npmjs.com/package/mqtt](https://www.npmjs.com/package/mqtt)
- **Supabase Edge Functions**: [supabase.com/docs/guides/functions](https://supabase.com/docs/guides/functions)
- **PGMQ**: [github.com/tembo-io/pgmq](https://github.com/tembo-io/pgmq)

---

## Changelog

- **2026-02-19**: Initial architecture document created (Story #97)
  - Documented stateless Edge Function design
  - Archived deprecated mqtt-broker and mqtt-listener functions
  - Implemented queryTelemetry() for MqttIntegrationProvider
  - Tested mqtt-hybrid with external broker (test.mosquitto.org)

---

**Maintained by**: NetNeural Platform Team  
**Last Updated**: February 19, 2026  
**Status**: ✅ Production-Ready
