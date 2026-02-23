# SMS Alert Service - Billing & Configuration

## Business Model

NetNeural charges customers for SMS alert delivery as a **billable service feature**, using a **single shared Twilio account**. This approach:

✅ **Simplifies operations** - One Twilio account to manage  
✅ **Improves security** - Credentials stored in environment only, not in database  
✅ **Enables billing** - Track SMS sends per organization for invoicing  
✅ **Better UX** - Users just enable SMS in thresholds, no Twilio setup needed  

---

## Configuration (One-Time Setup)

### Prerequisites
- Twilio account with active SMS service
- Access to GitHub repository secrets (for prod deployment)
- Access to Supabase environment variables (for local/staging)

### Step 1: Get Twilio Credentials

1. Go to https://console.twilio.com/
2. Click **Account** → Copy **Account SID** (starts with `AC`)
3. Click **Account** → **API keys & tokens** → Copy **Auth Token**
4. Go to **Phone Numbers** → **Manage** → Find your SMS number
5. Copy the number in E.164 format: `+1234567890`

### Step 2: Set Environment Variables

#### **For Production (GitHub Pages)**
Store in GitHub repository secrets:

```bash
gh secret set TWILIO_ACCOUNT_SID --body "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
gh secret set TWILIO_AUTH_TOKEN --body "your_auth_token_here"
gh secret set TWILIO_FROM_NUMBER --body "+1234567890"
```

See `development/docs/SECRETS_INVENTORY.md` for complete secrets list.

#### **For Local Development**
Create `.env.local` (gitignored):

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_NUMBER=+1234567890
```

#### **For Staging/Preview**
Set in Supabase environment:

1. Supabase Dashboard → **Settings** → **Environment**
2. Add three environment variables:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_FROM_NUMBER`

### Step 3: Deploy Edge Function

The `send-alert-notifications` Edge Function automatically reads these environment variables. Just deploy it:

```bash
cd development
supabase functions deploy send-alert-notifications --project-ref YOUR-PROJECT-ID
```

---

## How It Works

### User Flow
1. User enables **SMS** in sensor threshold notification channels
2. User enters recipient phone numbers (or selects users with saved phone numbers)
3. Alert triggers → Edge Function reads Twilio credentials from environment
4. SMS sends via NetNeural's Twilio account
5. SMS cost tracked and billed to customer

### Code Flow
```
alert triggers
    ↓
send-alert-notifications Edge Function
    ↓
resolveUserSmsPhoneNumbers() [fetch user phones from DB]
    ↓
normalizePhoneNumber() [convert to E.164 format]
    ↓
Deno.env.get("TWILIO_ACCOUNT_SID") [get Twilio creds from environment]
    ↓
sendSmsNotification() [call Twilio API]
    ↓
Twilio sends SMS
    ↓
Cost added to NetNeural's Twilio bill
```

---

## Billing & Cost Tracking

### Current (Manual)
- Check Twilio Dashboard → **Messages** → See all SMS sent
- Filter by date range to calculate costs per customer
- Implement custom billing logic in dashboard later

### Future (Automated)
- Webhook from Twilio → capture SMS send events → store in `notification_logs` table
- Track SMS count per `organization_id`
- Auto-invoice based on SMS volume

### Twilio Pricing (as of 2026)
- Typically **$0.0075 per SMS** (varies by country)
- Include in usage billing alongside device API calls

---

## Database Schema (No Changes Needed)

The `send-alert-notifications` Edge Function uses existing database fields:

- `sensor_thresholds.notify_phone_numbers` — Manual phone entries
- `sensor_thresholds.notify_user_ids` — Link to users
- `users.phone_number` + `users.phone_sms_enabled` — User-stored phones
- `users.phone_number_secondary` + `users.phone_secondary_sms_enabled` — Secondary phones

**No new `organizations.settings.twilio_*` fields needed** — all credentials come from environment variables.

---

## SMS Feature Enablement

Users enable SMS by:

1. **Dashboard** → **Device Details** → **Sensor Thresholds**
2. Check **SMS** in Notification Channels
3. Enter phone numbers OR select users with saved phones
4. Save threshold
5. Test alert → SMS sends to configured recipients

---

## Monitoring & Troubleshooting

### Check if SMS is working

1. Go to **Supabase Dashboard** → **Functions** → **send-alert-notifications** → **Logs**
2. Trigger a test alert
3. Look for logs:
   - ✅ `[send-alert-notifications] SMS result: { success: true, ... }`
   - ❌ `Twilio not configured` → Environment variables not set
   - ❌ `No SMS recipients configured` → No phones in threshold
   - ❌ `Failed to resolve user phones` → User phones not set

### See SMS activity in Twilio

1. Go to https://console.twilio.com/
2. Click **Messages** → See all SMS sent with timestamps
3. Click individual SMS to see detailed logs

---

## Security Best Practices

✅ **DO:**
- Store Twilio credentials in GitHub Secrets (production) or `.env.local` (local)
- Never commit credentials to version control
- Rotate Auth Token annually (see SECRETS_INVENTORY.md)
- Use service account for API access

❌ **DON'T:**
- Store credentials in `organizations.settings` (not scalable, multi-tenant risk)
- Commit `.env.local` or any secrets to git
- Share Auth Token via Slack, email, or documentation
- Use Twilio trial account phone in production

---

## Compliance Notes

- **SMS Deliverability**: Twilio handles TCPA compliance (carrier registration, opt-out handling)
- **Customer Phone Privacy**: Phone numbers stored encrypted in users table
- **Audit Trail**: All SMS sends logged in Supabase Functions logs + Twilio's message log
- **Data Residency**: Twilio operates worldwide; check data residency requirements for your region

---

## Support Contacts

- **Twilio Support**: https://console.twilio.com/ → Help & Support
- **NetNeural Support**: GitHub Issues for SMS feature requests or bugs
- **Billing Questions**: Contact sales team for SMS usage-based pricing
