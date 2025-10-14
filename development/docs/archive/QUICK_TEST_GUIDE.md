# Quick Testing Guide - Supabase Security Fixes

## 🚀 Quick Start

```bash
# 1. Reset database with new migrations
cd development
npm run supabase:reset

# 2. Create test users
npm run setup:users

# 3. Start edge functions
npm run supabase:functions:serve

# 4. In another terminal, start the app
npm run dev
```

---

## 🧪 Quick Test Checklist

### ✅ Database Migrations
```bash
# Check indexes were created (should see 30+ new indexes)
npm run supabase:status
```

### ✅ Test User Roles

**Test Credentials:**
- **Super Admin:** superadmin@netneural.ai / SuperSecure123!
- **Org Owner:** admin@netneural.ai / password123
- **Regular User:** user@netneural.ai / password123
- **Viewer:** viewer@netneural.ai / password123

### ✅ Browser Tests

1. **Login & Dashboard**
   - [ ] Login as super admin → See "🛡️ Super Admin" badge
   - [ ] Login as org owner → See organization name
   - [ ] Dashboard stats load quickly
   - [ ] Device counts display correctly

2. **Devices Page**
   - [ ] Super admin: Can see all devices
   - [ ] Regular user: Only sees their org's devices
   - [ ] Page loads in < 2 seconds

3. **Alerts Page**
   - [ ] Super admin: Can see all alerts
   - [ ] Regular user: Only sees their org's alerts
   - [ ] Severity filters work
   - [ ] Resolved/unresolved filter works

4. **Organizations Page (Super Admin Only)**
   - [ ] Super admin sees all organizations
   - [ ] Regular user redirected or sees only their org
   - [ ] Statistics (user count, device count) display

---

## 🔍 Edge Function Tests

Get auth tokens from browser:
```javascript
// In browser console after login:
const { data } = await supabase.auth.getSession()
console.log(data.session.access_token)
```

### Test Devices Function
```bash
TOKEN="your_token_here"

# Should return devices for user's org
curl -X GET 'http://localhost:54321/functions/v1/devices' \
  -H "Authorization: Bearer $TOKEN"

# Should fail (401)
curl -X GET 'http://localhost:54321/functions/v1/devices'
```

### Test Alerts Function
```bash
# Get all alerts
curl -X GET 'http://localhost:54321/functions/v1/alerts' \
  -H "Authorization: Bearer $TOKEN"

# Filter by severity
curl -X GET 'http://localhost:54321/functions/v1/alerts?severity=critical' \
  -H "Authorization: Bearer $TOKEN"

# Filter unresolved only
curl -X GET 'http://localhost:54321/functions/v1/alerts?resolved=false' \
  -H "Authorization: Bearer $TOKEN"
```

### Test Dashboard Stats
```bash
curl -X GET 'http://localhost:54321/functions/v1/dashboard-stats' \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🐛 Common Issues & Quick Fixes

### Issue: "Failed to fetch user profile"
```bash
# Check user exists in database
npm run supabase:status
# Then in Supabase Studio SQL editor:
SELECT * FROM users;

# If empty, recreate users:
npm run setup:users
```

### Issue: "Unauthorized" errors
```bash
# Get fresh token
# 1. Login again in browser
# 2. Open DevTools Console
# 3. Run: 
const { data } = await supabase.auth.getSession()
console.log(data.session.access_token)
```

### Issue: Edge functions not working
```bash
# Restart edge functions
# Ctrl+C to stop, then:
npm run supabase:functions:serve
```

### Issue: Migrations not applied
```bash
# Check migration status
npm run supabase:status

# If not applied, reset:
npm run supabase:reset
```

---

## ✨ What to Look For

### 🎯 Security Tests
- ❌ Users should NOT see other organizations' data
- ❌ Regular users should NOT access super admin features
- ✅ Super admins CAN see all organizations
- ✅ All API calls require authentication

### ⚡ Performance Tests
- ✅ Dashboard loads in < 2 seconds
- ✅ Device list loads in < 1 second
- ✅ Alert list loads in < 1 second
- ✅ No "slow query" warnings in console

### 🔐 Authorization Tests
- ✅ Super admin badge shows for superadmin@netneural.ai
- ✅ Organization name shows for regular users
- ✅ Edge functions return metadata (organizationId, queriedBy)
- ✅ 401 errors when no auth token provided
- ✅ 403 errors when accessing unauthorized resources

---

## 📊 Success Criteria

All of these should be TRUE:

- [ ] No hardcoded organization IDs in responses
- [ ] No "Failed to fetch user profile" errors
- [ ] Super admin can see all organizations
- [ ] Regular users restricted to their org
- [ ] Dashboard stats load quickly (< 2s)
- [ ] Device and alert lists filter correctly by org
- [ ] No authentication errors in console
- [ ] All edge functions return proper metadata
- [ ] Database has 30+ new indexes
- [ ] Triggers updating updated_at automatically

---

## 🚨 Red Flags to Watch For

- 🚨 Any "Invalid login credentials" errors
- 🚨 Users seeing other organizations' data
- 🚨 Super admin NOT seeing all organizations
- 🚨 Dashboard taking > 5 seconds to load
- 🚨 Console errors about RLS or permissions
- 🚨 404 errors on edge functions
- 🚨 Timestamps not updating on record changes

---

## 🎉 If Everything Works

You should see:
- ✅ Fast page loads
- ✅ Proper role-based access control
- ✅ No security errors
- ✅ Clean console (no errors)
- ✅ Accurate statistics
- ✅ Super admin features working
- ✅ Regular user restrictions working

**Next Steps:**
1. Mark all tests as passing
2. Deploy to staging
3. Run full test suite
4. Deploy to production

---

## 📞 Need Help?

1. Check `SUPABASE_FIXES_IMPLEMENTATION.md` for detailed info
2. Review `SUPABASE_BEST_PRACTICES_AUDIT.md` for context
3. Check Supabase logs: `npm run supabase:functions:logs`
4. Inspect edge function code in `supabase/functions/`
5. Review auth helper in `supabase/functions/_shared/auth.ts`

---

**Ready to Test!** 🚀
