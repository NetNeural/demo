# User Phone Numbers & SMS Notifications - Implementation Summary

## Overview
Added comprehensive phone number management to user profiles with SMS opt-in preferences. Users can now add primary and secondary phone numbers and control which numbers receive SMS notifications.

## Changes Made

### 1. Database Migration
**File:** `supabase/migrations/20260220100000_add_user_phone_numbers.sql`

Added columns to `users` table:
- `phone_number` (VARCHAR(20)) - Primary phone number
- `phone_number_secondary` (VARCHAR(20)) - Secondary/backup phone number  
- `phone_sms_enabled` (BOOLEAN) - SMS opt-in for primary number
- `phone_secondary_sms_enabled` (BOOLEAN) - SMS opt-in for secondary number

Features:
- Phone number format validation (E.164 preferred)
- Automatic SMS disable when phone number removed
- Indexes for efficient querying
- Comments explaining usage

### 2. Profile Settings UI
**File:** `src/app/dashboard/settings/components/ProfileTab.tsx`

Added new "Contact Information" section:
- Primary phone number input with SMS opt-in checkbox
- Secondary phone number input (optional) with SMS opt-in checkbox
- Remove button for secondary number
- Auto-save functionality (saves with other profile fields)
- Helpful text about SMS usage and data rates
- Visual indicator (info box) explaining SMS preferences

### 3. SMS Helper Functions
**File:** `src/lib/helpers/sms-users.ts`

Utility functions for SMS notification system:
- `getSMSEnabledUsers()` - Get users who opted in to SMS
- `getSMSPhoneNumbers()` - Get all SMS-enabled phone numbers
- `getUserSMSPhoneNumbers()` - Get specific user's SMS numbers
- `formatPhoneE164()` - Format phone number to E.164 standard
- `isValidPhoneNumber()` - Validate phone number format

## Manual Steps Required

### Step 1: Apply Migration to Local Database
```bash
cd /workspaces/MonoRepo/development
npx supabase db reset --local
```

### Step 2: Regenerate TypeScript Types
```bash
npx supabase gen types typescript --local > src/types/supabase.ts
```

### Step 3: Apply Migration to Staging Database
```bash
# Connect to staging
npx supabase db push --db-url "postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

# Or apply via Supabase Dashboard:
# 1. Go to https://supabase.com/dashboard/project/[PROJECT_ID]/editor
# 2. Open SQL Editor
# 3. Copy contents of supabase/migrations/20260220100000_add_user_phone_numbers.sql
# 4. Run the migration
```

### Step 4: Test the Implementation
1. Navigate to https://demo-stage.netneural.ai/dashboard/settings/
2. Go to Profile tab
3. Verify "Contact Information" section appears
4. Add a phone number: +15551234567
5. Enable SMS checkbox
6. Add secondary phone: +15559876543
7. Enable SMS for secondary
8. Verify auto-save indicator shows saved
9. Refresh page - verify numbers persist
10. Remove secondary number - verify it clears

### Step 5: Integration with Alerts System
The alerts system (sensor thresholds) already supports `notify_phone_numbers`. Now you can:

1. **Option A: Manual Entry (Current)**
   - Users manually enter phone numbers in threshold settings
   - Works immediately with no changes needed

2. **Option B: User Selection (Recommended - Future Enhancement)**
   - Modify `AlertsThresholdsCard.tsx` to fetch SMS-enabled users
   - Add dropdown/multi-select for SMS recipients
   - Use `getSMSEnabledUsers()` helper function
   - Example code:

```typescript
import { getSMSEnabledUsers } from '@/lib/helpers/sms-users';

// In your component
const [smsUsers, setSmsUsers] = useState<SMSEnabledUser[]>([]);

useEffect(() => {
  async function loadSMSUsers() {
    const users = await getSMSEnabledUsers(device.organization_id);
    setSmsUsers(users);
  }
  loadSMSUsers();
}, [device.organization_id]);

// Then add a multi-select UI component to pick from smsUsers
```

## Integration Points

### Where SMS Phone Numbers Are Used

1. **User Profile Settings** (`ProfileTab.tsx`)
   - Users manage their phone numbers and SMS preferences
   - Auto-saves with other profile data

2. **Sensor Thresholds** (`AlertsThresholdsCard.tsx`)
   - Currently: Manual phone number entry
   - Future: Could auto-populate from SMS-enabled users

3. **Alert Notifications** (Edge Functions)
   - When alert triggers, check `notify_phone_numbers`
   - Send SMS via Twilio integration (if configured)
   - Only send to numbers where user has SMS enabled

4. **Organization Settings** (Notification Settings)
   - Twilio configuration stored in `organizations.settings.notification_settings`
   - Includes: account_sid, auth_token, from_number
   - SMS can be disabled org-wide via `sms_enabled` flag

## SMS Notification Flow

```mermaid
graph TD
    A[Alert Triggered] --> B{Check Threshold Settings}
    B --> C[Get notify_phone_numbers]
    C --> D{SMS Enabled in Org Settings?}
    D -->|No| E[Skip SMS]
    D -->|Yes| F[For Each Phone Number]
    F --> G{User Has SMS Opt-in?}
    G -->|No| E
    G -->|Yes| H[Send SMS via Twilio]
    H --> I[Log to notification_log]
```

## Privacy & Compliance Notes

- Phone numbers stored in `users` table with encryption at rest (Supabase default)
- SMS opt-in is explicit (checkbox must be checked)
- Users can disable SMS anytime without removing phone number
- SMS disabled automatically when phone number removed
- Phone numbers never shared with third parties
- Format validation prevents invalid numbers

## Future Enhancements

### Short Term
1. Add phone number to user profile display (read-only view)
2. Update alerts UI to show SMS-enabled team members
3. Add SMS delivery status tracking

### Medium Term
1. SMS notification history in user's notification log
2. Bulk SMS opt-in/opt-out for admins
3. SMS rate limiting per user (prevent spam)
4. SMS templates for different alert types

### Long Term
1. Two-factor authentication via SMS
2. SMS reply handling (acknowledge alerts via SMS)
3. International SMS support with country-specific formatting
4. SMS cost tracking and billing alerts

## Testing Checklist

- [ ] Migration applies cleanly to local database
- [ ] Migration applies cleanly to staging database
- [ ] TypeScript types regenerated with new columns
- [ ] Profile page loads without errors
- [ ] Contact Information section displays correctly
- [ ] Primary phone number can be added
- [ ] Primary SMS checkbox works (disabled when no number)
- [ ] Secondary phone number can be added
- [ ] Secondary SMS checkbox works
- [ ] Remove button clears secondary number
- [ ] Phone numbers validate format (E.164 preferred)
- [ ] Invalid phone formats show error
- [ ] Auto-save works for phone fields
- [ ] Phone numbers persist after refresh
- [ ] SMS preferences persist after refresh
- [ ] SMS helper functions return correct data
- [ ] Alerts can use phone numbers for SMS (existing functionality)

## Rollback Plan

If issues occur, rollback with:

```sql
-- Remove columns added by migration
ALTER TABLE users
  DROP COLUMN IF EXISTS phone_number,
  DROP COLUMN IF EXISTS phone_number_secondary,
  DROP COLUMN IF EXISTS phone_sms_enabled,
  DROP COLUMN IF EXISTS phone_secondary_sms_enabled;

-- Remove trigger
DROP TRIGGER IF EXISTS validate_phone_numbers ON users;

-- Remove function
DROP FUNCTION IF EXISTS validate_phone_format();
```

## Support Documentation Needed

Update user documentation:
1. How to add phone numbers
2. How to enable SMS notifications
3. What notifications will be sent via SMS
4. How to disable SMS while keeping phone number
5. SMS rates and carrier information
6. Privacy policy regarding phone numbers

## Deployment Timeline

1. **Local Development** - Immediate (apply migration locally)
2. **Code Review** - Commit changes for review
3. **Staging Deployment** - Apply migration to staging database
4. **User Testing** - Test with staging users
5. **Production Deployment** - Apply to production database
6. **User Communication** - Announce feature in release notes

## Questions/Decisions

1. **Rate Limiting**: Should we limit SMS notifications per user per day?
   - Recommendation: Yes, 50 SMS per user per day maximum

2. **Twilio Integration**: Is Twilio already configured?
   - Check: organization.settings.notification_settings.twilio_*

3. **International Numbers**: Support international formats?
   - Recommendation: Yes, E.164 format supports all countries

4. **SMS Templates**: Use templates or dynamic messages?
   - Current: Dynamic from alert threshold settings
   - Future: Add templates for consistency

## Related Files

- Database: `supabase/migrations/20260220100000_add_user_phone_numbers.sql`
- UI: `src/app/dashboard/settings/components/ProfileTab.tsx`
- Helpers: `src/lib/helpers/sms-users.ts`
- Types: `src/types/supabase.ts` (regenerate after migration)
- Existing: `supabase/migrations/20260217200000_notification_settings_and_phone_numbers.sql` (threshold SMS)

## Integration Example: Update Alert Dialog

To add SMS user selection to alert thresholds:

```typescript
// In AlertsThresholdsCard.tsx, add import
import { getSMSEnabledUsers, type SMSEnabledUser } from '@/lib/helpers/sms-users';

// Add state
const [smsEnabledUsers, setSmsEnabledUsers] = useState<SMSEnabledUser[]>([]);
const [selectedSmsUsers, setSelectedSmsUsers] = useState<string[]>([]);

// Fetch SMS-enabled users
useEffect(() => {
  async function loadSMSUsers() {
    const users = await getSMSEnabledUsers(device.organization_id);
    setSmsEnabledUsers(users);
  }
  loadSMSUsers();
}, [device.organization_id]);

// Add multi-select component in dialog
<div className="space-y-2">
  <Label>SMS Recipients</Label>
  <p className="text-sm text-muted-foreground">
    Select team members who will receive SMS alerts
  </p>
  {smsEnabledUsers.map((user) => (
    <div key={user.id} className="flex items-center space-x-2">
      <Checkbox
        checked={selectedSmsUsers.includes(user.id)}
        onCheckedChange={(checked) => {
          if (checked) {
            setSelectedSmsUsers([...selectedSmsUsers, user.id]);
          } else {
            setSelectedSmsUsers(selectedSmsUsers.filter(id => id !== user.id));
          }
        }}
      />
      <label className="text-sm cursor-pointer flex-1">
        {user.full_name || user.email}
        <span className="text-muted-foreground ml-2">
          ({user.phone_number})
        </span>
      </label>
    </div>
  ))}
</div>

// When saving, convert user IDs to phone numbers
const phoneNumbers = selectedSmsUsers
  .map(userId => smsEnabledUsers.find(u => u.id === userId)?.phone_number)
  .filter(Boolean) as string[];
```

---

**Status**: ✅ Code Complete, ⏳ Awaiting Database Migration Application

**Next Steps**: Apply migration to staging, test functionality, integrate with alerts UI
