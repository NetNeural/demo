# Production Supabase Refactor & GitHub Pages Deployment Guide

## Project Information

**Production Supabase Project**: `bldojxpockljyivldxwf`  
**Dashboard URL**: https://supabase.com/dashboard/project/bldojxpockljyivldxwf  
**Target Deployment**: GitHub Pages (NetNeural/MonoRepo)

---

## ⚠️ IMPORTANT: Pre-Deployment Checklist

Before running ANY commands:

- [ ] **BACKUP CURRENT PRODUCTION DATABASE**
- [ ] Review existing data and users
- [ ] Document current schema version
- [ ] Test in staging/local first
- [ ] Have rollback plan ready

---

## Step 1: Backup Existing Production Data

### 1.1 Access Production Supabase

```bash
# Install Supabase CLI if not already installed
npm install -g supabase@latest

# Login to Supabase
supabase login
```

### 1.2 Create Database Backup

```bash
cd c:/Development/NetNeural/SoftwareMono/development

# Link to production project
supabase link --project-ref bldojxpockljyivldxwf

# Create backup
supabase db dump --data-only -f backups/production_data_$(date +%Y%m%d_%H%M%S).sql

# Also backup schema
supabase db dump --schema-only -f backups/production_schema_$(date +%Y%m%d_%H%M%S).sql

# Full backup (recommended)
supabase db dump -f backups/production_full_$(date +%Y%m%d_%H%M%S).sql
```

### 1.3 Document Current State

```bash
# List all tables
supabase db dump --data-only --list-tables

# Check current users
psql "postgresql://postgres.[PROJECT-REF]@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \
  -c "SELECT email, role FROM auth.users;"

# Check organizations
psql "postgresql://postgres.[PROJECT-REF]@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \
  -c "SELECT * FROM organizations;"
```

---

## Step 2: Prepare Local Environment

### 2.1 Update Supabase Config

```bash
cd c:/Development/NetNeural/SoftwareMono/development

# Make sure linked to production
supabase link --project-ref bldojxpockljyivldxwf
```

### 2.2 Get Production Credentials

From Supabase Dashboard: https://supabase.com/dashboard/project/bldojxpockljyivldxwf/settings/api

1. **API URL**: `https://bldojxpockljyivldxwf.supabase.co`
2. **Anon/Public Key**: Copy from dashboard
3. **Service Role Key**: Copy from dashboard (keep secret!)

### 2.3 Update .env.production

Create `development/.env.production`:

```bash
# Production Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://bldojxpockljyivldxwf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc... # Get from dashboard
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... # Get from dashboard

# Application Configuration
NEXT_PUBLIC_APP_URL=https://netneural.github.io/MonoRepo
NEXT_PUBLIC_APP_NAME=NetNeural IoT Platform
NODE_ENV=production

# GitHub Pages specific
NEXT_PUBLIC_BASE_PATH=/MonoRepo
```

---

## Step 3: Review and Test Migrations

### 3.1 Check Migration Status

```bash
# See what's currently in production
supabase db pull

# Compare with local migrations
supabase db diff
```

### 3.2 Review Our New Migrations

Our migrations in `supabase/migrations/`:

1. `20241201000001_init_schema.sql` - Initial schema
2. `20241201000002_rls_policies.sql` - RLS policies
3. `20241201000003_organization_members.sql` - Organization members table
4. `20241201000004_fix_rls_recursion.sql` - RLS fixes
5. `20241201000005_fix_default_org_access.sql` - Default org access
6. `20241201000006_fix_membership_creation.sql` - Membership fixes
7. `20241201000007_temp_debug_policy.sql` - Debug policy (optional)
8. `20241201000008_restore_proper_rls.sql` - Proper RLS
9. `20241201000011_remove_recursive_policies.sql` - Remove recursive policies
10. `20241215_device_integrations.sql` - Device integrations
11. `20250113000001_performance_indexes.sql` - Performance indexes
12. `20250113000002_timestamp_triggers.sql` - Timestamp triggers

### 3.3 Test Migration Plan

**OPTION A: Fresh Start (Recommended if production is empty/test data)**

```bash
# ⚠️ WARNING: This will DROP ALL TABLES and recreate
supabase db reset --linked
```

**OPTION B: Incremental Migration (If production has important data)**

```bash
# Push only new migrations
supabase db push --linked

# Or manually apply specific migrations
psql "postgresql://..." -f supabase/migrations/20241201000001_init_schema.sql
```

---

## Step 4: Deploy Edge Functions

### 4.1 Deploy All Functions

```bash
cd c:/Development/NetNeural/SoftwareMono/development

# Deploy all edge functions to production
supabase functions deploy alerts --project-ref bldojxpockljyivldxwf
supabase functions deploy create-super-admin --project-ref bldojxpockljyivldxwf
supabase functions deploy create-user --project-ref bldojxpockljyivldxwf
supabase functions deploy dashboard-stats --project-ref bldojxpockljyivldxwf
supabase functions deploy devices --project-ref bldojxpockljyivldxwf
supabase functions deploy device-sync --project-ref bldojxpockljyivldxwf
supabase functions deploy integrations --project-ref bldojxpockljyivldxwf
supabase functions deploy members --project-ref bldojxpockljyivldxwf
supabase functions deploy organizations --project-ref bldojxpockljyivldxwf

# Or deploy all at once
supabase functions deploy --project-ref bldojxpockljyivldxwf
```

### 4.2 Configure Function Secrets

```bash
# Set environment variables for edge functions
supabase secrets set SUPABASE_URL=https://bldojxpockljyivldxwf.supabase.co --project-ref bldojxpockljyivldxwf
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key --project-ref bldojxpockljyivldxwf
supabase secrets set SUPABASE_ANON_KEY=your-anon-key --project-ref bldojxpockljyivldxwf

# Verify
supabase secrets list --project-ref bldojxpockljyivldxwf
```

### 4.3 Test Edge Functions

```bash
# Test create-super-admin
curl -X POST https://bldojxpockljyivldxwf.supabase.co/functions/v1/create-super-admin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{
    "email": "admin@netneural.ai",
    "password": "SuperSecure123!",
    "fullName": "Super Admin"
  }'

# Test dashboard-stats
curl https://bldojxpockljyivldxwf.supabase.co/functions/v1/dashboard-stats \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

## Step 5: Run Seed Data (If Needed)

### 5.1 Review Seed Data

Check `supabase/seed.sql` for:
- Test users
- Default organizations
- Sample devices
- Initial configurations

### 5.2 Apply Seed Data

```bash
# Connect to production
psql "postgresql://postgres:[PASSWORD]@db.bldojxpockljyivldxwf.supabase.co:5432/postgres" \
  -f supabase/seed.sql
```

**OR** Apply selectively:

```sql
-- Only create super admin
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, ...)
VALUES (...);

-- Only create default organization
INSERT INTO organizations (name, slug, ...)
VALUES ('NetNeural', 'netneural', ...);
```

---

## Step 6: Configure GitHub Pages Deployment

### 6.1 Update Next.js Config for Static Export

Edit `development/next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static export for GitHub Pages
  output: 'export',
  
  // Base path for GitHub Pages (repo name)
  basePath: '/MonoRepo',
  
  // Asset prefix for GitHub Pages
  assetPrefix: '/MonoRepo/',
  
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
  
  // Trailing slash for better static hosting
  trailingSlash: true,
  
  // Environment variables
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
}

module.exports = nextConfig
```

### 6.2 Update Package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "build:github": "NEXT_PUBLIC_SUPABASE_URL=https://bldojxpockljyivldxwf.supabase.co next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  }
}
```

### 6.3 Configure GitHub Repository Settings

1. Go to: https://github.com/NetNeural/MonoRepo/settings/pages
2. **Source**: Deploy from a branch
3. **Branch**: `main` (or `development` for testing)
4. **Folder**: `/ (root)`

---

## Step 7: Configure GitHub Actions for Deployment

### 7.1 Update GitHub Actions Workflow

File: `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
    paths: ['development/**']
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: 📥 Checkout
        uses: actions/checkout@v4

      - name: 🔧 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: './development/package-lock.json'

      - name: 📦 Install dependencies
        working-directory: ./development
        run: npm ci

      - name: 🔍 Type check
        working-directory: ./development
        run: npm run type-check

      - name: ✅ Lint
        working-directory: ./development
        run: npm run lint

      - name: 🏗️ Build for GitHub Pages
        working-directory: ./development
        env:
          NODE_ENV: production
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_APP_URL: https://netneural.github.io/MonoRepo
          NEXT_PUBLIC_BASE_PATH: /MonoRepo
        run: npm run build

      - name: 📄 Setup Pages
        uses: actions/configure-pages@v4

      - name: 📤 Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './development/out'

      - name: 🚀 Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4

      - name: ✅ Success
        if: success()
        run: |
          echo "🎉 Deployed successfully!"
          echo "🌐 URL: https://netneural.github.io/MonoRepo/"
```

---

## Step 8: Configure GitHub Secrets

Add these secrets in: https://github.com/NetNeural/MonoRepo/settings/secrets/actions

### Required Secrets:

```bash
# From Supabase Dashboard (bldojxpockljyivldxwf)
NEXT_PUBLIC_SUPABASE_URL=https://bldojxpockljyivldxwf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc... # From dashboard API settings
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... # From dashboard API settings (keep secret!)

# For Supabase CLI in Actions (if deploying functions via CI)
SUPABASE_ACCESS_TOKEN=sbp_... # From https://supabase.com/dashboard/account/tokens
```

---

## Step 9: Test Local Build

Before pushing to GitHub, test the build locally:

```bash
cd c:/Development/NetNeural/SoftwareMono/development

# Set production environment variables
export NEXT_PUBLIC_SUPABASE_URL=https://bldojxpockljyivldxwf.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Build for production
npm run build

# Check output
ls -la out/

# Test locally with a simple server
npx serve out -p 3001
```

Open http://localhost:3001/MonoRepo/ to test.

---

## Step 10: Deploy to Production

### 10.1 Commit and Push

```bash
cd c:/Development/NetNeural/SoftwareMono

# Check status
git status

# Add changes
git add .

# Commit
git commit -m "feat: Configure production deployment to GitHub Pages

- Link to production Supabase (bldojxpockljyivldxwf)
- Configure Next.js for static export
- Update GitHub Actions for Pages deployment
- Add production environment configuration
- Update base path for GitHub Pages hosting"

# Push to development branch first (for testing)
git push origin development
```

### 10.2 Test on Development Branch

1. Update GitHub Pages to use `development` branch temporarily
2. Wait for Actions to complete
3. Visit: https://netneural.github.io/MonoRepo/
4. Test all features

### 10.3 Merge to Main (When Ready)

```bash
# Switch to main
git checkout main

# Merge development
git merge development --no-ff -m "Release v1.1.0: Production deployment with member management"

# Tag the release
git tag -a v1.1.0 -m "Production release: Member management system"

# Push everything
git push origin main --tags
```

---

## Step 11: Post-Deployment Verification

### 11.1 Check Deployment

1. **GitHub Actions**: https://github.com/NetNeural/MonoRepo/actions
2. **Live Site**: https://netneural.github.io/MonoRepo/
3. **Supabase Logs**: https://supabase.com/dashboard/project/bldojxpockljyivldxwf/logs

### 11.2 Test Functionality

```bash
# Test authentication
# - Go to /auth/login
# - Try logging in with super admin

# Test API endpoints
curl https://netneural.github.io/MonoRepo/api/health

# Test Supabase connection
# - Open browser console
# - Check for Supabase initialization
# - Test a query
```

### 11.3 Monitor for Issues

```bash
# Check Supabase logs
supabase logs --project-ref bldojxpockljyivldxwf

# Check edge function logs
supabase functions logs members --project-ref bldojxpockljyivldxwf

# Check database performance
# Go to: https://supabase.com/dashboard/project/bldojxpockljyivldxwf/reports
```

---

## Rollback Procedure

If something goes wrong:

### Rollback Database

```bash
# Restore from backup
psql "postgresql://..." -f backups/production_full_YYYYMMDD_HHMMSS.sql
```

### Rollback Deployment

```bash
# Revert to previous commit
git revert HEAD

# Or reset to previous version
git reset --hard HEAD~1
git push origin main --force

# Or revert to specific tag
git checkout v1.0.0
```

### Rollback Edge Functions

```bash
# Re-deploy previous version
git checkout v1.0.0
supabase functions deploy --project-ref bldojxpockljyivldxwf
```

---

## Troubleshooting

### Issue: Build Fails

```bash
# Check logs
cat development/.next/trace

# Clean and rebuild
rm -rf development/.next
rm -rf development/out
npm run build
```

### Issue: 404 on GitHub Pages

- Check `basePath` in next.config.js
- Ensure trailing slashes in routes
- Check .nojekyll file exists in output

### Issue: Supabase Connection Fails

- Verify environment variables
- Check CORS settings in Supabase
- Verify API keys are correct

### Issue: Edge Functions Not Working

```bash
# Check function logs
supabase functions logs <function-name> --project-ref bldojxpockljyivldxwf

# Test function directly
curl https://bldojxpockljyivldxwf.supabase.co/functions/v1/<function-name>
```

---

## Production URLs

- **App**: https://netneural.github.io/MonoRepo/
- **Supabase Dashboard**: https://supabase.com/dashboard/project/bldojxpockljyivldxwf
- **API**: https://bldojxpockljyivldxwf.supabase.co
- **Functions**: https://bldojxpockljyivldxwf.supabase.co/functions/v1/

---

## Next Steps After Deployment

1. [ ] Set up monitoring and alerts
2. [ ] Configure custom domain (if needed)
3. [ ] Set up staging environment
4. [ ] Configure backup schedule
5. [ ] Set up error tracking (Sentry)
6. [ ] Performance monitoring
7. [ ] Security audit
8. [ ] Load testing

---

**Ready to deploy!** Follow steps 1-11 in order, testing at each stage.
