# GitHub Issues Research & Validation Report

**Date:** November 6, 2025
**Issues Analyzed:** #71, #70, #68, #64, #62, #58, #56

---

## ✅ Issue #71: Device page needs the ability to delete a device

### Research Findings:

**Status:** ❌ CONFIRMED - Delete functionality is MISSING

**Location:** `src/components/devices/DevicesList.tsx`

**Current State:**

- Device Details Dialog (line 298-418) has:
  - ✅ "Close" button
  - ✅ "Edit Device" button
  - ❌ **NO Delete button**
- Edit functionality exists (line 123-171)
- No `handleDeleteDevice` function found

### Solution:

**Add delete button to device details dialog**

```tsx
// In DevicesList.tsx, line ~415 (in device details dialog actions)
<div className="flex justify-end gap-2">
  <Button variant="outline" onClick={() => setDetailsOpen(false)}>
    Close
  </Button>
  <Button
    variant="destructive"
    onClick={() => handleDeleteDevice(selectedDevice)}
  >
    Delete Device
  </Button>
  <Button
    onClick={() => {
      openEditDialog(selectedDevice)
      setDetailsOpen(false)
    }}
  >
    Edit Device
  </Button>
</div>
```

**Add handler function:**

```typescript
const handleDeleteDevice = async (device: Device) => {
  if (
    !confirm(
      `Are you sure you want to delete "${device.name}"? This action cannot be undone.`
    )
  ) {
    return
  }

  try {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      toast.error('Not authenticated. Please log in.')
      return
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/devices/${device.id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: currentOrganization.id,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete device')
    }

    toast.success('Device deleted successfully')
    setDetailsOpen(false)
    fetchDevices()
  } catch (err) {
    console.error('Error deleting device:', err)
    toast.error(err instanceof Error ? err.message : 'Failed to delete device')
  }
}
```

**Files to modify:**

1. `src/components/devices/DevicesList.tsx`

---

## ✅ Issue #70: Add device dialog box should better fit all fields

### Research Findings:

**Status:** ⚠️ LIKELY FIXED but needs verification

**Location:** `src/components/devices/DevicesHeader.tsx` line 266

**Current State:**

- Add Device Dialog has ALL fields (name, ID, type, model, serial, firmware, location)
- Edit Device Dialog (DevicesList.tsx line 418) already has `max-h-[85vh] overflow-y-auto`
- Add Device Dialog (DevicesHeader.tsx) does NOT have scrolling constraint

### Solution:

**Add max-height and overflow to Add Device Dialog**

```tsx
// In DevicesHeader.tsx, line ~200 (DialogContent)
<DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
  <DialogHeader>
    <DialogTitle>Add New Device</DialogTitle>
    <DialogDescription>
      Enter device information to add it to your organization
    </DialogDescription>
  </DialogHeader>
  {/* rest of dialog content */}
</DialogContent>
```

**Files to modify:**

1. `src/components/devices/DevicesHeader.tsx` - Add className to DialogContent

---

## ✅ Issue #68: Alerts tab in Organization Management page

### Research Findings:

**Status:** ⚠️ FUNCTIONAL but may cause confusion

**Location:** `src/app/dashboard/organizations/components/OrganizationAlertsTab.tsx`

**Current State:**

- OrganizationAlertsTab is FUNCTIONAL and actively fetches/displays alerts
- Uses Edge Function `/functions/v1/alerts` with organization filtering
- Displays alerts with severity badges, timestamps, status
- There's ALSO a main Alerts page at `/dashboard/alerts`
- **Potential confusion:** Two places to view alerts

**Analysis:**

- Organization Alerts Tab: Shows alerts ONLY for current organization
- Main Alerts Page: Shows all alerts across organizations (for super admins)

### Recommendations:

**Option 1: Keep it (RECOMMENDED)**

- Purpose: Quick view of org-specific alerts without leaving org management
- Add clarification text: "Organization-specific alerts. View all alerts →"
- Add link to main alerts page

**Option 2: Remove it**

- Remove from navigation tabs
- Add "View Alerts" button in Overview tab that links to main alerts page

**Option 3: Enhance it**

- Add alert configuration UI (thresholds, rules, channels)
- Make it the alerts SETTINGS page rather than just a view

### Solution (Option 1):

```tsx
// In OrganizationAlertsTab.tsx, line ~95
<CardDescription>
  Organization-specific alerts for {currentOrganization.name}.
  <Button
    variant="link"
    className="ml-2 h-auto p-0 text-sm"
    onClick={() => router.push('/dashboard/alerts')}
  >
    View all alerts →
  </Button>
</CardDescription>
```

**Files to modify:**

1. `src/app/dashboard/organizations/components/OrganizationAlertsTab.tsx` - Add clarification

**OR to remove:**

1. `src/app/dashboard/organizations/page.tsx` - Remove "alerts" tab from TabsList and TabsContent

---

## ✅ Issue #64: Notification Preferences missing input fields

### Research Findings:

**Status:** ❌ CONFIRMED - Missing notification channel configuration

**Location:** `src/app/dashboard/settings/components/ProfileTab.tsx` line 224-260

**Current State:**

- Only has toggle switches:
  - ✅ Email Notifications (on/off)
  - ✅ Product Updates (on/off)
- **Missing:**
  - ❌ Email address input (where to send notifications)
  - ❌ Phone number input (for SMS alerts)
  - ❌ Notification frequency settings
  - ❌ Alert type preferences (critical only, all, etc.)
  - ❌ Quiet hours configuration

### Solution:

**Add comprehensive notification settings**

```tsx
// In ProfileTab.tsx, after the existing switches (line ~260)

{
  /* Email Configuration */
}
;<div className="space-y-2 border-b py-3">
  <Label htmlFor="notification-email">Notification Email</Label>
  <Input
    id="notification-email"
    type="email"
    placeholder="notifications@example.com"
    value={notificationEmail}
    onChange={(e) => setNotificationEmail(e.target.value)}
  />
  <p className="text-xs text-muted-foreground">
    Email address for receiving system notifications
  </p>
</div>

{
  /* Phone Number */
}
;<div className="space-y-2 border-b py-3">
  <Label htmlFor="notification-phone">Phone Number (SMS Alerts)</Label>
  <Input
    id="notification-phone"
    type="tel"
    placeholder="+1 (555) 123-4567"
    value={notificationPhone}
    onChange={(e) => setNotificationPhone(e.target.value)}
  />
  <p className="text-xs text-muted-foreground">
    Phone number for critical alert SMS notifications
  </p>
</div>

{
  /* Alert Severity Filter */
}
;<div className="space-y-2 border-b py-3">
  <Label htmlFor="alert-severity">Alert Severity Level</Label>
  <Select value={alertSeverity} onValueChange={setAlertSeverity}>
    <SelectTrigger id="alert-severity">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Alerts</SelectItem>
      <SelectItem value="high-critical">High & Critical Only</SelectItem>
      <SelectItem value="critical">Critical Only</SelectItem>
    </SelectContent>
  </Select>
  <p className="text-xs text-muted-foreground">
    Minimum severity level for notifications
  </p>
</div>

{
  /* Quiet Hours */
}
;<div className="space-y-2 border-b py-3">
  <Label>Quiet Hours</Label>
  <div className="flex items-center gap-4">
    <div className="flex-1">
      <Label htmlFor="quiet-start" className="text-xs text-muted-foreground">
        From
      </Label>
      <Input
        id="quiet-start"
        type="time"
        value={quietHoursStart}
        onChange={(e) => setQuietHoursStart(e.target.value)}
      />
    </div>
    <div className="flex-1">
      <Label htmlFor="quiet-end" className="text-xs text-muted-foreground">
        To
      </Label>
      <Input
        id="quiet-end"
        type="time"
        value={quietHoursEnd}
        onChange={(e) => setQuietHoursEnd(e.target.value)}
      />
    </div>
  </div>
  <p className="text-xs text-muted-foreground">
    No non-critical notifications during these hours
  </p>
</div>
```

**Add state variables at component top:**

```typescript
const [notificationEmail, setNotificationEmail] = useState(user?.email || '')
const [notificationPhone, setNotificationPhone] = useState('')
const [alertSeverity, setAlertSeverity] = useState('all')
const [quietHoursStart, setQuietHoursStart] = useState('22:00')
const [quietHoursEnd, setQuietHoursEnd] = useState('08:00')
```

**Files to modify:**

1. `src/app/dashboard/settings/components/ProfileTab.tsx`

---

## 🔍 Issue #62: Unable to add an Integration

### Research Findings:

**Status:** ⚠️ NEEDS USER TESTING - Possible z-index issue

**Location:** `src/app/dashboard/integrations/page.tsx`, `src/components/integrations/GoliothConfigDialog.tsx`

**Hypothesis:**

- Integration dialog may be rendering behind navbar/sidebar
- Z-index stacking context issue

**Current State:**

- GoliothConfigDialog uses standard Dialog component
- No explicit z-index override

### Solution:

**Add higher z-index to integration dialogs**

```tsx
// In GoliothConfigDialog.tsx
<DialogContent className="max-w-2xl z-[100]">
  {/* dialog content */}
</DialogContent>

// OR in global CSS (globals.css)
[data-radix-dialog-content] {
  z-index: 100 !important;
}

[data-radix-dialog-overlay] {
  z-index: 99 !important;
}
```

**Verification needed:**

1. Test add integration button click
2. Check if dialog appears
3. Check browser dev tools for z-index conflicts
4. Verify no navbar/sidebar overlap

**Files to modify (if confirmed):**

1. `src/components/integrations/GoliothConfigDialog.tsx`
2. OR `src/app/globals.css`

---

## 🔍 Issue #58: Sentry not working correctly

### Research Findings:

**Status:** ⚠️ PARTIALLY CONFIGURED - May not be an issue

**Location:** `src/lib/sentry-client-init.ts`

**Current State:**

- ✅ Sentry IS initialized on client
- ✅ Has DSN configuration check
- ✅ Has error capture with replay
- ✅ Debug mode enabled
- ✅ Environment tracking
- ❌ No evidence of global error boundary
- ❌ May only capture manual `captureException` calls

**Analysis:**
The user reports "errors on other pages do not seem to be actively recorded"

- This suggests automatic error capture may not be working
- Sentry init exists but may need error boundaries

### Solution:

**Add global error boundary**

```tsx
// Create src/components/ErrorBoundary.tsx
'use client'

import React from 'react'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="max-w-md space-y-4 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-muted-foreground">
              An error occurred. Our team has been notified.
            </p>
            <Button onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
```

**Wrap app in error boundary:**

```tsx
// In src/app/layout.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  )
}
```

**Files to modify:**

1. Create `src/components/ErrorBoundary.tsx`
2. Modify `src/app/layout.tsx`

---

## 🔍 Issue #56: Incorrect information displayed on Organizations page

### Research Findings:

**Status:** ⚠️ NEEDS MORE INFORMATION

**Location:** `src/app/dashboard/organizations/page.tsx`, `src/app/dashboard/organizations/components/OverviewTab.tsx`

**Need to investigate:**

- What specific information is incorrect?
- Organization stats/counts?
- Member lists?
- Device counts?

**Possible issues:**

1. RLS policies filtering wrong data
2. Organization context not properly set
3. Stats calculations wrong
4. Cached stale data

### Solution (pending clarification):

**Would need to:**

1. Identify specific incorrect data
2. Check OverviewTab data fetching logic
3. Verify RLS policies for organizations
4. Check organization context provider

**Files to investigate:**

1. `src/app/dashboard/organizations/components/OverviewTab.tsx`
2. `src/contexts/OrganizationContext.tsx`
3. `supabase/migrations/*_rls_*.sql`

---

## 📋 Priority & Implementation Order

### High Priority (User-blocking):

1. **#71 - Delete Device** ⚠️ Critical - Users cannot remove devices
2. **#64 - Notification Preferences** ⚠️ High - Missing essential settings

### Medium Priority (UX Issues):

3. **#70 - Add Device Dialog** 🔄 Quick fix - One line change
4. **#68 - Alerts Tab** 💭 Decision needed - Keep or remove?

### Low Priority (Needs Investigation):

5. **#62 - Integration z-index** 🔍 May already work - needs testing
6. **#58 - Sentry Coverage** 🔍 May be working - add error boundary for safety
7. **#56 - Organizations Data** 🔍 Needs specific bug details

---

## 📝 Implementation Checklist

### Phase 1: Quick Wins (30 minutes)

- [ ] Fix #70 - Add `max-h-[85vh] overflow-y-auto` to DevicesHeader.tsx dialog
- [ ] Fix #68 - Add clarification text or remove alerts tab

### Phase 2: Core Functionality (2 hours)

- [ ] Fix #71 - Add delete button and handler to DevicesList.tsx
- [ ] Fix #64 - Add notification channel inputs to ProfileTab.tsx

### Phase 3: Enhancement (1 hour)

- [ ] Fix #58 - Add ErrorBoundary component and wrap layout
- [ ] Verify #62 - Test integration dialog, fix z-index if needed

### Phase 4: Investigation (as needed)

- [ ] Fix #56 - Get specific bug details, investigate data fetching

---

## ✅ Summary

**Total Issues:** 7

- **Confirmed Bugs:** 3 (#71, #64, #70)
- **Needs Decision:** 1 (#68)
- **Needs Testing:** 2 (#62, #58)
- **Needs Info:** 1 (#56)

**Estimated Total Fix Time:** 4-5 hours

**Files to Modify:**

1. `src/components/devices/DevicesList.tsx` - Add delete functionality
2. `src/components/devices/DevicesHeader.tsx` - Fix dialog overflow
3. `src/app/dashboard/settings/components/ProfileTab.tsx` - Add notification fields
4. `src/components/ErrorBoundary.tsx` - Create new file for Sentry
5. `src/app/layout.tsx` - Wrap with ErrorBoundary
6. `src/app/dashboard/organizations/components/OrganizationAlertsTab.tsx` - Add clarification (optional)

**Next Steps:**

1. Get user confirmation on which issues to prioritize
2. Implement Phase 1 (quick wins)
3. Test locally
4. Commit and deploy
