# MQTT Restart Functionality - Deployment Guide

## Overview

Added functional MQTT subscriber restart capability accessible from the Support → Troubleshooting page using a webhook-based approach (no SSH required).

## Architecture

```
Frontend UI → Edge Function → HTTP Webhook → Server executes restart
```

**Why webhook instead of SSH?**

- No SSH key management in Supabase
- Simpler security model (single token)
- Server-side control of restart logic
- Better for firewall/network configurations

## Changes Made

### 1. Webhook Server on demo-stage

**File:** `services/mqtt-subscriber/restart-webhook.js`

**Purpose:** Lightweight HTTP server that accepts authenticated restart requests

**Features:**

- Runs on port 9999 (configurable)
- Token-based authentication
- Executes `git pull && docker-compose restart`
- Health check endpoint
- Systemd service for auto-restart

### 2. Edge Function: `restart-mqtt-service`

**File:** `supabase/functions/restart-mqtt-service/index.ts`

**Purpose:** Frontend-facing API that calls the webhook

**Features:**

- Webhook-based service restart with timeout (30s)
- Token authentication forwarding
- Comprehensive error handling and logging
- CORS support for frontend calls

**Environment Variables Required:**

```bash
MQTT_WEBHOOK_URL=http://demo-stage.netneural.ai:9999/restart  # Optional, defaults to this
MQTT_RESTART_TOKEN=<generate-random-token>  # REQUIRED
```

### 2. Updated UI Component

**File:** `src/app/dashboard/support/components/TroubleshootingTab.tsx`

**Changes:**

- Added `restartingMqtt` state for loading indicator
- Implemented Edge Function call with proper error handling
- Added loading state with spinner during restart
- Shows success/error toasts based on result
- Automatically refreshes activity logs after successful restart

## Deployment Steps

### Step 1: Deploy Webhook Server on demo-stage

**On the demo-stage server:**

```bash
# 1. Copy webhook files to server
cd /opt/mqtt-subscriber
# Files: restart-webhook.js and restart-webhook.service

# 2. Generate secure restart token
export RESTART_TOKEN=$(openssl rand -hex 32)
echo "Save this token: $RESTART_TOKEN"

# 3. Update systemd service with token
sudo sed -i "s/__REPLACE_WITH_SECRET_TOKEN__/$RESTART_TOKEN/" restart-webhook.service

# 4. Install and start the service
sudo cp restart-webhook.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable restart-webhook
sudo systemctl start restart-webhook

# 5. Verify it's running
sudo systemctl status restart-webhook
curl http://localhost:9999/health

# 6. Open firewall port (if needed)
sudo ufw allow 9999/tcp
```

### Step 2: Configure Supabase Secrets

```bash
# Use the token generated in Step 1
npx supabase secrets set MQTT_RESTART_TOKEN="your-generated-token-here"

# Optionally set custom webhook URL (defaults to demo-stage.netneural.ai:9999)
npx supabase secrets set MQTT_WEBHOOK_URL="http://demo-stage.netneural.ai:9999/restart"
```

### Step 3: Deploy Edge Function

```bash
cd /workspaces/MonoRepo/development
npx supabase functions deploy restart-mqtt-service --no-verify-jwt
```

**Note:** The `--no-verify-jwt` flag is required because we use manual JWT validation in the function.

### Step 3: Deploy Frontend to Staging

```bash
# Option A: Trigger GitHub Actions workflow
gh workflow run deploy-staging.yml -f force_deploy=true

# Option B: Push to main (auto-triggers deployment)
git add .
git commit -m "feat: Add functional MQTT restart button"
git push origin main

# Monitor deployment
gh run list --workflow=deploy-staging.yml --limit 3
```

### Step 4: Verify Deployment

1. Navigate to: https://demo-stage.netneural.ai/dashboard/support/?tab=troubleshooting
2. Scroll to "System Services" section
3. Click "Restart Service" button
4. Should see:
   - Button shows "Restarting..." with spinner
   - Success toast after 10-30 seconds
   - Activity logs refresh automatically

## Testing

### Test Webhook Directly (from demo-stage server)

```bash
# Health check
curl http://localhost:9999/health

# Test restart (use your actual token)
curl -X POST http://localhost:9999/restart \
  -H "X-Restart-Token: your-restart-token-here"
```

### Test from External Network

```bash
# Should work if port 9999 is open
curl http://demo-stage.netneural.ai:9999/health
```

### Test Edge Function

```bash
curl -X POST \
  https://atgbmxicqikmapfqouco.supabase.co/functions/v1/restart-mqtt-service \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"service": "mqtt"}'
```

### Expected Response (Success)

```json
{
  "success": true,
  "message": "MQTT subscriber restarted successfully",
  "details": {
    "service": "mqtt",
    "host": "demo-stage.netneural.ai",
    "stdout": "Restarting mqtt-subscriber\n...",
    "timestamp": "2026-02-22T..."
  }
}
```

### Expected Response (Webhook Not Configured)

```json
{
  "success": false,
  "error": "Webhook credentials not configured. Please set MQTT_RESTART_TOKEN secret.",
  "message": "Server configuration required"
}
```

## Troubleshooting

### Issue: "Webhook credentials not configured"

**Solution:** Set the `MQTT_RESTART_TOKEN` secret in Supabase:

```bash
npx supabase secrets set MQTT_RESTART_TOKEN="your-token"
npx supabase functions deploy restart-mqtt-service --no-verify-jwt
```

### Issue: "Failed to connect to restart webhook"

**Possible causes:**

- Webhook service not running on server
- Port 9999 blocked by firewall
- Network connectivity issues

**Solution:**

```bash
# On demo-stage server
sudo systemctl status restart-webhook
sudo systemctl restart restart-webhook
sudo journalctl -u restart-webhook -f  # View logs

# Check firewall
sudo ufw status
sudo ufw allow 9999/tcp

# Test locally
curl http://localhost:9999/health
```

### Issue: "Unauthorized" (401 response)

**Possible causes:**

- TokWebhook Token Security:\*\*
  - Generate strong random token (32+ bytes)
  - Store as Supabase secret (encrypted at rest)
  - Never commit token to git
  - Rotate periodically

2. **Network Security:**
   - Webhook runs on port 9999 (consider firewall rules)
   - Option: Restrict to Supabase IPs only
   - Option: Use HTTPS/TLS with reverse proxy (nginx)

3. **Authorization:**
   - Edge Function requires valid JWT token
   - Webhook requires X-Restart-Token header
   - Two-factor security: user auth + webhook token

4. **Rate Limiting:**
   - Consider adding rate limiting to prevent abuse
   - Track restart attempts in activity logs
   - Monitor systemd logs for suspicious activity

````

### Issue: Timeout after 30 seconds
**Possible causes:**
- Server unresponsive
- Docker compose taking too long
- Network latency

**Solution:**
- Check server status manually via SSH
- Increase timeout in Edge Function if needed
- Review MQTT subscriber logs on server

## Security Considerations

1. **SSH Key Security:**
   - Store as Supabase secret (encrypted at rest)
   - Use dedicated key with minimal permissions
   - Consider using SSH key with passphrase

2. **Authorization:**
   - Edge Function requires valid JWT token
   - Only authenticated users can trigger restart
   - Consider adding role-based access (admin only)
HTTPS/TLS:** Add nginx reverse proxy with SSL certificate
2. **Monitoring Integration:** Send restart events to monitoring system (Sentry, Datadog)
3. **Rollback Capability:** Add ability to rollback to previous git commit
4. **Health Checks:** Verify service health after restart, auto-rollback if fails
5. **Multi-Service Support:** Support restarting other services via same webhook
6. **Rate Limiting:** Add token bucket or sliding window rate limiter
7. **Audit Logging:** Log all restart attempts to database for compliance
## Future Improvements

1. **Webhook Alternative:** Create webhook endpoint on demo-stage for restarts (avoid SSH)
2. **Monitoring Integration:** Send restart events to monitoring system
3. **Rollback Capability:** Add ability to rollback to previous version
4. **Health Checks:** Verify service health after restart
5. **Multi-Service Support:** Extend to restart other services (database, cache, etc.)
Webhook Server: `services/mqtt-subscriber/restart-webhook.js`
- Systemd Service: `services/mqtt-subscriber/restart-webhook.service`
- Edge Function: `supabase/functions/restart-mqtt-service/index.ts`
- UI Component: `src/app/dashboard/support/components/TroubleshootingTab.tsx`
- MQTT Subscriber: `services/mqtt-subscriber/` (contains service to be restarted)
- Parser Fix: `services/mqtt-subscriber/src/message-processor.ts` (VMark parser fix)

## Deployment Checklist
- [ ] Webhook server deployed on demo-stage (port 9999)
- [ ] Systemd service enabled and running
- [ ] Restart token generated and secured
- [ ] Token set in Supabase secrets (`MQTT_RESTART_TOKEN`)
- [ ] Edge Function deployed with `--no-verify-jwt`
- [ ] Frontend deployed to staging
- [ ] Tested restart functionality end-to-end
- [ ] Verified MQTT service picks up latest code after restart
- [ ] Firewall configured (port 9999 accessible)

## Quick Setup Commands

**On demo-stage server:**
```bash
cd /opt/mqtt-subscriber
export TOKEN=$(openssl rand -hex 32)
echo "Token: $TOKEN"  # Save this!
sudo sed -i "s/__REPLACE_WITH_SECRET_TOKEN__/$TOKEN/" restart-webhook.service
sudo cp restart-webhook.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now restart-webhook
sudo ufw allow 9999/tcp
curl http://localhost:9999/health
````

**From development environment:**

```bash
cd /workspaces/MonoRepo/development
npx supabase secrets set MQTT_RESTART_TOKEN="paste-token-here"
npx supabase functions deploy restart-mqtt-service --no-verify-jwt
gh workflow run deploy-staging.yml -f force_deploy=true
```

- [ ] Tested restart functionality
- [ ] Verified MQTT service picks up latest code after restart

---

**Created:** 2026-02-22  
**Last Updated:** 2026-02-22  
**Status:** Ready for deployment
