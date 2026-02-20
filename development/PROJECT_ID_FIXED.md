# FIXED: Correct Supabase Project ID

## What Was Wrong

All the fix scripts were using the **OLD project ID**: `bldojxpockljyivldxwf`  
But your production uses the **CORRECT project ID**: `atgbmxicqikmapfqouco`

## What I Fixed

✅ Updated: `scripts/fix-production-rls.sh` - now uses correct project ID  
✅ Updated: `docs/QUICK_FIX_PROFILE_LOAD_FAILED.md` - now points to correct project  
✅ Updated: `docs/TROUBLESHOOTING_PROFILE_LOAD_FAILED.md` - all references updated  
✅ Created: `scripts/quick-fix-rls.sh` - **NEW simple script with correct project ID**

## What You Need to Do NOW

### Option 1: Use the NEW Quick Fix Script (Recommended)

```bash
cd development

# Make sure you're logged in to Supabase first
supabase login

# Run the quick fix
bash scripts/quick-fix-rls.sh
```

This script:

- ✅ Already has the correct project ID: `atgbmxicqikmapfqouco`
- ✅ Links to your production project automatically
- ✅ Applies the RLS fix migration
- ✅ Doesn't need environment variables

### Option 2: Manual Fix via Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco
2. Click: **SQL Editor** → **New Query**
3. Copy the contents of: `development/supabase/migrations/20260214000001_fix_users_rls_circular_dependency.sql`
4. Paste and click **Run**

## After Applying the Fix

1. **Clear browser cache** or use incognito mode
2. Go to: https://demo-stage.netneural.ai
3. Log in:
   - Email: `admin@netneural.com`
   - Password: `password123`
4. Should work now! ✅

## Still Having Issues?

If it still doesn't work after applying the fix:

```bash
cd development
node scripts/fix-production-user.js
```

This will check:

- ✅ If user exists in auth.users
- ✅ If organization exists
- ✅ If user profile exists in public.users
- ✅ If there are any RLS policy issues
- 🔧 Create any missing records

## Summary

**Problem**: Scripts were using wrong project ID  
**Solution**: Created new script with correct ID (`atgbmxicqikmapfqouco`)  
**Action**: Run `bash scripts/quick-fix-rls.sh` from development directory  
**Result**: RLS circular dependency will be fixed, login should work

---

**Ready to go!** Just run the quick-fix-rls.sh script and you should be good.
