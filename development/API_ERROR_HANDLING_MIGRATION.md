# API Error Handling Migration Guide

## Problem
Throughout the app, API calls were throwing errors on 401/403 responses, causing:
- Infinite redirect loops
- Console errors showing "Unauthorized" 
- Poor user experience when not authenticated
- Crashes instead of graceful degradation

## Solution
Created a centralized error handling utility: `src/lib/api-error-handler.ts`

This utility provides:
✅ Graceful handling of auth errors (401/403)
✅ Consistent error logging
✅ Smart retry logic for server errors
✅ Type-safe error information

---

## How to Migrate Your Code

### ❌ Before (Old Pattern)
```typescript
const response = await fetch('/api/endpoint', {
  headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) {
  throw new Error(`Failed to fetch: ${response.statusText}`);
}

const data = await response.json();
```

**Problems:**
- Throws on auth errors (401/403)
- No distinction between auth errors and other errors
- Crashes the component/context

### ✅ After (New Pattern)
```typescript
import { handleApiError } from '@/lib/api-error-handler';

const response = await fetch('/api/endpoint', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const errorResult = handleApiError(response, {
  errorPrefix: 'Failed to fetch data',
  throwOnError: false,
});

if (errorResult.isAuthError) {
  // User not authenticated - handle gracefully
  return null; // or set state to empty
}

if (!response.ok) {
  // Other errors - handle or return
  return null;
}

const data = await response.json();
```

---

## Usage Examples

### Example 1: Context Provider (OrganizationContext)
```typescript
import { handleApiError } from '@/lib/api-error-handler';

const fetchOrganizations = async () => {
  const response = await fetch(`${url}/organizations`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const errorResult = handleApiError(response, {
    errorPrefix: 'Failed to fetch organizations',
    throwOnError: false,
  });

  if (errorResult.isAuthError) {
    setOrganizations([]);
    return;
  }

  if (!response.ok) {
    setOrganizations([]);
    return;
  }

  const data = await response.json();
  setOrganizations(data);
};
```

### Example 2: Component with User Feedback
```typescript
import { handleApiError } from '@/lib/api-error-handler';

const handleSave = async () => {
  try {
    const response = await fetch('/api/save', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    const errorResult = handleApiError(response, {
      errorPrefix: 'Failed to save',
      throwOnError: false,
    });

    if (errorResult.isAuthError) {
      toast.error('Please log in to continue');
      router.push('/auth/login');
      return;
    }

    if (!response.ok) {
      toast.error(`Save failed: ${response.statusText}`);
      return;
    }

    toast.success('Saved successfully!');
  } catch (error) {
    toast.error('Network error occurred');
  }
};
```

### Example 3: Using safeFetch Helper
```typescript
import { safeFetch } from '@/lib/api-error-handler';

const loadData = async () => {
  const response = await safeFetch('/api/data', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  }, {
    errorPrefix: 'Failed to load data'
  });

  if (!response) {
    // Auth error occurred, handle gracefully
    setData(null);
    return;
  }

  const data = await response.json();
  setData(data);
};
```

---

## API Reference

### `handleApiError(response, options)`
Handles API response errors with smart auth detection.

**Parameters:**
- `response: Response` - The fetch Response object
- `options?: ApiErrorOptions`:
  - `throwOnError?: boolean` - Throw for non-auth errors (default: true)
  - `logErrors?: boolean` - Log to console (default: true)
  - `errorPrefix?: string` - Custom error message prefix
  - `silentAuthErrors?: boolean` - Handle 401/403 silently (default: true)

**Returns:** `ApiErrorResult`
```typescript
{
  isAuthError: boolean;      // true if 401 or 403
  isError: boolean;          // true if !response.ok
  statusCode: number;        // HTTP status code
  statusText: string;        // Status message
  shouldRetry: boolean;      // true for 5xx errors
}
```

### `isAuthError(response)`
Quick check if response is 401 or 403.

### `isServerError(response)`
Quick check if response is 5xx.

### `isClientError(response)`
Quick check if response is 4xx (excluding 401/403).

### `safeFetch(url, options, errorOptions)`
Wrapper for fetch that auto-handles errors. Returns `null` for auth errors.

---

## Files That Need Migration

Run this search to find all files that need updating:
```bash
grep -r "if (!response.ok)" src/
```

### Priority Files (High Traffic):
1. ✅ `src/contexts/OrganizationContext.tsx` - **DONE**
2. ✅ `src/contexts/UserContext.tsx` - **DONE**
3. `src/components/dashboard/SystemStatsCard.tsx`
4. `src/components/dashboard/AlertsCard.tsx`
5. `src/components/devices/DevicesList.tsx`
6. `src/services/integration.service.ts`
7. `src/app/dashboard/settings/components/IntegrationsTab.tsx`
8. `src/app/dashboard/organizations/components/MembersTab.tsx`
9. `src/components/organizations/CreateOrganizationDialog.tsx`
10. `src/components/organizations/EditOrganizationDialog.tsx`

### Database/Lib Files:
- `src/lib/database/devices.ts`
- `src/lib/integrations/organization-integrations.ts`

---

## Migration Checklist

For each file with `if (!response.ok)`:

- [ ] Import `handleApiError` from `@/lib/api-error-handler`
- [ ] Call `handleApiError()` after fetch
- [ ] Check `errorResult.isAuthError` and handle gracefully
- [ ] Remove or update `throw new Error()` statements
- [ ] Test the component/context with:
  - ✅ Valid authentication
  - ✅ Invalid/expired token (401)
  - ✅ Insufficient permissions (403)
  - ✅ Server errors (500)
  - ✅ Network failures

---

## Benefits

✅ **Prevents redirect loops** - Auth errors don't throw
✅ **Better UX** - Graceful degradation instead of crashes
✅ **Consistent logging** - All API errors logged the same way
✅ **Type safety** - Error results are strongly typed
✅ **Easier debugging** - Clear distinction between error types
✅ **Future proof** - Easy to add retry logic, rate limiting, etc.

---

## Notes

- Auth errors (401/403) are logged as `[Auth]` not `[API Error]`
- Server errors (5xx) are marked as `shouldRetry: true`
- The utility works with both client and server-side code
- Can be extended for custom error handling per endpoint
- Compatible with Sentry error tracking
