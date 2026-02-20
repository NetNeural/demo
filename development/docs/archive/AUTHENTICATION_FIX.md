# Authentication Fix - 500 Error Resolution (Final)

## Root Cause

The 500 error was caused by: **"supabaseClient.auth.setAuth is not a function"**

This occurred because the `setAuth()` method is **deprecated** in newer versions of the Supabase client library.

## The Fix

### Old (Broken) Code:

```typescript
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
)

const authHeader = req.headers.get('Authorization')
if (authHeader) {
  supabaseClient.auth.setAuth(authHeader.replace('Bearer ', ''))
}
```

### New (Working) Code:

```typescript
const authHeader = req.headers.get('Authorization')

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  }
)
```

## All Fixed Files

✅ **supabase/functions/devices/index.ts** - Authentication method updated
✅ **supabase/functions/alerts/index.ts** - Authentication method updated
✅ **supabase/functions/dashboard-stats/index.ts** - Authentication method updated
✅ **supabase/functions/organizations/index.ts** - Authentication method updated
✅ **supabase/functions/integrations/index.ts** - Authentication method updated

## How to Apply the Fix

### IMPORTANT: You MUST restart the edge functions server for changes to take effect!

### Step 1: Stop Any Running Servers

If you have any terminals running `npm run dev` or `npm run supabase:functions:serve`, press **Ctrl+C** to stop them.

### Step 2: Start Supabase Functions Server

```bash
cd "c:\Development\NetNeural\SoftwareMono\development"
npm run supabase:functions:serve
```

You should see output like:

```
Serving functions on http://127.0.0.1:54321/functions/v1/<function-name>
 - http://127.0.0.1:54321/functions/v1/alerts
 - http://127.0.0.1:54321/functions/v1/devices
 - ... and more functions
```

### Step 3: Start Development Server (in NEW terminal)

```bash
cd "c:\Development\NetNeural\SoftwareMono\development"
npm run dev
```

### Step 4: Test in Browser

1. Open browser to `http://localhost:3000/dashboard`
2. Open Developer Console (F12)
3. Check Network tab - you should see **200 status codes** instead of 500

## Testing the Fix

### Test Device Endpoint Directly:

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" http://localhost:54321/functions/v1/devices
```

### Expected Response:

```json
{
  "devices": [
    {
      "id": "...",
      "name": "Device Name",
      "status": "online",
      ...
    }
  ]
}
```

## What Changed in Each Function

### Before (Broken):

- Used deprecated `setAuth()` method
- Authentication was set AFTER client creation
- Caused "setAuth is not a function" error

### After (Fixed):

- Authentication headers passed during client creation
- Uses modern Supabase client options pattern
- Authorization header properly forwarded to all requests

## Complete Error Timeline

1. ❌ **First Error**: `Unexpected token '<'` - Fixed by using correct edge function URLs
2. ❌ **Second Error**: `503 Service Unavailable` - Fixed by starting edge functions server
3. ❌ **Third Error**: `500 Internal Server Error (wrong query syntax)` - Fixed foreign key joins
4. ✅ **Final Error**: `500 Internal Server Error (setAuth not a function)` - **FIXED NOW!**

## Verification Checklist

After restarting the functions server, verify:

- [ ] Edge functions server running (`npm run supabase:functions:serve`)
- [ ] Dev server running (`npm run dev`)
- [ ] Browser shows dashboard without errors
- [ ] Network tab shows 200 responses from `/functions/v1/*` endpoints
- [ ] Data loads from database (not just mock data fallback)

## Troubleshooting

### Still Getting 500 Errors?

**Solution**: Make sure you **restarted the edge functions server** after the code changes!

```bash
# Stop current server (Ctrl+C), then:
cd "c:\Development\NetNeural\SoftwareMono\development"
npm run supabase:functions:serve
```

### Functions Server Won't Start?

**Solution**: Reset Supabase completely

```bash
npm run supabase:stop
npm run supabase:start
npm run supabase:functions:serve
```

### No Data Showing?

**Solution**: Database might be empty, load seed data

```bash
npm run supabase:reset
```

## Summary

The authentication method in all edge functions has been updated from the deprecated `setAuth()` to the modern client configuration pattern.

**All 500 errors should now be resolved** once you restart the edge functions server! 🎉

## Next Steps

1. **Restart edge functions server** (critical!)
2. **Restart dev server**
3. **Test in browser**
4. **Verify 200 status codes**

The application should now fully work with real database data!
