# Twilio SMS Setup Guide

This guide explains how to set up SMS notifications for the NetNeural IoT Platform using Twilio.

## Overview

SMS notifications are already integrated into the alert notification system. When an alert is triggered, the system can send SMS messages to designated phone numbers via Twilio.

## Prerequisites

1. **Twilio Account**: You need an active Twilio account
2. **Phone Number**: A Twilio phone number capable of sending SMS (can be purchased in Twilio Console)
3. **Verified Recipients** (for trial accounts): Phone numbers must be verified in Twilio Console

## Configuration Options

The platform supports two configuration methods:

### Option 1: Global Configuration (Environment Variables)
Set Twilio credentials as environment variables - applies to all organizations by default.

### Option 2: Per-Organization Configuration (Recommended for multi-tenant)
Store Twilio credentials in organization settings - allows different organizations to use different Twilio accounts.

---

## Setup Instructions

### Step 1: Get Twilio Credentials

1. Log in to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Account** → **API keys & tokens**
3. Copy your **Account SID** and **Auth Token**
4. Go to **Phone Numbers** → **Manage** → **Active numbers**
5. Copy your Twilio phone number (format: +1234567890)

### Step 2: Configure Environment Variables

#### For Local Development

1. Open `.env.local` (or create from `.env.local.template`)
2. Add your Twilio credentials:

```dotenv
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_NUMBER=+1234567890
```

3. Restart your development server

#### For Production (GitHub Secrets)

Add the following secrets to your GitHub repository:

```bash
# Using GitHub CLI (recommended)
gh secret set TWILIO_ACCOUNT_SID --body "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
gh secret set TWILIO_AUTH_TOKEN --body "your_auth_token_here"
gh secret set TWILIO_FROM_NUMBER --body "+1234567890"

# Or via GitHub UI:
# Settings → Secrets and variables → Actions → New repository secret
```

### Step 3: Deploy Edge Functions

The SMS functionality is in the `send-alert-notifications` edge function. Deploy it:

```bash
cd /workspaces/MonoRepo/development

# Deploy all functions
supabase functions deploy

# Or deploy just the notifications function
supabase functions deploy send-alert-notifications
```

### Step 4: Set Supabase Secrets

For production edge functions to access Twilio credentials:

```bash
# Set secrets in Supabase
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=your_auth_token_here
supabase secrets set TWILIO_FROM_NUMBER=+1234567890

# Verify secrets are set
supabase secrets list
```

---

## Usage

### Configure Alert Notifications

#### 1. Set Up Phone Numbers in Sensor Thresholds

When creating or editing a sensor threshold:

```javascript
{
  "name": "Temperature Critical Alert",
  "notification_channels": ["email", "sms", "slack"],
  "notify_emails": ["admin@example.com"],
  "notify_phone_numbers": ["+1234567890", "+0987654321"],
  "notify_user_ids": ["user-uuid-1", "user-uuid-2"]
}
```

#### 2. Per-Organization Twilio Configuration (Optional)

To use different Twilio accounts per organization, update the organization settings:

```sql
-- Update organization notification settings
UPDATE organizations
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{notification_settings}',
  jsonb_build_object(
    'twilio_account_sid', 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    'twilio_auth_token', 'your_auth_token_here',
    'twilio_from_number', '+1234567890',
    'slack_webhook_url', 'https://hooks.slack.com/services/...'
  )
)
WHERE id = 'your-org-id';
```

#### 3. Trigger SMS from Alert

The system automatically sends SMS when:
- An alert is created with a linked threshold
- The threshold has `sms` in `notification_channels`
- Phone numbers are configured in `notify_phone_numbers`

Manual trigger example:

```typescript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/send-alert-notifications`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      alert_id: 'alert-uuid',
      threshold_id: 'threshold-uuid',
      channels: ['email', 'sms'],
      recipient_phone_numbers: ['+1234567890'],
    }),
  }
);
```

---

## SMS Message Format

SMS messages are automatically formatted:

```
⚠️ HIGH ALERT
Temperature exceeded threshold
Device: Warehouse Sensor 01

View: https://demo-stage.netneural.ai/dashboard/alerts/
```

For test alerts:
```
🧪 TEST ALERT
Test notification
Device: Test Device

View: https://demo-stage.netneural.ai/dashboard/alerts/
```

---

## Testing

### 1. Test with Curl

```bash
curl -X POST "${SUPABASE_URL}/functions/v1/send-alert-notifications" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "alert_id": "your-alert-id",
    "channels": ["sms"],
    "recipient_phone_numbers": ["+1234567890"]
  }'
```

### 2. Test from Dashboard

1. Go to **Dashboard** → **Device Types** → **Sensor Thresholds**
2. Create or edit a threshold
3. Enable SMS notification channel
4. Add phone numbers
5. Trigger an alert by sending telemetry outside the threshold

### 3. Verify in Twilio Console

1. Go to **Twilio Console** → **Monitor** → **Logs** → **Messaging**
2. View sent messages, delivery status, and any errors

---

## Troubleshooting

### SMS Not Sending

1. **Check Twilio credentials**:
   ```bash
   supabase secrets list | grep TWILIO
   ```

2. **Check Edge Function logs**:
   ```bash
   supabase functions logs send-alert-notifications --follow
   ```

3. **Verify phone numbers**:
   - Must be in E.164 format: `+1234567890`
   - For trial accounts: numbers must be verified in Twilio Console

4. **Check organization settings**:
   ```sql
   SELECT settings->'notification_settings' 
   FROM organizations 
   WHERE id = 'your-org-id';
   ```

### Common Errors

| Error | Solution |
|-------|----------|
| `Twilio not configured` | Set environment variables or org settings |
| `Invalid phone number` | Use E.164 format: +[country][number] |
| `Authentication failed` | Verify account SID and auth token |
| `Unverified number (trial)` | Verify recipient in Twilio Console or upgrade account |

---

## Configuration Priority

The system checks for credentials in this order:

1. **Organization settings** (`organizations.settings.notification_settings`)
   - `twilio_account_sid`
   - `twilio_auth_token`
   - `twilio_from_number`

2. **Environment variables** (fallback)
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_FROM_NUMBER`

If neither is configured, SMS sending will fail gracefully with an error message.

---

## Cost Considerations

### Twilio Pricing (as of 2024-2025)
- **SMS (US/Canada)**: ~$0.0075 - $0.0079 per message
- **SMS (International)**: Varies by country ($0.02 - $0.15 per message)
- **Phone number rental**: ~$1.15/month

### Optimization Tips

1. **Use email for non-critical alerts**: Reserve SMS for high-priority alerts
2. **Implement rate limiting**: Prevent alert storms from depleting credits
3. **Monitor usage**: Set up Twilio usage alerts
4. **Batch notifications**: Group alerts when possible

---

## Security Best Practices

1. ✅ **Never commit credentials**: Use environment variables and secrets
2. ✅ **Use service accounts**: Create dedicated Twilio subaccounts for production
3. ✅ **Rotate tokens regularly**: Update auth tokens every 90 days
4. ✅ **Monitor usage**: Set up Twilio usage alerts to detect abuse
5. ✅ **Validate phone numbers**: Sanitize and validate before sending
6. ✅ **Enable two-factor auth**: Protect your Twilio account

---

## Database Schema Reference

### Organizations Table
```sql
-- notification_settings structure
{
  "notification_settings": {
    "twilio_account_sid": "ACxxxxx...",
    "twilio_auth_token": "your_token",
    "twilio_from_number": "+1234567890",
    "slack_webhook_url": "https://hooks.slack.com/..."
  }
}
```

### Sensor Thresholds Table
```sql
-- Threshold with SMS configuration
{
  "notification_channels": ["email", "sms", "slack"],
  "notify_emails": ["admin@example.com"],
  "notify_phone_numbers": ["+1234567890"],
  "notify_user_ids": ["uuid-1", "uuid-2"]
}
```

---

## Related Documentation

- [Alert System Documentation](./ALERTS_ANALYTICS_COMPLETE.md)
- [Secrets Management](./SECRETS_GOVERNANCE.md)
- [Edge Functions](../supabase/functions/README.md)
- [Twilio API Documentation](https://www.twilio.com/docs/sms)

---

## Support

For issues specific to:
- **Twilio**: Contact Twilio Support or check [Status Page](https://status.twilio.com/)
- **Platform integration**: Check Edge Function logs or create a GitHub issue
- **Configuration**: Review this guide and check environment variables

---

**Last Updated**: February 20, 2026  
**Version**: 1.0  
**Maintained by**: NetNeural Team
