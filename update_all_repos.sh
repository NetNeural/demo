#!/bin/bash

# NetNeural Monorepo - Update All External Repositories
# This script pulls the latest changes from all external repositories

echo "🔄 Updating all external repositories..."

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for tracking
UPDATED=0
FAILED=0
TOTAL=0

# Function to update a repository
update_repo() {
    local repo_dir=$1
    if [ -d "$repo_dir" ]; then
        echo -e "${YELLOW}Updating $repo_dir...${NC}"
        cd "$repo_dir"
        
        # Check if it's a git repository
        if [ -d ".git" ]; then
            # Get current branch
            current_branch=$(git branch --show-current)
            
            # Pull latest changes
            if git pull origin "$current_branch" 2>/dev/null; then
                echo -e "${GREEN}✅ $repo_dir updated successfully${NC}"
                ((UPDATED++))
            else
                echo -e "${RED}❌ Failed to update $repo_dir${NC}"
                ((FAILED++))
            fi
        else
            echo -e "${RED}❌ $repo_dir is not a git repository${NC}"
            ((FAILED++))
        fi
        
        cd ..
        ((TOTAL++))
    fi
}

# Backend Services
echo "📦 Updating Backend Services..."
update_repo "account-manager"
update_repo "alert-listener"
update_repo "alerts-bfu"
update_repo "api-slurper"
update_repo "cellular-alerts"
update_repo "cellular-gateway"
update_repo "cellular-manager"
update_repo "cloud-data-manager"
update_repo "core-ui"
update_repo "data-manager"
update_repo "device-ingress"
update_repo "digital-twin"
update_repo "edge-vmark-input"
update_repo "iot-common"
update_repo "mod-edge-core"
update_repo "mqtt2db"
update_repo "notifications"
update_repo "recall-ingest"
update_repo "sso"
update_repo "ui-dev-server"
update_repo "vmark-cloud-gateway"

# Frontend Applications
echo "🌐 Updating Frontend Applications..."
update_repo "cellular-ui"
update_repo "origin-ui"
update_repo "react-components"
update_repo "sso-ui"
update_repo "store-ui"

# Mobile Applications
echo "📱 Updating Mobile Applications..."
update_repo "Alerts-Android"
update_repo "nn-alerts-ios"

# Bundle Components
echo "📦 Updating Bundle Components..."
update_repo "bundle-api-provision-thread"
update_repo "bundle-input-device-rest"
update_repo "bundle-iot-device-admin"
update_repo "bundle-mdns-core-python"
update_repo "bundle-other-mdns-hub"
update_repo "bundle-output-netneural"
update_repo "bundle-provision-security-data-netneural"
update_repo "bundle-template-cpp"
update_repo "bundle-template-java"
update_repo "bundle-template-python"

# Infrastructure & Tools
echo "🛠️ Updating Infrastructure & Tools..."
update_repo "action-get-latest-tag"
update_repo "dev-coap-server-californium"
update_repo "digital-ocean-k8s-setup"
update_repo "docker-build-template"
update_repo "hydrant"
update_repo "merchandising"
update_repo "test-stripe-backend"

# Integration Services
echo "🔗 Updating Integration Services..."
update_repo "cloud-device-admin-mqtt"
update_repo "core-mdns-site-local-broadcast"
update_repo "Onboarding"
update_repo "ot-commissioner"
update_repo "Policies"

# Summary
echo ""
echo "📊 Update Summary:"
echo -e "${GREEN}✅ Successfully updated: $UPDATED repositories${NC}"
echo -e "${RED}❌ Failed to update: $FAILED repositories${NC}"
echo -e "${YELLOW}📝 Total processed: $TOTAL repositories${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All repositories updated successfully!${NC}"
else
    echo -e "${YELLOW}⚠️ Some repositories failed to update. Check the output above for details.${NC}"
fi
