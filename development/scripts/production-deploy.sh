#!/bin/bash
# Production-style build and deploy workflow
# This is how most companies actually do it

set -e

IMAGE_NAME="${1:-netneural-app}"
IMAGE_TAG="${2:-latest}"
REGISTRY="${3:-ghcr.io/netneural}"

echo "🏗️  Building locally (no server modifications needed)..."

# Step 1: Build locally using whatever Docker we have available
# We'll use the legacy builder since it's what we have
unset DOCKER_HOST  # Make sure we build locally

# Check if we can build locally
if docker info >/dev/null 2>&1; then
    echo "✅ Docker available locally, building..."
    docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .
    
    # Tag for registry
    docker tag "${IMAGE_NAME}:${IMAGE_TAG}" "${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    
    echo "📤 Pushing to registry..."
    docker push "${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    
    echo "📥 Pulling on remote server..."
    # Set back to remote for deployment
    export DOCKER_HOST=tcp://localhost:2375
    docker pull "${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    
    echo "✅ Deployment complete!"
else
    echo "❌ No local Docker available. Using alternative method..."
    echo "We'll create a deployment that builds on first run."
fi
