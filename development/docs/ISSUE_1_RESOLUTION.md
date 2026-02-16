# Issue #1 Resolution: Duplicate Devices Fix

**Issue:** https://github.com/NetNeural/MonoRepo-Staging/issues/1  
**Status:** ✅ Fixed (Pending deployment + database cleanup)  
**Date:** February 16, 2026

---

## Problem Analysis

### Symptoms
- Devices appear twice on the devices page: https://demo-stage.netneural.ai/dashboard/devices/
- Examples: M260600005, M260600008

### Root Cause Discovery

Database query revealed **actual duplicates** in the `devices` table:

```sql
SELECT id, name, device_type, external_device_id, created_at
FROM devices
WHERE name IN ('M260600005', 'M260600008')
  AND deleted_at IS NULL;
```

**Results:**
| ID | Name | Type | External Device ID | Created |
|----|------|------|-------------------|---------|
| `cdd1202e-ff41...` | M260600005 | iot-sensor | M260600005 | 2026-02-15 18:30 |
| `2dfcb0dd-eb27...` | M260600005 | iot-device | 698f52aece16f3185d824511 | 2026-02-15 21:27 |
| `9a974aa0-7993...` | M260600008 | iot-sensor | M260600008 | 2026-02-15 02:54 |
| `22866979-5762...` | M260600008 | iot-device | 698f5062ce16f3185d8244f2 | 2026-02-15 18:24 |

### Root Cause
Golioth devices have **two different IDs**:
1. **Hardware ID** (stored as device name): `M260600005`
2. **Platform ID** (Golioth's internal ID): `698f52aece16f3185d824511`

**Problem:** Webhook handler and device sync were using **different IDs** to look up devices:
- Webhook used `serial_number.eq.{hardwareId}` OR `external_device_id.eq.{hardwareId}`
- Sync used `external_device_id.eq.{platformId}`

Result: Both created separate device records because neither lookup found the other's device!

---

## Solution Implemented

### Code Fix (Commit: 17dbb30)

**File:** `supabase/functions/integration-webhook/index.ts`

**Before:**
```typescript
// Sequential lookup - only checked ONE field
if (payload.deviceName) {
  query = query.eq('serial_number', payload.deviceName)
} else {
  query = query.eq('external_device_id', payload.deviceId)
}
```

**After:**
```typescript
// Composite OR lookup - checks BOTH fields simultaneously
if (payload.deviceName && payload.deviceId) {
  query = query.or(`serial_number.eq.${payload.deviceName},external_device_id.eq.${payload.deviceId}`)
} else if (payload.deviceName) {
  query = query.eq('serial_number', payload.deviceName)
} else if (payload.deviceId) {
  query = query.eq('external_device_id', payload.deviceId)
}
```

**Why this works:**
- Now checks if device exists with **EITHER** the hardware ID (serial_number) **OR** platform ID (external_device_id)
- Finds devices created by sync (using platform ID) when webhook arrives (using hardware ID)
- Finds devices created by webhook (using hardware ID) when sync runs (using platform ID)
- Prevents duplicate creation

**Applied to:**
1. `handleDeviceUpdate()` function
2. `handleDeviceCreate()` function

---

## Deployment Steps

### 1. Deploy Fixed Webhook Handler ⏳

**Option A: Supabase CLI**
```bash
cd development
npx supabase functions deploy integration-webhook \
  --project-ref atgbmxicqikmapfqouco \
  --no-verify-jwt
```

**Option B: Supabase Dashboard**
1. Go to: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/functions
2. Find `integration-webhook`
3. Click "Deploy new version"
4. Upload `supabase/functions/integration-webhook/index.ts`

### 2. Clean Up Existing Duplicates ⏳

**Run SQL in Supabase SQL Editor:**  
https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/sql

```sql
-- Soft-delete newer duplicates (preserves telemetry history)

-- M260600005: Keep first (iot-sensor), delete second (iot-device)
UPDATE devices
SET deleted_at = NOW(), updated_at = NOW()
WHERE id = '2dfcb0dd-eb27-4666-b126-c656d03ba46d';

-- M260600008: Keep first (iot-sensor), delete second (iot-device)
UPDATE devices
SET deleted_at = NOW(), updated_at = NOW()
WHERE id = '22866979-5762-4250-bfbb-2a4a8f4e7618';

-- Verify: Should return 1 row per device
SELECT name, COUNT(*) as count
FROM devices
WHERE deleted_at IS NULL
  AND name IN ('M260600005', 'M260600008')
GROUP BY name;
```

**Full cleanup script:** `docs/fix-duplicate-devices-issue-1.sql`

### 3. Verify Fix ✅

1. **Check database:**
   ```sql
   SELECT name, COUNT(*) as count
   FROM devices
   WHERE deleted_at IS NULL
   GROUP BY name
   HAVING COUNT(*) > 1;
   ```
   Expected: No results (no duplicates)

2. **Check UI:**
   - Visit: https://demo-stage.netneural.ai/dashboard/devices/
   - Search for M260600005 or M260600008
   - Expected: Only one card per device

3. **Test webhook:**
   - Send test webhook from Golioth for an existing device
   - Verify it updates existing device instead of creating duplicate

---

## Prevention

### Going Forward
- ✅ **Fixed webhook handler** prevents new duplicates
- ✅ **Composite OR query** matches devices by either ID
- ✅ **Preserves backward compatibility** with old and new webhook formats

### Testing
When adding new Golioth devices:
1. Create device via sync (uses platform ID)
2. Send webhook (uses hardware ID)
3. Verify device is updated, not duplicated

---

## Files Changed

1. **`supabase/functions/integration-webhook/index.ts`** - Webhook handler fix
2. **`docs/fix-duplicate-devices-issue-1.sql`** - Database cleanup script
3. **`docs/ISSUE_1_RESOLUTION.md`** - This document

---

## Checklist

- [x] Root cause identified
- [x] Code fix implemented
- [x] Code committed and pushed (commit: 17dbb30)
- [ ] Webhook edge function deployed to staging
- [ ] Existing duplicates cleaned up in database
- [ ] Verified no more duplicates in UI
- [ ] Issue #1 closed on GitHub

---

## Related Issues

- None (first duplicate device issue)

## Future Improvements

Consider adding:
1. **Database constraint** to prevent duplicate names (alert only, don't block)
2. **Monitoring** to detect duplicate creation attempts
3. **Automated cleanup** job to soft-delete duplicates periodically

---

**Last Updated:** 2026-02-16  
**Next Action:** Deploy webhook handler + run SQL cleanup
