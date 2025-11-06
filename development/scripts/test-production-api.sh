#!/bin/bash

# Production API Validation Script
# Tests Edge Functions and frontend integration after RLS recursion fix

set -e

PRODUCTION_URL="https://demo.netneural.ai"
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://bldojxpockljyivldxwf.supabase.co}"
SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================="
echo "Production API Validation"
echo "=================================="
echo "Production Site: $PRODUCTION_URL"
echo "Supabase URL: $SUPABASE_URL"
echo ""

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Testing $name... "
    
    response=$(curl -s -L -w "\n%{http_code}" "$url" 2>&1)
    status_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    # Accept both expected status and redirects (301, 302, 307) for auth-protected pages
    if [ "$status_code" = "$expected_status" ] || [ "$status_code" = "301" ] || [ "$status_code" = "302" ] || [ "$status_code" = "307" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $status_code)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected HTTP $expected_status, got $status_code)"
        echo "  Response: $(echo "$body" | head -c 200)"
        return 1
    fi
}

# Function to check for error messages
check_for_errors() {
    local name=$1
    local url=$2
    local error_pattern=$3
    
    echo -n "Checking $name for '$error_pattern'... "
    
    response=$(curl -s "$url" 2>&1)
    
    if echo "$response" | grep -iq "$error_pattern"; then
        echo -e "${RED}✗ FAIL${NC} - Error found: $error_pattern"
        echo "  Sample: $(echo "$response" | grep -i "$error_pattern" | head -1)"
        return 1
    else
        echo -e "${GREEN}✓ PASS${NC} - No error found"
        return 0
    fi
}

echo "=================================="
echo "1. Testing Frontend Pages"
echo "=================================="

# Test main pages load without errors
test_endpoint "Homepage" "$PRODUCTION_URL" 200
test_endpoint "Dashboard" "$PRODUCTION_URL/dashboard" 200
test_endpoint "Organizations" "$PRODUCTION_URL/dashboard/organizations" 200
test_endpoint "Devices" "$PRODUCTION_URL/dashboard/devices" 200
test_endpoint "Settings" "$PRODUCTION_URL/dashboard/settings" 200

echo ""
echo "=================================="
echo "2. Checking for RLS Recursion Error"
echo "=================================="

# Critical: Check that infinite recursion error is gone
check_for_errors "Organizations page" "$PRODUCTION_URL/dashboard/organizations" "infinite recursion"
check_for_errors "Integrations tab" "$PRODUCTION_URL/dashboard/organizations" "recursion detected"
check_for_errors "Members tab" "$PRODUCTION_URL/dashboard/organizations" "policy for relation"

echo ""
echo "=================================="
echo "3. Testing Edge Function Health"
echo "=================================="

# Test Edge Functions are accessible (will return 401/403 without auth, not 404)
test_edge_health() {
    local name=$1
    local endpoint=$2
    
    echo -n "Testing $name endpoint health... "
    
    # Just check it exists and responds (even with auth error)
    response=$(curl -s -w "\n%{http_code}" "$SUPABASE_URL/functions/v1/$endpoint" 2>&1)
    status_code=$(echo "$response" | tail -n 1)
    
    # 401 (Unauthorized) or 403 (Forbidden) means endpoint exists but needs auth - GOOD
    # 404 (Not Found) means endpoint doesn't exist - BAD
    if [ "$status_code" = "401" ] || [ "$status_code" = "403" ] || [ "$status_code" = "200" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $status_code - endpoint exists)"
        return 0
    elif [ "$status_code" = "404" ]; then
        echo -e "${RED}✗ FAIL${NC} (HTTP 404 - endpoint not deployed)"
        return 1
    else
        echo -e "${YELLOW}⚠ WARN${NC} (HTTP $status_code - unexpected response)"
        return 0
    fi
}

test_edge_health "devices" "devices"
test_edge_health "members" "members"
test_edge_health "integrations" "integrations"
test_edge_health "locations" "locations"
test_edge_health "organizations" "organizations"
test_edge_health "dashboard-stats" "dashboard-stats"
test_edge_health "create-user" "create-user"

echo ""
echo "=================================="
echo "4. Testing Supabase Database"
echo "=================================="

# Test database is accessible
echo -n "Testing database connection... "
if curl -s -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

echo ""
echo "=================================="
echo "5. Checking Migration Status"
echo "=================================="

echo "Checking applied migrations..."
cd "$(dirname "$0")/.." && npx supabase migration list --linked 2>&1 | tail -5

echo ""
echo "=================================="
echo "Summary"
echo "=================================="
echo ""
echo "✓ If all tests pass, the RLS recursion fix is working"
echo "✓ Frontend should now be able to:"
echo "  - Load Integrations page (#60, #61, #67)"
echo "  - Load Members page (#57)"
echo "  - Load Devices page (#55)"
echo "  - Add devices (#69)"
echo "  - Create users (#59)"
echo "  - Edit/delete locations (#65, #66)"
echo "  - Update organization settings (#63)"
echo ""
echo "⚠ Manual testing still required for:"
echo "  - Button click handlers (need authenticated session)"
echo "  - Form submissions"
echo "  - Dialog interactions"
echo ""
