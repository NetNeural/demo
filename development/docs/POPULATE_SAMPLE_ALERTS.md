# Populating Sample Alerts for Testing

The Alert History Report at https://demo-stage.netneural.ai/dashboard/reports/alerts/ requires alert data to display.

## Quick Fix: Populate Sample Alerts

### Option 1: Using Supabase Studio (Recommended)

1. **Open Supabase Studio**: Go to your staging Supabase project dashboard
2. **Navigate to SQL Editor**: Click on "SQL Editor" in the left sidebar
3. **Run the population script**:
   - Open `development/scripts/populate-sample-alerts.sql`
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click "Run"

This will create 8 sample alerts with various severities and statuses:
- 2 Critical alerts (1 resolved, 1 unresolved)
- 2 High alerts (both resolved)
- 2 Medium alerts (1 resolved, 1 unresolved)
- 2 Low alerts (both unresolved)

### Option 2: Run Local Seed Data

If using local Supabase:

```bash
cd development
npm run supabase:db:seed
```

### Option 3: Manual Quick Test (Supabase Studio SQL Editor)

Copy and run this simplified version:

```sql
-- Quick test: Insert 3 sample alerts
INSERT INTO alerts (organization_id, alert_type, severity, title, message, is_resolved, created_at)
SELECT 
  id as organization_id,
  'low_battery' as alert_type,
  'critical' as severity,
  'Critical Battery Alert' as title,
  'Device battery critically low' as message,
  false as is_resolved,
  NOW() - INTERVAL '1 hour' as created_at
FROM organizations 
LIMIT 1;

INSERT INTO alerts (organization_id, alert_type, severity, title, message, is_resolved, resolved_at, created_at)
SELECT 
  id as organization_id,
  'temperature_high' as alert_type,
  'high' as severity,
  'High Temperature' as title,
  'Temperature exceeded threshold' as message,
  true as is_resolved,
  NOW() - INTERVAL '30 minutes' as resolved_at,
  NOW() - INTERVAL '2 hours' as created_at
FROM organizations 
LIMIT 1;

INSERT INTO alerts (organization_id, alert_type, severity, title, message, is_resolved, created_at)
SELECT 
  id as organization_id,
  'device_offline' as alert_type,
  'medium' as severity,
  'Device Offline' as title,
  'Device has not reported for 30 minutes' as message,
  false as is_resolved,
  NOW() - INTERVAL '30 minutes' as created_at
FROM organizations 
LIMIT 1;

-- Verify
SELECT COUNT(*) as alert_count, severity, is_resolved 
FROM alerts 
GROUP BY severity, is_resolved;
```

## Verify Data

After running any of the above methods, refresh the Alert History Report page. You should now see:

- **Statistics cards** showing alert counts by severity
- **Alert table** with filterable data
- **Date range filters** working with the sample data (last 7 days by default)

## Production Alerts

In production, alerts are automatically created by:
1. **Sensor threshold monitoring** (runs every 5 minutes via cron job)
2. **Device offline detection** (configured per device)
3. **Manual alert creation** via API or edge functions

For staging/testing, you can manually trigger threshold checks or use the sample data scripts provided.

## Troubleshooting

If alerts still don't appear after running the scripts:

1. **Check RLS policies**: Ensure you're logged in as a user belonging to the organization
2. **Check browser console**: Look for any error messages
3. **Verify organization**: Make sure you have an organization selected in the dashboard
4. **Check edge function**: The report uses `edgeFunctions.alerts.list()` - verify this function has access

To debug, open browser DevTools Console and look for messages prefixed with `[AlertHistoryReport]`.
