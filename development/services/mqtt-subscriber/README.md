# NetNeural MQTT Subscriber Service

Persistent MQTT client service that subscribes to configured MQTT brokers and forwards telemetry data to your Supabase database.

## Features

- ✅ **Persistent Connections** - Maintains long-lived MQTT connections
- ✅ **Multi-Broker Support** - Connects to multiple MQTT integrations simultaneously
- ✅ **Auto-Reconnect** - Automatically reconnects on connection loss
- ✅ **Telemetry Processing** - Parses and stores device telemetry data
- ✅ **Activity Logging** - Logs all MQTT events to `integration_activity_log`
- ✅ **Graceful Shutdown** - Handles SIGTERM/SIGINT for clean restarts
- ✅ **Docker Ready** - Containerized deployment with Docker Compose

## Architecture

```
MQTT Brokers → MQTT Subscriber Service → Supabase PostgreSQL
                      ↓
              - Parses messages
              - Extracts telemetry
              - Logs activity
              - Stores in DB
```

## Prerequisites

- Node.js 20+ (for local development)
- Docker & Docker Compose (for containerized deployment)
- Supabase project with MQTT integrations configured

## Quick Start

### 1. Configuration

Copy the example environment file:

```bash
cd services/mqtt-subscriber
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
LOG_LEVEL=info
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Locally (Development)

```bash
# With auto-reload
npm run dev

# Or build and run
npm run build
npm start
```

### 4. Deploy with Docker (Production)

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f mqtt-subscriber

# Stop
docker-compose down
```

## Service Management

### Docker Commands

```bash
# Start service
docker-compose up -d

# Stop service
docker-compose down

# Restart service
docker-compose restart mqtt-subscriber

# View logs (live)
docker-compose logs -f mqtt-subscriber

# View recent logs
docker-compose logs --tail=100 mqtt-subscriber

# Check status
docker-compose ps
```

### Monitoring

The service logs all activity with structured logging:

```bash
# Watch logs in real-time
docker-compose logs -f mqtt-subscriber

# Check for errors
docker-compose logs mqtt-subscriber | grep ERROR

# Check connection status
docker-compose logs mqtt-subscriber | grep "Connected to"
```

## How It Works

### 1. Service Startup

On startup, the service:

1. Connects to Supabase
2. Queries `device_integrations` table for active MQTT integrations
3. Connects to each MQTT broker
4. Subscribes to configured topics
5. Refreshes integration list every 5 minutes

### 2. Message Processing

When a message arrives:

1. Extract device ID from topic (e.g., `devices/DEV-001/telemetry` → `DEV-001`)
2. Parse JSON payload
3. Extract telemetry fields (temperature, humidity, battery, etc.)
4. Store in `sensor_telemetry_data` table
5. Log activity in `integration_activity_log`

### 3. Auto-Reconnect

If connection is lost:

- Automatically retries with exponential backoff
- Max 10 reconnect attempts (configurable)
- Logs all reconnection attempts

## Configuration Reference

### Environment Variables

| Variable                    | Required | Default | Description                                 |
| --------------------------- | -------- | ------- | ------------------------------------------- |
| `SUPABASE_URL`              | ✅ Yes   | -       | Your Supabase project URL                   |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes   | -       | Service role key (has RLS bypass)           |
| `LOG_LEVEL`                 | No       | `info`  | Log level: `debug`, `info`, `warn`, `error` |
| `MAX_RECONNECT_ATTEMPTS`    | No       | `10`    | Max reconnection attempts before giving up  |
| `RECONNECT_INTERVAL`        | No       | `5000`  | Base reconnect interval in milliseconds     |

### Database Schema

The service expects these tables to exist:

```sql
-- MQTT integrations
device_integrations (
  id uuid,
  organization_id uuid,
  integration_type text, -- 'mqtt', 'mqtt_hosted', 'mqtt_external'
  status text, -- 'active', 'inactive'
  settings jsonb -- { brokerUrl, port, username, password, topics, ... }
)

-- Activity logging
integration_activity_log (
  id uuid,
  integration_id uuid,
  direction text, -- 'incoming', 'outgoing'
  activity_type text, -- 'telemetry', 'status_update', 'discovery'
  status text, -- 'success', 'failed'
  metadata jsonb
)

-- Telemetry storage
sensor_telemetry_data (
  id uuid,
  device_id uuid,
  organization_id uuid,
  timestamp timestamptz,
  data jsonb
)
```

## Deployment Options

### Option A: Docker Compose (Recommended)

Best for production deployments:

```bash
cd services/mqtt-subscriber
docker-compose up -d
```

### Option B: Systemd Service (Linux)

Create `/etc/systemd/system/mqtt-subscriber.service`:

```ini
[Unit]
Description=NetNeural MQTT Subscriber Service
After=network.target

[Service]
Type=simple
User=netneural
WorkingDirectory=/opt/netneural/mqtt-subscriber
ExecStart=/usr/bin/node /opt/netneural/mqtt-subscriber/dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
EnvironmentFile=/opt/netneural/mqtt-subscriber/.env

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable mqtt-subscriber
sudo systemctl start mqtt-subscriber
sudo systemctl status mqtt-subscriber
```

### Option C: PM2 Process Manager

```bash
npm install -g pm2
cd services/mqtt-subscriber

# Build
npm run build

# Start with PM2
pm2 start dist/index.js --name mqtt-subscriber

# Auto-start on boot
pm2 startup
pm2 save
```

### Option D: Kubernetes

See `k8s/` directory for deployment manifests (coming soon).

## Troubleshooting

### Service Won't Start

**Check logs:**

```bash
docker-compose logs mqtt-subscriber
```

**Common issues:**

- Missing environment variables → Check `.env` file
- Invalid Supabase credentials → Verify `SUPABASE_SERVICE_ROLE_KEY`
- No MQTT integrations found → Check database for active integrations

### Connection Timeouts

If you see `ECONNREFUSED` or timeouts:

1. **Check broker URL:** Ensure broker is accessible from service
2. **Network firewall:** Check if outbound MQTT ports (1883, 8883) are open
3. **Credentials:** Verify MQTT username/password in integration settings

### Messages Not Arriving

1. **Check subscriptions:** Look for `Subscribed to topic:` in logs
2. **Topic mismatch:** Ensure device publishes to subscribed topics
3. **Broker config:** Verify devices are publishing to correct broker

### High Memory Usage

If service memory grows:

1. **Reduce batch size:** Lower `MESSAGE_BATCH_SIZE` in config
2. **Add memory limit:** Set Docker memory constraint
3. **Check for message loops:** Ensure no circular publishing

## Development

### Project Structure

```
services/mqtt-subscriber/
├── src/
│   ├── index.ts              # Main service entry point
│   ├── config.ts             # Configuration loader
│   ├── types.ts              # TypeScript interfaces
│   └── message-processor.ts  # Message parsing and storage
├── Dockerfile                # Container definition
├── docker-compose.yml        # Docker Compose config
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
└── README.md                 # This file
```

### Local Development

```bash
# Install dependencies
npm install

# Run with auto-reload
npm run dev

# Build TypeScript
npm run build

# Run production build
npm start
```

### Adding Custom Parsers

Edit `src/message-processor.ts`:

```typescript
private parsePayload(payload: string): Record<string, unknown> {
  // Add your custom parsing logic here
  const data = JSON.parse(payload);

  // Example: Custom VMark format
  if (data.deviceType === 'vmark') {
    return this.parseVMarkFormat(data);
  }

  return data;
}
```

## Security

### Best Practices

1. **Service Role Key:** Keep `SUPABASE_SERVICE_ROLE_KEY` secret
2. **Network Isolation:** Run service in private network if possible
3. **TLS:** Use `mqtts://` (TLS) for production MQTT connections
4. **Credentials:** Store MQTT passwords in Supabase (encrypted)
5. **Logs:** Sanitize sensitive data in log output

### Container Security

The Docker container runs as non-root user:

```dockerfile
USER node
```

## FAQ

**Q: Can this service handle multiple organizations?**  
A: Yes! It loads all active MQTT integrations across all organizations.

**Q: What happens if the service crashes?**  
A: Docker's `restart: unless-stopped` policy automatically restarts it. Systemd/PM2 also have restart policies.

**Q: How do I add a new MQTT integration?**  
A: Just create it in the UI. The service refreshes integrations every 5 minutes automatically.

**Q: Does this replace Edge Functions?**  
A: No, it complements them. Use this for inbound subscriptions, use `mqtt-ingest` Edge Function for HTTP push, and `mqtt-hybrid` for outbound publishing.

**Q: Can I run multiple instances for load balancing?**  
A: Yes, but ensure each instance subscribes to different topics or uses MQTT shared subscriptions to avoid duplicate processing.

## Support

- **Issues:** [GitHub Issues](https://github.com/NetNeural/MonoRepo-Staging/issues)
- **Docs:** [Architecture Documentation](../../docs/MQTT_ARCHITECTURE.md)
- **Chat:** NetNeural Slack #mqtt-support

## License

MIT License - See LICENSE file for details
