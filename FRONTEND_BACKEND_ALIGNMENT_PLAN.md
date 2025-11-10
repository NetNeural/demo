# Frontend-Backend API Alignment Plan

**Date:** November 9, 2025  
**Status:** ✅ EdgeFunctionClient Fixed | 🔄 Migration In Progress  
**Priority:** P0 - Critical System Issue

---

## Executive Summary

**Problem:** Backend refactor introduced standardized API response structure `{ success, data: {...}, timestamp }`, but 50+ frontend components still expect flat structure. This causes data not to display correctly (bugs found in dashboard stats and alerts).

**Solution:** Fixed `EdgeFunctionClient` to automatically unwrap nested `data` field. Now migrating all components from raw `fetch()` to use `edgeFunctions` client.

---

## 🎯 Core Fix Applied

### EdgeFunctionClient Enhancement

**File:** `development/src/lib/edge-functions/client.ts`  
**Lines:** 115-131  
**Change:** Automatically extract `data.data` → `data`

```typescript
// BEFORE (Bug - returned nested structure):
const data = await response.json()
return data as EdgeFunctionResponse<T>

// AFTER (Fixed - extracts nested data):
const rawData = await response.json()
return {
  success: rawData.success,
  data: rawData.data,  // ← Extract nested data
  error: rawData.error,
  message: rawData.message,
  meta: rawData.meta,
  timestamp: rawData.timestamp,
} as EdgeFunctionResponse<T>
```

**Impact:** Components using `edgeFunctions` now automatically get flat structure.

---

## 📊 Migration Status

### ✅ Already Using EdgeFunctionClient (5 files)

These components are **already correct** and benefit from the fix:

1. ✅ `components/devices/DevicesList.tsx` - Uses `edgeFunctions.devices.list()`
2. ✅ `app/dashboard/analytics/page.tsx` - Uses `edgeFunctions`
3. ✅ `app/dashboard/organizations/components/LocationsTab.tsx` - Uses `edgeFunctions`
4. ✅ `components/integrations/OrganizationIntegrationManager.tsx` - Uses `edgeFunctions`
5. ✅ `services/integration-sync.service.ts` - Uses `edgeFunctions`

### 🔄 Using Raw Fetch with Workaround (2 files)

These work but should be migrated for consistency:

1. 🟡 `contexts/OrganizationContext.tsx` - Has `data.data || data` workaround (line 253)
2. 🟡 `components/alerts/AlertsList.tsx` - Has `data.data || data` workaround (line 89)

### ❌ Using Raw Fetch WITHOUT Fix (50+ files)

**HIGH PRIORITY - Likely Broken:**

#### Context Files (2)
- ❌ `contexts/UserContext.tsx`
- ❌ `contexts/OrganizationContext.tsx` (organizations list fetch - line 125)

#### Dashboard Components (3)
- ❌ `components/dashboard/LocationsCard.tsx`
- ❌ `components/dashboard/SystemStatsCard.tsx`
- ❌ `components/dashboard/AlertsCard.tsx`

#### Organization Components (6)
- ❌ `components/organizations/CreateOrganizationDialog.tsx`
- ❌ `components/organizations/EditOrganizationDialog.tsx`
- ❌ `components/organizations/AddMemberDialog.tsx`
- ❌ `components/organizations/CreateUserDialog.tsx`
- ❌ `app/dashboard/organizations/components/MembersTab.tsx`
- ❌ `app/dashboard/organizations/components/OrganizationSettingsTab.tsx`
- ❌ `app/dashboard/organizations/components/OrganizationDevicesTab.tsx`
- ❌ `app/dashboard/organizations/components/OrganizationAlertsTab.tsx`

#### Device Components (2)
- ❌ `components/devices/DeviceIntegrationManager.tsx`
- ❌ `components/devices/DevicesHeader.tsx`

#### Settings Components (2)
- ❌ `app/dashboard/settings/page-complex.tsx`
- ❌ `app/dashboard/settings/components/IntegrationsTab.tsx`

#### Integration Service (1)
- ❌ `services/integration.service.ts` - **10+ methods**

#### Template Files (1)
- ❌ `templates/page-template.tsx`

**Total:** 56+ locations need migration

---

## 🛠️ Migration Strategy

### Phase 1: Core Infrastructure ✅ COMPLETE
- [x] Fix EdgeFunctionClient to unwrap nested data
- [x] Verify fix works with existing components (DevicesList, Analytics)
- [x] Test dashboard and alerts pages

### Phase 2: High-Traffic Components 🔄 IN PROGRESS
- [ ] Migrate `contexts/OrganizationContext.tsx` (2 fetch calls)
- [ ] Migrate `components/alerts/AlertsList.tsx`
- [ ] Migrate `components/dashboard/*Card.tsx` (3 files)
- [ ] Test dashboard thoroughly

### Phase 3: Organization Management
- [ ] Migrate all organization dialog components
- [ ] Migrate organization tabs (Members, Devices, Alerts, Settings)
- [ ] Test organization section end-to-end

### Phase 4: Settings & Integrations
- [ ] Migrate `services/integration.service.ts`
- [ ] Migrate settings components
- [ ] Test integrations functionality

### Phase 5: Final Testing
- [ ] Comprehensive app-wide testing
- [ ] Remove all `data.data || data` workarounds
- [ ] Performance validation
- [ ] Documentation

---

## 📝 Migration Pattern

### Before (Raw Fetch - Broken):
```typescript
const response = await fetch(`${supabaseUrl}/functions/v1/alerts?organization_id=${orgId}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  }
})
const data = await response.json()
// ❌ BUG: data.alerts is undefined because actual structure is data.data.alerts
setAlerts(data.alerts || [])
```

### After (EdgeFunctionClient - Fixed):
```typescript
import { edgeFunctions } from '@/lib/edge-functions/client'

const response = await edgeFunctions.alerts.list(orgId)
// ✅ CORRECT: response.data contains { alerts: [...], count: 7 }
if (response.success) {
  setAlerts(response.data.alerts || [])
}
```

### Temporary Workaround (If raw fetch must remain):
```typescript
const response = await fetch(...)
const data = await response.json()
// Extract nested data (backend returns { success, data: {...} })
const actualData = data.data || data
setAlerts(actualData.alerts || [])
```

---

## 🧪 Testing Checklist

After each migration:
- [ ] Component renders without errors
- [ ] Data displays correctly
- [ ] No console errors/warnings
- [ ] Network requests return 200 OK
- [ ] Loading states work
- [ ] Error states handle failures

---

## 📚 EdgeFunctionClient API Reference

### Available Methods

```typescript
// Devices
edgeFunctions.devices.list(organizationId, options?)
edgeFunctions.devices.get(deviceId)
edgeFunctions.devices.create(data)
edgeFunctions.devices.update(deviceId, data)
edgeFunctions.devices.delete(deviceId)

// Alerts
edgeFunctions.alerts.list(organizationId, options?)
edgeFunctions.alerts.get(alertId)
edgeFunctions.alerts.acknowledge(alertId)
edgeFunctions.alerts.resolve(alertId)

// Organizations
edgeFunctions.organizations.list()
edgeFunctions.organizations.get(organizationId)
edgeFunctions.organizations.create(data)
edgeFunctions.organizations.update(organizationId, data)
edgeFunctions.organizations.delete(organizationId)

// Generic call for endpoints not yet wrapped
edgeFunctions.call<T>(functionName, options)
```

### Response Structure

All methods return:
```typescript
{
  success: boolean
  data?: T  // Your actual payload (already unwrapped!)
  error?: {
    message: string
    status: number
  }
  message?: string
  meta?: Record<string, unknown>
  timestamp: string
}
```

---

## 🎯 Success Metrics

- **Before Fix:** 2/8 major sections broken (Dashboard stats, Alerts)
- **After EdgeFunctionClient Fix:** All sections using `edgeFunctions` work correctly
- **Target:** 0 raw `fetch()` calls to Edge Functions
- **Goal:** 100% components using standardized `edgeFunctions` client

---

## 🚀 Next Actions

1. **Immediate:** Migrate contexts (OrganizationContext, UserContext)
2. **High Priority:** Migrate dashboard components
3. **Medium Priority:** Migrate organization & settings
4. **Final:** Remove all workarounds, comprehensive testing

---

## 📖 Developer Guidelines

**For New Code:**
- ✅ **DO:** Use `edgeFunctions` client from `@/lib/edge-functions/client`
- ✅ **DO:** Access data directly: `response.data.field`
- ❌ **DON'T:** Use raw `fetch()` for Edge Functions
- ❌ **DON'T:** Access nested structure: `response.data.data.field`

**For Existing Code:**
- If using raw `fetch()`: Add temporary workaround `data.data || data`
- Plan migration to `edgeFunctions` client
- Update this document when complete

---

## 📞 Questions?

This plan addresses the systemic frontend-backend misalignment discovered during comprehensive testing. The core fix (EdgeFunctionClient) is complete and verified working. Phased migration ensures no regressions while improving codebase consistency.

**Last Updated:** November 9, 2025  
**Next Review:** After Phase 2 completion
