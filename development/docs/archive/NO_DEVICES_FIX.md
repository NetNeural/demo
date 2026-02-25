# No Devices Returned - Troubleshooting & Fix

## Problem

Edge function is returning no devices (empty array or error).

## Root Causes Identified & Fixed

### 1. ✅ Wrong Default Organization ID

**Issue**: Edge functions were using `'00000000-0000-0000-0000-000000000000'` as default
**Actual**: Seed data uses `'00000000-0000-0000-0000-000000000001'`

**Fixed in**:

- ✅ `supabase/functions/devices/index.ts`
- ✅ `supabase/functions/alerts/index.ts`

### 2. 🔄 Edge Functions Server Not Running

Edge functions need to be restarted to pick up changes.

### 3. 🔐 Authentication Headers Required

Edge functions require proper authorization headers.

## Complete Solution

### Step 1: Verify Database Has Devices

```bash
cd "c:\Development\NetNeural\SoftwareMono\development"

# Option A: Check via Supabase Studio
npm run supabase:studio
# Then navigate to http://localhost:54323
# Go to Table Editor → devices
# Should see 20 devices

# Option B: Quick command line check (if psql available)
psql postgresql://postgres:postgres@localhost:54322/postgres -c "SELECT COUNT(*) FROM devices;"
```

**Expected**: 20 devices in the database

### Step 2: Restart Edge Functions Server

**CRITICAL**: Edge functions must be restarted to pick up code changes!

```bash
# Stop any running edge functions (Ctrl+C in that terminal)
# Then start fresh:
cd "c:\Development\NetNeural\SoftwareMono\development"
npm run supabase:functions:serve
```

**Expected output**:

```
Serving functions on http://127.0.0.1:54321/functions/v1/<function-name>
 - http://127.0.0.1:54321/functions/v1/alerts
 - http://127.0.0.1:54321/functions/v1/devices
 - http://127.0.0.1:54321/functions/v1/dashboard-stats
 ... and more functions
```

### Step 3: Test Edge Function Directly

```bash
# Test with correct authorization header
curl -H "Authorization: Bearer <YOUR_SUPABASE_ANON_KEY>" \
     http://localhost:54321/functions/v1/devices
```

**Expected response**:

```json
{
  "devices": [
    {
      "id": "40000000-0000-0000-0000-000000000001",
      "name": "Temperature Sensor 1",
      "status": "online",
      "battery_level": 87,
      ...
    },
    ... (19 more devices)
  ]
}
```

### Step 4: Start Dev Server

```bash
# In a NEW terminal
cd "c:\Development\NetNeural\SoftwareMono\development"
npm run dev
```

### Step 5: Check Browser

Visit `http://localhost:3000/dashboard/devices`

**Check Developer Console** (F12):

- Network tab should show requests to `functions/v1/devices`
- Should return 200 status code
- Response should contain 20 devices

## What Was Fixed

### Before (devices/index.ts):

```typescript
const organizationId =
  url.searchParams.get('organization_id') ||
  '00000000-0000-0000-0000-000000000000'
// ❌ Wrong ID - no devices found
```

### After (devices/index.ts):

```typescript
const organizationId =
  url.searchParams.get('organization_id') ||
  '00000000-0000-0000-0000-000000000001'
// ✅ Correct ID - matches seed data
```

## Debugging Checklist

If still seeing no devices:

### ✅ 1. Database Has Data

```bash
npm run supabase:studio
```

Navigate to Table Editor → devices. Should see 20 rows.

### ✅ 2. Edge Functions Running

Terminal should show:

```
Serving functions on http://127.0.0.1:54321/functions/v1/...
```

### ✅ 3. Correct Organization ID

Check the frontend components are calling with the right org ID:

**DevicesList.tsx**:

```typescript
const response = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/devices`,
  {
    headers: {
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  }
)
```

**Note**: The frontend doesn't pass `organization_id` param, so it uses the default we just fixed!

### ✅ 4. Environment Variables Set

Check `.env.local` has:

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_KEY>
```

### ✅ 5. No CORS Errors

Check browser console for CORS errors. Edge functions include CORS headers, but make sure requests are to `localhost:54321`.

## Common Issues & Solutions

### Issue: "401 Unauthorized"

**Solution**: Authorization header missing or incorrect

```typescript
// Make sure all fetch calls include:
headers: {
  'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
}
```

### Issue: "Empty devices array"

**Solution**:

1. Verify organization_id is correct (should be `...0001` not `...0000`)
2. Restart edge functions server
3. Check database actually has devices

### Issue: "Connection refused"

**Solution**: Edge functions server not running

```bash
npm run supabase:functions:serve
```

### Issue: "Still seeing mock data"

**Solution**: Check error handling in components - they fallback to mock data on error

```typescript
// Look for this pattern in components:
catch (error) {
  console.error('Error:', error)
  // Falls back to mock data
  setDevices([/* mock data */])
}
```

## Testing the Fix

### Test 1: Direct API Call

```bash
curl -H "Authorization: Bearer <YOUR_SUPABASE_ANON_KEY>" \
     http://localhost:54321/functions/v1/devices | grep -o "\"name\"" | wc -l
```

**Expected**: Should print `20` (one name per device)

### Test 2: Browser Console

```javascript
// Run in browser console at http://localhost:3000/dashboard
fetch('http://localhost:54321/functions/v1/devices', {
  headers: {
    Authorization:
      'Bearer <YOUR_SUPABASE_ANON_KEY>',
  },
})
  .then((r) => r.json())
  .then((d) => console.log('Devices:', d.devices?.length))
```

**Expected**: Console should show `Devices: 20`

### Test 3: Frontend Component

Visit `http://localhost:3000/dashboard/devices`

- Should see a list of 20 devices
- Various statuses (online, offline, warning)
- Different device types
- Real battery levels and signal strengths

## Summary

✅ **Fixed**: Default organization ID in edge functions
🔄 **Action Required**: Restart edge functions server
🎯 **Expected Result**: Dashboard shows 20 real devices from database

After restarting the edge functions server, your dashboard should display all 20 devices with real data!
