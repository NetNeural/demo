#!/bin/bash
# Setup GitHub Secrets for Staging Environment
# Usage: ./scripts/setup-staging-secrets.sh

set -e

echo "🔐 GitHub Secrets Setup for Staging Environment"
echo "================================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) is not installed${NC}"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ Not authenticated with GitHub CLI${NC}"
    echo "Run: gh auth login"
    exit 1
fi

REPO="NetNeural/MonoRepo"
echo -e "${BLUE}📦 Repository: ${REPO}${NC}"
echo ""

# Function to set secret at repository level
set_secret() {
    local secret_name=$1
    local secret_value=$2
    
    if [ -z "$secret_value" ]; then
        echo -e "${YELLOW}⚠️  Skipping empty value for ${secret_name}${NC}"
        return
    fi
    
    echo -e "${BLUE}Setting ${secret_name}...${NC}"
    
    # Set as repository secret (accessible to all environments/workflows)
    echo "$secret_value" | gh secret set "$secret_name" --repo "$REPO"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ ${secret_name} set successfully${NC}"
    else
        echo -e "${RED}❌ Failed to set ${secret_name}${NC}"
    fi
}

# Prompt for staging Supabase credentials
echo -e "${YELLOW}📋 Please provide staging Supabase credentials${NC}"
echo "   (Get these from: https://supabase.com/dashboard/project/[your-staging-project])"
echo ""

read -p "Staging Supabase Project Reference ID: " STAGING_PROJECT_ID
read -p "Staging Supabase URL (https://[project-ref].supabase.co): " STAGING_SUPABASE_URL
echo ""
echo -e "${YELLOW}Enter Staging Supabase Anon Key (paste and press Enter):${NC}"
read -s STAGING_ANON_KEY
echo ""
echo -e "${YELLOW}Enter Staging Supabase Service Role Key (paste and press Enter):${NC}"
read -s STAGING_SERVICE_KEY
echo ""
read -sp "Staging Supabase Database Password: " STAGING_DB_PASSWORD
echo ""
echo ""

# Optional: Separate Golioth staging key or use production
echo -e "${YELLOW}Golioth API Configuration:${NC}"
echo "1. Use separate staging Golioth API key"
echo "2. Use production Golioth API key (shared)"
read -p "Choose option (1 or 2): " GOLIOTH_OPTION

if [ "$GOLIOTH_OPTION" = "1" ]; then
    read -sp "Staging Golioth API Key: " STAGING_GOLIOTH_KEY
    echo ""
else
    echo -e "${BLUE}Fetching production Golioth key...${NC}"
    STAGING_GOLIOTH_KEY=$(gh secret list --repo "$REPO" | grep GOLIOTH_API_KEY | awk '{print $1}')
    if [ -z "$STAGING_GOLIOTH_KEY" ]; then
        read -sp "Production Golioth API Key not found. Enter manually: " STAGING_GOLIOTH_KEY
        echo ""
    else
        echo -e "${GREEN}✅ Will use production Golioth key${NC}"
    fi
fi
echo ""

# Get Supabase Access Token (for CLI operations)
echo -e "${YELLOW}Supabase Access Token:${NC}"
echo "   Get from: https://supabase.com/dashboard/account/tokens"
read -sp "Supabase Access Token (for staging): " STAGING_SUPABASE_ACCESS_TOKEN
echo ""
echo ""

# Confirm before setting secrets
echo -e "${YELLOW}📊 Summary of secrets to be created:${NC}"
echo "  - STAGING_SUPABASE_PROJECT_ID"
echo "  - STAGING_SUPABASE_URL"
echo "  - STAGING_SUPABASE_ANON_KEY"
echo "  - STAGING_SUPABASE_SERVICE_ROLE_KEY"
echo "  - STAGING_SUPABASE_DB_PASSWORD"
echo "  - STAGING_GOLIOTH_API_KEY"
echo "  - STAGING_SUPABASE_ACCESS_TOKEN"
echo ""
read -p "Proceed with setting these secrets? (y/N): " CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Aborted by user${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🚀 Setting GitHub secrets at repository level...${NC}"
echo "   (These will be accessible to the staging environment workflow)"
echo ""

# Set all secrets at repository level
set_secret "STAGING_SUPABASE_PROJECT_ID" "$STAGING_PROJECT_ID"
set_secret "STAGING_SUPABASE_URL" "$STAGING_SUPABASE_URL"
set_secret "STAGING_SUPABASE_ANON_KEY" "$STAGING_ANON_KEY"
set_secret "STAGING_SUPABASE_SERVICE_ROLE_KEY" "$STAGING_SERVICE_KEY"
set_secret "STAGING_SUPABASE_DB_PASSWORD" "$STAGING_DB_PASSWORD"
set_secret "STAGING_GOLIOTH_API_KEY" "$STAGING_GOLIOTH_KEY"
set_secret "STAGING_SUPABASE_ACCESS_TOKEN" "$STAGING_SUPABASE_ACCESS_TOKEN"

echo ""
echo -e "${GREEN}✅ All staging secrets configured successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Verify secrets:${NC}"
echo "   gh secret list --repo $REPO | grep STAGING"
echo ""
echo -e "${YELLOW}💡 Optional: Create GitHub Environment${NC}"
echo "   Visit: https://github.com/$REPO/settings/environments"
echo "   → Create 'staging' environment"
echo "   → Add protection rules (optional)"
echo ""
echo -e "${GREEN}🎉 Ready to proceed with staging environment setup${NC}"
