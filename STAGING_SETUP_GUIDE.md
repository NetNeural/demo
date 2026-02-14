# Staging Environment Setup - Quick Guide

**Date:** February 14, 2026  
**Target:** demo-stage.netneural.ai (MonoRepo-Staging repository)

---

## ⚠️ Important Notes

1. **You do NOT need local Supabase running** for staging setup
2. **You DO need a remote staging Supabase project** created first
3. **You need GitHub secrets configured** before deployment

---

## 🚀 Step-by-Step Setup

### Step 1: Create Remote Staging Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Settings:
   - **Name:** `netneural-iot-staging`
   - **Database Password:** Generate strong password (save it!)
   - **Region:** Same as production (for consistency)
4. Wait 2 minutes for provisioning
5. **Save these values:**
   ```
   Project Reference ID: [shown in URL]
   Project URL: https://[ref].supabase.co
   Anon Key: eyJ... (from Settings > API)
   Service Role Key: eyJ... (from Settings > API)
   Database Password: [your password]
   ```

### Step 2: Get Supabase Access Token

1. Go to https://supabase.com/dashboard/account/tokens
2. Click "Generate new token"
3. Name: "Staging Deployment"
4. **Copy and save:** `sbp_...` token

### Step 3: Configure GitHub Secrets

**For MonoRepo-Staging repository:**

```bash
# Check current secrets
gh secret list --repo NetNeural/MonoRepo-Staging

# Set staging secrets (replace with your values)
gh secret set STAGING_SUPABASE_PROJECT_ID --body "YOUR_PROJECT_REF" --repo NetNeural/MonoRepo-Staging
gh secret set STAGING_SUPABASE_URL --body "https://YOUR_REF.supabase.co" --repo NetNeural/MonoRepo-Staging
gh secret set STAGING_SUPABASE_ANON_KEY --body "YOUR_ANON_KEY" --repo NetNeural/MonoRepo-Staging
gh secret set STAGING_SUPABASE_SERVICE_ROLE_KEY --body "YOUR_SERVICE_ROLE_KEY" --repo NetNeural/MonoRepo-Staging
gh secret set STAGING_SUPABASE_DB_PASSWORD --body "YOUR_DB_PASSWORD" --repo NetNeural/MonoRepo-Staging
gh secret set STAGING_SUPABASE_ACCESS_TOKEN --body "sbp_YOUR_TOKEN" --repo NetNeural/MonoRepo-Staging

# Optional: separate Golioth key for staging
gh secret set STAGING_GOLIOTH_API_KEY --body "YOUR_GOLIOTH_KEY" --repo NetNeural/MonoRepo-Staging
```

### Step 4: Initialize Staging Database (Manual Method)

Since the automated script expects local Supabase, use the manual method:

```bash
cd /workspaces/MonoRepo/development

# Install/verify Supabase CLI
npm install -g supabase

# Login to Supabase (one-time)
npx supabase login

# Link to your staging project
npx supabase link --project-ref YOUR_STAGING_PROJECT_REF

# Push all migrations
npx supabase db push

# Deploy edge functions (ignore decorator warnings)
npx supabase functions deploy --no-verify-jwt

# Generate TypeScript types
npx supabase gen types typescript --linked > src/lib/database.types.ts
```

**Expected Output:**
```
✅ Linked to project ref YOUR_STAGING_PROJECT_REF
✅ Migrations applied successfully
✅ Edge functions deployed
✅ TypeScript types generated
```

### Step 5: Seed Test Data (Optional)

You can seed test data via Supabase Studio:

1. Go to https://supabase.com/dashboard/project/[YOUR_REF]
2. Click "SQL Editor"
3. Run seed queries from `development/supabase/seed.sql`

Or use the automated script:
```bash
cd /workspaces/MonoRepo
./scripts/seed-staging-data.sh
```

### Step 6: Trigger Deployment

The MonoRepo-Staging repository auto-deploys on push to `main`:

```bash
# Check current branch
git branch

# Push to trigger deployment (if on main branch)
git push origin main

# Or manually trigger via GitHub Actions
gh workflow run deploy-staging.yml --repo NetNeural/MonoRepo-Staging
```

### Step 7: Verify Deployment

```bash
# Check deployment status
gh run list --repo NetNeural/MonoRepo-Staging --workflow=deploy-staging.yml

# Watch live deployment
gh run watch --repo NetNeural/MonoRepo-Staging

# Test the site
curl -I https://demo-stage.netneural.ai
```

Expected: HTTP 200 OK

---

## 🐛 Troubleshooting

### "No such container: supabase_db_netneural-iot-platform"

**Cause:** Script expects local Supabase but you're setting up remote staging.  
**Solution:** Use manual method above (Step 4) - no local Supabase needed.

### "Unsupported compiler options in deno.json"

**Cause:** Deno deprecated some compiler options.  
**Solution:** Already fixed in latest commit - warnings are harmless, functions still deploy.

### "Failed to link to staging project"

**Causes:**
- Not logged in: Run `npx supabase login`
- Wrong project ref: Check Supabase dashboard URL
- No access token: Set `SUPABASE_ACCESS_TOKEN` environment variable

### "Missing authorization header" in deployed functions

**Cause:** Edge functions not receiving auth header from frontend.  
**Solution:** Check CORS settings and ensure frontend sends `Authorization: Bearer <token>`

### Pages return 404 after deployment

**Causes:**
- CNAME not configured: Check `public/CNAME` has `demo-stage.netneural.ai`
- DNS not set: Add CNAME in your DNS provider pointing to `netneural.github.io`
- Still propagating: Wait 5-60 minutes for DNS propagation

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Staging Supabase project created and accessible
- [ ] All 7 GitHub secrets configured in MonoRepo-Staging
- [ ] Database migrations applied (check Supabase Studio → Database)
- [ ] Edge functions deployed (check Supabase Studio → Edge Functions)
- [ ] TypeScript types generated (`src/lib/database.types.ts` exists)
- [ ] GitHub Pages deployment successful
- [ ] Site accessible at https://demo-stage.netneural.ai
- [ ] Can log in with test credentials
- [ ] All pages load without errors

---

## 📚 Related Documentation

- **Full Plan:** [STAGING_ENVIRONMENT_PLAN.md](STAGING_ENVIRONMENT_PLAN.md)
- **Feature Comparison:** [PROD_VS_STAGING_FEATURE_COMPARISON.md](PROD_VS_STAGING_FEATURE_COMPARISON.md)
- **Quick Start:** [STAGING_QUICKSTART.md](STAGING_QUICKSTART.md)
- **Secrets Management:** [development/docs/SECRETS_INVENTORY.md](development/docs/SECRETS_INVENTORY.md)

---

## 🔑 Key Differences: Production vs Staging

| Aspect | Production | Staging |
|--------|-----------|---------|
| **Repository** | NetNeural/MonoRepo | NetNeural/MonoRepo-Staging |
| **Branch** | `main` | `main` |
| **Domain** | demo.netneural.ai | demo-stage.netneural.ai |
| **Supabase** | `bldojxpockljyivldxwf` | Your staging project |
| **Secrets** | `SUPABASE_*` | `STAGING_SUPABASE_*` |
| **Data** | Real production data | Test/synthetic data |
| **Debug** | Disabled | Enabled |

---

**Need Help?** Open an issue in the MonoRepo-Staging repository.
