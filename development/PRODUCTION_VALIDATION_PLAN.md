# Production Validation Plan
**Date:** November 14, 2025  
**Version:** v3.2.0  
**Issue:** Golioth sync works locally but inconsistent in production

---

## 🎯 Objective

Systematically verify production environment behaves identically to local development, focusing on Golioth device integration.

---

## 🔍 Known Issues

### Primary Issue: Golioth Integration Inconsistency
- ✅ **Local:** Can sync/import Golioth devices successfully
- ❌ **Production:** Same operations fail or behave inconsistently
- 🤔 **Root Cause:** Unknown (need to investigate)

---

## 📋 Validation Checklist

### Phase 1: Environment Verification

#### 1.1 Check Environment Variables
```bash
# Local (working)
cd development
node -e "require('dotenv').config({path:'.env.local'}); console.log('GOLIOTH_API_KEY:', process.env.GOLIOTH_API_KEY?.substring(0,10) + '...')"

# Production (GitHub Secrets)
gh secret list --repo NetNeural/MonoRepo | grep GOLIOTH
```

**Expected:**
- ✅ GOLIOTH_API_KEY present in both
- ✅ Keys match (same value)

**Test Commands:**
```bash
# Verify local key works
cd development
node explore_golioth_api.js

# Check production deployment used correct key
gh run view --log | grep "GOLIOTH_API_KEY"
```

---

#### 1.2 Check Supabase Connection
```bash
# Local Supabase
curl http://127.0.0.1:54321/health

# Production Supabase
curl https://bldojxpockljyivldxwf.supabase.co/rest/v1/
```

**Expected:**
- ✅ Both return 200 OK
- ✅ Production uses correct project ID

---

### Phase 2: API Endpoint Testing

#### 2.1 Test Golioth API Directly

**Local Test:**
```bash
cd development
node -e "
require('dotenv').config({path:'.env.local'});
const fetch = require('node-fetch');
fetch('https://api.golioth.io/v1/projects/nn-cellular-alerts/devices', {
  headers: {'x-api-key': process.env.GOLIOTH_API_KEY}
})
.then(r => r.json())
.then(d => console.log('Devices:', d.data?.length || 0))
.catch(e => console.error('Error:', e.message))
"
```

**Production Test (via Edge Function):**
```bash
# Test the Edge Function endpoint
curl -X POST https://bldojxpockljyivldxwf.supabase.co/functions/v1/sync-golioth-devices \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:**
- ✅ Both return same device count
- ✅ Same device IDs in response

---

#### 2.2 Test Through UI

**Local:**
1. Open http://localhost:3000/dashboard/integrations
2. Click "Sync Golioth Devices"
3. Check console for API calls
4. Verify devices appear in database

**Production:**
1. Open https://demo.netneural.ai/dashboard/integrations
2. Click "Sync Golioth Devices"
3. Open browser DevTools → Network tab
4. Check for failed requests
5. Look at response payloads

**Compare:**
- Request headers (API key present?)
- Response status codes
- Response bodies
- Error messages

---

### Phase 3: Edge Function Validation

#### 3.1 Check Edge Function Deployment
```bash
cd development
supabase functions list
```

**Expected:**
- ✅ All functions deployed
- ✅ Recent deployment timestamp

#### 3.2 Check Edge Function Secrets
```bash
supabase secrets list
```

**Expected:**
- ✅ GOLIOTH_API_KEY present
- ✅ Matches GitHub secret value

**If missing:**
```bash
gh secret list --repo NetNeural/MonoRepo | grep GOLIOTH_API_KEY
# Copy the value, then:
supabase secrets set GOLIOTH_API_KEY=<value>
```

---

#### 3.3 Test Edge Function Directly
```bash
# Invoke function with test payload
supabase functions invoke sync-golioth-devices \
  --project-ref bldojxpockljyivldxwf \
  --data '{"action":"list"}'
```

**Expected:**
- ✅ Returns device list
- ✅ No authentication errors
- ✅ Same response as local

---

### Phase 4: Network & CORS Validation

#### 4.1 Check CORS Configuration
```bash
# Test from browser console (production site)
fetch('https://api.golioth.io/v1/projects/nn-cellular-alerts/devices', {
  headers: {'x-api-key': 'test'}
})
.then(r => console.log('Status:', r.status))
.catch(e => console.error('CORS error:', e))
```

**Expected:**
- ❌ Should fail with 403 (wrong key) NOT CORS error
- ✅ If CORS error → Golioth API blocking browser requests

---

#### 4.2 Check Edge Function Logs
```bash
# View recent Edge Function logs
supabase functions logs sync-golioth-devices \
  --project-ref bldojxpockljyivldxwf \
  --limit 50
```

**Look for:**
- Authentication errors
- Timeout errors
- Rate limiting errors
- Missing environment variables

---

### Phase 5: Database State Verification

#### 5.1 Check Local Database
```bash
# Connect to local Supabase
psql postgresql://postgres:postgres@localhost:54322/postgres

# Count devices
SELECT COUNT(*) FROM devices WHERE source = 'golioth';

# Check recent imports
SELECT id, name, created_at, metadata->>'golioth_id' 
FROM devices 
WHERE source = 'golioth' 
ORDER BY created_at DESC 
LIMIT 10;
```

#### 5.2 Check Production Database
```bash
# Via Supabase Dashboard or:
psql postgresql://postgres:[PASSWORD]@db.bldojxpockljyivldxwf.supabase.co:5432/postgres

# Run same queries
```

**Compare:**
- Device counts
- Last sync timestamps
- Error logs in `integration_logs` table

---

## 🐛 Debugging Steps

### If Production API Key Invalid:

1. **Verify Secret in GitHub:**
   ```bash
   gh secret list --repo NetNeural/MonoRepo
   ```

2. **Verify Secret in Supabase:**
   ```bash
   supabase secrets list --project-ref bldojxpockljyivldxwf
   ```

3. **Re-set if missing:**
   ```bash
   # Get from Golioth Console: https://console.golioth.io/settings/api-keys
   gh secret set GOLIOTH_API_KEY --repo NetNeural/MonoRepo
   supabase secrets set GOLIOTH_API_KEY=<value> --project-ref bldojxpockljyivldxwf
   
   # Redeploy Edge Functions
   supabase functions deploy sync-golioth-devices --project-ref bldojxpockljyivldxwf
   ```

---

### If Rate Limiting:

1. **Check Golioth Console:**
   - Login: https://console.golioth.io
   - Navigate: Settings → API Usage
   - Check rate limits

2. **Add Rate Limiting Logic:**
   ```typescript
   // In Edge Function
   const RATE_LIMIT_DELAY = 1000; // 1 second between requests
   await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
   ```

---

### If CORS Issues:

**Solution:** Always call Golioth API from Edge Functions, never from browser

**Fix client code:**
```typescript
// ❌ BAD: Direct API call from browser
const response = await fetch('https://api.golioth.io/...', {
  headers: {'x-api-key': apiKey}
});

// ✅ GOOD: Call via Edge Function
const response = await fetch('/functions/v1/sync-golioth-devices', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({action: 'sync'})
});
```

---

### If Environment Variable Not Found:

1. **Check build logs:**
   ```bash
   gh run view --log | grep GOLIOTH
   ```

2. **Verify Next.js can access it:**
   ```typescript
   // Add debug endpoint: app/api/debug/env/route.ts
   export async function GET() {
     return Response.json({
       hasGoliothKey: !!process.env.GOLIOTH_API_KEY,
       keyLength: process.env.GOLIOTH_API_KEY?.length || 0
     });
   }
   ```

---

## 📊 Expected Results

### Successful Validation:
- ✅ Same device count in local and production
- ✅ Same API responses
- ✅ No 401/403 errors
- ✅ Sync completes in <5 seconds
- ✅ Devices appear in production UI

### Common Failure Patterns:

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| 401 Unauthorized | Wrong API key | Re-set GOLIOTH_API_KEY secret |
| 403 Forbidden | API key lacks permissions | Generate new key with correct permissions |
| Timeout | Edge Function cold start | Add retry logic |
| CORS error | Calling API from browser | Move to Edge Function |
| Empty response | Wrong project ID | Verify GOLIOTH_PROJECT_ID=nn-cellular-alerts |
| Works locally, fails prod | Env var not set in prod | Check GitHub Secrets + Supabase Secrets |

---

## 🔄 Iterative Testing Process

1. **Run Phase 1** (Environment Verification)
2. **Document findings** in this file
3. **Run Phase 2** (API Testing)
4. **If failure → Run Phase 4** (Debugging)
5. **Fix issue**
6. **Re-run Phase 2**
7. **Continue to Phase 3**

---

## 📝 Test Results Log

### Test Run 1: [DATE]
**Tester:** [NAME]  
**Environment:** Local vs Production

| Phase | Test | Local | Production | Status | Notes |
|-------|------|-------|------------|--------|-------|
| 1.1 | GOLIOTH_API_KEY present | ✅ | ⏳ | | |
| 1.2 | Supabase connection | ✅ | ⏳ | | |
| 2.1 | Direct API test | ✅ | ⏳ | | |
| 2.2 | UI sync test | ✅ | ⏳ | | |
| 3.1 | Edge Function deployed | ✅ | ⏳ | | |
| 3.2 | Edge Function secrets | ✅ | ⏳ | | |
| 3.3 | Edge Function invoke | ✅ | ⏳ | | |

**Findings:**
- [Document specific errors/differences here]

**Action Items:**
- [ ] [Specific fix needed]

---

## 🚀 Next Steps After Validation

Once production is validated:

1. **Add Automated Tests:**
   ```typescript
   // __tests__/integration/golioth-sync.test.ts
   describe('Golioth Sync Integration', () => {
     it('should sync devices from Golioth', async () => {
       const result = await syncGoliothDevices();
       expect(result.deviceCount).toBeGreaterThan(0);
     });
   });
   ```

2. **Add Monitoring:**
   - Sentry alerts for Golioth sync failures
   - Daily sync health check
   - Device count dashboard

3. **Add Retry Logic:**
   ```typescript
   async function syncWithRetry(maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await syncGoliothDevices();
       } catch (err) {
         if (i === maxRetries - 1) throw err;
         await sleep(1000 * Math.pow(2, i)); // Exponential backoff
       }
     }
   }
   ```

---

**Start with Phase 1.1** - Let's verify the environment variables match!
