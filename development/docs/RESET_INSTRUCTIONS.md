# Production Database Reset - Step by Step Instructions

## ✅ What You Need to Do

### Step 1: Execute Reset SQL in Supabase Dashboard

1. **The SQL Editor should now be open in your browser**
   - URL: https://supabase.com/dashboard/project/bldojxpockljyivldxwf/sql/new

2. **Copy the entire contents of `production_reset.sql`**
   - File location: `c:/Development/NetNeural/SoftwareMono/development/production_reset.sql`
   - Or copy from below:

3. **Paste into the SQL Editor**

4. **Click "Run" button**

5. **You should see:**
   ```
   Tables remaining: 0
   Types remaining: 0
   ```

6. **This confirms the database is clean**

### Step 2: Push Our IoT Schema (Run in Terminal)

Once the SQL completes successfully, run these commands:

```bash
cd c:/Development/NetNeural/SoftwareMono/development

# Push all our migrations to production
npx supabase db push --linked

# Verify migrations applied
npx supabase migration list --linked
```

You should see all 12 migrations marked as "Applied":
- ✅ 20241201000001_init_schema.sql
- ✅ 20241201000002_rls_policies.sql
- ✅ 20241201000003_organization_members.sql
- ✅ 20241201000004_fix_rls_recursion.sql
- ✅ 20241201000005_fix_default_org_access.sql
- ✅ 20241201000006_fix_membership_creation.sql
- ✅ 20241201000007_temp_debug_policy.sql
- ✅ 20241201000008_restore_proper_rls.sql
- ✅ 20241201000011_remove_recursive_policies.sql
- ✅ 20241215_device_integrations.sql
- ✅ 20250113000001_performance_indexes.sql
- ✅ 20250113000002_timestamp_triggers.sql

### Step 3: Deploy Edge Functions

```bash
# Deploy all 9 edge functions
npx supabase functions deploy --linked --no-verify-jwt
```

### Step 4: Configure Edge Function Secrets

You'll need to get these from the Supabase dashboard:
https://supabase.com/dashboard/project/bldojxpockljyivldxwf/settings/api

```bash
# Set the secrets (replace with actual values from dashboard)
npx supabase secrets set SUPABASE_URL=https://bldojxpockljyivldxwf.supabase.co --linked

npx supabase secrets set SUPABASE_ANON_KEY=<paste-anon-key-here> --linked

npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<paste-service-role-key-here> --linked
```

## 🚨 Important Notes

- ✅ **Backup exists:** `backups/production_backup_20251014_021430.sql`
- ⚠️ **This will delete all current production data**
- ✅ **Can be restored if needed** (though data will be old project management data)
- ✅ **All migrations are tested and working**

## ❓ If Something Goes Wrong

If the reset fails:
1. Check the error message in SQL Editor
2. You can restore with the backup (though it's the old schema)
3. Or we can create a new Supabase project instead

## 📝 After Migrations Are Applied

We'll then:
1. Test the production build locally
2. Configure GitHub Secrets
3. Deploy to GitHub Pages
4. Verify everything works

---

**Ready?** Open the SQL Editor and paste the contents of `production_reset.sql`, then click Run!

Let me know when it completes successfully and I'll continue with the next steps.
