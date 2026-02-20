# Edge Functions Authentication Requirements

## Discovery Summary

Date: November 14, 2025

### Issue

Edge Functions were requiring Authorization headers even when configured with `requireAuth: false` in our custom wrapper.

### Root Cause

**Supabase Edge Functions platform enforces Authorization headers at the runtime level**, before function code executes. This is not configurable and applies to all functions.

### Solution for Device Telemetry

IoT devices must include an Authorization header with one of these keys:

#### Option 1: Anonymous Key (Recommended for IoT)

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

#### Option 2: Service Role Key (Admin Access)

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

### Testing Examples

```bash
# Test endpoint (works)
curl -X POST "http://127.0.0.1:54321/functions/v1/netneural-hub-test?device_id=test-device-123" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [ANON_KEY]" \
  -d '{"temperature": 22.5, "humidity": 45}'

# Main telemetry endpoint
curl -X POST "http://127.0.0.1:54321/functions/v1/netneural-hub-telemetry?device_id=device-789" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [ANON_KEY]" \
  -d '{"temperature": 25.0, "humidity": 60}'
```

### Implications for IoT Integration

1. **Device Configuration**: All IoT devices must be configured with the anon key
2. **Security**: Row Level Security (RLS) policies should handle device authorization
3. **Function Design**: Our `requireAuth: false` setting is ineffective; remove it
4. **Documentation**: Update device integration guides to include required headers

### Next Steps

1. ✅ Confirmed Edge Functions work with anon key authorization
2. ⏳ Update device integration documentation
3. ⏳ Test full telemetry flow with database operations
4. ⏳ Verify RLS policies handle device data correctly
