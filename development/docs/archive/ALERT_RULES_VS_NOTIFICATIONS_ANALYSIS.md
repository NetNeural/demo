# Alert Rules & Notifications: User vs Organization Scope Analysis

## Your Question

> "Are alert rules and notifications user-centric or organization-centric? If they are for the entire organization, we should only have those managed within the organization page. If user-specific, maybe personal settings with not combined. But verify the spec and give me input so we can decide."

## 🎯 ANSWER: Both - But They're Different Things

After reviewing the specifications and architecture documents, here's the clear breakdown:

---

## The Two Distinct Concepts

### 1. **Alert Rules** = ORGANIZATION-CENTRIC ✅

**What:** Define WHAT triggers an alert
**Scope:** Organization-wide (applies to all members)
**Examples:**

- "Alert when temperature exceeds 80°F"
- "Alert when device goes offline for 5+ minutes"
- "Alert when battery level drops below 10%"

**Who Manages:** Admins and above
**Where Managed:** `/dashboard/organizations` > Alerts Tab
**Database:** `alert_rules` table with `organization_id` foreign key

```sql
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  condition JSONB NOT NULL,  -- {"temp": ">", "value": 80}
  severity TEXT NOT NULL,     -- critical, high, medium, low
  enabled BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id)
);
```

### 2. **Notification Preferences** = USER-CENTRIC ✅

**What:** Define HOW each user wants to be notified
**Scope:** Personal (per user)
**Examples:**

- "Send me email for critical alerts only"
- "Send me SMS for high priority alerts"
- "Don't notify me between 10 PM - 7 AM"
- "Mute notifications on weekends"

**Who Manages:** Each user for themselves
**Where Managed:** `/dashboard/settings` > Preferences Tab (new)
**Database:** `user_notification_preferences` table with `user_id` foreign key

```sql
CREATE TABLE user_notification_preferences (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id), -- Optional: per-org prefs
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  push_enabled BOOLEAN DEFAULT true,
  min_severity TEXT DEFAULT 'medium',  -- Only notify for this severity+
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  mute_weekends BOOLEAN DEFAULT false
);
```

---

## From The Spec (SETTINGS_SECURITY_ARCHITECTURE_REVIEW.md)

### Personal Settings Should Have:

```
📂 /dashboard/settings (Personal Settings)
├── Profile Tab
│   ├── Name, email, avatar
│   ├── Password & 2FA
│   └── Personal notification preferences  ⬅️ USER-CENTRIC
│
├── Preferences Tab
│   ├── Theme (light/dark)
│   ├── Language
│   ├── Timezone
│   └── Dashboard layout preferences
```

### Organization Management Should Have:

```
📂 /dashboard/organizations (Organization Management)
├── Alerts Tab
│   ├── Alert rules configuration      ⬅️ ORG-CENTRIC
│   ├── Notification channels          ⬅️ ORG-CENTRIC
│   ├── Severity thresholds
│   └── Alert history
```

### Permission Matrix (From ALL_PHASES_COMPLETE.md):

| Action           | Viewer | Member | Admin | Owner |
| ---------------- | ------ | ------ | ----- | ----- |
| Configure Alerts | ❌     | ✅     | ✅    | ✅    |

**Members and above** can configure alert rules (organization-wide).

---

## Current Implementation Issues

### ❌ Problem 1: Alerts Page Has Redundant Buttons

**File:** `src/components/alerts/AlertsHeader.tsx`

```tsx
<Button variant="outline">Alert Rules</Button>        // ⬅️ WRONG LOCATION
<Button variant="outline">Notification Settings</Button> // ⬅️ WRONG LOCATION
```

**Issue:** These buttons don't do anything (no onClick handlers) and they're in the wrong place.

### ❌ Problem 2: Conflating Two Different Concepts

The main Alerts page is mixing:

- **Active Alert Instances** (correct - should be here)
- **Alert Rules Configuration** (wrong - should be in Organization page)
- **Personal Notification Preferences** (wrong - should be in Personal Settings)

### ✅ Solution: Clear Separation

---

## 🎯 RECOMMENDED ARCHITECTURE

### 1. Main Alerts Page (`/dashboard/alerts`)

**Purpose:** Monitor active alert instances
**Scope:** Shows alerts from current organization

```tsx
export default function AlertsPage() {
  const { currentOrganization } = useOrganization()

  return (
    <div>
      <AlertsHeader /> // No buttons, just title
      <AlertFilters /> // Filter by severity, status, date
      <AlertsList organizationId={currentOrganization.id} />
    </div>
  )
}
```

**Shows:**

- ✅ Active alert instances (e.g., "Temp Sensor 3 exceeded 80°F at 2:34 PM")
- ✅ Alert history
- ✅ Quick actions (acknowledge, resolve, mute)
- ❌ NO alert rules configuration
- ❌ NO notification preferences

### 2. Organization Alerts Tab (`/dashboard/organizations` > Alerts)

**Purpose:** Configure alert rules for the organization
**Scope:** Organization-wide rules
**Permission:** Member+ can view/configure

```tsx
export function OrganizationAlertsTab({ organizationId }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert Rules</CardTitle>
        <CardDescription>
          Configure what triggers alerts for {currentOrganization.name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* List of alert rules */}
        <AlertRulesList organizationId={organizationId} />
        <Button onClick={createRule}>Create Alert Rule</Button>
      </CardContent>
    </Card>
  )
}
```

**Shows:**

- ✅ Alert rules (what triggers alerts)
- ✅ Rule configuration (conditions, thresholds)
- ✅ Notification channels (email, SMS, Slack, webhook)
- ✅ Organization-wide alert settings
- ❌ NO personal preferences

### 3. Personal Settings Preferences Tab (`/dashboard/settings` > Preferences)

**Purpose:** User's personal notification preferences
**Scope:** Per-user settings

```tsx
export function PreferencesTab() {
  return (
    <div className="space-y-6">
      {/* Theme, Language, Timezone (already exists) */}

      {/* NEW SECTION: Personal Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Control how you receive alert notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Email Notifications</Label>
              <Switch checked={emailEnabled} onChange={...} />
            </div>

            <div className="flex items-center justify-between">
              <Label>SMS Notifications</Label>
              <Switch checked={smsEnabled} onChange={...} />
            </div>

            <div className="flex items-center justify-between">
              <Label>Push Notifications</Label>
              <Switch checked={pushEnabled} onChange={...} />
            </div>

            <Separator />

            <div>
              <Label>Minimum Alert Severity</Label>
              <Select value={minSeverity}>
                <SelectItem value="low">All Alerts</SelectItem>
                <SelectItem value="medium">Medium & Above</SelectItem>
                <SelectItem value="high">High & Critical Only</SelectItem>
                <SelectItem value="critical">Critical Only</SelectItem>
              </Select>
              <p className="text-sm text-muted-foreground">
                Only notify me for alerts at or above this severity
              </p>
            </div>

            <div>
              <Label>Quiet Hours</Label>
              <div className="flex gap-2">
                <TimeInput value={quietStart} />
                <span>to</span>
                <TimeInput value={quietEnd} />
              </div>
              <p className="text-sm text-muted-foreground">
                Don't send notifications during these hours
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label>Mute on Weekends</Label>
              <Switch checked={muteWeekends} onChange={...} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Shows:**

- ✅ Email/SMS/Push notification toggles
- ✅ Minimum severity filter (personal)
- ✅ Quiet hours
- ✅ Weekend muting
- ❌ NO alert rules (those are org-wide)

---

## Data Flow Example

### Scenario: High Temperature Alert

1. **Alert Rule Triggered** (Organization-wide)

   ```
   Rule: "High Temperature"
   Condition: temp > 80°F
   Organization: Acme Manufacturing
   Severity: High
   Status: Enabled
   ```

2. **Alert Instance Created**

   ```
   Alert: "Temperature Sensor 3 exceeded threshold"
   Value: 85°F
   Time: 2:34 PM
   Organization: Acme Manufacturing
   Rule: "High Temperature"
   Status: Active
   ```

3. **Notification Sent to Members** (Based on personal preferences)

   ```
   User 1 (Admin):
   - Email: ✅ Sent (has email enabled, severity >= high)
   - SMS: ❌ Not sent (has SMS disabled)

   User 2 (Member):
   - Email: ❌ Not sent (min severity = critical only)
   - SMS: ❌ Not sent (quiet hours active)

   User 3 (Owner):
   - Email: ✅ Sent
   - SMS: ✅ Sent
   - Push: ✅ Sent (all enabled)
   ```

---

## Database Schema

### Organization-Scoped Tables

```sql
-- Alert Rules (organization-wide)
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  device_type TEXT,  -- Optional: filter by device type
  condition JSONB NOT NULL,
  severity TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  notification_channels JSONB,  -- ["email", "sms", "slack"]
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert Instances (active alerts)
CREATE TABLE alerts (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  rule_id UUID REFERENCES alert_rules(id),
  device_id UUID REFERENCES devices(id),
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB,  -- Sensor readings, context
  status TEXT DEFAULT 'active',  -- active, acknowledged, resolved
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id)
);
```

### User-Scoped Tables

```sql
-- Personal Notification Preferences
CREATE TABLE user_notification_preferences (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),  -- Optional: per-org prefs

  -- Channels
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  push_enabled BOOLEAN DEFAULT true,
  slack_enabled BOOLEAN DEFAULT false,

  -- Filtering
  min_severity TEXT DEFAULT 'medium',  -- low, medium, high, critical

  -- Scheduling
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  quiet_hours_timezone TEXT DEFAULT 'UTC',
  mute_weekends BOOLEAN DEFAULT false,

  -- Per-device preferences (future)
  device_filters JSONB,  -- {"include": ["device-1"], "exclude": ["device-2"]}

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, organization_id)  -- One preference set per user per org
);

-- Notification Log (audit trail)
CREATE TABLE notification_log (
  id UUID PRIMARY KEY,
  alert_id UUID NOT NULL REFERENCES alerts(id),
  user_id UUID NOT NULL REFERENCES users(id),
  channel TEXT NOT NULL,  -- email, sms, push, slack
  status TEXT NOT NULL,  -- sent, failed, skipped
  reason TEXT,  -- Why skipped: "quiet_hours", "severity_below_threshold"
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Action Items

### ✅ Keep Current Implementation:

1. **Organization Alerts Tab** (`OrganizationAlertsTab.tsx`)
   - Already shows alert rules scoped to organization ✅
   - Has "Create Rule" button ✅
   - Shows severity and enabled status ✅

### ❌ Remove from Alerts Page:

2. **AlertsHeader Component** - Remove buttons

   ```tsx
   // BEFORE (WRONG)
   <Button variant="outline">Alert Rules</Button>
   <Button variant="outline">Notification Settings</Button>

   // AFTER (CORRECT)
   // Just title and description, no buttons
   ```

### ✅ Add to Personal Settings:

3. **PreferencesTab Component** - Add notification preferences section
   - Add new "Notification Preferences" card
   - Email/SMS/Push toggles
   - Minimum severity selector
   - Quiet hours configuration
   - Weekend muting toggle

### ✅ Simplify Alerts Page:

4. **Alerts Page** - Focus on active alerts only
   - Show AlertsList (active alert instances)
   - Show alert history
   - Add filters (severity, status, date range)
   - Quick actions (acknowledge, resolve, mute)
   - NO rule configuration
   - NO notification settings

---

## Summary & Recommendation

### The Answer to Your Question:

**Alert Rules:** ✅ **ORGANIZATION-CENTRIC**

- Managed in: `/dashboard/organizations` > Alerts Tab
- Permission: Member+ (canManageAlerts)
- Scope: Organization-wide (all members see same rules)
- Keep in Organization page ONLY

**Notification Preferences:** ✅ **USER-CENTRIC**

- Managed in: `/dashboard/settings` > Preferences Tab
- Permission: Everyone (for themselves only)
- Scope: Personal (each user has own preferences)
- Add to Personal Settings

**Active Alerts:** ✅ **ORGANIZATION-SCOPED, USER-VIEWED**

- Viewed in: `/dashboard/alerts` (main sidebar)
- Scope: Shows alerts from current organization
- Action: Each user can acknowledge/resolve based on permissions

### What To Do:

1. ✅ **Keep** Organization Alerts Tab as-is (alert rules management)
2. ❌ **Remove** "Alert Rules" and "Notification Settings" buttons from AlertsHeader
3. ✅ **Add** Notification Preferences section to Personal Settings > Preferences Tab
4. ✅ **Simplify** Main Alerts page to show only active alert instances

### Do NOT Combine:

- ❌ Don't mix alert rules (org-wide) with notification preferences (personal)
- ❌ Don't put personal notification settings in Organization page
- ❌ Don't put alert rules configuration in Personal Settings

Would you like me to:

1. Update the AlertsHeader to remove the buttons?
2. Add the Notification Preferences section to PreferencesTab?
3. Update the documentation to reflect this architecture?
