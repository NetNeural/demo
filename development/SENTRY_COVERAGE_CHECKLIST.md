# Sentry Error Handling - Coverage Checklist

## ✅ Infrastructure Complete

### Global Coverage (Automatic)
- [x] **Root Error Boundary** - `src/app/global-error.tsx`
  - Catches all unhandled React errors
  - Shows user-friendly error page
  - Auto-sends to Sentry with feedback dialog

- [x] **Dashboard Error Boundary** - `src/app/dashboard/error.tsx`
  - Dashboard-specific error handling
  - Custom UI for dashboard errors

- [x] **Auth Error Boundary** - `src/app/auth/error.tsx`
  - Authentication-specific error handling
  - Custom messaging for auth issues

- [x] **Global Error Handlers** - `src/components/SentryInit.tsx`
  - Unhandled JavaScript errors
  - Unhandled promise rejections
  - Automatic Sentry initialization

- [x] **Utilities** - `src/lib/sentry-utils.ts`
  - `handleApiError()` - API error handling with auto feedback
  - `reportError()` - Manual error reporting
  - `withSentryErrorHandler()` - Function wrapper

- [x] **Reusable Error Boundary** - `src/lib/error-boundary-wrapper.tsx`
  - Component-level error boundaries
  - Customizable fallback UI

- [x] **Page Template** - `src/templates/page-template.tsx`
  - Template for new pages with built-in error handling
  - Examples for API calls and manual reporting

## 📋 Component Coverage Status

### ✅ Using handleApiError (Global Solution)
- [x] `src/app/dashboard/organizations/components/MembersTab.tsx`
  - GET /api/organizations/{id}/members
  - DELETE /api/organizations/{id}/members/{userId}

### ⚠️ Needs Review - API Calls Without Error Handling

Use this checklist to find and update components with API calls:

```bash
# Find fetch calls
grep -r "fetch(" src/app --include="*.tsx" --include="*.ts"

# Find axios calls  
grep -r "axios." src/app --include="*.tsx" --include="*.ts"

# Find try/catch with console.error
grep -r "console.error" src/app --include="*.tsx" --include="*.ts"
```

### Pages to Review

Update these patterns when you find them:

#### ❌ Before (Missing Sentry):
```typescript
try {
  const response = await fetch('/api/data');
  if (!response.ok) throw new Error('Failed');
  const data = await response.json();
} catch (error) {
  console.error(error); // ❌ Not sent to Sentry
  toast.error('Something went wrong'); // ❌ No user feedback dialog
}
```

#### ✅ After (With Sentry):
```typescript
import { handleApiError } from '@/lib/sentry-utils';

try {
  const response = await fetch('/api/data');
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.error || `HTTP ${response.status}`);
    
    handleApiError(error, {
      endpoint: '/api/data',
      method: 'GET',
      status: response.status,
      errorData,
    });
    
    throw error;
  }
  const data = await response.json();
} catch (error) {
  console.error('Failed to fetch data:', error);
  // Error already sent to Sentry by handleApiError
}
```

## 🎯 Coverage by Route

### Dashboard Routes
- [ ] `/dashboard` - `src/app/dashboard/page.tsx`
- [ ] `/dashboard/users` - `src/app/dashboard/users/page.tsx`
- [ ] `/dashboard/devices` - `src/app/dashboard/devices/page.tsx`
- [ ] `/dashboard/alerts` - `src/app/dashboard/alerts/page.tsx`
- [ ] `/dashboard/analytics` - `src/app/dashboard/analytics/page.tsx`
- [ ] `/dashboard/integrations` - `src/app/dashboard/integrations/page.tsx`
- [ ] `/dashboard/organizations` - `src/app/dashboard/organizations/page.tsx`
- [x] `/dashboard/organizations/[id]/members` - MembersTab.tsx ✅
- [ ] `/dashboard/settings` - `src/app/dashboard/settings/page.tsx`

### Auth Routes
- [ ] `/auth/login` - `src/app/auth/login/page.tsx`

### Other Routes
- [ ] `/` - `src/app/page.tsx`
- [x] `/test-sentry` - `src/app/test-sentry/page.tsx` ✅

## 🔍 Component Audit

### Components with Potential API Calls

Review these components for fetch/API calls:

#### Settings Components
- [ ] `src/app/dashboard/settings/components/OrganizationsTab.tsx`
- [ ] `src/app/dashboard/settings/components/UsersTab.tsx`
- [ ] `src/app/dashboard/settings/components/DevicesTab.tsx`
- [ ] `src/app/dashboard/settings/components/IntegrationsTab.tsx`

#### Dashboard Components
- [ ] `src/components/dashboard/AlertsCard.tsx`
- [ ] `src/components/dashboard/StatsCard.tsx`
- [ ] `src/components/dashboard/DeviceStatusChart.tsx`

#### User Components
- [ ] `src/components/users/UsersList.tsx`
- [ ] `src/components/users/EditUserDialog.tsx`
- [ ] `src/components/users/ImportUsersDialog.tsx`
- [ ] `src/components/users/UsersHeader.tsx`

#### Device Components
- [ ] `src/components/devices/DeviceIntegrationManager.tsx`
- [ ] `src/components/devices/DeviceList.tsx`

#### Organization Components
- [ ] `src/components/organizations/OrganizationSwitcher.tsx`

## 📝 Action Items

### High Priority
1. **Audit all API calls** - Search for fetch/axios without handleApiError
2. **Update existing error handling** - Replace console.error with proper Sentry reporting
3. **Test error boundaries** - Verify each error.tsx file works correctly

### Medium Priority
1. **Document error handling** - Add JSDoc comments to functions with error handling
2. **Review error messages** - Ensure user-facing error messages are helpful
3. **Add context to errors** - Include user IDs, org IDs where relevant

### Low Priority
1. **Cleanup console.logs** - Remove debug logs in production code
2. **Add error boundary tests** - Test error boundary components
3. **Monitor Sentry dashboard** - Review error patterns weekly

## 🚀 New Page Checklist

When creating a new page:

1. **Copy the template**
   ```bash
   cp src/templates/page-template.tsx src/app/your-route/page.tsx
   ```

2. **Update the component name** - Change `NewPageTemplate` to your page name

3. **For API calls** - Use the `handleApiError` example as reference

4. **For risky components** - Wrap in `<ErrorBoundaryWrapper>`

5. **Test error scenarios**
   - Trigger a 404 error
   - Trigger a 500 error
   - Cause a React render error
   - Verify Sentry receives the errors

## 🧪 Testing

### Manual Testing
1. Visit each route and trigger errors
2. Verify errors appear in Sentry dashboard
3. In production mode, verify user sees feedback dialog

### Automated Testing
```bash
# Run tests
npm test

# Check build
npm run build

# Test production build
npm run start
```

## 📊 Success Metrics

Track these in Sentry dashboard:

- **Error Count**: Should see errors coming in from all routes
- **Source Files**: Errors should include proper source maps
- **User Feedback**: Users should be submitting feedback via dialogs
- **Context Data**: Errors should include tags, user info, breadcrumbs

## 🔗 Resources

- [Sentry Dashboard](https://sentry.io)
- [Developer Guide](./SENTRY_GUIDE.md)
- [Page Template](./src/templates/page-template.tsx)
- [Utility Functions](./src/lib/sentry-utils.ts)
- [Error Boundary](./src/lib/error-boundary-wrapper.tsx)

---

**Last Updated**: November 3, 2025
**Status**: Infrastructure complete, component audit in progress
