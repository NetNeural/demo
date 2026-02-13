# ✅ Staging Environment - Build Status

**Status:** 🟡 Partially Complete - Automated Setup Ready  
**Created:** February 13, 2026  
**Branch:** `staging`  
**Domain:** https://demo-stage.netneural.ai

---

## ✅ What's Been Built

### 1. Infrastructure Code (Complete) ✅

#### GitHub Actions Workflow
- [.github/workflows/deploy-staging.yml](.github/workflows/deploy-staging.yml)
  - Triggered on push to `staging` branch
  - Deploys to demo-stage.netneural.ai
  - Uses `STAGING_*` prefixed secrets
  - Includes health checks and verification

#### Environment Configuration
- [development/.env.staging](development/.env.staging)
  - Staging-specific environment variables
  - Feature flags (debug mode, test data enabled)
  - Placeholder references to GitHub secrets

#### DNS Configuration
- [development/public/CNAME.staging](development/public/CNAME.staging)
  - Points to demo-stage.netneural.ai
  - Will be deployed with the static site

### 2. Automation Scripts (Complete) ✅

All scripts are executable and ready to use:

| Script | Purpose | Status |
|--------|---------|--------|
| `setup-staging-environment.sh` | Master orchestrator | ✅ Ready |
| `setup-staging-secrets.sh` | Configure GitHub secrets | ✅ Ready |
| `setup-staging-database.sh` | Initialize Supabase staging DB | ✅ Ready |
| `seed-staging-data.sh` | Populate test data | ✅ Ready |
| `verify-staging-deployment.sh` | Health checks | ✅ Ready |
| `configure-staging-environment.sh` | Create config files | ✅ Ready |
| `create-staging-workflow.sh` | Generate workflow | ✅ Complete |

### 3. Documentation (Complete) ✅

- **[STAGING_ENVIRONMENT_PLAN.md](STAGING_ENVIRONMENT_PLAN.md)** (400+ lines)
  - Complete setup guide
  - Phase-by-phase instructions
  - Cost analysis
  - Security considerations
  - Troubleshooting guide
  - Maintenance procedures

- **[STAGING_QUICKSTART.md](STAGING_QUICKSTART.md)**
  - Quick reference guide
  - Common commands
  - Testing workflow
  - Monitoring procedures

### 4. Git Branch Structure (Complete) ✅

```
feature/* → staging → main
           ↓
    demo-stage.netneural.ai → demo.netneural.ai
```

- ✅ `staging` branch created
- ✅ 12 files committed
- ✅ 2,315 lines of code added

---

## 🔄 What's Still Required (Manual Steps)

### Step 1: Create Supabase Staging Project 🔴

**Action Required:** Manual setup in Supabase Dashboard

1. Visit https://supabase.com/dashboard
2. Click "New Project"
3. Settings:
   - Name: `netneural-iot-staging`
   - Region: Same as production (for consistency)
   - Database Password: Generate secure password
4. Wait for provisioning (~2 minutes)
5. **Copy these values:**
   - Project Reference ID (e.g., `abcd1234efgh5678`)
   - Project URL (e.g., `https://abcd1234efgh5678.supabase.co`)
   - Anon Key (JWT token starting with `eyJ...`)
   - Service Role Key (JWT token starting with `eyJ...`)
   - Database Password (your chosen password)

**Cost:** Free tier (500MB database, 2GB bandwidth) ✅

### Step 2: Configure DNS 🔴

**Action Required:** Add CNAME record in your DNS provider

1. Access your domain registrar (GoDaddy, Cloudflare, Route53, etc.)
2. Navigate to DNS Management for `netneural.ai`
3. Add new CNAME record:
   ```
   Name:  demo-stage.netneural.ai  (or just: demo-stage)
   Type:  CNAME
   Value: netneural.github.io
   TTL:   3600
   ```
4. Save changes
5. Wait for DNS propagation (5-60 minutes)
6. Verify: `nslookup demo-stage.netneural.ai`

**Alternative:** Configure after first deployment in GitHub Pages settings

### Step 3: Set Up GitHub Secrets 🔴

**Action Required:** Run setup script with Supabase credentials

Once you have Supabase project credentials from Step 1:

```bash
cd /workspaces/MonoRepo
./scripts/setup-staging-secrets.sh
```

This will create 7 GitHub secrets:
- `STAGING_SUPABASE_PROJECT_ID`
- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_ANON_KEY`
- `STAGING_SUPABASE_SERVICE_ROLE_KEY`
- `STAGING_SUPABASE_DB_PASSWORD`
- `STAGING_GOLIOTH_API_KEY`
- `STAGING_SUPABASE_ACCESS_TOKEN`

### Step 4: Create GitHub Environment 🟡 (Optional)

**Action:** Add protection rules for staging

1. Visit: https://github.com/NetNeural/MonoRepo/settings/environments
2. Click "New environment"
3. Name: `staging`
4. Optional protection rules:
   - Required reviewers
   - Wait timer
   - Deployment branches: `staging` only

---

## 🚀 Deployment Process (After Manual Steps)

### Initial Deployment

```bash
# 1. Ensure you're on staging branch
git checkout staging

# 2. Push to GitHub (triggers deployment)
git push origin staging

# 3. Monitor deployment
gh run watch

# 4. Verify deployment
./scripts/verify-staging-deployment.sh
```

Expected output:
- ✅ DNS resolves to demo-stage.netneural.ai
- ✅ SSL certificate valid
- ✅ Application loads successfully
- ✅ Database connection established
- ✅ Edge functions deployed

### Initialize Database

```bash
cd /workspaces/MonoRepo
./scripts/setup-staging-database.sh
```

This will:
- Link to staging Supabase project
- Push all database migrations
- Deploy edge functions
- Generate TypeScript types

### Seed Test Data (Optional)

```bash
./scripts/seed-staging-data.sh
```

Creates:
- 5 test organizations
- 20 test devices
- 100+ telemetry records
- Sample alerts and integrations

---

## 📊 Current Status Summary

| Component | Status | Action Required |
|-----------|--------|-----------------|
| **Workflow** | ✅ Ready | None - committed |
| **Configuration** | ✅ Ready | None - committed |
| **Scripts** | ✅ Ready | None - executable |
| **Documentation** | ✅ Complete | None |
| **Branch** | ✅ Created | Push to GitHub |
| **Supabase Project** | 🔴 Not Created | Create manually |
| **DNS** | 🔴 Not Configured | Add CNAME record |
| **GitHub Secrets** | 🔴 Not Set | Run setup script |
| **GitHub Environment** | 🟡 Optional | Configure if desired |

---

## 🎯 Next Steps (In Order)

### Immediate (Required for Deployment)

1. **Create Supabase Staging Project** (15 minutes)
   - Follow Step 1 above
   - Save credentials securely

2. **Configure DNS** (5 minutes + propagation time)
   - Follow Step 2 above
   - Can verify after deployment

3. **Set GitHub Secrets** (5 minutes)
   - Run `./scripts/setup-staging-secrets.sh`
   - Enter Supabase credentials from Step 1

4. **Push Staging Branch** (1 minute)
   ```bash
   git push origin staging
   ```

5. **Monitor First Deployment** (5-10 minutes)
   ```bash
   gh run watch
   ```

6. **Initialize Database** (5 minutes)
   ```bash
   ./scripts/setup-staging-database.sh
   ```

7. **Verify Everything Works** (2 minutes)
   ```bash
   ./scripts/verify-staging-deployment.sh
   ```

### Optional (Recommended)

8. **Seed Test Data**
   ```bash
   ./scripts/seed-staging-data.sh
   ```

9. **Create GitHub Environment**
   - Add protection rules
   - Require approvals

10. **Update Team**
    - Share staging URL
    - Document testing workflow

---

## 💰 Cost Breakdown

| Service | Plan | Cost |
|---------|------|------|
| Supabase | Free Tier | $0/month |
| GitHub Pages | Public Repo | $0/month |
| DNS | Subdomain | $0/month |
| **Total** | | **$0/month** ✅ |

Upgrade to Supabase Pro ($25/month) only if:
- Need > 500MB database
- Need > 2GB bandwidth/month
- Need advanced features

---

## 📚 Quick Reference

### Key Files

- **Workflow:** [.github/workflows/deploy-staging.yml](.github/workflows/deploy-staging.yml)
- **Environment:** [development/.env.staging](development/.env.staging)
- **Documentation:** [STAGING_ENVIRONMENT_PLAN.md](STAGING_ENVIRONMENT_PLAN.md)
- **Quick Start:** [STAGING_QUICKSTART.md](STAGING_QUICKSTART.md)

### Common Commands

```bash
# Deploy to staging
git checkout staging
git push origin staging

# Verify deployment
./scripts/verify-staging-deployment.sh

# Reset database
./scripts/setup-staging-database.sh

# Refresh test data
./scripts/seed-staging-data.sh

# Check deployment status
gh run list --workflow=deploy-staging.yml

# View logs
gh run view --log
```

### Test URLs

- **Staging:** https://demo-stage.netneural.ai
- **Production:** https://demo.netneural.ai
- **Supabase Studio:** https://supabase.com/dashboard/project/[STAGING_REF]

---

## 🎉 Summary

**Automated Infrastructure: 100% Complete** ✅
- 1 GitHub Actions workflow
- 2 configuration files  
- 7 automation scripts
- 2 comprehensive documentation files
- Staging branch with all files committed

**Manual Prerequisites: 0% Complete** 🔴
- Supabase project creation
- DNS configuration
- GitHub secrets setup

**Estimated Time to Production:**
- Manual steps: ~30 minutes
- First deployment: ~10 minutes
- Database setup: ~5 minutes
- **Total: ~45 minutes**

---

**Ready to complete the setup?** Follow the numbered steps in the "Next Steps" section above, or run:

```bash
./scripts/setup-staging-environment.sh
```

This interactive script will guide you through all remaining steps.

---

**Questions?** See:
- [STAGING_ENVIRONMENT_PLAN.md](STAGING_ENVIRONMENT_PLAN.md) - Detailed guide
- [STAGING_QUICKSTART.md](STAGING_QUICKSTART.md) - Quick reference
