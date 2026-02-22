# Manual Deployment Guide: Restart Monitor

This guide shows how to deploy the restart-monitor.js to the demo-stage server without automated SSH.

## Files to Deploy

1. `restart-monitor.js` - The monitoring script
2. `docker-compose.yml` - Updated with restart-monitor service
3. `package.json` - Already includes @supabase/supabase-js dependency

## Option 1: Using SSH (Automated)

If you have SSH access configured:

```bash
cd /workspaces/MonoRepo/development/services/mqtt-subscriber
chmod +x deploy-restart-monitor.sh
./deploy-restart-monitor.sh
```

## Option 2: Manual Console Deployment

If you access the server via web console or other means:

### Step 1: Connect to demo-stage server

Use whatever method you have:

- SSH: `ssh user@demo-stage.netneural.ai`
- Cloud provider web console (AWS, DigitalOcean, etc.)
- Management interface

### Step 2: Copy restart-monitor.js

Create the file on the server:

```bash
cd /opt/mqtt-subscriber
nano restart-monitor.js
```

Then paste the contents of [restart-monitor.js](restart-monitor.js).

Or use `scp` if you have local SSH:

```bash
scp restart-monitor.js user@demo-stage.netneural.ai:/opt/mqtt-subscriber/
```

### Step 3: Update docker-compose.yml

Replace `/opt/mqtt-subscriber/docker-compose.yml` with the new version:

```bash
cd /opt/mqtt-subscriber
nano docker-compose.yml
```

Paste the updated [docker-compose.yml](docker-compose.yml) content.

### Step 4: Verify Environment Variables

Make sure `.env` file has the required variables:

```bash
cat .env
```

Should contain:

```env
SUPABASE_URL=https://atgbmxicqikmapfqouco.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 5: Install Dependencies

```bash
cd /opt/mqtt-subscriber
npm install
```

This installs `@supabase/supabase-js` needed by restart-monitor.js.

### Step 6: Deploy and Restart

```bash
cd /opt/mqtt-subscriber
git pull  # Get latest parser fixes
docker-compose up -d --force-recreate
```

### Step 7: Verify Deployment

Check that both services are running:

```bash
docker-compose ps
```

Should show:

- `netneural-mqtt-subscriber` - Running
- `netneural-restart-monitor` - Running

View logs:

```bash
# Restart monitor logs
docker-compose logs -f restart-monitor

# MQTT subscriber logs
docker-compose logs -f mqtt-subscriber
```

## Verification

### 1. Check Restart Monitor Logs

You should see:

```
🔍 MQTT Restart Monitor Started
📡 Polling Supabase every 30s for restart requests
🏷️  Service: mqtt-subscriber
📁 Directory: /opt/mqtt-subscriber
```

### 2. Test "Request Restart" Button

1. Navigate to: https://demo-stage.netneural.ai/dashboard/support
2. Click on **System Services** section
3. Click **Request Restart** for MQTT Subscriber
4. Watch the monitor logs: `docker-compose logs -f restart-monitor`
5. You should see:
   ```
   🔄 Executing restart for request <uuid>
   📥 Pulling latest code...
   ✅ Code updated
   🔄 Restarting Docker container...
   ✅ Container restarted
   ```

### 3. Verify Database Records

Check the database:

```sql
SELECT * FROM service_restart_requests
ORDER BY requested_at DESC
LIMIT 5;
```

Should show requests with status changing from `pending` → `processing` → `completed`.

## Troubleshooting

### Restart monitor not showing in `docker-compose ps`

```bash
docker-compose logs restart-monitor
# Check for errors
```

### "SUPABASE_SERVICE_ROLE_KEY environment variable required"

The `.env` file is missing or incomplete:

```bash
cd /opt/mqtt-subscriber
nano .env
# Add: SUPABASE_SERVICE_ROLE_KEY=<key>
docker-compose restart restart-monitor
```

### "Cannot connect to Docker daemon"

The restart-monitor needs access to Docker socket:

```bash
# Check if docker.sock is mounted
docker inspect netneural-restart-monitor | grep docker.sock

# Verify permissions
ls -la /var/run/docker.sock
```

### Restart monitor crashes on restart attempt

This is **expected behavior**! When it restarts the mqtt-subscriber, it also gets restarted (since docker-compose restarts all services). Docker will automatically restart it due to `restart: unless-stopped`.

## Expected Behavior

1. User clicks "Request Restart" button
2. Frontend calls `request-service-restart` Edge Function
3. Edge Function inserts record into `service_restart_requests` table
4. Restart monitor (polling every 30s) detects new pending request
5. Restart monitor executes: `git pull && docker-compose restart mqtt-subscriber`
6. Both containers restart (expected)
7. Services come back online with latest code
8. Device telemetry shows correct temperature values within 5 minutes

## Success Criteria

✅ Both services running in `docker-compose ps`  
✅ Restart monitor logs show polling activity  
✅ "Request Restart" button creates database records  
✅ Restart monitor processes requests and updates status  
✅ MQTT subscriber restarts and pulls latest code  
✅ Device telemetry shows parsed temperature values (not "Unknown")

## Next Steps After Deployment

Once deployed, test the full flow:

1. Visit device page: https://demo-stage.netneural.ai/dashboard/device-details/?id=20ed9aec-d260-4a2c-9f2f-365df530dee1
2. Note telemetry shows "Unknown" values (old parser)
3. Go to: https://demo-stage.netneural.ai/dashboard/support
4. Click "Request Restart" for MQTT Subscriber
5. Wait 1-2 minutes for restart to complete
6. Refresh device page
7. Wait 5-10 minutes for next MQTT message
8. Verify telemetry shows: Sensor="Temperature", Value=<number>, Unit="°F"

🎉 Success! The complete MQTT integration is now working with database-triggered restarts!
