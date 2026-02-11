# Development & Deployment Workflow Guide

**Last Updated:** February 11, 2026  
**Environment:** Codespaces / Local Development  
**Project:** NetNeural IoT Platform (Next.js 15 + Supabase)

---

## 🚀 Quick Start Workflow

```bash
# 1. Make your changes in the codespace
# 2. Test locally
npm run test                    # Run unit tests
npm run test:coverage          # With coverage report
npm run lint                   # Check code style
npm run type-check             # TypeScript validation
npm run build                  # Build for production
npm run test:e2e               # End-to-end tests

# 3. Push to your feature branch
git checkout -b feature/your-feature-name
git add .
git commit -m "feat: describe your change"
git push origin feature/your-feature-name

# 4. Create Pull Request (GitHub)
# 5. Automated tests run (see GitHub Actions)
# 6. Merge to main from GitHub UI
# 7. Auto-deploys to production (GitHub Pages + Supabase)
```

---

## 🧪 Step 1: Verify Changes Are Functional

### Local Testing (Before Committing)

#### **Run the Full Development Server**
```bash
cd development

# Option A: Full stack with Supabase + Next.js
npm run dev:full:debug

# Option B: Next.js only (if Supabase already running)
npm run dev:debug

# Browser opens at: http://localhost:3000
```

**Check:**
- ✅ App loads without errors
- ✅ Navigation works
- ✅ Your changes appear as expected
- ✅ No console errors in browser DevTools

---

#### **Type Check (Catch Errors Before Tests)**
```bash
npm run type-check

# Output should show: "0 errors"
# If errors exist, fix them before proceeding
```

#### **Unit Tests**
```bash
# Run all tests
npm run test

# Run with coverage report
npm run test:coverage

# Watch mode (re-runs on file changes)
npm run test:watch
```

**Look for:**
- ✅ All tests passing (green checkmarks)
- ✅ No skipped tests
- ✅ Coverage percentage acceptable (target: 70%+)

#### **Code Linting & Formatting**
```bash
# Check code style issues
npm run lint

# Auto-fix style issues
npm run lint:fix

# Check formatting
npm run format:check

# Auto-format code
npm run format
```

#### **Build Test**
```bash
# Test production build
npm run build

# Check for build errors
# If successful, .next/ folder is created
```

#### **End-to-End Tests (Optional but Recommended)**
```bash
# Run E2E tests with browser
npm run test:e2e

# Run with UI dashboard
npm run test:e2e:ui
```

---

### What Needs Testing? Quick Checklist

**If you modified...**

| Changed Component | Tests to Run |
|---|---|
| **React component** `src/components/` | `npm run test` + `npm run test:e2e` |
| **API route** `src/app/api/` | `npm run test` + check `/api/*` endpoints |
| **Database schema** `supabase/migrations/` | `npm run supabase:migrate` + verify tables |
| **Edge Function** `supabase/functions/` | Deploy test: check Supabase dashboard |
| **Styling** (CSS/Tailwind) | Visual check in browser: `npm run dev` |
| **TypeScript type** `src/types/` | `npm run type-check` |
| **Dependencies** `package.json` | `npm run build` + `npm run test` |

---

## 🔍 Step 2: Ensure Nothing Else Broke

### Test Coverage Verification

```bash
# Generate coverage report (shows what's tested)
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html  # macOS/Linux
start coverage/lcov-report/index.html # Windows
```

### Run All Quality Checks (Same as CI/CD)

```bash
# This runs ALL checks that GitHub Actions will run:
npm run type-check       # ✅ TypeScript validation
npm run lint             # ✅ Code style check
npm run format:check     # ✅ Format validation
npm run test             # ✅ Unit tests
npm run build            # ✅ Production build
npm run test:e2e         # ✅ E2E tests
```

**All must pass ✅ before committing**

### Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| **"Cannot find module"** | `npm install` (missing dependency) |
| **Type errors** | `npm run type-check` to see errors, fix, retry |
| **Lint errors** | `npm run lint:fix` to auto-fix, commit fixes |
| **Build fails** | Check `.next/` folder, clear: `npm run clean && npm run build` |
| **Test failures** | `npm run test:watch` to debug specific test |
| **Database errors** | `npm run supabase:types` to sync types |

---

## 📝 Step 3: Commit to Main Branch

### Git Workflow

#### **Option A: Feature Branch (Recommended)**

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and verify they work
npm run test && npm run lint && npm run build

# Commit changes
git add .
git commit -m "feat: add device status monitoring"

# Push to GitHub
git push origin feature/your-feature-name

# Go to GitHub.com and create Pull Request
# - Title: "feat: add device status monitoring"
# - Description: explain changes
# - Link related issues
# - Wait for automated checks to pass
# - Request review from team
# - Merge when approved
```

**Commit Message Format (Conventional Commits):**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Code style changes
- `test:` - Test changes
- `refactor:` - Code refactoring
- `perf:` - Performance improvement
- `chore:` - Build, dependencies, etc.

Example:
```bash
git commit -m "feat: add real-time device sync

- Implemented Golioth webhook handler
- Added sync status UI component
- Updated database schema for sync state
- Closes #45"
```

#### **Option B: Direct to Main (Not Recommended)**

```bash
# Only use for hotfixes/urgent changes
git checkout main
git pull origin main
git add .
git commit -m "fix: urgent production hotfix"
git push origin main
```

### GitHub Checks

After you push, GitHub automatically:

1. **Triggers CI/CD Pipeline** (`.github/workflows/deploy.yml`)
   - Runs on all branches
   - Checks: type-check, lint, test, build

2. **Shows Status on PR**
   - ✅ Checks pass → Safe to merge
   - ❌ Checks fail → Fix errors before merging

3. **Automatic Merge Checks**
   - Requires branch protection rules
   - Can't merge without passing tests

---

## 🚢 Step 4: Publish to Production

### Automatic Deployment (Recommended)

**The system auto-deploys when you merge to `main`:**

```
Your Code Change
    ↓
Create Pull Request
    ↓
GitHub Actions Tests Run ✅
    ↓
Code Review & Approve
    ↓
Merge to main ← YOU ARE HERE
    ↓
Automatic GitHub Actions "Deploy to Supabase + GitHub Pages" ✅
    ├── Deploys database migrations to Supabase
    ├── Deploys Edge Functions to Supabase
    ├── Builds Next.js application
    └── Publishes to GitHub Pages (live at https://netneural.github.io/SoftwareMono)
```

### Manual Deployment (If Needed)

**Option A: Trigger GitHub Actions Manually**

```bash
# Go to GitHub.com → Actions → "Deploy to Supabase + GitHub Pages"
# Click "Run workflow" button
# Select branch: main
# Click "Run workflow"

# Deployment runs automatically
# Monitor status: GitHub.com → Actions
```

**Option B: Deploy from Codespace (Manual)**

```bash
cd development

# Link to Supabase project
supabase link --project-ref <PROJECT_ID>

# Deploy database migrations
supabase db push

# Deploy Edge Functions
supabase functions deploy --no-verify-jwt

# Build and export static site
npm run build:static

# Site files now in ./out/ folder
# (Normally GitHub Pages handles this automatically)
```

---

## 📊 Monitoring Deployments

### Check GitHub Actions Status

```bash
# Command line
gh run list --limit 5
gh run view <RUN_ID>

# Or visit GitHub.com
# Actions tab → select workflow → see latest runs
```

### Check Production Status

**After deployment completes:**

1. **Frontend (GitHub Pages)**
   - https://netneural.github.io/SoftwareMono
   - Check: Navigation loads, no console errors

2. **Backend (Supabase)**
   - Open Supabase dashboard
   - Check: Database tables, Edge Functions, API logs

3. **Real-time Features**
   - Test WebSocket connections
   - Verify real-time data updates work
   - Check alert notifications

---

## 🔐 Environment Variables & Secrets

### Local Development

```bash
cd development

# Copy template
cp .env.local.template .env.local

# Edit with your credentials
nano .env.local
```

**Required for local dev:**
- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>`
- `SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>`

### Production Secrets

**Stored in GitHub Settings (not in code):**

```bash
# GitHub.com → Settings → Secrets → Actions

# View current secrets
gh secret list

# Set new secret
gh secret set GOLIOTH_API_KEY --body "your-key-here"

# Used in CI/CD:
# .github/workflows/deploy.yml
# ${{ secrets.GOLIOTH_API_KEY }}
```

**List of secrets in use:**
- `SUPABASE_ACCESS_TOKEN` - Deployment auth
- `SUPABASE_PROJECT_REF` - Project ID
- `NEXT_PUBLIC_SUPABASE_URL` - Public API URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public API key
- `SUPABASE_SERVICE_ROLE_KEY` - Private service key
- `GOLIOTH_API_KEY` - IoT platform integration
- `SENTRY_DSN` - Error tracking
- (Others as needed)

---

## 🆘 Common Problems & Solutions

### "Build fails in GitHub but works locally"

**Cause:** Environment variables not set in CI/CD

**Fix:**
```bash
# 1. Check .github/workflows/deploy.yml
# 2. Add missing env vars:
gh secret set MISSING_VAR --body "value"

# 3. Re-run workflow
gh run rerun <RUN_ID>
```

### "Tests pass locally but fail in GitHub Actions"

**Cause:** Different Node version or missing database setup

**Fix:**
```bash
# Update Node to match CI
node --version  # Should be 20.x

# Clear cache and reinstall
npm run clean
npm ci
npm run test
```

### "Edge Function deploy fails"

**Cause:** Function file syntax error or missing secret

**Fix:**
```bash
# Check function locally
supabase functions serve

# Debug specific function
supabase functions download <FUNCTION_NAME>

# Check secrets are set
gh secret list
```

### "Database migration won't apply"

**Cause:** Migration already applied or schema conflict

**Fix:**
```bash
# Check migration status
supabase migration list --linked

# Reset local database
npm run supabase:reset
npm run supabase:migrate

# Or reset and reapply manually
supabase db reset
supabase db push
```

---

## 📋 Pre-Merge Checklist

**Before merging to main, verify:**

- [ ] All tests pass locally: `npm run test`
- [ ] Type checking passes: `npm run type-check`
- [ ] Linting passes: `npm run lint`
- [ ] Code formatting correct: `npm run format:check`
- [ ] Build succeeds: `npm run build`
- [ ] E2E tests pass: `npm run test:e2e`
- [ ] No hardcoded secrets in code
- [ ] Dependencies in package.json (not node_modules/)
- [ ] Commit message clear and descriptive
- [ ] PR has description of changes
- [ ] No breaking changes to API
- [ ] Database migrations tested locally
- [ ] Edge Functions tested locally

---

## 📚 Key Files & Directories

| Path | Purpose |
|------|---------|
| `development/package.json` | All npm scripts and dependencies |
| `.github/workflows/deploy.yml` | GitHub Actions CI/CD for main branch |
| `development/.github/workflows/development.yml` | GitHub Actions for feature branches |
| `development/jest.config.js` | Test configuration |
| `development/tsconfig.json` | TypeScript configuration |
| `.eslintrc.json` | Linting rules |
| `development/.env.local` | Local environment variables (gitignored) |
| `supabase/migrations/` | Database schema versions |
| `supabase/functions/` | Edge Functions (serverless) |

---

## 🎯 Typical Day-to-Day Workflow

```bash
# Morning: Start development
cd development
npm run dev:full:debug

# Make changes in editor
# Test in browser (http://localhost:3000)

# When ready to commit:
npm run test       # ✅ Tests pass
npm run lint:fix   # ✅ Fix style issues
npm run type-check # ✅ No TypeScript errors
npm run build      # ✅ Production build works

# Commit and push
git checkout -b feature/new-feature
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature

# Go to GitHub, create PR, request review
# After approval, merge (GitHub UI)

# GitHub Actions automatically:
# 1. Runs all tests ✅
# 2. Deploys to Supabase ✅
# 3. Publishes to GitHub Pages ✅

# Check production: https://netneural.github.io/SoftwareMono
```

---

## 🔗 Useful Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm run dev:full        # Dev + Supabase
npm run dev:full:debug  # Dev + Supabase + debugger

# Testing
npm run test            # Run unit tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage report
npm run test:e2e        # End-to-end tests
npm run test:e2e:ui     # E2E with UI dashboard

# Code Quality
npm run type-check      # TypeScript validation
npm run lint            # Check code style
npm run lint:fix        # Auto-fix style issues
npm run format:check    # Check formatting
npm run format          # Auto-format

# Building
npm run build           # Production build
npm run build:static    # Static export for GitHub Pages
npm run build:analyze   # Build with analysis

# Database
npm run supabase:start  # Start Supabase local
npm run supabase:stop   # Stop Supabase
npm run supabase:reset  # Reset database
npm run supabase:types  # Generate TypeScript types
npm run supabase:migrate # Push migrations to production

# Deployment (Codespace)
gh run list             # List GitHub Actions runs
gh run view <ID>        # View specific run details
gh run rerun <ID>       # Re-run failed workflow
gh secret list          # List secrets
gh secret set KEY VALUE # Set secret
```

---

**Questions?** Check the codespace logs or GitHub Actions output for error details.

