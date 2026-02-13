#!/bin/bash
# Configure Staging Environment Code Changes
# Usage: ./scripts/configure-staging-environment.sh

set -e

echo "⚙️  Configuring Staging Environment"
echo "===================================="
echo ""

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

REPO_ROOT="/workspaces/MonoRepo"
DEV_DIR="$REPO_ROOT/development"

# 1. Create .env.staging file
echo -e "${BLUE}📝 Creating .env.staging file...${NC}"

cat > "$DEV_DIR/.env.staging" << 'EOF'
# Staging Environment Variables for NetNeural IoT Platform
# These values are injected by GitHub Actions during staging deployment

# ============================================================================
# Application Configuration
# ============================================================================
NODE_ENV=staging
NEXT_PUBLIC_APP_NAME="NetNeural IoT Platform [STAGING]"
NEXT_PUBLIC_APP_VERSION="1.0.0-staging"
NEXT_PUBLIC_APP_URL="https://demo-stage.netneural.ai"

# ============================================================================
# Supabase Configuration (Staging)
# ============================================================================
# Managed via GitHub Secrets with STAGING_ prefix
NEXT_PUBLIC_SUPABASE_URL=<from-github-secrets-STAGING_SUPABASE_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from-github-secrets-STAGING_SUPABASE_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<from-github-secrets-STAGING_SUPABASE_SERVICE_ROLE_KEY>
SUPABASE_PROJECT_REF=<from-github-secrets-STAGING_SUPABASE_PROJECT_ID>
SUPABASE_DB_PASSWORD=<from-github-secrets-STAGING_SUPABASE_DB_PASSWORD>

# ============================================================================
# External API Integrations (Staging)
# ============================================================================
GOLIOTH_API_KEY=<from-github-secrets-STAGING_GOLIOTH_API_KEY>
GOLIOTH_PROJECT_ID=nn-cellular-alerts-staging
GOLIOTH_BASE_URL=https://api.golioth.io

# ============================================================================
# GitHub Deployment Configuration
# ============================================================================
GITHUB_TOKEN=<from-github-secrets-GITHUB_TOKEN>
SUPABASE_ACCESS_TOKEN=<from-github-secrets-STAGING_SUPABASE_ACCESS_TOKEN>

# ============================================================================
# Static Export Configuration
# ============================================================================
BUILD_MODE=static
NEXT_PUBLIC_STATIC_EXPORT=true

# ============================================================================
# Feature Flags (Staging-specific)
# ============================================================================
ENABLE_DEBUG_MODE=true
ENABLE_TEST_DATA=true
DISABLE_RATE_LIMITING=true
EOF

echo -e "${GREEN}✅ Created $DEV_DIR/.env.staging${NC}"

# 2. Create CNAME file for staging
echo -e "${BLUE}📝 Creating CNAME file for staging domain...${NC}"
echo "demo-stage.netneural.ai" > "$DEV_DIR/public/CNAME.staging"
echo -e "${GREEN}✅ Created $DEV_DIR/public/CNAME.staging${NC}"

# 3. Update .gitignore to include staging env files
echo -e "${BLUE}📝 Updating .gitignore...${NC}"
if ! grep -q ".env.staging" "$DEV_DIR/.gitignore"; then
    echo "" >> "$DEV_DIR/.gitignore"
    echo "# Staging environment (template committed, local overrides ignored)" >> "$DEV_DIR/.gitignore"
    echo ".env.staging.local" >> "$DEV_DIR/.gitignore"
fi
echo -e "${GREEN}✅ Updated .gitignore${NC}"

# 4. Add staging build scripts to package.json
echo -e "${BLUE}📝 Adding staging build scripts...${NC}"
echo -e "${YELLOW}⚠️  Manual step required:${NC}"
echo "   Add these scripts to development/package.json:"
echo ""
cat << 'EOF'
  "scripts": {
    "build:staging": "NODE_ENV=staging next build",
    "deploy:staging": "npm run build:staging && npm run export",
    "supabase:link:staging": "supabase link --project-ref $STAGING_SUPABASE_PROJECT_ID",
    "supabase:push:staging": "supabase db push --linked",
    "supabase:functions:deploy:staging": "supabase functions deploy --no-verify-jwt --linked",
    "supabase:types:staging": "supabase gen types typescript --linked > src/lib/database.types.ts"
  }
EOF
echo ""

# 5. Create staging configuration in next.config.ts
echo -e "${BLUE}📝 Updating next.config.ts for staging support...${NC}"
echo -e "${YELLOW}⚠️  Manual step required:${NC}"
echo "   Update development/next.config.ts to detect staging environment:"
echo ""
cat << 'EOF'
const isProduction = process.env.NODE_ENV === 'production'
const isStaging = process.env.NODE_ENV === 'staging'
const isStaticExport = isProduction || isStaging

const config = {
  output: isStaticExport ? 'export' : undefined,
  basePath: isStaging ? '' : (isProduction ? '/MonoRepo' : ''),
  assetPrefix: isStaging ? 'https://demo-stage.netneural.ai' : (isProduction ? '/MonoRepo/' : ''),
  // ... rest of config
}
EOF
echo ""

# 6. Create staging branch reference document
echo -e "${BLUE}📝 Creating staging branch documentation...${NC}"
cat > "$REPO_ROOT/docs/STAGING_WORKFLOW.md" << 'EOF'
# Staging Environment Workflow

## Branch Strategy

```
feature/* → staging → main

Development Flow:
1. Create feature branch from staging
2. Develop and test locally
3. PR to staging branch
4. Auto-deploy to demo-stage.netneural.ai
5. Test on staging environment
6. PR staging → main for production
```

## Commands

### Deploy to Staging
```bash
git checkout staging
git pull origin staging
git merge feature/your-feature
git push origin staging
# Deployment triggers automatically
```

### Monitor Deployment
```bash
gh run watch
```

### Verify Staging
```bash
curl -I https://demo-stage.netneural.ai
npm run test:staging
```

## Testing Checklist

Before promoting to production:
- [ ] All automated tests pass
- [ ] Manual smoke tests complete
- [ ] No console errors
- [ ] Database migrations applied
- [ ] Edge functions working
- [ ] Authentication functional
- [ ] Third-party integrations tested

## Rollback Procedure

```bash
# Revert staging to previous commit
git checkout staging
git reset --hard HEAD~1
git push -f origin staging

# Or revert specific commit
git revert <commit-hash>
git push origin staging
```
EOF

echo -e "${GREEN}✅ Created docs/STAGING_WORKFLOW.md${NC}"

echo ""
echo -e "${GREEN}🎉 Staging environment configuration complete!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "  1. Manually update package.json scripts (see above)"
echo "  2. Manually update next.config.ts (see above)"
echo "  3. Run: ./scripts/create-staging-workflow.sh"
echo "  4. Run: ./scripts/setup-staging-database.sh"
echo ""
