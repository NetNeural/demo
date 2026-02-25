# SMS Alert Setup - Add Twilio Credentials to Supabase

Your Twilio credentials need to be added to Supabase environment variables. Here's how:

---

## Step 1: Get Your Twilio Credentials

1. Go to https://console.twilio.com/
2. Click **Account** in left menu
3. Copy your **Account SID** (starts with `AC`)
4. Click **API keys & tokens** → Copy your **Auth Token**
5. Go to **Phone Numbers** → **Manage** → Copy your SMS number in format: `+1234567890`

You now have:
- `TWILIO_ACCOUNT_SID` = `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- `TWILIO_AUTH_TOKEN` = `your_auth_token_here`
- `TWILIO_FROM_NUMBER` = `+1234567890`

---

## Step 2: Add to Supabase Environment

### For Local Development:
Create/edit `.env.local` in the `development/` folder (this file is gitignored):

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_NUMBER=+1234567890
```

Then restart your dev server:
```bash
npm run dev:full:debug
```

### For Supabase Staging/Prod:

1. Open **Supabase Dashboard** 
2. Go to **Settings** → **Environment**
3. Click **+ New Variable** and add these three:

   | Name | Value |
   |------|-------|
   | `TWILIO_ACCOUNT_SID` | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
   | `TWILIO_AUTH_TOKEN` | `your_auth_token_here` |
   | `TWILIO_FROM_NUMBER` | `+1234567890` |

4. Click **Save**

---

## Step 3: Deploy the SMS Function

Once credentials are added, deploy the patched Edge Function:

1. Open **Supabase Dashboard** → **Functions** → **send-alert-notifications**
2. Copy the entire code from `SMS_EDGE_FUNCTION_PATCH.ts`
3. Select ALL code in editor (Ctrl+A)
4. Paste new code (Ctrl+V)
5. Click **Deploy**

---

## Step 4: Test

1. Go to **Device** → **Sensor Threshold**
2. Enable **SMS** in Notification Channels
3. Enter phone number: `+1 (555) 123-4567` or select a user
4. Save threshold
5. Trigger test alert
6. Check **Functions** → **send-alert-notifications** → **Logs**

Look for success:
```
[send-alert-notifications] SMS result: { success: true, detail: "Sent X/X SMS" }
```

If error says "Twilio not configured" → Environment variables not set properly. Check Step 2 again.

---

## For GitHub Actions (Production Deployment)

If deploying via GitHub Actions, add these to GitHub Secrets:

```bash
gh secret set TWILIO_ACCOUNT_SID --body "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
gh secret set TWILIO_AUTH_TOKEN --body "your_auth_token_here"
gh secret set TWILIO_FROM_NUMBER --body "+1234567890"
```

Then reference in your workflow `.yml` file in the `env` section.
