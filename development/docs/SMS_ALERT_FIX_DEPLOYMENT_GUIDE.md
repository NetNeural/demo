# SMS Alert Fix - Complete Deployment Guide

## Overview

This guide walks you through deploying the SMS alert fix to your Supabase environment. The fix resolves two issues:

1. **Phone resolution from user IDs** - SMS now uses user-stored phone numbers, not just manual entries
2. **Phone format normalization** - All phones converted to E.164 format before Twilio API call

---

## Files You Have

1. **SMS_ALERT_FIX_DIAGNOSTIC.sql** - Test script to validate the fix before deployment
2. **SMS_EDGE_FUNCTION_PATCH.ts** - Updated Edge Function with SMS fixes
3. **TWILIO_SMS_SETUP_SQL.sql** - Configure Twilio credentials in your org settings
4. **This guide**

---

## Step 1: Configure Twilio (One-Time Setup)

### 1.1 Get Your Twilio Credentials

1. Visit https://console.twilio.com/
2. Click "Account" in left menu → "API keys & tokens"
3. Copy your **Account SID** (starts with `AC`)
4. Copy your **Auth Token** (keep this secret!)
5. Go to "Phone Numbers" → "Manage" → find your **Active number**
6. Copy your phone in E.164 format: `+1234567890`

### 1.2 Set Credentials in Environment Variables

NetNeural uses a **centralized Twilio account** charged as a billable service. Store credentials in:

**For Production (GitHub Pages deployment):**

```bash
gh secret set TWILIO_ACCOUNT_SID --body "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
gh secret set TWILIO_AUTH_TOKEN --body "your_auth_token_here"
gh secret set TWILIO_FROM_NUMBER --body "+1234567890"
```

**For Local Development:**
Create `.env.local` (gitignored):

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_NUMBER=+1234567890
```

**For Supabase Staging:**

1. Open **Supabase Dashboard** → **Settings** → **Environment**
2. Add three variables with your Twilio credentials

See `development/docs/SECRETS_INVENTORY.md` for complete secrets list.

---

## Step 2: Validate Fix Logic (Diagnostic Test)

### 2.1 Run the Diagnostic Script

1. Open **Supabase Dashboard** → **SQL Editor**
2. Create a new query
3. Paste content from `SMS_ALERT_FIX_DIAGNOSTIC.sql`
4. Replace these placeholders:
   ```
   WHERE id = 'THRESHOLD_ID'::uuid
   WHERE id = 'ALERT_ID'::uuid
   ```
5. Run the script from top to bottom (sections 1-7)

### 2.2 Check Results

**Expected results:**

- **Section 1**: Users with phone numbers + SMS enabled

  ```
  id | email | phone_number | phone_sms_enabled
  ---+-------+--------------+-------------------
  uu1| user@ | +15551234567 | true
  ```

- **Section 3**: Phone numbers resolved from user IDs

  ```
  user_id | primary_phone  | phone_available
  --------+----------------+-----------------
  uu1     | +15551234567   | primary
  ```

- **Section 4**: Combined phone list (manual + from users)

  ```
  threshold_id | source        | phone        | is_e164_format
  ─────────────+───────────────+──────────────+────────────────
  th1          | manual        | +15551234567 | true
  th1          | from_user_ids | +15559876543 | true
  ```

- **Section 5**: Normalization test
  ```
  input              | cleaned      | is_valid_e164
  ───────────────────+──────────────+───────────────
  +15551234567       | +15551234567 | true
   +1 (555) 123-4567 | +15551234567 | true
  ```

**If results look good → Proceed to Step 3**

**If issues found:**

- Empty Section 1: Users haven't set up phone numbers (go to Dashboard → Profile → Phone to add)
- Empty Section 3: No `notify_user_ids` in threshold (edit threshold in Dashboard)
- Empty Section 4: Twilio not configured (redo Step 1)

---

## Step 3: Deploy Updated Edge Function

### 3.1 Method A: Manual via Dashboard (Recommended)

1. Open **Supabase Dashboard**
2. Go to **Functions** in left menu
3. Click **send-alert-notifications**
4. Copy the entire content from `SMS_EDGE_FUNCTION_PATCH.ts`
5. Select ALL code in the editor (Ctrl+A)
6. Paste the new code (Ctrl+V)
7. Click **Deploy** button (top right)
8. Wait for deployment to complete (~30 seconds)
9. Check that status shows **"Active"**

### 3.2 Method B: Via Supabase CLI (if available)

```bash
cd development
supabase functions deploy send-alert-notifications --project-ref YOUR-PROJECT-ID
```

Find your project ID in: **Supabase Dashboard** → **Settings** → **General** → **Project ID**

---

## Step 4: Test SMS Delivery

### 4.1 Manual Test via API

After function deployed, run this from PowerShell or terminal:

```bash
# Set these variables
$PROJECT_ID = "your-project-id"
$ANON_KEY = "your-anon-key"
$ALERT_ID = "your-alert-id"

# Find these in Supabase Dashboard → Settings → API
# Also go to Supabase Dashboard → SQL Editor and run:
#   SELECT id FROM alerts ORDER BY created_at DESC LIMIT 1;
#   SELECT id FROM sensor_thresholds ORDER BY created_at DESC LIMIT 1;

curl -X POST "https://$PROJECT_ID.supabase.co/functions/v1/send-alert-notifications" `
  -H "Authorization: Bearer $ANON_KEY" `
  -H "Content-Type: application/json" `
  -d '{
    "alert_id": "'$ALERT_ID'",
    "channels": ["sms"]
  }'
```

**Expected response:**

```json
{
  "success": true,
  "channels_dispatched": 1,
  "channels_succeeded": 1,
  "results": [
    {
      "channel": "sms",
      "success": true,
      "detail": "Sent 2/2 SMS"
    }
  ]
}
```

### 4.2 Test via Dashboard

If you deployed the Edge Function but can't test via API:

1. Open **Supabase Dashboard** → **Functions** → **send-alert-notifications** → **Logs**
2. Wait for any function invocations to appear
3. Look for log entries like:
   - ✅ `[send-alert-notifications] SMS result: { success: true, ... }`
   - ❌ `Twilio not configured` → Redo Step 1
   - ❌ `No SMS recipients configured` → Add phone numbers in threshold
   - ❌ `Failed to resolve user phones` → Check users table has phone_number + phone_sms_enabled

---

## Step 5: Enable SMS in Threshold (Frontend)

1. Go to **Dashboard** → **Device Details**
2. Find **Sensors** tab → select a sensor
3. Click **Edit Threshold**
4. Check **SMS** in Notification Channels
5. Select users to notify (will use their stored phone numbers)
6. Or enter manual phone numbers (in E.164 format: `+15551234567`)
7. Click **Save**

---

## Troubleshooting

### SMS Not Sending

**Check 1: Twilio configured?**

```sql
SELECT settings->'notification_settings' FROM organizations LIMIT 1;
```

Should show: `twilio_account_sid`, `twilio_auth_token`, `twilio_from_number`

**Check 2: Threshold has SMS enabled?**

```sql
SELECT id, notification_channels, notify_user_ids, notify_phone_numbers
FROM sensor_thresholds
WHERE id = 'your-threshold-id';
```

Should show: `notification_channels` contains `"sms"`, and either `notify_user_ids` or `notify_phone_numbers` populated

**Check 3: Users have phone numbers?**

```sql
SELECT id, email, phone_number, phone_sms_enabled
FROM users
WHERE phone_sms_enabled = true;
```

Should show at least one user with a phone number

**Check 4: Function logs**

- Open **Supabase Dashboard** → **Functions** → **send-alert-notifications** → **Logs**
- Trigger a test alert
- Look for errors like "Twilio not configured" or "No SMS recipients"

### Trial Twilio Account Limitations

If using a **Twilio trial account**:

- Can only send SMS to **verified phone numbers**
- Must explicitly verify each recipient number in Twilio Console
- Remove trial restriction after upgrading to paid account

### Phone Format Issues

Phone must be in **E.164 format**: `+[country code][number]`

- ✅ `+15551234567` (US)
- ✅ `+441234567890` (UK)
- ❌ `555-123-4567` (invalid)
- ❌ `(555) 123-4567` (invalid)

The patched function automatically normalizes phones, so:

- User enters: `(555) 123-4567`
- Normalized to: `+15551234567`
- Sent to Twilio: `+15551234567`

---

## What Changed in the Edge Function

### Before:

```typescript
// Only checked manual phone numbers from threshold
const allPhones = threshold.notify_phone_numbers || []
await sendSmsNotification(alert, allPhones, ...)
```

### After:

```typescript
// Now resolves phones from user IDs + normalizes them
let phones = threshold.notify_phone_numbers || []

// NEW: Resolve user IDs to phone numbers
const userPhones = await resolveUserSmsPhoneNumbers(supabaseUrl, serviceKey, threshold.notify_user_ids)
phones = [...phones, ...userPhones]

// NEW: Normalize all phones to E.164 format
phones = phones.map(p => normalizePhoneNumber(p))

// NEW: Deduplicate
phones = [...new Set(phones)]

await sendSmsNotification(alert, phones, ...)
```

---

## Security Notes

- **Never commit Twilio credentials to git** ✅ Using database storage + env vars
- **Keep Auth Token secret** - Only shown once in Twilio Console
- **Use GitHub Secrets for CI/CD** - If deploying via automation
- **Row-Level Security (RLS)** - Ensure users can only edit their own phone numbers

---

## Rollback

If you need to revert the function to the previous version:

1. Open **Supabase Dashboard** → **Functions** → **send-alert-notifications**
2. Click the **...** menu → **View Deployment History**
3. Find the previous deployment
4. Click **Rollback**

Or manually:

- Paste the original function code back into the editor
- Click **Deploy**

---

## Next Steps

After SMS is working:

1. Test with production alert (create a threshold that triggers an alert)
2. Monitor **Supabase Functions** logs for SMS results
3. Check Twilio Console → **Messages** tab to see all sent SMS
4. If using GitHub Pages deployment, SMS works automatically (serverless, no re-deploy needed)

---

## Support

If SMS still doesn't work after these steps:

1. Check **TWILIO_SMS_SETUP.md** in the codebase for additional setup
2. Review **Function Logs** in Supabase Dashboard for specific error messages
3. Verify Twilio account is not in trial mode with unverified numbers
4. Check that user phone numbers are in E.164 format
