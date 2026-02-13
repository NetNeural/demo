#!/bin/bash
# Setup Staging Supabase Database
# Usage: ./scripts/setup-staging-database.sh

set -e

echo "🗄️  Setting up Staging Supabase Database"
echo "========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

DEV_DIR="/workspaces/MonoRepo/development"
cd "$DEV_DIR"

# Check if Supabase CLI is installed
if command -v supabase &> /dev/null; then
    SUPABASE_CMD="supabase"
elif command -v npx &> /dev/null && npx supabase --version &> /dev/null 2>&1; then
    SUPABASE_CMD="npx supabase"
else
    echo -e "${RED}❌ Supabase CLI not available${NC}"
    echo "See: https://supabase.com/docs/guides/cli/getting-started"
    exit 1
fi

# Prompt for staging project reference
echo -e "${YELLOW}📋 Staging Supabase Project Configuration${NC}"
read -p "Enter Staging Project Reference ID: " STAGING_PROJECT_REF

if [ -z "$STAGING_PROJECT_REF" ]; then
    echo -e "${RED}❌ Project reference is required${NC}"
    exit 1
fi

# Get access token (from environment or prompt)
if [ -z "$STAGING_SUPABASE_ACCESS_TOKEN" ]; then
    echo ""
    read -sp "Enter Supabase Access Token: " STAGING_SUPABASE_ACCESS_TOKEN
    echo ""
fi

export SUPABASE_ACCESS_TOKEN="$STAGING_SUPABASE_ACCESS_TOKEN"

# 1. Link to staging project
echo ""
echo -e "${BLUE}🔗 Linking to staging Supabase project...${NC}"
$SUPABASE_CMD link --project-ref "$STAGING_PROJECT_REF"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to link to staging project${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Linked to staging project${NC}"

# 2. Push database migrations
echo ""
echo -e "${BLUE}📤 Pushing database migrations...${NC}"
echo "   This will apply all migrations from supabase/migrations/"

$SUPABASE_CMD db push

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to push migrations${NC}"
    echo "   Check migration files for errors"
    exit 1
fi

echo -e "${GREEN}✅ Migrations applied successfully${NC}"

# 3. Deploy edge functions
echo ""
echo -e "${BLUE}🚀 Deploying edge functions...${NC}"

if [ -d "supabase/functions" ]; then
    $SUPABASE_CMD functions deploy --no-verify-jwt
    
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}⚠️  Some edge functions failed to deploy${NC}"
        echo "   Check function code for errors"
    else
        echo -e "${GREEN}✅ Edge functions deployed${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No edge functions found${NC}"
fi

# 4. Generate TypeScript types
echo ""
echo -e "${BLUE}📝 Generating TypeScript types...${NC}"

$SUPABASE_CMD gen types typescript --linked > src/lib/database.types.ts

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ TypeScript types generated${NC}"
else
    echo -e "${YELLOW}⚠️  Failed to generate types${NC}"
fi

# 5. Enable Row Level Security
echo ""
echo -e "${BLUE}🔒 Verifying Row Level Security (RLS)...${NC}"

RLS_CHECK=$($SUPABASE_CMD db remote exec "
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = false;
" 2>/dev/null || echo "")

if [ -z "$RLS_CHECK" ]; then
    echo -e "${GREEN}✅ RLS enabled on all public tables${NC}"
else
    echo -e "${YELLOW}⚠️  Some tables don't have RLS enabled:${NC}"
    echo "$RLS_CHECK"
fi

# 6. Verify database status
echo ""
echo -e "${BLUE}📊 Database Status:${NC}"
$SUPABASE_CMD status

echo ""
echo -e "${GREEN}🎉 Staging database setup complete!${NC}"
echo ""
echo -e "${BLUE}📋 Database Info:${NC}"
echo "   Project: $STAGING_PROJECT_REF"
echo "   URL: https://$STAGING_PROJECT_REF.supabase.co"
echo "   Studio: https://supabase.com/dashboard/project/$STAGING_PROJECT_REF"
echo ""
echo -e "${YELLOW}🔍 Next steps:${NC}"
echo "  1. Seed test data: ./scripts/seed-staging-data.sh"
echo "  2. Test database connection: npm run dev"
echo "  3. Review database in Supabase Studio"
echo ""
