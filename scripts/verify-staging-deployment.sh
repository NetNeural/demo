#!/bin/bash
# Verify Staging Deployment Health
# Usage: ./scripts/verify-staging-deployment.sh

set -e

echo "🔍 Verifying Staging Deployment"
echo "================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

STAGING_URL="https://demo-stage.netneural.ai"
FAILED_CHECKS=0

# Function to check URL
check_url() {
    local url=$1
    local description=$2
    
    echo -ne "${BLUE}Checking $description...${NC}"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" -L --max-time 10 || echo "000")
    
    if [ "$response" = "200" ]; then
        echo -e " ${GREEN}✅ OK ($response)${NC}"
        return 0
    else
        echo -e " ${RED}❌ Failed ($response)${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

# Function to check API endpoint
check_api() {
    local endpoint=$1
    local description=$2
    
    echo -ne "${BLUE}Testing $description...${NC}"
    
    response=$(curl -s "$STAGING_URL$endpoint" -H "Accept: application/json" --max-time 10 || echo "error")
    
    if [[ "$response" != "error" ]] && [[ "$response" != *"error"* ]]; then
        echo -e " ${GREEN}✅ Responding${NC}"
        return 0
    else
        echo -e " ${YELLOW}⚠️  Check response${NC}"
        return 1
    fi
}

echo -e "${BLUE}🌐 Domain & SSL Checks${NC}"
echo "========================"
echo ""

# 1. DNS Resolution
echo -ne "${BLUE}DNS Resolution...${NC}"
if nslookup demo-stage.netneural.ai > /dev/null 2>&1; then
    echo -e " ${GREEN}✅ Resolved${NC}"
else
    echo -e " ${RED}❌ Not resolved${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# 2. SSL Certificate
echo -ne "${BLUE}SSL Certificate...${NC}"
ssl_check=$(curl -vI "$STAGING_URL" 2>&1 | grep "SSL certificate verify ok" || echo "")
if [ -n "$ssl_check" ]; then
    echo -e " ${GREEN}✅ Valid${NC}"
else
    echo -e " ${YELLOW}⚠️  Check certificate${NC}"
fi

echo ""
echo -e "${BLUE}📄 Page Availability${NC}"
echo "===================="
echo ""

# 3. Check key pages
check_url "$STAGING_URL" "Homepage"
check_url "$STAGING_URL/dashboard" "Dashboard"
check_url "$STAGING_URL/dashboard/devices" "Devices Page"
check_url "$STAGING_URL/dashboard/organizations" "Organizations Page"
check_url "$STAGING_URL/dashboard/settings" "Settings Page"

echo ""
echo -e "${BLUE}🔌 API Health Checks${NC}"
echo "===================="
echo ""

# 4. Check API endpoints (if available)
check_api "/api/health" "Health Endpoint"
check_api "/api/status" "Status Endpoint"

echo ""
echo -e "${BLUE}🗄️  Database Connectivity${NC}"
echo "========================="
echo ""

# 5. Check Supabase connection
echo -ne "${BLUE}Supabase API...${NC}"
if [ -n "$STAGING_SUPABASE_URL" ]; then
    supabase_response=$(curl -s -o /dev/null -w "%{http_code}" "$STAGING_SUPABASE_URL/rest/v1/" \
        -H "apikey: ${STAGING_SUPABASE_ANON_KEY}" --max-time 10 || echo "000")
    
    if [ "$supabase_response" = "200" ]; then
        echo -e " ${GREEN}✅ Connected${NC}"
    else
        echo -e " ${RED}❌ Connection failed ($supabase_response)${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
else
    echo -e " ${YELLOW}⚠️  Environment variables not set${NC}"
fi

echo ""
echo -e "${BLUE}🚀 Edge Functions${NC}"
echo "=================="
echo ""

# 6. Check edge functions (if URLs are known)
echo -e "${YELLOW}ℹ️  Manual check recommended:${NC}"
echo "   Visit Supabase Dashboard → Edge Functions"
echo "   Verify all functions show 'Deployed' status"

echo ""
echo -e "${BLUE}📊 Performance Check${NC}"
echo "===================="
echo ""

# 7. Measure page load time
echo -ne "${BLUE}Page load time...${NC}"
load_time=$(curl -o /dev/null -s -w "%{time_total}" "$STAGING_URL" || echo "0")
load_time_ms=$(echo "$load_time * 1000" | bc | cut -d. -f1)

if [ "$load_time_ms" -lt 2000 ]; then
    echo -e " ${GREEN}✅ Fast (${load_time_ms}ms)${NC}"
elif [ "$load_time_ms" -lt 5000 ]; then
    echo -e " ${YELLOW}⚠️  Acceptable (${load_time_ms}ms)${NC}"
else
    echo -e " ${RED}❌ Slow (${load_time_ms}ms)${NC}"
fi

echo ""
echo "================================"

# Summary
if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo -e "${GREEN}🎉 Staging environment is healthy${NC}"
    echo ""
    echo -e "${BLUE}🌐 Access staging at: $STAGING_URL${NC}"
    exit 0
else
    echo -e "${RED}❌ $FAILED_CHECKS check(s) failed${NC}"
    echo -e "${YELLOW}⚠️  Review errors above and check:${NC}"
    echo "  1. DNS propagation (can take 5-60 minutes)"
    echo "  2. GitHub Pages deployment status"
    echo "  3. Supabase project configuration"
    echo "  4. GitHub secrets configuration"
    echo ""
    echo -e "${BLUE}GitHub Actions:${NC}"
    echo "   gh run list --workflow=deploy-staging.yml"
    exit 1
fi
