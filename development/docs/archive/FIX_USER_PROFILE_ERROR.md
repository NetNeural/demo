# Fix: "Failed to fetch user profile" Error

## Problem
When logging in, you see:
```
Failed to fetch user profile: {}
```

This was happening because the SQL query was trying to join the `organizations` table, but super admins have `organization_id = NULL`, causing the join to fail.

## Solution Applied

Updated `src/lib/auth.ts` to handle NULL organization properly:

### Before (Broken)
```typescript
.select(`
  role,
  organization:organizations(id, name)
`)
// This fails when organization_id is NULL
```

### After (Fixed)
```typescript
.select(`
  role,
  organization_id,
  organizations (id, name)
`)
// LEFT JOIN - works even when organization_id is NULL
```

## Testing

### 1. Start Services
```bash
# Terminal 1
npm run supabase:functions:serve

# Terminal 2  
npm run dev
```

### 2. Test Super Admin Login
```
URL: http://localhost:3000/auth/login
Email: superadmin@netneural.ai
Password: SuperSecure123!
```

**Expected Result**: 
- ✅ Login successful
- ✅ No "Failed to fetch user profile" error
- ✅ See "🛡️ Super Admin" badge in sidebar
- ✅ See all 20 devices

### 3. Test Regular User Login
```
Email: admin@netneural.ai
Password: password123
```

**Expected Result**:
- ✅ Login successful
- ✅ See organization name "NetNeural Demo"
- ✅ See 20 devices

## Verification Checklist

### ✅ Database Check
Open Supabase Studio: http://localhost:54323
- Navigate to: Table Editor → users
- Find super admin user:
  - Email: `superadmin@netneural.ai`
  - Role: `super_admin`
  - organization_id: **NULL** (should be empty)

### ✅ Auth Check
- Supabase Studio → Authentication → Users
- Should see 4 users:
  - superadmin@netneural.ai
  - admin@netneural.ai
  - user@netneural.ai
  - viewer@netneural.ai

### ✅ Console Check
Open browser console (F12) after login:
- Should NOT see "Failed to fetch user profile"
- Should NOT see any errors

## What Changed in auth.ts

```typescript
// Now handles both cases:
const isSuperAdmin = profile.role === 'super_admin'

let org: { id: string; name: string } | null = null
if (profile.organizations) {
  org = Array.isArray(profile.organizations) 
    ? profile.organizations[0] 
    : profile.organizations
}

// Super admins don't need an organization
if (isSuperAdmin) {
  return {
    id: user.id,
    email: user.email || '',
    organizationId: null,      // ✅ NULL is OK
    organizationName: null,
    role: profile.role,
    isSuperAdmin: true
  }
}

// Regular users must have organization
if (!org) {
  console.error('User has no organization assigned')
  return null
}
```

## Common Issues

### Issue: Still seeing "Failed to fetch user profile"

**Solution 1**: Clear browser cache
```bash
# Chrome/Edge: Ctrl+Shift+Delete
# Or hard refresh: Ctrl+Shift+R
```

**Solution 2**: Sign out and sign in again
```typescript
// In dashboard, click "Sign out"
// Then login again
```

**Solution 3**: Check database
```bash
# Make sure super admin user exists in users table
npm run supabase:studio
# Go to users table
# Verify super admin has role='super_admin' and organization_id=NULL
```

### Issue: User exists but organization_id is not NULL

**Solution**: The user was created before we added the super admin. Reset:
```bash
npm run supabase:reset
npm run setup:users
```

## Type Safety

The updated `UserProfile` interface now properly handles NULL:

```typescript
export interface UserProfile {
  id: string
  email: string
  organizationId: string | null  // ✅ Can be NULL
  organizationName: string | null // ✅ Can be NULL
  role: 'super_admin' | 'org_owner' | 'org_admin' | 'user' | 'viewer'
  isSuperAdmin: boolean
}
```

## Summary

✅ **Fixed**: SQL query now uses LEFT JOIN for organizations
✅ **Fixed**: Handles NULL organization_id for super admins
✅ **Fixed**: Type-safe with proper null handling
✅ **Fixed**: No more "Failed to fetch user profile" error

**Super admin login should now work!** 🎉

## Quick Test Commands

```bash
# Reset everything
npm run supabase:reset
npm run setup:users

# Start services
npm run supabase:functions:serve &
npm run dev

# Login as super admin
# URL: http://localhost:3000/auth/login
# Email: superadmin@netneural.ai
# Password: SuperSecure123!
```
