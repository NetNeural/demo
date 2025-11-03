#!/bin/bash

# Test Runner for GitHub Issues #40, #41, #42, #43
# Executes comprehensive test suite validating frontend, backend, and business logic

set -e

echo "================================="
echo "GitHub Issues Test Suite Runner"
echo "================================="
echo ""
echo "Testing Issues:"
echo "  #40 - MQTT Integration Not Saving"
echo "  #41 - Page Title CSS Alignment"
echo "  #42 - Add Member Functionality"
echo "  #43 - Integration Priorities E2E"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to project directory
cd "$(dirname "$0")/.."

echo "Step 1: Running type check..."
if npm run type-check; then
    echo -e "${GREEN}✓ Type check passed${NC}"
else
    echo -e "${RED}✗ Type check failed${NC}"
    exit 1
fi

echo ""
echo "Step 2: Running linter..."
if npm run lint; then
    echo -e "${GREEN}✓ Linter passed${NC}"
else
    echo -e "${YELLOW}⚠ Linter warnings (non-blocking)${NC}"
fi

echo ""
echo "Step 3: Running unit and integration tests..."
echo ""

# Run specific test suites for each issue
echo "Testing Issue #40 - MQTT Integration..."
if npm test -- __tests__/github-issues/issue-40-mqtt-integration.test.tsx; then
    echo -e "${GREEN}✓ Issue #40 tests passed${NC}"
else
    echo -e "${RED}✗ Issue #40 tests failed${NC}"
    exit 1
fi

echo ""
echo "Testing Issue #41 - Page Title CSS..."
if npm test -- __tests__/github-issues/issue-41-page-title-css.test.tsx; then
    echo -e "${GREEN}✓ Issue #41 tests passed${NC}"
else
    echo -e "${RED}✗ Issue #41 tests failed${NC}"
    exit 1
fi

echo ""
echo "Testing Issue #42 - Add Member..."
if npm test -- __tests__/github-issues/issue-42-add-member.test.tsx; then
    echo -e "${GREEN}✓ Issue #42 tests passed${NC}"
else
    echo -e "${RED}✗ Issue #42 tests failed${NC}"
    exit 1
fi

echo ""
echo "Testing Issue #43 - Integration E2E..."
if npm test -- __tests__/github-issues/issue-43-integration-e2e.test.tsx; then
    echo -e "${GREEN}✓ Issue #43 tests passed${NC}"
else
    echo -e "${RED}✗ Issue #43 tests failed${NC}"
    exit 1
fi

echo ""
echo "Step 4: Running all GitHub issue tests together..."
if npm test -- __tests__/github-issues/; then
    echo -e "${GREEN}✓ All GitHub issue tests passed${NC}"
else
    echo -e "${RED}✗ Some GitHub issue tests failed${NC}"
    exit 1
fi

echo ""
echo "Step 5: Generating coverage report..."
if npm run test:coverage -- __tests__/github-issues/; then
    echo -e "${GREEN}✓ Coverage report generated${NC}"
else
    echo -e "${YELLOW}⚠ Coverage generation completed with warnings${NC}"
fi

echo ""
echo "================================="
echo -e "${GREEN}All Tests Passed Successfully!${NC}"
echo "================================="
echo ""
echo "Summary:"
echo "  ✓ Type checking passed"
echo "  ✓ Linting completed"
echo "  ✓ Issue #40 (MQTT Integration) - All tests passed"
echo "  ✓ Issue #41 (Page Title CSS) - All tests passed"
echo "  ✓ Issue #42 (Add Member) - All tests passed"
echo "  ✓ Issue #43 (Integration E2E) - All tests passed"
echo ""
echo "Next steps:"
echo "  1. Review coverage report in ./coverage"
echo "  2. Run build: npm run build"
echo "  3. Commit changes: git add . && git commit"
echo "  4. Push to remote: git push"
echo ""
