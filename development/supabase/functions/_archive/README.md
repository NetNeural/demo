# Archived Edge Functions

This directory contains deprecated or superseded Edge Functions that are kept for reference but not deployed.

## Archived Functions

### mqtt-broker (Archived: 2026-02-19)

**Reason**: HTTP-based MQTT bridge placeholder, superseded by mqtt-hybrid which uses real MQTT library.

**Original Purpose**: Provide MQTT functionality via HTTP fetch() calls while waiting for proper MQTT client library support in Deno.

**Replacement**: Use `mqtt-hybrid` which implements real MQTT protocol via npm:mqtt@5.3.4.

### mqtt-listener (Archived: 2026-02-19)

**Reason**: Designed for persistent MQTT connections, which are not possible in stateless Supabase Edge Functions.

**Original Purpose**: Maintain persistent MQTT connection to broker, subscribe to topics, process incoming messages in real-time.

**Issue**: Edge Functions are stateless and short-lived (max 30 seconds). Cannot maintain persistent TCP connections needed for MQTT subscriptions.

**Valuable Components**:

- Payload parsers (standard, VMark, custom) - could be extracted as library
- Message processing logic - pattern for async message handling

**Alternatives**:

- `mqtt-hybrid` for stateless MQTT operations (publish, one-time subscribe)
- `mqtt-ingest` for HTTP POST ingestion with PGMQ queue processing
- External service (e.g., AWS IoT Rules, MQTT bridge) for persistent subscriptions

## Restoration

If you need to restore or reference these functions:

```bash
# Copy archived function back to functions directory
cp -r _archive/mqtt-broker ../mqtt-broker

# Deploy restored function
npx supabase functions deploy mqtt-broker
```

## Cleanup

Archived functions can be permanently deleted after 90 days if no issues are reported.

**Archive Date**: February 19, 2026
**Scheduled Deletion**: May 20, 2026 (unless referenced)
