# Mock Data Removal - Quick Testing Guide

## 🎯 What Changed?

**ALL mock data has been removed from the entire application.**

Components now either:
- ✅ Load real data from Supabase edge functions
- ✅ Show empty states when no data available
- ✅ Show errors when API calls fail (no fake data fallbacks)

---

## 🧪 How to Test

### 1. Start Development Environment

```bash
cd development

# Start Supabase (if not already running)
supabase start

# Start Next.js dev server
npm run dev

# Open browser to http://localhost:3000
```

### 2. Login Credentials

**Super Admin User:**
- Email: `superadmin@netneural.ai`
- Password: `SuperAdmin123!`

### 3. What to Check on Each Page

#### Dashboard Page (`/dashboard`)
- [x] **Alerts Card** - Should show real alerts from database (or empty state)
- [x] **System Stats Cards** - Should show real device counts, alert counts
- [x] **Data Points Card** - Should show "N/A" (not yet implemented)
- [x] **Recent Activity** - Should show empty state with disabled button

**What You Should SEE:**
- Real device count from your local database
- Real alerts if any exist in database
- Empty states if no data (NOT mock data)

**What You Should NOT SEE:**
- "Temperature Sensor - Floor 1" (was mock data)
- "Pressure Monitor - Tank A" (was mock data)
- "145 devices" (was mock data)

#### Devices Page (`/dashboard/devices`)
- [x] Devices list loads from edge function
- [x] Shows real devices from database
- [x] Shows empty state if no devices (NOT mock devices)

**What You Should NOT SEE:**
- Mock devices with IDs '1', '2', '3'
- "Temperature Sensor - Floor 1", "Pressure Monitor - Tank A", "Vibration Detector - Motor 3"

#### Settings → Integrations (`/dashboard/settings`)
- [x] Integrations tab loads from edge function
- [x] Shows real integrations from database
- [x] Shows empty state if no integrations

**What You Should NOT SEE:**
- Mock Golioth integration
- Mock Email Service integration
- Mock Slack integration
- Mock Webhook integration

#### Analytics Page (`/dashboard/analytics`)
- [x] Shows empty state (analytics not yet implemented)
- [x] All metrics show 0 or "No data"
- [x] Console message: "Analytics not yet implemented"

**What You Should NOT SEE:**
- Mock device performance data
- Mock chart data
- Any fake metrics

---

## 🔍 Developer Console Checks

### Open Browser DevTools (F12) → Console Tab

**✅ GOOD - Should See:**
```
Activity tracking not yet implemented. Need to create audit-logs edge function.
Analytics not yet implemented. Need to create analytics edge function.
Golioth API not configured. Set GOLIOTH_API_KEY and GOLIOTH_PROJECT_ID to enable.
```

**❌ BAD - Should NOT See:**
```
Golioth API not configured - using mock data
Fallback to mock data
Using mock data
```

### Open Browser DevTools (F12) → Network Tab

**Filter by: XHR**

**✅ GOOD - Should See API Calls To:**
```
/functions/v1/organizations
/functions/v1/dashboard-stats
/functions/v1/alerts
/functions/v1/devices
/functions/v1/integrations
```

**✅ Check Each API Call:**
- Status: 200 OK (or 401/403 if auth issue)
- Headers: `Authorization: Bearer <jwt_token>`
- Response: Real JSON data (or empty arrays)

**❌ BAD - Should NOT See:**
- Any API calls to localhost:3000 (should be Supabase URLs)
- Missing Authorization headers
- Mock data in responses

---

## 🧩 Testing Error States

### Test 1: Disconnect Supabase
```bash
# Stop Supabase
supabase stop

# Refresh browser at http://localhost:3000/dashboard

# Expected: Empty states, not mock data
# Check console for connection errors
```

### Test 2: Invalid JWT Token
```bash
# In browser console, clear session:
localStorage.clear()

# Refresh page

# Expected: Redirect to login (or 401 errors)
```

### Test 3: Empty Organization
```sql
-- In Supabase dashboard, run SQL:
DELETE FROM devices WHERE organization_id = 'your-org-id';
DELETE FROM alerts WHERE organization_id = 'your-org-id';
DELETE FROM device_integrations WHERE organization_id = 'your-org-id';

-- Refresh browser

-- Expected: Empty states everywhere (no devices, no alerts, no integrations)
-- Should NOT see mock data
```

---

## 📋 Testing Checklist

### Dashboard Page
- [ ] Alerts card shows real data or empty state (not mock)
- [ ] System stats show real counts or zeros (not mock)
- [ ] Recent activity shows empty state with disabled button
- [ ] Loading states work correctly
- [ ] No console warnings about mock data

### Devices Page
- [ ] Devices list shows real data or empty state (not mock)
- [ ] No mock devices visible
- [ ] API calls to /functions/v1/devices visible in network tab
- [ ] Loading states work correctly

### Settings → Integrations
- [ ] Integrations list shows real data or empty state (not mock)
- [ ] No mock integrations visible
- [ ] API calls to /functions/v1/integrations visible in network tab
- [ ] Loading states work correctly

### Analytics Page
- [ ] Shows empty state (not implemented yet)
- [ ] All metrics show 0 or "No data"
- [ ] Console message about analytics not implemented
- [ ] No mock chart data visible

### Error States
- [ ] With Supabase stopped: Empty states, not mock data
- [ ] With invalid auth: Redirects or shows auth errors
- [ ] With empty org: Empty states everywhere, not mock data

### Network/Console
- [ ] All API calls go to /functions/v1/ endpoints
- [ ] All API calls include Authorization header
- [ ] No mock data warnings in console
- [ ] Proper error messages in console (not silent failures)

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot find name 'createClient'"
**Solution:** Import missing: `import { createClient } from '@/lib/supabase/client'`

### Issue: "Cannot find name 'formatTimestamp'"
**Solution:** Already fixed - function added to AlertsCard.tsx

### Issue: Still seeing mock data
**Solution:** Hard refresh browser (Ctrl+F5) to clear cache

### Issue: API calls returning 401 Unauthorized
**Solution:** 
1. Check if logged in
2. Check if session is valid
3. Re-login if needed

### Issue: API calls returning empty arrays
**Solution:** This is CORRECT behavior now! Check if:
1. Database has data for your organization
2. RLS policies allow your user to see the data
3. Organization is correctly selected in switcher

### Issue: Supabase not starting
**Solution:**
```bash
supabase stop
supabase start
# If still fails, check Docker is running
```

---

## ✅ Success Criteria

**Your testing is successful when:**

1. ✅ NO mock data visible anywhere in UI
2. ✅ All API calls visible in Network tab
3. ✅ All API calls include Authorization headers
4. ✅ Console shows informative messages (not mock data warnings)
5. ✅ Empty states show when no data (not fake data)
6. ✅ Error states show when APIs fail (not fake data)
7. ✅ TypeScript compiles without errors
8. ✅ React renders without warnings

---

## 📊 What Data Should You See?

Based on your `seed.sql`:

### NetNeural Industries (org-1)
- **Devices:** Temperature sensors, pressure monitors, etc. (from seed data)
- **Alerts:** Various alerts based on device states
- **Integrations:** Golioth integration (if configured)

### Acme Manufacturing (org-2)
- **Devices:** Their own devices from seed data
- **Alerts:** Their own alerts
- **Integrations:** Their own integrations

**If you see exactly these values, it's likely still using mock data:**
- 145 devices, 132 active, 13 offline
- Temperature Sensor - Floor 1
- Pressure Monitor - Tank A
- Vibration Detector - Motor 3
- 2,847,583 data points

---

## 🚀 Next Steps After Testing

1. **If all tests pass:** Application is production-ready!
2. **Create audit-logs edge function:** For activity tracking
3. **Create analytics edge function:** For historical data
4. **Deploy to production:** See DEPLOYMENT_GUIDE.md

---

## 📝 Reporting Issues

If you find any remaining mock data, please note:
1. Which page/component
2. What mock data you see
3. Expected behavior
4. Network tab screenshot
5. Console output

---

## 🎉 You're Done When...

- [ ] Tested all 4 main pages
- [ ] Verified all API calls in network tab
- [ ] Checked console for errors/warnings
- [ ] Tested error states (disconnect Supabase)
- [ ] Tested empty states (empty organization)
- [ ] No mock data found anywhere
- [ ] All TypeScript/React errors resolved

**Congratulations! The application now uses 100% real data! 🎊**
