#!/bin/bash

# NetNeural Platform - Production Supabase Setup Script
# This script sets up a fresh Supabase production environment

set -e

echo "🚀 Starting NetNeural Platform Production Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI is not installed${NC}"
    echo "Please install it with: npm install -g supabase"
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI found${NC}"

# Check if user is logged in
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged into Supabase${NC}"
    echo "Please run: supabase login"
    exit 1
fi

echo -e "${GREEN}✅ Supabase authentication verified${NC}"

# Prompt for project creation or linking
echo -e "${BLUE}📋 Supabase Project Setup${NC}"
echo "Would you like to:"
echo "1. Create a new Supabase project"
echo "2. Link to an existing project"
read -p "Enter your choice (1 or 2): " choice

case $choice in
    1)
        echo -e "${BLUE}🆕 Creating new Supabase project...${NC}"
        read -p "Enter project name: " project_name
        read -p "Enter database password: " db_password
        read -p "Enter region (default: us-east-1): " region
        region=${region:-us-east-1}
        
        # Create project
        supabase projects create "$project_name" --region "$region" --db-password "$db_password"
        project_ref=$(supabase projects list | grep "$project_name" | awk '{print $1}')
        ;;
    2)
        echo -e "${BLUE}🔗 Linking to existing project...${NC}"
        supabase projects list
        read -p "Enter project reference ID: " project_ref
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

# Link local project to remote
echo -e "${BLUE}🔗 Linking local project to remote...${NC}"
supabase link --project-ref "$project_ref"

# Reset and apply migrations
echo -e "${BLUE}🗄️  Setting up database schema...${NC}"
supabase db reset --linked

# Generate types
echo -e "${BLUE}📝 Generating TypeScript types...${NC}"
supabase gen types typescript --linked > src/lib/database.types.ts

# Get project details
project_url=$(supabase status --output json | jq -r '.api_url')
anon_key=$(supabase status --output json | jq -r '.anon_key')
service_role_key=$(supabase status --output json | jq -r '.service_role_key')

# Create production environment file
echo -e "${BLUE}📝 Creating production environment configuration...${NC}"
cat > .env.production.local << EOF
# Production Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=$project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=$anon_key
SUPABASE_SERVICE_ROLE_KEY=$service_role_key
SUPABASE_PROJECT_REF=$project_ref
EOF

echo -e "${GREEN}✅ Production environment file created: .env.production.local${NC}"

# Display GitHub Secrets information
echo -e "${YELLOW}🔐 GitHub Secrets Configuration${NC}"
echo "Add these secrets to your GitHub repository:"
echo "Settings > Secrets and variables > Actions > New repository secret"
echo ""
echo "NEXT_PUBLIC_SUPABASE_URL: $project_url"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY: $anon_key"
echo "SUPABASE_SERVICE_ROLE_KEY: $service_role_key"
echo ""

# Additional setup prompts
echo -e "${BLUE}🔧 Additional Configuration${NC}"
read -p "Do you have a Golioth API key? (y/n): " has_golioth
if [[ $has_golioth == "y" ]]; then
    read -p "Enter Golioth API key: " golioth_key
    read -p "Enter Golioth Project ID: " golioth_project
    echo "GOLIOTH_API_KEY: $golioth_key"
    echo "GOLIOTH_PROJECT_ID: $golioth_project"
fi

echo -e "${GREEN}🎉 Production setup complete!${NC}"
echo "Next steps:"
echo "1. Add the GitHub secrets shown above"
echo "2. Push your code to trigger deployment"
echo "3. Visit https://netneural.github.io/MonoRepo when deployment completes"