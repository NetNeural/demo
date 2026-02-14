#!/bin/bash
# Quick Staging Database Setup
# Usage: ./scripts/quick-staging-db-setup.sh [PROJECT_REF]

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

STAGING_PROJECT_REF="${1:-atgbmxicqikmapfqouco}"

echo -e "${BLUE}🗄️  Quick Staging Database Setup${NC}"
echo "=================================="
echo ""
echo "Project: $STAGING_PROJECT_REF"
echo ""

cd /workspaces/MonoRepo/development

# Check if Supabase access token is set
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  SUPABASE_ACCESS_TOKEN not set${NC}"
    read -sp "Enter Supabase Access Token: " SUPABASE_ACCESS_TOKEN
    echo ""
    export SUPABASE_ACCESS_TOKEN
fi

# Step 1: Link to project
echo -e "${BLUE}1️⃣  Linking to staging project...${NC}"
npx supabase link --project-ref "$STAGING_PROJECT_REF"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to link. Check your access token.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Linked to staging project${NC}"
echo ""

# Step 2: Push migrations
echo -e "${BLUE}2️⃣  Pushing database migrations...${NC}"
npx supabase db push --linked

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Migration failed${NC}"
    echo ""
    echo -e "${YELLOW}💡 Try these fixes:${NC}"
    echo "  1. Check if extensions are enabled in Supabase dashboard"
    echo "  2. Run: npx supabase db reset --linked"
    echo "  3. Contact support if issue persists"
    exit 1
fi

echo -e "${GREEN}✅ Migrations applied${NC}"
echo ""

# Step 3: Deploy edge functions
echo -e "${BLUE}3️⃣  Deploying edge functions...${NC}"

if [ -d "supabase/functions" ]; then
    npx supabase functions deploy --no-verify-jwt --linked
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Edge functions deployed${NC}"
    else
        echo -e "${YELLOW}⚠️  Some functions failed to deploy${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No functions directory found${NC}"
fi

echo ""

# Step 4: Generate types
echo -e "${BLUE}4️⃣  Generating TypeScript types...${NC}"
npx supabase gen types typescript --linked > src/lib/database.types.ts

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Types generated${NC}"
else
    echo -e "${YELLOW}⚠️  Type generation failed${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Staging database setup complete!${NC}"
echo ""
echo -e "${BLUE}📊 Next steps:${NC}"
echo "  1. Verify in Supabase Studio:"
echo "     https://supabase.com/dashboard/project/$STAGING_PROJECT_REF"
echo ""
echo "  2. Seed test data (optional):"
echo "     ./scripts/seed-staging-data.sh"
echo ""
echo "  3. Push staging branch to deploy:"
echo "     git push origin staging"
echo ""
