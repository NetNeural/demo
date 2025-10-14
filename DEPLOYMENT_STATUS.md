# Production Deployment - Current Status & Next Steps

## ✅ Completed So Far

1. **Supabase CLI Setup**
   - ✅ Logged in to Supabase
   - ✅ Linked to production project: `bldojxpockljyivldxwf`
   - ✅ Updated database version to PostgreSQL 17

2. **Database Backup**
   - ✅ Created backup: `backups/production_backup_20251014_021430.sql`
   - ✅ Backup includes full schema and data from production

3. **Schema Analysis**
   - ✅ Identified production has **project management schema**
   - ✅ We need **IoT member management schema**
   - ✅ Schemas are incompatible - need complete replacement

## ⚠️ Critical Decision Needed

### Current Situation

The production database (`bldojxpockljyivldxwf`) currently contains:
- Project management tables (projects, tasks, files, etc.)
- Activity logs and sensors
- Profiles system (different from our users table)

Our member management system has:
- IoT device management (devices, device_data, device_integrations)
- User/organization management (users, organizations, departments)
- Alerts and notifications for IoT

**These schemas are completely different and incompatible.**

### Options

#### Option 1: Reset Production Database (Recommended for New Deployment)

**Pros:**
- Clean start with correct schema
- All migrations applied correctly
- Proper RLS policies
- Edge functions will work correctly

**Cons:**
- Loses existing production data (but we have backup)
- Requires manual SQL execution in Supabase dashboard

**Steps:**
1. Go to Supabase Dashboard SQL Editor
2. Run the script: `production_reset.sql`
3. Then run: `npx supabase db push --linked`
4. Deploy edge functions
5. Deploy to GitHub Pages

#### Option 2: Create New Supabase Project

**Pros:**
- Keep existing production data intact
- Fresh project with correct schema from start
- Can migrate data later if needed

**Cons:**
- Need to update all credentials
- Need to configure new project
- Takes more time initially

**Steps:**
1. Create new Supabase project in dashboard
2. Link to new project
3. Push migrations
4. Deploy edge functions
5. Update `.env.production` with new credentials
6. Deploy to GitHub Pages

#### Option 3: Keep Existing Schema and Adapt

**Pros:**
- No data loss
- Minimal disruption

**Cons:**
- Would require significant code changes
- App won't work with existing schema
- Not viable for IoT member management features

**Not recommended - too much rework needed**

## 📋 Recommended Path Forward

### If Current Production Data is NOT Critical (Recommended):

```bash
# Step 1: Execute production_reset.sql in Supabase Dashboard
# Go to: https://supabase.com/dashboard/project/bldojxpockljyivldxwf/sql/new
# Paste contents of production_reset.sql
# Click "Run"

# Step 2: Push our IoT schema
cd c:/Development/NetNeural/SoftwareMono/development
npx supabase db push --linked

# Step 3: Verify migrations applied
npx supabase migration list --linked

# Step 4: Deploy edge functions
npx supabase functions deploy --linked --no-verify-jwt

# Step 5: Set edge function secrets
npx supabase secrets set SUPABASE_URL=https://bldojxpockljyivldxwf.supabase.co --linked
npx supabase secrets set SUPABASE_ANON_KEY=<from-dashboard> --linked
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<from-dashboard> --linked

# Step 6: Build and test locally
npm run build
npx serve out -p 3001

# Step 7: Commit and deploy
git add -A
git commit -m "feat: production deployment configuration"
git push origin development

# Step 8: Configure GitHub Secrets (in browser)
# Go to: https://github.com/NetNeural/MonoRepo/settings/secrets/actions
# Add: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, 
#      SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ACCESS_TOKEN

# Step 9: Merge to main and deploy
git checkout main
git merge development --no-ff
git push origin main

# Step 10: Monitor deployment
# https://github.com/NetNeural/MonoRepo/actions
```

### If Current Production Data IS Critical:

```bash
# Create new Supabase project at:
# https://supabase.com/dashboard/new

# Then update .env.production with new credentials
# And continue with deployment steps above
```

## 📁 Files Ready for Deployment

### Configuration Files (Already Updated)
- ✅ `next.config.js` - GitHub Pages configuration
- ✅ `.env.production` - Production credentials
- ✅ `.github/workflows/deploy.yml` - GitHub Actions
- ✅ `supabase/config.toml` - Database version 17

### Migration Files (Ready to Apply)
- ✅ All 12 migration files in `supabase/migrations/`
- ✅ Includes initial schema, RLS policies, member management
- ✅ Performance indexes and triggers

### Edge Functions (Ready to Deploy)
- ✅ 9 edge functions in `supabase/functions/`
- ✅ alerts, create-super-admin, create-user, dashboard-stats
- ✅ devices, device-sync, integrations, members, organizations

### Deployment Scripts
- ✅ `deploy-production.sh` - Interactive deployment
- ✅ `production_reset.sql` - Database reset script

## 🎯 Next Immediate Action

**Please decide:**

1. **Is the current production data important?**
   - If NO → Run `production_reset.sql` in SQL Editor, then continue deployment
   - If YES → Create new Supabase project, update credentials

2. **Do you want to proceed with database reset?**
   - I can guide you through running the SQL script
   - Then we'll push migrations and deploy functions
   - Then deploy to GitHub Pages

3. **Or do you want to create a new project?**
   - I can help update all configuration files
   - Then fresh deployment to new project

**What would you like to do?**

---

## 📚 Reference

- **Backup Location:** `development/backups/production_backup_20251014_021430.sql`
- **Production Project:** https://supabase.com/dashboard/project/bldojxpockljyivldxwf
- **SQL Editor:** https://supabase.com/dashboard/project/bldojxpockljyivldxwf/sql/new
- **GitHub Secrets:** https://github.com/NetNeural/MonoRepo/settings/secrets/actions
- **GitHub Actions:** https://github.com/NetNeural/MonoRepo/actions

## ⚠️ Safety Notes

- ✅ Full backup created before any changes
- ✅ Can restore with: `psql -d database < backup.sql`
- ✅ Development branch is separate from main
- ✅ GitHub Actions only deploys on push to main
- ✅ Can test on development branch first

**Everything is ready - just need your decision on how to handle the schema conflict!**
