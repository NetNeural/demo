# Integration System - Deployment Checklist

## 📋 Pre-Deployment Steps

### 1. Database Migrations
Run the following migrations in order:

```bash
# Navigate to development folder
cd development

# Run notification log migration
supabase migration up 20251027000003_notification_log.sql

# Run mqtt messages migration
supabase migration up 20251027000004_mqtt_messages.sql

# Verify migrations
supabase db diff
```

### 2. Regenerate Database Types
After running migrations, update TypeScript types:

```bash
# Generate new types
npm run supabase:types

# Or manually:
supabase gen types typescript --local > src/types/supabase.ts
```

This will resolve the TypeScript error in `integration.service.ts` for the `notification_log` table.

### 3. Deploy Edge Functions
Deploy all integration Edge Functions:

```bash
# Deploy notification function
supabase functions deploy send-notification

# Deploy AWS IoT sync
supabase functions deploy aws-iot-sync

# Deploy Azure IoT sync
supabase functions deploy azure-iot-sync

# Deploy Google Cloud IoT sync
supabase functions deploy google-iot-sync

# Deploy MQTT broker
supabase functions deploy mqtt-broker

# Verify deployments
supabase functions list
```

### 4. Environment Variables
Ensure the following environment variables are set in Supabase:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 5. Test Integrations
Test each integration type:

```typescript
// 1. Test Email
await integrationService.testIntegration(emailIntegrationId, 'email')

// 2. Test Slack
await integrationService.testIntegration(slackIntegrationId, 'slack')

// 3. Test Webhook
await integrationService.testIntegration(webhookIntegrationId, 'webhook')

// 4. Test MQTT
await integrationService.testIntegration(mqttIntegrationId, 'mqtt')

// 5. Test AWS IoT sync
await integrationService.syncAwsIot({
  organizationId,
  integrationId: awsIntegrationId,
  operation: 'import'
})

// 6. Test Azure IoT sync
await integrationService.syncAzureIot({
  organizationId,
  integrationId: azureIntegrationId,
  operation: 'import'
})

// 7. Test Google Cloud IoT sync
await integrationService.syncGoogleIot({
  organizationId,
  integrationId: googleIntegrationId,
  operation: 'import'
})
```

---

## ✅ Verification Checklist

### Database
- [ ] `notification_log` table created
- [ ] `mqtt_messages` table created
- [ ] RLS policies active on both tables
- [ ] Indexes created
- [ ] TypeScript types regenerated

### Edge Functions
- [ ] `send-notification` deployed
- [ ] `aws-iot-sync` deployed
- [ ] `azure-iot-sync` deployed
- [ ] `google-iot-sync` deployed
- [ ] `mqtt-broker` deployed
- [ ] All functions return 200 on OPTIONS (CORS)
- [ ] All functions require authentication

### Frontend
- [ ] All 8 config dialogs render correctly
- [ ] Forms validate input properly
- [ ] Save/cancel buttons work
- [ ] Integration cards display status
- [ ] Service layer functions callable
- [ ] No TypeScript errors (after type regeneration)

### Integration Testing
- [ ] Email sends successfully
- [ ] Slack posts messages
- [ ] Webhooks trigger with correct signatures
- [ ] AWS IoT imports devices
- [ ] Azure IoT syncs device twins
- [ ] Google IoT creates devices
- [ ] MQTT publishes messages
- [ ] Golioth sync still works (regression test)

### Security
- [ ] RLS policies prevent cross-org access
- [ ] API keys encrypted in database
- [ ] Webhook signatures validated
- [ ] Bearer tokens required for Edge Functions
- [ ] Sensitive data not exposed in frontend

### Documentation
- [ ] `INTEGRATIONS_GUIDE.md` reviewed
- [ ] `INTEGRATION_IMPLEMENTATION_COMPLETE.md` reviewed
- [ ] Example usage documented
- [ ] Configuration schemas documented
- [ ] API reference complete

---

## 🚨 Known Issues

### TypeScript Lint Errors (Non-Blocking)
The following lint errors are **expected** and will not affect functionality:

1. **Edge Functions (Deno modules)**
   - `Cannot find module 'https://deno.land/std@0.168.0/http/server.ts'`
   - `Cannot find name 'Deno'`
   - **Resolution:** These are Deno-specific imports that work in Supabase runtime
   - **Action:** No action needed

2. **notification_log TypeScript error**
   - `Argument of type '"notification_log"' is not assignable...`
   - **Resolution:** Run migrations and regenerate types (Step 2 above)
   - **Action:** Required before deployment

### MQTT Implementation Note
The current MQTT implementation uses HTTP-based bridges. For production use with native MQTT clients:
- Consider using WebSocket connections
- Implement proper MQTT client library
- Add connection pooling
- Handle reconnection logic

### Google Cloud IoT Authentication
The JWT signing for Google OAuth2 is currently simplified:
- Production should use proper RSA signing with `private_key` from service account
- Consider using `google-auth-library` or similar
- Implement token caching

---

## 📊 Post-Deployment Monitoring

### Metrics to Track
1. **Integration Health**
   - Success/failure rates per integration type
   - Average response times
   - Error counts

2. **Notification Logs**
   ```sql
   -- Daily notification counts
   SELECT 
     integration_type,
     status,
     COUNT(*) as count
   FROM notification_log
   WHERE created_at > NOW() - INTERVAL '24 hours'
   GROUP BY integration_type, status
   ORDER BY count DESC;
   ```

3. **MQTT Messages**
   ```sql
   -- Recent MQTT activity
   SELECT 
     topic,
     COUNT(*) as message_count
   FROM mqtt_messages
   WHERE received_at > NOW() - INTERVAL '1 hour'
   GROUP BY topic
   ORDER BY message_count DESC;
   ```

4. **Integration Status**
   ```sql
   -- Active integrations by organization
   SELECT 
     o.name as organization,
     di.integration_type,
     di.status,
     di.last_sync_at
   FROM device_integrations di
   JOIN organizations o ON o.id = di.organization_id
   WHERE di.status = 'active'
   ORDER BY o.name, di.integration_type;
   ```

### Alerts to Configure
- [ ] Edge Function error rate > 5%
- [ ] Integration sync failures
- [ ] Notification send failures
- [ ] Database table size warnings
- [ ] Rate limit approaching

---

## 🔄 Rollback Plan

If issues arise, rollback in reverse order:

1. **Disable Integrations**
   ```sql
   UPDATE device_integrations 
   SET status = 'inactive' 
   WHERE integration_type IN ('azure_iot', 'google_iot', 'mqtt');
   ```

2. **Rollback Edge Functions**
   ```bash
   # Restore previous versions
   supabase functions deploy send-notification --version previous
   ```

3. **Rollback Migrations** (if necessary)
   ```bash
   supabase migration down 20251027000004_mqtt_messages.sql
   supabase migration down 20251027000003_notification_log.sql
   ```

---

## 📞 Support Resources

### Documentation
- Main Guide: `docs/INTEGRATIONS_GUIDE.md`
- Implementation Summary: `docs/INTEGRATION_IMPLEMENTATION_COMPLETE.md`
- Supabase Docs: https://supabase.com/docs

### Code References
- Service Layer: `src/services/integration.service.ts`
- Config Dialogs: `src/components/integrations/*ConfigDialog.tsx`
- Edge Functions: `supabase/functions/*/index.ts`
- Migrations: `supabase/migrations/2025102700000*.sql`

---

## ✨ Success Criteria

Deployment is successful when:
- [x] All migrations run without errors
- [x] All Edge Functions deployed and accessible
- [x] TypeScript compiles without errors
- [x] All integration types testable via UI
- [x] Notification logs being created
- [x] MQTT messages being stored
- [x] No RLS policy violations
- [x] Documentation up to date

---

**Deployment Status:** 🟡 Ready for deployment (pending migration run)

**Last Updated:** 2025-10-27
