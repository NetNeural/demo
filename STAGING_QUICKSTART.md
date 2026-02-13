# Staging Environment - Quick Start Guide

**Domain:** https://demo-stage.netneural.ai  
**Purpose:** Safe testing before production deployment  
**Status:** 📋 Planning Complete - Ready to Deploy

---

## 🚀 Quick Start

### One-Command Setup

```bash
cd /workspaces/MonoRepo
./scripts/setup-staging-environment.sh
```

This interactive script will guide you through all setup phases.

---

## 📋 Prerequisites

Before running setup, complete these manual steps:

### 1. Create Supabase Staging Project
```
Visit: https://supabase.com/dashboard
→ New Project: netneural-iot-staging
→ Copy: Project ID, URL, Anon Key, Service Key
```

### 2. Configure DNS
```
Add CNAME record:
  Name: demo-stage.netneural.ai
  Type: CNAME
  Value: netneural.github.io
  TTL: 3600
```

### 3. Create GitHub Environment
```
Visit: https://github.com/NetNeural/MonoRepo/settings/environments
→ New Environment: staging
→ Configure protection rules (optional)
```

---

## 🔧 Individual Setup Scripts

If you prefer manual control, run scripts individually:

### Step 1: Configure Secrets
```bash
./scripts/setup-staging-secrets.sh
```
Sets up GitHub secrets with `STAGING_` prefix.

### Step 2: Configure Code
```bash
./scripts/configure-staging-environment.sh
```
Creates `.env.staging`, CNAME, and configuration files.

### Step 3: Setup Database
```bash
./scripts/setup-staging-database.sh
```
Links to staging Supabase, pushes migrations, deploys edge functions.

### Step 4: Seed Test Data (Optional)
```bash
./scripts/seed-staging-data.sh
```
Populates staging with 5 organizations, 20 devices, and sample data.

### Step 5: Create Workflow
```bash
./scripts/create-staging-workflow.sh
```
Creates `.github/workflows/deploy-staging.yml` for automated deployments.

---

## 🌿 Branch Strategy

```
feature/* → staging → main

Workflow:
1. Create feature branch from staging
2. Develop locally
3. PR to staging
4. Test at demo-stage.netneural.ai
5. PR staging → main for production
```

### Create Staging Branch
```bash
git checkout -b staging
git push -u origin staging
```

---

## 🚀 Deployment

### Initial Deployment
```bash
# Push to staging branch to trigger deployment
git checkout staging
git merge main
git push origin staging

# Monitor deployment
gh run watch
```

### Verify Deployment
```bash
./scripts/verify-staging-deployment.sh
```

Checks:
- ✅ DNS resolution
- ✅ SSL certificate
- ✅ Page availability
- ✅ API health
- ✅ Database connectivity
- ✅ Edge functions

---

## 🧪 Testing Workflow

### Feature Development
```bash
# 1. Create feature branch
git checkout staging
git checkout -b feature/new-feature

# 2. Develop and test locally
npm run dev:full:debug

# 3. Push and create PR to staging
git push origin feature/new-feature
gh pr create --base staging

# 4. After merge, test on staging
open https://demo-stage.netneural.ai

# 5. If tests pass, promote to production
git checkout main
git merge staging
git push origin main
```

### Test User Accounts
```
Admin:
  Email: staging-admin@netneural.ai
  Password: StagingTest2026!

User:
  Email: staging-user@netneural.ai
  Password: StagingTest2026!
```

---

## 🔍 Monitoring

### Check Deployment Status
```bash
# List recent deployments
gh run list --workflow=deploy-staging.yml --limit 5

# View specific run
gh run view [RUN_ID] --log

# Watch current deployment
gh run watch
```

### Check Staging Health
```bash
# Full verification
./scripts/verify-staging-deployment.sh

# Quick check
curl -I https://demo-stage.netneural.ai
```

### Supabase Monitoring
```
Dashboard: https://supabase.com/dashboard/project/[STAGING_PROJECT_REF]
Logs: Edge Functions → Logs
Database: Database → Query Editor
```

---

## 🛠️ Maintenance

### Refresh Test Data
```bash
./scripts/seed-staging-data.sh
```

### Reset Staging Database
```bash
cd development
supabase db reset --linked
./scripts/seed-staging-data.sh
```

### Update Staging from Production
```bash
git checkout staging
git merge main
git push origin staging
```

---

## 💰 Cost

- **Supabase Free Tier:** $0/month (500MB, 2GB bandwidth)
- **GitHub Pages:** $0/month
- **Domain:** $0/month (uses existing netneural.ai)

**Total:** $0/month ✅

---

## 🚨 Troubleshooting

### Domain Not Resolving
```bash
# Check DNS
nslookup demo-stage.netneural.ai

# Wait for propagation (5-60 minutes)
# Flush local DNS
sudo systemd-resolve --flush-caches
```

### Deployment Failed
```bash
# Check workflow logs
gh run list --workflow=deploy-staging.yml
gh run view --log-failed

# Common fixes
cd development
npm ci
rm -rf .next out
npm run build
```

### Database Connection Issues
```bash
# Verify project link
cd development
supabase status

# Re-link to staging
supabase unlink
supabase link --project-ref [STAGING_PROJECT_REF]
```

---

## 📚 Documentation

- **Full Setup Plan:** [STAGING_ENVIRONMENT_PLAN.md](../STAGING_ENVIRONMENT_PLAN.md)
- **Workflow Guide:** [docs/STAGING_WORKFLOW.md](../docs/STAGING_WORKFLOW.md)
- **Production Deployment:** [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)

---

## ✅ Setup Checklist

- [ ] Supabase staging project created
- [ ] DNS configured (demo-stage.netneural.ai)
- [ ] GitHub environment created
- [ ] GitHub secrets configured
- [ ] Code files configured
- [ ] Database initialized
- [ ] Test data seeded
- [ ] Workflow created
- [ ] Staging branch created
- [ ] Initial deployment successful
- [ ] Verification checks passed

---

**Ready to Start?**
```bash
./scripts/setup-staging-environment.sh
```

**Questions?** See [STAGING_ENVIRONMENT_PLAN.md](../STAGING_ENVIRONMENT_PLAN.md) for detailed documentation.
