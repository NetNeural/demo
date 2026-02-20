# Organization Persistence Fix

## Problem

When clicking on different sections in the sidebar (Dashboard, Devices, Alerts, Analytics, etc.), the selected organization was not persisting. The organization selector would reset, causing users to have to re-select their organization after every navigation.

## Root Cause

The `OrganizationContext` was initializing with `null` state and only loading from localStorage **after** the organizations were fetched. This created a race condition where:

1. Page loads → currentOrgId is `null`
2. Component renders with no organization
3. Organizations fetch from API
4. localStorage is checked and organization restored
5. Component re-renders

During step 2, if the user navigated to a different page, the context would reset back to step 1.

## Solution

### 1. **Immediate localStorage Loading** ✅

Changed the initial state to load from localStorage immediately:

```typescript
// Before (BAD)
const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)

// After (GOOD)
const [currentOrgId, setCurrentOrgId] = useState<string | null>(() => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('netneural_current_org')
  }
  return null
})
```

This ensures the saved organization ID is available from the very first render.

### 2. **Smart Auto-Selection** ✅

Updated the auto-select logic to respect saved selections:

```typescript
// Auto-select first org if none selected AND none saved in localStorage
const savedOrgId = localStorage.getItem('netneural_current_org')
if (!savedOrgId && mockOrgs.length > 0 && mockOrgs[0]) {
  // Only auto-select if there's NO saved selection
  setCurrentOrgId(mockOrgs[0].id)
  localStorage.setItem('netneural_current_org', mockOrgs[0].id)
} else if (savedOrgId && mockOrgs.some((org) => org.id === savedOrgId)) {
  // Ensure the saved org is set
  setCurrentOrgId(savedOrgId)
}
```

### 3. **Validation on Load** ✅

Added validation to ensure saved organization still exists:

```typescript
useEffect(() => {
  if (userOrganizations.length > 0 && currentOrgId) {
    // Check if saved org is still valid
    const orgExists = userOrganizations.some((org) => org.id === currentOrgId)
    if (!orgExists && userOrganizations[0]) {
      // If saved org doesn't exist, select first available
      setCurrentOrgId(userOrganizations[0].id)
      localStorage.setItem('netneural_current_org', userOrganizations[0].id)
    }
  }
}, [userOrganizations, currentOrgId])
```

### 4. **Removed Circular Dependency** ✅

Removed `currentOrgId` from the `fetchUserOrganizations` dependency array to prevent unnecessary refetches:

```typescript
// Before
}, [user?.id, currentOrgId]); // ❌ currentOrgId caused extra fetches

// After
}, [user?.id]); // ✅ Only refetch when user changes
```

## How It Works Now

### Initial Page Load:

1. ✅ OrganizationContext initializes with saved orgId from localStorage
2. ✅ Component renders immediately with correct organization
3. ✅ Organizations fetch from API in background
4. ✅ Saved organization is validated when orgs load
5. ✅ Stats load for the selected organization

### Navigation Between Pages:

1. ✅ User clicks Dashboard → Context maintains currentOrgId
2. ✅ User clicks Devices → Context maintains currentOrgId
3. ✅ User clicks Alerts → Context maintains currentOrgId
4. ✅ Organization selection persists across ALL navigation

### Switching Organizations:

1. ✅ User selects different org from dropdown
2. ✅ `switchOrganization()` updates state
3. ✅ New orgId saved to localStorage
4. ✅ All pages re-render with new org data
5. ✅ Selection persists on navigation

## Testing Checklist

- [x] Organization loads from localStorage on initial page load
- [x] Organization persists when navigating between Dashboard/Devices/Alerts/Analytics
- [x] Organization persists on browser refresh
- [x] Switching organizations updates localStorage
- [x] New selection persists across navigation
- [x] If saved org no longer exists, first available org is selected
- [x] If no orgs exist, no errors are thrown
- [x] No infinite re-render loops
- [x] No unnecessary API calls

## Files Changed

### `src/contexts/OrganizationContext.tsx`

**Changes:**

1. Initialize `currentOrgId` from localStorage immediately (lazy initialization)
2. Updated `fetchUserOrganizations` to respect saved selection
3. Removed `currentOrgId` from fetch dependencies
4. Added validation useEffect for saved organization
5. Improved auto-select logic

**Lines Modified:** ~20 lines

## User Experience

### Before Fix:

```
User selects "Acme Manufacturing"
Clicks "Devices" → Organization resets to "NetNeural Industries" ❌
Clicks "Alerts" → Organization resets again ❌
Frustrating experience!
```

### After Fix:

```
User selects "Acme Manufacturing"
Clicks "Devices" → Still "Acme Manufacturing" ✅
Clicks "Alerts" → Still "Acme Manufacturing" ✅
Refreshes page → Still "Acme Manufacturing" ✅
Perfect experience!
```

## Technical Details

### localStorage Key:

- **Key:** `netneural_current_org`
- **Value:** Organization ID (e.g., `"org-1"`, `"org-2"`)
- **Scope:** Per browser, per domain
- **Persistence:** Until cleared or user logs out

### State Flow:

```
localStorage → Initial State → Context → All Components
     ↑                                         ↓
     └─────────────────────────────────────────┘
              (Updates on org switch)
```

### SSR Compatibility:

The fix includes a check for `typeof window !== 'undefined'` to ensure it works with Next.js server-side rendering without errors.

## Future Enhancements

1. **Clear on Logout:** Add logic to clear localStorage when user logs out
2. **Multi-Tab Sync:** Use `storage` event to sync org selection across browser tabs
3. **Session Storage:** Consider using sessionStorage for temporary selections
4. **User Preferences API:** Store org preference on server for cross-device sync

## Summary

**Problem:** Organization selection not persisting across page navigation
**Solution:** Load from localStorage immediately, respect saved selection, validate on load
**Result:** ✅ Organization now persists perfectly across all navigation
**Impact:** Dramatically improved user experience, no more re-selecting organization
