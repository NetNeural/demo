# Alert Rules & Notifications Implementation Summary

## Changes Made

### ✅ 1. Removed Redundant Buttons from AlertsHeader

**File:** `src/components/alerts/AlertsHeader.tsx`

**Before:**

```tsx
<div className="flex items-center space-x-2">
  <Button variant="outline">Alert Rules</Button>
  <Button variant="outline">Notification Settings</Button>
</div>
```

**After:**

```tsx
// Buttons removed - no longer needed
// Description updated to clarify purpose
```

**Changes:**

- ❌ Removed "Alert Rules" button (now in Organization page only)
- ❌ Removed "Notification Settings" button (now in Personal Settings)
- ✅ Updated description: "Monitor and respond to active alerts from your organization"
- ✅ Simplified header to focus on alert monitoring

**Result:** Alerts page now focuses exclusively on showing active alert instances, not managing rules or preferences.

---

### ✅ 2. Added Notification Preferences to Personal Settings

**File:** `src/app/dashboard/settings/components/PreferencesTab.tsx`

**New Section Added:** "Notification Preferences" card with comprehensive personal notification controls

#### Features Added:

##### A. Notification Channels

```tsx
- Email Notifications (toggle)
- SMS Notifications (toggle)
- Push Notifications (toggle)
```

Users can enable/disable each notification channel independently.

##### B. Severity Filtering

```tsx
Minimum Alert Severity dropdown:
- All Alerts (Low and above)
- Medium and above
- High and Critical only
- Critical only
```

Users can choose to only receive notifications for alerts above a certain severity threshold.

##### C. Quiet Hours

```tsx
- Enable Quiet Hours (toggle)
- Quiet Hours Start time (dropdown)
- Quiet Hours End time (dropdown)
```

When enabled, notifications are suppressed during specified hours (e.g., 10 PM - 7 AM).

##### D. Weekend Muting

```tsx
- Mute on Weekends (toggle)
```

Users can opt out of notifications on Saturdays and Sundays.

#### State Variables Added:

```typescript
const [emailNotifications, setEmailNotifications] = useState(true)
const [smsNotifications, setSmsNotifications] = useState(false)
const [pushNotifications, setPushNotifications] = useState(true)
const [minSeverity, setMinSeverity] = useState('medium')
const [quietHoursEnabled, setQuietHoursEnabled] = useState(false)
const [quietHoursStart, setQuietHoursStart] = useState('22:00')
const [quietHoursEnd, setQuietHoursEnd] = useState('07:00')
const [muteWeekends, setMuteWeekends] = useState(false)
```

#### Save Functionality Updated:

All notification preferences are now included in the `handleSavePreferences` function:

```typescript
localStorage.setItem(
  'user_preferences',
  JSON.stringify({
    // Existing preferences
    theme,
    language,
    timezone,
    dateFormat,
    timeFormat,
    compactMode,
    animationsEnabled,
    soundEnabled,

    // NEW: Notification preferences
    emailNotifications,
    smsNotifications,
    pushNotifications,
    minSeverity,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    muteWeekends,
  })
)
```

#### Import Added:

```typescript
import { Moon, Sun, Monitor, Globe, Layout, Bell } from 'lucide-react'
```

Added `Bell` icon for the notification preferences section.

---

## Architecture Summary

### Three Distinct Areas for Alerts:

#### 1. **Main Alerts Page** (`/dashboard/alerts`)

**Purpose:** Monitor active alerts
**Content:**

- Active alert instances from current organization
- Alert history and status
- Quick actions (acknowledge, resolve, mute)
- ❌ NO rule configuration
- ❌ NO notification preferences

**User Flow:**
"What alerts are happening right now?"

---

#### 2. **Organization Alerts Tab** (`/dashboard/organizations` > Alerts)

**Purpose:** Configure alert rules
**Content:**

- Alert rules (what triggers alerts)
- Rule conditions and thresholds
- Organization-wide notification channels
- Enable/disable rules
- ❌ NO personal notification preferences

**User Flow:**
"What should trigger alerts for our organization?"

**Permission:** Member+ (canManageAlerts)

---

#### 3. **Personal Settings - Preferences Tab** (`/dashboard/settings` > Preferences)

**Purpose:** Personal notification preferences
**Content:**

- Email/SMS/Push toggles
- Minimum severity threshold
- Quiet hours configuration
- Weekend muting
- ❌ NO alert rules configuration

**User Flow:**
"How do I want to be notified about alerts?"

**Permission:** Every user (for themselves only)

---

## Data Flow Example

### Scenario: Temperature Alert

```
1. RULE TRIGGERED (Organization Level)
   Organization: Acme Manufacturing
   Rule: "High Temperature"
   Condition: temp > 80°F
   Severity: High
   Status: Enabled

   ↓

2. ALERT INSTANCE CREATED
   Alert: "Sensor 3 exceeded 80°F"
   Value: 85°F
   Time: 2:34 PM
   Organization: Acme Manufacturing

   ↓

3. NOTIFICATION SENT (Based on Personal Preferences)

   User 1 (Admin):
   - Email: ✅ Sent (email enabled, severity >= high)
   - SMS: ❌ Not sent (SMS disabled)
   - Push: ✅ Sent (push enabled)

   User 2 (Member):
   - Email: ❌ Not sent (min severity = critical only)
   - SMS: ❌ Not sent (quiet hours active: 10 PM - 7 AM)
   - Push: ❌ Not sent (muted on weekends)

   User 3 (Owner):
   - Email: ✅ Sent
   - SMS: ✅ Sent
   - Push: ✅ Sent (all channels enabled, all alerts)
```

---

## UI Screenshots & Layout

### Alerts Page (Simplified)

```
┌─────────────────────────────────────────────────┐
│ Alert Management                                │
│ Monitor and respond to active alerts from your  │
│ organization                                     │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🔴 Critical - Temperature Sensor 3          │ │
│ │    Exceeded 80°F at 2:34 PM                 │ │
│ │    [Acknowledge] [Resolve]                  │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🟠 High - Device 7 Offline                  │ │
│ │    Last seen 15 minutes ago                 │ │
│ │    [Acknowledge] [Resolve]                  │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Organization Alerts Tab

```
┌─────────────────────────────────────────────────┐
│ 🔔 Alert Rules                    [Create Rule] │
│ Configure alert rules for Acme Manufacturing    │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🔔 High Temperature                         │ │
│ │    Critical                       [Enabled] │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🔔 Low Battery                              │ │
│ │    Medium                         [Enabled] │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Personal Settings - Preferences Tab (NEW)

```
┌─────────────────────────────────────────────────┐
│ [Theme] [Language] [Layout] ... cards above     │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🔔 Notification Preferences                 │ │
│ │ Control how you receive alert notifications │ │
│ │                                              │ │
│ │ Email Notifications              [ON] ●     │ │
│ │ Receive alerts via email                    │ │
│ │                                              │ │
│ │ SMS Notifications                [OFF] ○    │ │
│ │ Receive alerts via text message             │ │
│ │                                              │ │
│ │ Push Notifications               [ON] ●     │ │
│ │ Receive browser push notifications          │ │
│ │                                              │ │
│ │ ─────────────────────────────────────────   │ │
│ │                                              │ │
│ │ Minimum Alert Severity                      │ │
│ │ [Medium and above           ▼]             │ │
│ │ Only notify for this severity and above     │ │
│ │                                              │ │
│ │ ─────────────────────────────────────────   │ │
│ │                                              │ │
│ │ Enable Quiet Hours               [ON] ●     │ │
│ │ Don't send notifications during hours       │ │
│ │                                              │ │
│ │   From [10:00 PM ▼]  Until [7:00 AM ▼]    │ │
│ │                                              │ │
│ │ Mute on Weekends                [OFF] ○    │ │
│ │ Don't send notifications on weekends        │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│                           [Save Preferences]    │
└─────────────────────────────────────────────────┘
```

---

## Testing Checklist

### ✅ AlertsHeader Component

- [x] Buttons removed successfully
- [x] Description updated to clarify purpose
- [x] No TypeScript errors
- [x] Component renders without errors

### ✅ PreferencesTab Component

- [x] Notification Preferences card added
- [x] All state variables initialized
- [x] Bell icon imported from lucide-react
- [x] Email/SMS/Push toggles functional
- [x] Minimum severity dropdown functional
- [x] Quiet hours toggle shows/hides time selectors
- [x] Weekend muting toggle functional
- [x] All preferences saved to localStorage
- [x] No TypeScript errors
- [x] All apostrophes properly escaped

### User Flows to Test

#### Flow 1: View Active Alerts

1. Navigate to `/dashboard/alerts`
2. Should see clean header without buttons
3. Should see list of active alerts
4. Should see organization context (which org's alerts)

#### Flow 2: Configure Alert Rules

1. Navigate to `/dashboard/organizations`
2. Click "Alerts" tab
3. Should see list of alert rules
4. Should see "Create Rule" button
5. Can enable/disable rules

#### Flow 3: Set Personal Notification Preferences

1. Navigate to `/dashboard/settings`
2. Click "Preferences" tab
3. Scroll to "Notification Preferences" card
4. Toggle email/SMS/push notifications
5. Select minimum severity
6. Enable quiet hours and set times
7. Toggle weekend muting
8. Click "Save Preferences"
9. Check localStorage for saved values

#### Flow 4: Test Notification Filtering (Future)

1. Create alert rule (org level)
2. Trigger alert
3. Verify each user receives notifications based on:
   - Their enabled channels
   - Their minimum severity setting
   - Whether it's during quiet hours
   - Whether it's a weekend (if muted)

---

## Database Schema (Future Implementation)

### User Notification Preferences Table

```sql
CREATE TABLE user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Channels
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  push_enabled BOOLEAN DEFAULT true,

  -- Filtering
  min_severity TEXT DEFAULT 'medium' CHECK (min_severity IN ('low', 'medium', 'high', 'critical')),

  -- Scheduling
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  mute_weekends BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One preference set per user per org (or one global if org_id is null)
  UNIQUE(user_id, organization_id)
);

-- Index for fast lookup
CREATE INDEX idx_user_notif_prefs_user ON user_notification_preferences(user_id);
CREATE INDEX idx_user_notif_prefs_org ON user_notification_preferences(organization_id);
```

### Notification Log Table (Audit Trail)

```sql
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id),
  user_id UUID NOT NULL REFERENCES users(id),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'slack')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  reason TEXT,  -- Why skipped: "quiet_hours", "severity_below_threshold", "channel_disabled", "muted_weekend"
  sent_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata for debugging
  metadata JSONB  -- Store alert details, user prefs at time of send
);

-- Indexes for reporting
CREATE INDEX idx_notif_log_alert ON notification_log(alert_id);
CREATE INDEX idx_notif_log_user ON notification_log(user_id);
CREATE INDEX idx_notif_log_sent_at ON notification_log(sent_at DESC);
```

---

## Next Steps

### Immediate

1. ✅ Test both updated components in browser
2. ✅ Verify no console errors
3. ✅ Test localStorage persistence

### Short-term

1. Create API endpoint: `POST /api/user/preferences`
2. Update `handleSavePreferences` to call API
3. Load preferences from API on mount
4. Add success/error toast notifications

### Medium-term

1. Implement notification service (backend)
2. Create notification queue system
3. Apply user preferences when sending notifications
4. Add notification history/log viewer

### Long-term

1. SMS integration (Twilio/AWS SNS)
2. Push notification service worker
3. Slack/webhook integrations
4. Per-organization notification preferences

---

## Summary

### What Changed:

- ❌ Removed redundant buttons from Alerts page
- ✅ Added comprehensive Notification Preferences to Personal Settings
- ✅ Clear separation: Rules (org) vs Preferences (user)

### Why:

- **Alert Rules** are organization-wide (what triggers alerts)
- **Notification Preferences** are personal (how each user wants to be notified)
- Mixing them together was confusing and violated separation of concerns

### Result:

- ✅ Cleaner, more focused UI
- ✅ Clear mental model for users
- ✅ Proper multi-tenant architecture
- ✅ Scalable for future features

### User Benefits:

- 🎯 Less confusion about where to configure things
- 🔕 Personal control over notification noise
- ⏰ Quiet hours prevent interruptions
- 📧 Channel preferences (email vs SMS vs push)
- 🎚️ Severity filtering reduces alert fatigue
