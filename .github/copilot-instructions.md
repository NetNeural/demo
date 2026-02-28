# NetNeural Development Context - AI Instructions
# Living Document for GitHub Copilot & AI Assistants

## Project Overview

**Project:** NetNeural IoT Platform  
**Active Architecture:** Supabase-First (Architecture B)  
**Reference Architecture:** Go Microservices (Architecture A - contextual reference only)  
**Primary Workspace:** `development/` directory

---

## Architecture Guidelines

### ✅ Active Development (Architecture B)
**Location:** `development/`  
**Stack:** Next.js 15 + Supabase + Edge Functions (Deno)  
**Status:** Production-active, all new features go here

**Key Principles:**
- Supabase-first: Use Supabase features before custom code
- Edge Functions (Deno) for serverless compute
- Static export to GitHub Pages
- PostgreSQL 17 with Row-Level Security (RLS)
- Real-time subscriptions for live updates

### 📚 Contextual Reference (Architecture A)
**Location:** Root-level directories (31 Go microservices)  
**Purpose:** Historical context, pattern reference, documentation only  
**Status:** NOT for technology/architecture decisions

**Usage:**
- ✅ Understand business logic patterns
- ✅ Reference domain models
- ✅ Document historical decisions
- ❌ DO NOT copy technical implementations
- ❌ DO NOT use as architecture template

---

## Development Workflow

### Local Development Setup

**Required Services (3):**
1. Supabase Docker Stack (~10 containers via CLI)
2. Next.js Dev Server (port 3000)
3. Edge Functions (optional, port 54321)

**Commands:**
```bash
cd development

# Full stack with debugging
npm run dev:full:debug

# Next.js only (assumes Supabase running)
npm run dev:debug

# Check health
curl http://127.0.0.1:54321/health
```

**Debugging:**
- VS Code configs in `.vscode/launch.json`
- Press F5 → "Next.js: debug full stack"
- Breakpoints work in TypeScript/Deno
- See `.vscode/DEBUGGING_SETUP.md`

---

## Environment & Secrets

### Current State ✅ 3-Environment Setup (February 24, 2026)
✅ **Completed:** All hardcoded secrets removed from repo  
✅ **Completed:** 22 secrets managed via GitHub Secrets (PROD_, STAGING_, DEV_ prefixes)  
✅ **Completed:** 3 Supabase projects configured (Production, Staging, Development)  
✅ **Completed:** 3 GitHub Actions workflows (deploy-production, deploy-staging, deploy-dev)  
✅ **Completed:** Git branch strategy (main → prod, staging → stage, develop → dev)

### Guidelines for AI Assistants
- **DO NOT** commit secrets to any file
- **DO NOT** hardcode API keys in code
- **DO** use environment variables for all config
- **DO** reference comprehensive docs:
  - `development/docs/SECRETS_INVENTORY.md` - Complete catalog
  - `development/docs/SECRETS_GOVERNANCE.md` - 4-tier classification
  - `development/docs/SECRETS_CLEANUP_AUDIT.md` - Audit report
  - `development/docs/SUPABASE_GITHUB_SECRETS_STRATEGY.md` - Best practices

### Secrets Management
- **GitHub Secrets:** 22 total (4 PROD_, 7 STAGING_, 4 DEV_, 7 shared)
- **Local Development:** `.env.local` (gitignored) with local Supabase demo keys
- **Environment Files:** `.env.production`, `.env.staging`, `.env.development`
- **Rotation Schedule:** Tier 1 (30 days), Tier 2 (90 days) - see SECRETS_INVENTORY.md

---

## Testing Strategy

### Current State (Needs Improvement)
⚠️ **Known Issue:** CI/CD has `continue-on-error: true` (tests don't block deploys)  
⚠️ **Known Issue:** Test coverage incomplete

### Guidelines for AI Assistants
- **DO** write tests for new features
- **DO** run `npm test` before suggesting code
- **DO** follow existing test patterns in `__tests__/`
- **Planned:** Minimum 70% coverage requirement, block failing deployments

---

## Deployment

### 3-Environment Architecture ✅ IMPLEMENTED (February 24, 2026)

| Environment | Name | Domain | Branch | Supabase Ref | Workflow |
|---|---|---|---|---|---|
| **Production** | Sentinel | sentinel.netneural.ai | `main` | `bldojxpockljyivldxwf` | `deploy-production.yml` |
| **Staging** | Demo-Stage | demo-stage.netneural.ai | `staging` | `atgbmxicqikmapfqouco` | `deploy-staging.yml` |
| **Development** | Demo | demo.netneural.ai | `develop` | `tsomafkalaoarnuwgdyu` | `deploy-dev.yml` |

**Promotion Flow:** `develop` → `staging` → `main`  
**Branching:** Feature branches → `develop` → `staging` → `main`

### GitHub Secrets (22 total, grouped by prefix)
- **PROD_**: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PROJECT_ID
- **STAGING_**: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PROJECT_ID, SUPABASE_DB_PASSWORD, SUPABASE_ACCESS_TOKEN, GOLIOTH_API_KEY
- **DEV_**: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PROJECT_ID
- **Shared**: SUPABASE_ACCESS_TOKEN, OPENAI_API_KEY, TWILIO_* (3), NEXT_PUBLIC_SUPABASE_* (2 legacy)

### Guidelines for AI Assistants
- `npm run build` must succeed before deploy
- Static export only (no server-side runtime)
- All dynamic features use Supabase/Edge Functions
- **DO** target the correct environment for changes
- **DO** use the correct branch for the target environment
- **DO NOT** mix environment configurations (e.g., staging keys in prod)

---

## Monorepo Structure

### Purpose
**GitHub/Git Setup:** Centralized for business reasons  
**Contains:** 40+ directories (31 microservices + UIs + tooling)  
**Management:** GitHub Projects, Issues, centralized organization

### Guidelines for AI Assistants
- **DO NOT** suggest splitting repos (business requirement)
- **DO** suggest VS Code workspace filtering (see below)
- **DO** respect submodule structure
- Focus assistance on `development/` directory

### VS Code Workspace Optimization ✅ IMPLEMENTED
**Current:** Multi-root workspace (`SoftwareMono.code-workspace`)  
**Shows:** `development/`, `docs/`, `.github/`, `scripts/` only  
**Hidden:** 31 microservices (still searchable via Ctrl+P)  
**Result:** Clean explorer view, reduced cognitive load

**To Use:**
- Open `SoftwareMono.code-workspace` in VS Code
- Or: File → Open Workspace from File

---

## Code Generation Guidelines

### For Next.js (Architecture B)
```typescript
// ✅ DO: Use App Router patterns
// app/dashboard/page.tsx
export default async function DashboardPage() {
  const supabase = createClient()
  const { data } = await supabase.from('devices').select()
  return <DashboardView devices={data} />
}

// ❌ DON'T: Use Pages Router
// pages/dashboard.tsx (deprecated pattern)
```

### For Supabase
```typescript
// ✅ DO: Use Row-Level Security
create policy "Users see own devices"
  on devices for select
  using (auth.uid() = user_id);

// ✅ DO: Use Edge Functions for compute
// supabase/functions/process-data/index.ts
Deno.serve(async (req) => {
  const data = await req.json()
  // Process and return
})

// ❌ DON'T: Create custom backends
```

### For Database
```sql
-- ✅ DO: Use PostgreSQL features
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);

-- ✅ DO: Add indexes for performance
CREATE INDEX idx_devices_user ON devices(user_id);
```

---

## AI Blueprint Integration

**Config File:** `ai_blueprint_config.yaml`  
**Purpose:** Automated documentation maintenance

**Tracked Metrics:**
- MVP completion: 78% → 100% target
- Service production-readiness
- Market competitive analysis
- Technical debt tracking

**AI Assistant Role:**
- Keep metrics updated in code comments
- Reference competitive scores in feature decisions
- Align new features with MVP epics

---

## Planning Status (Active)

### ✅ Completed
1. **Process Management** - VS Code debugging integrated
2. **Secrets Management** - GitHub Secrets + comprehensive docs
3. **Workspace Filtering** - Multi-root workspace implemented
4. **Architecture Documentation** - Clear A vs B guidance

### 🔍 Needs Planning Session
5. **Testing Strategy** - Coverage requirements, test types, blocking criteria
6. **CI/CD Quality Gates** - Progressive enforcement strategy

### ⏸️ Low Priority (Revisit Later)
7. **Deployment Preview Strategy** (Current GitHub Pages works)
8. **Monorepo Build Tooling** (Single active project, not needed yet)
9. **Microservices Integration** (Strategic business decision)

---

## Communication Patterns

### When Assisting with Code
- **Assume:** Working in `development/` unless specified
- **Check:** Is this Architecture B (Supabase) or A (reference)?
- **Verify:** Does it follow official Next.js/Supabase patterns?
- **Test:** Can it be debugged with VS Code configs?

### When Suggesting Changes
- **Small:** Implement directly (single file, clear scope)
- **Medium:** Explain plan first, then implement
- **Large:** Multi-step planning session (like this one)

### When Encountering Ambiguity
- **Ask:** Which architecture? (A=reference, B=active)
- **Ask:** Production urgency? (Fix now vs plan later)
- **Ask:** Risk tolerance? (Conservative vs aggressive)

---

## Planning Status (Active)

### ✅ Completed
1. **Process Management** - VS Code debugging integrated
2. **Secrets Management** - GitHub Secrets + comprehensive docs
3. **Workspace Filtering** - Multi-root workspace implemented
4. **Architecture Documentation** - Clear A vs B guidance

### 🔍 Needs Planning Session
5. **Testing Strategy** - Coverage requirements, test types, blocking criteria
6. **CI/CD Quality Gates** - Progressive enforcement strategy

### ⏸️ Low Priority (Revisit Later)
7. **Deployment Preview Strategy** (Current GitHub Pages works)
8. **Monorepo Build Tooling** (Single active project, not needed yet)
9. **Microservices Integration** (Strategic business decision)

---

## Known Pain Points (Planning Status)

1. ✅ **Process Management** - SOLVED (VS Code debugging)
2. ✅ **Architecture Duality** - DOCUMENTED (this file)
3. ✅ **Secrets Management** - SECURED (GitHub Secrets + docs)
4. ✅ **Monorepo Filtering** - IMPLEMENTED (multi-root workspace)
5. ✅ **Deployment Pipeline** - IMPLEMENTED (3-env: dev/staging/prod)
6. 🔍 **Testing Infrastructure** - NEEDS SESSION (coverage, CI gates)
7. 🔍 **CI/CD Quality Gates** - NEEDS EVALUATION (progressive enforcement)
8. 📋 **Microservices Strategy** - REFERENCE ONLY (strategic decision)

---

## Quick Reference

### File Locations
- **Active Code:** `development/src/`
- **Edge Functions:** `development/supabase/functions/`
- **Database:** `development/supabase/migrations/`
- **Tests:** `development/__tests__/`
- **Docs:** `development/docs/`
- **Config:** `development/.env.local` (gitignored, uses env vars)
- **Secrets Docs:** `development/docs/SECRETS_*.md` (inventory, governance, audit)

### Common Commands
```bash
# Development
npm run dev:full:debug        # Start all + debugger
npm run supabase:status       # Check services
npm run supabase:types        # Regenerate TS types

# Testing
npm test                      # Run unit tests
npm run test:e2e              # Run Playwright

# Build
npm run build                 # Production build
npm run type-check            # TypeScript validation
npm run lint                  # ESLint check
```

### Emergency Fixes
```bash
# Zombie processes
pkill -f "next dev"
pkill -f "supabase"

# Reset Supabase
npm run supabase:stop
npm run supabase:start

# Clean build
npm run clean
npm install
npm run build
```

---

## Version History
- **2026-02-24:** 3-environment setup implemented (Dev/Staging/Prod)
  - 3 Supabase projects: tsomafkalaoarnuwgdyu (dev), atgbmxicqikmapfqouco (staging), bldojxpockljyivldxwf (prod)
  - 3 GitHub Actions workflows: deploy-dev.yml, deploy-staging.yml, deploy-production.yml
  - 22 GitHub secrets (DEV_, STAGING_, PROD_ prefixes)
  - Git branches: develop → staging → main
  - Domains: demo.netneural.ai, demo-stage.netneural.ai, sentinel.netneural.ai
- **2025-11-13 (Morning):** Initial creation, debugging setup integrated
- **2025-11-13 (Afternoon):** Secrets management completed, workspace filtering implemented
  - Added 14 secrets to GitHub (GOLIOTH_API_KEY, GITHUB_TOKEN, etc.)
  - Removed all hardcoded secrets from 9 files
  - Created comprehensive docs (SECRETS_INVENTORY, SECRETS_GOVERNANCE, CLEANUP_AUDIT)
  - Implemented multi-root workspace (hides 31 microservices)
  - Verified full GitHub CLI secrets management access
- **Next:** Testing strategy session, CI/CD quality gates evaluation

---

**AI Assistants:** This is a living document. Update it as patterns emerge and decisions are made. Always reference this before suggesting architectural changes.
