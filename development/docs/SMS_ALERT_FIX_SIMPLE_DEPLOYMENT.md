# SMS Alert Fix - Simplified Deployment (Credentials Already Set)

## Overview
Your Twilio credentials are already configured in Supabase environment variables. The SMS fix just needs the updated Edge Function deployed.

---

## What's Fixed

The patched `send-alert-notifications` Edge Function adds:

1. **Phone resolution from user IDs** - When a threshold has `notify_user_ids`, fetch users' phone numbers from the database
2. **Phone format normalization** - Convert all phones to E.164 format (`+15551234567`) before sending to Twilio
3. **Deduplication** - Remove duplicate phone numbers before dispatch
4. **Config key flexibility** - Supports both snake_case and camelCase Twilio environment variable names

---

## Deployment Steps

### Step 1: Deploy the Patched Edge Function

**Option A: Via Supabase Dashboard (Easiest)**
1. Open Supabase Dashboard → **Functions** → **send-alert-notifications**
2. Copy the entire code from `SMS_EDGE_FUNCTION_PATCH.ts`
3. Select ALL code in the editor (Ctrl+A)
4. Paste the new code (Ctrl+V)
5. Click **Deploy**
6. Wait for status to show **"Active"**

**Option B: Via Supabase CLI**
```bash
cd development
supabase functions deploy send-alert-notifications --project-ref YOUR-PROJECT-ID
```

### Step 2: Verify Deployment

Check the function logs to ensure it deployed successfully:

1. Go to **Supabase Dashboard** → **Functions** → **send-alert-notifications**
2. Click **Logs** tab
3. You should see no deployment errors

### Step 3: Test SMS Delivery

#### Test via Dashboard
1. Go to a **Device** → **Sensor Threshold**
2. Enable **SMS** in Notification Channels
3. Enter a test phone number in E.164 format: `+1234567890`
4. Or select a user with a saved phone number
5. Save the threshold
6. Trigger a test alert (if available)

#### Check Results
1. Open **Functions** → **send-alert-notifications** → **Logs**
2. Look for success message:
   ```
   [send-alert-notifications] SMS result: { success: true, detail: "Sent X/X SMS" }
   ```

3. Check Twilio Dashboard:
   - Go to https://console.twilio.com/
   - Click **Messages** to see all sent SMS

---

## How It Works (For Reference)

The Edge Function flow:

```
1. Alert triggers → send-alert-notifications called
2. Fetch alert + threshold + organization data
3. If SMS channel enabled:
   a. Get manual phone numbers from threshold.notify_phone_numbers
   b. If threshold.notify_user_ids set:
      - Query users table for users with phone_sms_enabled = true
      - Extract their phone_number and phone_number_secondary
   c. Normalize all phones to E.164 format
   d. Deduplicate phone list
   e. Read Twilio credentials from environment variables:
      - TWILIO_ACCOUNT_SID
      - TWILIO_AUTH_TOKEN
      - TWILIO_FROM_NUMBER
   f. Call Twilio API to send SMS
4. Return results to caller
```

---

## Troubleshooting

### SMS Not Sending

**Check 1: Function Logs**
- Go to **Supabase Dashboard** → **Functions** → **send-alert-notifications** → **Logs**
- Look for error messages like:
  - `Twilio not configured` → Environment variables missing (unlikely since they're already set)
  - `No SMS recipients configured` → No phones in threshold
  - `Failed to resolve user phones` → Database query error

**Check 2: Threshold Configuration**
```sql
-- Verify threshold has SMS enabled and recipients configured
SELECT 
  id,
  notification_channels,
  notify_user_ids,
  notify_phone_numbers
FROM sensor_thresholds
WHERE id = 'your-threshold-id';
```

Should show:
- `notification_channels` contains `"sms"`
- Either `notify_user_ids` is populated OR `notify_phone_numbers` has entries

**Check 3: User Phone Data**
```sql
-- Verify users have phone numbers with SMS enabled
SELECT 
  id,
  email,
  phone_number,
  phone_sms_enabled,
  phone_number_secondary,
  phone_secondary_sms_enabled
FROM users
WHERE phone_sms_enabled = true
LIMIT 5;
```

Should show at least one user with a phone number.

**Check 4: Phone Format**
Phone must be E.164 format:
- ✅ `+15551234567` (correct)
- ✅ `+441234567890` (UK format, correct)
- ❌ `555-123-4567` (invalid - will be normalized)
- ❌ `(555) 123-4567` (invalid - will be normalized)

The function automatically normalizes phones, so `(555) 123-4567` becomes `+15551234567` before sending to Twilio.

---

## SMS Billing

SMS sends are billed to your Twilio account at Twilio's standard rates (typically $0.0075 per SMS).

To track SMS usage by customer:
1. Check Twilio Dashboard → **Messages** for all sends
2. Optional: Run `NOTIFICATION_LOGS_SETUP.sql` to create automatic cost tracking per organization

---

## Files Used

- **SMS_EDGE_FUNCTION_PATCH.ts** - The patched function code (deploy this)
- **SMS_ALERT_FIX_DIAGNOSTIC.sql** - Optional validation script (if you want to test DB logic)
- **NOTIFICATION_LOGS_SETUP.sql** - Optional: create billing tracking tables

---

## What Changed in the Code

### Before:
```typescript
// Only used manual phone numbers
const phoneNumbers = threshold.notify_phone_numbers || []
await sendSmsNotification(alert, phoneNumbers, ...)
```

### After:
```typescript
// Now resolves phone numbers from user IDs
let phoneNumbers = threshold.notify_phone_numbers || []

// NEW: Fetch user phones if user IDs specified
const userPhones = await resolveUserSmsPhoneNumbers(
  supabaseUrl, 
  serviceKey, 
  threshold.notify_user_ids
)
phoneNumbers = [...phoneNumbers, ...userPhones]

// NEW: Normalize all phones to E.164 format
phoneNumbers = phoneNumbers.map(p => normalizePhoneNumber(p))

// NEW: Remove duplicates
phoneNumbers = [...new Set(phoneNumbers)]

await sendSmsNotification(alert, phoneNumbers, ...)
```

---

## Next Steps

1. ✅ Deploy `SMS_EDGE_FUNCTION_PATCH.ts` to `send-alert-notifications` function
2. ✅ Test with a threshold that has SMS enabled
3. ✅ Monitor function logs to confirm SMS success
4. ✅ Check Twilio dashboard to see message activity
5. (Optional) Set up cost tracking with `NOTIFICATION_LOGS_SETUP.sql`
