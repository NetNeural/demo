# CRITICAL ISSUES FOUND - Organization Filtering & Missing Functionality

## 🚨 Critical Issues Discovered

### Issue #1: Components Not Filtering by Organization (FIXED)

**Problem:** Components were showing ALL data across ALL organizations instead of filtering by current organization.

**Root Cause:** Components were calling edge functions WITHOUT the `organization_id` query parameter.

**Impact:**

- User sees devices from ALL organizations, not just their current one
- Alert counts don't match between dashboard and detail pages
- Confusing user experience - data seems inconsistent

**Components Fixed:**

1. ✅ **DevicesList.tsx** - Now filters by `currentOrganization.id`
2. ✅ **AlertsCard.tsx** - Now filters by `currentOrganization.id`
3. ✅ **SystemStatsCard.tsx** - Now filters by `currentOrganization.id`
4. ✅ **IntegrationsTab.tsx** - Already correct (uses prop)

---

### Issue #2: Missing Add/Edit Functionality

**Problem:** No buttons or dialogs to add/edit devices, alerts, integrations, etc.

**Missing Components:**

- [ ] Add Device button & dialog
- [ ] Edit Device dialog
- [ ] Delete Device confirmation
- [ ] Add Alert/Configure Alerts
- [ ] Mark Alert as Resolved
- [ ] Add Integration button (in IntegrationsTab)
- [ ] Edit Integration dialog
- [ ] Test Integration button functionality

---

## 🔧 Changes Made

### 1. DevicesList.tsx

**Before:**

```typescript
const response = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/devices`,
  { headers: { ... } }
);
```

**After:**

```typescript
import { useOrganization } from '@/contexts/OrganizationContext'

const { currentOrganization } = useOrganization()

const fetchDevices = useCallback(async () => {
  if (!currentOrganization) return;

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/devices?organization_id=${currentOrganization.id}`;
  const response = await fetch(url, { headers: { ... } });
}, [currentOrganization])
```

**Result:** Now only shows devices for current organization

---

### 2. AlertsCard.tsx

**Before:**

```typescript
const response = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/alerts`,
  { headers: { ... } }
);
```

**After:**

```typescript
import { useOrganization } from '@/contexts/OrganizationContext'

const { currentOrganization } = useOrganization()

const fetchAlerts = useCallback(async () => {
  if (!currentOrganization) return;

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/alerts?organization_id=${currentOrganization.id}`;
  const response = await fetch(url, { headers: { ... } });
}, [currentOrganization])
```

**Result:** Now only shows alerts for current organization

---

### 3. SystemStatsCard.tsx

**Before:**

```typescript
const response = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dashboard-stats`,
  { headers: { ... } }
);
```

**After:**

```typescript
import { useOrganization } from '@/contexts/OrganizationContext'

const { currentOrganization } = useOrganization()

const fetchStats = useCallback(async () => {
  if (!currentOrganization) return;

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dashboard-stats?organization_id=${currentOrganization.id}`;
  const response = await fetch(url, { headers: { ... } });
}, [currentOrganization])
```

**Result:** Now only shows stats for current organization

---

## 🧪 Testing Instructions

### 1. Test Organization Filtering

**Steps:**

1. Start dev server: `npm run dev`
2. Login as superadmin@netneural.ai
3. Check dashboard shows stats for current org
4. Switch to different organization
5. Verify all numbers change (devices, alerts, stats)

**Expected Results:**

- Dashboard device count = Devices page device count
- Dashboard alert count = Alerts shown in AlertsCard
- Switching orgs updates all data immediately

**Before Fix:**

- Dashboard shows 3 devices for Org A
- Devices page shows 50 devices (ALL orgs combined) ❌

**After Fix:**

- Dashboard shows 3 devices for Org A
- Devices page shows 3 devices (ONLY Org A) ✅

---

### 2. Verify Data Consistency

**Test Case 1: NetNeural Industries**

```bash
# Check database
SELECT COUNT(*) FROM devices WHERE organization_id = 'org-1';  # Should match UI
SELECT COUNT(*) FROM alerts WHERE organization_id = 'org-1';   # Should match UI
```

**Test Case 2: Acme Manufacturing**

```bash
SELECT COUNT(*) FROM devices WHERE organization_id = 'org-2';  # Should match UI
SELECT COUNT(*) FROM alerts WHERE organization_id = 'org-2';   # Should match UI
```

**Test Case 3: Switch Organizations**

1. Select "NetNeural Industries" from organization switcher
2. Note device count on dashboard (e.g., 15 devices)
3. Go to Devices page, count should match (15 devices)
4. Switch to "Acme Manufacturing"
5. Device count changes (e.g., 8 devices)
6. Go to Devices page, should show 8 devices

---

## 🚧 Still Missing - Add/Edit Functionality

### Devices Page Missing:

1. **Add Device Button** - Should open dialog to register new device
2. **Edit Device Button** - Should open dialog to edit device details
3. **Delete Device Button** - Should confirm and delete device
4. **Sync Device Button** - Should trigger device sync

### Alerts Missing:

1. **Resolve Alert Button** - Mark alert as resolved
2. **Acknowledge Alert Button** - Acknowledge alert
3. **Configure Alerts** - Set alert thresholds/rules

### Integrations Missing:

1. **Add Integration Button** - Add new integration (Golioth, Email, etc.)
2. **Edit Integration Button** - Edit integration settings
3. **Test Integration Button** - Verify integration works
4. **Delete Integration Button** - Remove integration

---

## 🎯 Next Steps

### Immediate (Critical):

1. ✅ Fix organization filtering (COMPLETE)
2. [ ] Test switching between organizations
3. [ ] Verify counts match everywhere

### Short-term (High Priority):

1. [ ] Add "Add Device" button and dialog
2. [ ] Add "Edit Device" dialog
3. [ ] Add "Resolve Alert" button functionality
4. [ ] Make integration buttons functional

### Medium-term:

1. [ ] Create device registration flow
2. [ ] Create alert configuration UI
3. [ ] Add bulk operations (select multiple devices)
4. [ ] Add device search/filter

---

## 📋 Verification Checklist

### Organization Filtering:

- [x] DevicesList filters by organization
- [x] AlertsCard filters by organization
- [x] SystemStatsCard filters by organization
- [x] IntegrationsTab filters by organization (was already correct)
- [ ] Dashboard device count = Devices page count
- [ ] Dashboard alert count = AlertsCard count
- [ ] Switching orgs updates all data

### Data Consistency:

- [ ] Device counts match between pages
- [ ] Alert counts match between pages
- [ ] Stats are accurate for selected org
- [ ] No cross-org data leakage

### Missing Functionality:

- [ ] Add Device works
- [ ] Edit Device works
- [ ] Delete Device works
- [ ] Resolve Alert works
- [ ] Add Integration works
- [ ] Edit Integration works
- [ ] Test Integration works

---

## 🐛 Known Issues

### Issue: Edge Functions May Not Filter Properly

**Check edge function code:**

```typescript
// In supabase/functions/devices/index.ts
// Verify it respects organization_id query parameter
const organizationId = url.searchParams.get('organization_id')
if (organizationId) {
  query = query.eq('organization_id', organizationId)
}
```

If edge function doesn't filter, RLS should still protect data, but need to verify.

---

## 📊 Expected Behavior After Fixes

### Scenario: User in "NetNeural Industries"

- **Dashboard:** Shows 15 devices, 5 alerts, 92% uptime
- **Devices Page:** Shows 15 devices (same 15 from dashboard)
- **Alerts:** Shows 5 alerts (same 5 from dashboard)
- **Integrations:** Shows integrations for NetNeural only

### Scenario: Switch to "Acme Manufacturing"

- **Dashboard:** Shows 8 devices, 12 alerts, 85% uptime
- **Devices Page:** Shows 8 devices (different devices)
- **Alerts:** Shows 12 alerts (different alerts)
- **Integrations:** Shows integrations for Acme only

**Key Point:** Numbers should be CONSISTENT across all pages for the SAME organization.

---

## 🔍 Debugging Tips

### Check Network Tab:

```
# Should see:
GET /functions/v1/devices?organization_id=org-1
GET /functions/v1/alerts?organization_id=org-1
GET /functions/v1/dashboard-stats?organization_id=org-1

# Should NOT see:
GET /functions/v1/devices (without organization_id)
```

### Check Console:

```javascript
// Should NOT see:
'Showing all devices across all organizations'

// Should see:
'Fetching devices for organization: org-1'
```

### Check Database:

```sql
-- Verify organization has correct data
SELECT
  o.name,
  COUNT(DISTINCT d.id) as device_count,
  COUNT(DISTINCT a.id) as alert_count
FROM organizations o
LEFT JOIN devices d ON d.organization_id = o.id
LEFT JOIN alerts a ON a.organization_id = o.id
WHERE o.id = 'org-1'
GROUP BY o.name;
```

---

## ✅ Success Criteria

**Fix is successful when:**

1. ✅ All components filter by current organization
2. ✅ Device count matches between dashboard and devices page
3. ✅ Alert count matches between dashboard and alerts card
4. ✅ Switching organizations updates all data
5. ✅ No compile errors or TypeScript errors
6. [ ] Add/Edit buttons are functional (still TODO)

**Current Status:**

- Organization filtering: ✅ FIXED
- Data consistency: 🧪 NEEDS TESTING
- Add/Edit functionality: ❌ MISSING (separate work needed)
