#!/bin/bash

# NetNeural Monorepo - Check Status of All External Repositories
# This script shows the git status of all external repositories

echo "🔍 Checking status of all external repositories..."

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
CLEAN=0
DIRTY=0
TOTAL=0

# Function to check repository status
check_repo_status() {
    local repo_dir=$1
    if [ -d "$repo_dir" ]; then
        cd "$repo_dir"
        
        if [ -d ".git" ]; then
            # Get current branch and status
            current_branch=$(git branch --show-current)
            
            # Check if there are uncommitted changes
            if git diff-index --quiet HEAD -- 2>/dev/null; then
                echo -e "${GREEN}✅ $repo_dir${NC} (${BLUE}$current_branch${NC}) - Clean"
                ((CLEAN++))
            else
                echo -e "${YELLOW}⚠️  $repo_dir${NC} (${BLUE}$current_branch${NC}) - Has uncommitted changes"
                
                # Show brief status
                echo "   Modified files:"
                git status --porcelain | head -5 | sed 's/^/   /'
                if [ $(git status --porcelain | wc -l) -gt 5 ]; then
                    echo "   ... and $(($(git status --porcelain | wc -l) - 5)) more files"
                fi
                ((DIRTY++))
            fi
        else
            echo -e "${RED}❌ $repo_dir - Not a git repository${NC}"
            ((DIRTY++))
        fi
        
        cd ..
        ((TOTAL++))
        echo ""
    fi
}

# Check all repositories
echo "📦 Backend Services:"
check_repo_status "account-manager"
check_repo_status "alert-listener"
check_repo_status "alerts-bfu"
check_repo_status "api-slurper"
check_repo_status "cellular-alerts"
check_repo_status "cellular-gateway"
check_repo_status "cellular-manager"
check_repo_status "cloud-data-manager"
check_repo_status "core-ui"
check_repo_status "data-manager"
check_repo_status "device-ingress"
check_repo_status "digital-twin"
check_repo_status "edge-vmark-input"
check_repo_status "iot-common"
check_repo_status "mod-edge-core"
check_repo_status "mqtt2db"
check_repo_status "notifications"
check_repo_status "recall-ingest"
check_repo_status "sso"
check_repo_status "ui-dev-server"
check_repo_status "vmark-cloud-gateway"

echo "🌐 Frontend Applications:"
check_repo_status "cellular-ui"
check_repo_status "origin-ui"
check_repo_status "react-components"
check_repo_status "sso-ui"
check_repo_status "store-ui"

echo "📱 Mobile Applications:"
check_repo_status "Alerts-Android"
check_repo_status "nn-alerts-ios"

echo "📦 Bundle Components:"
check_repo_status "bundle-api-provision-thread"
check_repo_status "bundle-input-device-rest"
check_repo_status "bundle-iot-device-admin"
check_repo_status "bundle-mdns-core-python"
check_repo_status "bundle-other-mdns-hub"
check_repo_status "bundle-output-netneural"
check_repo_status "bundle-provision-security-data-netneural"
check_repo_status "bundle-template-cpp"
check_repo_status "bundle-template-java"
check_repo_status "bundle-template-python"

echo "🛠️ Infrastructure & Tools:"
check_repo_status "action-get-latest-tag"
check_repo_status "dev-coap-server-californium"
check_repo_status "digital-ocean-k8s-setup"
check_repo_status "docker-build-template"
check_repo_status "hydrant"
check_repo_status "merchandising"
check_repo_status "test-stripe-backend"

echo "🔗 Integration Services:"
check_repo_status "cloud-device-admin-mqtt"
check_repo_status "core-mdns-site-local-broadcast"
check_repo_status "Onboarding"
check_repo_status "ot-commissioner"
check_repo_status "Policies"

# Summary
echo "=================================================="
echo "📊 Repository Status Summary:"
echo -e "${GREEN}✅ Clean repositories: $CLEAN${NC}"
echo -e "${YELLOW}⚠️  Repositories with changes: $DIRTY${NC}"
echo -e "${BLUE}📝 Total repositories checked: $TOTAL${NC}"

if [ $DIRTY -eq 0 ]; then
    echo -e "${GREEN}🎉 All repositories are clean!${NC}"
else
    echo -e "${YELLOW}💡 Tip: Use 'git status' in individual repositories for detailed information${NC}"
    echo -e "${YELLOW}💡 Tip: Use 'git stash' to temporarily save changes${NC}"
fi
