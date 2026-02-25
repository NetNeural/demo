# Database-Based Service Restart System

## Overview

Since SSH access to demo-stage.netneural.ai is not available, we use a **database polling approach** where services monitor a Supabase table for restart requests and execute them autonomously.

## Architecture

```
User UI → Edge Function → Database Table → Service Monitor → Self-Restart
        (request-service-restart)    (service_restart_requests)  (restart-monitor.js)
```

**Flow:**

1. User clicks "Request Restart" button in UI
2. Edge Function creates row in `service_restart_requests` table
3. Service monitor (running in MQTT container) polls table every 30s
4. Monitor finds pending request, executes `git pull && docker-compose restart`
5. Monitor updates request status to 'completed'
6. Service restarts with latest code

## Setup on demo-stage Server

### Prerequisites

- MQTT subscriber container running
- Supabase service role key available
- Git repository accessible from server

### Installation

**1. Copy monitor script to server:**

```bash
# If you have ANY access to the server (console, file upload, etc.)
# Copy these files to /opt/mqtt-subscriber/:
- restart-monitor.js
- package.json (ensure @supabase/supabase-js is included)
```

**2. Install dependencies:**

```bash
cd /opt/mqtt-subscriber
npm install @supabase/supabase-js
```

**3. Add to docker-compose.yml:**

```yaml
services:
  mqtt-subscriber:
    # ... existing config ...
    environment:
      - SUPABASE_URL=https://atgbmxicqikmapfqouco.supabase.co
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - RESTART_POLL_INTERVAL=30 # seconds
      - SERVICE_DIR=/opt/mqtt-subscriber
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock # Allow container to restart itself
    command: sh -c "node restart-monitor.js & npm start"
```

**4. Set environment variables:**

```bash
# Add to .env file on server
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**5. Restart to apply changes:**

```bash
docker-compose restart mqtt-subscriber
```

## Database Migration

Run the migration to create restart tables:

```bash
cd /workspaces/MonoRepo/development
npx supabase db push
```

The migration creates:

- `service_restart_requests` table
- `request_service_restart()` function
- Appropriate RLS policies

## Deploy Edge Function

```bash
cd /workspaces/MonoRepo/development
npx supabase functions deploy request-service-restart --no-verify-jwt
```

## Deploy Frontend

```bash
gh workflow run deploy-staging.yml -f force_deploy=true
```

## Usage

### From UI

1. Go to Support → Troubleshooting
2. Click "Request Restart" in System Services section
3. Wait 30-60 seconds for service to restart

### Programmatically

```typescript
const { data, error } = await supabase.rpc('request_service_restart', {
  p_service_name: 'mqtt-subscriber',
})
```

## Monitoring

### Check restart requests:

```sql
SELECT * FROM service_restart_requests
ORDER BY requested_at DESC
LIMIT 10;
```

### Check monitor logs (on server):

```bash
docker-compose logs -f mqtt-subscriber | grep "Restart Monitor"
```

## Troubleshooting

### Issue: "A restart request is already pending"

**Cause:** Request created within last 5 minutes

**Solution:** Wait 5 minutes or clear old request:

```sql
UPDATE service_restart_requests
SET status = 'completed'
WHERE status = 'pending'
  AND service_name = 'mqtt-subscriber';
```

### Issue: Requests stay in "pending" status

**Cause:** Restart monitor not running

**Solution:** Check if monitor is running:

```bash
# On server
docker-compose exec mqtt-subscriber ps aux | grep restart-monitor
```

If not running:

```bash
docker-compose restart mqtt-subscriber
docker-compose logs mqtt-subscriber | grep "Restart Monitor"
```

### Issue: Monitor can't restart Docker container

**Cause:** Docker socket not mounted

**Solution:** Add to docker-compose.yml:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

## Security Considerations

1. **Service Role Key:** Stored as environment variable, never committed
2. **RLS Policies:** Only authenticated users can create requests
3. **Rate Limiting:** Built-in 5-minute cooldown between requests
4. **Audit Trail:** All requests logged with user ID and timestamps

## Advantages Over SSH/Webhook

✅ **No SSH required** - Works with limited server access  
✅ **No open ports** - Service polls outbound only  
✅ **Audit trail** - All restarts logged in database  
✅ **User tracking** - Know who requested each restart  
✅ **Self-healing** - Service restarts itself automatically

## Disadvantages

⚠️ **Delayed execution** - 30-60 second delay (polling interval)  
⚠️ **Requires monitor** - restart-monitor.js must be running  
⚠️ **Docker socket access** - Container needs privileged access

## Alternative: Manual Restart

If the monitor can't be deployed, users can still restart manually:

```bash
# Via any server access method
cd /opt/mqtt-subscriber
git pull
docker-compose restart mqtt-subscriber
```

This is shown in the UI as a fallback option.

## Files

- `supabase/migrations/20260222_service_restart_requests.sql` - Database schema
- `supabase/functions/request-service-restart/index.ts` - Edge Function
- `services/mqtt-subscriber/restart-monitor.js` - Polling monitor
- `src/app/dashboard/support/components/TroubleshootingTab.tsx` - UI component

---

**Created:** 2026-02-22  
**Status:** Ready for deployment (requires server-side monitor setup)
