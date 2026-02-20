# Changelog

All notable changes to the MQTT Subscriber Service will be documented in this file.

## [1.0.0] - 2026-02-20

### Added
- Initial release of persistent MQTT subscriber service
- Multi-broker MQTT connection support
- Auto-reconnection with exponential backoff
- Message processing and telemetry extraction
- Integration activity logging
- Supabase database integration
- Docker and Docker Compose deployment
- Graceful shutdown handling
- Structured logging with Pino
- TypeScript implementation
- Management scripts (start.sh, stop.sh, status.sh, logs.sh)
- Comprehensive README documentation
- Setup verification script

### Features
- Connects to multiple MQTT integrations simultaneously
- Subscribes to configured topics per integration
- Parses device telemetry from MQTT messages
- Stores telemetry in `sensor_telemetry_data` table
- Logs all activity in `integration_activity_log` table
- Auto-refreshes integration list every 5 minutes
- Supports MQTT v3.1.1 and v5.0
- Supports both TLS (mqtts://) and plain MQTT

### Technical Details
- Node.js 20+ runtime
- TypeScript for type safety
- mqtt.js v5.3.4 for MQTT protocol
- @supabase/supabase-js for database access
- Pino for structured logging
- Docker containerization
- Environment-based configuration

### Dependencies
```json
{
  "mqtt": "^5.3.4",
  "@supabase/supabase-js": "^2.39.0",
  "dotenv": "^16.3.1",
  "pino": "^8.16.2",
  "pino-pretty": "^10.2.3"
}
```

### Deployment Options
1. Docker Compose (recommended for production)
2. Systemd service (Linux servers)
3. PM2 process manager (development/staging)
4. Kubernetes (enterprise deployments)

### Architecture
Complements existing Supabase Edge Functions:
- `mqtt-ingest` - HTTP POST ingestion for push-based scenarios
- `mqtt-hybrid` - Stateless MQTT operations
- **mqtt-subscriber** (this service) - Persistent MQTT subscriptions

### Known Limitations
- Requires external hosting (cannot run in Supabase Edge Functions due to stateless nature)
- Service role key required (RLS bypass for writing to all organizations)
- Memory usage scales with number of integrations and message volume

### Future Enhancements
- Kubernetes deployment manifests
- Prometheus metrics export
- Health check endpoint
- Message buffering for offline scenarios
- Custom payload parser plugins
- MQTT v5.0 advanced features (shared subscriptions, topic aliases)
