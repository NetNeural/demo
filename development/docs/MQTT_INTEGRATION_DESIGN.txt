# MQTT Integration - Implementation Design

## Current State
- ❌ `mqtt-broker` Edge Function uses fetch() (doesn't work with real MQTT)
- ❌ No actual MQTT broker deployed
- ✅ Database schema supports MQTT integrations
- ✅ UI has MQTT integration type

## Problem
Edge Functions (Deno) don't support native MQTT client libraries that require persistent TCP connections.

## Solution Options

### Option 1: MQTT-over-WebSocket (Recommended for MVP)
**Pros:**
- Works in Edge Functions (WebSocket supported)
- No separate infrastructure
- Real-time bidirectional communication

**Cons:**
- Requires broker to support WebSocket (most modern brokers do)
- Slightly higher overhead than native MQTT

**Implementation:**
```typescript
// Use mqtt.js with WebSocket transport
import mqtt from 'npm:mqtt@5.3.4'

const client = mqtt.connect('ws://broker.example.com:9001', {
  username: config.username,
  password: config.password
})

client.on('connect', () => {
  client.publish('devices/123/telemetry', JSON.stringify(data))
})
```

**Broker Support:**
- Mosquitto: WebSocket on port 9001
- EMQX: WebSocket on port 8083
- HiveMQ: WebSocket on port 8000

### Option 2: MQTT Bridge Service (Production-Ready)
**Architecture:**
```
IoT Devices
  ↓ MQTT (TCP 1883)
MQTT Broker (Mosquitto/EMQX container)
  ↓ Bridge/Webhook
Edge Function (mqtt-listener)
  ↓ Store in DB
PostgreSQL
```

**Components:**
1. **MQTT Broker Container** (Mosquitto)
   - Ports: 1883 (MQTT), 8883 (MQTTS), 9001 (WebSocket)
   - Docker Compose deployment
   - Per-org auth via ACL file

2. **Bridge Configuration**
   - Mosquitto bridge to webhook
   - Or use EMQX webhook plugin
   - POST to Edge Function on message receipt

3. **Edge Function Handler**
   - Receives webhook from broker
   - Validates, processes, stores telemetry
   - Triggers alerts if needed

**Pros:**
- Full MQTT protocol support (QoS, retained, LWT)
- Handles 1000+ concurrent connections
- Standard IoT architecture
- Can offer hosted solution

**Cons:**
- Requires deploying broker infrastructure
- More complex to manage
- Additional hosting costs

### Option 3: Hybrid Approach (Best of Both)
**For Hosted NetNeural Broker:**
- Deploy MQTT broker with WebSocket support
- Edge Functions connect via WebSocket
- Offer as managed service

**For Customer Brokers:**
- Customer provides webhook endpoint
- Their broker POSTs to your Edge Function
- No persistent connection needed

## Recommended Implementation

### Phase 1: Customer Broker Support (Quick Win)
**Timeline:** 1-2 days

1. **Update mqtt-broker Edge Function:**
   - Accept webhook POSTs from customer brokers
   - Validate MQTT payload structure
   - Store telemetry in database
   - Trigger device updates/alerts

2. **Update device_integrations config:**
   ```json
   {
     "type": "mqtt-external",
     "webhook_url": "https://your-project.supabase.co/functions/v1/mqtt-listener",
     "expected_topics": ["devices/+/telemetry", "devices/+/status"]
   }
   ```

3. **Documentation:**
   - Guide for configuring customer MQTT broker
   - Example Mosquitto bridge config
   - Example EMQX webhook config

### Phase 2: WebSocket MQTT Client (2-3 days)
**For bidirectional communication (send commands to devices):**

1. **Install mqtt.js in Edge Function:**
   ```typescript
   import mqtt from 'npm:mqtt@5.3.4'
   ```

2. **Connection management:**
   - Connect on-demand when publishing
   - Close after operation
   - Handle reconnection logic

3. **Publish commands:**
   - `POST /functions/v1/mqtt-broker` with command
   - Function connects via WebSocket
   - Publishes to device topic
   - Returns confirmation

### Phase 3: Hosted NetNeural Broker (1-2 weeks)
**Full managed MQTT service:**

1. **Deploy MQTT Broker:**
   - Mosquitto or EMQX container
   - Fly.io or AWS ECS
   - WebSocket + TCP ports

2. **Per-Org Credentials:**
   - Generate username/password per org
   - ACL rules: `org_{id}/devices/#`
   - Store in `mqtt_credentials` table

3. **UI Updates:**
   - Show connection details
   - Toggle "Use NetNeural Broker" vs "Use My Broker"
   - Display credentials securely

4. **Bridge to Database:**
   - Broker webhooks → Edge Function
   - Real-time telemetry ingestion
   - pgmq for async processing

## Immediate Next Steps

**To make current MQTT work:**

1. **Choose approach:**
   - Quick: Accept webhooks from customer brokers
   - Better: Add WebSocket MQTT client
   - Best: Deploy full hosted broker

2. **Update mqtt-broker function:**
   - Replace fetch() implementation
   - Add proper MQTT client (WebSocket or webhook receiver)

3. **Test with real broker:**
   - Spin up local Mosquitto
   - Configure WebSocket listener
   - Test publish/subscribe

4. **Update UI:**
   - Add broker connection instructions
   - Show webhook URL for customer setup
   - Test end-to-end flow

## Questions to Answer

1. **Do you want to offer hosted MQTT broker?**
   - Yes → Proceed with Phase 3 planning
   - No → Focus on customer broker integration (Phase 1)

2. **Do you need to send commands TO devices?**
   - Yes → Need WebSocket client (Phase 2)
   - No → Webhook receiver is sufficient (Phase 1)

3. **Expected device volume?**
   - <100 devices → WebSocket approach fine
   - >100 devices → Consider dedicated broker

4. **Timeline priority?**
   - MVP fast → Webhook receiver (Phase 1)
   - Production-ready → All phases

## Code Changes Needed

### 1. Fix mqtt-broker/index.ts
Replace fetch()-based implementation with one of:
- WebSocket MQTT client (mqtt.js)
- Webhook receiver endpoint
- Both (hybrid)

### 2. Add mqtt-listener/index.ts improvements
Handle incoming telemetry from broker webhooks

### 3. Database migration
```sql
CREATE TABLE mqtt_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  topic_prefix TEXT NOT NULL, -- org_{id}/devices/#
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4. UI Components
- MQTT connection info display
- Credential management
- Test connection button

## Success Criteria

✅ Customer can configure their MQTT broker to send to NetNeural
✅ Telemetry flows from MQTT → Database → UI
✅ Commands can be sent Device ← Database ← UI
✅ Connection status visible in dashboard
✅ Error handling and retry logic
✅ Documentation for setup

---

**Next Action Required:**
Choose implementation approach (Phase 1, 2, or 3) based on timeline and requirements.
