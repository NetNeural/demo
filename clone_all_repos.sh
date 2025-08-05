#!/bin/bash

# Script to clone all NetNeural repositories
echo "Starting to clone all NetNeural repositories..."

# List of repositories to clone
repos=(
    "origin-ui"
    "iot-common"
    "sso"
    "docker-build-template"
    "sso-ui"
    "digital-twin"
    "api-slurper"
    "alerts-bfu"
    "vmark-cloud-gateway"
    "device-ingress"
    "notifications"
    "recall-ingest"
    "cellular-ui"
    "account-manager"
    "cloud-data-manager"
    "react-components"
    "merchandising"
    "cellular-alerts"
    "digital-ocean-k8s-setup"
    "store-ui"
    "edge-vmark-input"
    "action-get-latest-tag"
    "nn-alerts-ios"
    "Alerts-Android"
    "Onboarding"
    "Policies"
    "test-stripe-backend"
    "dev-coap-server-californium"
    "ui-dev-server"
    "cellular-manager"
    "cellular-gateway"
    "data-manager"
    "bundle-output-netneural"
    "core-ui"
    "mod-edge-core"
    "bundle-api-provision-thread"
    "bundle-input-device-rest"
    "alert-listener"
    "core-mdns-site-local-broadcast"
    "ot-commissioner"
    "bundle-iot-device-admin"
    "bundle-provision-security-data-netneural"
    "bundle-mdns-core-python"
    "cloud-device-admin-mqtt"
    "bundle-template-python"
    "bundle-other-mdns-hub"
    "bundle-template-cpp"
    "bundle-template-java"
    "mqtt2db"
    "hydrant"
)

# Clone each repository
for repo in "${repos[@]}"; do
    echo "Cloning $repo..."
    if [ -d "$repo" ]; then
        echo "  Directory $repo already exists, skipping..."
    else
        gh repo clone "NetNeural/$repo" "$repo"
        if [ $? -eq 0 ]; then
            echo "  ✓ Successfully cloned $repo"
        else
            echo "  ✗ Failed to clone $repo"
        fi
    fi
    echo ""
done

echo "Finished cloning all repositories!"
echo "Total repositories: ${#repos[@]}"
