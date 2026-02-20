# Twilio SMS Quick Start

Get SMS alerts working in 5 minutes! 📱

## Step 1: Get Your Twilio Credentials

1. Go to [Twilio Console](https://console.twilio.com/)
2. Get your:
   - Account SID (starts with `AC`)
   - Auth Token (click to reveal)
   - Phone Number (buy one if needed: Console → Phone Numbers → Buy a number)

## Step 2: Run the Setup Script

```bash
cd /workspaces/MonoRepo/development
./scripts/setup-twilio-sms.sh
```

This will:
- ✅ Add credentials to `.env.local`
- ✅ Set GitHub Secrets
- ✅ Configure Supabase Edge Functions

## Step 3: Deploy the Edge Function

```bash
supabase functions deploy send-alert-notifications
```

## Step 4: Test It

```bash
./scripts/test-twilio-sms.sh
# Enter your phone number when prompted
```

## Step 5: Configure Alerts

### Option A: Via Dashboard (Coming Soon)
Navigate to Sensor Thresholds and add phone numbers

### Option B: Via SQL

```sql
-- Example: Update a threshold to send SMS
UPDATE sensor_thresholds
SET 
  notification_channels = ARRAY['email', 'sms'],
  notify_phone_numbers = ARRAY['+1234567890']
WHERE name = 'Critical Temperature Alert';
```

### Option C: Via API

```typescript
// Create threshold with SMS
const { data } = await supabase
  .from('sensor_thresholds')
  .insert({
    name: 'Temperature Alert',
    notification_channels: ['email', 'sms'],
    notify_phone_numbers: ['+1234567890'],
    // ... other fields
  });
```

## Troubleshooting

### SMS not sending?

1. **Check credentials**:
   ```bash
   supabase secrets list | grep TWILIO
   ```

2. **Check function logs**:
   ```bash
   supabase functions logs send-alert-notifications --follow
   ```

3. **Verify phone format**: Must be E.164 format (`+1234567890`)

4. **Trial account**: Verify recipient numbers in [Twilio Console](https://console.twilio.com/phone-numbers/verified)

### Common Issues

| Issue | Fix |
|-------|-----|
| "Twilio not configured" | Run setup script |
| "Invalid phone number" | Use format: `+[country][number]` |
| "Authentication failed" | Double-check account SID and auth token |
| "Unverified number" (trial) | Verify in Twilio Console or upgrade |

---

## Full Documentation

See [TWILIO_SMS_SETUP.md](./TWILIO_SMS_SETUP.md) for:
- Detailed configuration options
- Per-organization setup
- Security best practices
- Cost optimization
- Database schema reference

---

## Need Help?

- 📖 [Full Documentation](./TWILIO_SMS_SETUP.md)
- 🐛 [Report Issues](https://github.com/NetNeural/MonoRepo/issues)
- 💬 [Twilio Support](https://support.twilio.com/)

---

**Pro Tip**: For production, consider using per-organization Twilio accounts stored in the database rather than global environment variables. This allows different organizations to use their own Twilio accounts and numbers.

**Cost Estimate**: ~$0.0075/SMS (US), ~$1.15/month for phone number rental
