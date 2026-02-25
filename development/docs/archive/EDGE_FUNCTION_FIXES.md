# Edge Function Fixes - 500 Error Resolution

## Problem

The edge functions were returning 500 errors due to:

1. Incorrect Supabase foreign key query syntax
2. Missing TypeScript error handling
3. Incorrect field access after joins

## Fixed Edge Functions

### 1. devices/index.ts

**Issue**: Incorrect join syntax `location:locations(name)`
**Fix**: Changed to `locations!location_id(name)` to properly reference foreign keys

**Changes**:

- Fixed join syntax for locations, departments, and device_integrations tables
- Updated field access from `device.location?.name` to `device.locations?.name`
- Added proper TypeScript error handling
- Added compatibility fields (device_name, battery_level, etc.) for frontend

### 2. alerts/index.ts

**Issue**: Incorrect join syntax `device:devices(name, device_type)`
**Fix**: Changed to `devices!device_id(name, device_type)`

**Changes**:

- Fixed join syntax for devices table
- Updated field access from `alert.device?.name` to `alert.devices?.name`
- Added proper TypeScript error handling with console logging

### 3. dashboard-stats/index.ts

**Issue**: Missing TypeScript error type handling
**Fix**: Added proper error type checking

**Changes**:

- Added `error instanceof Error` check
- Added console.error logging for debugging

### 4. organizations/index.ts

**Issue**: Missing TypeScript error type handling
**Fix**: Added proper error type checking

**Changes**:

- Added `error instanceof Error` check
- Added console.error logging for debugging

### 5. integrations/index.ts

**Issue**: Missing TypeScript error type handling
**Fix**: Added proper error type checking

**Changes**:

- Added `error instanceof Error` check
- Added console.error logging for debugging

## Supabase Foreign Key Query Syntax

### Incorrect (Old):

```typescript
.select(`
  *,
  location:locations(name),
  device:devices(name)
`)
```

### Correct (New):

```typescript
.select(`
  *,
  locations!location_id(name),
  devices!device_id(name)
`)
```

The syntax is: `related_table!foreign_key_column(fields)`

## Testing Instructions

### 1. Restart Edge Functions Server

```bash
# Stop any running functions server (Ctrl+C)
cd "c:\Development\NetNeural\SoftwareMono\development"
npm run supabase:functions:serve
```

### 2. Start Development Server (in new terminal)

```bash
cd "c:\Development\NetNeural\SoftwareMono\development"
npm run dev
```

### 3. Test Each Endpoint

#### Test Devices Endpoint:

```bash
curl -H "Authorization: Bearer <YOUR_SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  http://localhost:54321/functions/v1/devices
```

#### Test Alerts Endpoint:

```bash
curl -H "Authorization: Bearer <YOUR_SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  http://localhost:54321/functions/v1/alerts
```

#### Test Dashboard Stats:

```bash
curl -H "Authorization: Bearer <YOUR_SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  http://localhost:54321/functions/v1/dashboard-stats
```

### 4. Check Browser Console

1. Open browser to `http://localhost:3000/dashboard`
2. Open Developer Console (F12)
3. Check Network tab for API calls
4. All should return 200 status codes with JSON data

### 5. Check Edge Function Logs

When requests come in, you should see logs in the terminal running `npm run supabase:functions:serve`

## Expected Results

✅ **Before**: 500 errors with query syntax issues
✅ **After**: 200 responses with proper JSON data

### Sample Success Response (devices):

```json
{
  "devices": [
    {
      "id": "uuid-here",
      "name": "Device Name",
      "device_name": "Device Name",
      "status": "online",
      "location": "Location Name",
      "battery_level": 85,
      "signal_strength": -45
    }
  ]
}
```

## Common Issues

### Issue: Still getting 500 errors

**Solution**:

1. Check edge function terminal for specific error messages
2. Verify database has seed data with relationships
3. Run: `npm run supabase:reset` to reset database with migrations

### Issue: No data returned

**Solution**:

1. Check if database has seed data
2. Run: `npm run supabase:reset` to load seed data
3. Verify organization_id matches in queries

### Issue: Edge functions not starting

**Solution**:

1. Stop all terminals
2. Run: `npm run supabase:stop`
3. Run: `npm run supabase:start`
4. Run: `npm run supabase:functions:serve`

## Database Seeding

If you need to reset the database with proper seed data:

```bash
cd "c:\Development\NetNeural\SoftwareMono\development"
npm run supabase:reset
```

This will:

- Drop all tables
- Run migrations
- Load seed data from `supabase/seed.sql`

## Summary

All edge functions have been fixed to:

1. ✅ Use correct Supabase foreign key syntax
2. ✅ Properly handle TypeScript errors
3. ✅ Access joined fields correctly
4. ✅ Include console logging for debugging
5. ✅ Return properly formatted JSON responses

The 500 errors should now be resolved and all API calls should work properly!
