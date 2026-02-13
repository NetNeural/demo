#!/bin/bash
# Master Setup Script for Staging Environment
# Orchestrates all staging setup steps
# Usage: ./scripts/setup-staging-environment.sh

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  NetNeural IoT Platform - Staging Environment Setup   ║"
echo "║  Target: demo-stage.netneural.ai                       ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to repo root
cd "$REPO_ROOT"

# Pre-flight checks
echo -e "${BLUE}🔍 Pre-flight Checks${NC}"
echo "====================="
echo ""

# Check gh CLI
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) not installed${NC}"
    echo "   Install from: https://cli.github.com/"
    exit 1
fi
echo -e "${GREEN}✅ GitHub CLI installed${NC}"

# Check Supabase CLI
if command -v supabase &> /dev/null; then
    echo -e "${GREEN}✅ Supabase CLI installed (global)${NC}"
elif npx supabase --version &> /dev/null; then
    echo -e "${GREEN}✅ Supabase CLI available (via npx)${NC}"
    # Create alias function for scripts to use
    export SUPABASE_CMD="npx supabase"
else
    echo -e "${RED}❌ Supabase CLI not available${NC}"
    echo "   See: https://supabase.com/docs/guides/cli/getting-started"
    exit 1
fi

# Check authentication
if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ Not authenticated with GitHub${NC}"
    echo "   Run: gh auth login"
    exit 1
fi
echo -e "${GREEN}✅ GitHub authenticated${NC}"

echo ""
echo -e "${BOLD}${BLUE}Setup will proceed in 5 phases:${NC}"
echo "  1. Infrastructure Setup (Manual)"
echo "  2. GitHub Secrets Configuration"
echo "  3. Code Configuration"
echo "  4. Database Setup"
echo "  5. Workflow Creation"
echo ""

read -p "Press Enter to continue or Ctrl+C to abort..."
echo ""

# Phase 1: Manual infrastructure setup
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  Phase 1: Infrastructure Setup (Manual Steps)         ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

echo -e "${YELLOW}📋 Manual steps required:${NC}"
echo ""
echo "1. Create Staging Supabase Project:"
echo "   → Visit: https://supabase.com/dashboard"
echo "   → Create new project: 'netneural-iot-staging'"
echo "   → Note: Project Reference ID, URL, and keys"
echo ""
echo "2. Configure DNS:"
echo "   → Add CNAME: demo-stage.netneural.ai → netneural.github.io"
echo "   → Wait for propagation (5-60 minutes)"
echo ""
echo "3. Create GitHub Environment:"
echo "   → Visit: https://github.com/NetNeural/MonoRepo/settings/environments"
echo "   → Create environment: 'staging'"
echo "   → Configure protection rules (optional)"
echo ""

read -p "Have you completed these steps? (y/N): " MANUAL_COMPLETE

if [[ ! "$MANUAL_COMPLETE" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  Complete manual steps first, then re-run this script${NC}"
    echo ""
    echo "For detailed instructions, see:"
    echo "  cat $REPO_ROOT/STAGING_ENVIRONMENT_PLAN.md"
    exit 0
fi

# Phase 2: GitHub Secrets
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  Phase 2: GitHub Secrets Configuration                ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

read -p "Configure GitHub secrets now? (y/N): " CONFIGURE_SECRETS

if [[ "$CONFIGURE_SECRETS" =~ ^[Yy]$ ]]; then
    bash "$SCRIPT_DIR/setup-staging-secrets.sh"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Secrets configuration failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Skipping secrets configuration${NC}"
    echo "   Run manually: ./scripts/setup-staging-secrets.sh"
fi

# Phase 3: Code configuration
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  Phase 3: Code Configuration                          ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

read -p "Configure staging environment files? (y/N): " CONFIGURE_CODE

if [[ "$CONFIGURE_CODE" =~ ^[Yy]$ ]]; then
    bash "$SCRIPT_DIR/configure-staging-environment.sh"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Code configuration failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Skipping code configuration${NC}"
fi

# Phase 4: Database setup
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  Phase 4: Database Setup                              ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

read -p "Setup staging database? (y/N): " SETUP_DATABASE

if [[ "$SETUP_DATABASE" =~ ^[Yy]$ ]]; then
    bash "$SCRIPT_DIR/setup-staging-database.sh"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Database setup failed${NC}"
        exit 1
    fi
    
    # Optional: Seed data
    echo ""
    read -p "Seed staging database with test data? (y/N): " SEED_DATA
    
    if [[ "$SEED_DATA" =~ ^[Yy]$ ]]; then
        bash "$SCRIPT_DIR/seed-staging-data.sh"
    fi
else
    echo -e "${YELLOW}⚠️  Skipping database setup${NC}"
fi

# Phase 5: Workflow creation
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  Phase 5: GitHub Actions Workflow                     ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

read -p "Create staging deployment workflow? (y/N): " CREATE_WORKFLOW

if [[ "$CREATE_WORKFLOW" =~ ^[Yy]$ ]]; then
    bash "$SCRIPT_DIR/create-staging-workflow.sh"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Workflow creation failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Skipping workflow creation${NC}"
fi

# Final summary
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  Setup Complete! 🎉                                   ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

echo -e "${GREEN}✅ Staging environment setup completed!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo ""
echo "1. Create staging branch:"
echo "   ${YELLOW}git checkout -b staging${NC}"
echo "   ${YELLOW}git push -u origin staging${NC}"
echo ""
echo "2. Commit and push configuration changes:"
echo "   ${YELLOW}git add -A${NC}"
echo "   ${YELLOW}git commit -m 'feat: add staging environment configuration'${NC}"
echo "   ${YELLOW}git push origin staging${NC}"
echo ""
echo "3. Monitor deployment:"
echo "   ${YELLOW}gh run watch${NC}"
echo ""
echo "4. Verify deployment:"
echo "   ${YELLOW}./scripts/verify-staging-deployment.sh${NC}"
echo ""
echo "5. Access staging environment:"
echo "   ${YELLOW}https://demo-stage.netneural.ai${NC}"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "   - Setup Plan: ./STAGING_ENVIRONMENT_PLAN.md"
echo "   - Workflow Guide: ./docs/STAGING_WORKFLOW.md"
echo ""
echo -e "${GREEN}🚀 Happy Testing!${NC}"
