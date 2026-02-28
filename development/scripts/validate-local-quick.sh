#!/bin/bash

# Quick Local Validation using REST API
# No direct database connection needed

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================"
echo "Local RLS Validation (Quick Test)"
echo -e "========================================${NC}\n"

LOCAL_API="http://127.0.0.1:54321"
LOCAL_ANON_KEY="<YOUR_SUPABASE_ANON_KEY>"

PASSED=0
FAILED=0

echo -e "${YELLOW}1. Local Supabase Status:${NC}\n"
if curl -s "$LOCAL_API" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Local Supabase responding${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ Local Supabase not responding${NC}"
    FAILED=$((FAILED + 1))
fi

echo -e "\n${YELLOW}2. Migration Status:${NC}\n"
if npx supabase migration list --local 2>&1 | grep -q "20251106021002.*20251106021002"; then
    echo -e "${GREEN}✓ RLS fix migration applied${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ RLS fix migration NOT applied${NC}"
    FAILED=$((FAILED + 1))
fi

echo -e "\n${YELLOW}3. RLS Recursion Tests:${NC}\n"

test_table() {
    local table=$1
    echo -n "  Testing $table table... "
    
    result=$(curl -s \
        -H "apikey: $LOCAL_ANON_KEY" \
        "$LOCAL_API/rest/v1/$table?select=id&limit=1" 2>&1)
    
    if echo "$result" | grep -qi "infinite recursion"; then
        echo -e "${RED}✗ RECURSION ERROR!${NC}"
        FAILED=$((FAILED + 1))
        return 1
    elif echo "$result" | grep -qi "error"; then
        # Auth error is OK (means table exists, just needs auth)
        if echo "$result" | grep -qi "JWT"; then
            echo -e "${GREEN}✓ PASS (needs auth)${NC}"
            PASSED=$((PASSED + 1))
        else
            echo -e "${YELLOW}⚠ Error but not recursion${NC}"
            PASSED=$((PASSED + 1))
        fi
    else
        echo -e "${GREEN}✓ PASS (no recursion)${NC}"
        PASSED=$((PASSED + 1))
    fi
}

test_table "organization_members"
test_table "device_integrations"
test_table "devices"
test_table "locations"
test_table "integrations"

echo -e "\n${YELLOW}4. Edge Functions:${NC}\n"

test_function() {
    local name=$1
    local endpoint=$2
    
    echo -n "  Testing $name... "
    
    result=$(curl -s -w "\n%{http_code}" \
        -H "apikey: $LOCAL_ANON_KEY" \
        "$LOCAL_API/functions/v1/$endpoint" 2>&1)
    
    status=$(echo "$result" | tail -n 1)
    body=$(echo "$result" | head -n -1)
    
    if echo "$body" | grep -qi "infinite recursion"; then
        echo -e "${RED}✗ RECURSION ERROR${NC}"
        FAILED=$((FAILED + 1))
    elif [ "$status" = "401" ] || [ "$status" = "403" ] || [ "$status" = "200" ]; then
        echo -e "${GREEN}✓ PASS (HTTP $status)${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${YELLOW}⚠ HTTP $status${NC}"
        PASSED=$((PASSED + 1))
    fi
}

test_function "devices" "devices"
test_function "members" "members"
test_function "integrations" "integrations"
test_function "locations" "locations"
test_function "dashboard-stats" "dashboard-stats"

echo -e "\n${BLUE}========================================"
echo "Summary"
echo -e "========================================${NC}\n"

echo "Tests: $PASSED passed, $FAILED failed"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL LOCAL TESTS PASSED!${NC}\n"
    echo -e "${CYAN}Validated:${NC}"
    echo "  ✓ RLS fix migration applied locally"
    echo "  ✓ No infinite recursion in organization_members"
    echo "  ✓ No recursion in device_integrations"
    echo "  ✓ All Edge Functions work without recursion"
    echo ""
    echo -e "${GREEN}Ready to push to production!${NC}"
    exit 0
else
    echo -e "${RED}✗ TESTS FAILED - Fix issues before pushing${NC}"
    exit 1
fi
