# Staging Environment Setup Plan
**Target Domain:** demo-stage.netneural.ai  
**Purpose:** Safe testing environment for changes before production deployment  
**Date Created:** February 13, 2026

---

## 🎯 Overview

Create a complete staging environment that mirrors production but uses isolated resources:

| Component | Production | Staging |
|-----------|-----------|---------|
| **Domain** | demo.netneural.ai | demo-stage.netneural.ai |
| **Deployment** | GitHub Pages (main branch) | GitHub Pages (staging branch) |
| **Supabase** | bldojxpockljyivldxwf | [New Project] |
| **Data** | Production data | Test/synthetic data |
| **GitHub Env** | `production` | `staging` |

---

## 📋 Implementation Checklist

### Phase 1: Infrastructure Setup (Manual Steps)

#### 1.1 Create Staging Supabase Project
- [ ] Log into [Supabase Dashboard](https://supabase.com/dashboard)
- [ ] Create new project: `netneural-iot-staging`
- [ ] Select region: Same as production (for consistency)
- [ ] Choose database password (store securely)
- [ ] Wait for provisioning (~2 minutes)
- [ ] Note project reference ID (format: `abcdefghijklmnopqrst`)
- [ ] Copy the following credentials:
  - Project URL: `https://[PROJECT-REF].supabase.co`
  - Anon (public) key: `eyJ...` (long JWT token)
  - Service role key: `eyJ...` (long JWT token)
  - Database password: Your chosen password

**Cost Estimate:** Free tier supports staging (500MB database, 2GB bandwidth)

#### 1.2 Configure DNS for Staging Domain
- [ ] Access your domain registrar (e.g., GoDaddy, Cloudflare, Route53)
- [ ] Add CNAME record:
  - **Name:** `demo-stage.netneural.ai`
  - **Type:** CNAME
  - **Value:** `netneural.github.io`
  - **TTL:** 3600 (1 hour)
- [ ] Wait for DNS propagation (5-60 minutes)
- [ ] Verify: `dig demo-stage.netneural.ai` or `nslookup demo-stage.netneural.ai`

**Alternative (GitHub Pages Custom Domain):**
- After initial deployment, configure in GitHub Pages settings
- Repository Settings → Pages → Custom domain → `demo-stage.netneural.ai`
- Enable HTTPS (automatic via Let's Encrypt)

#### 1.3 Create GitHub Environment
- [ ] Go to: `https://github.com/NetNeural/MonoRepo/settings/environments`
- [ ] Click "New environment"
- [ ] Name: `staging`
- [ ] Add deployment protection rules (optional):
  - Required reviewers: Select team members
  - Wait timer: 0 minutes
  - Deployment branches: `staging` branch only
- [ ] Click "Configure environment"

---

### Phase 2: Secrets Configuration (Automated)

Run the setup script to configure GitHub secrets:

```bash
cd /workspaces/MonoRepo
./scripts/setup-staging-secrets.sh
```

**The script will prompt you for:**
1. Staging Supabase Project Reference ID
2. Staging Supabase URL
3. Staging Supabase Anon Key
4. Staging Supabase Service Role Key
5. Staging Supabase DB Password
6. Golioth API Key (shared or separate staging key)

**Secrets Created (with `STAGING_` prefix):**
- `STAGING_SUPABASE_PROJECT_ID`
- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_ANON_KEY`
- `STAGING_SUPABASE_SERVICE_ROLE_KEY`
- `STAGING_SUPABASE_DB_PASSWORD`
- `STAGING_GOLIOTH_API_KEY`
- `STAGING_SUPABASE_ACCESS_TOKEN`

---

### Phase 3: Code Configuration (Automated)

Run the configuration script:

```bash
cd /workspaces/MonoRepo
./scripts/configure-staging-environment.sh
```

**This script will:**
1. ✅ Create `development/.env.staging` file with placeholders
2. ✅ Update `.github/workflows/deploy.yml` to support staging
3. ✅ Create `development/public/CNAME-staging` file
4. ✅ Update `next.config.ts` for staging baseUrl support
5. ✅ Create staging-specific build scripts in `package.json`

---

### Phase 4: Database Setup (Automated)

Initialize staging database with same schema as production:

```bash
cd /workspaces/MonoRepo
./scripts/setup-staging-database.sh
```

**This script will:**
1. ✅ Link to staging Supabase project
2. ✅ Push all migrations from `development/supabase/migrations/`
3. ✅ Deploy edge functions
4. ✅ Generate TypeScript types
5. ✅ Seed with test data (optional)

---

### Phase 5: GitHub Actions Workflow (Automated)

Create dedicated staging deployment workflow:

```bash
cd /workspaces/MonoRepo
./scripts/create-staging-workflow.sh
```

**Creates:** `.github/workflows/deploy-staging.yml`

**Workflow Triggers:**
- Push to `staging` branch
- Manual dispatch (workflow_dispatch)
- PR preview (optional)

---

### Phase 6: Branch Strategy Setup (Manual)

#### 6.1 Create Staging Branch
```bash
cd /workspaces/MonoRepo
git checkout -b staging
git push -u origin staging
```

#### 6.2 Set Branch Protection Rules
- [ ] Go to: Repository → Settings → Branches
- [ ] Add rule for `staging` branch:
  - ✅ Require pull request reviews (1 approval)
  - ✅ Require status checks to pass
  - ✅ Require branches to be up to date
  - ✅ Include administrators

#### 6.3 Update Git Workflow
```
Development Flow:
  feature/* → staging → main

1. Develop in feature branches
2. PR to staging for testing
3. Test at demo-stage.netneural.ai
4. PR staging → main for production
```

---

### Phase 7: Test Data Seeding (Optional)

Populate staging with realistic test data:

```bash
cd /workspaces/MonoRepo
./scripts/seed-staging-data.sh
```

**Creates:**
- 5 test organizations
- 20 test devices across organizations
- 100 sample telemetry records
- 3 test user accounts
- Sample alerts and integration configurations

**Test Credentials:**
- Email: `staging-admin@netneural.ai`
- Password: `StagingTest2026!`

---

## 🚀 Deployment Process

### Initial Deployment
```bash
# 1. Ensure staging branch exists
git checkout staging
git pull origin staging

# 2. Trigger deployment
git push origin staging

# 3. Monitor deployment
gh run watch

# 4. Verify deployment
curl -I https://demo-stage.netneural.ai
```

### Workflow: Feature Testing
```bash
# 1. Create feature branch from staging
git checkout staging
git pull
git checkout -b feature/new-dashboard-widget

# 2. Develop and test locally
npm run dev:full:debug

# 3. Commit and push
git add .
git commit -m "feat: add new dashboard widget"
git push origin feature/new-dashboard-widget

# 4. Create PR to staging
gh pr create --base staging --title "Add new dashboard widget" --body "Testing new widget"

# 5. After PR approval, merge to staging
gh pr merge --merge

# 6. Test on staging environment
open https://demo-stage.netneural.ai

# 7. If tests pass, promote to production
git checkout main
git merge staging
git push origin main
```

---

## 🔍 Verification Steps

After deployment completes, verify:

### 1. Domain Resolution
```bash
# Check DNS
nslookup demo-stage.netneural.ai

# Test HTTPS
curl -I https://demo-stage.netneural.ai
```

### 2. Application Health
```bash
# Run comprehensive checks
cd /workspaces/MonoRepo
./scripts/verify-staging-deployment.sh
```

**Checks:**
- ✅ Homepage loads (200 status)
- ✅ Dashboard accessible
- ✅ Supabase connection works
- ✅ Authentication flow functional
- ✅ API routes responding
- ✅ Edge functions deployed
- ✅ Database migrations applied

### 3. Supabase Health
```bash
# Check Supabase status
npx supabase status --project-ref [STAGING_PROJECT_REF]

# Test database connection
psql "postgresql://postgres:[PASSWORD]@db.[STAGING_PROJECT_REF].supabase.co:5432/postgres"
```

### 4. Manual Testing Checklist
- [ ] Navigate to https://demo-stage.netneural.ai
- [ ] Sign up with test email
- [ ] Verify email confirmation
- [ ] Log in successfully
- [ ] Create test organization
- [ ] Add test device
- [ ] View dashboard analytics
- [ ] Test device integrations
- [ ] Check Golioth sync
- [ ] Test alerts and notifications

---

## 📊 Monitoring & Maintenance

### Monitoring Setup

**Sentry (Optional):**
```bash
# Add staging environment to Sentry
SENTRY_ENV=staging
SENTRY_DSN=[Your Staging DSN]
```

**Supabase Monitoring:**
- Dashboard: https://supabase.com/dashboard/project/[STAGING_REF]
- Database: Monitor query performance
- Auth: Track sign-up/login rates
- Edge Functions: Review logs and errors

### Regular Maintenance

**Weekly:**
- [ ] Review staging logs for errors
- [ ] Check disk usage and database size
- [ ] Verify Supabase backup status

**Monthly:**
- [ ] Refresh test data
- [ ] Update staging to match production schema
- [ ] Review and rotate staging secrets

**As Needed:**
- [ ] Reset staging database: `./scripts/reset-staging-database.sh`
- [ ] Sync production data (anonymized): `./scripts/sync-prod-to-staging.sh`
- [ ] Clear old test data: `./scripts/cleanup-staging-data.sh`

---

## 💰 Cost Analysis

### Supabase Staging Project
**Free Tier:**
- 500 MB database space
- 2 GB bandwidth/month
- 50,000 monthly active users
- **Cost:** $0/month ✅

**Pro Tier (if needed):**
- 8 GB database space
- 250 GB bandwidth
- 100,000 monthly active users
- **Cost:** $25/month

**Recommendation:** Start with free tier, upgrade if testing requires more resources.

### GitHub Pages
- **Cost:** $0/month (included with public repositories)
- Unlimited bandwidth for public repos

### Domain
- demo-stage.netneural.ai subdomain
- **Cost:** $0/month (uses existing netneural.ai domain)

**Total Estimated Cost:** $0-25/month

---

## 🔒 Security Considerations

### Staging-Specific Security

1. **Authentication:**
   - Use separate auth credentials
   - Disable production OAuth providers
   - Use test API keys for integrations

2. **Data Privacy:**
   - Never sync real user data to staging
   - Use synthetic/anonymized test data only
   - Implement data retention policies (auto-delete after 30 days)

3. **Access Control:**
   - Restrict staging access to team members
   - Use GitHub environment protection rules
   - Require PR approvals before staging deployment

4. **Secrets Management:**
   - Never share production secrets with staging
   - Use separate API keys for third-party services
   - Rotate staging secrets quarterly

---

## 🚨 Troubleshooting

### Common Issues

#### Domain Not Resolving
```bash
# Check DNS propagation
dig demo-stage.netneural.ai +trace

# Flush local DNS cache
sudo systemd-resolve --flush-caches  # Linux
dscacheutil -flushcache              # macOS

# Verify CNAME in GitHub Pages settings
```

#### Build Failures
```bash
# Check workflow logs
gh run list --workflow=deploy-staging.yml
gh run view [RUN_ID] --log-failed

# Common fixes
npm ci --legacy-peer-deps
rm -rf .next out
npm run build
```

#### Supabase Connection Issues
```bash
# Verify project status
npx supabase status --project-ref [STAGING_REF]

# Check credentials
echo $NEXT_PUBLIC_SUPABASE_URL
echo ${NEXT_PUBLIC_SUPABASE_ANON_KEY:0:20}...

# Test direct connection
curl https://[STAGING_REF].supabase.co/rest/v1/ \
  -H "apikey: [ANON_KEY]"
```

#### Edge Functions Not Deploying
```bash
# Manually deploy functions
cd development
npx supabase functions deploy --project-ref [STAGING_REF]

# Check function logs
npx supabase functions logs [FUNCTION_NAME] --project-ref [STAGING_REF]
```

---

## 📚 Related Documentation

- **Deployment Guide:** [DEPLOYMENT_GUIDE.md](/DEPLOYMENT_GUIDE.md)
- **Secrets Management:** [development/docs/SECRETS_GOVERNANCE.md](/development/docs/SECRETS_GOVERNANCE.md)
- **CI/CD Documentation:** [.github/workflows/README.md](/.github/workflows/README.md)
- **Supabase Docs:** https://supabase.com/docs
- **GitHub Pages:** https://docs.github.com/pages

---

## ✅ Completion Criteria

Staging environment is ready when:

- [x] Domain resolves: https://demo-stage.netneural.ai
- [x] Application loads successfully
- [x] Authentication works end-to-end
- [x] Database queries execute correctly
- [x] Edge functions are deployed and responding
- [x] Test data is seeded
- [x] Monitoring is configured
- [x] Team has access credentials
- [x] Documentation is updated

---

## 🎯 Next Steps After Setup

1. **Update Team Documentation:**
   - Share staging credentials with team
   - Document testing workflows
   - Create staging test scenarios

2. **Configure CI/CD:**
   - Add staging checks to PR workflow
   - Set up automated testing on staging
   - Configure deployment notifications

3. **Establish Testing Protocol:**
   - Define staging test requirements
   - Create test data refresh schedule
   - Document promotion criteria (staging → production)

4. **Monitor Usage:**
   - Track staging Supabase usage
   - Review deployment frequency
   - Optimize based on team feedback

---

**Status:** 📝 Planning Phase  
**Estimated Setup Time:** 2-3 hours  
**Maintenance Time:** 1-2 hours/month

**Start Setup:** Run `./scripts/setup-staging-environment.sh` to begin automated setup.
