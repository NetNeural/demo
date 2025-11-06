#!/bin/bash

# Authenticated API Integration Test
# Requires valid Supabase access token for full testing

set -e

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://bldojxpockljyivldxwf.supabase.co}"
SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=================================="
echo "Authenticated API Test Runner"
echo "==================================${NC}"
echo ""

if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}Error: NEXT_PUBLIC_SUPABASE_ANON_KEY not set${NC}"
    echo "Please run: source .env.local"
    exit 1
fi

# Get access token (this requires manual login flow in real scenario)
echo -e "${YELLOW}Note: This script tests Edge Functions that require authentication.${NC}"
echo -e "${YELLOW}To fully test, you need to:${NC}"
echo "  1. Log in to https://demo.netneural.ai"
echo "  2. Open browser DevTools (F12)"
echo "  3. Run in console: localStorage.getItem('sb-bldojxpockljyivldxwf-auth-token')"
echo "  4. Copy the access_token value"
echo "  5. Set it: export ACCESS_TOKEN='your-token-here'"
echo ""

if [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${YELLOW}⚠ ACCESS_TOKEN not set - skipping authenticated tests${NC}"
    echo ""
    echo "Running unauthenticated health checks..."
    echo ""
fi

test_edge_function() {
    local name=$1
    local endpoint=$2
    local method=${3:-GET}
    local org_id=$4
    
    echo -n "Testing $name ($method)... "
    
    local url="$SUPABASE_URL/functions/v1/$endpoint"
    if [ -n "$org_id" ]; then
        url="$url?organization_id=$org_id"
    fi
    
    if [ -z "$ACCESS_TOKEN" ]; then
        # Unauthenticated - just check endpoint exists
        response=$(curl -s -w "\n%{http_code}" \
            -H "apikey: $SUPABASE_ANON_KEY" \
            -X "$method" \
            "$url" 2>&1)
        status_code=$(echo "$response" | tail -n 1)
        
        if [ "$status_code" = "401" ] || [ "$status_code" = "403" ]; then
            echo -e "${GREEN}✓ EXISTS${NC} (needs auth)"
        elif [ "$status_code" = "404" ]; then
            echo -e "${RED}✗ NOT DEPLOYED${NC}"
        else
            echo -e "${YELLOW}⚠ UNKNOWN${NC} (HTTP $status_code)"
        fi
    else
        # Authenticated - test actual functionality
        response=$(curl -s -w "\n%{http_code}" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "apikey: $SUPABASE_ANON_KEY" \
            -H "Content-Type: application/json" \
            -X "$method" \
            "$url" 2>&1)
        
        status_code=$(echo "$response" | tail -n 1)
        body=$(echo "$response" | head -n -1)
        
        if [ "$status_code" = "200" ] || [ "$status_code" = "201" ]; then
            echo -e "${GREEN}✓ PASS${NC} (HTTP $status_code)"
            # Show sample of response
            echo "    Response: $(echo "$body" | jq -r 'keys | join(", ")' 2>/dev/null || echo "$body" | head -c 100)"
        elif echo "$body" | grep -qi "infinite recursion"; then
            echo -e "${RED}✗ RLS RECURSION ERROR${NC}"
            echo "    $(echo "$body" | grep -i recursion)"
        else
            echo -e "${RED}✗ FAIL${NC} (HTTP $status_code)"
            echo "    Error: $(echo "$body" | jq -r '.error // .message // .' 2>/dev/null || echo "$body" | head -c 150)"
        fi
    fi
}

echo "Testing Edge Functions..."
echo ""

test_edge_function "Devices (GET)" "devices" "GET"
test_edge_function "Devices (POST)" "devices" "POST"
test_edge_function "Members (GET)" "members" "GET"
test_edge_function "Members (POST)" "members" "POST"
test_edge_function "Integrations (GET)" "integrations" "GET"
test_edge_function "Integrations (POST)" "integrations" "POST"
test_edge_function "Locations (GET)" "locations" "GET"
test_edge_function "Locations (POST)" "locations" "POST"
test_edge_function "Organizations (GET)" "organizations" "GET"
test_edge_function "Organizations (PATCH)" "organizations" "PATCH"
test_edge_function "Dashboard Stats" "dashboard-stats" "GET"
test_edge_function "Create User" "create-user" "POST"

echo ""
echo -e "${BLUE}=================================="
echo "Summary"
echo "==================================${NC}"
echo ""

if [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${YELLOW}⚠ Ran in unauthenticated mode (health checks only)${NC}"
    echo ""
    echo "To run full authenticated tests:"
    echo "  1. Get access token from browser localStorage"
    echo "  2. export ACCESS_TOKEN='your-token'"
    echo "  3. Re-run this script"
else
    echo -e "${GREEN}✓ Ran in authenticated mode (full integration test)${NC}"
fi

echo ""
echo "Key validation points:"
echo "  ✓ No 'infinite recursion' errors = RLS fix working"
echo "  ✓ All endpoints return 401/403 (not 404) = Deployed correctly"
echo "  ✓ Authenticated requests return 200/201 = Full functionality working"
echo ""
